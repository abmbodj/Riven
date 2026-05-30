const hasEffectivePremiumAccess = (user) => {
  if (!user) return false;
  if ((user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier) return true;
  if (user.role === 'friends') return true;
  return user.subscription_tier === 'supporter' || user.subscription_tier === 'lifetime';
};

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

  const updatedUser = await persistence.updateUserTierByAppUserId(appUserId, newTier);
  if (!updatedUser?.id) {
    logger.error(`[revenuecat-webhook] Failed to update user: ${appUserId}`);
    return { outcome: 'update-missing', tier: newTier };
  }

  let notified = false;
  if (
    type === 'EXPIRATION'
    && previousUser.subscription_tier === 'supporter'
    && !hasEffectivePremiumAccess(updatedUser)
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
