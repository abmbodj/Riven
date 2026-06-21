import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Bookmark, LayoutGrid, Loader2, Send } from 'lucide-react';
import { api } from '../../api';
import { scoreBand } from '../../utils/grading';
import { gradeObjective, getQuestionMarks } from '../../utils/examGrading';
import { estimateExamMinutes } from '../../utils/examMeta';
import ConfirmModal from '../ConfirmModal';
import QuestionStem from './QuestionStem';
import ExamTimer from './ExamTimer';
import ExamNavigator from './ExamNavigator';
import AnswerInput, { hasAnswer, getAnswerDisplay } from './answerTypes';

// Exam-simulation runner: timed, jump between questions, change answers freely, then
// submit once. Grading happens all at once at submit (objective locally, short-answer via
// AI). No per-question feedback during the exam.
export default function ExamSimRunner({ exam, durationMinutes, onComplete }) {
  const navigate = useNavigate();
  const questions = useMemo(() => exam.questions || [], [exam.questions]);

  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(() => new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startRef = useRef(0);
  const submittedRef = useRef(false);
  useEffect(() => { startRef.current = Date.now(); }, []);

  const totalSeconds = (durationMinutes || estimateExamMinutes(questions)) * 60;
  const question = questions[currentIndex];

  const answeredSet = useMemo(() => {
    const s = new Set();
    questions.forEach((q, i) => { if (hasAnswer(q, answers[i])) s.add(i); });
    return s;
  }, [questions, answers]);
  const answeredCount = answeredSet.size;

  const setAnswer = (value) => setAnswers((prev) => ({ ...prev, [currentIndex]: value }));

  const toggleFlag = () => setFlagged((prev) => {
    const next = new Set(prev);
    next.has(currentIndex) ? next.delete(currentIndex) : next.add(currentIndex);
    return next;
  });

  const go = (index) => setCurrentIndex(Math.max(0, Math.min(questions.length - 1, index)));

  const finalize = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setConfirmSubmit(false);
    setSubmitting(true);

    // Grade short answers via the AI grader in parallel; objective types grade locally.
    const saResults = await Promise.all(questions.map(async (q, i) => {
      if (q.type !== 'short_answer') return null;
      const val = answers[i];
      if (!val || !String(val).trim()) return { score: 0, feedback: '', keyPointsHit: [], keyPointsMissed: [] };
      try {
        return await api.gradeShortAnswer(q.question, String(val).trim(), q.correct_answer, q.grading_rubric);
      } catch {
        return { score: 0, feedback: 'Could not grade this answer.', keyPointsHit: [], keyPointsMissed: [] };
      }
    }));

    let score = 0;
    let creditScore = 0;
    let totalMarks = 0;
    const finalAnswers = questions.map((q, i) => {
      const marks = getQuestionMarks(q);
      totalMarks += marks;
      const base = {
        question: q.question,
        type: q.type,
        topic: q.topic || 'General',
        difficulty: q.difficulty || 'medium',
        selected: getAnswerDisplay(q, answers[i]),
        explanation: q.explanation,
        marks,
      };
      if (q.type === 'short_answer') {
        const r = saResults[i] || { score: 0 };
        const band = scoreBand(r.score);
        const isCorrect = band.band === 'correct';
        if (isCorrect) score += 1;
        const earnedMarks = band.credit * marks;
        creditScore += earnedMarks;
        return { ...base, isCorrect, gradeBand: band.band, gradeScore: r.score, feedback: r.feedback, keyPointsHit: r.keyPointsHit, keyPointsMissed: r.keyPointsMissed, earnedMarks };
      }
      const g = gradeObjective(q, answers[i]);
      if (g.isCorrect) score += 1;
      creditScore += g.earnedMarks;
      return { ...base, isCorrect: g.isCorrect, earnedMarks: g.earnedMarks };
    });

    onComplete({
      answers: finalAnswers,
      score,
      creditScore,
      totalMarks,
      flaggedIndices: flagged,
      elapsedSeconds: Math.round((Date.now() - startRef.current) / 1000),
    });
  };

  const requestSubmit = () => {
    if (answeredCount < questions.length) setConfirmSubmit(true);
    else finalize();
  };

  if (submitting) {
    return (
      <div className="fullscreen-page flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-claude-accent animate-spin mx-auto mb-4" />
          <p className="font-serif italic text-claude-secondary">Grading your exam...</p>
        </div>
      </div>
    );
  }

  const isFlagged = flagged.has(currentIndex);
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="fullscreen-page flex flex-col">
      {/* Header */}
      <div className="px-6 pt-safe pb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/exams')} className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action" aria-label="Exit exam">
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-claude-secondary">{currentIndex + 1} / {questions.length}</span>
            <ExamTimer totalSeconds={totalSeconds} onExpire={finalize} />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFlag}
              className={`p-2 tap-action transition-colors ${isFlagged ? 'text-yellow-400' : 'text-claude-secondary/40 hover:text-claude-secondary'}`}
              aria-label={isFlagged ? 'Unflag question' : 'Flag question'}
            >
              <Bookmark className="w-4 h-4" fill={isFlagged ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => setNavOpen(true)} className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action" aria-label="Open navigator">
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="w-full h-1.5 bg-claude-surface rounded-full overflow-hidden">
          <div className="h-full bg-claude-accent rounded-full transition-[width] duration-300" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <motion.div key={currentIndex} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="mx-auto w-full max-w-2xl">
          <QuestionStem question={question} />
          <AnswerInput question={question} value={answers[currentIndex]} onChange={setAnswer} />
        </motion.div>
      </div>

      {/* Footer nav */}
      <div className="px-6 pb-safe pt-3 border-t border-claude-border">
        <div className="mx-auto w-full max-w-2xl flex items-center gap-3">
          <button
            onClick={() => go(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-4 py-3 glass-panel rounded-2xl text-claude-text font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-30 tap-action"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          {isLast ? (
            <button onClick={requestSubmit} className="flex-1 claude-button-primary py-3.5 flex items-center justify-center gap-2 font-bold">
              <Send className="w-4 h-4" /> Submit Exam
            </button>
          ) : (
            <>
              <button onClick={requestSubmit} className="px-4 py-3 text-claude-secondary font-mono text-[10px] uppercase tracking-widest font-bold tap-action">
                Submit
              </button>
              <button onClick={() => go(currentIndex + 1)} className="flex-1 claude-button-primary py-3.5 flex items-center justify-center gap-2 font-bold">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <ExamNavigator
        open={navOpen}
        onClose={() => setNavOpen(false)}
        count={questions.length}
        currentIndex={currentIndex}
        answeredSet={answeredSet}
        flaggedSet={flagged}
        onJump={go}
      />

      <ConfirmModal
        isOpen={confirmSubmit}
        title="Submit exam?"
        message={`You've answered ${answeredCount} of ${questions.length} questions. Unanswered questions are marked incorrect.`}
        confirmText="Submit"
        onConfirm={finalize}
        onCancel={() => setConfirmSubmit(false)}
      />
    </div>
  );
}
