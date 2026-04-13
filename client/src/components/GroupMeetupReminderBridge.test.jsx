/* @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GroupMeetupReminderBridge from './GroupMeetupReminderBridge.jsx';

const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    show: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock('../api', () => ({
  api: {
    listJoinedGroupMeetups: vi.fn(),
    getGroups: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: true,
    loading: false,
    user: { id: 'user-1' },
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => mockToast,
}));

vi.mock('../api/authApi', () => ({
  subscribeToGroupMeetupEvents: vi.fn(() => () => {}),
}));

const { api } = await import('../api');

describe('GroupMeetupReminderBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getGroups.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('logs and swallows joined meetup fetch failures', async () => {
    vi.useRealTimers();
    const error = new Error('network blew up');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.listJoinedGroupMeetups.mockRejectedValueOnce(error);

    render(<GroupMeetupReminderBridge />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('GroupMeetupReminderBridge.syncMeetupReminders failed', error);
    });

    expect(mockToast.show).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('caps reminder timeouts at the browser maximum delay', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const futureStart = new Date(Date.now() + (29 * 24 * 60 * 60 * 1000));

    api.listJoinedGroupMeetups.mockResolvedValueOnce([
      {
        id: 'meetup-1',
        meetup_id: 'meetup-1',
        topic: 'Final review',
        group_name: 'Biology Lab',
        start_at: futureStart.toISOString(),
      },
    ]);

    render(<GroupMeetupReminderBridge />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(
      setTimeoutSpy.mock.calls.some(([, delay]) => delay === 2_147_483_647),
    ).toBe(true);
  });
});
