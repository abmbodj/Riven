/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/authApi', () => ({
  getToken: vi.fn(),
  getClasses: vi.fn(),
}));

import { api } from './api';
import { cache } from './utils/cache';
import { calendarKeys } from './utils/calendarCacheKeys';
import * as serverApi from './api/authApi';

describe('calendar API cache seeding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
    sessionStorage.clear();
    serverApi.getToken.mockReturnValue('supabase-token');
  });

  it('persists classes under the calendar class seed key', async () => {
    const classes = [{ id: 101, name: 'Biology', is_archived: false }];
    serverApi.getClasses.mockResolvedValue(classes);

    await expect(api.getClasses()).resolves.toEqual(classes);

    expect(cache.peek(calendarKeys.classes())).toEqual(classes);
  });
});
