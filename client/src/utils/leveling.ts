/**
 * XP -> level math for display (level badges, XP progress bars, level-up checks).
 * Client-side mirror of supabase/functions/_shared/leveling.mjs — keep the two in sync.
 */

export const XP_PER_LEVEL = 120;

/** Stats rows arrive from the database and older caches, so fields are not trusted. */
export type XpStats = { xpTotal?: unknown; level?: unknown };

export type XpProgress = {
  xpTotal: number;
  level: number;
  currentLevelXp: number;
  remaining: number;
  percent: number;
};

const toXp = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** Level for a cumulative XP total. Level 1 starts at 0 XP; each level is XP_PER_LEVEL apart. */
export const levelFromXp = (xpTotal: unknown): number => Math.max(1, Math.floor(toXp(xpTotal) / XP_PER_LEVEL) + 1);

/**
 * Progress within the current level.
 * Accepts a stats object { xpTotal, level } (or a raw xpTotal number).
 */
export const xpProgress = (statsOrXp: number | XpStats | null = {}): XpProgress => {
  const xpTotal = typeof statsOrXp === 'number'
    ? toXp(statsOrXp)
    : toXp(statsOrXp?.xpTotal);
  const derivedLevel = levelFromXp(xpTotal);
  const providedLevel = typeof statsOrXp === 'object' ? Number(statsOrXp?.level) : NaN;
  const level = Number.isFinite(providedLevel) ? Math.max(1, providedLevel, derivedLevel) : derivedLevel;
  const currentLevelXp = xpTotal % XP_PER_LEVEL;

  return {
    xpTotal,
    level,
    currentLevelXp,
    remaining: XP_PER_LEVEL - currentLevelXp,
    percent: Math.max(0, Math.min(100, Math.round((currentLevelXp / XP_PER_LEVEL) * 100))),
  };
};
