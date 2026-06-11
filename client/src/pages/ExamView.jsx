import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, CheckCircle2, XCircle, Loader2, ChevronRight,
    Send, BookOpen, Tag, Bookmark
} from 'lucide-react';
import gsap from 'gsap';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { EASE, DURATION } from '../utils/animations';
import { scoreBand } from '../utils/grading';
import ExamResults from '../components/ExamResults';
import LevelUpModal from '../components/study/LevelUpModal';
import SubjectRenderer from '../components/ui/SubjectRenderer';

const DIFFICULTY_COLORS = {
    easy: 'text-green-400 bg-green-500/10 border-green-500/20',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    hard: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const formatClock = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

export default function ExamView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [shortAnswer, setShortAnswer] = useState('');
    const [gradingAnswer, setGradingAnswer] = useState(false);
    const [gradeResult, setGradeResult] = useState(null);
    const [showSAFeedback, setShowSAFeedback] = useState(false);
    const [score, setScore] = useState(0);
    // creditScore accumulates partial credit (short answers can earn a fraction of a point);
    // score stays the integer count of fully-correct answers for storage + the "X of Y" label.
    const [creditScore, setCreditScore] = useState(0);
    const [levelUp, setLevelUp] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [, setSavingAttempt] = useState(false);
    const [attemptSaved, setAttemptSaved] = useState(false);
    const [flaggedIndices, setFlaggedIndices] = useState(new Set());
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    // Brief MCQ flash state: null | 'correct' | 'incorrect'
    const [mcqFlash, setMcqFlash] = useState(null);

    const progressBarRef = useRef(null);
    const questionRef = useRef(null);
    const examStartTime = useRef(Date.now());
    const questionStartTime = useRef(Date.now());
    const textareaRef = useRef(null);
    const attemptSaveStartedRef = useRef(false);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.getMockExam(id);
                setExam(data);
                examStartTime.current = Date.now();
                questionStartTime.current = Date.now();
                attemptSaveStartedRef.current = false;
            } catch {
                toast.error('Failed to load exam');
                navigate('/exams');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate, toast]);

    // Running clock
    useEffect(() => {
        if (showResults) return;
        const id = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [showResults]);

    // Animate progress bar
    useEffect(() => {
        if (!exam || !progressBarRef.current) return;
        const progress = (currentIndex / exam.questions.length) * 100;
        gsap.to(progressBarRef.current, {
            width: `${progress}%`,
            duration: DURATION.normal,
            ease: EASE.organic,
        });
    }, [currentIndex, exam]);

    // Animate question entrance
    useEffect(() => {
        if (questionRef.current && !showSAFeedback) {
            gsap.fromTo(questionRef.current,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: DURATION.normal, ease: EASE.reveal }
            );
        }
    }, [currentIndex, showSAFeedback]);

    // Reset question start time on index change
    useEffect(() => {
        questionStartTime.current = Date.now();
    }, [currentIndex]);

    const buildTopicBreakdown = (answerList) => {
        const breakdown = {};
        answerList.forEach((ans) => {
            const topic = ans.topic || 'General';
            if (!breakdown[topic]) breakdown[topic] = { correct: 0, total: 0 };
            breakdown[topic].total += 1;
            if (ans.isCorrect) breakdown[topic].correct += 1;
        });
        return breakdown;
    };

    const advanceQuestion = useCallback((_updatedAnswers) => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= (exam?.questions?.length || 0)) {
            setShowResults(true);
        } else {
            setCurrentIndex(nextIndex);
            setSelectedAnswer(null);
        }
    }, [currentIndex, exam]);

    const handleMCQAnswer = (answer) => {
        if (mcqFlash || selectedAnswer) return;
        const question = exam.questions[currentIndex];
        const isCorrect = answer === question.correct_answer;
        const timeMs = Date.now() - questionStartTime.current;

        setSelectedAnswer(answer);
        setMcqFlash(isCorrect ? 'correct' : 'incorrect');
        if (isCorrect) {
            setScore(s => s + 1);
            setCreditScore(c => c + 1);
        }

        const newAnswer = {
            question: question.question,
            type: 'mcq',
            topic: question.topic || 'General',
            difficulty: question.difficulty || 'medium',
            selected: answer,
            correct: question.correct_answer,
            isCorrect,
            explanation: question.explanation,
            time_ms: timeMs,
        };
        const updatedAnswers = [...answers, newAnswer];
        setAnswers(updatedAnswers);

        // Brief 350ms flash, then advance
        setTimeout(() => {
            setMcqFlash(null);
            setSelectedAnswer(null);
            advanceQuestion(updatedAnswers);
        }, 350);
    };

    const handleShortAnswerSubmit = async () => {
        if (showSAFeedback || !shortAnswer.trim() || gradingAnswer) return;
        const question = exam.questions[currentIndex];
        const submittedAnswer = shortAnswer.trim();
        const thinkingTimeMs = Date.now() - questionStartTime.current;

        setGradingAnswer(true);
        try {
            const result = await api.gradeShortAnswer(
                question.question,
                submittedAnswer,
                question.correct_answer,
                question.grading_rubric
            );
            setGradeResult(result);
            setShowSAFeedback(true);

            // Graduated bands: a half-right answer earns partial credit toward the total
            // instead of counting as a hard miss.
            const band = scoreBand(result.score);
            const isCorrect = band.band === 'correct';
            if (isCorrect) setScore(s => s + 1);
            setCreditScore(c => c + band.credit);

            setAnswers(prev => [...prev, {
                question: question.question,
                type: 'short_answer',
                topic: question.topic || 'General',
                difficulty: question.difficulty || 'medium',
                selected: submittedAnswer,
                correct: question.correct_answer,
                isCorrect,
                gradeBand: band.band,
                gradeScore: result.score,
                feedback: result.feedback,
                keyPointsHit: result.keyPointsHit,
                keyPointsMissed: result.keyPointsMissed,
                explanation: question.explanation,
                time_ms: thinkingTimeMs,
            }]);
        } catch {
            toast.error('Failed to grade answer. Try again.');
        } finally {
            setGradingAnswer(false);
        }
    };

    const handleSANext = () => {
        setShortAnswer('');
        setGradeResult(null);
        setShowSAFeedback(false);
        advanceQuestion(answers);
    };

    const handleRetake = () => {
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShortAnswer('');
        setGradeResult(null);
        setShowSAFeedback(false);
        setMcqFlash(null);
        setScore(0);
        setCreditScore(0);
        setLevelUp(null);
        setAnswers([]);
        setShowResults(false);
        setAttemptSaved(false);
        setFlaggedIndices(new Set());
        setElapsedSeconds(0);
        examStartTime.current = Date.now();
        questionStartTime.current = Date.now();
        attemptSaveStartedRef.current = false;
    };

    const handleSaveAttempt = useCallback(async () => {
        if (attemptSaveStartedRef.current || attemptSaved) return;

        attemptSaveStartedRef.current = true;
        setSavingAttempt(true);
        try {
            const durationSeconds = Math.round((Date.now() - examStartTime.current) / 1000);
            const topicBreakdown = buildTopicBreakdown(answers);

            const attempt = await api.createExamAttempt(exam.id, score, exam.questions.length, answers, {
                durationSeconds,
                topicBreakdown,
                examTitle: exam.title,
                classId: exam.class_id,
                examMode: exam.exam_mode,
            });

            if (exam.class_id && Object.keys(topicBreakdown).length > 0) {
                try {
                    await api.upsertTopicMastery(exam.class_id, topicBreakdown);
                } catch {
                    // Non-critical
                }
            }

            // Award XP server-side from the stored attempt (idempotent) and celebrate a level up.
            if (attempt?.id) {
                try {
                    const xpResult = await api.completeExamAttempt(attempt.id);
                    if (xpResult?.stats?.leveledUp) setLevelUp(xpResult.stats);
                } catch {
                    // Non-critical: XP is best-effort and recomputed server-side.
                }
            }

            setAttemptSaved(true);
        } catch (err) {
            attemptSaveStartedRef.current = false;
            toast.error(err?.message || 'Failed to save attempt');
        } finally {
            setSavingAttempt(false);
        }
    }, [answers, attemptSaved, exam, score, toast]);

    useEffect(() => {
        if (!showResults || attemptSaved) return;
        void handleSaveAttempt();
    }, [attemptSaved, handleSaveAttempt, showResults]);

    const toggleFlag = () => {
        setFlaggedIndices(prev => {
            const next = new Set(prev);
            next.has(currentIndex) ? next.delete(currentIndex) : next.add(currentIndex);
            return next;
        });
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
    const isShortAnswer = question.type === 'short_answer';
    const isFlagged = flaggedIndices.has(currentIndex);

    if (showResults) {
        return (
            <>
                <LevelUpModal
                    open={Boolean(levelUp)}
                    level={levelUp?.level}
                    xpTotal={levelUp?.xpTotal}
                    onClose={() => setLevelUp(null)}
                />
                <ExamResults
                    exam={exam}
                    answers={answers}
                    score={score}
                    creditScore={creditScore}
                    elapsedSeconds={elapsedSeconds}
                    flaggedIndices={flaggedIndices}
                    onRetake={handleRetake}
                    attemptSaved={attemptSaved}
                />
            </>
        );
    }

    return (
        <div className="fullscreen-page flex flex-col">
            {/* Header */}
            <div className="px-6 pt-safe pb-4">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => navigate('/exams')}
                        className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-3">
                        {question.topic && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-claude-accent/10 text-claude-accent text-[10px] font-mono font-bold uppercase tracking-wider">
                                <Tag className="w-3 h-3" />
                                {question.topic}
                            </span>
                        )}
                        <span className="font-mono text-[11px] text-claude-secondary">
                            {currentIndex + 1} / {exam.questions.length}
                        </span>
                        {/* Running clock */}
                        <span className="font-mono text-[11px] text-claude-secondary tabular-nums">
                            {formatClock(elapsedSeconds)}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {question.difficulty && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${DIFFICULTY_COLORS[question.difficulty] || DIFFICULTY_COLORS.medium}`}>
                                {question.difficulty}
                            </span>
                        )}
                        {/* Flag button */}
                        <button
                            onClick={toggleFlag}
                            className={`p-2 tap-action transition-colors ${isFlagged ? 'text-yellow-400' : 'text-claude-secondary/40 hover:text-claude-secondary'}`}
                            aria-label={isFlagged ? 'Unflag question' : 'Flag question for review'}
                        >
                            <Bookmark className="w-4 h-4" fill={isFlagged ? 'currentColor' : 'none'} />
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-claude-surface rounded-full overflow-hidden">
                    <div ref={progressBarRef} className="h-full bg-claude-accent rounded-full" style={{ width: 0 }} />
                </div>
            </div>

            {/* Question */}
            <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
                <div ref={questionRef} className="flex-1">
                    {isShortAnswer && (
                        <div className="flex items-center gap-1.5 mb-3">
                            <BookOpen className="w-3.5 h-3.5 text-claude-accent" />
                            <span className="font-mono text-[10px] uppercase tracking-widest text-claude-accent font-bold">Short Answer</span>
                        </div>
                    )}

                    <div className="text-xl sm:text-2xl font-serif italic font-bold text-claude-text leading-snug mb-8">
                        <SubjectRenderer content={question.question} />
                    </div>

                    {/* MCQ Options */}
                    {!isShortAnswer && question.options && (
                        <div className="space-y-3">
                            {question.options.map((option, i) => {
                                const letter = String.fromCharCode(65 + i);
                                let optionStyle = 'glass-panel border-claude-border text-claude-text';

                                if (mcqFlash && selectedAnswer === option) {
                                    optionStyle = mcqFlash === 'correct'
                                        ? 'bg-green-500/15 border-green-500/50 text-green-400'
                                        : 'bg-red-500/15 border-red-500/50 text-red-400';
                                } else if (mcqFlash && option === question.correct_answer && mcqFlash === 'incorrect') {
                                    // Briefly show correct answer on wrong selection
                                    optionStyle = 'bg-green-500/10 border-green-500/30 text-green-400/70';
                                } else if (mcqFlash) {
                                    optionStyle = 'glass-panel border-claude-border text-claude-secondary opacity-40';
                                }

                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleMCQAnswer(option)}
                                        disabled={!!mcqFlash}
                                        className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3 transition-all duration-200 tap-action touch-target ${optionStyle}`}
                                    >
                                        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold bg-claude-bg/50 border border-current/20">
                                            {mcqFlash && selectedAnswer === option && mcqFlash === 'correct' ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                            ) : mcqFlash && selectedAnswer === option && mcqFlash === 'incorrect' ? (
                                                <XCircle className="w-4 h-4" />
                                            ) : letter}
                                        </span>
                                        <span className="font-body text-sm sm:text-base leading-relaxed pt-0.5"><SubjectRenderer content={option} inline /></span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Short Answer Input */}
                    {isShortAnswer && !showSAFeedback && (
                        <div className="space-y-3">
                            <textarea
                                ref={textareaRef}
                                value={shortAnswer}
                                onChange={(e) => setShortAnswer(e.target.value)}
                                placeholder="Type your answer here..."
                                rows={5}
                                className="w-full p-4 rounded-2xl glass-panel border border-claude-border text-claude-text font-body text-sm leading-relaxed resize-none focus:outline-none focus:border-claude-accent transition-colors placeholder:text-claude-secondary/50"
                                style={{ fontSize: '16px' }}
                            />
                            <button
                                onClick={handleShortAnswerSubmit}
                                disabled={!shortAnswer.trim() || gradingAnswer}
                                className="claude-button-primary w-full py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {gradingAnswer ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Grading...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Submit Answer
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Short Answer Grade Result */}
                    {isShortAnswer && showSAFeedback && gradeResult && (
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                            >
                                {(() => {
                                    const band = scoreBand(gradeResult.score);
                                    return (
                                        <div className={`p-4 rounded-2xl border ${band.bg} ${band.border}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${band.text}`}>{band.label}</span>
                                                <span className={`text-2xl font-serif italic font-bold ${band.text}`}>
                                                    {gradeResult.score}/100
                                                </span>
                                            </div>
                                            <div className="font-body text-sm text-claude-text leading-relaxed"><SubjectRenderer content={gradeResult.feedback} /></div>
                                        </div>
                                    );
                                })()}

                                <div className="p-4 glass-panel rounded-2xl border border-claude-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary mb-2 font-bold">Your Answer</p>
                                    <p className="font-body text-sm text-claude-text leading-relaxed">{shortAnswer}</p>
                                </div>

                                {(gradeResult.keyPointsHit?.length > 0 || gradeResult.keyPointsMissed?.length > 0) && (
                                    <div className="p-4 glass-panel rounded-2xl border border-claude-border">
                                        {gradeResult.keyPointsHit?.length > 0 && (
                                            <div className="mb-3">
                                                <p className="text-[10px] font-mono uppercase tracking-widest text-green-400 mb-1.5 font-bold">Points Hit</p>
                                                <ul className="space-y-1">
                                                    {gradeResult.keyPointsHit.map((pt, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-claude-text font-body">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                                                            {pt}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {gradeResult.keyPointsMissed?.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1.5 font-bold">Points Missed</p>
                                                <ul className="space-y-1">
                                                    {gradeResult.keyPointsMissed.map((pt, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-claude-text font-body">
                                                            <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                                            {pt}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="p-4 glass-panel rounded-2xl border border-claude-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-claude-accent mb-2 font-bold">Model Answer</p>
                                    <div className="font-body text-sm text-claude-text leading-relaxed"><SubjectRenderer content={question.correct_answer} /></div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>

                {/* Next button — only for SA after feedback */}
                <AnimatePresence>
                    {isShortAnswer && showSAFeedback && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-6 pb-safe"
                        >
                            <button
                                onClick={handleSANext}
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
