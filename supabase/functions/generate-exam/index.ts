import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { Buffer } from 'node:buffer';
import { GoogleGenAI } from 'npm:@google/genai@1.42.0';
import mammoth from 'npm:mammoth@1.11.0';

import {
  consumeAiQuota,
  generateExamFromAi,
  prepareAiSource,
  buildExamContents,
  ensureApiKey,
  parseAiJsonResponse,
  createHttpError,
} from '../_shared/aiCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createSSEStream } from '../_shared/streaming.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

type AiContentRequest = {
  model: string;
  contents: Array<Record<string, unknown>>;
};

type CreateExamPayload = {
  userId: number;
  title: string;
  sourceType: string;
  sourceId: string | null;
  classId: number | string | null;
  questions: Array<Record<string, unknown>>;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  const url = new URL(request.url);
  const useStreaming = url.searchParams.get('stream') === '1';

  try {
    const body = await request.json().catch(() => ({}));
    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();
    const { data: user, error } = await admin
      .from('users')
      .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return jsonResponse({ error: 'User not found' }, { status: 401 }, request);
    }

    const aiLimitsContext = await consumeAiQuota({
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

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

    // ── STREAMING PATH ──────────────────────────────────
    if (useStreaming) {
      ensureApiKey(apiKey);

      const { processedNotes, hasProcessedNotes, keepFile } = await prepareAiSource({
        notes: body.notes,
        file: body.file,
        parseDocx: async (buffer: Buffer) => {
          const parsed = await mammoth.extractRawText({ buffer });
          return parsed.value;
        },
        onParseError: (err: unknown) => console.error('Failed to parse document text:', err),
      });

      if (!hasProcessedNotes && !keepFile) {
        throw createHttpError('Notes or a file are required to generate an exam.', 400);
      }

      const characterLimit = aiLimitsContext?.characterLimit || 15000;
      if (hasProcessedNotes && processedNotes.length > characterLimit) {
        throw createHttpError(
          `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
          400,
        );
      }

      const contents = buildExamContents({ processedNotes, hasProcessedNotes, keepFile, file: body.file, className: body.className });
      const { response, sendChunk, sendError, sendDone, close } = createSSEStream(request);

      (async () => {
        try {
          const aiClient = new GoogleGenAI({ apiKey });
          const streamResponse = await aiClient.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents,
            config: {
              temperature: 0,
              thinkingConfig: { thinkingBudget: 0 },
            },
          });

          let fullText = '';
          for await (const chunk of streamResponse) {
            const text = chunk.text ?? '';
            if (text) {
              fullText += text;
              sendChunk(text);
            }
          }

          const questions = parseAiJsonResponse(
            fullText,
            'AI generated invalid exam format. Please try again.',
          );

          if (!Array.isArray(questions) || questions.length === 0) {
            throw createHttpError('AI failed to generate any exam questions.', 500);
          }

          const validQuestions = questions.filter(
            (q: { question: string; options: string[]; correct_answer: string }) =>
              q.question && Array.isArray(q.options) && q.options.length === 4
              && q.correct_answer && q.options.includes(q.correct_answer),
          );

          if (validQuestions.length === 0) {
            throw createHttpError('AI generated questions in an invalid format. Please try again.', 500);
          }

          const finalTitle = body.title || 'AI Mock Exam';
          const { data: exam, error: examErr } = await admin
            .from('mock_exams')
            .insert({
              user_id: authUser.id,
              title: finalTitle,
              source_type: body.sourceType || 'notes',
              source_id: body.sourceId || null,
              class_id: body.classId || null,
              questions: validQuestions,
            })
            .select('id')
            .single();

          if (examErr) throw examErr;

          sendDone({ exam_id: exam.id, question_count: validQuestions.length });
        } catch (err: unknown) {
          const reqErr = normalizeRequestError(err);
          sendError(
            reqErr.message || 'An unexpected error occurred during AI generation.',
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
    let aiClient: GoogleGenAI | null = null;

    const result = await generateExamFromAi({
      userId: authUser.id,
      notes: body.notes,
      file: body.file,
      title: body.title,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      classId: body.classId,
      className: body.className,
      aiLimitsContext,
      apiKey,
      parseDocx: async (buffer: Buffer) => {
        const parsed = await mammoth.extractRawText({ buffer });
        return parsed.value;
      },
      generateContent: async ({ model, contents }: AiContentRequest) => {
        aiClient ??= new GoogleGenAI({ apiKey });
        const response = await aiClient.models.generateContent({
          model,
          contents,
          config: {
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
          },
        });
        return response.text;
      },
      createExam: async ({ userId, title, sourceType, sourceId, classId, questions }: CreateExamPayload) => {
        const { data, error: createError } = await admin
          .from('mock_exams')
          .insert({
            user_id: userId,
            title,
            source_type: sourceType,
            source_id: sourceId,
            class_id: classId,
            questions,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        return data;
      },
      deleteExam: async (examId: string) => {
        const { error: deleteError } = await admin
          .from('mock_exams')
          .delete()
          .eq('id', examId)
          .eq('user_id', authUser.id);

        if (deleteError) throw deleteError;
      },
      onParseError: (error: unknown) => {
        console.error('Failed to parse document text:', error);
      },
    });

    return jsonResponse(result, { status: 201 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[generate-exam edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    const body: Record<string, unknown> = {
      error: typeof requestError.status === 'number'
        ? requestError.message
        : 'An unexpected error occurred during AI generation.',
    };

    if (typeof requestError.canWatchAd === 'boolean') {
      body.canWatchAd = requestError.canWatchAd;
    }

    return jsonResponse(body, { status }, request);
  }
});
