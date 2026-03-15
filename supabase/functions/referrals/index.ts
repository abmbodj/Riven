import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const REFERRAL_CODE_LENGTH = 8;
const QUALIFYING_SESSION_COUNT = 10;
const QUALIFYING_REFERRAL_TARGET = 5;
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type UserRow = {
  id: number;
  username?: string | null;
  referral_code?: string | null;
  referred_by?: number | null;
  subscription_tier?: string | null;
};

type ReferralRow = {
  referred_id: number;
  has_deck: boolean | null;
  session_count: number | null;
  qualified: boolean | null;
  created_at: string;
};

const httpError = (status: number, message: string) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
};

const getUser = async (userId: number) => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('users')
    .select('id, username, referral_code, referred_by, subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw httpError(404, 'User not found');
  return data as UserRow;
};

const generateReferralCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(REFERRAL_CODE_LENGTH));

  return Array.from(bytes)
    .map((value) => REFERRAL_CODE_CHARS[value % REFERRAL_CODE_CHARS.length])
    .join('');
};

const ensureReferralCode = async (userId: number, currentCode?: string | null) => {
  if (currentCode) return currentCode;

  const admin = getSupabaseAdmin();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nextCode = generateReferralCode();
    const { data, error } = await admin
      .from('users')
      .update({ referral_code: nextCode })
      .eq('id', userId)
      .is('referral_code', null)
      .select('referral_code')
      .maybeSingle();

    if (error?.code === '23505') {
      continue;
    }

    if (error) {
      throw error;
    }

    if (data?.referral_code) {
      return data.referral_code;
    }

    const refreshedUser = await getUser(userId);
    if (refreshedUser.referral_code) {
      return refreshedUser.referral_code;
    }
  }

  throw new Error('Failed to generate referral code');
};

const getReferralProgress = async (referrerId: number) => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('referrals')
    .select('referred_id, has_deck, session_count, qualified, created_at')
    .eq('referrer_id', referrerId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const referralsData = (data ?? []) as ReferralRow[];
  const referredIds = referralsData.map((referral) => referral.referred_id);
  const usernamesById = new Map<number, string | null>();

  if (referredIds.length > 0) {
    const { data: referredUsers, error: referredUsersError } = await admin
      .from('users')
      .select('id, username')
      .in('id', referredIds);

    if (referredUsersError) throw referredUsersError;

    ((referredUsers ?? []) as Array<{ id: number; username: string | null }>).forEach((user) => {
      usernamesById.set(user.id, user.username);
    });
  }

  const referrals = referralsData.map((referral) => ({
    username: usernamesById.get(referral.referred_id) ?? null,
    hasDeck: Boolean(referral.has_deck),
    sessionCount: Number(referral.session_count ?? 0),
    qualified: Boolean(referral.qualified),
    createdAt: referral.created_at,
  }));

  return {
    referrals,
    qualifiedCount: referrals.filter((referral) => referral.qualified).length,
  };
};

const getReferralInfo = async (userId: number) => {
  const user = await getUser(userId);

  if (user.subscription_tier && user.subscription_tier !== 'free') {
    return null;
  }

  const referralCode = await ensureReferralCode(userId, user.referral_code);
  const { referrals, qualifiedCount } = await getReferralProgress(userId);

  return {
    referralCode,
    referrals,
    qualifiedCount,
    targetCount: QUALIFYING_REFERRAL_TARGET,
    rewardEarned: qualifiedCount >= QUALIFYING_REFERRAL_TARGET,
  };
};

const applyReferralCode = async (userId: number, code: unknown) => {
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!normalizedCode) {
    throw httpError(400, 'Referral code required');
  }

  const admin = getSupabaseAdmin();
  const user = await getUser(userId);

  if (user.subscription_tier && user.subscription_tier !== 'free') {
    throw httpError(400, 'Referral program is for free-tier users');
  }

  if (user.referred_by) {
    throw httpError(400, 'You already used a referral code');
  }

  const { data: referrer, error: referrerError } = await admin
    .from('users')
    .select('id')
    .eq('referral_code', normalizedCode)
    .maybeSingle();

  if (referrerError) throw referrerError;
  const typedReferrer = referrer as { id: number } | null;

  if (!typedReferrer) {
    throw httpError(404, 'Invalid referral code');
  }

  if (typedReferrer.id === userId) {
    throw httpError(400, 'Cannot use your own code');
  }

  const { data: updatedUser, error: updateUserError } = await admin
    .from('users')
    .update({ referred_by: typedReferrer.id })
    .eq('id', userId)
    .is('referred_by', null)
    .select('referred_by')
    .maybeSingle();

  if (updateUserError) throw updateUserError;
  if (!updatedUser?.referred_by) {
    throw httpError(400, 'You already used a referral code');
  }

  const { error: insertReferralError } = await admin
    .from('referrals')
    .upsert([{ referrer_id: typedReferrer.id, referred_id: userId }], {
      onConflict: 'referrer_id,referred_id',
      ignoreDuplicates: true,
    });

  if (insertReferralError) throw insertReferralError;

  return { message: 'Referral code applied!' };
};

const checkReferralQualification = async (userId: number) => {
  const admin = getSupabaseAdmin();
  const { data: referral, error: referralError } = await admin
    .from('referrals')
    .select('referrer_id')
    .eq('referred_id', userId)
    .maybeSingle();

  if (referralError) throw referralError;
  const typedReferral = referral as { referrer_id: number } | null;

  if (!typedReferral) {
    return { qualified: false, message: 'No referral found' };
  }

  const { data: decks, error: decksError } = await admin
    .from('decks')
    .select('id')
    .eq('user_id', userId);

  if (decksError) throw decksError;

  const deckIds = ((decks ?? []) as Array<{ id: string }>).map((deck) => deck.id);
  const hasDeck = deckIds.length >= 1;

  let sessions = 0;

  if (deckIds.length > 0) {
    const { count, error: sessionsError } = await admin
      .from('study_sessions')
      .select('id', { count: 'exact', head: true })
      .in('deck_id', deckIds);

    if (sessionsError) throw sessionsError;
    sessions = Number(count ?? 0);
  }

  const qualified = hasDeck && sessions >= QUALIFYING_SESSION_COUNT;

  const { error: updateReferralError } = await admin
    .from('referrals')
    .update({
      has_deck: hasDeck,
      session_count: sessions,
      qualified,
    })
    .eq('referred_id', userId);

  if (updateReferralError) throw updateReferralError;

  if (qualified) {
    const { count: qualifiedCount, error: qualifiedCountError } = await admin
      .from('referrals')
      .select('referred_id', { count: 'exact', head: true })
      .eq('referrer_id', typedReferral.referrer_id)
      .eq('qualified', true);

    if (qualifiedCountError) throw qualifiedCountError;

    if (Number(qualifiedCount ?? 0) >= QUALIFYING_REFERRAL_TARGET) {
      const { error: rewardError } = await admin
        .from('users')
        .update({ subscription_tier: 'lifetime' })
        .eq('id', typedReferral.referrer_id)
        .neq('subscription_tier', 'lifetime');

      if (rewardError) throw rewardError;
    }
  }

  return { qualified, hasDeck, sessions };
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
    const action = request.method === 'GET' ? url.searchParams.get('action') : body.action;
    const authUser = await resolveSupabaseUser(request);

    if (action === 'me') {
      return jsonResponse(await getReferralInfo(authUser.id));
    }

    if (action === 'apply') {
      return jsonResponse(await applyReferralCode(authUser.id, body.code));
    }

    if (action === 'check-qualification') {
      return jsonResponse(await checkReferralQualification(authUser.id));
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('[referrals edge function] error', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return jsonResponse({ error: error?.message || 'Internal server error' }, { status });
  }
});
