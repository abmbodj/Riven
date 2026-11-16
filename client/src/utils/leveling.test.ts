import { describe, expect, it } from 'vitest';
import { XP_PER_LEVEL, levelFromXp, xpProgress } from './leveling';

// Characterization: locks in current behavior before the TypeScript conversion.
describe('leveling', () => {
  it('levels every 120 XP starting at level 1', () => {
    expect(XP_PER_LEVEL).toBe(120);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(119)).toBe(1);
    expect(levelFromXp(120)).toBe(2);
    expect(levelFromXp(360)).toBe(4);
  });

  it('treats invalid, negative and string XP as numbers or zero', () => {
    expect(levelFromXp(-50)).toBe(1);
    expect(levelFromXp(Number.NaN)).toBe(1);
    expect(levelFromXp('240')).toBe(3);
    expect(levelFromXp(undefined)).toBe(1);
  });

  it('reports progress within the current level from a number', () => {
    expect(xpProgress(150)).toEqual({ xpTotal: 150, level: 2, currentLevelXp: 30, remaining: 90, percent: 25 });
  });

  it('keeps a stored level higher than the derived one, never lower', () => {
    expect(xpProgress({ xpTotal: 150, level: 5 }).level).toBe(5);
    expect(xpProgress({ xpTotal: 500, level: 1 }).level).toBe(5);
    expect(xpProgress({ xpTotal: 10, level: 'x' }).level).toBe(1);
  });

  it('defaults to an empty level 1', () => {
    expect(xpProgress()).toEqual({ xpTotal: 0, level: 1, currentLevelXp: 0, remaining: 120, percent: 0 });
    expect(xpProgress(null)).toEqual({ xpTotal: 0, level: 1, currentLevelXp: 0, remaining: 120, percent: 0 });
  });
});
