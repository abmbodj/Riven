import React, { useState } from 'react';
import { Dog, Award, Flame, Settings, ChevronRight } from 'lucide-react';
import PugPet from '../components/PugPet';
import PugGallery from '../components/PugGallery';
import PugCustomizer from '../components/PugCustomizer';
import { useStreakContext } from '../hooks/useStreakContext';

export default function PetSettings() {
    const streak = useStreakContext();
    const [showGallery, setShowGallery] = useState(false);
    const [showCustomizer, setShowCustomizer] = useState(false);

    const getStatusMessage = () => {
        if (streak.status === 'broken') return 'Study to wake up Gmail!';
        if (streak.status === 'at-risk') return `${Math.round(streak.hoursRemaining)}h left to feed Gmail`;
        if (streak.studiedToday) return 'Gmail is happy!';
        return 'Study to grow Gmail';
    };

    const getStatusEmoji = () => {
        if (streak.status === 'active') return '🦴';
        if (streak.status === 'at-risk') return '🍖';
        return '😴';
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-6">
                <h1 className="text-2xl font-display font-bold mb-1">Gmail</h1>
                <p className="text-claude-secondary text-sm">Your study companion</p>
            </div>

            {/* Pet Display Card */}
            <div className="claude-card p-6 mb-6">
                <div className="flex flex-col items-center text-center">
                    <div onClick={() => setShowCustomizer(true)} className="cursor-pointer mb-4">
                        <PugPet
                            stage={streak.pugStage}
                            status={streak.status}
                            streak={streak.currentStreak}
                            size="lg"
                            showInfo={false}
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-display font-bold">
                            {streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xl">{getStatusEmoji()}</span>
                    </div>
                    
                    <p className="text-claude-secondary text-sm">{getStatusMessage()}</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="claude-card p-4 text-center">
                    <Flame className="w-5 h-5 mx-auto mb-2 text-orange-500" />
                    <div className="text-xl font-bold">{streak.currentStreak}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary">Current</div>
                </div>
                <div className="claude-card p-4 text-center">
                    <Award className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
                    <div className="text-xl font-bold">{streak.longestStreak}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary">Longest</div>
                </div>
                <div className="claude-card p-4 text-center">
                    <Dog className="w-5 h-5 mx-auto mb-2 text-claude-accent" />
                    <div className="text-xl font-bold">{streak.pastStreaks?.length || 0}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary">Streaks</div>
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
                <button
                    onClick={() => setShowCustomizer(true)}
                    className="claude-card p-4 w-full flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-claude-accent/10 rounded-xl flex items-center justify-center">
                            <Settings className="w-5 h-5 text-claude-accent" />
                        </div>
                        <div className="text-left">
                            <div className="font-semibold">Customize Gmail</div>
                            <div className="text-xs text-claude-secondary">Change appearance & accessories</div>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-claude-secondary" />
                </button>

                <button
                    onClick={() => setShowGallery(true)}
                    className="claude-card p-4 w-full flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                            <Dog className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="text-left">
                            <div className="font-semibold">Streak Gallery</div>
                            <div className="text-xs text-claude-secondary">View past streaks & achievements</div>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-claude-secondary" />
                </button>
            </div>

            {/* Gallery Modal */}
            {showGallery && (
                <PugGallery
                    pastStreaks={streak.pastStreaks}
                    longestStreak={streak.longestStreak}
                    currentStreak={streak.currentStreak}
                    onClose={() => setShowGallery(false)}
                />
            )}

            {/* Customizer Modal */}
            {showCustomizer && (
                <PugCustomizer
                    longestStreak={streak.longestStreak}
                    currentStreak={streak.currentStreak}
                    pugStage={streak.pugStage}
                    status={streak.status}
                    onClose={() => setShowCustomizer(false)}
                />
            )}
        </div>
    );
}
