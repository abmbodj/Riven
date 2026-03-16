import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, CheckCircle2, XCircle, Trophy, RefreshCw, Loader2, ChevronRight
} from 'lucide-react';
import gsap from 'gsap';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { EASE, DURATION } from '../utils/animations';

export default function ExamView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [score, setScore] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [savingAttempt, setSavingAttempt] = useState(false);
    const [attemptSaved, setAttemptSaved] = useState(false);

    const progressBarRef = useRef(null);
    const questionRef = useRef(null);
    const pendingTimers = useRef(new Set());

    useEffect(() => {
        return () => {
            pendingTimers.current.forEach(t => clearTimeout(t));
            pendingTimers.current.clear();
        };
    }, []);

    const safeTimeout = useCallback((fn, ms) => {
        const t = setTimeout(() => {
            pendingTimers.current.delete(t);
            fn();
        }, ms);
        pendingTimers.current.add(t);
        return t;
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.getMockExam(id);
                setExam(data);
            } catch {
                toast.error('Failed to load exam');
                navigate('/exams');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate, toast]);

    // Animate progress bar
    useEffect(() => {
        if (!exam || !progressBarRef.current) return;
        const progress = ((currentIndex + (showFeedback ? 1 : 0)) / exam.questions.length) * 100;
        gsap.to(progressBarRef.current, {
            width: `${progress}%`,
            duration: DURATION.normal,
            ease: EASE.organic,
        });
    }, [currentIndex, showFeedback, exam]);

    // Animate question entrance
    useEffect(() => {
        if (questionRef.current && !showFeedback) {
            gsap.fromTo(questionRef.current,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: DURATION.normal, ease: EASE.reveal }
            );
        }
    }, [currentIndex, showFeedback]);

    const handleAnswer = (answer) => {
        if (showFeedback) return;

        const question = exam.questions[currentIndex];
        const isCorrect = answer === question.correct_answer;

        setSelectedAnswer(answer);
        setShowFeedback(true);
        if (isCorrect) setScore(s => s + 1);
        setAnswers(prev => [...prev, { question: question.question, selected: answer, correct: question.correct_answer, isCorrect }]);
    };

    const handleNext = () => {
        if (currentIndex + 1 >= exam.questions.length) {
            setShowResults(true);
        } else {
            setCurrentIndex(i => i + 1);
            setSelectedAnswer(null);
            setShowFeedback(false);
        }
    };

    const handleRetake = () => {
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setScore(0);
        setAnswers([]);
        setShowResults(false);
        setAttemptSaved(false);
    };

    const handleSaveAttempt = async () => {
        setSavingAttempt(true);
        try {
            await api.createExamAttempt(exam.id, score, exam.questions.length, answers);
            setAttemptSaved(true);
            toast.success('Attempt saved!');
        } catch (err) {
            toast.error(err?.message || 'Failed to save attempt');
        } finally {
            setSavingAttempt(false);
        }
    };

    if (loading) return (
        <div className="fullscreen-page flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-claude-accent animate-spin" />
        </div>
    );

    if (!exam || !exam.questions?.length) return (
        <div className="fullscreen-page flex items-center justify-center">
            <div className="text-center">
                <p className="text-claude-secondary font-serif italic mb-4">This exam has no questions.</p>
                <button onClick={() => navigate('/exams')} className="claude-button-primary">Back to Exams</button>
            </div>
        </div>
    );

    const question = exam.questions[currentIndex];
    const percentage = Math.round((score / exam.questions.length) * 100);

    // Results screen
    if (showResults) {
        return (
            <div className="fullscreen-page flex flex-col">
                <div className="flex items-center justify-between px-6 pt-safe pb-4">
                    <button onClick={() => navigate('/exams')} className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action">
                        <X className="w-6 h-6" />
                    </button>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">{exam.title}</span>
                    <div className="w-10" />
                </div>

                <div className="flex-1 flex items-center justify-center px-6">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                        className="w-full max-w-md text-center"
                    >
                        <div className="w-24 h-24 rounded-full bg-claude-accent/10 flex items-center justify-center mx-auto mb-6">
                            <Trophy className="w-12 h-12 text-claude-accent" />
                        </div>

                        <h2 className="text-4xl sm:text-5xl font-serif italic font-bold text-claude-text mb-2">{percentage}%</h2>
                        <p className="text-claude-secondary font-mono text-sm mb-8">
                            {score} of {exam.questions.length} correct
                        </p>

                        <div className="w-full h-3 bg-claude-surface rounded-full overflow-hidden mb-8">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                className={`h-full rounded-full ${percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            />
                        </div>

                        <div className="space-y-3">
                            {!attemptSaved && (
                                <button
                                    onClick={handleSaveAttempt}
                                    disabled={savingAttempt}
                                    className="claude-button-primary w-full py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {savingAttempt ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                    {savingAttempt ? 'Saving...' : 'Save Attempt'}
                                </button>
                            )}

                            <button onClick={handleRetake} className="w-full py-4 glass-panel rounded-2xl text-claude-text font-mono text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-claude-surface transition-colors tap-action">
                                <RefreshCw className="w-4 h-4" />
                                Retake Exam
                            </button>

                            <button onClick={() => navigate('/exams')} className="w-full py-3 text-claude-secondary font-mono text-[10px] uppercase tracking-widest font-bold tap-action">
                                Back to Exams
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // Question screen
    return (
        <div className="fullscreen-page flex flex-col">
            {/* Header */}
            <div className="px-6 pt-safe pb-4">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => navigate('/exams')} className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action">
                        <X className="w-6 h-6" />
                    </button>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">
                        {currentIndex + 1} / {exam.questions.length}
                    </span>
                    <div className="w-10" />
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-claude-surface rounded-full overflow-hidden">
                    <div ref={progressBarRef} className="h-full bg-claude-accent rounded-full" style={{ width: 0 }} />
                </div>
            </div>

            {/* Question */}
            <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
                <div ref={questionRef} className="flex-1">
                    <h2 className="text-xl sm:text-2xl font-serif italic font-bold text-claude-text leading-snug mb-8">
                        {question.question}
                    </h2>

                    {/* Options */}
                    <div className="space-y-3">
                        {question.options.map((option, i) => {
                            const letter = String.fromCharCode(65 + i);
                            let optionStyle = 'glass-panel border-claude-border text-claude-text';

                            if (showFeedback) {
                                if (option === question.correct_answer) {
                                    optionStyle = 'bg-green-500/15 border-green-500/50 text-green-400';
                                } else if (option === selectedAnswer && option !== question.correct_answer) {
                                    optionStyle = 'bg-red-500/15 border-red-500/50 text-red-400';
                                } else {
                                    optionStyle = 'glass-panel border-claude-border text-claude-secondary opacity-50';
                                }
                            } else if (option === selectedAnswer) {
                                optionStyle = 'bg-claude-accent/15 border-claude-accent text-claude-accent';
                            }

                            return (
                                <button
                                    key={i}
                                    onClick={() => handleAnswer(option)}
                                    disabled={showFeedback}
                                    className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3 transition-all duration-200 tap-action touch-target ${optionStyle}`}
                                >
                                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold bg-claude-bg/50 border border-current/20">
                                        {showFeedback && option === question.correct_answer ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : showFeedback && option === selectedAnswer ? (
                                            <XCircle className="w-4 h-4" />
                                        ) : letter}
                                    </span>
                                    <span className="font-body text-sm sm:text-base leading-relaxed pt-0.5">{option}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Feedback / Explanation */}
                    <AnimatePresence>
                        {showFeedback && question.explanation && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 p-4 glass-panel rounded-2xl border border-claude-border"
                            >
                                <p className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary mb-2 font-bold">Explanation</p>
                                <p className="font-body text-sm text-claude-text leading-relaxed">{question.explanation}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Next button */}
                <AnimatePresence>
                    {showFeedback && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-6 pb-safe"
                        >
                            <button
                                onClick={handleNext}
                                className="claude-button-primary w-full py-4 text-lg flex items-center justify-center gap-2"
                            >
                                {currentIndex + 1 >= exam.questions.length ? 'See Results' : 'Next Question'}
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
