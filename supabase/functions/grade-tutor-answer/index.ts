import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { ensureApiKey, createHttpError } from '../_shared/aiCore.mjs';
import { createAiClient } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const ALLOWED_OUTCOMES = new Set(['correct', 'partial', 'incorrect', 'misconception']);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];

const formatIdeaList = (ideas: string[]): string =>
  ideas.length ? ideas.map((idea) => `- ${idea.replace(/-/g, ' ')}`).join('\n') : '(none specified)';

const formatMisconceptions = (
  misconceptions: Array<{ id?: string; description?: string }>,
): string => (
  misconceptions.length
    ? misconceptions
      .map((m) => `- id "${m.id}": ${m.description || 'common mistake for this concept'}`)
      .join('\n')
    : '(none specified)'
);

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    // Parallel: rate limit + auth (no quota consumed — grading is part of the tutor experience)
    const [rl] = await Promise.all([
      checkRateLimit(request, 'grading'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const {
      prompt: question,
      targetAnswer,
      studentAnswer,
    } = body;
    const requiredIdeas = asStringArray(body.requiredIdeas);
    const optionalIdeas = asStringArray(body.optionalIdeas);
    const misconceptions: Array<{ id?: string; description?: string }> = Array.isArray(body.misconceptions)
      ? body.misconceptions
      : [];

    if (!question || !studentAnswer) {
      throw createHttpError('Missing required fields: prompt, studentAnswer', 400);
    }

    if (typeof studentAnswer === 'string' && studentAnswer.length > 5000) {
      throw createHttpError('Answer is too long. Please limit to ~1000 words.', 400);
    }

    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    ensureApiKey(apiKey);

    const prompt = `You are River, a warm, encouraging tutor grading a student's free-response answer during a one-on-one study session. Grade for genuine conceptual understanding, the way a great human tutor would, NOT by matching keywords.

QUESTION:
${question}

MODEL ANSWER (a reference, not the only acceptable wording):
${targetAnswer || '(none provided)'}

REQUIRED IDEAS the answer should convey (by meaning, in any words):
${formatIdeaList(requiredIdeas)}

OPTIONAL / BONUS IDEAS:
${formatIdeaList(optionalIdeas)}

KNOWN MISCONCEPTIONS to watch for:
${formatMisconceptions(misconceptions)}

STUDENT'S ANSWER:
${studentAnswer}

GRADING PRINCIPLES:
- Judge meaning, not vocabulary. Accept synonyms, paraphrases, informal language, shorthand, and partial wording. If the student clearly understands the idea in their own words, that idea is demonstrated.
- Be generous with partial credit. A student who shows the core idea but misses a detail is "partial", not "incorrect".
- Mark "correct" when all (or essentially all) required ideas are genuinely present, even if phrased loosely.
- Mark "incorrect" only when the answer truly does not show understanding of the required ideas.
- Mark "misconception" only when the answer clearly reflects one of the listed misconceptions; set misconceptionId to that id.
- matchedIdeas / missingIdeas must come from the REQUIRED/OPTIONAL ideas above, by meaning.
- "feedback": one or two warm, specific sentences. Acknowledge what they got right first. Encouraging, never sarcastic.
- "nudge": for partial/incorrect/misconception, a short Socratic question guiding them toward the missing idea (do NOT reveal the answer). null when correct.
- Do not use em dashes.

Output ONLY a valid JSON object with these keys:
- "outcome": one of "correct" | "partial" | "incorrect" | "misconception"
- "score": number between 0 and 1
- "matchedIdeas": array of idea strings the student demonstrated
- "missingIdeas": array of required idea strings still missing
- "misconceptionId": string id or null
- "feedback": string
- "nudge": string or null

Example:
{
  "outcome": "partial",
  "score": 0.6,
  "matchedIdeas": ["two daughter cells"],
  "missingIdeas": ["identical genetic material"],
  "misconceptionId": null,
  "feedback": "Nice, you've got that mitosis makes two daughter cells. There's one more piece about the DNA in those cells.",
  "nudge": "What do the chromosomes in each new cell look like compared to the original?"
}`;

    const ai = createAiClient(apiKey);
    const rawText = await ai.generateContent({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 400,
      responseFormat: 'json_object',
    });

    let result;
    try {
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/u, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/u, '').replace(/\s*```$/u, '');
      }
      result = JSON.parse(cleaned.trim());
    } catch {
      throw createHttpError('AI returned invalid grading format.', 500);
    }

    const outcome = ALLOWED_OUTCOMES.has(result.outcome) ? result.outcome : null;
    let score = typeof result.score === 'number' ? result.score : null;
    if (score === null && outcome) {
      // Derive a sensible score if the model omitted it
      score = outcome === 'correct' ? 1 : outcome === 'partial' ? 0.5 : 0;
    }
    if (outcome === null || score === null) {
      throw createHttpError('AI returned invalid grading result.', 500);
    }
    score = Math.min(1, Math.max(0, score));

    return jsonResponse({
      outcome,
      score,
      matchedIdeas: asStringArray(result.matchedIdeas),
      missingIdeas: asStringArray(result.missingIdeas),
      misconceptionId: typeof result.misconceptionId === 'string' ? result.misconceptionId : null,
      feedback: typeof result.feedback === 'string' ? result.feedback : '',
      nudge: typeof result.nudge === 'string' && result.nudge.trim() ? result.nudge : null,
    }, { status: 200 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[grade-tutor-answer edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse(
      { error: typeof requestError.status === 'number' ? requestError.message : 'An unexpected error occurred.' },
      { status },
      request,
    );
  }
});
