import { describe, expect, it } from 'vitest';
import { nextUpcomingAt } from './proposeDefaults';

const at = (iso: string) => new Date(iso);

describe('nextUpcomingAt', () => {
  it('keeps the chosen day at the hour when that is still ahead', () => {
    expect(nextUpcomingAt(at('2026-11-17T00:00:00'), 18, at('2026-11-17T09:30:00'))).toEqual(at('2026-11-17T18:00:00'));
    expect(nextUpcomingAt(at('2026-11-20T00:00:00'), 18, at('2026-11-17T21:00:00'))).toEqual(at('2026-11-20T18:00:00'));
  });

  it('moves to tomorrow when today at the hour has passed', () => {
    expect(nextUpcomingAt(at('2026-11-17T00:00:00'), 18, at('2026-11-17T21:15:00'))).toEqual(at('2026-11-18T18:00:00'));
    expect(nextUpcomingAt(at('2026-11-17T00:00:00'), 18, at('2026-11-17T18:00:00'))).toEqual(at('2026-11-18T18:00:00'));
  });

  it('uses the next upcoming hour from now when the chosen day is in the past', () => {
    expect(nextUpcomingAt(at('2026-11-10T00:00:00'), 18, at('2026-11-17T08:00:00'))).toEqual(at('2026-11-17T18:00:00'));
    expect(nextUpcomingAt(at('2026-11-10T00:00:00'), 18, at('2026-11-17T20:00:00'))).toEqual(at('2026-11-18T18:00:00'));
  });
});
