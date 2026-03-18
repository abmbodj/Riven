import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
    X, CheckCircle2, XCircle, Filter, ChevronDown, ChevronUp,
    RefreshCw, Tag, BookOpen
} from 'lucide-react';

const DIFFICULTY_COLORS = {
    easy: 'text-green-400 bg-green-500/10 border-green-500/20',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    hard: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export default function ExamReview({ exam, answers, onBack, onRetake }) {
    const [filter, setFilter] = useState('all'); // 'all' | 'missed' | 'correct'
    const [expandedIndex, setExpandedIndex] = useState(null);

    const filteredQuestions = exam.questions.map((q, i) => ({
        ...q,
        answer: answers[i],
        index: i,
    })).filter(item => {
        if (filter === 'missed') return item.answer && !item.answer.isCorrect;
        if (filter === 'correct') return item.answer && item.answer.isCorrect;
        return true;
    });

    const missedCount = answers.filter(a => !a?.isCorrect).length;
    const correctCount = answers.filter(a => a?.isCorrect).length;

    return (
        <div className="fullscreen-page flex flex-col">
            {/* Header */}
            <div className="px-6 pt-safe pb-4">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action">
                        <X className="w-6 h-6" />
                    </button>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">Review — {exam.title}</span>
                    <div className="w-10" />
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                    <button
                        onClick={() => setFilter('correct')}
                        className={`shrink-0 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold border transition-colors tap-action ${filter === 'correct' ? 'bg-green-500/15 border-green-500/50 text-green-400' : 'glass-panel border-claude-border text-claude-secondary'}`}
                    >
                        Correct ({correctCount})
                    </button>
                </div>
            </div>

            {/* Question list */}
            <div className="flex-1 overflow-y-auto px-6 pb-safe space-y-3">
                {filteredQuestions.map((item) => {
                    const isExpanded = expandedIndex === item.index;
                    const ans = item.answer;
                    const isCorrect = ans?.isCorrect;
                    const isShortAnswer = item.type === 'short_answer';

                    return (
                        <motion.div
                            key={item.index}
                            layout
                            className={`rounded-2xl border overflow-hidden transition-colors ${isCorrect ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}
                        >
                            {/* Question header — always visible */}
                            <button
                                onClick={() => setExpandedIndex(isExpanded ? null : item.index)}
                                className="w-full p-4 text-left flex items-start gap-3 tap-action"
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                    {isCorrect ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                    ) : (
                                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-body text-claude-text leading-relaxed line-clamp-2">{item.question}</p>
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
                                                Short Answer
                                            </span>
                                        )}
                                        {isShortAnswer && ans?.gradeScore != null && (
                                            <span className={`font-mono text-[9px] font-bold ${ans.gradeScore >= 70 ? 'text-green-400' : ans.gradeScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {ans.gradeScore}/100
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-claude-secondary shrink-0" /> : <ChevronDown className="w-4 h-4 text-claude-secondary shrink-0" />}
                            </button>

                            {/* Expanded detail */}
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="px-4 pb-4 space-y-3"
                                >
                                    {/* Your answer vs correct */}
                                    {!isShortAnswer ? (
                                        <div className="space-y-2">
                                            <div className={`p-3 rounded-xl border text-sm font-body ${isCorrect ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}`}>
                                                <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1">Your Answer</span>
                                                {ans?.selected}
                                            </div>
                                            {!isCorrect && (
                                                <div className="p-3 rounded-xl border border-green-500/30 text-sm font-body text-green-400">
                                                    <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1">Correct Answer</span>
                                                    {item.correct_answer}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="p-3 rounded-xl border border-claude-border text-sm font-body text-claude-text">
                                                <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1 text-claude-secondary">Your Answer</span>
                                                {ans?.selected}
                                            </div>
                                            <div className="p-3 rounded-xl border border-claude-accent/30 text-sm font-body text-claude-text">
                                                <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1 text-claude-accent">Model Answer</span>
                                                {item.correct_answer}
                                            </div>
                                            {ans?.feedback && (
                                                <div className="p-3 rounded-xl border border-claude-border text-sm font-body text-claude-text">
                                                    <span className="font-mono text-[9px] uppercase tracking-widest font-bold block mb-1 text-claude-secondary">AI Feedback</span>
                                                    {ans.feedback}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Explanation */}
                                    {(item.explanation || ans?.explanation) && (
                                        <div className="p-3 rounded-xl glass-panel border border-claude-border">
                                            <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-claude-secondary block mb-1">Explanation</span>
                                            <p className="text-sm font-body text-claude-text leading-relaxed">{item.explanation || ans?.explanation}</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    );
                })}

                {filteredQuestions.length === 0 && (
                    <div className="text-center py-12 text-claude-secondary font-serif italic">
                        No questions match this filter.
                    </div>
                )}
            </div>

            {/* Bottom actions */}
            <div className="px-6 py-4 pb-safe border-t border-claude-border">
                <button
                    onClick={onRetake}
                    className="w-full py-3.5 glass-panel rounded-2xl text-claude-text font-mono text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-claude-surface transition-colors tap-action"
                >
                    <RefreshCw className="w-4 h-4" />
                    Retake Exam
                </button>
            </div>
        </div>
    );
}
