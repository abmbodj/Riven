import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  consumeAiQuota,
  createHttpError,
  validateYoutubeUrl,
  normalizeYoutubeUrl,
  buildYoutubeDeckContents,
  buildYoutubeGuideContents,
  buildYoutubeExamContents,
  buildYoutubeNotesContents,
  parseAiJsonResponse,
} from '../_shared/aiCore.mjs';
import { createAiClient, contentsToMessages } from '../_shared/aiClient.ts';
import { fetchYoutubeTranscript } from '../_shared/youtubeTranscript.ts';
import { prepareYoutubeTranscriptSource } from '../_shared/youtubeTranscriptPrep.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import {
  STUDY_GUIDE_FORMAT_VERSION,
  buildStudyGuideSummaryDoc,
  createDefaultStudyGuideState,
  normalizeStudyGuideData,
} from '../_shared/studyGuideCore.mjs';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createSSEStream } from '../_shared/streaming.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

const VALID_TYPES = ['deck', 'guide', 'exam', 'notes'] as const;
type GenerationType = (typeof VALID_TYPES)[number];

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
    const { youtubeUrl, type, title, classId, deckName, className, subject } = body;

    if (!VALID_TYPES.includes(type as GenerationType)) {
      throw createHttpError(
        `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
        400,
      );
    }

    if (!youtubeUrl || !validateYoutubeUrl(youtubeUrl)) {
      throw createHttpError('A valid YouTube URL is required.', 400);
    }
    const normalizedUrl = normalizeYoutubeUrl(youtubeUrl);

    // Parallel: rate limit + auth resolution
    const [rl, authUser] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const admin = getSupabaseAdmin();

    const { data: user, error } = await admin
      .from('users')
      .select(
        'subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier',
      )
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) throw error;
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

    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    if (!apiKey) {
      throw createHttpError('AI integration is not configured on the server.', 500);
    }

    // Fetch transcript (replaces Gemini's native video processing)
    const transcript = await fetchYoutubeTranscript(normalizedUrl);
    const ai = createAiClient(apiKey);
    const preparedSource = await prepareYoutubeTranscriptSource({
      transcript,
      className,
      generateText: (prompt, maxTokens) =>
        ai.generateContent({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          maxTokens,
        }),
    });

    // ── STREAMING PATH ──────────────────────────────────
    if (useStreaming) {
      const contentBuilders: Record<string, (t: string, cn?: string) => Array<Record<string, unknown>>> = {
        deck: buildYoutubeDeckContents,
        guide: buildYoutubeGuideContents,
        exam: buildYoutubeExamContents,
        notes: buildYoutubeNotesContents,
      };

      const contents = contentBuilders[type](preparedSource.sourceText, className, subject);
      const messages = contentsToMessages(contents);
      const { response, sendChunk, sendError, sendDone, close } = createSSEStream(request);

      (async () => {
        try {
          const maxTokensByType: Record<string, number> = { deck: 2048, exam: 4096, guide: 6144, notes: 6144 };
          const streamResponse = ai.streamContent({
            model: 'llama-3.3-70b-versatile',
            messages,
            maxTokens: maxTokensByType[type] || 4096,
          });

          const STREAM_DEADLINE_MS = 90_000;
          const deadline = Date.now() + STREAM_DEADLINE_MS;
          let fullText = '';
          for await (const chunk of streamResponse) {
            if (Date.now() > deadline) {
              throw createHttpError('Generation timed out. Try a shorter video.', 504);
            }
            const text = chunk.text ?? '';
            if (text) {
              fullText += text;
              sendChunk(text);
            }
          }

          let result: Record<string, unknown>;

          if (type === 'deck') {
            const flashcards = parseAiJsonResponse(
              fullText,
              'AI generated invalid flashcard format. Please try again.',
            );
            if (!Array.isArray(flashcards) || flashcards.length === 0) {
              throw createHttpError('AI failed to generate any usable flashcards.', 500);
            }

            const finalName = deckName || title || 'YouTube AI Deck';
            const { data: deck, error: deckErr } = await admin
              .from('decks')
              .insert({
                user_id: authUser.id,
                title: finalName,
                description: 'Generated from YouTube via AI',
                class_id: classId || null,
              })
              .select('id')
              .single();
            if (deckErr) throw deckErr;

            const { error: cardErr } = await admin.from('cards').insert(
              flashcards.map((card: { front: string; back: string }, i: number) => ({
                deck_id: deck.id,
                front: card.front,
                back: card.back,
                position: i,
              })),
            );
            if (cardErr) {
              await admin.from('decks').delete().eq('id', deck.id);
              throw cardErr;
            }

            result = { deck_id: deck.id, card_count: flashcards.length };
          } else if (type === 'guide') {
            const guidePayload = parseAiJsonResponse(
              fullText,
              'AI generated invalid tutor session format. Please try again.',
            );
            const guideData = normalizeStudyGuideData(guidePayload);
            if (!guideData) {
              throw createHttpError('AI failed to generate a valid tutor session.', 500);
            }

            const guideContent = buildStudyGuideSummaryDoc(guideData);
            const studyState = createDefaultStudyGuideState(guideData);

            const finalTitle = title || 'YouTube Tutor Session';
            const { data: guide, error: guideErr } = await admin
              .from('study_guides')
              .insert({
                user_id: authUser.id,
                title: finalTitle,
                format_version: STUDY_GUIDE_FORMAT_VERSION,
                guide_data: guideData,
                study_state: studyState,
                content: guideContent,
                note_id: null,
                class_id: classId || null,
              })
              .select('id')
              .single();
            if (guideErr) throw guideErr;

            result = { guide_id: guide.id, title: finalTitle };
          } else if (type === 'exam') {
            const questions = parseAiJsonResponse(
              fullText,
              'AI generated invalid exam format. Please try again.',
            );
            const validQs = (Array.isArray(questions) ? questions : []).filter(
              (q: { question: string; options: string[]; correct_answer: string }) =>
                q.question &&
                Array.isArray(q.options) &&
                q.options.length === 4 &&
                q.options.includes(q.correct_answer),
            );
            if (validQs.length === 0) {
              throw createHttpError('AI failed to generate any exam questions.', 500);
            }

            const finalTitle = title || 'YouTube Mock Exam';
            const { data: exam, error: examErr } = await admin
              .from('mock_exams')
              .insert({
                user_id: authUser.id,
                title: finalTitle,
                source_type: 'youtube',
                source_id: null,
                class_id: classId || null,
                questions: validQs,
              })
              .select('id')
              .single();
            if (examErr) throw examErr;

            result = { exam_id: exam.id, question_count: validQs.length };
          } else {
            // notes
            const noteContent = parseAiJsonResponse(
              fullText,
              'AI generated invalid notes format. Please try again.',
            );
            if (!noteContent || noteContent.type !== 'doc') {
              throw createHttpError('AI failed to generate valid notes.', 500);
            }

            const finalTitle = title || 'YouTube Notes';
            const { data: note, error: noteErr } = await admin
              .from('notes')
              .insert({
                user_id: authUser.id,
                title: finalTitle,
                content: noteContent,
                class_id: classId || null,
                source_type: 'import',
              })
              .select('id')
              .single();
            if (noteErr) throw noteErr;

            result = { note_id: note.id, title: finalTitle };
          }

          sendDone(result);
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

    // ── BATCH PATH ──────────────────────────────────────
    const generateContent = async (
      contents: Array<Record<string, unknown>>,
      responseFormat?: 'json_object',
    ) => {
      return ai.generateContent({
        model: 'llama-3.3-70b-versatile',
        messages: contentsToMessages(contents),
        responseFormat,
      });
    };

    let result: Record<string, unknown>;

    // ── DECK ──────────────────────────────────────────
    if (type === 'deck') {
      const rawResponse = await generateContent(buildYoutubeDeckContents(preparedSource.sourceText, className, subject));
      const flashcards = parseAiJsonResponse(
        rawResponse,
        'AI generated invalid flashcard format. Please try again.',
      );
      if (!Array.isArray(flashcards) || flashcards.length === 0) {
        throw createHttpError('AI failed to generate any usable flashcards.', 500);
      }

      const finalName = deckName || title || 'YouTube AI Deck';
      const { data: deck, error: deckErr } = await admin
        .from('decks')
        .insert({
          user_id: authUser.id,
          title: finalName,
          description: 'Generated from YouTube via AI',
          class_id: classId || null,
        })
        .select('id')
        .single();
      if (deckErr) throw deckErr;

      const { error: cardErr } = await admin.from('cards').insert(
        flashcards.map((card: { front: string; back: string }, i: number) => ({
          deck_id: deck.id,
          front: card.front,
          back: card.back,
          position: i,
        })),
      );
      if (cardErr) {
        await admin.from('decks').delete().eq('id', deck.id);
        throw cardErr;
      }

      result = {
        message: 'Deck generated successfully',
        deck_id: deck.id,
        card_count: flashcards.length,
      };
    }

    // ── GUIDE ─────────────────────────────────────────
    else if (type === 'guide') {
      const rawResponse = await generateContent(
        buildYoutubeGuideContents(preparedSource.sourceText, className, subject),
        'json_object',
      );
      const guidePayload = parseAiJsonResponse(
        rawResponse,
        'AI generated invalid tutor session format. Please try again.',
      );
      const guideData = normalizeStudyGuideData(guidePayload);
      if (!guideData) {
        throw createHttpError('AI failed to generate a valid tutor session.', 500);
      }

      const guideContent = buildStudyGuideSummaryDoc(guideData);
      const studyState = createDefaultStudyGuideState(guideData);

      const finalTitle = title || 'YouTube Tutor Session';
      const { data: guide, error: guideErr } = await admin
        .from('study_guides')
        .insert({
          user_id: authUser.id,
          title: finalTitle,
          format_version: STUDY_GUIDE_FORMAT_VERSION,
          guide_data: guideData,
          study_state: studyState,
          content: guideContent,
          note_id: null,
          class_id: classId || null,
        })
        .select('id')
        .single();
      if (guideErr) throw guideErr;

      result = {
        message: 'Tutor session generated successfully',
        guide_id: guide.id,
        title: finalTitle,
      };
    }

    // ── EXAM ──────────────────────────────────────────
    else if (type === 'exam') {
      const rawResponse = await generateContent(buildYoutubeExamContents(preparedSource.sourceText, className, subject));
      const questions = parseAiJsonResponse(
        rawResponse,
        'AI generated invalid exam format. Please try again.',
      );
      const validQs = (Array.isArray(questions) ? questions : []).filter(
        (q: { question: string; options: string[]; correct_answer: string }) =>
          q.question &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.includes(q.correct_answer),
      );
      if (validQs.length === 0) {
        throw createHttpError('AI failed to generate any exam questions.', 500);
      }

      const finalTitle = title || 'YouTube Mock Exam';
      const { data: exam, error: examErr } = await admin
        .from('mock_exams')
        .insert({
          user_id: authUser.id,
          title: finalTitle,
          source_type: 'youtube',
          source_id: null,
          class_id: classId || null,
          questions: validQs,
        })
        .select('id')
        .single();
      if (examErr) throw examErr;

      result = {
        message: 'Mock exam generated successfully',
        exam_id: exam.id,
        question_count: validQs.length,
      };
    }

    // ── NOTES ─────────────────────────────────────────
    else {
      const rawResponse = await generateContent(
        buildYoutubeNotesContents(preparedSource.sourceText, className, subject),
        'json_object',
      );
      const noteContent = parseAiJsonResponse(
        rawResponse,
        'AI generated invalid notes format. Please try again.',
      );
      if (!noteContent || noteContent.type !== 'doc') {
        throw createHttpError('AI failed to generate valid notes.', 500);
      }

      const finalTitle = title || 'YouTube Notes';
      const { data: note, error: noteErr } = await admin
        .from('notes')
        .insert({
          user_id: authUser.id,
          title: finalTitle,
          content: noteContent,
          class_id: classId || null,
          source_type: 'import',
        })
        .select('id')
        .single();
      if (noteErr) throw noteErr;

      result = {
        message: 'Notes generated successfully',
        note_id: note.id,
        title: finalTitle,
      };
    }

    return jsonResponse(result, { status: 201 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[generate-from-youtube] error', requestError);
    const status =
      typeof requestError.status === 'number' ? requestError.status : 500;
    const responseBody: Record<string, unknown> = {
      error:
        typeof requestError.status === 'number'
          ? requestError.message
          : 'An unexpected error occurred during AI generation.',
    };
    if (typeof requestError.canWatchAd === 'boolean') {
      responseBody.canWatchAd = requestError.canWatchAd;
    }
    return jsonResponse(responseBody, { status }, request);
  }
});
