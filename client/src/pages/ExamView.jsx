import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, CheckCircle2, XCircle, Trophy, RefreshCw, Loader2, ChevronRight,
    Send, BookOpen, ClipboardList, Tag, BarChart3
} from 'lucide-react';
import gsap from 'gsap';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { EASE, DURATION } from '../utils/animations';
import ExamReview from '../components/ExamReview';
import StudyPath from '../components/StudyPath';

const DIFFICULTY_COLORS = {
    easy: 'text-green-400 bg-green-500/10 border-green-500/20',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    hard: 'text-red-400 bg-red-500/10 border-red-500/20',
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
    const [showFeedback, setShowFeedback] = useState(false);
    const [score, setScore] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [savingAttempt, setSavingAttempt] = useState(false);
    const [attemptSaved, setAttemptSaved] = useState(false);

    const progressBarRef = useRef(null);
    const questionRef = useRef(null);
    const examStartTime = useRef(Date.now());
    const textareaRef = useRef(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.getMockExam(id);
                setExam(data);
                examStartTime.current = Date.now();
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

    // Build topic breakdown from answers
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

    const handleMCQAnswer = (answer) => {
        if (showFeedback) return;
        const question = exam.questions[currentIndex];
        const isCorrect = answer === question.correct_answer;

        setSelectedAnswer(answer);
        setShowFeedback(true);
        if (isCorrect) setScore(s => s + 1);
        setAnswers(prev => [...prev, {
            question: question.question,
            type: 'mcq',
            topic: question.topic || 'General',
            difficulty: question.difficulty || 'medium',
            selected: answer,
            correct: question.correct_answer,
            isCorrect,
            explanation: question.explanation,
        }]);
    };

    const handleShortAnswerSubmit = async () => {
        if (showFeedback || !shortAnswer.trim() || gradingAnswer) return;
        const question = exam.questions[currentIndex];

        setGradingAnswer(true);
        try {
            const result = await api.gradeShortAnswer(
                question.question,
                shortAnswer.trim(),
                question.correct_answer,
                question.grading_rubric
            );
            setGradeResult(result);
            setShowFeedback(true);

            const isCorrect = result.score >= 70;
            if (isCorrect) setScore(s => s + 1);

            setAnswers(prev => [...prev, {
                question: question.question,
                type: 'short_answer',
                topic: question.topic || 'General',
                difficulty: question.difficulty || 'medium',
                selected: shortAnswer.trim(),
                correct: question.correct_answer,
                isCorrect,
                gradeScore: result.score,
                feedback: result.feedback,
                keyPointsHit: result.keyPointsHit,
                keyPointsMissed: result.keyPointsMissed,
                explanation: question.explanation,
            }]);
        } catch {
            toast.error('Failed to grade answer. Try again.');
        } finally {
            setGradingAnswer(false);
        }
    };

    const handleNext = () => {
        if (currentIndex + 1 >= exam.questions.length) {
            setShowResults(true);
        } else {
            setCurrentIndex(i => i + 1);
            setSelectedAnswer(null);
            setShortAnswer('');
            setGradeResult(null);
            setShowFeedback(false);
        }
    };

    const handleRetake = () => {
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShortAnswer('');
        setGradeResult(null);
        setShowFeedback(false);
        setScore(0);
        setAnswers([]);
        setShowResults(false);
        setShowReview(false);
        setAttemptSaved(false);
        examStartTime.current = Date.now();
    };

    const handleSaveAttempt = async () => {
        setSavingAttempt(true);
        try {
            const durationSeconds = Math.round((Date.now() - examStartTime.current) / 1000);
            const topicBreakdown = buildTopicBreakdown(answers);

            await api.createExamAttempt(exam.id, score, exam.questions.length, answers, {
                durationSeconds,
                topicBreakdown,
            });

            // Update topic mastery
            if (exam.class_id && Object.keys(topicBreakdown).length > 0) {
                try {
                    await api.upsertTopicMastery(exam.class_id, topicBreakdown);
                } catch {
                    // Non-critical — don't block save
                }
            }

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
    const isShortAnswer = question.type === 'short_answer';
    const percentage = Math.round((score / exam.questions.length) * 100);
    const topicBreakdown = showResults ? buildTopicBreakdown(answers) : {};

    // Review screen
    if (showReview) {
        return (
            <ExamReview
                exam={exam}
                answers={answers}
                onBack={() => setShowReview(false)}
                onRetake={handleRetake}
            />
        );
    }

    // Results screen
    if (showResults) {
        const weakTopics = Object.entries(topicBreakdown)
            .filter(([, s]) => s.total > 0 && (s.correct / s.total) < 0.7)
            .map(([topic]) => topic);

        return (
            <div className="fullscreen-page flex flex-col">
                <div className="flex items-center justify-between px-6 pt-safe pb-4">
                    <button onClick={() => navigate('/exams')} className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action">
                        <X className="w-6 h-6" />
                    </button>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">{exam.title}</span>
                    <div className="w-10" />
                </div>

                <div
                    data-testid="exam-results-scroll"
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-safe sm:px-6"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                        className="mx-auto w-full max-w-6xl pb-6 sm:pb-8"
                    >
                        <div
                            data-testid="exam-results-layout"
                            className="grid gap-6 xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] xl:items-start"
                        >
                            <div className="space-y-6 xl:sticky xl:top-6">
                                {/* Score */}
                                <div className="glass-panel rounded-[32px] border border-claude-border px-5 py-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:px-6 sm:py-8">
                                    <div className="w-24 h-24 rounded-full bg-claude-accent/10 flex items-center justify-center mx-auto mb-6">
                                        <Trophy className="w-12 h-12 text-claude-accent" />
                                    </div>
                                    <h2 className="text-4xl sm:text-5xl font-serif italic font-bold text-claude-text mb-2">{percentage}%</h2>
                                    <p className="text-claude-secondary font-mono text-sm mb-4">
                                        {score} of {exam.questions.length} correct
                                    </p>
                                    <div className="w-full h-3 bg-claude-surface rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                            className={`h-full rounded-full ${percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
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

                                    <button
                                        onClick={() => setShowReview(true)}
                                        className="w-full py-4 glass-panel rounded-2xl text-claude-text font-mono text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-claude-surface transition-colors tap-action"
                                    >
                                        <ClipboardList className="w-4 h-4" />
                                        Review All Questions
                                    </button>

                                    <button onClick={handleRetake} className="w-full py-4 glass-panel rounded-2xl text-claude-text font-mono text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-claude-surface transition-colors tap-action">
                                        <RefreshCw className="w-4 h-4" />
                                        Retake Exam
                                    </button>

                                    <button onClick={() => navigate('/exams')} className="w-full py-3 text-claude-secondary font-mono text-[10px] uppercase tracking-widest font-bold tap-action">
                                        Back to Exams
                                    </button>
                                </div>
                            </div>

                            <div className="min-w-0 space-y-6">
                                {/* Topic Breakdown */}
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
                                            <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary/70">
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
                                                            <span className={`shrink-0 font-mono text-xs font-bold ${topicPct >= 70 ? 'text-green-400' : topicPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                {stats.correct}/{stats.total}
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-claude-bg rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${topicPct >= 70 ? 'bg-green-500' : topicPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                style={{ width: `${topicPct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Study Path for weak topics */}
                                {attemptSaved && weakTopics.length > 0 && percentage < 80 && (
                                    <StudyPath
                                        classId={exam.class_id}
                                        weakTopics={weakTopics}
                                        percentage={percentage}
                                    />
                                )}
                            </div>
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
                    <div className="flex items-center gap-2">
                        {question.topic && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-claude-accent/10 text-claude-accent text-[10px] font-mono font-bold uppercase tracking-wider">
                                <Tag className="w-3 h-3" />
                                {question.topic}
                            </span>
                        )}
                        <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">
                            {currentIndex + 1} / {exam.questions.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {question.difficulty && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${DIFFICULTY_COLORS[question.difficulty] || DIFFICULTY_COLORS.medium}`}>
                                {question.difficulty}
                            </span>
                        )}
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

                    <h2 className="text-xl sm:text-2xl font-serif italic font-bold text-claude-text leading-snug mb-8">
                        {question.question}
                    </h2>

                    {/* MCQ Options */}
                    {!isShortAnswer && question.options && (
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
                                        onClick={() => handleMCQAnswer(option)}
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
                    )}

                    {/* Short Answer Input */}
                    {isShortAnswer && !showFeedback && (
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
                    {isShortAnswer && showFeedback && gradeResult && (
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                            >
                                {/* Score badge */}
                                <div className={`p-4 rounded-2xl border ${gradeResult.score >= 70 ? 'bg-green-500/10 border-green-500/30' : gradeResult.score >= 40 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-claude-secondary">Your Score</span>
                                        <span className={`text-2xl font-serif italic font-bold ${gradeResult.score >= 70 ? 'text-green-400' : gradeResult.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {gradeResult.score}/100
                                        </span>
                                    </div>
                                    <p className="font-body text-sm text-claude-text leading-relaxed">{gradeResult.feedback}</p>
                                </div>

                                {/* Your answer */}
                                <div className="p-4 glass-panel rounded-2xl border border-claude-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary mb-2 font-bold">Your Answer</p>
                                    <p className="font-body text-sm text-claude-text leading-relaxed">{shortAnswer}</p>
                                </div>

                                {/* Key points */}
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

                                {/* Model answer */}
                                <div className="p-4 glass-panel rounded-2xl border border-claude-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-claude-accent mb-2 font-bold">Model Answer</p>
                                    <p className="font-body text-sm text-claude-text leading-relaxed">{question.correct_answer}</p>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    )}

                    {/* Feedback / Explanation (MCQ) */}
                    {!isShortAnswer && (
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
                    )}
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
