import React, { useState } from 'react';
import { AlertTriangle, BadgeCheck, Crown, Mail, Shield, UserRound, Zap } from 'lucide-react';

const TIER_STYLES = {
    lifetime: 'text-claude-accent',
    supporter: 'text-botanical-forest',
    free: 'text-claude-secondary',
};

const normalizeTier = (user) => user?.subscription_tier || user?.subscriptionTier || 'free';

export default function AccountTab({ user, isOwner, toggleSimulateFree, toast }) {
    const [toggling, setToggling] = useState(false);
    const simulatingFree = !!user?.simulate_free_tier;
    const currentTier = normalizeTier(user);
    const username = user?.username || 'Admin';
    const email = user?.email || 'No email on file';

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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section className="glass-panel-premium overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
                <div className="relative z-10">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <p className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                <Shield className="h-3.5 w-3.5 text-claude-accent" />
                                Operator identity
                            </p>
                            <h2 className="mt-2 text-2xl font-serif font-bold italic tracking-tight text-claude-text">
                                {username}
                            </h2>
                        </div>
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/45">
                            {isOwner ? <Crown className="h-6 w-6 text-claude-accent" /> : <UserRound className="h-6 w-6 text-claude-secondary" />}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-claude-bg/35 px-3.5 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <BadgeCheck className="h-4 w-4 shrink-0 text-claude-accent" />
                                <div className="min-w-0">
                                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">Role</p>
                                    <p className="mt-0.5 text-sm font-semibold text-claude-text">{isOwner ? 'Owner' : 'Admin'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-claude-bg/35 px-3.5 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <Mail className="h-4 w-4 shrink-0 text-claude-accent" />
                                <div className="min-w-0">
                                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">Email</p>
                                    <p className="mt-0.5 truncate text-sm font-semibold text-claude-text">{email}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.15rem] border border-white/10 bg-claude-bg/35 px-3.5 py-3">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                Subscription
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`text-3xl font-serif font-bold italic tracking-tight capitalize ${TIER_STYLES[currentTier] || TIER_STYLES.free}`}>
                                    {currentTier}
                                </span>
                                {isOwner && !simulatingFree && (
                                    <span className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                        Owner
                                    </span>
                                )}
                                {simulatingFree && (
                                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-red-400">
                                        Simulated
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {isOwner && (
                <section className="glass-panel-premium overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
                    <div className="relative z-10">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <p className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary">
                                    <Zap className="h-3.5 w-3.5 text-claude-accent" />
                                    Tier simulation
                                </p>
                                <h2 className="mt-2 text-2xl font-serif font-bold italic tracking-tight text-claude-text">
                                    Simulate Free User
                                </h2>
                                <p className="mt-3 max-w-xl text-sm leading-relaxed text-claude-secondary">
                                    Toggle to experience Riven as a free-tier user. Hearts, generation caps, theme locks, and group restrictions apply.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleToggle}
                                disabled={toggling}
                                aria-label={simulatingFree ? 'Disable free user simulation' : 'Enable free user simulation'}
                                className={`tap-action relative h-8 w-14 shrink-0 rounded-full transition-[transform,opacity,color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-claude-accent/60 ${
                                    simulatingFree
                                        ? 'bg-claude-accent shadow-botanical-glow'
                                        : 'bg-claude-border'
                                } ${toggling ? 'opacity-50' : ''}`}
                            >
                                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-[left] duration-300 ${simulatingFree ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {simulatingFree ? (
                            <div className="mt-5 rounded-[1.15rem] border border-red-500/20 bg-red-500/10 p-4 text-sm leading-relaxed text-red-300/90">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                                    <span>Free mode is active. Toggle off to restore Lifetime access.</span>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-5 rounded-[1.15rem] border border-botanical-forest/20 bg-botanical-forest/10 p-4 text-sm leading-relaxed text-botanical-forest">
                                Simulation is off. You are seeing the owner experience.
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
