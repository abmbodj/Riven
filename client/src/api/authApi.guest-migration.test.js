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
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'supabase-token' } },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: 'aal1', nextLevel: 'aal1' },
          error: null,
        }),
        listFactors: vi.fn().mockResolvedValue({
          data: { all: [], totp: [] },
          error: null,
        }),
      },
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';

const encodeSegment = (value) => btoa(JSON.stringify(value))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const buildJwt = (payload) => [
  encodeSegment({ alg: 'HS256', typ: 'JWT' }),
  encodeSegment(payload),
  'signature',
].join('.');

const createSelectSingleChain = (data, error = null) => {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  return { select, single };
};

const createSelectEqChain = (data, error = null) => {
  const eq = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq };
};

const createInsertSelectSingleChain = (data, error = null) => {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert, select, single };
};

const createInsertResolved = (data = null, error = null) => {
  const insert = vi.fn().mockResolvedValue({ data, error });
  return { insert };
};

describe('authApi guest data migration via Supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn(() => {
      throw new Error('legacy auth fetch should not be called');
    });
  });

  it('migrates guest folders, tags, decks, cards, deck tags, and study sessions through Supabase', async () => {
    const userChain = createSelectSingleChain({
      id: 42,
      username: 'atlas',
      display_name: 'Atlas',
      email: 'atlas@example.com',
      share_code: 'ABCD1234',
      avatar: null,
      banner: null,
      bio: '',
      streak_data: '{}',
      pet_customization: '{}',
      role: 'user',
      is_admin: 0,
      created_at: '2026-03-14T18:00:00.000Z',
      two_fa_enabled: false,
      subscription_tier: 'free',
      simulate_free_tier: false,
      email_verified: true,
    });

    const existingTagsChain = createSelectEqChain([
      { id: 11, name: 'Biology' },
    ]);

    const folderInsert = createInsertSelectSingleChain({ id: 101 });
    const newTagInsert = createInsertSelectSingleChain({ id: 202 });
    const firstDeckInsert = createInsertSelectSingleChain({ id: 301 });
    const secondDeckInsert = createInsertSelectSingleChain({ id: 302 });
    const cardInsert = createInsertResolved();
    const deckTagsInsert = createInsertResolved();
    const studySessionInsert = createInsertResolved();

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return { select: userChain.select };
      }
      if (table === 'tags') {
        if (!existingTagsChain.select.mock.calls.length) {
          return { select: existingTagsChain.select };
        }
        return { insert: newTagInsert.insert };
      }
      if (table === 'folders') {
        return { insert: folderInsert.insert };
      }
      if (table === 'decks') {
        if (!firstDeckInsert.insert.mock.calls.length) {
          return { insert: firstDeckInsert.insert };
        }
        return { insert: secondDeckInsert.insert };
      }
      if (table === 'cards') {
        return { insert: cardInsert.insert };
      }
      if (table === 'deck_tags') {
        return { insert: deckTagsInsert.insert };
      }
      if (table === 'study_sessions') {
        return { insert: studySessionInsert.insert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await authApi.migrateGuestData({
      folders: [
        { id: 'folder-1', name: 'Imported', color: '#123456', icon: 'leaf', created_at: '2026-01-01T00:00:00.000Z' },
      ],
      tags: [
        { id: 'tag-existing', name: 'Biology', color: '#00ff00', is_preset: false, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'tag-new', name: 'History', color: '#ff0000', is_preset: false, created_at: '2026-01-02T00:00:00.000Z' },
        { id: 'tag-preset', name: 'Preset', color: '#cccccc', is_preset: true, created_at: '2026-01-03T00:00:00.000Z' },
      ],
      decks: [
        { id: 'deck-1', title: 'Deck One', description: 'First', folder_id: 'folder-1', created_at: '2026-01-04T00:00:00.000Z', last_studied: '2026-01-06T00:00:00.000Z' },
        { id: 'deck-2', title: 'Deck Two', description: '', folder_id: null, created_at: '2026-01-05T00:00:00.000Z', last_studied: null },
      ],
      cards: [
        { deck_id: 'deck-1', front: 'Q1', back: 'A1', position: 0, difficulty: 2, times_reviewed: 3, times_correct: 2, last_reviewed: '2026-01-07T00:00:00.000Z', next_review: '2026-01-08T00:00:00.000Z', created_at: '2026-01-04T00:00:00.000Z' },
        { deck_id: 'missing-deck', front: 'skip', back: 'skip' },
      ],
      deckTags: [
        { deck_id: 'deck-1', tag_id: 'tag-existing' },
        { deck_id: 'deck-1', tag_id: 'tag-new' },
        { deck_id: 'deck-2', tag_id: 'tag-preset' },
      ],
      studySessions: [
        { deck_id: 'deck-1', cards_studied: 12, cards_correct: 10, duration_seconds: 300, session_type: 'study', created_at: '2026-01-09T00:00:00.000Z' },
        { deck_id: 'missing-deck', cards_studied: 1 },
      ],
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(folderInsert.insert).toHaveBeenCalledWith({
      user_id: 42,
      name: 'Imported',
      color: '#123456',
      icon: 'leaf',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(existingTagsChain.eq).toHaveBeenCalledWith('user_id', 42);
    expect(newTagInsert.insert).toHaveBeenCalledWith({
      user_id: 42,
      name: 'History',
      color: '#ff0000',
      is_preset: false,
      created_at: '2026-01-02T00:00:00.000Z',
    });
    expect(firstDeckInsert.insert).toHaveBeenCalledWith({
      user_id: 42,
      title: 'Deck One',
      description: 'First',
      folder_id: 101,
      created_at: '2026-01-04T00:00:00.000Z',
      last_studied: '2026-01-06T00:00:00.000Z',
    });
    expect(secondDeckInsert.insert).toHaveBeenCalledWith({
      user_id: 42,
      title: 'Deck Two',
      description: '',
      folder_id: null,
      created_at: '2026-01-05T00:00:00.000Z',
      last_studied: null,
    });
    expect(cardInsert.insert).toHaveBeenCalledTimes(1);
    expect(cardInsert.insert).toHaveBeenCalledWith([{
      deck_id: 301,
      front: 'Q1',
      back: 'A1',
      position: 0,
      difficulty: 2,
      times_reviewed: 3,
      times_correct: 2,
      last_reviewed: '2026-01-07T00:00:00.000Z',
      next_review: '2026-01-08T00:00:00.000Z',
      created_at: '2026-01-04T00:00:00.000Z',
    }]);
    expect(deckTagsInsert.insert).toHaveBeenCalledWith([
      { deck_id: 301, tag_id: 11 },
      { deck_id: 301, tag_id: 202 },
    ]);
    expect(studySessionInsert.insert).toHaveBeenCalledTimes(1);
    expect(studySessionInsert.insert).toHaveBeenCalledWith([{
      deck_id: 301,
      cards_studied: 12,
      cards_correct: 10,
      duration_seconds: 300,
      session_type: 'study',
      created_at: '2026-01-09T00:00:00.000Z',
    }]);
    expect(result).toEqual({
      message: 'Guest data migrated successfully',
      imported: { folders: 1, tags: 1, decks: 2 },
    });
  });
});
