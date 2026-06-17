import { isPremiumActive } from './premiumAccess.mjs';

export const tierFromRevenueCatEvent = (type) => {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'NON_RENEWING_PURCHASE':
    case 'UNCANCELLATION':
    case 'TRANSFER':
      return 'supporter';

    case 'EXPIRATION':
      return 'free';

    case 'CANCELLATION':
    case 'BILLING_ISSUE':
    case 'SUBSCRIBER_ALIAS':
    case 'PRODUCT_CHANGE':
    default:
      return null;
  }
};

/**
 * Derive subscription_expires_at from a RevenueCat event.
 * expiration_at_ms is provided by RC on purchase, renewal, and expiration events.
 * Returns an ISO string, or null if not available.
 */
const expiresAtFromEvent = (event) => {
  const ms = event?.expiration_at_ms;
  if (!ms) return null;
  return new Date(ms).toISOString();
};

export const processRevenueCatWebhookEvent = async ({
  event,
  persistence,
  logger = console,
}) => {
  const { type, app_user_id: appUserId } = event;
  const newTier = tierFromRevenueCatEvent(type);

  if (newTier === null) {
    logger.info(`[revenuecat-webhook] No tier change needed for event: ${type}`);
    return { outcome: 'ignored' };
  }

  const previousUser = await persistence.getUserByAppUserId(appUserId);
  if (!previousUser?.id) {
    logger.error(`[revenuecat-webhook] User not found: ${appUserId}`);
    return { outcome: 'user-missing', tier: newTier };
  }

  if (previousUser.subscription_tier === 'lifetime') {
    logger.info(`[revenuecat-webhook] Skipping ${type} tier update for lifetime user: ${appUserId}`);
    return { outcome: 'skipped-lifetime', tier: 'lifetime', notified: false };
  }

  // Capture the provider-authoritative period end for both upgrades and expirations.
  // On EXPIRATION the timestamp is (past) — the live gate will deny correctly.
  // On purchase / renewal it's the future period end — refreshes the window.
  const expiresAt = expiresAtFromEvent(event);

  const updatedUser = await persistence.updateUserTierByAppUserId(appUserId, newTier, expiresAt);
  if (!updatedUser?.id) {
    logger.error(`[revenuecat-webhook] Failed to update user: ${appUserId}`);
    return { outcome: 'update-missing', tier: newTier };
  }

  let notified = false;
  if (
    type === 'EXPIRATION'
    && previousUser.subscription_tier === 'supporter'
    && !isPremiumActive(updatedUser)
  ) {
    await persistence.createUserNotification({
      userId: Number(updatedUser.id),
      kind: 'subscription_expired',
      title: 'Your Pro access has ended',
      content: 'Your billing period has ended, so paid Pro features are no longer active on this account.',
      metadata: {
        source: 'revenuecat',
        eventType: type,
        previousTier: previousUser.subscription_tier,
        currentTier: updatedUser.subscription_tier || 'free',
      },
    });
    notified = true;
  }

  return {
    outcome: newTier === 'free' ? 'downgraded' : 'upgraded',
    tier: newTier,
    notified,
  };
};
