import { useState } from 'react';
import { Palette, Clock, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import Garden from '../components/Garden';
import GardenGallery from '../components/GardenGallery';
import GardenCustomizer from '../components/GardenCustomizer';
import { useStreak } from '../hooks/useStreak';
import { getGardenStage } from '../utils/gardenCustomization';

const getStatusMessage = (streak) => {
    if (streak.status === 'broken') return 'Study to revive your garden!';
    if (streak.status === 'at-risk') return `${Math.round(streak.hoursRemaining)}h left to water your garden`;
    if (streak.studiedToday) return 'Garden is thriving!';
    return 'Study to grow your garden';
};

export default function GardenSettings() {
    const streak = useStreak();
    const [showGallery, setShowGallery] = useState(false);
    const [showCustomizer, setShowCustomizer] = useState(false);

    const stage = getGardenStage(streak.currentStreak);

    return (
        <div className="relative min-h-[calc(100dvh-180px)]">
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-2xl font-display font-bold italic mb-1">My Garden</h1>
                <p className="text-xs font-mono text-botanical-sepia tracking-wide">{getStatusMessage(streak)}</p>
            </div>

            {/* Garden Preview with gradient backdrop */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex flex-col items-center mb-8"
            >
                <div
                    className="relative rounded-2xl p-6 w-full flex flex-col items-center"
                    style={{
                        background: 'linear-gradient(180deg, rgba(45,106,79,0.1) 0%, rgba(82,183,136,0.04) 60%, transparent 100%)',
                        border: '1px solid rgba(82,183,136,0.08)',
                    }}
                >
                    {/* Corner marks */}
                    <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-claude-accent/15" />
                    <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-claude-accent/15" />
                    <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-claude-accent/15" />
                    <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-claude-accent/15" />

                    <Garden
                        streak={streak.currentStreak}
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

            {/* Stats Cards — asymmetric heights */}
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
                                {streak.studiedToday ? 'Studied Today \u2713' : 'Garden Needs Care'}
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

            {/* Action Buttons */}
            <div className="space-y-3 mb-24">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCustomizer(true)}
                    className="w-full p-4 botanical-card flex items-center gap-4"
                >
                    <div className="w-10 h-10 rounded-lg bg-claude-accent/12 flex items-center justify-center">
                        <Palette className="w-5 h-5 text-claude-accent" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-display font-semibold text-sm">Customize Garden</div>
                        <div className="text-xs text-claude-secondary">Change theme, add decorations & plants</div>
                    </div>
                </motion.button>

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

            {showCustomizer && (
                <GardenCustomizer
                    longestStreak={streak.longestStreak}
                    currentStreak={streak.currentStreak}
                    status={streak.status}
                    onClose={() => setShowCustomizer(false)}
                />
            )}
        </div>
    );
}
