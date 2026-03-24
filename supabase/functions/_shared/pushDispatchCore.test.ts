import {
  buildInactivityPushPayload,
  buildMessagePushBody,
  buildMessagePushPayload,
  getInactivityReminderDecision,
  getMostRecentLastSeenAt,
  getStreakReminderDecision,
  normalizePushPreferences,
} from './pushDispatchCore.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEquals = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};

Deno.test('normalizePushPreferences falls back to enabled defaults', () => {
  assertEquals(
    normalizePushPreferences(null),
    {
      messagesEnabled: true,
      streakEnabled: true,
      reengagementEnabled: true,
    },
    'Expected defaults when no preference row exists',
  );
});

Deno.test('buildMessagePushBody formats preview text and shared-resource labels', () => {
  assertEquals(
    buildMessagePushBody({ message_type: 'text', content: '  Midterm moved to Friday  ' }),
    'Midterm moved to Friday',
    'Expected trimmed text preview for plain messages',
  );

  assertEquals(
    buildMessagePushBody({ message_type: 'deck', content: '' }),
    'shared a deck.',
    'Expected shared deck copy for deck messages',
  );

  assertEquals(
    buildMessagePushBody({ message_type: 'image', content: '' }),
    'sent a photo.',
    'Expected photo copy for image messages',
  );
});

Deno.test('buildMessagePushPayload links to the sender conversation', () => {
  assertEquals(
    buildMessagePushPayload({
      senderId: 12,
      senderUsername: 'bianca',
      message: { message_type: 'text', content: 'Quiz at 2?' },
    }),
    {
      kind: 'message',
      route: '/messages/12',
      senderId: '12',
      title: 'bianca',
      body: 'Quiz at 2?',
    },
    'Expected a message push payload with route and sender metadata',
  );
});

Deno.test('getMostRecentLastSeenAt returns the freshest device heartbeat', () => {
  const result = getMostRecentLastSeenAt([
    { last_seen_at: '2026-03-20T10:00:00.000Z' },
    { last_seen_at: '2026-03-23T08:00:00.000Z' },
    { last_seen_at: '2026-03-21T12:00:00.000Z' },
  ]);

  if (!(result instanceof Date)) {
    throw new Error('Expected a Date result');
  }
  assertEquals(
    result.toISOString(),
    '2026-03-23T08:00:00.000Z',
    'Expected the most recent device heartbeat',
  );
});

Deno.test('getInactivityReminderDecision resets once activity is fresh again', () => {
  assertEquals(
    getInactivityReminderDecision({
      lastSeenAt: '2026-03-21T12:00:00.000Z',
      lastStageSent: 7,
      now: new Date('2026-03-23T11:59:59.000Z'),
    }),
    {
      shouldReset: true,
      stageToSend: null,
    },
    'Expected a reset when the last-seen timestamp is under 3 days old',
  );
});

Deno.test('getInactivityReminderDecision sends the highest newly reached stage', () => {
  assertEquals(
    getInactivityReminderDecision({
      lastSeenAt: '2026-03-10T12:00:00.000Z',
      lastStageSent: 3,
      now: new Date('2026-03-23T12:00:00.000Z'),
    }),
    {
      shouldReset: false,
      stageToSend: 7,
    },
    'Expected the next unsent inactivity stage',
  );
});

Deno.test('buildInactivityPushPayload returns a dashboard nudge', () => {
  assertEquals(
    buildInactivityPushPayload(14),
    {
      kind: 'reengagement',
      route: '/dashboard',
      title: 'Your study flow is waiting',
      body: 'Jump back in with one small review session today.',
    },
    'Expected the long-gap inactivity copy',
  );
});

Deno.test('getStreakReminderDecision sends once per streak deadline marker', () => {
  const firstResult = getStreakReminderDecision({
    streakData: {
      currentStreak: 9,
      lastStudyDate: '2026-03-22T18:00:00.000Z',
    },
    lastMarker: null,
    now: new Date('2026-03-23T18:30:00.000Z'),
  });

  assert(firstResult.payload, 'Expected a streak reminder payload inside the at-risk window');
  assertEquals(firstResult.marker, '2026-03-24T18:00:00.000Z', 'Expected the deadline marker');

  const duplicateResult = getStreakReminderDecision({
    streakData: {
      currentStreak: 9,
      lastStudyDate: '2026-03-22T18:00:00.000Z',
    },
    lastMarker: '2026-03-24T18:00:00.000Z',
    now: new Date('2026-03-23T18:30:00.000Z'),
  });

  assertEquals(
    duplicateResult,
    {
      shouldReset: false,
      marker: '2026-03-24T18:00:00.000Z',
      payload: null,
    },
    'Expected duplicate streak reminders to be suppressed by marker',
  );
});
