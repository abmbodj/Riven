/**
 * Feature flags for the rebuilt "luminous depth" garden.
 *
 * Matches the house env-flag convention (e.g. SignupForm.jsx VITE_SKIP_TURNSTILE):
 * a flag is ON when the env var is the string 'true' or '1'.
 */

const isOn = (value) => value === 'true' || value === '1';

/** Phase 1 — swap the rebuilt GardenScene in for the legacy art. */
export const isNewGardenEnabled = () => isOn(import.meta.env.VITE_NEW_GARDEN);

/** Phase 2 — milestone transformation cinematic. */
export const isGardenCinematicEnabled = () => isOn(import.meta.env.VITE_GARDEN_CINEMATIC);

/** Phase 3 — gallery LOD wiring + share/export image. */
export const isGardenShareEnabled = () => isOn(import.meta.env.VITE_GARDEN_SHARE);
