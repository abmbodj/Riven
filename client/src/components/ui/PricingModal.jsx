import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'motion/react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Crown,
    Loader2,
    Shield,
    Sparkles,
    X,
    Zap,
} from 'lucide-react';
import { createCheckoutSessionUrl } from '../../api/stripe';
import { api } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useRevenueCat from '../../hooks/useRevenueCat';

function subscribeMaxWidth767(cb) {
    if (typeof window === 'undefined') return () => {};
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = () => cb();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
}

function getMaxWidth767Snapshot() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
}

function useIsNarrowViewport() {
    return useSyncExternalStore(subscribeMaxWidth767, getMaxWidth767Snapshot, () => false);
}

const PRICE_IDS = {
    monthly: import.meta.env.VITE_STRIPE_PRICE_MONTHLY,
    annual: import.meta.env.VITE_STRIPE_PRICE_ANNUAL ?? import.meta.env.VITE_STRIPE_PRICE_LIFETIME,
};

const PLAN_STYLES = {
    supporter: {
        icon: Zap,
        badge: 'Most Popular',
        card: 'border-claude-accent/30 bg-[linear-gradient(180deg,rgba(168,192,127,0.12),rgba(255,255,255,0.04))]',
        activeCard: 'border-claude-accent bg-claude-accent/15 shadow-[0_18px_45px_rgba(168,192,127,0.14)]',
        badgeClass: 'border-claude-accent/25 bg-claude-accent/15 text-claude-accent',
        iconWrap: 'border-claude-accent/20 bg-claude-accent/15 text-claude-accent',
        check: 'text-claude-accent',
        accentBar: 'bg-claude-accent',
        cta: 'from-[#a8c07f] to-[#d8b66a]',
    },
    annual: {
        icon: Crown,
        badge: 'Yearly billing',
        card: 'border-amber-400/30 bg-[linear-gradient(180deg,rgba(217,168,71,0.14),rgba(255,255,255,0.04))]',
        activeCard: 'border-amber-400 bg-claude-accent/15 shadow-[0_18px_45px_rgba(217,168,71,0.14)]',
        badgeClass: 'border-amber-400/25 bg-amber-400/15 text-amber-300',
        iconWrap: 'border-amber-400/20 bg-amber-400/15 text-amber-300',
        check: 'text-amber-300',
        accentBar: 'bg-amber-300',
        cta: 'from-[#d8b66a] to-[#f0d28a]',
    },
};

const PLANS = [
    {
        id: 'supporter',
        name: 'Supporter',
        price: '$5.99',
        period: '/month',
        kicker: 'For daily studying',
        summary: 'Unlocks the full Riven rhythm without committing long term.',
        features: [
            'Unlimited hearts',
            'Guided study tools for decks, classes, guides, exams, YouTube, and notes',
            'All PRO themes',
            'Ad-free studying',
            'Advanced study groups',
        ],
    },
    {
        id: 'annual',
        name: 'Annual',
        price: '$74.99',
        period: '/year',
        kicker: 'Pay once per year',
        summary: 'Full premium access on a yearly renewal—ideal if you prefer one invoice and less monthly admin.',
        features: [
            'Everything in Supporter',
            'Predictable yearly billing',
            'Renews once per year (cancel anytime)',
            'All future premium features',
            'Exclusive custom themes',
        ],
    },
];

function getDefaultPlan(currentTier) {
    if (currentTier === 'supporter') return 'annual';
    if (currentTier === 'lifetime') return 'supporter';
    return 'supporter';
}

export default function PricingModal({ isOpen, onClose, currentTier = 'free' }) {
    useBodyScrollLock(isOpen);
    const { user, refreshUser } = useAuth();
    const isNarrow = useIsNarrowViewport();

    // RevenueCat for native iOS; no-ops on web
    const rc = useRevenueCat(user?.id ?? null);

    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState(getDefaultPlan(currentTier));
    const [mobilePaywallView, setMobilePaywallView] = useState('pick');
    const closeTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedPlan(getDefaultPlan(currentTier));
        setError(null);
        setSuccess(null);
        setMobilePaywallView('pick');
    }, [isOpen, currentTier]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (event) => {
            if (event.key !== 'Escape') return;
            const isNarrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
            if (isNarrow && mobilePaywallView === 'features') {
                setMobilePaywallView('pick');
                return;
            }
            onClose();
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, mobilePaywallView]);

    const selectedPlanData = useMemo(
        () => PLANS.find((plan) => plan.id === selectedPlan) ?? PLANS[0],
        [selectedPlan]
    );

    const dialogLabelledBy = useMemo(() => {
        if (isNarrow && mobilePaywallView === 'features') return 'pricing-modal-features-title';
        if (isNarrow) return 'pricing-modal-title-mobile';
        return 'pricing-modal-title-desktop';
    }, [isNarrow, mobilePaywallView]);

    const handlePurchase = async (pkgType) => {
        setLoading(true);
        setError(null);

        // ── Native iOS: use RevenueCat / StoreKit IAP ──────────────────────
        if (rc.isNative) {
            try {
                const offering = rc.offerings?.current;
                if (!offering) {
                    throw new Error(rc.error ?? 'No active subscriptions found. Please restart the app.');
                }

                // Find the matching package: annual → ANNUAL, monthly → MONTHLY
                const targetType = pkgType === 'annual' ? 'ANNUAL' : 'MONTHLY';
                const pkg =
                    offering.availablePackages.find((p) => p.packageType === targetType) ??
                    offering.availablePackages[0];

                if (!pkg) throw new Error('No matching package found in RevenueCat offering.');

                const result = await rc.purchasePackage(pkg);
                if (result) {
                    setSuccess('Processing your purchase...');
                    
                    try {
                        const syncResult = await api.syncRevenueCat({
                            rcAppUserIdOverride: result?.customerInfo?.originalAppUserId
                        });
                        if (syncResult && syncResult.subscription_tier !== 'free') {
                            await refreshUser();
                        }
                    } catch { /* ignore */ }

                    // Poll up to 6 times (12 seconds) for the RevenueCat webhook to sync to Supabase
                    let attempts = 0;
                    while (attempts < 6) {
                        try {
                            const updatedUser = await refreshUser();
                            if (updatedUser?.subscription_tier && updatedUser.subscription_tier !== 'free') {
                                break;
                            }
                        } catch (e) {
                            console.error('Error refreshing user during poll', e);
                        }
                        await new Promise(r => setTimeout(r, 2000));
                        attempts++;
                    }

                    setSuccess('Purchase complete! Your premium access is now active.');
                    closeTimerRef.current = setTimeout(onClose, 2000);
                } else if (rc.error) {
                    setError(rc.error);
                }
            } catch (err) {
                console.error('[PricingModal] RC purchase error:', err);
                setError(err.message || 'Purchase failed. Please try again.');
            } finally {
                setLoading(false);
            }
            return;
        }

        // ── Web / PWA: use Stripe checkout ─────────────────────────────────
        try {
            const priceId = pkgType === 'annual' ? PRICE_IDS.annual : PRICE_IDS.monthly;
            if (!priceId) {
                throw new Error('Stripe price is not configured for this plan.');
            }

            const url = await createCheckoutSessionUrl({ priceId, isSubscription: true });
            if (url) {
                window.location.href = url;
                return;
            }

            throw new Error('Failed to create checkout session');
        } catch (err) {
            console.error('[PricingModal] Purchase error:', err);
            setError(err.message || 'Failed to initiate purchase. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        setRestoring(true);
        setError(null);
        setSuccess(null);

        // ── Native iOS: restore via RevenueCat ────────────────────────────
        if (rc.isNative) {
            try {
                const result = await rc.restorePurchases();
                
                // 1. Verify RevenueCat actually recognizes an active subscription locally
                const hasActiveEntitlement = result?.customerInfo?.entitlements?.active && 
                                           Object.keys(result.customerInfo.entitlements.active).length > 0;
                
                if (hasActiveEntitlement) {
                    setSuccess('Restoring... waiting for server sync...');
                    
                    try {
                        const syncResult = await api.syncRevenueCat({
                            rcAppUserIdOverride: result?.customerInfo?.originalAppUserId
                        });
                        if (syncResult && syncResult.subscription_tier !== 'free') {
                            setSuccess(`Welcome back, ${syncResult.subscription_tier}. Your access has been restored.`);
                            closeTimerRef.current = setTimeout(onClose, 1800);
                            await refreshUser();
                            return;
                        } else {
                            const localId = result?.customerInfo?.appUserId;
                            const origId = result?.customerInfo?.originalAppUserId;
                            console.error(`DEBUG - Sync Failed!\\nLocal IDs: [current: ${localId}, orig: ${origId}]\\nEdge Payload: ${JSON.stringify(syncResult, null, 2)}`);
                        }
                    } catch (syncErr) {
                         console.error('DEBUG - Edge function failed entirely! ' + syncErr.message + '\\nFull error: ' + JSON.stringify(syncErr, null, 2));
                         console.warn('[PricingModal] Manual sync failed, falling back to polling webhook', syncErr);
                    }
                    
                    // 2. Poll up to 6 times (12 seconds) for the RevenueCat webhook to sync to Supabase
                    let attempts = 0;
                    let finalUser = null;
                    while (attempts < 6) {
                        try {
                            const updatedUser = await refreshUser();
                            if (updatedUser?.subscription_tier && updatedUser.subscription_tier !== 'free') {
                                finalUser = updatedUser;
                                break;
                            }
                        } catch (e) {
                            console.error('Error refreshing user during poll', e);
                        }
                        await new Promise(r => setTimeout(r, 2000));
                        attempts++;
                    }

                    if (finalUser && finalUser.subscription_tier !== 'free') {
                        setSuccess(`Welcome back, ${finalUser.subscription_tier}. Your access has been restored.`);
                        closeTimerRef.current = setTimeout(onClose, 1800);
                    } else {
                        setError('We found your subscription, but our servers are taking too long to sync. Please restart the app or try again in a minute.');
                    }
                } else if (rc.error) {
                    setError(rc.error);
                } else {
                    setError('No purchases found for this Apple ID.');
                }
            } catch (err) {
                console.error('[PricingModal] RC restore error:', err);
                setError(err.message || 'Restore failed. Please try again.');
            } finally {
                setRestoring(false);
            }
            return;
        }

        // ── Web / PWA: sync against server ───────────────────────────────
        try {
            const updatedUser = await refreshUser();
            if (updatedUser.subscription_tier !== 'free') {
                setSuccess(`Welcome back, ${updatedUser.subscription_tier}. Your access has been restored.`);
                closeTimerRef.current = setTimeout(onClose, 1800);
            } else {
                setError('No active subscription found yet. If you just paid, wait a minute and try again.');
            }
        } catch {
            setError('Failed to restore access. Please try again or contact support.');
        } finally {
            setRestoring(false);
        }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[999] flex items-end justify-center px-2 pt-[max(env(safe-area-inset-top,0px),0.75rem)] md:items-center md:p-6">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-claude-bg/70 md:backdrop-blur-md"
                        onClick={onClose}
                    />

                    <Motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={dialogLabelledBy}
                        initial={{ opacity: 0, y: 32, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                        className="relative flex max-h-[calc(100dvh-max(env(safe-area-inset-top,0px),0.75rem))] w-full flex-col overflow-hidden rounded-t-[2rem] border border-claude-border bg-claude-bg shadow-[0_30px_90px_rgba(0,0,0,0.32)] md:max-h-[94vh] md:max-w-5xl md:rounded-[2rem] md:bg-claude-bg/98"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,192,127,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(216,182,106,0.12),transparent_30%)]" />

                        <div className="relative flex justify-center pt-4 md:hidden">
                            <div className="h-1.5 w-12 rounded-full bg-claude-surface/80" />
                        </div>

                        <div className="relative flex items-start justify-between gap-3 border-b border-claude-border px-4 pb-3 pt-2 md:gap-4 md:px-8 md:pb-6 md:pt-7">
                            <div className="min-w-0 flex-1 md:flex-none">
                                <div className="md:hidden">
                                    {mobilePaywallView === 'pick' ? (
                                        <>
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <div className="inline-flex items-center gap-1.5 rounded-full border border-claude-border bg-claude-bg/15 px-2.5 py-1">
                                                    <Sparkles className="h-3 w-3 text-claude-accent" />
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-claude-secondary">
                                                        Premium
                                                    </span>
                                                </div>
                                                <div className="inline-flex items-center gap-1.5 rounded-full border border-claude-border bg-claude-bg/50 px-2.5 py-1">
                                                    <Shield className="h-3 w-3 text-claude-secondary" />
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                                        {currentTier === 'free' ? 'Basic' : currentTier}
                                                    </span>
                                                </div>
                                            </div>
                                            <h2
                                                id="pricing-modal-title-mobile"
                                                className="font-display text-[1.35rem] font-bold italic leading-tight tracking-tight text-claude-text"
                                            >
                                                Upgrade Riven
                                            </h2>
                                            <p className="mt-1 line-clamp-2 text-xs leading-snug text-claude-secondary">
                                                Premium themes plus guided tools for decks, classes, guides, mock exams, YouTube tools, and note enhancement.
                                            </p>
                                        </>
                                    ) : (
                                        <div className="flex min-w-0 items-center gap-2 pr-2">
                                            <button
                                                type="button"
                                                onClick={() => setMobilePaywallView('pick')}
                                                className="tap-action inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-claude-border bg-claude-bg/15 text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                                aria-label="Back to plan selection"
                                            >
                                                <ArrowLeft className="h-5 w-5" />
                                            </button>
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                                    What&apos;s included
                                                </p>
                                                <h2
                                                    id="pricing-modal-features-title"
                                                    className="font-display text-lg font-bold italic leading-tight tracking-tight text-claude-text"
                                                >
                                                    {selectedPlanData.name}
                                                </h2>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="hidden md:block">
                                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-claude-border bg-claude-bg/15 px-3 py-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-claude-accent" />
                                        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                            Premium access
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                                        <h2
                                            id="pricing-modal-title-desktop"
                                            className="font-display text-[1.75rem] font-bold italic tracking-tight text-claude-text sm:text-[2rem] md:text-[3.2rem]"
                                        >
                                            Upgrade Riven
                                        </h2>
                                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-claude-border bg-claude-bg/50 px-3 py-1.5">
                                            <Shield className="h-3.5 w-3.5 text-claude-secondary" />
                                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                                Current {currentTier === 'free' ? 'Basic' : currentTier}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="mt-2 max-w-2xl pr-2 text-sm leading-relaxed text-claude-secondary md:mt-3 md:pr-0 md:text-base">
                                        Bring the full Riven atmosphere into every study session: premium themes,
                                        guided tools across decks, classes, guides, mock exams, YouTube study tools,
                                        and audio note enhancement, plus uninterrupted flow on every screen.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="tap-action inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-claude-border bg-claude-bg/15 text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-border hover:text-claude-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 md:h-11 md:w-11"
                                aria-label="Close pricing modal"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
                            {/* Mobile: strict no-scroll pick step; features uses overflow fallback */}
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 md:hidden">
                                {mobilePaywallView === 'pick' ? (
                                    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-hidden">
                                        <div className="grid grid-cols-2 gap-2">
                                            {PLANS.map((plan) => {
                                                const styles = PLAN_STYLES[plan.id];
                                                const isSelected = selectedPlan === plan.id;
                                                const isDisabled =
                                                    currentTier === plan.id ||
                                                    (currentTier === 'lifetime' && plan.id === 'supporter') ||
                                                    (currentTier === 'lifetime' && plan.id === 'annual');

                                                return (
                                                    <button
                                                        key={`${plan.id}-pill`}
                                                        type="button"
                                                        onClick={() => {
                                                            if (!isDisabled) {
                                                                setSelectedPlan(plan.id);
                                                                setError(null);
                                                                setSuccess(null);
                                                            }
                                                        }}
                                                        className={`tap-action flex min-h-11 items-center justify-center rounded-full border px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] ${
                                                            isSelected
                                                                ? `${styles.badgeClass} shadow-[0_8px_20px_rgba(0,0,0,0.16)]`
                                                                : 'border-claude-border bg-claude-bg/15 text-claude-secondary'
                                                        } ${isDisabled ? 'opacity-50' : ''}`}
                                                    >
                                                        {plan.name}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div
                                            className={`rounded-2xl border p-3 ${PLAN_STYLES[selectedPlan].activeCard}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                                        {selectedPlanData.kicker}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap items-end gap-x-2 gap-y-0.5">
                                                        <span className="text-2xl font-bold tracking-tight text-claude-text">
                                                            {selectedPlanData.price}
                                                        </span>
                                                        <span className="pb-0.5 text-sm text-claude-secondary/80">
                                                            {selectedPlanData.period}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-claude-secondary">
                                                        {selectedPlanData.summary}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.18em] ${PLAN_STYLES[selectedPlan].badgeClass}`}
                                                >
                                                    {PLAN_STYLES[selectedPlan].badge}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setMobilePaywallView('features')}
                                            className="tap-action min-h-11 w-full rounded-2xl border border-claude-border bg-claude-bg/15 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                        >
                                            See all features
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                        <ul
                                            className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5"
                                            aria-label={`${selectedPlanData.name} plan features`}
                                        >
                                            {selectedPlanData.features.map((feature) => (
                                                <li
                                                    key={feature}
                                                    className="flex items-start gap-2.5 text-sm leading-snug text-claude-text/90"
                                                >
                                                    <Check
                                                        className={`mt-0.5 h-4 w-4 shrink-0 ${PLAN_STYLES[selectedPlan].check}`}
                                                    />
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div className="hidden flex-1 overflow-y-auto overscroll-contain px-4 py-4 custom-scrollbar md:block md:px-8 md:py-8">
                                <div className="mb-5 hidden gap-3 sm:grid-cols-3 md:grid">
                                    {[
                                        ['Themes', 'Unlock all premium atmospheres'],
                                        ['Study Tools', 'Decks, classes, guides, exams, YouTube, and note enhancement'],
                                        ['Focus', 'No ads, less friction, more continuity'],
                                    ].map(([label, text]) => (
                                        <div
                                            key={label}
                                            className="rounded-2xl border border-claude-border bg-claude-bg/15 p-4"
                                        >
                                            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                                {label}
                                            </p>
                                            <p className="mt-2 text-sm leading-relaxed text-claude-secondary">{text}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    {PLANS.map((plan) => {
                                        const styles = PLAN_STYLES[plan.id];
                                        const Icon = styles.icon;
                                        const isSelected = selectedPlan === plan.id;
                                        const isCurrentPlan = currentTier === plan.id;
                                        const isDowngradeBlocked =
                                            (currentTier === 'lifetime' && plan.id === 'supporter') ||
                                            (currentTier === 'lifetime' && plan.id === 'annual');
                                        const isDisabled = isCurrentPlan || isDowngradeBlocked;

                                        return (
                                            <Motion.button
                                                key={plan.id}
                                                type="button"
                                                whileTap={{ scale: isDisabled ? 1 : 0.985 }}
                                                onClick={() => {
                                                    if (!isDisabled) {
                                                        setSelectedPlan(plan.id);
                                                        setError(null);
                                                        setSuccess(null);
                                                    }
                                                }}
                                                className={`tap-action group relative overflow-hidden rounded-[1.75rem] border p-3.5 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] md:p-6 ${
                                                    isSelected ? styles.activeCard : styles.card
                                                } ${!isSelected && !isDisabled ? 'hover:-translate-y-1 hover:border-claude-border' : ''} ${
                                                    isDisabled ? 'cursor-default opacity-55' : ''
                                                }`}
                                            >
                                                <div className={`absolute inset-x-0 top-0 h-1 ${styles.accentBar}`} />

                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="mb-2 flex items-center gap-3 md:mb-3">
                                                            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${styles.iconWrap}`}>
                                                                <Icon className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                                                    {plan.kicker}
                                                                </p>
                                                                <h3 className="mt-1 font-display text-xl font-bold italic tracking-tight text-claude-text md:text-2xl">
                                                                    {plan.name}
                                                                </h3>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-end gap-2">
                                                            <span className="text-2xl font-bold tracking-tight text-claude-text md:text-4xl">
                                                                {plan.price}
                                                            </span>
                                                            <span className="pb-1 text-sm text-claude-secondary/80">{plan.period}</span>
                                                        </div>

                                                        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-claude-secondary md:mt-2">
                                                            {plan.summary}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-2">
                                                        {!isDisabled ? (
                                                            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${styles.badgeClass}`}>
                                                                {styles.badge}
                                                            </span>
                                                        ) : null}

                                                        <div
                                                            className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                                                isSelected
                                                                    ? 'border-claude-text bg-claude-text text-[#122229]'
                                                                    : 'border-claude-border bg-transparent text-transparent'
                                                            }`}
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <ul className="mt-3 space-y-2 md:mt-5 md:space-y-2.5">
                                                    {plan.features.map((feature) => (
                                                        <li key={feature} className="flex items-start gap-3 text-sm text-claude-text/80">
                                                            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${styles.check}`} />
                                                            <span>{feature}</span>
                                                        </li>
                                                    ))}
                                                </ul>

                                                {isCurrentPlan ? (
                                                    <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                                        Your current plan
                                                    </p>
                                                ) : null}

                                                {isDowngradeBlocked ? (
                                                    <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                                        Your membership already includes this
                                                    </p>
                                                ) : null}
                                            </Motion.button>
                                        );
                                    })}
                                </div>
                            </div>

                            <aside className="relative hidden border-t border-claude-border bg-claude-bg/40 px-5 py-5 md:block md:w-[22rem] md:border-l md:border-t-0 md:px-6 md:py-8">
                                <div className="rounded-[1.75rem] border border-claude-border bg-claude-bg/15 p-5">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-claude-secondary">
                                        Selected plan
                                    </p>
                                    <h3 className="mt-3 font-display text-3xl font-bold italic tracking-tight text-claude-text">
                                        {selectedPlanData.name}
                                    </h3>
                                    <div className="mt-2 flex items-end gap-2">
                                        <span className="text-3xl font-bold text-claude-text">
                                            {selectedPlanData.price}
                                        </span>
                                        <span className="pb-1 text-sm text-claude-secondary/80">{selectedPlanData.period}</span>
                                    </div>
                                    <p className="mt-3 text-sm leading-relaxed text-claude-secondary">
                                        {selectedPlanData.summary}
                                    </p>

                                    <div className="mt-5 space-y-2 rounded-2xl border border-claude-border bg-claude-bg/40 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                                Access
                                            </span>
                                            <span className="text-sm text-claude-text">
                                                Premium unlocked
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                                Billing
                                            </span>
                                            <span className="text-sm text-claude-text">
                                                {selectedPlan === 'annual' ? 'Yearly renewal' : 'Monthly renewal'}
                                            </span>
                                        </div>
                                    </div>

                                    {error ? (
                                        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200">
                                            {error}
                                        </div>
                                    ) : null}

                                    {success ? (
                                        <div className="mt-5 rounded-2xl border border-claude-accent/20 bg-claude-accent/10 px-4 py-3 text-sm leading-relaxed text-claude-accent">
                                            {success}
                                        </div>
                                    ) : null}

                                    <Motion.button
                                        type="button"
                                        whileTap={{ scale: 0.985 }}
                                        onClick={() => handlePurchase(selectedPlan)}
                                        disabled={
                                            loading ||
                                            currentTier === selectedPlan ||
                                            (selectedPlan === 'supporter' && currentTier === 'lifetime') ||
                                            (selectedPlan === 'annual' && currentTier === 'lifetime')
                                        }
                                        className={`tap-action mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-5 py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[#102228] transition-[transform,opacity,color,background-color,border-color,box-shadow] shadow-[0_16px_40px_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:opacity-40 ${PLAN_STYLES[selectedPlan].cta}`}
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                                        ) : currentTier === selectedPlan ? (
                                            'Current plan'
                                        ) : currentTier === 'lifetime' &&
                                          (selectedPlan === 'supporter' || selectedPlan === 'annual') ? (
                                            'Already included'
                                        ) : (
                                            <>
                                                Continue to checkout
                                                <ArrowRight className="h-4 w-4" />
                                            </>
                                        )}
                                    </Motion.button>

                                    <button
                                        type="button"
                                        onClick={handleRestore}
                                        disabled={restoring}
                                        className="tap-action mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-claude-border bg-claude-bg/15 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:border-claude-border hover:text-claude-text disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {restoring ? (
                                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                        ) : (
                                            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                        )}
                                        {restoring ? 'Checking…' : 'Restore purchase'}
                                    </button>

                                    <p className="mt-4 text-center text-xs leading-relaxed text-claude-secondary/50">
                                        Secure checkout via Stripe. Access updates as soon as billing confirms.
                                    </p>
                                </div>
                            </aside>
                        </div>

                        <div className="relative border-t border-claude-border bg-[linear-gradient(180deg,rgba(12,19,24,0.88),rgba(12,19,24,0.98))] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 md:hidden">
                            {error ? (
                                <div className="mb-2 line-clamp-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs leading-snug text-red-200">
                                    {error}
                                </div>
                            ) : null}

                            {success ? (
                                <div className="mb-2 rounded-xl border border-claude-accent/20 bg-claude-accent/10 px-3 py-2 text-xs leading-snug text-claude-accent">
                                    {success}
                                </div>
                            ) : null}

                            <Motion.button
                                type="button"
                                whileTap={{ scale: 0.985 }}
                                onClick={() => handlePurchase(selectedPlan)}
                                disabled={
                                    loading ||
                                    currentTier === selectedPlan ||
                                    (selectedPlan === 'supporter' && currentTier === 'lifetime') ||
                                    (selectedPlan === 'annual' && currentTier === 'lifetime')
                                }
                                className={`tap-action flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#102228] transition-[transform,opacity,color,background-color,border-color,box-shadow] shadow-[0_16px_40px_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:opacity-40 ${PLAN_STYLES[selectedPlan].cta}`}
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                                ) : currentTier === selectedPlan ? (
                                    'Current plan'
                                ) : currentTier === 'lifetime' &&
                                  (selectedPlan === 'supporter' || selectedPlan === 'annual') ? (
                                    'Already included'
                                ) : (
                                    <>
                                        Continue to checkout
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </Motion.button>

                            <button
                                type="button"
                                onClick={handleRestore}
                                disabled={restoring}
                                className="tap-action mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-claude-border bg-claude-bg/15 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:border-claude-border hover:text-claude-text disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {restoring ? (
                                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                ) : (
                                    <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                )}
                                {restoring ? 'Checking…' : 'Restore purchase'}
                            </button>

                            <p className="mt-2 text-center text-[10px] leading-snug text-claude-secondary/50">
                                Secure checkout via Stripe.
                            </p>
                        </div>
                    </Motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
