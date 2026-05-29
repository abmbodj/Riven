import React, { useState } from 'react';
import { Shield, Zap, AlertTriangle } from 'lucide-react';

const TIER_STYLES = {
    lifetime: 'text-claude-accent',
    supporter: 'text-botanical-forest',
    free: 'text-claude-secondary'
};

export default function AccountTab({ user, isOwner, toggleSimulateFree, toast }) {
    const [toggling, setToggling] = useState(false);
    const simulatingFree = !!user?.simulate_free_tier;
    const currentTier = user?.subscription_tier || 'free';

    const handleToggle = async () => {
        setToggling(true);
        try {
            await toggleSimulateFree();
        } catch (err) {
            console.error(err);
            toast.error(err?.message || 'Failed to update simulate-free mode');
        } finally {
            setToggling(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Subscription Status */}
            <div className="p-5 rounded-2xl glass-panel border border-claude-border relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(222,185,106,0.06) 0%, transparent 70%)' }} />
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />

                <div className="relative z-10">
                    <h3 className="text-[9px] font-mono text-claude-secondary uppercase tracking-[0.25em] mb-4 flex items-center gap-2 font-bold">
                        <Shield className="w-3.5 h-3.5 text-claude-accent" />
                        Subscription Status
                    </h3>
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`text-3xl font-serif font-bold italic tracking-tight capitalize ${TIER_STYLES[currentTier] || TIER_STYLES.free}`}>
                            {currentTier}
                        </span>
                        {isOwner && !simulatingFree && (
                            <span className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-claude-accent/15 text-claude-accent uppercase tracking-widest font-mono border border-claude-accent/20">
                                Owner
                            </span>
                        )}
                        {simulatingFree && (
                            <span className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-red-500/15 text-red-400 uppercase tracking-widest font-mono border border-red-500/20 animate-pulse">
                                Simulated
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-claude-secondary leading-relaxed">
                        {simulatingFree
                            ? 'You are currently experiencing Riven as a free-tier user.'
                            : 'As the owner, you have permanent Lifetime access.'}
                    </p>
                </div>
            </div>

            {/* Simulate Free Toggle */}
            {isOwner && (
                <div className="p-5 rounded-2xl glass-panel border border-claude-border relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />

                    <div className="relative z-10">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="text-sm font-serif italic text-claude-text tracking-tight mb-1.5 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-claude-accent" />
                                    Simulate Free User
                                </h3>
                                <p className="text-[11px] text-claude-secondary leading-relaxed">
                                    Toggle to experience Riven as a free-tier user — limited hearts, generation caps, theme locks, and group restrictions apply.
                                </p>
                            </div>
                            <button
                                onClick={handleToggle}
                                disabled={toggling}
                                aria-label={simulatingFree ? 'Disable free user simulation' : 'Enable free user simulation'}
                                className={`relative w-14 h-8 rounded-full transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 shrink-0 tap-action focus-visible:ring-2 focus-visible:ring-claude-accent/60 ${simulatingFree
                                    ? 'bg-claude-accent shadow-botanical-glow'
                                    : 'bg-claude-border'
                                } ${toggling ? 'opacity-50' : ''}`}
                            >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-[left] duration-300 ${simulatingFree ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {simulatingFree && (
                            <div className="mt-4 p-3.5 rounded-xl bg-red-900/15 border border-red-500/20 text-red-300/80 text-[11px] flex items-start gap-2.5 leading-relaxed">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                                <span>Free mode is active. You will see hearts, limits, and paywalls. Toggle off to restore Lifetime access.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
