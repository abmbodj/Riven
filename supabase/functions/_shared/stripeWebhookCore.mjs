const resolveEntityId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.id === 'string') return value.id;
  return null;
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

      const currentTier = await persistence.getSubscriptionTierByCustomerId(stripeCustomerId);
      if (currentTier === 'lifetime') {
        logger.info('[Stripe Webhook] Skipping downgrade — user is on lifetime plan.');
        return { outcome: 'subscription-delete-skipped-lifetime' };
      }

      const downgradedByCustomerId = await persistence.downgradeUserByCustomerId(stripeCustomerId);
      if (downgradedByCustomerId) {
        return { outcome: 'subscription-delete-downgraded-by-customer-id' };
      }

      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer && !customer.deleted && customer.email) {
        logger.info(`[Stripe Webhook] ID match failed, falling back to email ${customer.email}`);
        await persistence.downgradeUserByEmail(customer.email);
        return { outcome: 'subscription-delete-downgraded-by-email' };
      }

      return { outcome: 'subscription-delete-no-match' };
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
