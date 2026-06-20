import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { ensureApiKey, createHttpError, aiModelMap } from '../_shared/aiCore.mjs';
import { createAiClient } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

// River stays Socratic and warm but never reveals the check answer.
const CHAT_TIMEOUT_MS = 10_000;
const MAX_HISTORY_TURNS = 6; // last 3 exchanges (user + assistant pairs)

const CHIP_INSTRUCTIONS: Record<string, string> = {
  'explain-simply': 'The student wants a simpler explanation of this concept. Use a fresh angle, plain language, and a quick analogy. Keep it concise (2-4 sentences).',
  'show-example': 'The student wants another worked example. Pick a new, concrete scenario different from the ones already taught. Walk through it briefly.',
  'break-it-down': 'The student wants a step-by-step breakdown of the core technique. Number the steps clearly. Keep each step short.',
  'why-it-matters': 'The student wants to know why this matters in practice. Give a real-world reason in 2-3 sentences. Make it feel relevant.',
};

const buildSystemPrompt = (card: {
  prompt?: string;
  concept_id?: string;
  teaching?: {
    learning_objective?: string;
    explain?: string;
    intuition?: string;
  };
}) => {
  const objective = card.teaching?.learning_objective ?? '';
  const conceptLabel = (card.concept_id ?? 'this concept').replace(/-/g, ' ');
  const explainSnippet = card.teaching?.explain
    ? card.teaching.explain.slice(0, 600)
    : '';
  const intuition = card.teaching?.intuition ?? '';

  return `You are River, a warm, slightly playful study tutor wearing a green knit beanie. You are helping a student understand one concept before they answer a recall question.

CONCEPT BEING TAUGHT: ${conceptLabel}
LEARNING OBJECTIVE: ${objective}
RECALL QUESTION THE STUDENT WILL ANSWER LATER: ${card.prompt ?? ''}

TEACHING CONTEXT (your explanation so far):
${explainSnippet}${intuition ? `\n\nMental model: ${intuition}` : ''}

YOUR RULES:
- Be Socratic: guide the student toward understanding rather than just delivering facts.
- Never reveal the answer to the recall question above.
- Keep replies short (3-6 sentences max unless a step-by-step is needed).
- Be warm, encouraging, slightly playful — River's voice, not a textbook.
- If the student asks something off-topic, gently redirect to the concept at hand.
- Do not use em dashes.`;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));

    const [rl] = await Promise.all([
      checkRateLimit(request, 'grading'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const { card, history, message, chipId } = body;

    if (!card || typeof card !== 'object') {
      throw createHttpError('Missing card context.', 400);
    }

    const userMessage: string = chipId
      ? (CHIP_INSTRUCTIONS[chipId] ?? message ?? '')
      : (typeof message === 'string' ? message.trim() : '');

    if (!userMessage) {
      throw createHttpError('Missing message or chipId.', 400);
    }

    if (userMessage.length > 1000) {
      throw createHttpError('Message is too long.', 400);
    }

    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    ensureApiKey(apiKey);

    // Build conversation: system + trimmed history + new user turn
    const recentHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
    const messages = [
      { role: 'system' as const, content: buildSystemPrompt(card) },
      ...recentHistory.map((turn: { role: string; content: string }) => ({
        role: (turn.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: String(turn.content ?? ''),
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const ai = createAiClient(apiKey);

    const reply = await Promise.race([
      ai.generateContent({
        model: aiModelMap.grading, // keep tutor-chat on the small/fast model; grading is also fine-grained chat
        messages,
        maxTokens: 400,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(createHttpError('River timed out. Please try again.', 504)), CHAT_TIMEOUT_MS),
      ),
    ]);

    // Derive a River pose from the chip or the response tone (simple heuristic)
    let pose = 'teach';
    if (chipId === 'explain-simply') pose = 'encourage';
    else if (chipId === 'show-example') pose = 'point';
    else if (chipId === 'why-it-matters') pose = 'thinking';

    return jsonResponse({ reply: String(reply ?? '').trim(), pose }, { status: 200 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[tutor-chat edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse(
      { error: typeof requestError.status === 'number' ? requestError.message : 'An unexpected error occurred.' },
      { status },
      request,
    );
  }
});
