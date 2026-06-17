import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  ensureApiKey,
  parseAiJsonResponse,
  createHttpError,
} from '../_shared/aiCore.mjs';
import { createAiClient, contentsToMessages } from '../_shared/aiClient.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

// Onboarding magic moment: generate a short flashcard set from a TYPED TOPIC for a
// brand-new, not-yet-authenticated visitor. Deliberately scoped down vs. generate-deck:
//   - no auth (verify_jwt = false; anonymous surface — rate-limited hard by IP)
//   - no DB write (cards are returned in-memory; persisted only after the user signs up)
//   - no AI quota burn (there's no user to meter)
// The cards the visitor sees are later saved verbatim as their first real deck, so we never
// regenerate after signup.

const MAX_TOPIC_LENGTH = 200;
const PREVIEW_CARD_COUNT = 6;

const buildPreviewPrompt = (topic: string) => `You are an expert tutor creating a short, welcoming set of spaced-repetition flashcards to teach a student about a topic they just typed in.

Topic: "${topic}"

Output ONLY a valid JSON array. No markdown, backticks, or text outside the array.
Each card: { "front": "question/term", "back": "answer/definition" }.
Produce exactly ${PREVIEW_CARD_COUNT} cards. Atomic (one concept per card). Accurate and genuinely useful as a first taste of studying the topic.
Vary types: define, compare, explain why, apply. Start with the most fundamental, approachable concept first so the first card feels easy and encouraging.
If the topic is too vague, gibberish, or not a real subject, infer the closest plausible academic subject and make a helpful intro set for it anyway.`;

const sanitizeTopic = (raw: unknown): string => {
  if (typeof raw !== 'string') {
    throw createHttpError('A topic is required.', 400);
  }
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    throw createHttpError('A topic is required.', 400);
  }
  if (trimmed.length > MAX_TOPIC_LENGTH) {
    throw createHttpError(`Keep your topic under ${MAX_TOPIC_LENGTH} characters.`, 400);
  }
  return trimmed;
};

const deriveDeckName = (topic: string) => {
  // Use the topic as-is for a title, capped to a friendly length.
  const clean = topic.length <= 60 ? topic : `${topic.slice(0, 57).trimEnd()}…`;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
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
    // Anonymous surface: rate-limit by IP before doing any work.
    const rl = await checkRateLimit(request, 'default');
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const topic = sanitizeTopic(body.topic);

    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    ensureApiKey(apiKey);

    const ai = createAiClient(apiKey);
    const rawResponse = await ai.generateContent({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: contentsToMessages([{ text: buildPreviewPrompt(topic) }]),
      maxTokens: 1024,
    });

    const flashcards = parseAiJsonResponse(
      rawResponse,
      'We couldn’t build a set for that. Try rephrasing your topic.',
    );

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      throw createHttpError('We couldn’t build a set for that. Try a more specific topic.', 502);
    }

    const cards = flashcards
      .filter((card) => card && typeof card.front === 'string' && typeof card.back === 'string')
      .slice(0, 8)
      .map((card, i) => ({ front: card.front, back: card.back, position: i }));

    if (cards.length === 0) {
      throw createHttpError('We couldn’t build a set for that. Try a more specific topic.', 502);
    }

    return jsonResponse({ topic, deckName: deriveDeckName(topic), cards }, { status: 200 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[generate-deck-preview] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse(
      {
        error: typeof requestError.status === 'number'
          ? requestError.message
          : 'Something went wrong building your set. Please try again.',
      },
      { status },
      request,
    );
  }
});
