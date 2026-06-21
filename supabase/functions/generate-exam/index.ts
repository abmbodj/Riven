import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { Buffer } from 'node:buffer';
import mammoth from 'npm:mammoth@1.11.0';

import {
  consumeAiQuota,
  generateExamFromAi,
  prepareAiSource,
  buildExamContents,
  ensureApiKey,
  parseAiJsonResponse,
  createHttpError,
  buildAdaptiveExamPrompt,
  buildFocusedExamPrompt,
  aiModelMap,
} from '../_shared/aiCore.mjs';
import { normalizeExamQuestions } from '../_shared/examQuestions.mjs';
import { fetchKnowledgeContext } from '../_shared/noteKnowledge.mjs';
import { createAiClient, contentsToMessages } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { createAiHistoryReporter } from '../_shared/aiJobs.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createSSEStream } from '../_shared/streaming.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

type CreateExamPayload = {
  userId: number;
  title: string;
  sourceType: string;
  sourceId: string | null;
  classId: number | string | null;
  questions: Array<Record<string, unknown>>;
  blueprintId: string | null;
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

  const url = new URL(request.url);

  try {
    const body = await request.json().catch(() => ({}));
    const useStreaming = url.searchParams.get('stream') === '1' || body.stream === true;

    // Parallel: rate limit + auth resolution
    const [rl, authUser] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const admin = getSupabaseAdmin();
    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';

    // ── STREAMING PATH ──────────────────────────────────
    if (useStreaming) {
      ensureApiKey(apiKey);

      // Parallel: user fetch + source prep + mastery fetch
      const examMode = body.examMode || 'standard';
      const needsMastery = (examMode === 'adaptive' || examMode === 'focused') && body.classId;

      const [userResult, sourceResult, masteryResult] = await Promise.all([
        admin
          .from('users')
          .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier, subscription_expires_at')
          .eq('id', authUser.id)
          .maybeSingle(),
        prepareAiSource({
          notes: body.notes,
          file: body.file,
          parseDocx: async (buffer: Buffer) => {
            const parsed = await mammoth.extractRawText({ buffer });
            return parsed.value;
          },
          onParseError: (err: unknown) => console.error('Failed to parse document text:', err),
        }),
        needsMastery
          ? admin
              .from('topic_mastery')
              .select('topic, mastery_score, total_seen')
              .eq('user_id', authUser.id)
              .eq('class_id', body.classId)
          : Promise.resolve({ data: null }),
      ]);

      const { data: user, error } = userResult;
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

      const { processedNotes, hasProcessedNotes, keepFile } = sourceResult;

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

      const finalTitle = body.title || 'AI Mock Exam';
      const reporter = await createAiHistoryReporter({
        admin,
        userId: authUser.id,
        kind: 'exam_generation',
        targetType: 'exam',
        inputPayload: {
          title_snapshot: finalTitle,
          source_type: body.sourceType || 'notes',
          source_id: body.sourceId || null,
          class_id: body.classId || null,
          class_name: typeof body.className === 'string' ? body.className : null,
          exam_mode: examMode,
        },
        initialMessage: 'Preparing mock exam',
      });
      await reporter.markStreaming('drafting', 30, 'Generating mock exam');

      const masteryData = masteryResult.data;

      // When generating from a saved blueprint, load its style profile to shape the exam.
      let blueprintProfile = null;
      if (body.blueprintId) {
        const { data: bp } = await admin
          .from('exam_blueprints')
          .select('profile')
          .eq('id', body.blueprintId)
          .eq('user_id', authUser.id)
          .maybeSingle();
        blueprintProfile = bp?.profile ?? null;
      }

      const knowledgeContext = body.sourceType === 'notes'
        ? await fetchKnowledgeContext(admin, body.sourceId, authUser.id)
        : '';
      const contents = buildExamContents({
        processedNotes,
        hasProcessedNotes,
        keepFile,
        file: body.file,
        className: body.className,
        subject: body.subject,
        masteryData,
        weakTopics: body.weakTopics,
        examMode,
        knowledgeContext,
        blueprintProfile,
      });
      const messages = contentsToMessages(contents);
      const { response, sendChunk, sendError, sendDone, close } = createSSEStream(request);

      (async () => {
        try {
          const ai = createAiClient(apiKey);
          const streamResponse = ai.streamContent({
            model: aiModelMap.exam,
            messages,
            maxTokens: 6000,
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

          const questions = parseAiJsonResponse(
            fullText,
            'AI generated invalid exam format. Please try again.',
          );

          if (!Array.isArray(questions) || questions.length === 0) {
            throw createHttpError('AI failed to generate any exam questions.', 500);
          }

          // Coerce → validate → shuffle options (fixes the "answer B is always right"
          // bias). Supports mcq / multi_select / true_false / numeric / short_answer.
          const validQuestions = normalizeExamQuestions(questions);

          if (validQuestions.length === 0) {
            throw createHttpError('AI generated questions in an invalid format. Please try again.', 500);
          }

          const { data: exam, error: examErr } = await admin
            .from('mock_exams')
            .insert({
              user_id: authUser.id,
              title: finalTitle,
              source_type: body.sourceType || 'notes',
              source_id: body.sourceId || null,
              class_id: body.classId || null,
              questions: validQuestions,
              exam_mode: examMode,
              blueprint_id: body.blueprintId || null,
            })
            .select('id')
            .single();

          if (examErr) throw examErr;

          await reporter.complete({
            message: 'Mock exam generated successfully',
            targetType: 'exam',
            targetId: exam.id,
            resultPatch: {
              exam_id: exam.id,
              question_count: validQuestions.length,
              title: finalTitle,
              exam_mode: examMode,
            },
          });
          sendDone({ exam_id: exam.id, question_count: validQuestions.length });
        } catch (err: unknown) {
          const reqErr = normalizeRequestError(err);
          await reportEdgeException(reqErr, { request, functionName: 'generate-exam' });
          await reporter.fail(reqErr);
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

    // ── BATCH PATH ──────────────────────────────────────
    const { data: user, error } = await admin
      .from('users')
      .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier, subscription_expires_at')
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

    const sourcePreview = await prepareAiSource({
      notes: body.notes,
      file: body.file,
      parseDocx: async (buffer: Buffer) => {
        const parsed = await mammoth.extractRawText({ buffer });
        return parsed.value;
      },
      onParseError: (error: unknown) => {
        console.error('Failed to parse document text:', error);
      },
    });

    if (!sourcePreview.hasProcessedNotes && !sourcePreview.keepFile) {
      throw createHttpError('Notes or a file are required to generate an exam.', 400);
    }

    const characterLimit = aiLimitsContext?.characterLimit || 15000;
    if (sourcePreview.hasProcessedNotes && sourcePreview.processedNotes.length > characterLimit) {
      throw createHttpError(
        `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
        400,
      );
    }

    const examMode = body.examMode || 'standard';
    const finalTitle = body.title || 'AI Mock Exam';
    const reporter = await createAiHistoryReporter({
      admin,
      userId: authUser.id,
      kind: 'exam_generation',
      targetType: 'exam',
      inputPayload: {
        title_snapshot: finalTitle,
        source_type: body.sourceType || 'notes',
        source_id: body.sourceId || null,
        class_id: body.classId || null,
        class_name: typeof body.className === 'string' ? body.className : null,
        exam_mode: examMode,
      },
      initialMessage: 'Preparing mock exam',
    });
    await reporter.markRunning('drafting', 35, 'Generating mock exam');

    const knowledgeContext = body.sourceType === 'notes'
      ? await fetchKnowledgeContext(admin, body.sourceId, authUser.id)
      : '';

    // When generating from a saved blueprint, load its style profile to shape the exam.
    let blueprintProfile = null;
    if (body.blueprintId) {
      const { data: bp } = await admin
        .from('exam_blueprints')
        .select('profile')
        .eq('id', body.blueprintId)
        .eq('user_id', authUser.id)
        .maybeSingle();
      blueprintProfile = bp?.profile ?? null;
    }

    try {
      const result = await generateExamFromAi({
        userId: authUser.id,
        notes: body.notes,
        file: body.file,
        title: body.title,
        sourceType: body.sourceType,
        sourceId: body.sourceId,
        classId: body.classId,
        className: body.className,
        subject: body.subject,
        knowledgeContext,
        blueprintProfile,
        blueprintId: body.blueprintId || null,
        aiLimitsContext,
        apiKey,
        parseDocx: async (buffer: Buffer) => {
          const parsed = await mammoth.extractRawText({ buffer });
          return parsed.value;
        },
        generateContent: async ({ model, contents }: { model: string; contents: Array<Record<string, unknown>> }) => {
          const ai = createAiClient(apiKey);
          return ai.generateContent({
            model,
            messages: contentsToMessages(contents),
          });
        },
        createExam: async ({ userId, title, sourceType, sourceId, classId, questions, blueprintId }: CreateExamPayload) => {
          const { data, error: createError } = await admin
            .from('mock_exams')
            .insert({
              user_id: userId,
              title,
              source_type: sourceType,
              source_id: sourceId,
              class_id: classId,
              questions,
              blueprint_id: blueprintId || null,
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

      await reporter.complete({
        message: 'Mock exam generated successfully',
        targetType: 'exam',
        targetId: result.exam_id,
        resultPatch: {
          exam_id: result.exam_id,
          question_count: result.question_count,
          title: finalTitle,
          exam_mode: examMode,
        },
      });

      return jsonResponse(result, { status: 201 }, request);
    } catch (error: unknown) {
      const requestError = normalizeRequestError(error);
      await reporter.fail(requestError);
      throw requestError;
    }
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[generate-exam edge function] error', requestError);
    await reportEdgeException(requestError, { request, functionName: 'generate-exam' });
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
