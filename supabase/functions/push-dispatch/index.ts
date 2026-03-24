import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import {
  buildInactivityPushPayload,
  buildMessagePushPayload,
  getInactivityReminderDecision,
  getMostRecentLastSeenAt,
  getStreakReminderDecision,
  normalizePushPreferences,
} from '../_shared/pushDispatchCore.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const FUNCTION_NAME = 'push-dispatch';
const APNS_HOST = 'https://api.push.apple.com';

type DeviceRow = {
  id: string;
  user_id: number;
  push_token: string | null;
  last_seen_at: string | null;
};

type MessageRow = {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string | null;
  message_type: string | null;
  image_url: string | null;
};

type PushPayload = {
  kind: string;
  route: string;
  title: string;
  body: string;
  senderId?: string;
};

type EngagementStateRow = {
  user_id: number;
  last_streak_reminder_marker: string | null;
  last_inactivity_stage_sent: number | null;
};

let cachedApnsToken: { token: string; expiresAt: number } | null = null;
let cachedPrivateKey: CryptoKey | null = null;

const textEncoder = new TextEncoder();

const base64UrlEncode = (value: string | Uint8Array) => {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : value;
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemToArrayBuffer = (pem: string) => {
  const normalized = pem
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer;
};

const derToJose = (der: Uint8Array, joseSize: number) => {
  if (der[0] !== 0x30) {
    throw new Error('Invalid DER signature');
  }

  let offset = 2;
  if (der[1] & 0x80) {
    offset = 2 + (der[1] & 0x7f);
  }

  if (der[offset] !== 0x02) {
    throw new Error('Invalid DER signature');
  }

  const rLength = der[offset + 1];
  const rOffset = offset + 2;
  const sMarkerOffset = rOffset + rLength;

  if (der[sMarkerOffset] !== 0x02) {
    throw new Error('Invalid DER signature');
  }

  const sLength = der[sMarkerOffset + 1];
  const sOffset = sMarkerOffset + 2;

  const r = der.slice(rOffset, rOffset + rLength);
  const s = der.slice(sOffset, sOffset + sLength);

  const output = new Uint8Array(joseSize);
  output.set(r.slice(Math.max(0, r.length - (joseSize / 2))), (joseSize / 2) - Math.min(r.length, joseSize / 2));
  output.set(s.slice(Math.max(0, s.length - (joseSize / 2))), joseSize - Math.min(s.length, joseSize / 2));
  return output;
};

const getRequiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const getPushDispatchSecret = () => getRequiredEnv('PUSH_DISPATCH_SECRET');

const parseStreakData = (value: unknown) => {
  if (!value) return {};

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return {};
};

const getApnsPrivateKey = async () => {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }

  const privateKeyPem = getRequiredEnv('APNS_PRIVATE_KEY');
  cachedPrivateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign'],
  );

  return cachedPrivateKey;
};

const createApnsJwt = async () => {
  if (cachedApnsToken && cachedApnsToken.expiresAt > Date.now() + (60 * 1000)) {
    return cachedApnsToken.token;
  }

  const keyId = getRequiredEnv('APNS_KEY_ID');
  const teamId = getRequiredEnv('APNS_TEAM_ID');
  const privateKey = await getApnsPrivateKey();

  const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
  }));
  const signingInput = `${header}.${payload}`;

  const derSignature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    textEncoder.encode(signingInput),
  ));
  const signature = base64UrlEncode(derToJose(derSignature, 64));
  const token = `${signingInput}.${signature}`;

  cachedApnsToken = {
    token,
    expiresAt: Date.now() + (50 * 60 * 1000),
  };

  return token;
};

const deactivateInvalidTokens = async (tokens: string[]) => {
  if (!tokens.length) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('user_push_devices')
    .update({ is_active: false })
    .in('push_token', tokens);

  if (error) {
    throw error;
  }
};

const sendPushToTokens = async (tokens: string[], payload: PushPayload) => {
  if (!tokens.length) {
    return { delivered: 0, invalidTokens: [] as string[] };
  }

  const authToken = await createApnsJwt();
  const topic = getRequiredEnv('APNS_BUNDLE_ID');
  const invalidTokens: string[] = [];
  let delivered = 0;

  const requestBody = JSON.stringify({
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: 'default',
    },
    kind: payload.kind,
    route: payload.route,
    ...(payload.senderId ? { senderId: payload.senderId } : {}),
  });

  await Promise.all(tokens.map(async (token) => {
    const response = await fetch(`${APNS_HOST}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${authToken}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: requestBody,
    });

    if (response.ok) {
      delivered += 1;
      return;
    }

    const body = await response.json().catch(() => ({}));
    const reason = String(body?.reason || '');
    if (response.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
      invalidTokens.push(token);
      return;
    }

    throw new Error(`APNs request failed (${response.status}): ${reason || 'Unknown error'}`);
  }));

  if (invalidTokens.length) {
    await deactivateInvalidTokens(invalidTokens);
  }

  return { delivered, invalidTokens };
};

const fetchActiveIosDevicesForUser = async (userId: number) => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_push_devices')
    .select('id, user_id, push_token, last_seen_at')
    .eq('user_id', userId)
    .eq('platform', 'ios')
    .eq('is_active', true)
    .not('push_token', 'is', null);

  if (error) throw error;
  return (data || []) as DeviceRow[];
};

const fetchPushPreferencesForUser = async (userId: number) => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_push_preferences')
    .select('messages_enabled, streak_enabled, reengagement_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return normalizePushPreferences(data as Record<string, unknown> | null);
};

const upsertEngagementState = async (userId: number, patch: {
  last_streak_reminder_marker?: string | null;
  last_inactivity_stage_sent?: number | null;
}) => {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('user_push_engagement_state')
    .upsert({
      user_id: userId,
      ...patch,
    }, { onConflict: 'user_id' });

  if (error) throw error;
};

const handleMessageCreated = async (messageId: number) => {
  const admin = getSupabaseAdmin();
  const { data: message, error: messageError } = await admin
    .from('messages')
    .select('id, sender_id, receiver_id, content, message_type, image_url')
    .eq('id', messageId)
    .maybeSingle();

  if (messageError) throw messageError;
  if (!message) {
    return { delivered: 0, reason: 'message_not_found' };
  }

  const [preferences, devices, senderResult] = await Promise.all([
    fetchPushPreferencesForUser(Number((message as MessageRow).receiver_id)),
    fetchActiveIosDevicesForUser(Number((message as MessageRow).receiver_id)),
    admin
      .from('users')
      .select('username')
      .eq('id', Number((message as MessageRow).sender_id))
      .maybeSingle(),
  ]);

  if (!preferences.messagesEnabled) {
    return { delivered: 0, reason: 'messages_disabled' };
  }

  const uniqueTokens = Array.from(new Set(
    devices
      .map((device) => device.push_token)
      .filter((token): token is string => Boolean(token)),
  ));

  if (!uniqueTokens.length) {
    return { delivered: 0, reason: 'no_active_tokens' };
  }

  const payload = buildMessagePushPayload({
    senderId: Number((message as MessageRow).sender_id),
    senderUsername: senderResult.data?.username ?? null,
    message: message as MessageRow,
  });
  return sendPushToTokens(uniqueTokens, payload);
};

const fetchGroupedDevices = async () => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('user_push_devices')
    .select('id, user_id, push_token, last_seen_at')
    .eq('platform', 'ios')
    .eq('is_active', true)
    .not('push_token', 'is', null);

  if (error) throw error;

  const grouped = new Map<number, DeviceRow[]>();
  ((data || []) as DeviceRow[]).forEach((device) => {
    const userId = Number(device.user_id);
    const existing = grouped.get(userId) || [];
    existing.push(device);
    grouped.set(userId, existing);
  });

  return grouped;
};

const handleReengagementScan = async () => {
  const admin = getSupabaseAdmin();
  const groupedDevices = await fetchGroupedDevices();
  const userIds = [...groupedDevices.keys()];

  if (!userIds.length) {
    return { scannedUsers: 0, delivered: 0 };
  }

  const [
    { data: users, error: usersError },
    { data: preferencesRows, error: preferencesError },
    { data: stateRows, error: stateError },
  ] = await Promise.all([
    admin.from('users').select('id, streak_data').in('id', userIds),
    admin.from('user_push_preferences').select('user_id, messages_enabled, streak_enabled, reengagement_enabled').in('user_id', userIds),
    admin.from('user_push_engagement_state').select('user_id, last_streak_reminder_marker, last_inactivity_stage_sent').in('user_id', userIds),
  ]);

  if (usersError) throw usersError;
  if (preferencesError) throw preferencesError;
  if (stateError) throw stateError;

  const preferencesByUser = new Map<number, ReturnType<typeof normalizePushPreferences>>();
  ((preferencesRows || []) as Array<Record<string, unknown>>).forEach((row) => {
    preferencesByUser.set(Number(row.user_id), normalizePushPreferences(row));
  });

  const stateByUser = new Map<number, EngagementStateRow>();
  ((stateRows || []) as EngagementStateRow[]).forEach((row) => {
    stateByUser.set(Number(row.user_id), row);
  });

  let delivered = 0;

  for (const user of (users || []) as Array<Record<string, unknown>>) {
    const userId = Number(user.id);
    const devices = groupedDevices.get(userId) || [];
    const uniqueTokens = Array.from(new Set(
      devices
        .map((device) => device.push_token)
        .filter((token): token is string => Boolean(token)),
    ));

    if (!uniqueTokens.length) {
      continue;
    }

    const preferences = preferencesByUser.get(userId) || normalizePushPreferences(null);
    const currentState = stateByUser.get(userId) || {
      user_id: userId,
      last_streak_reminder_marker: null,
      last_inactivity_stage_sent: null,
    };
    const nextState = {
      last_streak_reminder_marker: currentState.last_streak_reminder_marker,
      last_inactivity_stage_sent: currentState.last_inactivity_stage_sent,
    };
    let stateChanged = false;

    const mostRecentSeenAt = getMostRecentLastSeenAt(devices);
    const inactivityDecision = getInactivityReminderDecision({
      lastSeenAt: mostRecentSeenAt,
      lastStageSent: currentState.last_inactivity_stage_sent,
    });

    if (inactivityDecision.shouldReset && nextState.last_inactivity_stage_sent !== null) {
      nextState.last_inactivity_stage_sent = null;
      stateChanged = true;
    }

    const streakData = parseStreakData(user.streak_data);
    const streakDecision = getStreakReminderDecision({
      streakData,
      lastMarker: currentState.last_streak_reminder_marker,
    });

    if (streakDecision.shouldReset && nextState.last_streak_reminder_marker !== null) {
      nextState.last_streak_reminder_marker = null;
      stateChanged = true;
    }

    if (preferences.streakEnabled && streakDecision.payload) {
      const result = await sendPushToTokens(uniqueTokens, streakDecision.payload);
      delivered += result.delivered;

      if (result.delivered > 0 && streakDecision.marker !== nextState.last_streak_reminder_marker) {
        nextState.last_streak_reminder_marker = streakDecision.marker;
        stateChanged = true;
      }
    }

    if (preferences.reengagementEnabled && inactivityDecision.stageToSend) {
      const inactivityPayload = buildInactivityPushPayload(inactivityDecision.stageToSend);
      const result = await sendPushToTokens(uniqueTokens, inactivityPayload);
      delivered += result.delivered;

      if (result.delivered > 0 && nextState.last_inactivity_stage_sent !== inactivityDecision.stageToSend) {
        nextState.last_inactivity_stage_sent = inactivityDecision.stageToSend;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      await upsertEngagementState(userId, nextState);
    }
  }

  return {
    scannedUsers: userIds.length,
    delivered,
  };
};

const authorizeInternalRequest = (request: Request) => {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token || token !== getPushDispatchSecret()) {
    const error = new Error('Unauthorized');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    authorizeInternalRequest(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'message_created') {
      const messageId = Number(body?.messageId);
      if (!Number.isInteger(messageId) || messageId <= 0) {
        return jsonResponse({ error: 'messageId must be a valid id' }, { status: 400 }, request);
      }

      return jsonResponse(await handleMessageCreated(messageId), {}, request);
    }

    if (action === 'reengagement_scan') {
      return jsonResponse(await handleReengagementScan(), {}, request);
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 }, request);
  } catch (error) {
    const requestError = normalizeRequestError(error);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    if (status >= 500) {
      await reportEdgeException(requestError, {
        request,
        functionName: FUNCTION_NAME,
        extras: {
          message: requestError.message,
        },
      });
    }

    console.error(`[${FUNCTION_NAME}]`, requestError);
    return jsonResponse(
      { error: requestError.message || 'Internal server error' },
      { status },
      request,
    );
  }
});
