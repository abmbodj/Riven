import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SubjectRenderer from '../ui/SubjectRenderer';

/**
 * A lightweight predict-then-reveal beat: River asks a question; the student
 * thinks, then taps to see the answer. No typing, no grading, no network call.
 *
 * Props:
 *   prompt   (string) — the question River poses
 *   answer   (string) — the answer revealed on tap
 *   isCurrent (bool)  — whether this is the frontmost (active) beat
 *   onReveal (fn)     — called when the answer is revealed so the parent can
 *                       treat it as "advance" (move past this beat)
 */
const PredictBeat = ({ prompt, answer, isCurrent, onReveal }) => {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = () => {
    if (!revealed) {
      setRevealed(true);
      onReveal?.();
    }
  };

  return (
    <div className="predict-beat" data-current-teach-target={isCurrent ? 'true' : undefined}>
      {/* Prompt */}
      <div
        className="rounded-xl px-5 py-4"
        style={{
          backgroundColor: 'rgba(142, 169, 160, 0.08)',
          border: '1px solid rgba(142, 169, 160, 0.2)',
        }}
      >
        <p
          className="mb-2 text-[9px] font-mono uppercase tracking-[0.18em]"
          style={{ color: 'rgba(142, 169, 160, 0.7)' }}
        >
          Think about it…
        </p>
        <p className="text-[15px] sm:text-base leading-[1.7]" style={{ color: '#e8dcc8' }}>
          <SubjectRenderer content={prompt} inline />
        </p>

        <AnimatePresence>
          {!revealed && (
            <motion.button
              key="reveal-btn"
              type="button"
              onClick={handleReveal}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(142, 169, 160, 0.14)',
                border: '1px solid rgba(142, 169, 160, 0.28)',
                color: '#8ea9a0',
              }}
            >
              Reveal answer
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Answer */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="mt-3 rounded-xl px-5 py-4"
              style={{
                backgroundColor: 'rgba(121, 173, 117, 0.07)',
                border: '1px solid rgba(121, 173, 117, 0.18)',
              }}
            >
              <p
                className="mb-2 text-[9px] font-mono uppercase tracking-[0.18em]"
                style={{ color: 'rgba(121, 173, 117, 0.65)' }}
              >
                River's take
              </p>
              <div className="text-[15px] sm:text-base leading-[1.7]" style={{ color: '#d4ccb8' }}>
                <SubjectRenderer content={answer} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PredictBeat;
