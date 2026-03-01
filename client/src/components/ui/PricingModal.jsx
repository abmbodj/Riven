import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Check, ArrowRight } from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

// RevenueCat would be imported here in the future
// import { Purchases } from '@revenuecat/purchases-capacitor';

export default function PricingModal({ isOpen, onClose, currentTier = 'free' }) {
    useBodyScrollLock(isOpen);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const handlePurchase = async (pkgType) => {
        setLoading(true);
        setError(null);
        try {
            // Placeholder for real RevenueCat logic
            /*
            if (Capacitor.isNativePlatform()) {
               const offerings = await Purchases.getOfferings();
               if (offerings.current !== null) {
                   const pkg = pkgType === 'lifetime' ? offerings.current.lifetime : offerings.current.monthly;
                   const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
                   if (typeof customerInfo.entitlements.active['pro'] !== 'undefined') {
                       // Success!
                       window.location.reload();
                   }
               }
            } else { ... mock success ... }
            */

            // Development Native Bypass / Web Stub
            setTimeout(() => {
                alert(`Mock Purchase Successful for ${pkgType}! RevenueCat webhook would fire and grant access.`);
                setLoading(false);
                onClose();
            }, 1000);

        } catch (err) {
            console.error('Purchase failed', err);
            setError('Purchase canceled or failed. Please try again.');
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4">
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
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative glass-panel w-full sm:max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-claude-border/30 bg-claude-bg/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-claude-accent/20 rounded-xl text-claude-accent">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-display font-bold text-claude-text">Upgrade Riven</h2>
                                    <p className="text-sm text-claude-secondary">Unlock the ultimate learning aesthetic.</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/10 text-claude-secondary hover:text-claude-text transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content area */}
                        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
                            {error && (
                                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Free Tier */}
                                <div className="relative flex flex-col p-6 rounded-2xl border border-claude-border/40 bg-white/5 backdrop-blur-md">
                                    <h3 className="text-xl font-bold font-display text-claude-secondary mb-2">Basic</h3>
                                    <div className="flex items-baseline gap-1 mb-6">
                                        <span className="text-3xl font-bold text-claude-text">$0</span>
                                        <span className="text-claude-secondary">/ forever</span>
                                    </div>
                                    <ul className="flex-1 space-y-4 mb-6 text-sm text-claude-secondary">
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> Limited Hearts (Refill over time)</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> 15 AI Generations / 2hrs</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> Create unlimited decks</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> Standard Canvas Sync</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> Ads included</li>
                                    </ul>
                                    <button disabled className="w-full py-3 rounded-xl border border-claude-border text-claude-secondary opacity-50 cursor-not-allowed font-medium">
                                        Current Plan
                                    </button>
                                </div>

                                {/* Supporter Tier */}
                                <div className="relative flex flex-col p-6 rounded-2xl border-2 border-claude-accent bg-claude-accent/5 backdrop-blur-md transform md:-translate-y-4 shadow-xl shadow-claude-accent/10">
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-claude-accent text-white text-xs font-bold rounded-full uppercase tracking-wider">
                                        Most Popular
                                    </div>
                                    <h3 className="text-xl font-bold font-display text-claude-accent mb-2">Supporter</h3>
                                    <div className="flex items-baseline gap-1 mb-1">
                                        <span className="text-4xl font-bold text-claude-text">$5.99</span>
                                        <span className="text-claude-secondary">/ month</span>
                                    </div>
                                    <p className="text-xs text-claude-secondary mb-6 line-through">Cancel anytime</p>

                                    <ul className="flex-1 space-y-4 mb-6 text-sm text-claude-text">
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-claude-accent shrink-0" /> <strong>Unlimited Hearts</strong> (Never lose a session)</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-claude-accent shrink-0" /> <strong>Unlimited AI Generations</strong></li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-claude-accent shrink-0" /> All PRO Themes Unlocked</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-claude-accent shrink-0" /> Ad-free experience</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-claude-accent shrink-0" /> Advanced Study Groups</li>
                                    </ul>

                                    <button
                                        onClick={() => handlePurchase('supporter')}
                                        disabled={loading || currentTier === 'supporter' || currentTier === 'lifetime'}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-claude-accent to-indigo-500 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <span className="animate-spin text-xl">↻</span> : (currentTier === 'supporter' ? 'Current Plan' : 'Go Supporter')}
                                        {!loading && currentTier !== 'supporter' && <ArrowRight className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Lifetime Tier */}
                                <div className="relative flex flex-col p-6 rounded-2xl border border-claude-border/40 bg-gradient-to-b from-amber-500/10 to-transparent backdrop-blur-md">
                                    <h3 className="text-xl font-bold font-display text-amber-500 mb-2">Lifetime</h3>
                                    <div className="flex items-baseline gap-1 mb-1">
                                        <span className="text-3xl font-bold text-claude-text">$29.99</span>
                                    </div>
                                    <p className="text-xs text-claude-secondary mb-6">One-time payment</p>

                                    <ul className="flex-1 space-y-4 mb-6 text-sm text-claude-text">
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" /> <strong>All Supporter Benefits</strong></li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" /> <strong>No Recurring Payments</strong></li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" /> Exclusive Lifetime Badge</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" /> All Future Premium Features</li>
                                        <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" /> Exclusive Custom Themes</li>
                                    </ul>

                                    <button
                                        onClick={() => handlePurchase('lifetime')}
                                        disabled={loading || currentTier === 'lifetime'}
                                        className="w-full py-3 rounded-xl bg-white/10 border border-amber-500/30 text-amber-500 font-bold hover:bg-amber-500/10 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <span className="animate-spin text-xl">↻</span> : (currentTier === 'lifetime' ? 'Active' : 'Get Lifetime')}
                                    </button>
                                </div>
                            </div>

                            {/* Restore Purchases — Required by Apple */}
                            <div className="pt-4 border-t border-white/5 text-center">
                                <button
                                    onClick={() => {
                                        // TODO: Wire to RevenueCat restore purchases
                                        alert('Restore purchases will work once App Store integration is live.');
                                    }}
                                    className="text-xs text-claude-secondary hover:text-claude-text transition-colors underline underline-offset-4"
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
