import { useState } from 'react';
import { Dog, Calendar, Award, Flame } from 'lucide-react';

/**
 * @typedef {Object} PastStreak
 * @property {number} streak - Streak length in days
 * @property {string} startDate - ISO date string
 * @property {string} endDate - ISO date string
 */

/**
 * @typedef {Object} PugGalleryProps
 * @property {PastStreak[]} pastStreaks - Array of past streaks
 * @property {number} longestStreak - Longest streak ever
 * @property {number} currentStreak - Current active streak
 * @property {Function} [onClose] - Close handler
 */

const getPugStageForStreak = (streak) => {
    if (streak <= 3) return { name: 'Puppy Gmail', emoji: '🐶', opacity: 1 };
    if (streak <= 7) return { name: 'Puglet Gmail', emoji: '🐕', opacity: 1 };
    if (streak <= 14) return { name: 'Pug Gmail', emoji: '🐕‍🦺', opacity: 1 };
    if (streak <= 30) return { name: 'Gmail', emoji: '🐕', opacity: 1 };
    return { name: 'King Gmail', emoji: '👑', opacity: 1 };
};

const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
};

export default function PugGallery({ pastStreaks = [], longestStreak = 0, currentStreak = 0, onClose }) {
    const [selectedStreak, setSelectedStreak] = useState(null);

    const getAchievementBadges = (streak) => {
        const badges = [];
        if (streak >= 7) badges.push({ emoji: '🏅', label: 'Week Warrior' });
        if (streak >= 14) badges.push({ emoji: '🎖️', label: 'Fortnight Fighter' });
        if (streak >= 30) badges.push({ emoji: '🏆', label: 'Monthly Master' });
        if (streak >= 60) badges.push({ emoji: '💎', label: 'Diamond Scholar' });
        if (streak >= 100) badges.push({ emoji: '👑', label: 'Century Champion' });
        return badges;
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-0 sm:p-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[85vh] overflow-y-auto rounded-none sm:rounded-2xl p-4 sm:p-8 bg-claude-surface text-claude-text custom-scrollbar overscroll-contain touch-pan-y"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-claude-accent/10 rounded-xl flex items-center justify-center">
                            <Dog className="w-6 h-6 text-claude-accent" />
                        </div>
                        <h2 className="text-2xl font-display font-bold">Gmail's Gallery</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl active:bg-claude-bg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
                    <div
                        className="p-4 rounded-2xl text-center bg-claude-bg border border-claude-border shadow-sm"
                    >
                        <Flame className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                        <div className="text-2xl font-display font-bold">{currentStreak}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary">Current</div>
                    </div>
                    <div
                        className="p-4 rounded-2xl text-center bg-claude-bg border border-claude-border shadow-sm"
                    >
                        <Award className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                        <div className="text-2xl font-display font-bold">{longestStreak}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary">Longest</div>
                    </div>
                    <div
                        className="p-4 rounded-2xl text-center bg-claude-bg border border-claude-border shadow-sm"
                    >
                        <Dog className="w-6 h-6 mx-auto mb-2 text-claude-accent" />
                        <div className="text-2xl font-display font-bold">{pastStreaks.length}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary">Pugs</div>
                    </div>
                </div>

                {/* Achievement Badges */}
                {getAchievementBadges(longestStreak).length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-4 flex items-center gap-2">
                            <div className="h-px flex-1 bg-claude-border" />
                            Achievements
                            <div className="h-px flex-1 bg-claude-border" />
                        </h3>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {getAchievementBadges(longestStreak).map((badge, i) => (
                                <span
                                    key={i}
                                    className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-claude-bg border border-claude-border shadow-sm"
                                >
                                    <span className="text-lg">{badge.emoji}</span> {badge.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Past Streaks Grid */}
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary mb-4 flex items-center gap-2">
                        <div className="h-px flex-1 bg-claude-border" />
                        Memorial Wall
                        <div className="h-px flex-1 bg-claude-border" />
                    </h3>

                    {pastStreaks.length === 0 ? (
                        <div
                            className="text-center py-12 rounded-2xl bg-claude-bg border border-dashed border-claude-border"
                        >
                            <Dog className="w-16 h-16 mx-auto mb-4 text-claude-secondary opacity-20" />
                            <p className="font-bold text-claude-secondary">No past streaks yet</p>
                            <p className="text-xs text-claude-secondary/60 mt-1">
                                Your Gmail memories will appear here
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {pastStreaks.map((streak, index) => {
                                const stage = getPugStageForStreak(streak.streak);
                                const isSelected = selectedStreak === index;

                                return (
                                    <div
                                        key={index}
                                        className={`
                                            relative p-5 rounded-2xl cursor-pointer transition-all active:scale-[0.98] border
                                            ${isSelected ? 'border-claude-accent bg-claude-accent/5 ring-1 ring-claude-accent' : 'border-claude-border bg-claude-bg hover:border-claude-secondary'}
                                        `}
                                        onClick={() => setSelectedStreak(isSelected ? null : index)}
                                    >
                                        {/* Pug Icon */}
                                        <div
                                            className="text-4xl text-center mb-3 drop-shadow-sm"
                                            style={{ opacity: stage.opacity }}
                                        >
                                            {stage.emoji}
                                        </div>

                                        {/* Streak Count */}
                                        <div className="text-center">
                                            <div className="text-xl font-display font-bold">
                                                {streak.streak} days
                                            </div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-claude-secondary mt-1">
                                                {stage.name}
                                            </div>
                                        </div>

                                        {/* Date Range (shown when selected) */}
                                        {isSelected && (
                                            <div
                                                className="mt-4 pt-4 border-t border-claude-border text-[10px] font-medium text-claude-secondary animate-in fade-in slide-in-from-top-1 duration-200"
                                            >
                                                <div className="flex items-center gap-1.5 justify-center">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(streak.startDate)} - {formatDate(streak.endDate)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Rank Badge */}
                                        {streak.streak === longestStreak && (
                                            <div
                                                className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs bg-yellow-500 text-white shadow-md ring-2 ring-claude-surface"
                                            >
                                                👑
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Motivational Message */}
                <div
                    className="mt-8 p-6 rounded-2xl text-center bg-claude-bg border border-claude-border shadow-inner"
                >
                    {currentStreak === 0 ? (
                        <>
                            <span className="text-3xl">🦴</span>
                            <p className="mt-3 font-bold text-claude-text">Start a new streak today!</p>
                            <p className="text-xs text-claude-secondary mt-1">Every journey begins with a single card.</p>
                        </>
                    ) : currentStreak < longestStreak ? (
                        <>
                            <span className="text-3xl">🐕</span>
                            <p className="mt-3 font-bold text-claude-text">
                                {longestStreak - currentStreak} more day{longestStreak - currentStreak !== 1 ? 's' : ''} to beat your record!
                            </p>
                            <p className="text-xs text-claude-secondary mt-1">You're getting closer every day!</p>
                        </>
                    ) : (
                        <>
                            <span className="text-3xl">🏆</span>
                            <p className="mt-3 font-bold text-claude-text">You're at your best! Keep going!</p>
                            <p className="text-xs text-claude-secondary mt-1">You've set a new standard for yourself.</p>
                        </>
                    )}
                </div>

                {/* Mobile Footer Spacer */}
                <div className="h-8 sm:hidden safe-area-bottom" />
            </div>
        </div>
    );
}
