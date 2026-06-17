import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { levelFromXp } from '../_shared/leveling.mjs';

// XP for an exam is recomputed server-side from the stored attempt (never trusted from the
// client). Bounded so a single attempt cannot mint unlimited XP, and idempotent via the
// exam_attempts.xp_awarded guard column so replays grant nothing.
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
      .select('id, user_id, score, total, xp_awarded')
      .eq('id', attemptId)
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) {
      return jsonResponse({ error: 'Exam attempt not found' }, { status: 404 }, request);
    }

    // Already credited: idempotent no-op.
    if (attempt.xp_awarded != null) {
      const { data: existingStats, error: statsError } = await admin
        .from('study_user_stats')
        .select('xp_total')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (statsError) throw statsError;

      const currentXp = toNumber(existingStats?.xp_total, 0);
      const currentLevel = levelFromXp(currentXp);

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

    const xpEarned = computeExamXp(toNumber(attempt.score, 0), toNumber(attempt.total, 0));

    const { data: award, error: awardError } = await admin
      .rpc('award_exam_attempt_xp', {
        p_attempt_id: attemptId,
        p_user_id: authUser.id,
        p_xp_awarded: xpEarned,
      })
      .single();
    if (awardError) throw awardError;

    if (award?.already_awarded === true) {
      const currentXp = toNumber(award.xp_total, 0);
      const currentLevel = levelFromXp(currentXp);
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

    const previousXpTotal = toNumber(award?.previous_xp_total, 0);
    const previousLevel = levelFromXp(previousXpTotal);
    const nextXpTotal = toNumber(award?.xp_total, previousXpTotal + xpEarned);
    const nextLevel = levelFromXp(nextXpTotal);

    return jsonResponse({
      xpEarned,
      stats: {
        xpTotal: nextXpTotal,
        level: nextLevel,
        previousLevel,
        leveledUp: nextLevel > previousLevel,
      },
    }, { status: 200 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[exam-complete edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse({ error: requestError.message || 'Failed to award exam XP' }, { status }, request);
  }
});
