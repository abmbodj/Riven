import { useState } from 'react';
import { Settings, Palette, Clock, Trophy, Sparkles } from 'lucide-react';
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
        <div className="animate-in fade-in duration-300 relative">
            {/* Coming Soon Overlay */}
            <div className="absolute inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-claude-bg/60 backdrop-blur-md" />
                <div className="relative bg-claude-surface border border-claude-border rounded-3xl p-8 mx-4 text-center shadow-2xl">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/20 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-display font-bold mb-2">Coming Soon</h2>
                    <p className="text-claude-secondary text-sm max-w-xs">
                        The Garden feature is being cultivated. Check back soon to grow your study streak garden!
                    </p>
                    <div className="mt-6 text-xs text-claude-secondary/60">🌱 Growing something special...</div>
                </div>
            </div>
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-2xl font-display font-bold mb-1">My Garden</h1>
                <p className="text-sm text-claude-secondary">{getStatusMessage(streak)}</p>
            </div>

            {/* Garden Preview */}
            <div className="flex flex-col items-center mb-8">
                <div className="relative">
                    <Garden
                        streak={streak.currentStreak}
                        status={streak.status}
                        size="xl"
                        showInfo={true}
                    />
                </div>
                
                {/* Stage Name */}
                <div className="mt-4 text-center">
                    <div className="text-lg font-semibold">{stage.name}</div>
                    <div className="text-sm text-claude-secondary">{stage.description}</div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-claude-surface border border-claude-border rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-500">{streak.currentStreak}</div>
                    <div className="text-xs text-claude-secondary uppercase tracking-wider mt-1">Current Streak</div>
                </div>
                <div className="bg-claude-surface border border-claude-border rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-500">{streak.longestStreak}</div>
                    <div className="text-xs text-claude-secondary uppercase tracking-wider mt-1">Best Streak</div>
                </div>
            </div>

            {/* Time Status */}
            {streak.status !== 'broken' && (
                <div className="bg-claude-surface border border-claude-border rounded-2xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            streak.status === 'at-risk' ? 'bg-orange-500/20' : 'bg-green-500/20'
                        }`}>
                            <Clock className={`w-5 h-5 ${
                                streak.status === 'at-risk' ? 'text-orange-500' : 'text-green-500'
                            }`} />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold">
                                {streak.studiedToday ? 'Studied Today ✓' : 'Garden Needs Care'}
                            </div>
                            <div className="text-sm text-claude-secondary">
                                {streak.hoursRemaining > 0 
                                    ? `${Math.round(streak.hoursRemaining)}h until garden wilts`
                                    : 'Study now to keep growing!'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 mb-24">
                <button
                    onClick={() => setShowCustomizer(true)}
                    className="w-full p-4 bg-claude-surface border border-claude-border rounded-2xl flex items-center gap-4 active:scale-[0.98] transition-transform"
                >
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <Palette className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold">Customize Garden</div>
                        <div className="text-sm text-claude-secondary">Change theme, add decorations & plants</div>
                    </div>
                </button>

                <button
                    onClick={() => setShowGallery(true)}
                    className="w-full p-4 bg-claude-surface border border-claude-border rounded-2xl flex items-center gap-4 active:scale-[0.98] transition-transform"
                >
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold">Garden Memories</div>
                        <div className="text-sm text-claude-secondary">View your past gardens & achievements</div>
                    </div>
                </button>
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
