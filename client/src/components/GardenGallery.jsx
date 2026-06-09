import { useState, useEffect, useContext, useMemo } from 'react';
import {
    Calendar,
    ChevronDown,
    Crown,
    Flower2,
    Leaf,
    Sparkles,
    Sprout,
    TreePine,
    Trophy,
    X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UIContext } from '../context/UIContext';
import { getGardenStage } from '../utils/gardenCustomization';

const CURRENT_YEAR = new Date().getFullYear();

const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== CURRENT_YEAR ? 'numeric' : undefined,
    });
};

const formatDateRange = (startDate, endDate) => {
    if (!startDate && !endDate) return 'Dates unavailable';
    if (!endDate || startDate === endDate) return formatDate(startDate || endDate);
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

const getMemoryAchievements = (streak) => {
    const badges = [];
    if (streak >= 7) badges.push({ label: 'Week Gardener', Icon: Sprout, tone: 'emerald' });
    if (streak >= 14) badges.push({ label: 'Green Thumb', Icon: Leaf, tone: 'lime' });
    if (streak >= 30) badges.push({ label: 'Tree Planter', Icon: TreePine, tone: 'amber' });
    if (streak >= 60) badges.push({ label: 'Master Gardener', Icon: Flower2, tone: 'rose' });
    if (streak >= 100) badges.push({ label: 'Eden Creator', Icon: Crown, tone: 'violet' });
    return badges;
};

const getStageVisual = (streak) => {
    if (streak >= 365) {
        return {
            Icon: Crown,
            accentClass: 'text-violet-200',
            accentGlow: 'from-violet-400/24 via-violet-300/10 to-transparent',
            borderClass: 'border-violet-300/24',
        };
    }
    if (streak >= 100) {
        return {
            Icon: Sparkles,
            accentClass: 'text-amber-200',
            accentGlow: 'from-amber-300/24 via-amber-200/12 to-transparent',
            borderClass: 'border-amber-300/24',
        };
    }
    if (streak >= 30) {
        return {
            Icon: Flower2,
            accentClass: 'text-rose-200',
            accentGlow: 'from-rose-300/24 via-rose-200/12 to-transparent',
            borderClass: 'border-rose-300/20',
        };
    }
    if (streak >= 7) {
        return {
            Icon: Leaf,
            accentClass: 'text-emerald-200',
            accentGlow: 'from-emerald-300/24 via-emerald-200/12 to-transparent',
            borderClass: 'border-emerald-300/20',
        };
    }
    if (streak >= 3) {
        return {
            Icon: Sprout,
            accentClass: 'text-teal-200',
            accentGlow: 'from-teal-300/24 via-teal-200/12 to-transparent',
            borderClass: 'border-teal-300/20',
        };
    }
    return {
        Icon: Sprout,
        accentClass: 'text-[#deb96a]',
        accentGlow: 'from-[#deb96a]/24 via-[#deb96a]/10 to-transparent',
        borderClass: 'border-white/10',
    };
};

const getMetricTone = (variant) => {
    switch (variant) {
        case 'current':
            return {
                valueClass: 'text-emerald-200',
                glowClass: 'from-emerald-400/20 via-emerald-300/8 to-transparent',
            };
        case 'best':
            return {
                valueClass: 'text-[#f0cf7c]',
                glowClass: 'from-[#deb96a]/22 via-[#deb96a]/10 to-transparent',
            };
        default:
            return {
                valueClass: 'text-[#f7f3ea]',
                glowClass: 'from-white/12 via-white/5 to-transparent',
            };
    }
};

function SummaryMetric({ label, value, detail, variant }) {
    const tone = getMetricTone(variant);

    return (
        <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-4 py-4 text-left shadow-[0_12px_30px_rgba(2,6,10,0.22)]">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glowClass}`} />
            <div className="relative z-10 space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-claude-secondary/90">{label}</div>
                <div className={`text-[1.8rem] leading-none font-display font-semibold ${tone.valueClass}`}>{value}</div>
                <div className="text-xs text-claude-secondary">{detail}</div>
            </div>
        </div>
    );
}

export default function GardenGallery({ pastStreaks = [], longestStreak = 0, currentStreak = 0, onClose }) {
    const [selectedMemoryId, setSelectedMemoryId] = useState(null);
    const { hideNav, showBottomNav } = useContext(UIContext);

    useEffect(() => {
        hideNav();
        return () => showBottomNav();
    }, [hideNav, showBottomNav]);

    const memories = useMemo(() => (
        [...pastStreaks]
            .map((past, index) => ({
                ...past,
                memoryId: `${past.startDate || 'unknown'}-${past.endDate || 'open'}-${past.streak}-${index}`,
            }))
            .sort((left, right) => {
                if (right.streak !== left.streak) return right.streak - left.streak;
                return new Date(right.endDate || right.startDate || 0).getTime()
                    - new Date(left.endDate || left.startDate || 0).getTime();
            })
    ), [pastStreaks]);

    const handleDragEnd = (_, info) => {
        if (info.offset.y > 100) {
            onClose?.();
        }
    };

    const toggleMemory = (memoryId) => {
        setSelectedMemoryId((current) => (current === memoryId ? null : memoryId));
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-end justify-center bg-[radial-gradient(circle_at_top,rgba(25,39,43,0.56),rgba(2,5,8,0.88)_58%)] px-0 pb-0 pt-6 sm:items-center sm:px-5 sm:py-8"
                onClick={(event) => event.target === event.currentTarget && onClose?.()}
            >
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0, bottom: 0.45 }}
                    onDragEnd={handleDragEnd}
                    className="glass-panel-premium relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border-white/12 sm:h-auto sm:max-h-[84vh] sm:max-w-3xl sm:rounded-[2rem]"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
                        <div className="h-1 w-10 rounded-full bg-white/20" />
                    </div>

                    <div className="relative z-10 border-b border-white/8 px-5 pb-5 pt-4 sm:px-7 sm:pb-6 sm:pt-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-4">
                                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.15rem] border border-emerald-300/18 bg-[linear-gradient(145deg,rgba(103,170,135,0.18),rgba(24,41,41,0.7))] shadow-[0_16px_34px_rgba(3,10,10,0.24)]">
                                    <div className="pointer-events-none absolute inset-0 rounded-[1.15rem] bg-[radial-gradient(circle_at_top,rgba(180,255,217,0.18),transparent_58%)]" />
                                    <Sprout className="relative z-10 h-5 w-5 text-emerald-200" />
                                </div>
                                <div className="min-w-0">
                                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-claude-secondary/85">
                                        Memory archive
                                    </div>
                                    <h2 className="text-[1.45rem] font-display font-semibold leading-tight text-claude-text sm:text-[1.65rem]">
                                        Garden Memories
                                    </h2>
                                    <p className="mt-1 max-w-xl text-sm leading-6 text-claude-secondary">
                                        Your streak milestones, garden eras, and the study seasons that shaped them.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close Garden Memories"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:text-claude-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <SummaryMetric label="Current" value={currentStreak} detail="Day rhythm in progress" variant="current" />
                            <SummaryMetric label="Best" value={longestStreak} detail="Personal garden record" variant="best" />
                            <SummaryMetric label="Gardens" value={memories.length} detail="Captured streak memories" variant="count" />
                        </div>
                    </div>

                    <div
                        className="relative z-10 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}
                    >
                        {memories.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-panel-premium relative mx-auto mt-4 max-w-xl overflow-hidden rounded-[1.9rem] border border-white/10 px-6 py-10 text-center sm:px-10 sm:py-12"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(122,158,114,0.16),transparent_42%),radial-gradient(circle_at_bottom,rgba(222,185,106,0.12),transparent_50%)]" />
                                <div className="relative z-10">
                                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-white/10 bg-white/[0.04] shadow-[0_20px_40px_rgba(3,8,12,0.22)]">
                                        <Sprout className="h-9 w-9 text-emerald-200" />
                                    </div>
                                    <p className="font-display text-2xl font-semibold text-claude-text">No garden memories yet</p>
                                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-claude-secondary">
                                        Keep your streak alive and each completed garden will land here as a new milestone in your archive.
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="space-y-3">
                                {memories.map((memory, index) => {
                                    const isExpanded = selectedMemoryId === memory.memoryId;
                                    const isRecord = memory.streak === longestStreak && longestStreak > 0;
                                    const stage = getGardenStage(memory.streak);
                                    const achievements = getMemoryAchievements(memory.streak);
                                    const visual = getStageVisual(memory.streak);
                                    const StageIcon = visual.Icon;

                                    return (
                                        <motion.button
                                            key={memory.memoryId}
                                            type="button"
                                            initial={{ opacity: 0, y: 14 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.04 }}
                                            onClick={() => toggleMemory(memory.memoryId)}
                                            aria-expanded={isExpanded}
                                            className={`group glass-panel-premium relative w-full overflow-hidden rounded-[1.7rem] border p-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 sm:p-5 ${isRecord ? 'border-[#deb96a]/36' : visual.borderClass}`}
                                        >
                                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${visual.accentGlow}`} />
                                            <div className="relative z-10">
                                                <div className="flex items-start gap-4">
                                                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border border-white/10 bg-white/[0.045] shadow-[0_16px_34px_rgba(3,8,12,0.2)]">
                                                        <StageIcon className={`h-6 w-6 ${visual.accentClass}`} />
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-display text-[1.45rem] font-semibold leading-none text-claude-text">
                                                                {memory.streak} day{memory.streak === 1 ? '' : 's'}
                                                            </span>
                                                            {isRecord && (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-[#deb96a]/35 bg-[#deb96a]/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f0cf7c]">
                                                                    <Trophy className="h-3 w-3" />
                                                                    Best
                                                                </span>
                                                            )}
                                                            {achievements.length > 0 && (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-claude-secondary">
                                                                    {achievements.length} milestone{achievements.length === 1 ? '' : 's'}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                                                            <span className="font-medium text-claude-text/92">{stage.name}</span>
                                                            <span className="text-claude-secondary">Garden era</span>
                                                        </div>

                                                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-claude-secondary">
                                                            <span className="inline-flex items-center gap-2">
                                                                <Calendar className="h-4 w-4" />
                                                                {formatDateRange(memory.startDate, memory.endDate)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex shrink-0 items-center gap-2 self-center text-claude-secondary">
                                                        <span className="hidden text-[11px] uppercase tracking-[0.22em] sm:inline">
                                                            {isExpanded ? 'Less' : 'More'}
                                                        </span>
                                                        <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </div>

                                                <AnimatePresence initial={false}>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.22, ease: 'easeOut' }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="mt-4 border-t border-white/8 pt-4">
                                                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
                                                                    <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
                                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-claude-secondary/85">
                                                                            Season note
                                                                        </div>
                                                                        <p className="mt-2 text-sm leading-6 text-claude-secondary">
                                                                            {stage.description}
                                                                        </p>
                                                                    </div>

                                                                    <div className="rounded-[1.2rem] border border-white/8 bg-black/10 px-4 py-3">
                                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-claude-secondary/85">
                                                                            Dates
                                                                        </div>
                                                                        <p className="mt-2 text-sm leading-6 text-claude-secondary">
                                                                            {formatDate(memory.startDate)} to {formatDate(memory.endDate || memory.startDate)}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {achievements.length > 0 && (
                                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                                        {achievements.map((badge) => {
                                                                            const BadgeIcon = badge.Icon;
                                                                            return (
                                                                                <span
                                                                                    key={badge.label}
                                                                                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs text-claude-text"
                                                                                >
                                                                                    <BadgeIcon className="h-3.5 w-3.5 text-[#deb96a]" />
                                                                                    {badge.label}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
