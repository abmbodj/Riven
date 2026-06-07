import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { consumeAiQuota, createHttpError, parseAiJsonResponse } from '../_shared/aiCore.mjs';
import { createAiClient } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { buildSinglePassNoteEnhancePrompt, buildSinglePassNoteGeneratePrompt } from '../_shared/notePrompts.mjs';
import { buildRetryInstruction, validateNoteDoc } from '../_shared/noteValidator.mjs';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createSSEStream } from '../_shared/streaming.ts';

const RETRY_SEVERITY_THRESHOLD = 4;
// Hybrid models: a fast model streams the first usable pass; a (configurably) stronger
// model handles the correction/retry + batch path. Both default to the same model so
// behavior is unchanged until NOTES_FINAL_MODEL is configured.
const NOTES_DRAFT_MODEL = Deno.env.get('AI_DRAFT_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct';
const NOTES_FINAL_MODEL = Deno.env.get('AI_FINAL_MODEL') ?? NOTES_DRAFT_MODEL;
const NOTES_MAX_TOKENS = 8192;

// Bias Whisper toward the lecture's domain vocabulary and proper nouns so technical
// terms and names transcribe correctly instead of being mangled.
const buildTranscriptionBiasPrompt = (className?: string, subject?: string): string => {
  const parts: string[] = [];
  if (className) parts.push(`Lecture for the class "${className}".`);
  if (subject) parts.push(`Subject area: ${subject}.`);
  parts.push('Expect domain-specific terminology, technical vocabulary, and proper nouns.');
  return parts.join(' ');
};

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.headers.get('x-warmup') === '1') {
    return new Response('ok', { status: 200, headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const reqUrl = new URL(request.url);
    const useStreaming = reqUrl.searchParams.get('stream') === '1' || body.stream === true;
    const { noteId, audioPath, userNotes, title, className, subject } = body;

    if (!noteId || !audioPath) {
      return jsonResponse(
        { error: 'noteId and audioPath are required' },
        { status: 400 },
        request,
      );
    }

    // Parallel: rate limit + auth resolution
    const [rl, authUser] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const admin = getSupabaseAdmin();

    // Parallel: user fetch + audio download
    const [userResult, audioResult] = await Promise.all([
      admin
        .from('users')
        .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier')
        .eq('id', authUser.id)
        .maybeSingle(),
      admin.storage.from('note-audio').download(audioPath),
    ]);

    const { data: user, error: userError } = userResult;
    if (userError) throw userError;
    if (!user) {
      return jsonResponse({ error: 'User not found' }, { status: 401 }, request);
    }

    await consumeAiQuota({
      user,
      persistUsage: async ({ count, lastReset }: PersistUsagePayload) => {
        const { error: updateError } = await admin
          .from('users')
          .update({
            ai_generations_count: count,
            last_ai_generation_reset: lastReset.toISOString(),
          })
          .eq('id', authUser.id);
        if (updateError) throw updateError;
      },
    });

    const { data: audioData, error: storageError } = audioResult;

    if (storageError || !audioData) {
      throw createHttpError('Failed to retrieve audio file', 500);
    }

    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    if (!apiKey) {
      throw createHttpError('AI integration is not configured on the server.', 500);
    }

    const ai = createAiClient(apiKey);

    // Transcribe audio with Whisper
    const ext = audioPath.split('.').pop()?.toLowerCase() ?? 'webm';
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      mp4: 'audio/mp4',
      mpeg: 'audio/mpeg',
      mp3: 'audio/mpeg',
      aac: 'audio/aac',
      m4a: 'audio/m4a',
    };
    const audioMimeType = mimeMap[ext] || 'audio/webm';
    const audioBlob = new Blob([await audioData.arrayBuffer()], { type: audioMimeType });
    const filename = audioPath.split('/').pop() || 'audio.webm';

    // Accurate, full-context transcription with vocabulary biasing. Segments give us a
    // timeline (for replay) and confidence signals (to flag low-confidence spans).
    const { text: transcription, segments } = await ai.transcribeAudioWithSegments(
      audioBlob,
      filename,
      { prompt: buildTranscriptionBiasPrompt(className, subject) },
    );

    // Determine mode and build prompt
    const isEnhanceMode = userNotes && userNotes.trim().length > 0;
    const systemPrompt = isEnhanceMode
      ? buildSinglePassNoteEnhancePrompt(userNotes, className, subject, transcription)
      : buildSinglePassNoteGeneratePrompt(className, subject, transcription);

    const aiMessages = [
      { role: 'user' as const, content: `${systemPrompt}\n\nLecture Audio Transcription:\n${transcription}` },
    ];

    // ── STREAMING PATH ──────────────────────────────────
    if (useStreaming) {
      const { response, sendChunk, sendError, sendDone, close } = createSSEStream(request);

      (async () => {
        try {
          const streamResponse = ai.streamContent({
            model: NOTES_DRAFT_MODEL,
            messages: aiMessages,
            maxTokens: NOTES_MAX_TOKENS,
          });

          const STREAM_DEADLINE_MS = 90_000;
          const deadline = Date.now() + STREAM_DEADLINE_MS;
          let fullText = '';
          for await (const chunk of streamResponse) {
            if (Date.now() > deadline) {
              throw createHttpError('Generation timed out. Please try again with shorter content.', 504);
            }
            const text = chunk.text ?? '';
            if (text) {
              fullText += text;
              sendChunk(text);
            }
          }

          let enhancedContent = parseAiJsonResponse(
            fullText,
            'AI generated invalid notes format. Please try again.',
          );

          if (!enhancedContent || typeof enhancedContent !== 'object' || enhancedContent.type !== 'doc') {
            throw createHttpError('AI failed to generate valid enhanced notes.', 500);
          }

          const validation = validateNoteDoc(enhancedContent, { className, subject, transcript: transcription });
          if (!validation.ok && validation.severity >= RETRY_SEVERITY_THRESHOLD && deadline - Date.now() > 5_000) {
            try {
              // Signal client to discard streamed chunks; a fresh corrected stream follows.
              sendChunk('\x00retry-start\x00');

              const retryMessages = [
                ...aiMessages,
                { role: 'assistant' as const, content: fullText },
                { role: 'user' as const, content: buildRetryInstruction(validation) },
              ];

              let retryFullText = '';
              const retryStream = ai.streamContent({
                model: NOTES_FINAL_MODEL,
                messages: retryMessages,
                maxTokens: NOTES_MAX_TOKENS,
              });

              for await (const chunk of retryStream) {
                if (Date.now() > deadline) {
                  throw createHttpError('Retry timed out. Please try again.', 504);
                }
                const text = chunk.text ?? '';
                if (text) {
                  retryFullText += text;
                  sendChunk(text);
                }
              }

              const retried = parseAiJsonResponse(retryFullText, 'Retry produced invalid JSON');
              if (retried && typeof retried === 'object' && retried.type === 'doc') {
                const retriedValidation = validateNoteDoc(retried, { className, subject, transcript: transcription });
                if (retriedValidation.severity < validation.severity) {
                  enhancedContent = retried;
                }
              }
            } catch (retryErr) {
              console.warn('[enhance-notes] retry failed, keeping original output', retryErr);
            }
          }

          // Persist enhanced content + the transcript/segment timeline. Audio is retained
          // (audio_url keeps pointing at the stored file) so the note can replay the recording.
          const { error: updateError } = await admin
            .from('notes')
            .update({
              enhanced_content: enhancedContent,
              transcript: transcription,
              audio_segments: segments,
              audio_url: audioPath,
              polish_status: 'polished',
              source_type: 'audio',
            })
            .eq('id', noteId)
            .eq('user_id', authUser.id);

          if (updateError) throw updateError;

          sendDone({
            enhanced_content: enhancedContent,
            title: title || 'Enhanced Notes',
          });
        } catch (err: unknown) {
          const reqErr = normalizeRequestError(err);
          sendError(
            reqErr.message || 'An unexpected error occurred during note enhancement.',
            typeof reqErr.status === 'number' ? reqErr.status : 500,
            typeof reqErr.canWatchAd === 'boolean' ? { canWatchAd: reqErr.canWatchAd } : {},
          );
        } finally {
          close();
        }
      })();

      return response;
    }

    // ── BATCH PATH ──────────────────────────────────────
    const rawText = await ai.generateContent({
      model: NOTES_FINAL_MODEL,
      messages: aiMessages,
      maxTokens: NOTES_MAX_TOKENS,
      responseFormat: 'json_object',
    });

    let enhancedContent = parseAiJsonResponse(
      rawText,
      'AI generated invalid notes format. Please try again.',
    );

    if (!enhancedContent || typeof enhancedContent !== 'object' || enhancedContent.type !== 'doc') {
      throw createHttpError('AI failed to generate valid enhanced notes.', 500);
    }

    const validation = validateNoteDoc(enhancedContent, { className, subject, transcript: transcription });
    if (!validation.ok && validation.severity >= RETRY_SEVERITY_THRESHOLD) {
      try {
        const retryText = await ai.generateContent({
          model: NOTES_FINAL_MODEL,
          messages: [
            ...aiMessages,
            { role: 'assistant' as const, content: rawText },
            { role: 'user' as const, content: buildRetryInstruction(validation) },
          ],
          maxTokens: NOTES_MAX_TOKENS,
          responseFormat: 'json_object',
        });
        const retried = parseAiJsonResponse(retryText, 'Retry produced invalid JSON');
        if (retried && typeof retried === 'object' && retried.type === 'doc') {
          const retriedValidation = validateNoteDoc(retried, { className, subject, transcript: transcription });
          if (retriedValidation.severity < validation.severity) {
            enhancedContent = retried;
          }
        }
      } catch (retryErr) {
        console.warn('[enhance-notes] retry failed, keeping original output', retryErr);
      }
    }

    // Persist enhanced content + transcript/segment timeline. Audio is retained for replay.
    const { error: updateError } = await admin
      .from('notes')
      .update({
        enhanced_content: enhancedContent,
        transcript: transcription,
        audio_segments: segments,
        audio_url: audioPath,
        polish_status: 'polished',
        source_type: 'audio',
      })
      .eq('id', noteId)
      .eq('user_id', authUser.id);

    if (updateError) throw updateError;

    return jsonResponse(
      {
        message: 'Notes enhanced successfully',
        enhanced_content: enhancedContent,
        title: title || 'Enhanced Notes',
      },
      { status: 200 },
      request,
    );
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[enhance-notes edge function] error', requestError);

    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    const responseBody: Record<string, unknown> = {
      error: typeof requestError.status === 'number'
        ? requestError.message
        : 'An unexpected error occurred during note enhancement.',
    };

    if (typeof requestError.canWatchAd === 'boolean') {
      responseBody.canWatchAd = requestError.canWatchAd;
    }

    return jsonResponse(responseBody, { status }, request);
  }
});
