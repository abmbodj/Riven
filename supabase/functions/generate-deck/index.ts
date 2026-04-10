import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { Buffer } from 'node:buffer';
import mammoth from 'npm:mammoth@1.11.0';

import {
  consumeAiQuota,
  generateDeckFromAi,
  prepareAiSource,
  buildDeckContents,
  ensureApiKey,
  parseAiJsonResponse,
  createHttpError,
} from '../_shared/aiCore.mjs';
import { createAiClient, contentsToMessages } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { createAiHistoryReporter } from '../_shared/aiJobs.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createSSEStream } from '../_shared/streaming.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

type CreateDeckPayload = {
  userId: number;
  title: string;
  description: string;
  classId: number | string | null;
};

type GeneratedCard = {
  front: string;
  back: string;
  position: number;
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
          .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier')
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

      if (!hasProcessedNotes && !keepFile) {
        throw createHttpError('Notes or a file are required to generate flashcards.', 400);
      }

      const characterLimit = aiLimitsContext?.characterLimit || 15000;
      if (hasProcessedNotes && processedNotes.length > characterLimit) {
        throw createHttpError(
          `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
          400,
        );
      }

      const reporter = await createAiHistoryReporter({
        admin,
        userId: authUser.id,
        kind: 'deck_generation',
        targetType: 'deck',
        inputPayload: {
          title_snapshot: typeof body.deckName === 'string' && body.deckName.trim() ? body.deckName.trim() : 'AI Generated Deck',
          class_id: body.classId || null,
          class_name: typeof body.className === 'string' ? body.className : null,
        },
        initialMessage: 'Preparing flashcard generation',
      });
      await reporter.markStreaming('drafting', 30, 'Generating flashcards');

      const contents = buildDeckContents({ processedNotes, hasProcessedNotes, keepFile, file: body.file, className: body.className, subject: body.subject });
      const messages = contentsToMessages(contents);
      const { response, sendChunk, sendError, sendDone, close } = createSSEStream(request);

      (async () => {
        try {
          const ai = createAiClient(apiKey);
          const streamResponse = ai.streamContent({
            model: 'llama-3.3-70b-versatile',
            messages,
            maxTokens: 2048,
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

          await reporter.markSaving('Saving generated deck');

          const flashcards = parseAiJsonResponse(
            fullText,
            'AI generated invalid flashcard format. Please try again.',
          );

          if (!Array.isArray(flashcards) || flashcards.length === 0) {
            throw createHttpError('AI failed to generate any usable flashcards.', 500);
          }

          const finalDeckName = body.deckName || 'AI Generated Deck';
          const { data: deck, error: deckErr } = await admin
            .from('decks')
            .insert({
              user_id: authUser.id,
              title: finalDeckName,
              description: 'Auto-generated via AI',
              class_id: body.classId || null,
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

          await reporter.complete({
            message: 'Deck generated successfully',
            targetType: 'deck',
            targetId: deck.id,
            resultPatch: {
              deck_id: deck.id,
              card_count: flashcards.length,
              title: finalDeckName,
            },
          });
          sendDone({ deck_id: deck.id, card_count: flashcards.length });
        } catch (err: unknown) {
          const reqErr = normalizeRequestError(err);
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

    if (!sourcePreview.hasProcessedNotes && !sourcePreview.keepFile) {
      throw createHttpError('Notes or a file are required to generate flashcards.', 400);
    }

    const characterLimit = aiLimitsContext?.characterLimit || 15000;
    if (sourcePreview.hasProcessedNotes && sourcePreview.processedNotes.length > characterLimit) {
      throw createHttpError(
        `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
        400,
      );
    }

    const reporter = await createAiHistoryReporter({
      admin,
      userId: authUser.id,
      kind: 'deck_generation',
      targetType: 'deck',
      inputPayload: {
        title_snapshot: typeof body.deckName === 'string' && body.deckName.trim() ? body.deckName.trim() : 'AI Generated Deck',
        class_id: body.classId || null,
        class_name: typeof body.className === 'string' ? body.className : null,
      },
      initialMessage: 'Preparing flashcard generation',
    });
    await reporter.markRunning('drafting', 35, 'Generating flashcards');

    try {
      const result = await generateDeckFromAi({
        userId: authUser.id,
        notes: body.notes,
        file: body.file,
        deckName: body.deckName,
        classId: body.classId,
        className: body.className,
        subject: body.subject,
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
        createDeck: async ({ userId, title, description, classId }: CreateDeckPayload) => {
          const { data, error: createError } = await admin
            .from('decks')
            .insert({
              user_id: userId,
              title,
              description,
              class_id: classId,
            })
            .select('id')
            .single();

          if (createError) throw createError;
          return data;
        },
        insertCards: async (deckId: number, cards: GeneratedCard[]) => {
          const { error: insertError } = await admin
            .from('cards')
            .insert(cards.map((card: GeneratedCard) => ({
              deck_id: deckId,
              front: card.front,
              back: card.back,
              position: card.position,
            })));

          if (insertError) throw insertError;
        },
        deleteDeck: async (deckId: number) => {
          const { error: deleteError } = await admin
            .from('decks')
            .delete()
            .eq('id', deckId)
            .eq('user_id', authUser.id);

          if (deleteError) throw deleteError;
        },
        onParseError: (error: unknown) => {
          console.error('Failed to parse document text:', error);
        },
      });

      await reporter.complete({
        message: 'Deck generated successfully',
        targetType: 'deck',
        targetId: result.deck_id,
        resultPatch: {
          deck_id: result.deck_id,
          card_count: result.card_count,
          title: typeof body.deckName === 'string' && body.deckName.trim() ? body.deckName.trim() : 'AI Generated Deck',
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

    console.error('[generate-deck edge function] error', requestError);
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
