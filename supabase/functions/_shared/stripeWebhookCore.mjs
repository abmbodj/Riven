const resolveEntityId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.id === 'string') return value.id;
  return null;
};

const hasEffectivePremiumAccess = (user) => {
  if (!user) return false;
  if ((user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier) return true;
  if (user.role === 'friends') return true;
  return user.subscription_tier === 'supporter' || user.subscription_tier === 'lifetime';
};

const maybeCreateSubscriptionExpiredNotification = async ({
  previousUser,
  nextUser,
  persistence,
  provider,
  externalCustomerId = null,
  externalSubscriptionId = null,
}) => {
  if (!previousUser?.id || previousUser.subscription_tier !== 'supporter') return false;
  if (hasEffectivePremiumAccess(nextUser)) return false;

  await persistence.createUserNotification({
    userId: Number(previousUser.id),
    kind: 'subscription_expired',
    title: 'Your Pro access has ended',
    content: 'Your billing period has ended, so paid Pro features are no longer active on this account.',
    metadata: {
      source: provider,
      previousTier: previousUser.subscription_tier,
      currentTier: nextUser?.subscription_tier || 'free',
      externalCustomerId,
      externalSubscriptionId,
    },
  });

  return true;
};

/**
 * True if the customer still has any subscription that grants access (active or trialing).
 */
const customerHasRetainedSubscription = async (stripe, stripeCustomerId) => {
  const active = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 20,
  });
  if (active.data.length > 0) return true;

  const trialing = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'trialing',
    limit: 20,
  });
  return trialing.data.length > 0;
};

/**
 * After a new subscription checkout, cancel any other active/trialing subscriptions for this customer.
 */
const cancelOtherSubscriptions = async (stripe, stripeCustomerId, keepSubscriptionId, logger) => {
  for (const status of ['active', 'trialing']) {
    const { data } = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status,
      limit: 20,
    });
    for (const subscription of data) {
      if (subscription.id !== keepSubscriptionId) {
        logger.info(
          `[Stripe Webhook] New subscription ${keepSubscriptionId} — canceling other ${status} sub ${subscription.id}...`,
        );
        await stripe.subscriptions.cancel(subscription.id);
      }
    }
  }
};

export const processStripeWebhookEvent = async ({
  event,
  stripe,
  persistence,
  logger = console,
}) => {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id;

      if (!userId) {
        logger.warn('[Stripe Webhook] No userId (client_reference_id) found in session:', session.id);
        return { outcome: 'checkout-missing-user-id' };
      }

      let tier;
      try {
        const verifiedSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        });

        if (verifiedSession.payment_status !== 'paid') {
          logger.warn(`[Stripe Webhook] Session ${session.id} payment_status is ${verifiedSession.payment_status}, skipping.`);
          return { outcome: 'checkout-unpaid' };
        }

        tier = verifiedSession.mode === 'subscription' ? 'supporter' : 'lifetime';
      } catch (fetchError) {
        logger.error(`[Stripe Webhook] Failed to re-fetch session ${session.id}:`, fetchError?.message || fetchError);
        tier = session.metadata?.tier || 'supporter';
      }

      logger.info(`[Stripe Webhook] Fulfillment starting for user ${userId} -> ${tier}`);

      const stripeCustomerId = resolveEntityId(session.customer);
      const stripeSubscriptionId = resolveEntityId(session.subscription);
      const updated = await persistence.updateUserFromCheckout({
        userId: Number(userId),
        tier,
        stripeCustomerId,
        stripeSubscriptionId,
      });

      if (!updated) {
        logger.error(`[Stripe Webhook] Failed to update user ${userId}: User not found in database.`);
        return { outcome: 'checkout-user-missing', tier };
      }

      logger.info(`[Stripe Webhook] Subscription updated successfully for user ${userId}`);

      if (tier === 'lifetime' && stripeCustomerId) {
        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
            limit: 10,
          });

          for (const subscription of subscriptions.data) {
            logger.info(`[Stripe Webhook] Lifetime upgrade detected, canceling subscription ${subscription.id}...`);
            await stripe.subscriptions.cancel(subscription.id);
          }
        } catch (cancelError) {
          logger.error(`[Stripe Webhook] Failed to auto-cancel old subscriptions for ${userId}:`, cancelError?.message || cancelError);
        }
      } else if (tier === 'supporter' && stripeCustomerId && stripeSubscriptionId) {
        try {
          await cancelOtherSubscriptions(stripe, stripeCustomerId, stripeSubscriptionId, logger);
        } catch (cancelError) {
          logger.error(`[Stripe Webhook] Failed to cancel other subscriptions for ${userId}:`, cancelError?.message || cancelError);
        }
      }

      return { outcome: 'checkout-updated', tier };
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const stripeCustomerId = resolveEntityId(subscription.customer);

      logger.info(`[Stripe Webhook] Subscription deleted for customer ${stripeCustomerId}. Checking before reverting to free.`);

      if (!stripeCustomerId) {
        logger.warn('[Stripe Webhook] Missing customer id on subscription.deleted event');
        return { outcome: 'subscription-delete-missing-customer' };
      }

      const previousUser = await persistence.getUserBillingStateByCustomerId(stripeCustomerId);
      if (previousUser?.subscription_tier === 'lifetime') {
        logger.info('[Stripe Webhook] Skipping downgrade — user is on lifetime plan.');
        return { outcome: 'subscription-delete-skipped-lifetime' };
      }

      try {
        const stillSubscribed = await customerHasRetainedSubscription(stripe, stripeCustomerId);
        if (stillSubscribed) {
          logger.info('[Stripe Webhook] Skipping downgrade — customer still has an active or trialing subscription.');
          return { outcome: 'subscription-delete-skipped-still-subscribed' };
        }
      } catch (listError) {
        logger.error('[Stripe Webhook] Failed to list subscriptions before downgrade:', listError?.message || listError);
        return { outcome: 'subscription-delete-list-error' };
      }

      const downgradedByCustomerId = await persistence.downgradeUserByCustomerId(stripeCustomerId);
      if (downgradedByCustomerId?.id) {
        const notified = await maybeCreateSubscriptionExpiredNotification({
          previousUser,
          nextUser: downgradedByCustomerId,
          persistence,
          provider: 'stripe',
          externalCustomerId: stripeCustomerId,
          externalSubscriptionId: subscription.id || null,
        });
        return {
          outcome: 'subscription-delete-downgraded-by-customer-id',
          notified,
        };
      }

      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer && !customer.deleted && customer.email) {
        logger.info(`[Stripe Webhook] ID match failed, falling back to email ${customer.email}`);
        const previousUserByEmail = previousUser || await persistence.getUserBillingStateByEmail(customer.email);
        const downgradedByEmail = await persistence.downgradeUserByEmail(customer.email);
        const notified = await maybeCreateSubscriptionExpiredNotification({
          previousUser: previousUserByEmail,
          nextUser: downgradedByEmail,
          persistence,
          provider: 'stripe',
          externalCustomerId: stripeCustomerId,
          externalSubscriptionId: subscription.id || null,
        });
        return {
          outcome: 'subscription-delete-downgraded-by-email',
          notified,
        };
      }

      return { outcome: 'subscription-delete-no-match' };
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;

      if (subscription.cancel_at_period_end) {
        logger.info(`[Stripe Webhook] Subscription ${subscription.id} scheduled to cancel at period end.`);
        return { outcome: 'subscription-update-scheduled-cancel' };
      }

      return { outcome: 'subscription-update-ignored' };
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const stripeCustomerId = resolveEntityId(invoice.customer);
      const attemptCount = invoice.attempt_count || 1;

      logger.warn(`[Stripe Webhook] Payment failed for customer ${stripeCustomerId} (attempt ${attemptCount})`);

      if (attemptCount >= 2) {
        logger.warn(`[Stripe Webhook] Multiple payment failures for ${stripeCustomerId}. Subscription may be canceled soon.`);
      }

      return { outcome: 'invoice-payment-failed', attemptCount };
    }

    default:
      return { outcome: 'ignored' };
  }
};
