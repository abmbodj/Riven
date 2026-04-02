/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';

const buildJsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const buildTableMap = (tables) => {
  supabase.from.mockImplementation((tableName) => {
    const table = tables[tableName];
    if (!table) {
      throw new Error(`Unexpected table access: ${tableName}`);
    }
    return table;
  });
};

describe('authApi decks and study PostgREST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    authApi.setToken('supabase-token');
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({
      id: 42,
      email: 'decks@example.com',
      username: 'deckbuilder',
      avatar: '/avatar.png',
    }));
  });

  it('loads decks via Supabase and decorates them with tags and card counts', async () => {
    const deckOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 2, title: 'Chemistry', created_at: '2026-03-11T09:00:00.000Z' },
        { id: 1, title: 'Biology', created_at: '2026-03-12T09:00:00.000Z' },
      ],
      error: null,
    });
    const deckSelect = vi.fn().mockReturnValue({ order: deckOrder });

    const deckTagsIn = vi.fn().mockResolvedValue({
      data: [
        { deck_id: 1, tag_id: 10 },
        { deck_id: 1, tag_id: 11 },
      ],
      error: null,
    });
    const deckTagsSelect = vi.fn().mockReturnValue({ in: deckTagsIn });

    const cardsIn = vi.fn().mockResolvedValue({
      data: [
        { deck_id: 1 },
        { deck_id: 1 },
        { deck_id: 2 },
      ],
      error: null,
    });
    const cardsSelect = vi.fn().mockReturnValue({ in: cardsIn });

    const tagsIn = vi.fn().mockResolvedValue({
      data: [
        { id: 10, name: 'Exam', color: '#ff0000' },
        { id: 11, name: 'Lab', color: '#00ff00' },
      ],
      error: null,
    });
    const tagsSelect = vi.fn().mockReturnValue({ in: tagsIn });

    buildTableMap({
      decks: { select: deckSelect },
      deck_tags: { select: deckTagsSelect },
      cards: { select: cardsSelect },
      tags: { select: tagsSelect },
    });

    const decks = await authApi.getDecks();

    expect(deckSelect).toHaveBeenCalledWith('*');
    expect(deckTagsIn).toHaveBeenCalledWith('deck_id', [2, 1]);
    expect(cardsIn).toHaveBeenCalledWith('deck_id', [2, 1]);
    expect(tagsIn).toHaveBeenCalledWith('id', [10, 11]);
    expect(decks).toEqual([
      {
        id: 2,
        title: 'Chemistry',
        created_at: '2026-03-11T09:00:00.000Z',
        cardCount: 1,
        tags: [],
      },
      {
        id: 1,
        title: 'Biology',
        created_at: '2026-03-12T09:00:00.000Z',
        cardCount: 2,
        tags: [
          { id: 10, name: 'Exam', color: '#ff0000' },
          { id: 11, name: 'Lab', color: '#00ff00' },
        ],
      },
    ]);
  });

  it('creates decks with the current app user id and links selected tags', async () => {
    const deckSingle = vi.fn().mockResolvedValue({
      data: { id: 7, title: 'Organic Chemistry', description: 'Week 3', folder_id: 9, class_id: 'class-1' },
      error: null,
    });
    const deckSelect = vi.fn().mockReturnValue({ single: deckSingle });
    const deckInsert = vi.fn().mockReturnValue({ select: deckSelect });

    const tagInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    buildTableMap({
      decks: { insert: deckInsert },
      deck_tags: { insert: tagInsert },
    });

    const result = await authApi.createDeck('Organic Chemistry', 'Week 3', 9, [15, 16], 'class-1');

    expect(deckInsert).toHaveBeenCalledWith({
      user_id: 42,
      title: 'Organic Chemistry',
      description: 'Week 3',
      folder_id: 9,
      class_id: 'class-1',
    });
    expect(tagInsert).toHaveBeenCalledWith([
      { deck_id: 7, tag_id: 15 },
      { deck_id: 7, tag_id: 16 },
    ]);
    expect(result).toEqual({ id: 7, title: 'Organic Chemistry', description: 'Week 3', folder_id: 9, class_id: 'class-1' });
  });

  it('duplicates a deck by copying cards and deck tags into a new row', async () => {
    const deckEq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 5,
          user_id: 42,
          title: 'Neuro',
          description: 'Signals',
          folder_id: 12,
          class_id: 'class-2',
        },
        error: null,
      }),
    });
    const deckSelect = vi.fn().mockReturnValue({ eq: deckEq });

    const cardsOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 30, deck_id: 5, front: 'Axon', back: 'Impulse', front_image: null, back_image: null, position: 0 },
        { id: 31, deck_id: 5, front: 'Synapse', back: 'Signal gap', front_image: null, back_image: null, position: 1 },
      ],
      error: null,
    });
    const cardsEq = vi.fn().mockReturnValue({ order: cardsOrder });
    const cardsSelect = vi.fn().mockReturnValue({ eq: cardsEq });

    const deckTagsIn = vi.fn().mockResolvedValue({
      data: [
        { deck_id: 5, tag_id: 90 },
        { deck_id: 5, tag_id: 91 },
      ],
      error: null,
    });
    const deckTagsSelect = vi.fn().mockReturnValue({ in: deckTagsIn });

    const tagsIn = vi.fn().mockResolvedValue({
      data: [
        { id: 90, name: 'Signals', color: '#111111' },
        { id: 91, name: 'Brain', color: '#222222' },
      ],
      error: null,
    });
    const tagsSelect = vi.fn().mockReturnValue({ in: tagsIn });

    const createSingle = vi.fn().mockResolvedValue({
      data: { id: 12, title: 'Neuro (Copy)', description: 'Signals', folder_id: 12, class_id: 'class-2' },
      error: null,
    });
    const createSelect = vi.fn().mockReturnValue({ single: createSingle });
    const createInsert = vi.fn().mockReturnValue({ select: createSelect });

    const copiedCardsInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const copiedDeckTagsInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    supabase.from
      .mockReturnValueOnce({ select: deckSelect })
      .mockReturnValueOnce({ select: cardsSelect })
      .mockReturnValueOnce({ select: deckTagsSelect })
      .mockReturnValueOnce({ select: tagsSelect })
      .mockReturnValueOnce({ insert: createInsert })
      .mockReturnValueOnce({ insert: copiedCardsInsert })
      .mockReturnValueOnce({ insert: copiedDeckTagsInsert });

    const result = await authApi.duplicateDeck(5);

    expect(createInsert).toHaveBeenCalledWith({
      user_id: 42,
      title: 'Neuro (Copy)',
      description: 'Signals',
      folder_id: 12,
      class_id: 'class-2',
    });
    expect(copiedCardsInsert).toHaveBeenCalledWith([
      { deck_id: 12, front: 'Axon', back: 'Impulse', front_image: null, back_image: null, position: 0 },
      { deck_id: 12, front: 'Synapse', back: 'Signal gap', front_image: null, back_image: null, position: 1 },
    ]);
    expect(copiedDeckTagsInsert).toHaveBeenCalledWith([
      { deck_id: 12, tag_id: 90 },
      { deck_id: 12, tag_id: 91 },
    ]);
    expect(result).toEqual({ id: 12, title: 'Neuro (Copy)', description: 'Signals', folder_id: 12, class_id: 'class-2' });
  });

  it('reviews cards by updating FSRS fields and next review date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00.000Z'));

    const selectEq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 88,
          difficulty: 2,
          card_state: 'new',
          stability: 0,
          fsrs_difficulty: 5.0,
          reps: 0,
          lapses: 0,
          times_reviewed: 4,
          times_correct: 3,
          created_at: '2026-03-01T00:00:00.000Z',
        },
        error: null,
      }),
    });
    const select = vi.fn().mockReturnValue({ eq: selectEq });

    const updateSingle = vi.fn().mockResolvedValue({
      data: { id: 88 },
      error: null,
    });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    supabase.from
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ update });

    await authApi.reviewCard(88, 4); // Rating.Easy

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      times_reviewed: 5,
      times_correct: 4,
      last_reviewed: '2026-03-13T12:00:00.000Z',
    }));
    // FSRS fields should be present
    const updateArg = update.mock.calls[0][0];
    expect(updateArg).toHaveProperty('stability');
    expect(updateArg).toHaveProperty('fsrs_difficulty');
    expect(updateArg).toHaveProperty('card_state');
    expect(updateArg).toHaveProperty('next_review');
    expect(updateArg.stability).toBeGreaterThan(0);
    expect(updateEq).toHaveBeenCalledWith('id', 88);

    vi.useRealTimers();
  });

  it('stores study sessions and derives deck stats from Supabase rows', async () => {
    sessionStorage.setItem('riven:weekly-summary:UTC', JSON.stringify({
      expiresAt: Date.now() + 1000,
      value: { cards_studied: 99 },
    }));

    const sessionSingle = vi.fn().mockResolvedValue({
      data: {
        id: 501,
        deck_id: 7,
        cards_studied: 12,
        cards_correct: 9,
        duration_seconds: 480,
        session_type: 'study',
      },
      error: null,
    });
    const sessionSelect = vi.fn().mockReturnValue({ single: sessionSingle });
    const sessionInsert = vi.fn().mockReturnValue({ select: sessionSelect });

    const deckEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const deckUpdate = vi.fn().mockReturnValue({ eq: deckEq });

    const statsSessionOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 3, deck_id: 7, cards_studied: 8, cards_correct: 7, duration_seconds: 200, created_at: '2026-03-13T12:00:00.000Z' },
        { id: 2, deck_id: 7, cards_studied: 10, cards_correct: 8, duration_seconds: 300, created_at: '2026-03-12T12:00:00.000Z' },
        { id: 1, deck_id: 7, cards_studied: 5, cards_correct: 2, duration_seconds: 120, created_at: '2026-03-11T12:00:00.000Z' },
      ],
      error: null,
    });
    const statsSessionEq = vi.fn().mockReturnValue({ order: statsSessionOrder });
    const statsSessionSelect = vi.fn().mockReturnValue({ eq: statsSessionEq });

    const statsCardsEq = vi.fn().mockResolvedValue({
      data: [
        { id: 10, card_state: 'new', stability: 0, times_reviewed: 0, times_correct: 0 },
        { id: 11, card_state: 'learning', stability: 3, times_reviewed: 3, times_correct: 1 },
        { id: 12, card_state: 'review', stability: 14, times_reviewed: 6, times_correct: 4 },
        { id: 13, card_state: 'review', stability: 30, times_reviewed: 9, times_correct: 6 },
      ],
      error: null,
    });
    const statsCardsSelect = vi.fn().mockReturnValue({ eq: statsCardsEq });

    supabase.from
      .mockReturnValueOnce({ insert: sessionInsert })
      .mockReturnValueOnce({ update: deckUpdate })
      .mockReturnValueOnce({ select: statsSessionSelect })
      .mockReturnValueOnce({ select: statsCardsSelect });

    const savedSession = await authApi.saveStudySession(7, 12, 9, 480, 'study');
    const stats = await authApi.getDeckStats(7);

    expect(sessionInsert).toHaveBeenCalledWith({
      deck_id: 7,
      cards_studied: 12,
      cards_correct: 9,
      duration_seconds: 480,
      session_type: 'study',
    });
    expect(deckUpdate).toHaveBeenCalledWith({ last_studied: expect.any(String) });
    expect(deckEq).toHaveBeenCalledWith('id', 7);
    expect(savedSession).toEqual({
      id: 501,
      deck_id: 7,
      cards_studied: 12,
      cards_correct: 9,
      duration_seconds: 480,
      session_type: 'study',
    });
    expect(sessionStorage.getItem('riven:weekly-summary:UTC')).toBeNull();
    expect(stats).toEqual({
      totalSessions: 3,
      totalCardsStudied: 23,
      totalStudied: 23,
      totalCorrect: 17,
      accuracy: 74,
      totalTimeSeconds: 620,
      totalTime: 620,
      cardCount: 4,
      masteredCount: 1,
      cardsByDifficulty: {
        new: 1,
        learning: 1,
        familiar: 1,
        mastered: 1,
      },
      recentSessions: [
        { id: 3, deck_id: 7, cards_studied: 8, cards_correct: 7, duration_seconds: 200, created_at: '2026-03-13T12:00:00.000Z' },
        { id: 2, deck_id: 7, cards_studied: 10, cards_correct: 8, duration_seconds: 300, created_at: '2026-03-12T12:00:00.000Z' },
        { id: 1, deck_id: 7, cards_studied: 5, cards_correct: 2, duration_seconds: 120, created_at: '2026-03-11T12:00:00.000Z' },
      ],
    });
  });

  it('aggregates a weekly summary from Supabase study sessions and reuses the cached response', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z'));

    const deckEq = vi.fn().mockResolvedValue({
      data: [{ id: 7 }, { id: 9 }],
      error: null,
    });
    const deckSelect = vi.fn().mockReturnValue({ eq: deckEq });

    const sessionOrder = vi.fn().mockResolvedValue({
      data: [
        { cards_studied: 5, cards_correct: 4, duration_seconds: 1800, created_at: '2026-03-20T13:00:00.000Z' },
        { cards_studied: 7, cards_correct: 6, duration_seconds: 2400, created_at: '2026-03-21T09:00:00.000Z' },
      ],
      error: null,
    });
    const sessionGte = vi.fn().mockReturnValue({ order: sessionOrder });
    const sessionIn = vi.fn().mockReturnValue({ gte: sessionGte });
    const sessionSelect = vi.fn().mockReturnValue({ in: sessionIn });

    supabase.from
      .mockReturnValueOnce({ select: deckSelect })
      .mockReturnValueOnce({ select: sessionSelect });

    const summary = await authApi.getWeeklySummary('UTC');

    expect(deckEq).toHaveBeenCalledWith('user_id', 42);
    expect(sessionIn).toHaveBeenCalledWith('deck_id', [7, 9]);
    expect(summary.cards_studied).toBe(12);
    expect(summary.accuracy).toBeCloseTo(10 / 12);
    expect(summary.total_minutes).toBe(70);
    expect(summary.daily_breakdown).toHaveLength(7);
    expect(summary.daily_breakdown.at(-2)).toMatchObject({ date: '2026-03-20', cards: 5, studied: true });
    expect(summary.daily_breakdown.at(-1)).toMatchObject({ date: '2026-03-21', cards: 7, studied: true, is_today: true });

    supabase.from.mockClear();
    const cachedSummary = await authApi.getWeeklySummary('UTC');
    expect(supabase.from).not.toHaveBeenCalled();
    expect(cachedSummary).toEqual(summary);

    vi.useRealTimers();
  });

  it('returns an empty seven-day weekly summary when the user has no owned decks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z'));

    const deckEq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const deckSelect = vi.fn().mockReturnValue({ eq: deckEq });

    supabase.from.mockReturnValueOnce({ select: deckSelect });

    const summary = await authApi.getWeeklySummary('UTC');

    expect(summary).toMatchObject({
      cards_studied: 0,
      accuracy: null,
      total_minutes: 0,
    });
    expect(summary.daily_breakdown).toHaveLength(7);
    expect(summary.daily_breakdown.every((day) => day.cards === 0 && day.studied === false)).toBe(true);

    vi.useRealTimers();
  });
});
