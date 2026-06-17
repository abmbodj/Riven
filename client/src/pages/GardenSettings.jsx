import { useState, useContext } from 'react';
import { Palette, Clock, Trophy, Sprout, LogIn, Sparkles, Lock, Target, CalendarCheck, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import Garden from '../components/Garden';
import GardenGallery from '../components/GardenGallery';
import { useStreak } from '../hooks/useStreak';
import { gardenStages, getGardenProgress, getStageIndex } from '../utils/gardenCustomization';
import { useNavigate } from 'react-router-dom';
import { GardenContext } from '../context/GardenContext';

const getStatusMessage = (streak) => {
    if (streak.status === 'broken') return 'Study to revive your garden!';
    if (streak.status === 'at-risk') return `${Math.round(streak.hoursRemaining)}h left to water your garden`;
    if (streak.studiedToday) return 'Garden is thriving!';
    return 'Study to grow your garden';
};

const pluralizeDays = (days) => `${days} day${days === 1 ? '' : 's'}`;

const getCareTitle = (streak) => {
    if (streak.status === 'broken') return 'Garden dormant';
    if (streak.studiedToday) return 'Studied Today ✓';
    if (streak.status === 'at-risk') return 'Garden Needs Care';
    return 'Growing window open';
};

// Generate last 7 days for the mini activity heatmap
const getLast7Days = (lastStudyDate, currentStreak) => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
        // Simple heuristic: if streak covers this day, mark as active
        const isActive = currentStreak > i;
        days.push({ label: dayLabel, active: isActive, isToday: i === 0, dateKey: d.toISOString().slice(0, 10) });
    }
    return days;
};

export default function GardenSettings() {
    const { isLoggedIn, isOwner, user } = useAuth();
    const isPremium = user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime';
    const hasOwnerStageOverride = isOwner && !user?.simulate_free_tier;
    const { customization, setStageOverride } = useContext(GardenContext);
    const navigate = useNavigate();
    const streak = useStreak();
    const [showGallery, setShowGallery] = useState(false);

    // Auth gate — require sign-in
    if (!isLoggedIn) {
        return (
            <div className="relative min-h-[calc(100dvh-180px)] flex flex-col items-center justify-center px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                    className="text-center max-w-sm mx-auto"
                >
                    {/* Garden illustration */}
                    <div
                        className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(122,158,114,0.15) 0%, rgba(122,158,114,0.08) 100%)',
                            border: '1px solid rgba(122,158,114,0.12)',
                        }}
                    >
                        <Sprout className="w-10 h-10 text-claude-accent" />
                    </div>

                    <h1 className="text-2xl font-display font-bold italic mb-2">Streak Garden</h1>
                    <p className="text-sm text-claude-secondary mb-8 leading-relaxed">
                        Grow a living garden that evolves with your study streak.
                        Sign in to track your progress and customize your garden.
                    </p>

                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/account')}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold text-sm transition-colors"
                        style={{
                            background: 'var(--accent-color)',
                            color: 'var(--bg-color)',
                        }}
                    >
                        <LogIn className="w-4 h-4" />
                        Sign In to Start
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    const effectiveStreak = (customization?.stageOverride !== undefined && customization?.stageOverride !== null)
        ? gardenStages[customization.stageOverride].minDays
        : streak.currentStreak;

    const displayProgress = getGardenProgress(effectiveStreak);
    const naturalProgress = getGardenProgress(streak.currentStreak);
    const stage = displayProgress.currentStage;
    const weekDays = getLast7Days(streak.lastStudyDate, streak.currentStreak);
    const hasStageOverride = customization?.stageOverride != null;
    const maxStageIndex = gardenStages.length - 1;
    const naturalStageIndex = getStageIndex(streak.currentStreak);
    const nextMilestoneName = naturalProgress.nextStage?.name ?? 'Infinity Loom complete';
    const nextMilestoneMeta = naturalProgress.nextStage
        ? `${pluralizeDays(naturalProgress.daysToNext)} to next stage`
        : 'All garden stages unlocked';

    return (
        <div className="relative min-h-[calc(100dvh-180px)] pb-24">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-accent">
                        <Sparkles className="h-3.5 w-3.5" />
                        Garden Streak
                    </div>
                    <h1 className="font-display text-3xl font-bold italic leading-tight sm:text-4xl">My Garden</h1>
                    <p className="mt-1 text-xs font-mono tracking-wide text-botanical-sepia">{getStatusMessage(streak)}</p>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-claude-accent/25 bg-claude-accent/10 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                    Stage {displayProgress.stageIndex + 1} of {gardenStages.length}
                </div>
            </div>

            <motion.section
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="glass-panel-premium mb-5 overflow-hidden rounded-[1.75rem] p-4 sm:p-5 lg:p-6"
            >
                <div className="relative z-10 grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)] lg:items-stretch">
                    <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-claude-bg/20 sm:min-h-[440px] lg:min-h-[520px]">
                        <div className="pointer-events-none absolute inset-x-8 top-6 h-px bg-gradient-to-r from-transparent via-claude-accent/30 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-10 bottom-7 h-px bg-gradient-to-r from-transparent via-claude-accent/20 to-transparent" />
                        <Garden
                            streak={effectiveStreak}
                            status={streak.status}
                            size="xl"
                            showInfo={false}
                            svgClassName="h-[min(82vw,430px)] w-[min(82vw,430px)] sm:h-[500px] sm:w-[500px] lg:h-[540px] lg:w-[540px]"
                        />
                    </div>

                    <div className="flex flex-col justify-between gap-4">
                        <div className="rounded-[1.35rem] border border-claude-accent/20 bg-claude-accent/[0.08] p-4">
                            <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                <Flame className="h-3.5 w-3.5" />
                                Current streak
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="font-display text-6xl font-bold leading-none text-claude-accent sm:text-7xl">{streak.currentStreak}</span>
                                <span className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-claude-secondary">days</span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-claude-secondary">
                                {hasStageOverride
                                    ? `Previewing ${stage.name}; your natural streak is ${pluralizeDays(streak.currentStreak)}.`
                                    : stage.description}
                            </p>
                        </div>

                        <div className="rounded-[1.35rem] border border-claude-border/40 bg-claude-bg/20 p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-botanical-sepia">
                                        <Target className="h-3.5 w-3.5 text-claude-accent" />
                                        Next milestone
                                    </div>
                                    <div className="mt-1 font-display text-xl font-bold italic text-claude-text">{nextMilestoneName}</div>
                                </div>
                                <span className="rounded-full border border-claude-accent/25 bg-claude-accent/10 px-2.5 py-1 text-[10px] font-mono font-bold text-claude-accent">
                                    {naturalProgress.percent}%
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-claude-bg" aria-label={`${naturalProgress.percent}% progress to ${nextMilestoneName}`}>
                                <div className="h-full rounded-full bg-claude-accent transition-[width] duration-700" style={{ width: `${naturalProgress.percent}%` }} />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                                <span>{naturalProgress.currentStage.name}</span>
                                <span>{nextMilestoneMeta}</span>
                            </div>
                        </div>

                        <div className="rounded-[1.35rem] border border-claude-border/40 bg-claude-bg/20 p-4">
                            <div className="mb-1 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-botanical-sepia">Showing now</div>
                            <div className="font-display text-lg font-semibold italic text-claude-text">{stage.name}</div>
                            <div className="mt-1 text-sm leading-relaxed text-claude-secondary">{stage.description}</div>
                        </div>
                    </div>
                </div>
            </motion.section>

            <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="glass-panel-premium rounded-2xl p-4"
                >
                    <div className="relative z-10 mb-3 flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-botanical-sepia">
                        <CalendarCheck className="h-3.5 w-3.5 text-claude-accent" />
                        This Week
                    </div>
                    <div className="relative z-10 grid grid-cols-7 gap-1.5">
                        {weekDays.map((day) => (
                            <div key={day.dateKey} className="flex min-w-0 flex-col items-center gap-1.5">
                                <div
                                    className={`flex h-8 w-full min-w-0 items-center justify-center rounded-lg text-[10px] font-mono transition-colors ${day.active
                                        ? 'bg-claude-accent/20 text-claude-accent'
                                        : 'bg-claude-bg text-claude-secondary/40'
                                        } ${day.isToday ? 'ring-1 ring-claude-accent/30' : ''}`}
                                >
                                    {day.active ? '✓' : ''}
                                </div>
                                <span className={`text-[9px] font-mono ${day.isToday ? 'text-claude-accent font-bold' : 'text-claude-secondary/60'}`}>
                                    {day.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-panel-premium rounded-2xl p-4"
                >
                    <div className="relative z-10 flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${streak.status === 'at-risk'
                            ? 'bg-yellow-500/12'
                            : streak.status === 'broken'
                                ? 'bg-red-500/10'
                                : 'bg-claude-accent/12'
                            }`}>
                            <Clock className={`h-4 w-4 ${streak.status === 'at-risk'
                                ? 'text-yellow-500'
                                : streak.status === 'broken'
                                    ? 'text-red-300'
                                    : 'text-claude-accent'
                                }`} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-display text-sm font-semibold">{getCareTitle(streak)}</div>
                            <div className="mt-0.5 text-xs font-mono text-claude-secondary">
                                {streak.status === 'broken'
                                    ? 'Study now to revive your garden'
                                    : streak.hoursRemaining > 0
                                        ? `${Math.round(streak.hoursRemaining)}h until garden wilts`
                                        : 'Study now to keep growing!'
                                }
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass-panel-premium rounded-2xl p-5 text-center"
                >
                    <Trophy className="relative z-10 mx-auto mb-2 h-5 w-5 text-yellow-500" />
                    <div className="relative z-10 text-3xl font-display font-bold text-yellow-500">{streak.longestStreak}</div>
                    <div className="relative z-10 mt-1 text-[10px] font-mono uppercase tracking-[0.15em] text-botanical-sepia">Best Streak</div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-panel-premium rounded-2xl p-5 text-center"
                >
                    <Sparkles className="relative z-10 mx-auto mb-2 h-5 w-5 text-claude-accent" />
                    <div className="relative z-10 text-3xl font-display font-bold text-claude-accent">{naturalStageIndex + 1}</div>
                    <div className="relative z-10 mt-1 text-[10px] font-mono uppercase tracking-[0.15em] text-botanical-sepia">Unlocked Stage</div>
                </motion.div>
            </div>

            {/* Stage Selection (Premium or Owner Override) */}
            {isPremium ? (
                (hasOwnerStageOverride || streak.currentStreak >= gardenStages[1].minDays) && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className={`p-4 mb-6 rounded-2xl relative overflow-hidden glass-panel-premium ${hasOwnerStageOverride ? 'border-amber-500/30' : 'border-claude-accent/30'
                            }`}
                    >
                        {hasOwnerStageOverride && (
                            <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-bl-lg">OWNER</div>
                        )}
                        <div className="relative z-10 flex items-center gap-3 mb-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasOwnerStageOverride ? 'bg-amber-500/20' : 'bg-claude-accent/20'
                                }`}>
                                <Palette className={`w-4 h-4 ${hasOwnerStageOverride ? 'text-amber-500' : 'text-claude-accent'}`} />
                            </div>
                            <div>
                                <div className={`font-display font-bold text-sm ${hasOwnerStageOverride ? 'text-amber-500' : 'text-claude-accent'}`}>
                                    {hasOwnerStageOverride ? 'Stage Override' : 'Select Garden Stage'}
                                </div>
                                <div className={`text-xs ${hasOwnerStageOverride ? 'text-amber-500/70' : 'text-claude-accent/70'}`}>
                                    {hasOwnerStageOverride ? `Manually select any garden stage (0-${maxStageIndex})` : 'Revisit stages you have unlocked'}
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 flex flex-col gap-2">
                            <div className="flex justify-between text-xs text-claude-secondary font-mono px-1">
                                <span>Stage 0 (Seed)</span>
                                <span>{hasOwnerStageOverride ? `Stage ${maxStageIndex} (Infinity)` : `Stage ${naturalStageIndex} (Max)`}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max={hasOwnerStageOverride ? maxStageIndex : naturalStageIndex}
                                step="1"
                                value={customization?.stageOverride ?? naturalStageIndex}
                                onChange={(e) => setStageOverride(parseInt(e.target.value, 10))}
                                className={`w-full h-2 bg-claude-bg rounded-lg appearance-none cursor-pointer ${hasOwnerStageOverride ? 'accent-amber-500' : 'accent-claude-accent'
                                    }`}
                            />
                            <div className={`mt-2 text-center text-sm font-display font-semibold italic ${hasOwnerStageOverride ? 'text-amber-400' : 'text-claude-text'
                                }`}>
                                Currently showing: {hasStageOverride ? gardenStages[customization.stageOverride].name : 'Current Max Stage'}
                            </div>
                            {hasStageOverride && (
                                <button
                                    onClick={() => setStageOverride(null)}
                                    className="mt-2 text-xs text-claude-secondary hover:text-claude-text underline decoration-claude-secondary/30 transition-colors"
                                >
                                    Reset to Natural Streak ({streak.currentStreak})
                                </button>
                            )}
                        </div>
                    </motion.div>
                )
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="p-4 mb-6 rounded-2xl relative overflow-hidden glass-panel-premium"
                >
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <Lock className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="flex-1">
                            <div className="font-display font-bold text-sm text-claude-text flex items-center gap-2">
                                Garden Customization
                                <span className="text-[9px] font-mono px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full uppercase">PRO</span>
                            </div>
                            <div className="text-xs text-claude-secondary">Upgrade to customize your garden stages</div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 mb-24">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => isPremium ? setShowGallery(true) : null}
                    className={`w-full p-4 glass-panel-premium rounded-2xl flex items-center gap-4 ${!isPremium ? 'opacity-60' : ''}`}
                >
                    <div className="relative z-10 w-10 h-10 rounded-lg bg-yellow-500/12 flex items-center justify-center">
                        {isPremium ? <Trophy className="w-5 h-5 text-yellow-500" /> : <Lock className="w-5 h-5 text-yellow-500/50" />}
                    </div>
                    <div className="relative z-10 flex-1 text-left">
                        <div className="font-display font-semibold text-sm flex items-center gap-2">
                            Garden Memories
                            {!isPremium && <span className="text-[9px] font-mono px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full uppercase">PRO</span>}
                        </div>
                        <div className="text-xs text-claude-secondary">{isPremium ? 'View your past gardens & achievements' : 'Upgrade to unlock Garden Memories'}</div>
                    </div>
                </motion.button>
            </div>

            {/* Modals */}
            {showGallery && (
                <GardenGallery
                    pastStreaks={streak.pastStreaks}
                    longestStreak={streak.longestStreak}
                    currentStreak={streak.currentStreak}
                    onClose={() => setShowGallery(false)}
                />
            )}
        </div>
    );
}
