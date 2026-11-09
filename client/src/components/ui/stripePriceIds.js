export const resolveStripePriceIds = (env) => ({
    monthly: env.VITE_STRIPE_PRICE_MONTHLY,
    annual: env.VITE_STRIPE_PRICE_ANNUAL,
});
