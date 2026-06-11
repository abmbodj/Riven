import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, CheckCircle2, XCircle, RefreshCw, Clock, BarChart3,
    Bookmark, ChevronDown, ChevronUp, Tag, BookOpen
} from 'lucide-react';
import StudyPath from './StudyPath';
import SubjectRenderer from './ui/SubjectRenderer';

const DIFFICULTY_COLORS = {
    easy: 'text-green-400 bg-green-500/10 border-green-500/20',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    hard: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const gradeBand = (pct) => {
    if (pct >= 90) return { label: 'Distinction', color: 'text-green-400' };
    if (pct >= 80) return { label: 'Merit', color: 'text-green-400' };
    if (pct >= 70) return { label: 'Pass', color: 'text-yellow-400' };
    if (pct >= 50) return { label: 'Borderline', color: 'text-yellow-400' };
    return { label: 'Needs Work', color: 'text-red-400' };
};

const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

const getMasteryColor = (pct) => {
    if (pct >= 70) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
};

const getMasteryTextColor = (pct) => {
    if (pct >= 70) return 'text-green-400';
    if (pct >= 50) return 'text-yellow-400';
    return 'text-red-400';
};

export default function ExamResults({
    exam,
    answers,
    score,
    creditScore,
    elapsedSeconds,
    flaggedIndices,
    onRetake,
    attemptSaved,
}) {
    const navigate = useNavigate();
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all' | 'missed' | 'flagged'
    const [savedBadge, setSavedBadge] = useState(false);

    // Percentage reflects partial credit (creditScore) when available; score remains the
    // integer count of fully-correct answers used for the "X of Y correct" label.
    const earned = typeof creditScore === 'number' ? creditScore : score;
    const percentage = Math.round((earned / exam.questions.length) * 100);
    const band = gradeBand(percentage);

    // Show subtle "Saved" badge once saved
    useEffect(() => {
        if (attemptSaved) {
            // Intentional one-shot UI badge keyed off attemptSaved; safe in effect.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSavedBadge(true);
            const t = setTimeout(() => setSavedBadge(false), 3000);
            return () => clearTimeout(t);
        }
    }, [attemptSaved]);

    // Build topic breakdown
    const topicBreakdown = {};
    answers.forEach((ans) => {
        const topic = ans.topic || 'General';
        if (!topicBreakdown[topic]) topicBreakdown[topic] = { correct: 0, total: 0 };
        topicBreakdown[topic].total += 1;
        if (ans.isCorrect) topicBreakdown[topic].correct += 1;
    });

    const weakTopics = Object.entries(topicBreakdown)
        .filter(([, s]) => s.total > 0 && (s.correct / s.total) < 0.7)
        .map(([topic]) => topic);

    const missedCount = answers.filter(a => !a?.isCorrect).length;
    const flaggedCount = flaggedIndices.size;

    // Per-question list filtered
    const questionItems = exam.questions.map((q, i) => ({
        ...q,
        answer: answers[i],
        index: i,
        isFlagged: flaggedIndices.has(i),
    })).filter(item => {
        if (filter === 'missed') return item.answer && !item.answer.isCorrect;
        if (filter === 'flagged') return item.isFlagged;
        return true;
    });

    return (
        <div className="fullscreen-page flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-safe pb-4">
                <button
                    onClick={() => navigate('/exams')}
                    className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action"
                >
                    <X className="w-6 h-6" />
                </button>
                <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">{exam.title}</span>
                <div className="w-10 flex justify-end">
                    <AnimatePresence>
                        {savedBadge && (
                            <motion.span
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="font-mono text-[9px] uppercase tracking-widest text-green-400 font-bold"
                            >
                                Saved
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div
                data-testid="exam-results-scroll"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-safe sm:px-6"
            >
                <div
                    data-testid="exam-results-layout"
                    className="mx-auto w-full max-w-6xl pb-6 sm:pb-8 grid gap-6 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] xl:items-start"
                >
                    {/* Left column — score + actions */}
                    <div className="space-y-4 xl:sticky xl:top-6">
                        {/* Score card */}
                        <div className="glass-panel rounded-[32px] border border-claude-border px-5 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:px-6">
                            {/* Grade reveal — the beat */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <p className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary mb-6">Results</p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <h2 className="text-6xl sm:text-7xl font-serif italic font-bold text-claude-text leading-none mb-2">
                                    {percentage}%
                                </h2>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7, duration: 0.4 }}
                                className="space-y-3"
                            >
                                <p className={`font-mono text-[11px] uppercase tracking-widest font-bold ${band.color}`}>
                                    {band.label}
                                </p>
                                <p className="text-claude-secondary font-mono text-sm">
                                    {score} of {exam.questions.length} correct
                                </p>

                                {/* Time taken */}
                                {elapsedSeconds > 0 && (
                                    <div className="flex items-center justify-center gap-1.5 text-claude-secondary">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="font-mono text-[11px]">{formatTime(elapsedSeconds)}</span>
                                    </div>
                                )}

                                {/* Score bar */}
                                <div className="w-full h-2 bg-claude-surface rounded-full overflow-hidden mt-4">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                        className={`h-full rounded-full ${getMasteryColor(percentage)}`}
                                    />
                                </div>
                            </motion.div>
                        </div>

                        {/* Actions */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9, duration: 0.4 }}
                            className="space-y-2"
                        >
                            <button
                                onClick={onRetake}
                                className="w-full py-3.5 glass-panel rounded-2xl text-claude-text font-mono text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-claude-surface transition-colors tap-action"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Retake Exam
                            </button>
                            <button
                                onClick={() => navigate('/exams')}
                                className="w-full py-3 text-claude-secondary font-mono text-[10px] uppercase tracking-widest font-bold tap-action"
                            >
                                Back to Exams
                            </button>
                        </motion.div>
                    </div>

                    {/* Right column — breakdown + questions */}
                    <div className="min-w-0 space-y-6">
                        {/* Topic breakdown */}
                        {Object.keys(topicBreakdown).length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="glass-panel rounded-[32px] border border-claude-border p-4 sm:p-5"
                            >
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-claude-secondary" />
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary font-bold">Topic Breakdown</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-claude-secondary/70">
                                        {Object.keys(topicBreakdown).length} topics
                                    </span>
                                </div>
                                <div data-testid="topic-breakdown-grid" className="grid gap-3 lg:grid-cols-2">
                                    {Object.entries(topicBreakdown).map(([topic, stats]) => {
                                        const topicPct = Math.round((stats.correct / stats.total) * 100);
                                        return (
                                            <div key={topic} className="glass-panel rounded-2xl p-3 border border-claude-border">
                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                    <span className="text-sm text-claude-text font-body truncate">{topic}</span>
                                                    <span className={`shrink-0 font-mono text-xs font-bold ${getMasteryTextColor(topicPct)}`}>
                                                        {stats.correct}/{stats.total}
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-claude-bg rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${getMasteryColor(topicPct)}`}
                                                        style={{ width: `${topicPct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* Study path for weak topics */}
                        {attemptSaved && weakTopics.length > 0 && percentage < 80 && (
                            <StudyPath
                                classId={exam.class_id}
                                weakTopics={weakTopics}
                                percentage={percentage}
                            />
                        )}

                        {/* Per-question review */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            {/* Filter chips */}
                            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`shrink-0 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold border transition-colors tap-action ${filter === 'all' ? 'bg-claude-accent/15 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}
                                >
                                    All ({exam.questions.length})
                                </button>
                                <button
                                    onClick={() => setFilter('missed')}
                                    className={`shrink-0 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold border transition-colors tap-action ${filter === 'missed' ? 'bg-red-500/15 border-red-500/50 text-red-400' : 'glass-panel border-claude-border text-claude-secondary'}`}
                                >
                                    Missed ({missedCount})
                                </button>
                                {flaggedCount > 0 && (
                                    <button
                                        onClick={() => setFilter('flagged')}
                                        className={`shrink-0 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold border transition-colors tap-action ${filter === 'flagged' ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-400' : 'glass-panel border-claude-border text-claude-secondary'}`}
                                    >
                                        <span className="flex items-center gap-1">
                                            <Bookmark className="w-2.5 h-2.5" fill="currentColor" />
                                            Flagged ({flaggedCount})
                                        </span>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {questionItems.map((item) => {
                                    const isExpanded = expandedIndex === item.index;
                                    const ans = item.answer;
                                    const isCorrect = ans?.isCorrect;
                                    const isPartial = !isCorrect && ans?.gradeBand === 'partial';
                                    const isShortAnswer = item.type === 'short_answer';

                                    const rowClass = isCorrect
                                        ? 'border-green-500/20 bg-green-500/5'
                                        : isPartial
                                            ? 'border-yellow-500/20 bg-yellow-500/5'
                                            : 'border-red-500/20 bg-red-500/5';

                                    return (
                                        <motion.div
                                            key={item.index}
                                            layout
                                            className={`rounded-2xl border overflow-hidden ${rowClass}`}
                                        >
                                            <button
                                                onClick={() => setExpandedIndex(isExpanded ? null : item.index)}
                                                className="w-full p-4 text-left flex items-start gap-3 tap-action"
                                            >
                                                {/* Correct / partial / incorrect indicator */}
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isCorrect ? 'bg-green-500/20' : isPartial ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                                                    {isCorrect
                                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                                        : isPartial
                                                            ? <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" />
                                                            : <XCircle className="w-3.5 h-3.5 text-red-400" />
                                                    }
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-body text-claude-text leading-relaxed line-clamp-2">
                                                        <SubjectRenderer content={item.question} inline />
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                        {item.topic && (
                                                            <span className="flex items-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-claude-secondary">
                                                                <Tag className="w-2.5 h-2.5" />
                                                                {item.topic}
                                                            </span>
                                                        )}
                                                        {item.difficulty && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${DIFFICULTY_COLORS[item.difficulty] || DIFFICULTY_COLORS.medium}`}>
                                                                {item.difficulty}
                                                            </span>
                                                        )}
                                                        {isShortAnswer && (
                                                            <span className="flex items-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-claude-accent">
                                                                <BookOpen className="w-2.5 h-2.5" />
                                                                SA
                                                            </span>
                                                        )}
                                                        {ans?.time_ms != null && (
                                                            <span className="font-mono text-[9px] text-claude-secondary">
                                                                {(ans.time_ms / 1000).toFixed(1)}s
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {/* Flagged indicator */}
                                                    {item.isFlagged && (
                                                        <Bookmark className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                                                    )}
                                                    {isExpanded
                                                        ? <ChevronUp className="w-4 h-4 text-claude-secondary" />
                                                        : <ChevronDown className="w-4 h-4 text-claude-secondary" />
                                                    }
                                                </div>
                                            </button>

                                            {/* Expanded detail */}
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="px-4 pb-4 space-y-3"
                                                >
                                                    {!isShortAnswer ? (
                                                        <div className="space-y-2">
                                                            <div className={`p-3 rounded-xl border text-sm font-body ${isCorrect ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
                                                                <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1">Your Answer</span>
                                                                <SubjectRenderer content={ans?.selected} />
                                                            </div>
                                                            {!isCorrect && (
                                                                <div className="p-3 rounded-xl border border-green-500/30 text-sm font-body text-green-400">
                                                                    <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1">Correct Answer</span>
                                                                    <SubjectRenderer content={item.correct_answer} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <div className="p-3 rounded-xl border border-claude-border text-sm font-body text-claude-text">
                                                                <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1 text-claude-secondary">Your Answer</span>
                                                                <SubjectRenderer content={ans?.selected} />
                                                            </div>
                                                            <div className="p-3 rounded-xl border border-claude-accent/30 text-sm font-body text-claude-text">
                                                                <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1 text-claude-accent">Model Answer</span>
                                                                <SubjectRenderer content={item.correct_answer} />
                                                            </div>
                                                            {ans?.feedback && (
                                                                <div className="p-3 rounded-xl border border-claude-border text-sm font-body text-claude-text">
                                                                    <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1 text-claude-secondary">Feedback</span>
                                                                    <SubjectRenderer content={ans.feedback} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {(item.explanation || ans?.explanation) && (
                                                        <div className="p-3 rounded-xl glass-panel border border-claude-border">
                                                            <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-claude-secondary block mb-1">Explanation</span>
                                                            <div className="text-sm font-body text-claude-text leading-relaxed"><SubjectRenderer content={item.explanation || ans?.explanation} /></div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    );
                                })}

                                {questionItems.length === 0 && (
                                    <div className="text-center py-8 text-claude-secondary font-serif italic text-sm">
                                        No questions match this filter.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
