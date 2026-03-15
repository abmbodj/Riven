import { getSupabaseAdmin } from './supabaseAdmin.ts';

type AdminActor = {
  id: number;
  role: string;
};

type UserIdentity = {
  role?: string | null;
  is_admin?: unknown;
};

const createHttpError = (message: string, status: number) => {
  const error = new Error(message);
  (error as Error & { status?: number }).status = status;
  return error;
};

const isAdminFlag = (value: unknown) => value === true || Number(value ?? 0) === 1;

const normalizeRole = (user: UserIdentity | null | undefined) =>
  user?.role || (isAdminFlag(user?.is_admin) ? 'admin' : 'user');

const parseStreakData = (value: string | null) => {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
};

const mapUserSummary = (user: Record<string, unknown>) => {
  const role = normalizeRole(user);

  return {
    id: Number(user.id),
    username: String(user.username ?? ''),
    email: String(user.email ?? ''),
    shareCode: user.share_code ?? null,
    avatar: user.avatar ?? null,
    bio: String(user.bio ?? ''),
    streakData: parseStreakData(typeof user.streak_data === 'string' ? user.streak_data : '{}'),
    role,
    isAdmin: role === 'admin' || role === 'owner',
    isOwner: role === 'owner',
    subscriptionTier: String(user.subscription_tier ?? 'free'),
    createdAt: user.created_at ?? null,
  };
};

const mapMessage = (message: Record<string, unknown>, createdBy = 'System') => ({
  id: Number(message.id),
  title: String(message.title ?? ''),
  content: String(message.content ?? ''),
  type: String(message.type ?? 'info'),
  isActive: isAdminFlag(message.is_active),
  createdBy,
  createdAt: message.created_at ?? null,
  expiresAt: message.expires_at ?? null,
});

const fetchUsernameMap = async (userIds: number[]) => {
  if (!userIds.length) {
    return new Map<number, string>();
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('users')
    .select('id, username')
    .in('id', userIds);

  if (error) throw error;

  return new Map(
    ((data || []) as Array<{ id: unknown; username: unknown }>)
      .map((row) => [Number(row.id), String(row.username)]),
  );
};

const countRows = async (table: string, build?: (query: any) => any) => {
  const admin = getSupabaseAdmin();
  let query = admin.from(table).select('id', { count: 'exact', head: true });

  if (build) {
    query = build(query);
  }

  const { count, error } = await query;
  if (error) throw error;

  return Number(count ?? 0);
};

const buildDailyUserCounts = (users: Array<{ created_at: string }>) => {
  const byDay = new Map<string, number>();

  users.forEach((user) => {
    const dateKey = new Date(user.created_at).toISOString().slice(0, 10);
    byDay.set(dateKey, (byDay.get(dateKey) ?? 0) + 1);
  });

  const today = new Date();
  const start = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  ));

  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() - (29 - index));
    const date = day.toISOString().slice(0, 10);

    return {
      date,
      count: byDay.get(date) ?? 0,
    };
  });
};

export const requireAdminActor = async (userId: number): Promise<AdminActor> => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('users')
    .select('id, role, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw createHttpError('User not found', 404);

  const role = normalizeRole(data);
  if (role !== 'admin' && role !== 'owner') {
    throw createHttpError('Admin access required', 403);
  }

  return { id: Number(data.id), role };
};

export const requireOwnerActor = async (userId: number): Promise<AdminActor> => {
  const actor = await requireAdminActor(userId);

  if (actor.role !== 'owner') {
    throw createHttpError('Owner access required', 403);
  }

  return actor;
};

export const listAdminUsers = async () => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('users')
    .select('id, username, email, share_code, avatar, bio, streak_data, is_admin, role, subscription_tier, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data || []) as Array<Record<string, unknown>>).map((user) => mapUserSummary(user));
};

export const updateAdminUserRole = async (actor: AdminActor, userId: number, role: string) => {
  if (!['user', 'admin', 'friends'].includes(role)) {
    throw createHttpError('Role must be "user", "admin", or "friends"', 400);
  }

  const admin = getSupabaseAdmin();
  const { data: target, error: targetError } = await admin
    .from('users')
    .select('id, username, role, is_admin, subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) throw createHttpError('User not found', 404);
  if (target.role === 'owner') throw createHttpError('Cannot change the owner\'s role', 400);
  if (Number(target.id) === actor.id) throw createHttpError('Cannot change your own role', 400);

  const updates: Record<string, unknown> = {
    role,
    is_admin: role === 'admin' ? 1 : 0,
  };

  if (role === 'friends') {
    updates.subscription_tier = 'lifetime';
  } else if (target.role === 'friends') {
    updates.subscription_tier = 'free';
  }

  const { error: updateError } = await admin
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (updateError) throw updateError;

  const subscriptionTier = role === 'friends'
    ? 'lifetime'
    : target.role === 'friends'
      ? 'free'
      : String(target.subscription_tier ?? 'free');

  return {
    id: Number(target.id),
    username: String(target.username ?? ''),
    role,
    isAdmin: role === 'admin',
    subscriptionTier,
  };
};

export const updateAdminUser = async (actor: AdminActor, userId: number, payload: Record<string, unknown>) => {
  const admin = getSupabaseAdmin();
  const { data: target, error: targetError } = await admin
    .from('users')
    .select('id, username, email, role, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) throw createHttpError('User not found', 404);
  if (target.role === 'owner' && actor.role !== 'owner') {
    throw createHttpError('Cannot edit owner account', 403);
  }

  const username = typeof payload.username === 'string' ? payload.username : undefined;
  const email = typeof payload.email === 'string' ? payload.email : undefined;
  const bio = typeof payload.bio === 'string' ? payload.bio : undefined;

  if (email && email.toLowerCase() !== String(target.email ?? '').toLowerCase()) {
    const { data: existingEmail, error: emailError } = await admin
      .from('users')
      .select('id')
      .ilike('email', email)
      .neq('id', userId)
      .maybeSingle();

    if (emailError) throw emailError;
    if (existingEmail) throw createHttpError('Email already in use', 400);
  }

  if (username && username.toLowerCase() !== String(target.username ?? '').toLowerCase()) {
    const { data: existingUsername, error: usernameError } = await admin
      .from('users')
      .select('id')
      .ilike('username', username)
      .neq('id', userId)
      .maybeSingle();

    if (usernameError) throw usernameError;
    if (existingUsername) throw createHttpError('Username already in use', 400);
  }

  const updates: Record<string, unknown> = {};

  if (username !== undefined) updates.username = username;
  if (email !== undefined) updates.email = email;
  if (bio !== undefined) updates.bio = bio;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await admin
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (updateError) throw updateError;
  }

  const { data: user, error: userError } = await admin
    .from('users')
    .select('id, username, email, role, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) throw createHttpError('User not found', 404);

  const role = normalizeRole(user);

  return {
    id: Number(user.id),
    username: String(user.username ?? ''),
    email: String(user.email ?? ''),
    role,
    isAdmin: role === 'admin' || role === 'owner',
  };
};

export const deleteAdminUser = async (actor: AdminActor, userId: number) => {
  if (userId === actor.id) {
    throw createHttpError('Cannot delete your own account', 400);
  }

  const admin = getSupabaseAdmin();
  const { data: target, error: targetError } = await admin
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) throw createHttpError('User not found', 404);
  if (target.role === 'owner') throw createHttpError('Cannot delete the owner account', 400);
  if (target.role === 'admin' && actor.role !== 'owner') {
    throw createHttpError('Only owners can delete admin accounts', 403);
  }

  const { error: deleteError } = await admin
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteError) throw deleteError;

  return { message: 'User deleted' };
};

export const getAdminStats = async () => {
  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    users,
    decks,
    cards,
    sharedDecks,
    activeMessages,
    recentUsersResult,
    recentSessionsResult,
  ] = await Promise.all([
    countRows('users'),
    countRows('decks'),
    countRows('cards'),
    countRows('shared_decks'),
    countRows('global_messages', (query) => query.eq('is_active', 1)),
    admin.from('users').select('created_at').gt('created_at', since).order('created_at', { ascending: true }),
    admin.from('study_sessions').select('deck_id, created_at').gt('created_at', since),
  ]);

  if (recentUsersResult.error) throw recentUsersResult.error;
  if (recentSessionsResult.error) throw recentSessionsResult.error;

  const recentUsers = (recentUsersResult.data || []) as Array<{ created_at: string }>;
  const recentSessions = (recentSessionsResult.data || []) as Array<{ deck_id: unknown }>;
  const sessionCounts = new Map<number, number>();

  recentSessions.forEach((session) => {
    const deckId = Number(session.deck_id);
    sessionCounts.set(deckId, (sessionCounts.get(deckId) ?? 0) + 1);
  });

  const deckIds = Array.from(sessionCounts.keys());
  let topDecks: Array<{ title: string; creator: string; sessions: number }> = [];

  if (deckIds.length > 0) {
    const { data: deckRows, error: deckError } = await admin
      .from('decks')
      .select('id, title, user_id')
      .in('id', deckIds);

    if (deckError) throw deckError;

    const mappedDeckRows = (deckRows || []) as Array<{ id: unknown; title: unknown; user_id: unknown }>;
    const creatorIds = Array.from(
      new Set(mappedDeckRows.map((deck) => Number(deck.user_id)).filter((userId) => Boolean(userId))),
    );
    const creatorMap = await fetchUsernameMap(creatorIds);

    topDecks = mappedDeckRows
      .map((deck) => ({
        title: String(deck.title ?? ''),
        creator: creatorMap.get(Number(deck.user_id)) || 'Unknown',
        sessions: sessionCounts.get(Number(deck.id)) ?? 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);
  }

  return {
    users,
    decks,
    cards,
    sharedDecks,
    activeMessages,
    recentSignups: recentUsers.length,
    recentSessions: recentSessions.length,
    dailyUsers: buildDailyUserCounts(recentUsers),
    topDecks,
  };
};

export const listAdminMessages = async () => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('global_messages')
    .select('id, title, content, type, is_active, created_by, created_at, expires_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const messageRows = (data || []) as Array<Record<string, unknown>>;
  const creatorIds = Array.from(
    new Set(messageRows.map((message) => Number(message.created_by)).filter((userId) => Boolean(userId))),
  );
  const creatorMap = await fetchUsernameMap(creatorIds);

  return messageRows.map((message) => mapMessage(
    message,
    creatorMap.get(Number(message.created_by)) || 'System',
  ));
};

export const createAdminMessage = async (actor: AdminActor, payload: Record<string, unknown>) => {
  const title = typeof payload.title === 'string' ? payload.title : '';
  const content = typeof payload.content === 'string' ? payload.content : '';
  const type = typeof payload.type === 'string' ? payload.type : 'info';
  const expiresAt = payload.expiresAt ?? null;

  if (!title || !content) {
    throw createHttpError('Title and content are required', 400);
  }

  if (title.length > 100) {
    throw createHttpError('Title must be under 100 characters', 400);
  }

  if (content.length > 1000) {
    throw createHttpError('Content must be under 1000 characters', 400);
  }

  const validTypes = ['info', 'warning', 'success', 'error'];
  const messageType = validTypes.includes(type) ? type : 'info';
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('global_messages')
    .insert({
      title,
      content,
      type: messageType,
      created_by: actor.id,
      expires_at: expiresAt,
    })
    .select('id, title, content, type, is_active, created_at, expires_at')
    .single();

  if (error) throw error;

  return {
    id: Number(data.id),
    title: String(data.title ?? ''),
    content: String(data.content ?? ''),
    type: String(data.type ?? 'info'),
    isActive: isAdminFlag(data.is_active),
    createdAt: data.created_at ?? null,
    expiresAt: data.expires_at ?? null,
  };
};

export const updateAdminMessage = async (messageId: number, payload: Record<string, unknown>) => {
  const admin = getSupabaseAdmin();
  const { data: existing, error: existingError } = await admin
    .from('global_messages')
    .select('id')
    .eq('id', messageId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw createHttpError('Message not found', 404);

  const updates: Record<string, unknown> = {};

  if (payload.isActive !== undefined) {
    updates.is_active = payload.isActive ? 1 : 0;
  }

  if (payload.title !== undefined && payload.title !== null) {
    updates.title = payload.title;
  }

  if (payload.content !== undefined && payload.content !== null) {
    updates.content = payload.content;
  }

  if (payload.type !== undefined && payload.type !== null) {
    updates.type = payload.type;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await admin
      .from('global_messages')
      .update(updates)
      .eq('id', messageId);

    if (updateError) throw updateError;
  }

  const { data: message, error: messageError } = await admin
    .from('global_messages')
    .select('id, title, content, type, is_active')
    .eq('id', messageId)
    .maybeSingle();

  if (messageError) throw messageError;
  if (!message) throw createHttpError('Message not found', 404);

  return {
    id: Number(message.id),
    title: String(message.title ?? ''),
    content: String(message.content ?? ''),
    type: String(message.type ?? 'info'),
    isActive: isAdminFlag(message.is_active),
  };
};

export const deleteAdminMessage = async (messageId: number) => {
  const admin = getSupabaseAdmin();
  const { data: existing, error: existingError } = await admin
    .from('global_messages')
    .select('id')
    .eq('id', messageId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw createHttpError('Message not found', 404);

  const { error: deleteError } = await admin
    .from('global_messages')
    .delete()
    .eq('id', messageId);

  if (deleteError) throw deleteError;

  return { message: 'Message deleted' };
};

export const listAdminReports = async () => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('reports')
    .select('id, reporter_id, reported_user_id, content_type, content_id, reason, details, status, created_at, resolved_at, resolved_by');

  if (error) throw error;

  const reportRows = (data || []) as Array<Record<string, unknown>>;
  const userIds = Array.from(
    new Set(
      reportRows.flatMap((report) => [
        Number(report.reporter_id),
        Number(report.reported_user_id),
        Number(report.resolved_by),
      ]).filter((userId) => Boolean(userId)),
    ),
  );
  const usernameMap = await fetchUsernameMap(userIds);

  return reportRows
    .map((report) => {
      const reporterName = usernameMap.get(Number(report.reporter_id)) || null;
      const reportedName = usernameMap.get(Number(report.reported_user_id)) || null;
      const resolverName = usernameMap.get(Number(report.resolved_by)) || null;

      return {
        ...report,
        reporter_name: reporterName,
        reported_name: reportedName,
        resolver_name: resolverName,
        reporter_username: reporterName,
        reported_username: reportedName,
        resolver_username: resolverName,
      };
    })
    .sort((left, right) => {
      const leftReport = left as Record<string, unknown>;
      const rightReport = right as Record<string, unknown>;
      const leftRank = leftReport.status === 'pending' ? 0 : 1;
      const rightRank = rightReport.status === 'pending' ? 0 : 1;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return new Date(String(rightReport.created_at)).getTime()
        - new Date(String(leftReport.created_at)).getTime();
    });
};

export const setAdminReportStatus = async (actor: AdminActor, reportId: number, status: 'resolved' | 'closed') => {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('reports')
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: actor.id,
    })
    .eq('id', reportId);

  if (error) throw error;

  return {
    message: status === 'resolved' ? 'Report resolved' : 'Report closed',
  };
};

export const banAdminUser = async (actor: AdminActor, userId: number) => {
  if (userId === actor.id) {
    throw createHttpError('Cannot ban yourself', 400);
  }

  const admin = getSupabaseAdmin();
  const { data: target, error: targetError } = await admin
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) throw createHttpError('User not found', 404);
  if (target.role === 'owner') throw createHttpError('Cannot ban the owner', 403);
  if (target.role === 'admin' && actor.role !== 'owner') {
    throw createHttpError('Only owner can ban an admin', 403);
  }

  const { error: updateError } = await admin
    .from('users')
    .update({ is_banned: true })
    .eq('id', userId);

  if (updateError) throw updateError;

  return { message: 'User has been banned' };
};
