/**
 * Single source of truth for whether a user has active premium access.
 *
 * Rules (evaluated in order):
 *   1. owner / admin (unless simulate_free_tier=true)  → lifetime-equivalent, no expiry check
 *   2. friends role                                     → lifetime-equivalent, no expiry check
 *   3. lifetime tier                                    → no expiry check
 *   4. supporter tier                                   → active only when subscription_expires_at
 *                                                          is null OR > now.
 *      If subscription_expires_at is null for a supporter we treat it as ACTIVE (not yet
 *      backfilled by reconcile) so legacy rows don't get falsely locked out on deploy.
 *      The reconcile job fills the column on its first run.
 *   5. free (or anything else)                          → inactive
 *
 * Runtime-agnostic: no Node-only or Deno-only APIs.
 */

/**
 * @typedef {Object} UserLike
 * @property {string} [subscription_tier]
 * @property {string} [role]
 * @property {boolean} [simulate_free_tier]
 * @property {string|Date|null} [subscription_expires_at]
 */

/**
 * Returns true if the user currently has active premium access.
 *
 * @param {UserLike} user
 * @param {Date} [now]  - injectable for tests; defaults to current time
 * @returns {boolean}
 */
export const isPremiumActive = (user, now = new Date()) => {
  if (!user) return false;

  // Role-based bypass (no expiry check).
  if ((user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier) return true;
  if (user.role === 'friends') return true;

  const tier = user.subscription_tier;

  if (tier === 'lifetime') return true;

  if (tier === 'supporter') {
    const expiresAt = user.subscription_expires_at;
    // Null means not yet backfilled — treat as active to avoid false lockout.
    if (!expiresAt) return true;
    const expiryMs = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
    return expiryMs > now.getTime();
  }

  return false;
};

/**
 * Resolves the effective premium state for a user, matching the shape
 * previously computed inline in auth.js and mapOwnUserRow.
 *
 * @param {UserLike} user
 * @param {Date} [now]
 * @returns {{ active: boolean, effectiveTier: string, premiumAccessSource: string }}
 */
export const resolvePremium = (user, now = new Date()) => {
  if (!user) {
    return { active: false, effectiveTier: 'free', premiumAccessSource: 'free' };
  }

  const baseTier = user.subscription_tier || 'free';

  if ((user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier) {
    return { active: true, effectiveTier: 'lifetime', premiumAccessSource: user.role === 'owner' ? 'owner_included' : 'admin_included' };
  }
  if (user.role === 'friends') {
    return { active: true, effectiveTier: 'lifetime', premiumAccessSource: 'friends_included' };
  }
  if (baseTier === 'lifetime') {
    return { active: true, effectiveTier: 'lifetime', premiumAccessSource: 'lifetime' };
  }
  if (baseTier === 'supporter') {
    const active = isPremiumActive(user, now);
    return { active, effectiveTier: active ? 'supporter' : 'free', premiumAccessSource: active ? 'subscription' : 'free' };
  }

  return { active: false, effectiveTier: 'free', premiumAccessSource: 'free' };
};
