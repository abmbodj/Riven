import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { Buffer } from 'node:buffer';
import mammoth from 'npm:mammoth@1.11.0';

import {
  consumeAiQuota,
  generateStudyGuideFromAi,
  prepareAiSource,
  buildGuideSkeletonContents,
  buildGuideSourceContents,
  expandGuideTeaching,
  normalizeCoachConfig,
  mergeGuidePayloadMeta,
  ensureApiKey,
  assertTutorSessionQuality,
  buildGuideRepairPrompt,
  mergeRepairedCards,
  parseAiJsonResponse,
  createHttpError,
  aiModelMap,
} from '../_shared/aiCore.mjs';
import { fetchKnowledgeContext } from '../_shared/noteKnowledge.mjs';
import { isProviderTokenLimitError } from '../_shared/youtubeNotesBudget.ts';
import { createAiClient, contentsToMessages } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { createAiHistoryReporter } from '../_shared/aiJobs.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import {
  STUDY_GUIDE_FORMAT_VERSION,
  buildStudyGuideSummaryDoc,
  createDefaultStudyGuideState,
  normalizeStudyGuideData,
  validateTutorSessionQuality,
} from '../_shared/studyGuideCore.mjs';
import { persistGeneratedStudyGuide } from '../_shared/studyGuidePersistence.mjs';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createSSEStream } from '../_shared/streaming.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

type CreateGuidePayload = {
  userId: number;
  title: string;
  formatVersion: number;
  guideData: Record<string, unknown>;
  studyState: Record<string, unknown>;
  content: Record<string, unknown>;
  noteId: string | null;
  classId: number | string | null;
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

      // Parallel: user fetch + source prep
      const [userResult, sourceResult] = await Promise.all([
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
      const hasSourceMaterial = hasProcessedNotes || keepFile;
      const coachMeta = normalizeCoachConfig(body.coachConfig, { hasSourceMaterial });

      if (!hasSourceMaterial && !coachMeta) {
        throw createHttpError('Notes, a file, or setup details are required to generate a tutor session.', 400);
      }

      const characterLimit = aiLimitsContext?.characterLimit || 15000;
      if (hasProcessedNotes && processedNotes.length > characterLimit) {
        throw createHttpError(
          `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
          400,
        );
      }

      const finalTitle = body.title || 'AI Tutor Session';
      const reporter = await createAiHistoryReporter({
        admin,
        userId: authUser.id,
        kind: 'guide_generation',
        targetType: 'guide',
        targetId: typeof body.replaceGuideId === 'string' ? body.replaceGuideId : null,
        inputPayload: {
          title_snapshot: finalTitle,
          note_id: body.noteId || null,
          class_id: body.classId || null,
          class_name: typeof body.className === 'string' ? body.className : null,
        },
        initialMessage: 'Preparing tutor session',
      });
      await reporter.markStreaming('drafting', 30, 'Generating tutor session');

      const knowledgeContext = await fetchKnowledgeContext(admin, body.noteId, authUser.id);

      // Phase 1 skeleton contents
      const skeletonContents = buildGuideSkeletonContents({
        processedNotes,
        hasProcessedNotes,
        keepFile,
        file: body.file,
        className: body.className,
        subject: body.subject,
        coachConfig: body.coachConfig,
        knowledgeContext,
      });
      const skeletonMessages = contentsToMessages(skeletonContents);
      const { response, sendChunk, sendError, sendDone, close } = createSSEStream(request);

      (async () => {
        try {
          const ai = createAiClient(apiKey);

          // ── Phase 1: stream skeleton (perceived progress for the user) ──────
          const streamResponse = ai.streamContent({
            model: aiModelMap.guide,
            messages: skeletonMessages,
            maxTokens: 6000,
          });

          const STREAM_DEADLINE_MS = 90_000;
          const deadline = Date.now() + STREAM_DEADLINE_MS;
          let skeletonText = '';
          for await (const chunk of streamResponse) {
            if (Date.now() > deadline) {
              throw createHttpError('Generation timed out. Please try again with shorter content.', 504);
            }
            const text = chunk.text ?? '';
            if (text) {
              skeletonText += text;
              sendChunk(text);
            }
          }

          let guidePayload = mergeGuidePayloadMeta(
            parseAiJsonResponse(skeletonText, 'AI generated invalid tutor session format. Please try again.'),
            coachMeta,
          );

          // ── Phase 2: expand teaching per card (batch calls, silent to client) ─
          const sourceContents = buildGuideSourceContents({
            processedNotes,
            hasProcessedNotes,
            keepFile,
            file: body.file,
            knowledgeContext,
          });

          guidePayload = await expandGuideTeaching({
            guidePayload,
            sourceContents,
            className: body.className,
            subject: body.subject,
            generateContent: async ({ model, contents }: { model: string; contents: Array<Record<string, unknown>> }) => {
              const aiInner = createAiClient(apiKey);
              return aiInner.generateContent({
                model,
                messages: contentsToMessages(contents),
                responseFormat: 'json_object',
              });
            },
            onProgress: (done: number, total: number) => {
              // Keep the SSE connection alive and give the user a sense of progress.
              sendChunk(`\n`);
              reporter.markStreaming('teaching', Math.round(30 + (done / total) * 60), `Writing lesson ${done} of ${total}`).catch(() => {});
            },
          });

          let guideData = normalizeStudyGuideData(guidePayload);
          if (!guideData) {
            throw createHttpError('AI failed to generate a valid tutor session.', 500);
          }

          // Quality repair pass on still-thin cards after Phase 2.
          const initialQuality = validateTutorSessionQuality(guideData);
          if (!initialQuality.ok && !initialQuality.fatal) {
            const { repairPrompt } = buildGuideRepairPrompt(initialQuality);
            const failingCards = (guidePayload.cards || []).filter(
              (card: { id?: string }) => card?.id && initialQuality.issues.some((i: string) => i.startsWith(card.id!)),
            );
            const repairMessages = [
              ...contentsToMessages(sourceContents as Array<Record<string, unknown>>),
              { role: 'assistant' as const, content: JSON.stringify(failingCards) },
              { role: 'user' as const, content: repairPrompt },
            ];
            let repairText = '';
            const repairStream = ai.streamContent({
              model: aiModelMap.guide,
              messages: repairMessages,
              maxTokens: 6000,
            });
            const REPAIR_DEADLINE_MS = 60_000;
            const repairDeadline = Date.now() + REPAIR_DEADLINE_MS;
            for await (const chunk of repairStream) {
              if (Date.now() > repairDeadline) break;
              repairText += chunk.text ?? '';
            }
            try {
              const repairedCards = parseAiJsonResponse(repairText, 'Repair failed.');
              const mergedPayload = mergeRepairedCards(guidePayload, repairedCards);
              const repaired = normalizeStudyGuideData(mergedPayload);
              if (repaired) guideData = repaired;
            } catch {
              // keep the original if repair parse fails
            }
          }

          assertTutorSessionQuality(guideData);

          const guideContent = buildStudyGuideSummaryDoc(guideData);
          const studyState = createDefaultStudyGuideState(guideData);

          const guide = await persistGeneratedStudyGuide({
            admin,
            userId: authUser.id,
            title: finalTitle,
            formatVersion: STUDY_GUIDE_FORMAT_VERSION,
            guideData,
            studyState,
            content: guideContent,
            noteId: body.noteId || null,
            classId: body.classId || null,
            replaceGuideId: typeof body.replaceGuideId === 'string' ? body.replaceGuideId : null,
          });

          await reporter.complete({
            message: 'Tutor session generated successfully',
            targetType: 'guide',
            targetId: guide.id,
            resultPatch: { guide_id: guide.id, title: finalTitle },
          });
          sendDone({ guide_id: guide.id, title: finalTitle });
        } catch (err: unknown) {
          // Provider throttling → 503 + clear code so the client doesn't show the pricing modal.
          if (isProviderTokenLimitError(err)) {
            await reporter.fail(normalizeRequestError(err));
            sendError(
              "Riven's AI is busy right now. Please try again in a moment.",
              503,
              { code: 'rate_limit_exceeded' },
            );
          } else {
            const reqErr = normalizeRequestError(err);
            await reporter.fail(reqErr);
            sendError(
              reqErr.message || 'An unexpected error occurred during AI generation.',
              typeof reqErr.status === 'number' ? reqErr.status : 500,
              {
                ...(typeof reqErr.canWatchAd === 'boolean' ? { canWatchAd: reqErr.canWatchAd } : {}),
                ...(typeof reqErr.code === 'string' ? { code: reqErr.code } : {}),
              },
            );
          }
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
    const hasSourceMaterial = sourcePreview.hasProcessedNotes || sourcePreview.keepFile;
    const coachMeta = normalizeCoachConfig(body.coachConfig, { hasSourceMaterial });

    if (!hasSourceMaterial && !coachMeta) {
      throw createHttpError('Notes, a file, or setup details are required to generate a tutor session.', 400);
    }

    const characterLimit = aiLimitsContext?.characterLimit || 15000;
    if (sourcePreview.hasProcessedNotes && sourcePreview.processedNotes.length > characterLimit) {
      throw createHttpError(
        `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
        400,
      );
    }

    const finalTitle = body.title || 'AI Tutor Session';
    const reporter = await createAiHistoryReporter({
      admin,
      userId: authUser.id,
      kind: 'guide_generation',
      targetType: 'guide',
      targetId: typeof body.replaceGuideId === 'string' ? body.replaceGuideId : null,
      inputPayload: {
        title_snapshot: finalTitle,
        note_id: body.noteId || null,
        class_id: body.classId || null,
        class_name: typeof body.className === 'string' ? body.className : null,
      },
      initialMessage: 'Preparing tutor session',
    });
    await reporter.markRunning('drafting', 35, 'Generating tutor session');

    const knowledgeContext = await fetchKnowledgeContext(admin, body.noteId, authUser.id);

    try {
      const result = await generateStudyGuideFromAi({
        userId: authUser.id,
        notes: body.notes,
        file: body.file,
        title: body.title,
        noteId: body.noteId,
        classId: body.classId,
        className: body.className,
        subject: body.subject,
        coachConfig: body.coachConfig,
        knowledgeContext,
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
            responseFormat: 'json_object',
          });
        },
        createGuide: async ({ userId, title, formatVersion, guideData, studyState, content, noteId, classId }: CreateGuidePayload) => {
          return persistGeneratedStudyGuide({
            admin,
            userId,
            title,
            formatVersion,
            guideData,
            studyState,
            content,
            noteId,
            classId,
            replaceGuideId: typeof body.replaceGuideId === 'string' ? body.replaceGuideId : null,
          });
        },
        deleteGuide: async (guideId: string) => {
          const { error: deleteError } = await admin
            .from('study_guides')
            .delete()
            .eq('id', guideId)
            .eq('user_id', authUser.id);

          if (deleteError) throw deleteError;
        },
        onParseError: (error: unknown) => {
          console.error('Failed to parse document text:', error);
        },
      });

      await reporter.complete({
        message: 'Tutor session generated successfully',
        targetType: 'guide',
        targetId: result.guide_id,
        resultPatch: { guide_id: result.guide_id, title: result.title || finalTitle },
      });

      return jsonResponse(result, { status: 201 }, request);
    } catch (error: unknown) {
      const requestError = normalizeRequestError(error);
      await reporter.fail(requestError);
      throw requestError;
    }
  } catch (error: unknown) {
    // Provider throttling (Groq TPM/rate limit) must NOT look like an entitlement 429,
    // or the client shows the pricing modal to paying users. Remap to 503 + a clear code.
    if (isProviderTokenLimitError(error)) {
      console.error('[generate-guide edge function] provider rate limit', error);
      return jsonResponse(
        {
          error: "Riven's AI is busy right now. Please try again in a moment.",
          code: 'rate_limit_exceeded',
        },
        { status: 503 },
        request,
      );
    }

    const requestError = normalizeRequestError(error);

    console.error('[generate-guide edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    const body: Record<string, unknown> = {
      error: typeof requestError.status === 'number'
        ? requestError.message
        : 'An unexpected error occurred during AI generation.',
    };

    if (typeof requestError.canWatchAd === 'boolean') {
      body.canWatchAd = requestError.canWatchAd;
    }

    if (typeof requestError.code === 'string') {
      body.code = requestError.code;
    }

    return jsonResponse(body, { status }, request);
  }
});
