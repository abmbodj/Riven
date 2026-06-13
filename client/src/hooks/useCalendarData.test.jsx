/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalendarData } from './useCalendarData';
import { cache } from '../utils/cache';
import { calendarKeys } from '../utils/calendarCacheKeys';

vi.mock('../api', () => ({
  api: {
    getAssignments: vi.fn(),
    getClasses: vi.fn(),
    getSchedule: vi.fn(),
    getGroupScheduleCalendar: vi.fn(),
  },
}));

import { api } from '../api';

describe('useCalendarData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
    sessionStorage.clear();
    api.getAssignments.mockResolvedValue([]);
    api.getClasses.mockResolvedValue([]);
    api.getSchedule.mockResolvedValue([]);
  });

  it('keeps the personal calendar loading until classes are available for assignment filtering', () => {
    cache.setPersistent(calendarKeys.assignments(), [
      { id: 1, class_id: 101, status: 'Open', title: 'Midterm' },
    ]);
    api.getClasses.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCalendarData({ kind: 'personal' }));

    expect(result.current.data.assignments).toHaveLength(1);
    expect(result.current.data.classes).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('does not turn a cold fetch failure into completed empty data', async () => {
    api.getAssignments.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useCalendarData({ kind: 'personal' }));

    await waitFor(() => expect(api.getAssignments).toHaveBeenCalled());
    expect(result.current.data.assignments).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
});
