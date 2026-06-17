import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { isPremiumActive } from '../_shared/premiumAccess.mjs';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const REGEN_MINUTES = 15;
const GLOBAL_MAX = 40;
const PRACTICE_REFILL_AMOUNT = 5;
const PRACTICE_MAX_PER_HOUR = 3;

const getHeartsRow = async (userId: number) => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('users')
    .select('id, role, subscription_tier, subscription_expires_at, hearts, last_heart_refill, simulate_free_tier, practice_refill_count, practice_refill_reset_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('User not found');
  return data;
};

const updateUser = async (userId: number, updates: Record<string, unknown>) => {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('users').update(updates).eq('id', userId);
  if (error) throw error;
};

const getUpdatedHearts = async (userId: number) => {
  const user = await getHeartsRow(userId);

  if (isPremiumActive(user)) {
    return { hearts: 'Unlimited', max: 'Unlimited', isUnlimited: true };
  }

  let currentHearts = Number(user.hearts ?? -1);
  let lastRefill = user.last_heart_refill ? new Date(user.last_heart_refill) : new Date();

  if (currentHearts === -1) {
    currentHearts = GLOBAL_MAX;
    lastRefill = new Date();
    await updateUser(userId, { hearts: currentHearts, last_heart_refill: lastRefill.toISOString() });
  } else {
    const now = new Date();
    const elapsedMinutes = Math.floor((now.getTime() - lastRefill.getTime()) / 1000 / 60);

    if (elapsedMinutes >= REGEN_MINUTES && currentHearts < GLOBAL_MAX) {
      const heartsToAdd = Math.floor(elapsedMinutes / REGEN_MINUTES);
      currentHearts = Math.min(GLOBAL_MAX, currentHearts + heartsToAdd);
      lastRefill = new Date(lastRefill.getTime() + heartsToAdd * REGEN_MINUTES * 60 * 1000);

      if (currentHearts === GLOBAL_MAX) {
        lastRefill = now;
      }

      await updateUser(userId, {
        hearts: currentHearts,
        last_heart_refill: lastRefill.toISOString(),
      });
    }
  }

  return {
    hearts: currentHearts,
    max: GLOBAL_MAX,
    isUnlimited: false,
    nextRefill: currentHearts < GLOBAL_MAX
      ? new Date(lastRefill.getTime() + REGEN_MINUTES * 60 * 1000).toISOString()
      : null,
  };
};

const getDeckCardCount = async (deckId: string) => {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId);

  if (error) throw error;
  return Number(count ?? 0);
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  try {
    const url = new URL(request.url);
    const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
    const action = body.action ?? url.searchParams.get('action');

    const authUser = await resolveSupabaseUser(request);

    if (action === 'status') {
      return jsonResponse(await getUpdatedHearts(authUser.id), {}, request);
    }

    if (action === 'session') {
      const deckId = body.deckId ?? url.searchParams.get('deckId');
      if (!deckId) {
        return jsonResponse({ error: 'deckId is required' }, { status: 400 }, request);
      }

      const status = await getUpdatedHearts(authUser.id);
      if (status.isUnlimited) return jsonResponse(status, {}, request);

      const deckSize = await getDeckCardCount(deckId);
      const sessionMax = Math.max(10, Math.min(40, Math.round(deckSize * 0.25)));

      return jsonResponse({
        ...status,
        sessionHearts: Math.min(sessionMax, Number(status.hearts)),
        sessionMax,
      }, {}, request);
    }

    if (action === 'decrement') {
      const status = await getUpdatedHearts(authUser.id);
      if (status.isUnlimited) return jsonResponse(status, {}, request);
      if (Number(status.hearts) <= 0) {
        return jsonResponse({ error: 'Out of hearts' }, { status: 400 }, request);
      }

      const now = new Date();
      const updates: Record<string, unknown> = { hearts: Number(status.hearts) - 1 };
      if (Number(status.hearts) === GLOBAL_MAX) {
        updates.last_heart_refill = now.toISOString();
      }

      await updateUser(authUser.id, updates);
      return jsonResponse(await getUpdatedHearts(authUser.id), {}, request);
    }

    if (action === 'refill') {
      const currentUser = await getHeartsRow(authUser.id);
      if (currentUser.role !== 'admin' && currentUser.role !== 'owner') {
        return jsonResponse({ error: 'Admin access required. Use practice mode to earn hearts.' }, { status: 403 }, request);
      }

      const targetUserId = body.targetUserId ? Number(body.targetUserId) : authUser.id;
      const status = await getUpdatedHearts(targetUserId);
      if (status.isUnlimited) return jsonResponse(status, {}, request);

      const heartsToAdd = body.amount ? Math.min(Number(body.amount), GLOBAL_MAX) : GLOBAL_MAX;
      await updateUser(targetUserId, {
        hearts: Math.min(GLOBAL_MAX, Number(status.hearts) + heartsToAdd),
      });

      return jsonResponse(await getUpdatedHearts(targetUserId), {}, request);
    }

    if (action === 'practice-refill') {
      const status = await getUpdatedHearts(authUser.id);
      if (status.isUnlimited) {
        return jsonResponse({ ...status, practiceUsed: 0, practiceMax: PRACTICE_MAX_PER_HOUR }, {}, request);
      }

      const user = await getHeartsRow(authUser.id);
      const now = new Date();
      const resetAt = user.practice_refill_reset_at ? new Date(user.practice_refill_reset_at) : null;
      const resetNeeded = !resetAt || resetAt <= now;
      const nextResetAt = resetNeeded ? new Date(now.getTime() + 60 * 60 * 1000) : resetAt;
      const practiceUsed = resetNeeded ? 0 : Number(user.practice_refill_count ?? 0);

      if (practiceUsed >= PRACTICE_MAX_PER_HOUR) {
        const minutesLeft = Math.ceil((nextResetAt.getTime() - now.getTime()) / 1000 / 60);
        return jsonResponse({
          error: `Practice refill limit reached. Try again in ${Math.max(1, minutesLeft)} minutes.`,
          practiceUsed,
          practiceMax: PRACTICE_MAX_PER_HOUR,
        }, { status: 429 }, request);
      }

      await updateUser(authUser.id, {
        hearts: Math.min(GLOBAL_MAX, Number(status.hearts) + PRACTICE_REFILL_AMOUNT),
        practice_refill_count: practiceUsed + 1,
        practice_refill_reset_at: nextResetAt.toISOString(),
      });

      return jsonResponse({
        ...(await getUpdatedHearts(authUser.id)),
        heartsAdded: PRACTICE_REFILL_AMOUNT,
        practiceUsed: practiceUsed + 1,
        practiceMax: PRACTICE_MAX_PER_HOUR,
      }, {}, request);
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 }, request);
  } catch (error: unknown) {
    const err: Error & { status?: number } = error instanceof Error ? error : new Error(String(error));
    console.error('[hearts edge function] error', err);
    const status = typeof err.status === 'number' ? err.status : 500;
    return jsonResponse({ error: err.message || 'Internal server error' }, { status }, request);
  }
});
