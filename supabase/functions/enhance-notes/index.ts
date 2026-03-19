import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenAI } from 'npm:@google/genai@1.42.0';

import { buildSubjectContext, consumeAiQuota, createHttpError, parseAiJsonResponse } from '../_shared/aiCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createSSEStream } from '../_shared/streaming.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

const TIPTAP_FORMAT_INSTRUCTIONS = `Output ONLY valid JSON: { "type": "doc", "content": [...] }. No markdown/backticks outside JSON.
Node types: heading (attrs.level 1-3), paragraph, bulletList→listItem→paragraph, orderedList→listItem→paragraph, blockquote→paragraph, horizontalRule.
Text marks: { "type": "text", "marks": [{ "type": "bold" }], "text": "..." } (also: italic, code).`;

const buildGeneratePrompt = (className?: string) => `You are a lecture notes assistant. Given the audio recording, produce clean, structured notes as a Tiptap JSON document.

${buildSubjectContext(className)}

H1 major topics, H2 subtopics, H3 detail. Bullets for concepts, ordered lists for steps. Bold key terms first use. Blockquotes for definitions/theorems. End sections with takeaway. Include "Key Concepts" and "Potential Exam Questions" (3-5 questions) sections. Be concise — omit filler.

${TIPTAP_FORMAT_INSTRUCTIONS}`;

const buildEnhancePrompt = (userNotes: string, className?: string) => `You are a lecture notes assistant. Expand the student's notes using the lecture audio as context.

${buildSubjectContext(className)}

Preserve student's phrasing. Fill gaps from audio. Add missing terms, definitions, examples. H1/H2/H3 hierarchy. Bold key terms. Blockquotes for definitions. Ordered lists for steps. End sections with takeaway. Add "Key Concepts" and "Potential Exam Questions" sections. Student notes take priority.

${TIPTAP_FORMAT_INSTRUCTIONS}

Student's notes:
${userNotes}`;

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

    // Convert to array buffer for Gemini upload
    const audioArrayBuffer = await audioData.arrayBuffer();
    const audioUint8 = new Uint8Array(audioArrayBuffer);

    // Determine MIME type from path
    const ext = audioPath.split('.').pop()?.toLowerCase() ?? 'webm';
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      mp4: 'audio/mp4',
      mpeg: 'audio/mpeg',
      mp3: 'audio/mpeg',
    };
    const audioMimeType = mimeMap[ext] || 'audio/webm';

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    if (!apiKey) {
      throw createHttpError('AI integration is not configured on the server.', 500);
    }

    const ai = new GoogleGenAI({ apiKey });

    // Determine mode and build prompt
    const isEnhanceMode = userNotes && userNotes.trim().length > 0;
    const systemPrompt = isEnhanceMode
      ? buildEnhancePrompt(userNotes, className)
      : buildGeneratePrompt(className);

    const INLINE_DATA_LIMIT = 20 * 1024 * 1024; // 20MB
    const useInlineData = audioUint8.byteLength < INLINE_DATA_LIMIT;

    let geminiFileName: string | null = null;
    let audioContent: Record<string, unknown>;

    if (useInlineData) {
      // Small files: send directly as base64 inline data (no upload/polling overhead)
      const base64Audio = btoa(
        audioUint8.reduce((data, byte) => data + String.fromCharCode(byte), ''),
      );
      audioContent = {
        inlineData: {
          data: base64Audio,
          mimeType: audioMimeType,
        },
      };
    } else {
      // Large files (>20MB): use Gemini File API with upload + polling
      const uploadedFile = await ai.files.upload({
        file: new Blob([audioUint8], { type: audioMimeType }),
        config: {
          mimeType: audioMimeType,
          displayName: `lecture-${noteId}`,
        },
      });

      const MAX_WAIT_MS = 120_000;
      const POLL_INTERVAL_MS = 3_000;
      const startWait = Date.now();

      let file = uploadedFile;
      while (file.state === 'PROCESSING') {
        if (Date.now() - startWait > MAX_WAIT_MS) {
          ai.files.delete({ name: file.name! }).catch(() => {});
          throw createHttpError('Audio processing timed out. Try a shorter recording or retry.', 504);
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        file = await ai.files.get({ name: file.name! });
      }

      if (file.state === 'FAILED') {
        throw createHttpError('Audio processing failed. Please try again.', 500);
      }

      geminiFileName = file.name!;
      audioContent = {
        fileData: {
          fileUri: file.uri!,
          mimeType: audioMimeType,
        },
      };
    }

    const aiContents = [
      { text: systemPrompt },
      audioContent,
    ];

    // ── STREAMING PATH ──────────────────────────────────
    if (useStreaming) {
      const { response, sendChunk, sendError, sendDone, close } = createSSEStream(request);

      (async () => {
        try {
          const streamResponse = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: aiContents,
            config: {
              temperature: 0,
              thinkingConfig: { thinkingBudget: 0 },
              maxOutputTokens: 6144,
            },
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

          // Cleanup
          if (geminiFileName) {
            ai.files.delete({ name: geminiFileName }).catch(() => {});
          }
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

    // ── BATCH PATH (unchanged) ──────────────────────────
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: aiContents,
      config: {
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
      },
    });

    const enhancedContent = parseAiJsonResponse(
      response.text,
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
        audio_url: null, // audio deleted after processing
        source_type: 'audio',
      })
      .eq('id', noteId)
      .eq('user_id', authUser.id);

    if (updateError) throw updateError;

    // Cleanup: delete files from Gemini (if used) and Supabase Storage
    if (geminiFileName) {
      ai.files.delete({ name: geminiFileName }).catch(() => {});
    }
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
