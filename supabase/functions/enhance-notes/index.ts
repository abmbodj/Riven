import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { consumeAiQuota, createHttpError, parseAiJsonResponse } from '../_shared/aiCore.mjs';
import { createAiClient } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { buildSinglePassNoteEnhancePrompt, buildSinglePassNoteGeneratePrompt } from '../_shared/notePrompts.mjs';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createSSEStream } from '../_shared/streaming.ts';

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
    const { noteId, audioPath, userNotes, title, className } = body;

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

    const transcription = await ai.transcribeAudio(audioBlob, filename);

    // Determine mode and build prompt
    const isEnhanceMode = userNotes && userNotes.trim().length > 0;
    const systemPrompt = isEnhanceMode
      ? buildSinglePassNoteEnhancePrompt(userNotes, className)
      : buildSinglePassNoteGeneratePrompt(className);

    const aiMessages = [
      { role: 'user' as const, content: `${systemPrompt}\n\nLecture Audio Transcription:\n${transcription}` },
    ];

    // ── STREAMING PATH ──────────────────────────────────
    if (useStreaming) {
      const { response, sendChunk, sendError, sendDone, close } = createSSEStream(request);

      (async () => {
        try {
          const streamResponse = ai.streamContent({
            model: 'llama-3.3-70b-versatile',
            messages: aiMessages,
            maxTokens: 6144,
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

          const enhancedContent = parseAiJsonResponse(
            fullText,
            'AI generated invalid notes format. Please try again.',
          );

          if (!enhancedContent || typeof enhancedContent !== 'object' || enhancedContent.type !== 'doc') {
            throw createHttpError('AI failed to generate valid enhanced notes.', 500);
          }

          // Update the note with enhanced content
          const { error: updateError } = await admin
            .from('notes')
            .update({
              enhanced_content: enhancedContent,
              audio_url: null,
              source_type: 'audio',
            })
            .eq('id', noteId)
            .eq('user_id', authUser.id);

          if (updateError) throw updateError;

          // Cleanup audio file
          admin.storage.from('note-audio').remove([audioPath]).catch(() => {});

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
      model: 'llama-3.3-70b-versatile',
      messages: aiMessages,
      responseFormat: 'json_object',
    });

    const enhancedContent = parseAiJsonResponse(
      rawText,
      'AI generated invalid notes format. Please try again.',
    );

    if (!enhancedContent || typeof enhancedContent !== 'object' || enhancedContent.type !== 'doc') {
      throw createHttpError('AI failed to generate valid enhanced notes.', 500);
    }

    // Update the note with enhanced content
    const { error: updateError } = await admin
      .from('notes')
      .update({
        enhanced_content: enhancedContent,
        audio_url: null,
        source_type: 'audio',
      })
      .eq('id', noteId)
      .eq('user_id', authUser.id);

    if (updateError) throw updateError;

    // Cleanup audio file
    admin.storage.from('note-audio').remove([audioPath]).catch(() => {});

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
