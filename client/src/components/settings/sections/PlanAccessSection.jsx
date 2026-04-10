import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Gift, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { api } from '../../../api';
import { referralCodeSchema } from '../../../schemas/forms';
import SectionHeader from '../SectionHeader';
import SectionCard from '../SectionCard';
import StatusNotice from '../StatusNotice';

export default function PlanAccessSection({ user, openModal, onRestorePurchases }) {
    const isPremium = user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime';

    return (
        <div className="space-y-6">
            <div>
                <SectionHeader
                    eyebrow="Membership"
                    title="Plan & access"
                    description="Manage your subscription, restore purchases, and check premium status."
                    tone="accent"
                />
                <SectionCard tone="accent" className="space-y-4 p-5 sm:p-6 xl:p-5">
                    <div className="flex items-start gap-4 sm:items-center">
                        <div className="p-3 rounded-2xl bg-claude-accent/10 border border-claude-accent/20 shadow-inner">
                            <Sparkles className="w-6 h-6 text-claude-accent" />
                        </div>
                        <div className="flex-1">
                            <h3 className="flex flex-col items-start gap-2 font-display text-lg font-semibold tracking-wide text-claude-text sm:flex-row sm:items-center sm:justify-between">
                                Current Plan
                                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border uppercase ${isPremium ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-claude-secondary/10 text-claude-secondary/80 border-claude-secondary/20'}`}>
                                    {user?.subscription_tier || 'Free'}
                                </span>
                            </h3>
                            <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                                {user?.subscription_tier === 'free' || !user?.subscription_tier ? 'Free plan currently active' : 'Premium access active'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                        <button
                            onClick={() => openModal('pricing')}
                            className="tap-action flex-1 rounded-[1.1rem] bg-claude-text px-4 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 active:scale-[0.98]"
                        >
                            Upgrade Riven
                        </button>
                        <button
                            aria-label="Restore purchases"
                            onClick={onRestorePurchases}
                            className="tap-action flex items-center justify-center gap-2 rounded-[1.1rem] border border-claude-border/70 bg-claude-bg/55 px-4 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/35 hover:text-claude-text active:scale-[0.98] sm:flex-none"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Restore purchases</span>
                        </button>
                    </div>
                </SectionCard>
            </div>

            <ReferralCard />
        </div>
    );
}

function ReferralCard() {
    const { user } = useAuth();
    const [referralInfo, setReferralInfo] = useState(null);
    const [applyCode, setApplyCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [applying, setApplying] = useState(false);
    const [referralNotice, setReferralNotice] = useState(null);
    const toast = useToast();
    const progressPercent = referralInfo ? Math.min(100, (referralInfo.qualifiedCount / referralInfo.targetCount) * 100) : 0;
    const remainingReferrals = referralInfo ? Math.max(0, referralInfo.targetCount - referralInfo.qualifiedCount) : 0;

    useEffect(() => {
        if (user?.subscription_tier && user.subscription_tier !== 'free') {
            return;
        }

        api.getReferralInfo().then(data => {
            if (data) setReferralInfo(data);
        }).catch(() => { });
    }, [user?.subscription_tier]);

    if (user?.subscription_tier && user.subscription_tier !== 'free') return null;

    const handleCopy = () => {
        if (referralInfo?.referralCode) {
            navigator.clipboard.writeText(referralInfo.referralCode);
            setCopied(true);
            setReferralNotice({
                tone: 'success',
                title: 'Code copied',
                detail: 'Share it with a friend so they can join with your referral code.'
            });
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleApply = async () => {
        const result = referralCodeSchema.safeParse(applyCode.trim());
        if (!result.success) {
            toast.error(result.error.errors[0]?.message || 'Invalid referral code');
            return;
        }
        setApplying(true);
        try {
            await api.applyReferralCode(result.data);
            toast.success('Referral code applied!');
            setApplyCode('');
            setReferralNotice({
                tone: 'success',
                title: 'Referral code applied',
                detail: 'Your account will credit the referral after the eligibility requirements are met.'
            });
        } catch (err) {
            toast.error(err.message || 'Failed to apply code');
            setReferralNotice({
                tone: 'error',
                title: 'Code could not be applied',
                detail: err.message || 'Check the referral code and try again.'
            });
        } finally {
            setApplying(false);
        }
    };

    if (!referralInfo) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <SectionHeader
                eyebrow="Membership"
                title="Invite friends"
                description="Track referral progress and share or apply referral codes."
                tone="pink"
            />
            <SectionCard tone="pink" className="space-y-5 p-5 sm:p-6 xl:p-5">
                <div className="flex items-start gap-4 sm:items-center">
                    <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 shadow-inner">
                        <Gift className="w-6 h-6 text-pink-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display text-base font-bold text-claude-text">
                            Earn Lifetime Free
                        </h3>
                        <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                            Invite 5 friends who use Riven &rarr; free Lifetime membership
                        </p>
                    </div>
                </div>

                <StatusNotice
                    title={referralInfo.rewardEarned ? 'Reward unlocked' : `${remainingReferrals} invites to go`}
                    detail={referralInfo.rewardEarned
                        ? 'Your referrals already earned Lifetime access.'
                        : "Share your code, track qualified signups, or apply a friend's code below."}
                />

                <div className="rounded-[1.5rem] border border-claude-border bg-claude-bg/70 p-4">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Your Referral Code</p>
                            <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">Share this with friends who are joining Riven.</p>
                        </div>
                        <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-pink-400">
                            Share
                        </span>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1 rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-center font-mono text-base font-bold tracking-[0.22em] text-claude-text sm:text-lg sm:tracking-[0.3em]">
                            {referralInfo.referralCode}
                        </div>
                        <button
                            onClick={handleCopy}
                            className="min-h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 px-4 py-3 text-pink-400 hover:border-pink-400/30 hover:bg-pink-400/5 transition-[transform,opacity,color,background-color,border-color,box-shadow] font-mono text-[11px] uppercase tracking-[0.16em] font-bold flex items-center justify-center gap-2"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-pink-400" />}
                            {copied ? 'Copied' : 'Copy code'}
                        </button>
                    </div>
                </div>

                <div className="rounded-[1.5rem] border border-claude-border bg-claude-bg/70 p-4">
                    <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Progress</p>
                            <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">
                                {referralInfo.rewardEarned ? 'All referral milestones completed.' : `${remainingReferrals} more qualified referral${remainingReferrals === 1 ? '' : 's'} until Lifetime.`}
                            </p>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-claude-text whitespace-nowrap">{referralInfo.qualifiedCount} / {referralInfo.targetCount}</span>
                    </div>
                    <div className="w-full h-2 bg-claude-bg rounded-full overflow-hidden border border-claude-border">
                        <div
                            className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-700"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    {referralInfo.rewardEarned && (
                        <p className="text-[11px] font-mono text-green-400 mt-2 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Lifetime earned! 🎉
                        </p>
                    )}
                </div>

                <div className="pt-2 border-t border-claude-border">
                    <div className="mb-3">
                        <p className="text-[10px] font-mono uppercase text-claude-secondary tracking-wider">Have a referral code?</p>
                        <p className="mt-1 text-[11px] font-mono text-claude-secondary/70">
                            Apply a friend&apos;s code before you qualify on your own invite path.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="text"
                            value={applyCode}
                            onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                            placeholder="ENTER CODE"
                            maxLength={8}
                            className="flex-1 min-h-12 bg-claude-bg border border-claude-border rounded-xl px-3 py-2.5 text-sm font-mono text-claude-text placeholder-claude-secondary/50 focus:outline-none focus:border-pink-400/50"
                        />
                        <button
                            onClick={handleApply}
                            disabled={applying || !applyCode.trim()}
                            className="min-h-12 px-4 py-2.5 rounded-xl bg-pink-500/10 text-pink-400 font-mono text-[11px] uppercase tracking-wider font-bold hover:bg-pink-500/20 disabled:opacity-30 transition-[transform,opacity,color,background-color,border-color,box-shadow]"
                        >
                            {applying ? 'Applying...' : 'Apply Code'}
                        </button>
                    </div>
                    {referralNotice && (
                        <div className="mt-3">
                            <StatusNotice
                                tone={referralNotice.tone}
                                title={referralNotice.title}
                                detail={referralNotice.detail}
                            />
                        </div>
                    )}
                </div>
            </SectionCard>
        </motion.div>
    );
}
