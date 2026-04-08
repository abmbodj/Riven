import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
    TrendingUp, AlertTriangle, Loader2, Clock
} from 'lucide-react';
import { api } from '../api';

export default function ExamAnalytics() {
    const [mastery, setMastery] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [masteryData, attemptsData] = await Promise.all([
                    api.getTopicMastery().catch(() => []),
                    api.getAllExamAttempts().catch(() => []),
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
    }, []);

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
                <TrendingUp className="w-10 h-10 text-claude-secondary/30 mx-auto mb-3" />
                <p className="text-claude-secondary font-serif italic text-sm">No analytics yet.</p>
                <p className="text-claude-secondary font-mono text-[10px] mt-1">Complete an exam to see your performance breakdown.</p>
            </div>
        );
    }

    const weakTopics = mastery
        .filter(t => t.mastery_score < 0.5)
        .sort((a, b) => a.mastery_score - b.mastery_score)
        .slice(0, 5);

    const recentAttempts = attempts.slice(0, 8);

    // Best and average score
    const scores = attempts
        .filter(a => a.total > 0)
        .map(a => Math.round((a.score / a.total) * 100));
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;

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
            {/* Best + Average — two numbers, instant read */}
            {bestScore !== null && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 gap-3"
                >
                    <div className="glass-panel rounded-2xl p-4 border border-claude-border text-center">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary mb-1">Best</p>
                        <p className={`text-2xl font-serif italic font-bold ${bestScore >= 70 ? 'text-green-400' : bestScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {bestScore}%
                        </p>
                    </div>
                    <div className="glass-panel rounded-2xl p-4 border border-claude-border text-center">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary mb-1">Average</p>
                        <p className={`text-2xl font-serif italic font-bold ${avgScore >= 70 ? 'text-green-400' : avgScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {avgScore}%
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Weak Topics — highest signal */}
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

            {/* Score trend — only shown with 2+ attempts */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-claude-secondary" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary font-bold">Score Trend</span>
                </div>

                {recentAttempts.length < 2 ? (
                    <div className="glass-panel rounded-xl p-4 border border-claude-border text-center">
                        <p className="text-[11px] font-mono text-claude-secondary">
                            Complete more exams to see your score trend.
                        </p>
                    </div>
                ) : (
                    <div className="glass-panel rounded-xl p-3 border border-claude-border mb-3">
                        <svg
                            viewBox={`0 0 ${Math.max(recentAttempts.length - 1, 1) * 40} 60`}
                            className="w-full h-16"
                            preserveAspectRatio="none"
                        >
                            <line x1="0" y1="15" x2={`${(recentAttempts.length - 1) * 40}`} y2="15" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3" />
                            <line x1="0" y1="30" x2={`${(recentAttempts.length - 1) * 40}`} y2="30" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3" />
                            <line x1="0" y1="45" x2={`${(recentAttempts.length - 1) * 40}`} y2="45" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3" />
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
                            {[...recentAttempts].reverse().map((a, i) => {
                                const pct = a.total > 0 ? a.score / a.total : 0;
                                const x = i * 40;
                                const y = 55 - (pct * 50);
                                return <circle key={i} cx={x} cy={y} r="3" fill="var(--accent-color)" />;
                            })}
                        </svg>
                    </div>
                )}

                {/* Recent attempts list */}
                {recentAttempts.length > 0 && (
                    <div className="space-y-2">
                        {recentAttempts.map((attempt) => {
                            const pct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
                            const date = new Date(attempt.completed_at);
                            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            return (
                                <div key={attempt.id} className="flex items-center gap-3 glass-panel rounded-xl p-3 border border-claude-border">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${pct >= 70 ? 'bg-green-500/10' : pct >= 50 ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
                                        <span className={`text-sm font-serif italic font-bold ${getMasteryTextColor(pct / 100)}`}>
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
                )}
            </motion.div>
        </div>
    );
}
