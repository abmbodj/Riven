import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
    BarChart3, TrendingUp, AlertTriangle, Loader2, Trophy, Clock
} from 'lucide-react';
import { api } from '../api';

export default function ExamAnalytics({ classId }) {
    const [mastery, setMastery] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [masteryData, attemptsData] = await Promise.all([
                    api.getTopicMastery(classId).catch(() => []),
                    api.getAllExamAttempts(classId).catch(() => []),
                ]);
                setMastery(masteryData);
                setAttempts(attemptsData);
            } catch {
                // Non-critical
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [classId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-claude-accent animate-spin" />
            </div>
        );
    }

    if (mastery.length === 0 && attempts.length === 0) {
        return (
            <div className="text-center py-12">
                <BarChart3 className="w-10 h-10 text-claude-secondary/30 mx-auto mb-3" />
                <p className="text-claude-secondary font-serif italic text-sm">No analytics yet.</p>
                <p className="text-claude-secondary font-mono text-[10px] mt-1">Complete an exam to see your performance breakdown.</p>
            </div>
        );
    }

    const overallMastery = mastery.length > 0
        ? Math.round((mastery.reduce((sum, t) => sum + t.mastery_score, 0) / mastery.length) * 100)
        : null;

    const weakTopics = mastery
        .filter(t => t.mastery_score < 0.5)
        .sort((a, b) => a.mastery_score - b.mastery_score)
        .slice(0, 5);

    const recentAttempts = attempts.slice(0, 8);

    const getMasteryColor = (score) => {
        if (score >= 0.8) return 'bg-green-500';
        if (score >= 0.5) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getMasteryTextColor = (score) => {
        if (score >= 0.8) return 'text-green-400';
        if (score >= 0.5) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="space-y-6">
            {/* Overall Mastery */}
            {overallMastery !== null && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel-premium rounded-2xl p-5 border border-claude-border"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-claude-accent" />
                            <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary font-bold">Overall Mastery</span>
                        </div>
                        <span className={`text-2xl font-serif italic font-bold ${getMasteryTextColor(overallMastery / 100)}`}>
                            {overallMastery}%
                        </span>
                    </div>
                    <div className="w-full h-2.5 bg-claude-bg rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${overallMastery}%` }}
                            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className={`h-full rounded-full ${getMasteryColor(overallMastery / 100)}`}
                        />
                    </div>
                    <p className="text-[11px] font-mono text-claude-secondary mt-2">
                        {mastery.length} topic{mastery.length !== 1 ? 's' : ''} tracked across {attempts.length} attempt{attempts.length !== 1 ? 's' : ''}
                    </p>
                </motion.div>
            )}

            {/* Weak Topics Alert */}
            {weakTopics.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-red-400 font-bold">Needs Improvement</span>
                    </div>
                    <div className="space-y-2">
                        {weakTopics.map((topic) => {
                            const pct = Math.round(topic.mastery_score * 100);
                            return (
                                <div key={topic.id} className="glass-panel rounded-xl p-3 border border-red-500/10">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-sm font-body text-claude-text truncate mr-2">{topic.topic}</span>
                                        <span className="font-mono text-xs font-bold text-red-400">{pct}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-claude-bg rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className="text-[10px] font-mono text-claude-secondary mt-1">
                                        {topic.total_correct}/{topic.total_seen} correct
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* All Topics */}
            {mastery.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-claude-secondary" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary font-bold">All Topics</span>
                    </div>
                    <div className="space-y-2">
                        {mastery.map((topic) => {
                            const pct = Math.round(topic.mastery_score * 100);
                            return (
                                <div key={topic.id} className="flex items-center gap-3">
                                    <span className="text-xs font-body text-claude-text truncate w-32 shrink-0">{topic.topic}</span>
                                    <div className="flex-1 h-1.5 bg-claude-surface rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${getMasteryColor(topic.mastery_score)}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`font-mono text-[10px] font-bold w-10 text-right ${getMasteryTextColor(topic.mastery_score)}`}>
                                        {pct}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Recent Attempts */}
            {recentAttempts.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-claude-secondary" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary font-bold">Recent Attempts</span>
                    </div>

                    {/* Score trend line (SVG) */}
                    {recentAttempts.length >= 2 && (
                        <div className="glass-panel rounded-xl p-3 border border-claude-border mb-3">
                            <svg viewBox={`0 0 ${Math.max(recentAttempts.length - 1, 1) * 40} 60`} className="w-full h-16" preserveAspectRatio="none">
                                {/* Grid lines */}
                                <line x1="0" y1="15" x2={`${(recentAttempts.length - 1) * 40}`} y2="15" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3" />
                                <line x1="0" y1="30" x2={`${(recentAttempts.length - 1) * 40}`} y2="30" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3" />
                                <line x1="0" y1="45" x2={`${(recentAttempts.length - 1) * 40}`} y2="45" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3" />
                                {/* Score line */}
                                <polyline
                                    fill="none"
                                    stroke="var(--accent-color)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={[...recentAttempts].reverse().map((a, i) => {
                                        const pct = a.total > 0 ? a.score / a.total : 0;
                                        const x = i * 40;
                                        const y = 55 - (pct * 50);
                                        return `${x},${y}`;
                                    }).join(' ')}
                                />
                                {/* Score dots */}
                                {[...recentAttempts].reverse().map((a, i) => {
                                    const pct = a.total > 0 ? a.score / a.total : 0;
                                    const x = i * 40;
                                    const y = 55 - (pct * 50);
                                    return (
                                        <circle key={i} cx={x} cy={y} r="3" fill="var(--accent-color)" />
                                    );
                                })}
                            </svg>
                        </div>
                    )}

                    <div className="space-y-2">
                        {recentAttempts.map((attempt) => {
                            const pct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
                            const date = new Date(attempt.completed_at);
                            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            return (
                                <div key={attempt.id} className="flex items-center gap-3 glass-panel rounded-xl p-3 border border-claude-border">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${pct >= 70 ? 'bg-green-500/10' : pct >= 50 ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
                                        <span className={`text-sm font-serif italic font-bold ${pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {pct}%
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-body text-claude-text truncate">
                                            {attempt.mock_exams?.title || 'Exam'}
                                        </p>
                                        <p className="text-[10px] font-mono text-claude-secondary">
                                            {attempt.score}/{attempt.total} correct
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] font-mono text-claude-secondary">{dateStr}</p>
                                        {attempt.duration_seconds && (
                                            <p className="flex items-center gap-0.5 text-[10px] font-mono text-claude-secondary justify-end">
                                                <Clock className="w-2.5 h-2.5" />
                                                {Math.floor(attempt.duration_seconds / 60)}m
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
