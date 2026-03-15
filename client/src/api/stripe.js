import { createStripeCheckoutSession, createStripePortalSession } from './authApi';

/**
 * Stripe API wrapper for the client.
 */
export async function createCheckoutSessionUrl({ priceId, isSubscription }) {
    const data = await createStripeCheckoutSession({ priceId, isSubscription });
    return data?.url || null;
}

export async function getManagementPortalUrl() {
    try {
        const data = await createStripePortalSession();
        return data?.url || null;
    } catch (error) {
        console.error('[Stripe] Failed to get portal URL:', error);
        return null;
    }
}
