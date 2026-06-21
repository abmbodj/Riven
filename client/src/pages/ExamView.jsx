import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { shuffleExamQuestions } from '../utils/examShuffle';
import ExamResults from '../components/ExamResults';
import LevelUpModal from '../components/study/LevelUpModal';
import ModePicker from '../components/exam/ModePicker';
import ExamSimRunner from '../components/exam/ExamSimRunner';
import PracticeRunner from '../components/exam/PracticeRunner';

// Orchestrator: load the exam, let the student pick a mode, then route to the matching
// runner. Exam-simulation produces a graded attempt (saved + XP + mastery) and the review
// screen; Practice is ephemeral drilling.
export default function ExamView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState(null); // null | 'exam' | 'practice'
    const [results, setResults] = useState(null);
    const [attemptSaved, setAttemptSaved] = useState(false);
    const [levelUp, setLevelUp] = useState(null);
    const [runKey, setRunKey] = useState(0);
    const attemptSaveStartedRef = useRef(false);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.getMockExam(id);
                // Defensively reshuffle options at load so legacy exams (generated before
                // the server-side shuffle fix) don't leave the correct answer in a fixed slot.
                setExam({ ...data, questions: shuffleExamQuestions(data?.questions) });
            } catch {
                toast.error('Failed to load exam');
                navigate('/exams');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate, toast]);

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

    // Persist a graded exam attempt (idempotent), update mastery, award XP. Exam mode only.
    const saveAttempt = useCallback(async (res) => {
        if (attemptSaveStartedRef.current) return;
        attemptSaveStartedRef.current = true;
        try {
            const topicBreakdown = buildTopicBreakdown(res.answers);
            const attempt = await api.createExamAttempt(exam.id, res.score, exam.questions.length, res.answers, {
                durationSeconds: res.elapsedSeconds,
                topicBreakdown,
                examTitle: exam.title,
                classId: exam.class_id,
                examMode: exam.exam_mode,
            });

            if (exam.class_id && Object.keys(topicBreakdown).length > 0) {
                try { await api.upsertTopicMastery(exam.class_id, topicBreakdown); } catch { /* non-critical */ }
            }

            if (attempt?.id) {
                try {
                    const xpResult = await api.completeExamAttempt(attempt.id);
                    if (xpResult?.stats?.leveledUp) setLevelUp(xpResult.stats);
                } catch { /* non-critical: XP is best-effort, recomputed server-side */ }
            }

            setAttemptSaved(true);
        } catch (err) {
            attemptSaveStartedRef.current = false;
            toast.error(err?.message || 'Failed to save attempt');
        }
    }, [exam, toast]);

    const handleExamComplete = useCallback((res) => {
        setResults(res);
        void saveAttempt(res);
    }, [saveAttempt]);

    const handleRetake = () => {
        setResults(null);
        setAttemptSaved(false);
        attemptSaveStartedRef.current = false;
        setRunKey((k) => k + 1);
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

    if (results) {
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
                    answers={results.answers}
                    score={results.score}
                    creditScore={results.creditScore}
                    totalMarks={results.totalMarks}
                    elapsedSeconds={results.elapsedSeconds}
                    flaggedIndices={results.flaggedIndices}
                    onRetake={handleRetake}
                    attemptSaved={attemptSaved}
                />
            </>
        );
    }

    if (mode === 'exam') return <ExamSimRunner key={runKey} exam={exam} onComplete={handleExamComplete} />;
    if (mode === 'practice') return <PracticeRunner exam={exam} />;
    return <ModePicker exam={exam} onPick={setMode} />;
}
