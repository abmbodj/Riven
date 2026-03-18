import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenAI } from 'npm:@google/genai@1.42.0';

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

const VALID_TYPES = ['deck', 'guide', 'exam', 'notes'] as const;
type GenerationType = (typeof VALID_TYPES)[number];

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  const reqUrl = new URL(request.url);
  const useStreaming = reqUrl.searchParams.get('stream') === '1';

  try {
    const body = await request.json().catch(() => ({}));
    const { youtubeUrl, type, title, classId, deckName, className } = body;

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

    const authUser = await resolveSupabaseUser(request);
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

    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    if (!apiKey) {
      throw createHttpError('AI integration is not configured on the server.', 500);
    }

    // ── STREAMING PATH ──────────────────────────────────
    if (useStreaming) {
      const contentBuilders: Record<string, (url: string, cn?: string) => Array<Record<string, unknown>>> = {
        deck: buildYoutubeDeckContents,
        guide: buildYoutubeGuideContents,
        exam: buildYoutubeExamContents,
        notes: buildYoutubeNotesContents,
      };

      const contents = contentBuilders[type](normalizedUrl, className);
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
                description: 'Generated from YouTube via Gemini AI',
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
            const guideContent = parseAiJsonResponse(
              fullText,
              'AI generated invalid study guide format. Please try again.',
            );
            if (!guideContent || guideContent.type !== 'doc') {
              throw createHttpError('AI failed to generate a valid study guide.', 500);
            }

            const finalTitle = title || 'YouTube Study Guide';
            const { data: guide, error: guideErr } = await admin
              .from('study_guides')
              .insert({
                user_id: authUser.id,
                title: finalTitle,
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

    // ── BATCH PATH (unchanged) ──────────────────────────
    let aiClient: GoogleGenAI | null = null;

    const generateContent = async ({ model, contents }: AiContentRequest) => {
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
    };

    let result: Record<string, unknown>;

    // ── DECK ──────────────────────────────────────────
    if (type === 'deck') {
      const rawResponse = await generateContent({
        model: 'gemini-2.5-flash',
        contents: buildYoutubeDeckContents(normalizedUrl, className),
      });
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
          description: 'Generated from YouTube via Gemini AI',
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
      const rawResponse = await generateContent({
        model: 'gemini-2.5-flash',
        contents: buildYoutubeGuideContents(normalizedUrl, className),
      });
      const guideContent = parseAiJsonResponse(
        rawResponse,
        'AI generated invalid study guide format. Please try again.',
      );
      if (!guideContent || guideContent.type !== 'doc') {
        throw createHttpError('AI failed to generate a valid study guide.', 500);
      }

      const finalTitle = title || 'YouTube Study Guide';
      const { data: guide, error: guideErr } = await admin
        .from('study_guides')
        .insert({
          user_id: authUser.id,
          title: finalTitle,
          content: guideContent,
          note_id: null,
          class_id: classId || null,
        })
        .select('id')
        .single();
      if (guideErr) throw guideErr;

      result = {
        message: 'Study guide generated successfully',
        guide_id: guide.id,
        title: finalTitle,
      };
    }

    // ── EXAM ──────────────────────────────────────────
    else if (type === 'exam') {
      const rawResponse = await generateContent({
        model: 'gemini-2.5-flash',
        contents: buildYoutubeExamContents(normalizedUrl, className),
      });
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
      const rawResponse = await generateContent({
        model: 'gemini-2.5-flash',
        contents: buildYoutubeNotesContents(normalizedUrl, className),
      });
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
