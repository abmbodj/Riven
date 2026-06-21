import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bookmark } from 'lucide-react';

// Bottom-sheet question navigator for Exam-simulation mode: jump to any question,
// see which are answered / flagged / current at a glance.
export default function ExamNavigator({ open, onClose, count, currentIndex, answeredSet, flaggedSet, onJump }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-claude-bg/60 md:backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative bg-claude-bg w-full p-6 rounded-t-[2rem] border-t border-claude-border pb-safe max-h-[70dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif italic text-xl font-bold text-claude-text">Questions</h3>
              <button onClick={onClose} className="p-2 text-claude-secondary tap-action" aria-label="Close navigator">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5">
              {Array.from({ length: count }).map((_, i) => {
                const answered = answeredSet.has(i);
                const current = i === currentIndex;
                const cls = current
                  ? 'border-claude-accent bg-claude-accent text-white'
                  : answered
                    ? 'border-claude-accent/40 bg-claude-accent/10 text-claude-text'
                    : 'glass-panel border-claude-border text-claude-secondary';
                return (
                  <button
                    key={i}
                    onClick={() => { onJump(i); onClose(); }}
                    className={`relative aspect-square rounded-xl border font-mono text-sm font-bold flex items-center justify-center tap-action ${cls}`}
                  >
                    {i + 1}
                    {flaggedSet.has(i) && (
                      <Bookmark className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400" fill="currentColor" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-5 flex-wrap">
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-claude-secondary">
                <span className="w-3 h-3 rounded bg-claude-accent/20 border border-claude-accent/40" /> Answered
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-claude-secondary">
                <Bookmark className="w-3 h-3 text-yellow-400" fill="currentColor" /> Flagged
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
