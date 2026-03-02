import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Check, ArrowRight, Crown, Zap, Shield } from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { getOfferings, purchase, restorePurchases, ErrorCode } from '../../api/revenueCat';
import { getMe } from '../../api/authApi';
import { AuthContext } from '../../context/AuthContext';

export default function PricingModal({ isOpen, onClose, currentTier = 'free' }) {
    useBodyScrollLock(isOpen);
    const [loading, setLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState('supporter');
    const [offerings, setOfferings] = useState(null);
    const { user } = React.useContext(AuthContext);

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);

        // Fetch live offerings from RevenueCat
        const fetchOfferings = async () => {
            setIsFetching(true);
            try {
                const offs = await getOfferings();
                if (offs && offs.current) {
                    setOfferings(offs.current);
                }
            } catch (err) {
                console.error('Failed to fetch offerings:', err);
                setError('Failed to load pricing packages. Please check your connection.');
            } finally {
                setIsFetching(false);
            }
        };
        fetchOfferings();

        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Cleanup body class on unmount
    useEffect(() => {
        return () => {
            document.body.classList.remove('rc-billing-active');
        };
    }, []);

    const handlePurchase = async (pkgType) => {
        setLoading(true);
        setError(null);
        try {
            if (!offerings) {
                throw new Error('Offerings not loaded yet. Please try again.');
            }

            const pkg = pkgType === 'lifetime' ? offerings.lifetime : offerings.monthly;
            if (!pkg) {
                throw new Error(`Package ${pkgType} not found in current offering.`);
            }

            // Detect if the portal is active
            document.body.classList.add('rc-billing-active');

            const result = await purchase(pkg);

            // Sync user data if purchase returned successfully
            if (result?.customerInfo?.entitlements?.active?.pro) {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const userData = await response.json();
                if (userData.success) {
                    onClose();
                }
            }
        } catch (err) {
            // Handle specific RevenueCat errors
            if (err.errorCode === ErrorCode?.UserCancelledError) {
                console.info('User cancelled the purchase flow.');
                return;
            }

            if (err.errorCode === ErrorCode?.ProductAlreadyPurchasedError || err.message?.includes('already active')) {
                console.info('Product already active, attempting to sync account...');
                setError('Syncing account status...');
                const info = await restorePurchases();
                if (info?.entitlements?.active?.pro) {
                    window.location.reload();
                    return;
                }
            }

            console.error('Purchase failed:', err);
            setError(err.message || 'Purchase failed. Please try again.');
        } finally {
            setLoading(false);
            // Ensure we remove the block-overlay class
            document.body.classList.remove('rc-billing-active');
        }
    };

    if (!isOpen) return null;

    const plans = [
        {
            id: 'supporter',
            name: 'Supporter',
            price: offerings?.monthly?.webBillingProduct?.price?.formattedPrice,
            period: '/month',
            icon: Zap,
            accent: 'claude-accent',
            accentBg: 'claude-accent/10',
            accentBorder: 'claude-accent/40',
            badge: 'Most Popular',
            features: [
                'Unlimited Hearts',
                'Unlimited AI Generations',
                'All PRO Themes',
                'Ad-free Experience',
                'Advanced Study Groups',
            ],
        },
        {
            id: 'lifetime',
            name: 'Lifetime',
            price: offerings?.lifetime?.webBillingProduct?.price?.formattedPrice,
            period: 'once',
            icon: Crown,
            accent: 'amber-500',
            accentBg: 'amber-500/10',
            accentBorder: 'amber-500/40',
            badge: 'Best Value',
            features: [
                'All Supporter Benefits',
                'No Recurring Payments',
                'Exclusive Lifetime Badge',
                'All Future Premium Features',
                'Exclusive Custom Themes',
            ],
        },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[999] flex items-end justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                        className="relative glass-panel w-full max-w-md rounded-t-[2rem] shadow-2xl overflow-hidden flex flex-col"
                        style={{ maxHeight: '92vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div className="w-12 h-1.5 bg-claude-border rounded-full mx-auto mt-3 mb-1 shrink-0" />

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-3 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-claude-accent/15 rounded-xl text-claude-accent">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-display font-bold text-claude-text">Upgrade Riven</h2>
                                    <p className="text-xs text-claude-secondary">Unlock the ultimate learning aesthetic.</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/10 text-claude-secondary hover:text-claude-text transition-colors tap-action"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-5 pb-6 overflow-y-auto custom-scrollbar flex-1">
                            {/* Loading State */}
                            {isFetching && (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="w-10 h-10 border-4 border-claude-accent/30 border-t-claude-accent rounded-full animate-spin" />
                                    <p className="text-sm text-claude-secondary animate-pulse">Fetching latest offerings...</p>
                                </div>
                            )}

                            {/* Plan Cards — Stacked vertically */}
                            {!isFetching && offerings && (
                                <>
                                    {/* Current Plan Banner */}
                                    <div className="flex items-center gap-3 p-3 rounded-xl glass-panel mb-5 border border-claude-border/30">
                                        <Shield className="w-4 h-4 text-claude-secondary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary">Current Plan</span>
                                            <p className="text-sm font-bold text-claude-text capitalize">{currentTier === 'free' ? 'Basic (Free)' : currentTier}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {plans.map((plan) => {
                                            const Icon = plan.icon;
                                            const isSelected = selectedPlan === plan.id;
                                            const isCurrentPlan = currentTier === plan.id;
                                            const isDisabled = isCurrentPlan || (plan.id === 'supporter' && currentTier === 'lifetime');

                                            return (
                                                <motion.button
                                                    key={plan.id}
                                                    onClick={() => !isDisabled && setSelectedPlan(plan.id)}
                                                    whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${isSelected && !isDisabled
                                                        ? `border-${plan.accent} bg-${plan.accentBg}`
                                                        : 'border-claude-border/30 bg-white/[0.03]'
                                                        } ${isDisabled ? 'opacity-50' : ''}`}
                                                >
                                                    {/* Badge */}
                                                    {plan.badge && !isDisabled && (
                                                        <span className={`absolute top-3 right-3 text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-${plan.accentBg} text-${plan.accent} border border-${plan.accentBorder}`}>
                                                            {plan.badge}
                                                        </span>
                                                    )}

                                                    {/* Selection indicator */}
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${isSelected && !isDisabled ? `border-${plan.accent} bg-${plan.accent}` : 'border-claude-border'
                                                            }`}>
                                                            {isSelected && !isDisabled && (
                                                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                                                    <Check className="w-3 h-3 text-white" />
                                                                </motion.div>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Icon className={`w-4 h-4 text-${plan.accent}`} />
                                                                <h3 className="text-base font-bold font-display text-claude-text">{plan.name}</h3>
                                                            </div>

                                                            <div className="flex items-baseline gap-1 mb-3">
                                                                <span className="text-2xl font-bold text-claude-text">{plan.price || '—'}</span>
                                                                <span className="text-xs text-claude-secondary">{plan.period}</span>
                                                            </div>

                                                            <ul className="space-y-2">
                                                                {plan.features.map((feat, i) => (
                                                                    <li key={i} className="flex items-start gap-2 text-xs text-claude-secondary">
                                                                        <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 text-${plan.accent}`} />
                                                                        {feat}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {!isFetching && !offerings && (
                                <div className="text-center py-12">
                                    <p className="text-sm text-claude-secondary mb-4">No active plans found.</p>
                                    <p className="text-[10px] text-claude-secondary/60">Please verify that your RevenueCat dashboard has an offering named "default" with products published for the Web platform.</p>
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-in fade-in slide-in-from-bottom-2">
                                    {error}
                                </div>
                            )}

                            {/* Purchase Button */}
                            <motion.button
                                onClick={() => handlePurchase(selectedPlan)}
                                disabled={loading || currentTier === selectedPlan || (selectedPlan === 'supporter' && currentTier === 'lifetime')}
                                whileTap={{ scale: 0.97 }}
                                className="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-claude-accent to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-claude-accent/20 tap-action"
                            >
                                {loading ? (
                                    <span className="animate-spin text-xl">↻</span>
                                ) : (
                                    <>
                                        Continue with {plans.find(p => p.id === selectedPlan)?.name}
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </motion.button>

                            {/* Restore Purchases — Required by Apple */}
                            <div className="pt-4 text-center">
                                <button
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            const customerInfo = await restorePurchases();
                                            if (customerInfo?.entitlements?.active?.pro) {
                                                setTimeout(() => window.location.reload(), 1500);
                                            } else {
                                                alert('No active purchases found to restore.');
                                            }
                                        } catch (err) {
                                            console.error('Restore failed:', err);
                                            setError('Failed to restore purchases. Please try again.');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    disabled={loading}
                                    className="text-[11px] text-claude-secondary hover:text-claude-text transition-colors underline underline-offset-4 tap-action disabled:opacity-50"
                                >
                                    Restore Purchases
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
