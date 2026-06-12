import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { sendWelcomeEmail } from '../_shared/email.ts';
import { reportEdgeException } from '../_shared/sentry.ts';

const isValidUsername = (u: string) =>
  u.length >= 2 && u.length <= 30 && /^[a-zA-Z0-9_]+$/.test(u);

const generateShareCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

const DEFAULT_THEMES = [
  {
    name: 'Riven',
    bg_color: '#162a31', surface_color: '#1e3840', text_color: '#e4ddd0',
    secondary_text_color: '#8fa6a8', border_color: '#233e46', accent_color: '#deb96a',
    font_family_display: 'Cormorant Garamond', font_family_body: 'Lora',
    effect_preset: 'auto', effect_intensity: 'medium',
    background_style: 'solid', gradient_colors: [], gradient_angle: 135, gradient_intensity: 'medium',
    is_active: true,
  },
  {
    name: 'Riven Light',
    bg_color: '#f5f0e8', surface_color: '#ffffff', text_color: '#1e3840',
    secondary_text_color: '#6b7d7f', border_color: '#ddd5c8', accent_color: '#deb96a',
    font_family_display: 'Cormorant Garamond', font_family_body: 'Lora',
    effect_preset: 'auto', effect_intensity: 'medium',
    background_style: 'solid', gradient_colors: [], gradient_angle: 135, gradient_intensity: 'medium',
    is_active: false,
  },
  {
    name: 'Manuscript',
    bg_color: '#f3eee3', surface_color: '#fffaf1', text_color: '#211b16',
    secondary_text_color: '#75695b', border_color: '#d8cdbb', accent_color: '#8a9b55',
    font_family_display: 'Instrument Serif', font_family_body: 'Lora',
    effect_preset: 'dust', effect_intensity: 'soft',
    background_style: 'gradient', gradient_colors: ['#f3eee3', '#fffaf1', '#d9c8ac'],
    gradient_angle: 145, gradient_intensity: 'soft',
    is_active: false,
  },
  {
    name: 'Deep Current',
    bg_color: '#071a1d', surface_color: '#0f2a2d', text_color: '#e7f2eb',
    secondary_text_color: '#8ca9a5', border_color: '#1f4546', accent_color: '#7bcbb8',
    font_family_display: 'Cormorant Garamond', font_family_body: 'Lora',
    effect_preset: 'auto', effect_intensity: 'medium',
    background_style: 'gradient', gradient_colors: ['#061013', '#0a2c31', '#124d4c'],
    gradient_angle: 160, gradient_intensity: 'rich',
    is_active: false,
  },
  {
    name: 'Signal Glass',
    bg_color: '#081114', surface_color: '#101d20', text_color: '#e8f3ef',
    secondary_text_color: '#90a6a3', border_color: '#26383a', accent_color: '#8be2d1',
    font_family_display: 'JetBrains Mono', font_family_body: 'Space Grotesk',
    effect_preset: 'grid', effect_intensity: 'medium',
    background_style: 'gradient', gradient_colors: ['#071013', '#102026', '#17353a'],
    gradient_angle: 135, gradient_intensity: 'medium',
    is_active: false,
  },
];

const mapUserRow = (row: Record<string, unknown>) => {
  const role = (row.role as string) || (row.is_admin === 1 ? 'admin' : 'user');
  const effectiveTier =
    (role === 'owner' || role === 'admin') && !row.simulate_free_tier
      ? 'lifetime'
      : ((row.subscription_tier as string) || 'free');

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    email: row.email,
    shareCode: row.share_code,
    avatar: row.avatar ?? null,
    banner: row.banner ?? null,
    bio: (row.bio as string) || '',
    role,
    isAdmin: role === 'admin' || role === 'owner',
    isOwner: role === 'owner',
    streakData: typeof row.streak_data === 'string'
      ? JSON.parse(row.streak_data)
      : (row.streak_data || {}),
    twoFAEnabled: !!row.two_fa_enabled,
    subscription_tier: effectiveTier,
    simulate_free_tier: !!row.simulate_free_tier,
    email_verified: true,
    onboardingCompletedAt:
      row.onboarding_completed_at != null && row.onboarding_completed_at !== ''
        ? String(row.onboarding_completed_at)
        : null,
    onboardingStep: Number(row.onboarding_step ?? 0) || 0,
  };
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const token =
      request.headers.get('x-supabase-auth')?.trim() ||
      (request.headers.get('Authorization')?.startsWith('Bearer ')
        ? request.headers.get('Authorization')?.slice('Bearer '.length)
        : '');

    if (!token) {
      return jsonResponse({ error: 'No token provided' }, { status: 401 }, request);
    }

    // Verify token with project admin client. This avoids anon-key mismatch issues
    // while still validating that the bearer token belongs to this Supabase project.
    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Invalid Supabase token' }, { status: 401 }, request);
    }

    const supabaseAuthId = authData.user.id;
    const email = authData.user.email;
    if (!email) {
      return jsonResponse({ error: 'No email on Supabase Auth account' }, { status: 400 }, request);
    }

    // Parse username from body. CAPTCHA is verified during the initial signup request.
    const body = await request.json().catch(() => ({})) as { username?: string };

    const meta = authData.user.user_metadata || {};
    let username =
      body.username ||
      (meta.username as string) ||
      ((meta.full_name as string) || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() ||
      email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    username = username.slice(0, 30);
    if (!isValidUsername(username)) {
      return jsonResponse(
        { error: 'Username must be 2-30 characters, alphanumeric and underscores only' },
        { status: 400 },
        request,
      );
    }

    // 1. Already linked — return existing user
    const { data: existingLinked } = await admin
      .from('users')
      .select('*')
      .eq('supabase_auth_id', supabaseAuthId)
      .maybeSingle();

    if (existingLinked) {
      return jsonResponse({ user: mapUserRow(existingLinked) }, {}, request);
    }

    // 2. Legacy user with same email — link accounts
    const { data: existingEmail } = await admin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (existingEmail) {
      await admin
        .from('users')
        .update({ supabase_auth_id: supabaseAuthId, email_verified: true })
        .eq('id', existingEmail.id);

      const { data: updatedUser } = await admin
        .from('users')
        .select('*')
        .eq('id', existingEmail.id)
        .single();

      return jsonResponse({ user: mapUserRow(updatedUser) }, {}, request);
    }

    // 3. Create new user — ensure unique username
    let finalUsername = username;
    let counter = 1;
    while (true) {
      const { data: existing } = await admin
        .from('users')
        .select('id')
        .ilike('username', finalUsername)
        .maybeSingle();
      if (!existing) break;
      finalUsername = `${username}${counter}`;
      counter++;
    }

    const shareCode = generateShareCode();
    const displayName = (meta.full_name as string) || finalUsername;

    const { data: newUser, error: insertError } = await admin
      .from('users')
      .insert({
        username: finalUsername,
        display_name: displayName,
        email: email.toLowerCase(),
        supabase_auth_id: supabaseAuthId,
        share_code: shareCode,
        email_verified: true,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    const userId = newUser.id;

    const themes = DEFAULT_THEMES.map((theme) => ({
      user_id: userId,
      ...theme,
      is_default: true,
    }));
    await admin.from('themes').insert(themes);

    // Preset tags
    const presetTags = [
      { name: 'Language', color: '#3b82f6' },
      { name: 'Science', color: '#22c55e' },
      { name: 'Math', color: '#f59e0b' },
      { name: 'History', color: '#8b5cf6' },
      { name: 'Programming', color: '#06b6d4' },
      { name: 'Medical', color: '#ef4444' },
      { name: 'Business', color: '#ec4899' },
      { name: 'Art', color: '#f97316' },
    ].map((t) => ({ user_id: userId, ...t, is_preset: true }));
    await admin.from('tags').upsert(presetTags, { onConflict: 'user_id,name', ignoreDuplicates: true });

    // Welcome email (fire-and-forget)
    sendWelcomeEmail(email.toLowerCase(), finalUsername).catch(() => {});

    return jsonResponse({
      user: {
        id: userId, username: finalUsername, displayName, email: email.toLowerCase(),
        shareCode, avatar: null, banner: null, bio: '', role: 'user',
        isAdmin: false, isOwner: false, streakData: {}, twoFAEnabled: false,
        subscription_tier: 'free', simulate_free_tier: false, email_verified: true,
        onboardingCompletedAt: null,
        onboardingStep: 0,
      },
    }, { status: 201 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    await reportEdgeException(requestError, { request, functionName: 'complete-registration' });
    console.error('[complete-registration] error', requestError);
    return jsonResponse(
      { error: requestError.message || 'Registration failed' },
      { status },
      request,
    );
  }
});
