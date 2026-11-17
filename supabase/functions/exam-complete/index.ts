import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { levelFromXp } from '../_shared/leveling.mjs';
import { scoreAttempt } from '../_shared/examScoringCore.mjs';

// XP for an exam is recomputed server-side: the attempt's answers are re-scored against the
// caller's own stored exam (examScoringCore), and the client's score/total are overwritten.
// An attempt without such an exam earns nothing. Bounded per attempt, and idempotent via
// the exam_attempts.xp_awarded guard column so replays and concurrent calls grant nothing.
const MAX_EXAM_XP = 200;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const computeExamXp = (score: number, total: number) => {
  if (total <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, score / total));
  const base = Math.round(ratio * 100);
  const bonus = ratio >= 0.7 ? 20 : 0;
  return Math.min(MAX_EXAM_XP, base + bonus);
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const attemptId = typeof body.attemptId === 'string' ? body.attemptId.trim() : '';
    if (!attemptId) {
      return jsonResponse({ error: 'attemptId is required' }, { status: 400 }, request);
    }

    const [rl, authUser] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const admin = getSupabaseAdmin();
    const { data: attempt, error: attemptError } = await admin
      .from('exam_attempts')
      .select('id, user_id, exam_id, answers, xp_awarded')
      .eq('id', attemptId)
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) {
      return jsonResponse({ error: 'Exam attempt not found' }, { status: 404 }, request);
    }

    const { data: existingStats, error: statsError } = await admin
      .from('study_user_stats')
      .select('xp_total, level, sessions_completed, topics_mastered')
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (statsError) throw statsError;

    const currentXp = toNumber(existingStats?.xp_total, 0);
    const currentLevel = levelFromXp(currentXp);

    // Already credited: idempotent no-op.
    if (attempt.xp_awarded != null) {
      return jsonResponse({
        xpEarned: 0,
        alreadyAwarded: true,
        stats: {
          xpTotal: currentXp,
          level: currentLevel,
          previousLevel: currentLevel,
          leveledUp: false,
        },
      }, { status: 200 }, request);
    }

    const { data: exam, error: examError } = attempt.exam_id
      ? await admin
        .from('mock_exams')
        .select('questions')
        .eq('id', attempt.exam_id)
        .eq('user_id', authUser.id)
        .maybeSingle()
      : { data: null, error: null };
    if (examError) throw examError;

    const { score, total } = scoreAttempt(exam?.questions ?? [], attempt.answers ?? []);
    const xpEarned = computeExamXp(score, total);

    // Claim the attempt first (and store the server's score) so a replay or a concurrent
    // call cannot double-grant: only the call whose update matched the row continues.
    const { data: claimed, error: markError } = await admin
      .from('exam_attempts')
      .update({ xp_awarded: xpEarned, score, total })
      .eq('id', attemptId)
      .eq('user_id', authUser.id)
      .is('xp_awarded', null)
      .select('id');
    if (markError) throw markError;
    if (!claimed?.length) {
      return jsonResponse({
        xpEarned: 0,
        alreadyAwarded: true,
        stats: { xpTotal: currentXp, level: currentLevel, previousLevel: currentLevel, leveledUp: false },
      }, { status: 200 }, request);
    }

    const nextXpTotal = currentXp + xpEarned;
    const nextLevel = levelFromXp(nextXpTotal);

    const { error: upsertError } = await admin
      .from('study_user_stats')
      .upsert({
        user_id: authUser.id,
        xp_total: nextXpTotal,
        level: nextLevel,
        last_study_at: new Date().toISOString(),
        sessions_completed: toNumber(existingStats?.sessions_completed, 0),
        topics_mastered: toNumber(existingStats?.topics_mastered, 0),
      }, { onConflict: 'user_id' });
    if (upsertError) throw upsertError;

    return jsonResponse({
      xpEarned,
      stats: {
        xpTotal: nextXpTotal,
        level: nextLevel,
        previousLevel: currentLevel,
        leveledUp: nextLevel > currentLevel,
      },
    }, { status: 200 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[exam-complete edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse({ error: requestError.message || 'Failed to award exam XP' }, { status }, request);
  }
});
