import { useState } from 'react';
import { Ghost, Calendar, Award, Flame } from 'lucide-react';

/**
 * @typedef {Object} PastStreak
 * @property {number} streak - Streak length in days
 * @property {string} startDate - ISO date string
 * @property {string} endDate - ISO date string
 */

/**
 * @typedef {Object} GhostGalleryProps
 * @property {PastStreak[]} pastStreaks - Array of past streaks
 * @property {number} longestStreak - Longest streak ever
 * @property {number} currentStreak - Current active streak
 * @property {Function} [onClose] - Close handler
 */

const getGhostStageForStreak = (streak) => {
    if (streak <= 3) return { name: 'Wisp', emoji: '👻', opacity: 0.4 };
    if (streak <= 7) return { name: 'Spirit Orb', emoji: '🔮', opacity: 0.55 };
    if (streak <= 14) return { name: 'Baby Ghost', emoji: '👻', opacity: 0.7 };
    if (streak <= 30) return { name: 'Ghost', emoji: '👻', opacity: 0.85 };
    return { name: 'Phantom', emoji: '👑', opacity: 1 };
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

export default function GhostGallery({ pastStreaks = [], longestStreak = 0, currentStreak = 0, onClose }) {
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
                className="max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-2xl p-6"
                style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Ghost className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                        <h2 className="text-2xl font-bold">Ghost Gallery</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-black/10 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div 
                        className="p-4 rounded-xl text-center"
                        style={{ backgroundColor: 'var(--muted)' }}
                    >
                        <Flame className="w-6 h-6 mx-auto mb-2" style={{ color: '#FF6B35' }} />
                        <div className="text-2xl font-bold">{currentStreak}</div>
                        <div className="text-xs opacity-70">Current Streak</div>
                    </div>
                    <div 
                        className="p-4 rounded-xl text-center"
                        style={{ backgroundColor: 'var(--muted)' }}
                    >
                        <Award className="w-6 h-6 mx-auto mb-2" style={{ color: '#FFD700' }} />
                        <div className="text-2xl font-bold">{longestStreak}</div>
                        <div className="text-xs opacity-70">Longest Streak</div>
                    </div>
                    <div 
                        className="p-4 rounded-xl text-center"
                        style={{ backgroundColor: 'var(--muted)' }}
                    >
                        <Ghost className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--primary)' }} />
                        <div className="text-2xl font-bold">{pastStreaks.length}</div>
                        <div className="text-xs opacity-70">Past Ghosts</div>
                    </div>
                </div>

                {/* Achievement Badges */}
                {getAchievementBadges(longestStreak).length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-3 opacity-70">Achievements Unlocked</h3>
                        <div className="flex flex-wrap gap-2">
                            {getAchievementBadges(longestStreak).map((badge, i) => (
                                <span 
                                    key={i}
                                    className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
                                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                                >
                                    {badge.emoji} {badge.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Past Streaks Grid */}
                <div>
                    <h3 className="text-sm font-semibold mb-3 opacity-70">Memorial Wall</h3>
                    
                    {pastStreaks.length === 0 ? (
                        <div 
                            className="text-center py-12 rounded-xl"
                            style={{ backgroundColor: 'var(--muted)' }}
                        >
                            <Ghost className="w-16 h-16 mx-auto mb-4 opacity-30" />
                            <p className="opacity-70">No past streaks yet</p>
                            <p className="text-sm opacity-50 mt-1">
                                Your ghost memories will appear here
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {pastStreaks.map((streak, index) => {
                                const stage = getGhostStageForStreak(streak.streak);
                                const isSelected = selectedStreak === index;
                                
                                return (
                                    <div
                                        key={index}
                                        className={`
                                            relative p-4 rounded-xl cursor-pointer transition-all
                                            ${isSelected ? 'ring-2' : 'hover:scale-105'}
                                        `}
                                        style={{ 
                                            backgroundColor: 'var(--muted)',
                                            ringColor: 'var(--primary)'
                                        }}
                                        onClick={() => setSelectedStreak(isSelected ? null : index)}
                                    >
                                        {/* Ghost Icon */}
                                        <div 
                                            className="text-4xl text-center mb-2"
                                            style={{ opacity: stage.opacity }}
                                        >
                                            {stage.emoji}
                                        </div>
                                        
                                        {/* Streak Count */}
                                        <div className="text-center">
                                            <div className="text-xl font-bold">
                                                {streak.streak} days
                                            </div>
                                            <div className="text-xs opacity-60">
                                                {stage.name}
                                            </div>
                                        </div>

                                        {/* Date Range (shown when selected) */}
                                        {isSelected && (
                                            <div 
                                                className="mt-3 pt-3 border-t text-xs opacity-70"
                                                style={{ borderColor: 'var(--border)' }}
                                            >
                                                <div className="flex items-center gap-1 justify-center">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(streak.startDate)} - {formatDate(streak.endDate)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Rank Badge */}
                                        {streak.streak === longestStreak && (
                                            <div 
                                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                                                style={{ backgroundColor: '#FFD700' }}
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
                    className="mt-6 p-4 rounded-xl text-center text-sm"
                    style={{ backgroundColor: 'var(--muted)' }}
                >
                    {currentStreak === 0 ? (
                        <>
                            <span className="text-2xl">💪</span>
                            <p className="mt-2 opacity-80">Start a new streak today!</p>
                        </>
                    ) : currentStreak < longestStreak ? (
                        <>
                            <span className="text-2xl">🔥</span>
                            <p className="mt-2 opacity-80">
                                {longestStreak - currentStreak} more day{longestStreak - currentStreak !== 1 ? 's' : ''} to beat your record!
                            </p>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl">🏆</span>
                            <p className="mt-2 opacity-80">You're at your best! Keep going!</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
