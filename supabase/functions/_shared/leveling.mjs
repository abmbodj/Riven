// Single source of truth for XP -> level math. Used server-side by every XP-granting edge
// function (study-session-complete, exam-complete, deck-review-complete) and mirrored on the
// client at client/src/utils/leveling.js for display. Keep the two in sync.
//
// Runtime-agnostic: no Node-only or Deno-only APIs, so it unit-tests from both runtimes.

export const XP_PER_LEVEL = 120;

const toXp = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** Level for a cumulative XP total. Level 1 starts at 0 XP; each level is XP_PER_LEVEL apart. */
export const levelFromXp = (xpTotal) => Math.max(1, Math.floor(toXp(xpTotal) / XP_PER_LEVEL) + 1);

/**
 * Progress within the current level.
 * Accepts either a number (raw xpTotal) or a stats object { xpTotal, level }.
 * Returns the display shape the level bars consume: { xpTotal, level, currentLevelXp, remaining, percent }.
 */
export const xpProgress = (statsOrXp = {}) => {
  const xpTotal = typeof statsOrXp === 'number'
    ? toXp(statsOrXp)
    : toXp(statsOrXp?.xpTotal);
  // Trust a provided level only if it is at least the derived one (never let a stale/lower
  // client value mask real progress); otherwise derive from XP.
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
