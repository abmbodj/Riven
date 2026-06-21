import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, XCircle, ChevronRight, Loader2, Send, Flame } from 'lucide-react';
import { api } from '../../api';
import { scoreBand } from '../../utils/grading';
import { gradeObjective } from '../../utils/examGrading';
import { shuffleArray, shuffleExamQuestions } from '../../utils/examShuffle';
import SubjectRenderer from '../ui/SubjectRenderer';
import QuestionStem from './QuestionStem';
import AnswerInput, { hasAnswer, correctAnswerText } from './answerTypes';

// Practice runner: instant feedback + explanation after every question, endless reshuffled
// drill over the exam's question bank. Low-stakes (no saved attempt, no clock).
export default function PracticeRunner({ exam }) {
  const navigate = useNavigate();
  const questions = exam.questions || [];

  const makeDeck = () => shuffleExamQuestions(shuffleArray(questions));
  const [deck, setDeck] = useState(makeDeck);
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(1);

  const [value, setValue] = useState(undefined);
  const [revealed, setRevealed] = useState(false);
  const [objCorrect, setObjCorrect] = useState(false);
  const [saResult, setSaResult] = useState(null);
  const [saGrading, setSaGrading] = useState(false);

  const [stats, setStats] = useState({ correct: 0, wrong: 0, streak: 0 });

  const question = deck[pos];
  const isCorrect = question?.type === 'short_answer' ? saResult?.band?.band === 'correct' : objCorrect;
  const isPartial = question?.type === 'short_answer' && saResult?.band?.band === 'partial';

  const registerOutcome = (ok) => setStats((s) => ({
    correct: s.correct + (ok ? 1 : 0),
    wrong: s.wrong + (ok ? 0 : 1),
    streak: ok ? s.streak + 1 : 0,
  }));

  const handleCheck = async () => {
    if (revealed || saGrading || !hasAnswer(question, value)) return;
    if (question.type === 'short_answer') {
      setSaGrading(true);
      try {
        const r = await api.gradeShortAnswer(question.question, String(value).trim(), question.correct_answer, question.grading_rubric);
        const band = scoreBand(r.score);
        setSaResult({ ...r, band });
        registerOutcome(band.band === 'correct');
      } catch {
        setSaResult({ score: 0, feedback: 'Could not grade that answer. Try again.', band: scoreBand(0) });
        registerOutcome(false);
      } finally {
        setSaGrading(false);
        setRevealed(true);
      }
    } else {
      const g = gradeObjective(question, value);
      setObjCorrect(g.isCorrect);
      registerOutcome(g.isCorrect);
      setRevealed(true);
    }
  };

  const handleNext = () => {
    setValue(undefined);
    setRevealed(false);
    setObjCorrect(false);
    setSaResult(null);
    if (pos + 1 >= deck.length) {
      setDeck(makeDeck());
      setPos(0);
      setRound((r) => r + 1);
    } else {
      setPos((p) => p + 1);
    }
  };

  const scoreItems = useMemo(() => ([
    { label: 'Correct', value: stats.correct, color: 'text-green-400' },
    { label: 'Wrong', value: stats.wrong, color: 'text-red-400' },
    { label: 'Streak', value: stats.streak, color: 'text-yellow-400', icon: stats.streak >= 3 ? Flame : null },
  ]), [stats]);

  if (!question) return null;

  return (
    <div className="fullscreen-page flex flex-col">
      {/* Header + score bar */}
      <div className="px-6 pt-safe pb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/exams')} className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action" aria-label="Exit practice">
            <X className="w-6 h-6" />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">
            Practice · Round {round}
          </span>
          <span className="w-10" />
        </div>
        <div className="flex items-center justify-around glass-panel rounded-2xl border border-claude-border py-2.5">
          {scoreItems.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5">
              <span className={`font-serif italic text-xl font-bold tabular-nums flex items-center gap-1 ${s.color}`}>
                {s.icon && <s.icon className="w-4 h-4" />}
                {s.value}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-widest text-claude-secondary">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <motion.div key={`${round}-${pos}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="mx-auto w-full max-w-2xl">
          <QuestionStem question={question} />
          <AnswerInput question={question} value={value} onChange={setValue} disabled={revealed} revealed={revealed} />

          {/* Feedback */}
          <AnimatePresence>
            {revealed && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
                <div className={`p-4 rounded-2xl border ${isCorrect ? 'border-green-500/30 bg-green-500/5' : isPartial ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className={`w-4 h-4 ${isPartial ? 'text-yellow-400' : 'text-red-400'}`} />}
                    <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${isCorrect ? 'text-green-400' : isPartial ? 'text-yellow-400' : 'text-red-400'}`}>
                      {isCorrect ? 'Correct' : isPartial ? 'Partial credit' : 'Not quite'}
                      {question.type === 'short_answer' && saResult ? ` · ${saResult.score}/100` : ''}
                    </span>
                  </div>
                  {!isCorrect && (
                    <div className="font-body text-sm text-claude-text leading-relaxed mt-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary block mb-1">
                        {question.type === 'short_answer' ? 'Model answer' : 'Answer'}
                      </span>
                      <SubjectRenderer content={correctAnswerText(question)} />
                    </div>
                  )}
                  {question.type === 'short_answer' && saResult?.feedback && (
                    <div className="font-body text-sm text-claude-text leading-relaxed mt-2"><SubjectRenderer content={saResult.feedback} /></div>
                  )}
                </div>

                {question.explanation && (
                  <div className="p-4 rounded-2xl glass-panel border border-claude-border">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-claude-accent font-bold block mb-1">Why</span>
                    <div className="font-body text-sm text-claude-text leading-relaxed"><SubjectRenderer content={question.explanation} /></div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Footer action */}
      <div className="px-6 pb-safe pt-3 border-t border-claude-border">
        <div className="mx-auto w-full max-w-2xl">
          {!revealed ? (
            <button
              onClick={handleCheck}
              disabled={!hasAnswer(question, value) || saGrading}
              className="w-full claude-button-primary py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50 font-bold"
            >
              {saGrading ? <><Loader2 className="w-5 h-5 animate-spin" /> Grading...</> : <><Send className="w-5 h-5" /> Check</>}
            </button>
          ) : (
            <button onClick={handleNext} className="w-full claude-button-primary py-4 text-lg flex items-center justify-center gap-2 font-bold">
              Next <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
