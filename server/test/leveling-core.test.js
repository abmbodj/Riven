import { describe, it, expect } from 'vitest';

import {
  XP_PER_LEVEL,
  levelFromXp,
  xpProgress,
} from '../../supabase/functions/_shared/leveling.mjs';

describe('leveling', () => {
  it('starts at level 1 and advances every XP_PER_LEVEL', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(XP_PER_LEVEL - 1)).toBe(1);
    expect(levelFromXp(XP_PER_LEVEL)).toBe(2);
    expect(levelFromXp(XP_PER_LEVEL * 10)).toBe(11);
  });

  it('treats negative / invalid XP as zero', () => {
    expect(levelFromXp(-50)).toBe(1);
    expect(levelFromXp('nonsense')).toBe(1);
    expect(levelFromXp(undefined)).toBe(1);
  });

  it('reports progress within the current level', () => {
    const progress = xpProgress({ xpTotal: XP_PER_LEVEL + 30 });
    expect(progress.level).toBe(2);
    expect(progress.currentLevelXp).toBe(30);
    expect(progress.remaining).toBe(XP_PER_LEVEL - 30);
    expect(progress.percent).toBe(Math.round((30 / XP_PER_LEVEL) * 100));
  });

  it('accepts a raw number as well as a stats object', () => {
    expect(xpProgress(XP_PER_LEVEL * 2).level).toBe(3);
    expect(xpProgress({ xpTotal: XP_PER_LEVEL * 2 }).level).toBe(3);
  });

  it('never lets a stale lower level mask real XP progress', () => {
    // xpTotal implies level 3, but a stale stored level of 1 is provided.
    const progress = xpProgress({ xpTotal: XP_PER_LEVEL * 2 + 10, level: 1 });
    expect(progress.level).toBe(3);
  });
});
