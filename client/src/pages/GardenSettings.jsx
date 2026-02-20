import { useState, useContext } from 'react';
import { Palette, Clock, Trophy, Sprout, LogIn } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { AuthContext } from '../context/AuthContext';
import Garden from '../components/Garden';
import GardenGallery from '../components/GardenGallery';
import { useStreak } from '../hooks/useStreak';
import { getGardenStage, gardenStages, getStageIndex } from '../utils/gardenCustomization';
import { useNavigate } from 'react-router-dom';
import { GardenContext } from '../context/GardenContext';

const getStatusMessage = (streak) => {
    if (streak.status === 'broken') return 'Study to revive your garden!';
    if (streak.status === 'at-risk') return `${Math.round(streak.hoursRemaining)}h left to water your garden`;
    if (streak.studiedToday) return 'Garden is thriving!';
    return 'Study to grow your garden';
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
        days.push({ label: dayLabel, active: isActive, isToday: i === 0 });
    }
    return days;
};

export default function GardenSettings() {
    const { isLoggedIn, isOwner } = useContext(AuthContext);
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

    const stage = getGardenStage(effectiveStreak);
    const weekDays = getLast7Days(streak.lastStudyDate, streak.currentStreak);

    return (
        <div className="relative min-h-[calc(100dvh-180px)]">
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-2xl font-display font-bold italic mb-1">My Garden</h1>
                <p className="text-xs font-mono text-botanical-sepia tracking-wide">{getStatusMessage(streak)}</p>
            </div>

            {/* Garden Preview */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex flex-col items-center mb-6"
            >
                <div
                    className="relative rounded-2xl p-6 w-full flex flex-col items-center"
                    style={{
                        background: 'linear-gradient(180deg, rgba(122,158,114,0.1) 0%, rgba(122,158,114,0.04) 60%, transparent 100%)',
                        border: '1px solid rgba(122,158,114,0.08)',
                    }}
                >
                    {/* Corner marks */}
                    <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-claude-accent/15" />
                    <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-claude-accent/15" />
                    <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-claude-accent/15" />
                    <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-claude-accent/15" />

                    <Garden
                        streak={effectiveStreak}
                        status={streak.status}
                        size="xl"
                        showInfo={true}
                    />

                    <div className="mt-4 text-center">
                        <div className="font-display text-lg font-semibold italic">{stage.name}</div>
                        <div className="text-sm text-claude-secondary">{stage.description}</div>
                    </div>
                </div>
            </motion.div>

            {/* 7-Day Activity Bar */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="botanical-card p-4 mb-6"
            >
                <div className="text-[10px] font-mono text-botanical-sepia uppercase tracking-[0.15em] mb-3">This Week</div>
                <div className="flex items-center justify-between gap-1">
                    {weekDays.map((day, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                            <div
                                className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono transition-colors ${day.active
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

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="botanical-card p-5 text-center"
                >
                    <div className="text-3xl font-display font-bold text-claude-accent">{streak.currentStreak}</div>
                    <div className="text-[10px] font-mono text-botanical-sepia uppercase tracking-[0.15em] mt-1">Current Streak</div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="botanical-card p-5 pt-7 text-center"
                >
                    <div className="text-3xl font-display font-bold text-yellow-500">{streak.longestStreak}</div>
                    <div className="text-[10px] font-mono text-botanical-sepia uppercase tracking-[0.15em] mt-1">Best Streak</div>
                    <div className="text-[9px] font-mono text-claude-secondary/50 mt-2">Personal Record</div>
                </motion.div>
            </div>

            {/* Time Status */}
            {streak.status !== 'broken' && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="botanical-card p-4 mb-6"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${streak.status === 'at-risk' ? 'bg-yellow-500/12' : 'bg-claude-accent/12'
                            }`}>
                            <Clock className={`w-4 h-4 ${streak.status === 'at-risk' ? 'text-yellow-500' : 'text-claude-accent'
                                }`} />
                        </div>
                        <div className="flex-1">
                            <div className="font-display font-semibold text-sm">
                                {streak.studiedToday ? 'Studied Today ✓' : 'Garden Needs Care'}
                            </div>
                            <div className="text-xs text-claude-secondary font-mono">
                                {streak.hoursRemaining > 0
                                    ? `${Math.round(streak.hoursRemaining)}h until garden wilts`
                                    : 'Study now to keep growing!'
                                }
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Stage Selection (Owner Override or User Progression) */}
            {(isOwner || streak.currentStreak >= gardenStages[1].minDays) && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className={`p-4 mb-6 rounded-2xl border-2 relative overflow-hidden ${isOwner ? 'border-amber-500/30 bg-amber-500/5' : 'border-claude-accent/30 bg-claude-accent/5'
                        }`}
                >
                    {isOwner && (
                        <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-bl-lg">OWNER</div>
                    )}
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOwner ? 'bg-amber-500/20' : 'bg-claude-accent/20'
                            }`}>
                            <Palette className={`w-4 h-4 ${isOwner ? 'text-amber-500' : 'text-claude-accent'}`} />
                        </div>
                        <div>
                            <div className={`font-display font-bold text-sm ${isOwner ? 'text-amber-500' : 'text-claude-accent'}`}>
                                {isOwner ? 'Stage Override' : 'Select Garden Stage'}
                            </div>
                            <div className={`text-xs ${isOwner ? 'text-amber-500/70' : 'text-claude-accent/70'}`}>
                                {isOwner ? 'Manually select any garden stage (0-10)' : 'Revisit stages you have unlocked'}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs text-claude-secondary font-mono px-1">
                            <span>Stage 0 (Seed)</span>
                            <span>{isOwner ? 'Stage 10 (Celestial)' : `Stage ${getStageIndex(streak.currentStreak)} (Max)`}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={isOwner ? 10 : getStageIndex(streak.currentStreak)}
                            step="1"
                            value={customization?.stageOverride ?? getStageIndex(streak.currentStreak)}
                            onChange={(e) => setStageOverride(parseInt(e.target.value, 10))}
                            className={`w-full h-2 bg-claude-bg rounded-lg appearance-none cursor-pointer ${isOwner ? 'accent-amber-500' : 'accent-claude-accent'
                                }`}
                        />
                        <div className={`mt-2 text-center text-sm font-display font-semibold italic ${isOwner ? 'text-amber-400' : 'text-claude-text'
                            }`}>
                            Currently showing: {customization?.stageOverride != null ? gardenStages[customization.stageOverride].name : 'Current Max Stage'}
                        </div>
                        {customization?.stageOverride != null && (
                            <button
                                onClick={() => setStageOverride(null)}
                                className="mt-2 text-xs text-claude-secondary hover:text-claude-text underline decoration-claude-secondary/30 transition-colors"
                            >
                                Reset to Natural Streak ({streak.currentStreak})
                            </button>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 mb-24">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowGallery(true)}
                    className="w-full p-4 botanical-card flex items-center gap-4"
                >
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/12 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-display font-semibold text-sm">Garden Memories</div>
                        <div className="text-xs text-claude-secondary">View your past gardens & achievements</div>
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
