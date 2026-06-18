const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

export const DEFAULT_PUSH_PREFERENCES = Object.freeze({
  messagesEnabled: true,
  streakEnabled: true,
  reengagementEnabled: true,
});

export const INACTIVITY_DAY_THRESHOLDS = Object.freeze([3, 7, 14]);

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const sanitizePreviewText = (value: unknown) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim();

const coerceBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

export const normalizePushPreferences = (row: Record<string, unknown> | null | undefined) => ({
  messagesEnabled: coerceBoolean(row?.messages_enabled ?? row?.messagesEnabled, DEFAULT_PUSH_PREFERENCES.messagesEnabled),
  streakEnabled: coerceBoolean(row?.streak_enabled ?? row?.streakEnabled, DEFAULT_PUSH_PREFERENCES.streakEnabled),
  reengagementEnabled: coerceBoolean(
    row?.reengagement_enabled ?? row?.reengagementEnabled,
    DEFAULT_PUSH_PREFERENCES.reengagementEnabled,
  ),
});

export const buildMessagePushBody = (message: {
  content?: unknown;
  message_type?: unknown;
  messageType?: unknown;
  image_url?: unknown;
  imageUrl?: unknown;
}) => {
  const messageType = String(message.message_type ?? message.messageType ?? 'text').toLowerCase();

  if (message.image_url || message.imageUrl || messageType === 'image') {
    return 'sent a photo.';
  }

  if (messageType === 'deck') return 'shared a deck.';
  if (messageType === 'note') return 'shared a note.';
  if (messageType === 'guide') return 'shared a guide.';

  const preview = sanitizePreviewText(message.content);
  if (!preview) {
    return 'sent you a message.';
  }

  return preview.length > 120 ? `${preview.slice(0, 117).trimEnd()}...` : preview;
};

export const buildMessagePushPayload = ({
  senderId,
  senderUsername,
  message,
}: {
  senderId: number;
  senderUsername?: string | null;
  message: {
    content?: unknown;
    message_type?: unknown;
    image_url?: unknown;
  };
}) => ({
  kind: 'message',
  route: `/messages/${senderId}`,
  senderId: String(senderId),
  title: senderUsername || 'New message',
  body: buildMessagePushBody(message),
});

export const buildGroupMeetupPushPayload = ({
  eventType,
  groupId,
  groupName,
  topic,
  actorName,
}: {
  eventType: string;
  groupId: string | number;
  groupName?: string | null;
  topic?: string | null;
  actorName?: string | null;
}) => {
  const who = sanitizePreviewText(actorName) || 'Someone';
  const what = sanitizePreviewText(topic) || 'a study session';
  const where = sanitizePreviewText(groupName);
  const isCancelled = eventType === 'cancelled';

  return {
    kind: 'group_meetup',
    route: `/groups/${groupId}`,
    title: where || (isCancelled ? 'Session cancelled' : 'New study session'),
    body: isCancelled
      ? `${who} cancelled "${what}".`
      : `${who} proposed "${what}".`,
  };
};

export const getMostRecentLastSeenAt = (
  devices: Array<{ last_seen_at?: string | null; lastSeenAt?: string | null }>,
): Date | null => {
  let mostRecent: Date | null = null;

  devices.forEach((device) => {
    const parsed = parseDate(device.last_seen_at ?? device.lastSeenAt ?? null);
    if (!parsed) return;
    if (!mostRecent || parsed.getTime() > mostRecent.getTime()) {
      mostRecent = parsed;
    }
  });

  return mostRecent;
};

export const getInactivityReminderDecision = ({
  lastSeenAt,
  lastStageSent,
  now = new Date(),
}: {
  lastSeenAt?: string | Date | null;
  lastStageSent?: number | null;
  now?: Date;
}) => {
  const mostRecentSeenAt = parseDate(lastSeenAt);

  if (!mostRecentSeenAt) {
    return {
      shouldReset: false,
      stageToSend: null,
    };
  }

  const daysInactive = (now.getTime() - mostRecentSeenAt.getTime()) / DAY_IN_MS;

  if (daysInactive < INACTIVITY_DAY_THRESHOLDS[0]) {
    return {
      shouldReset: true,
      stageToSend: null,
    };
  }

  const highestReachedStage = [...INACTIVITY_DAY_THRESHOLDS]
    .reverse()
    .find((threshold) => daysInactive >= threshold) ?? null;

  if (!highestReachedStage || highestReachedStage <= Number(lastStageSent || 0)) {
    return {
      shouldReset: false,
      stageToSend: null,
    };
  }

  return {
    shouldReset: false,
    stageToSend: highestReachedStage,
  };
};

export const buildInactivityPushPayload = (stage: number) => {
  if (stage >= 14) {
    return {
      kind: 'reengagement',
      route: '/dashboard',
      title: 'Your study flow is waiting',
      body: 'Jump back in with one small review session today.',
    };
  }

  if (stage >= 7) {
    return {
      kind: 'reengagement',
      route: '/dashboard',
      title: 'A quick session can restart the rhythm',
      body: 'Open Riven and pick up where you left off.',
    };
  }

  return {
    kind: 'reengagement',
    route: '/dashboard',
    title: 'Ready for a quick comeback?',
    body: 'A few cards is enough to get moving again.',
  };
};

export const getStreakReminderDecision = ({
  streakData,
  lastMarker,
  now = new Date(),
}: {
  streakData: Record<string, unknown> | null | undefined;
  lastMarker?: string | null;
  now?: Date;
}) => {
  const currentStreak = Number(streakData?.currentStreak ?? 0);
  const lastStudyDate = parseDate(streakData?.lastStudyDate ?? null);

  if (!currentStreak || !lastStudyDate) {
    return {
      shouldReset: true,
      marker: null,
      payload: null,
    };
  }

  const deadline = new Date(lastStudyDate.getTime() + (2 * DAY_IN_MS));
  const msUntilBreak = deadline.getTime() - now.getTime();

  if (msUntilBreak <= 0 || msUntilBreak > DAY_IN_MS) {
    return {
      shouldReset: true,
      marker: null,
      payload: null,
    };
  }

  const marker = deadline.toISOString();
  if (lastMarker === marker) {
    return {
      shouldReset: false,
      marker,
      payload: null,
    };
  }

  const hoursRemaining = Math.max(1, Math.ceil(msUntilBreak / HOUR_IN_MS));
  const body = hoursRemaining <= 6
    ? 'Study once today to keep your garden growing.'
    : `${hoursRemaining} hours left to keep your streak alive.`;

  return {
    shouldReset: false,
    marker,
    payload: {
      kind: 'streak',
      route: '/garden',
      title: 'Your streak is at risk',
      body,
    },
  };
};
