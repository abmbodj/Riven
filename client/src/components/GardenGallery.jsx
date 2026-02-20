import { useState, useEffect, useContext } from 'react';
import { X, Calendar } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { UIContext } from '../context/UIContext';
import { getGardenStage } from '../utils/gardenCustomization';

const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
};

export default function GardenGallery({ pastStreaks = [], longestStreak = 0, currentStreak = 0, onClose }) {
    const [selectedStreak, setSelectedStreak] = useState(null);
    const { hideNav, showBottomNav } = useContext(UIContext);

    useEffect(() => {
        hideNav();
        return () => showBottomNav();
    }, [hideNav, showBottomNav]);

    const getAchievementBadges = (streak) => {
        const badges = [];
        if (streak >= 7) badges.push({ emoji: '🌱', label: 'Week Gardener' });
        if (streak >= 14) badges.push({ emoji: '🌿', label: 'Green Thumb' });
        if (streak >= 30) badges.push({ emoji: '🌳', label: 'Tree Planter' });
        if (streak >= 60) badges.push({ emoji: '🌺', label: 'Master Gardener' });
        if (streak >= 100) badges.push({ emoji: '🏡', label: 'Eden Creator' });
        return badges;
    };

    const getGardenEmoji = (streak) => {
        if (streak >= 365) return '🏛️';
        if (streak >= 100) return '🌳';
        if (streak >= 30) return '🌸';
        if (streak >= 14) return '🌷';
        if (streak >= 7) return '🌿';
        if (streak >= 3) return '🌱';
        return '🌾';
    };

    // Handle swipe-down to dismiss
    const handleDragEnd = (_, info) => {
        if (info.offset.y > 100) {
            onClose?.();
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4"
                onClick={(e) => e.target === e.currentTarget && onClose?.()}
            >
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0, bottom: 0.5 }}
                    onDragEnd={handleDragEnd}
                    className="w-full h-[92dvh] sm:h-auto sm:max-w-lg sm:max-h-[80vh] bg-claude-surface rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Drag handle — mobile */}
                    <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
                        <div className="w-10 h-1 rounded-full bg-claude-secondary/30" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 sm:p-4 border-b border-claude-border shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                <Sprout className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-display font-bold">Garden Memories</h2>
                                <p className="text-xs text-claude-secondary">Your gardening journey</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-display font-semibold text-claude-accent active:bg-claude-accent/10 transition-colors"
                        >
                            Done
                        </button>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-3 gap-3 p-4 bg-claude-bg/50">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-500">{currentStreak}</div>
                            <div className="text-[10px] uppercase tracking-wider text-claude-secondary">Current</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-500">{longestStreak}</div>
                            <div className="text-[10px] uppercase tracking-wider text-claude-secondary">Best</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">{pastStreaks.length}</div>
                            <div className="text-[10px] uppercase tracking-wider text-claude-secondary">Gardens</div>
                        </div>
                    </div>

                    {/* Past Streaks List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
                        {pastStreaks.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-12"
                            >
                                <div
                                    className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(122,158,114,0.12) 0%, rgba(122,158,114,0.06) 100%)',
                                        border: '1px solid rgba(122,158,114,0.12)',
                                    }}
                                >
                                    <span className="text-3xl">🌱</span>
                                </div>
                                <p className="font-display font-semibold text-claude-text mb-1">No past gardens yet</p>
                                <p className="text-sm text-claude-secondary">Keep your streak going to grow memories!</p>
                            </motion.div>
                        ) : (
                            pastStreaks
                                .sort((a, b) => b.streak - a.streak)
                                .map((past, index) => {
                                    const stage = getGardenStage(past.streak);
                                    const badges = getAchievementBadges(past.streak);
                                    const isRecord = past.streak === longestStreak;

                                    return (
                                        <motion.button
                                            key={index}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => setSelectedStreak(selectedStreak === index ? null : index)}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${isRecord
                                                ? 'border-yellow-500/50 bg-yellow-500/5'
                                                : 'border-claude-border active:border-claude-secondary'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="text-3xl">{getGardenEmoji(past.streak)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{past.streak} days</span>
                                                        {isRecord && (
                                                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full font-bold">
                                                                BEST
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-claude-secondary">{stage.name}</p>
                                                </div>
                                                <div className="text-right text-xs text-claude-secondary">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {formatDate(past.startDate)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded details */}
                                            <AnimatePresence>
                                                {selectedStreak === index && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-4 pt-4 border-t border-claude-border">
                                                            <div className="text-xs text-claude-secondary mb-2">
                                                                {formatDate(past.startDate)} → {formatDate(past.endDate)}
                                                            </div>
                                                            <p className="text-sm text-claude-secondary mb-3">
                                                                {stage.description}
                                                            </p>
                                                            {badges.length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {badges.map((badge, i) => (
                                                                        <span
                                                                            key={i}
                                                                            className="px-2 py-1 bg-claude-bg rounded-full text-xs flex items-center gap-1"
                                                                        >
                                                                            {badge.emoji} {badge.label}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.button>
                                    );
                                })
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
