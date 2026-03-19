import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { ensureApiKey, createHttpError } from '../_shared/aiCore.mjs';
import { createAiClient } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    // Parallel: rate limit + auth (no quota consumed — grading is part of the exam experience)
    const [rl] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const { question, studentAnswer, correctAnswer, gradingRubric } = body;

    if (!question || !studentAnswer || !correctAnswer || !gradingRubric) {
      throw createHttpError('Missing required fields: question, studentAnswer, correctAnswer, gradingRubric', 400);
    }

    if (studentAnswer.length > 5000) {
      throw createHttpError('Answer is too long. Please limit to ~1000 words.', 400);
    }

    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    ensureApiKey(apiKey);

    const prompt = `You are an expert exam grader. Grade the student's answer to the following question.

QUESTION: ${question}

MODEL ANSWER: ${correctAnswer}

GRADING RUBRIC: ${gradingRubric}

STUDENT'S ANSWER: ${studentAnswer}

Grade the answer on a scale of 0-100 based on how well it covers the key points in the rubric.
Be fair but rigorous. Partial credit is appropriate.

Output ONLY a valid JSON object with these keys:
- "score": integer 0-100
- "feedback": A 1-2 sentence explanation of the grade
- "keyPointsHit": An array of key points the student correctly addressed
- "keyPointsMissed": An array of key points the student missed or got wrong

Example:
{
  "score": 75,
  "feedback": "Good understanding of the core mechanism but missed the role of ATP synthase.",
  "keyPointsHit": ["Identified electron carriers NADH and FADH2", "Described proton gradient"],
  "keyPointsMissed": ["Did not mention ATP synthase", "Omitted chemiosmosis"]
}`;

    const ai = createAiClient(apiKey);
    const rawText = await ai.generateContent({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 512,
      jsonMode: true,
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

    if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
      throw createHttpError('AI returned invalid score.', 500);
    }

    return jsonResponse({
      score: Math.round(result.score),
      feedback: result.feedback || '',
      keyPointsHit: Array.isArray(result.keyPointsHit) ? result.keyPointsHit : [],
      keyPointsMissed: Array.isArray(result.keyPointsMissed) ? result.keyPointsMissed : [],
    }, { status: 200 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[grade-answer edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse(
      { error: typeof requestError.status === 'number' ? requestError.message : 'An unexpected error occurred.' },
      { status },
      request,
    );
  }
});
