import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { X, Timer, Zap, ChevronRight } from 'lucide-react';
import { estimateExamMinutes, countByType } from '../../utils/examMeta';

// Shown once an exam loads: choose how to take it. Exam-simulation (timed, realistic)
// or Practice (instant feedback, endless drill).
export default function ModePicker({ exam, onPick }) {
  const navigate = useNavigate();
  const questions = exam.questions || [];
  const minutes = estimateExamMinutes(questions);
  const types = countByType(questions);

  const modes = [
    {
      id: 'exam',
      icon: Timer,
      title: 'Exam Simulation',
      tag: 'Like the real thing',
      desc: 'Timed, answer everything, change answers freely, then submit once and review.',
      meta: `${questions.length} questions · ~${minutes} min`,
    },
    {
      id: 'practice',
      icon: Zap,
      title: 'Practice',
      tag: 'Learn as you go',
      desc: 'Instant feedback and explanations after every question. Drill endlessly, no clock.',
      meta: `${questions.length} questions · untimed`,
    },
  ];

  return (
    <div className="fullscreen-page flex flex-col">
      <div className="flex items-center justify-between px-6 pt-safe pb-4">
        <button
          onClick={() => navigate('/exams')}
          className="p-2 text-claude-secondary hover:text-claude-text transition-colors tap-action"
          aria-label="Back to exams"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary truncate max-w-[60%]">{exam.title}</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-safe">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-serif italic font-bold text-claude-text leading-tight mb-3">
              How do you want to study?
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {types.map((t) => (
                <span key={t.type} className="px-2 py-0.5 rounded-sm border border-claude-border bg-claude-surface font-mono text-[9px] font-bold uppercase tracking-wider text-claude-secondary">
                  {t.count} {t.label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {modes.map((m, i) => (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => onPick(m.id)}
                className="group w-full text-left glass-panel rounded-3xl border border-claude-border p-5 sm:p-6 hover:border-claude-accent/50 hover:bg-claude-surface transition-colors tap-action"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-claude-accent/10 border border-claude-accent/20 flex items-center justify-center shrink-0">
                    <m.icon className="w-6 h-6 text-claude-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-serif italic text-xl font-bold text-claude-text">{m.title}</h2>
                      <ChevronRight className="w-4 h-4 text-claude-secondary group-hover:text-claude-accent group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-claude-accent font-bold mb-2">{m.tag}</p>
                    <p className="font-body text-sm text-claude-secondary leading-relaxed mb-2">{m.desc}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-claude-secondary/70">{m.meta}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
