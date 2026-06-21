import React from 'react';
import { CheckCircle2, XCircle, Square, CheckSquare } from 'lucide-react';
import SubjectRenderer from '../ui/SubjectRenderer';

// Reusable, presentational answer inputs for every exam question type.
// Pure UI: selection lives in the parent runner; grading lives in utils/examGrading.js.
// `revealed` turns on correct/incorrect coloring (Practice mode after answering);
// Exam-simulation mode always passes revealed=false so there are no spoilers.

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Human-readable string of the user's answer, for storage + the review screen. */
export const getAnswerDisplay = (q, v) => {
  if (v == null || v === '') return '';
  if (q.type === 'multi_select') return Array.isArray(v) ? v.join('; ') : String(v);
  if (q.type === 'numeric') return q.unit ? `${v} ${q.unit}` : String(v);
  if (q.type === 'true_false') return v === 'true' ? 'True' : v === 'false' ? 'False' : String(v);
  return String(v);
};

/** Whether the user has supplied a gradable answer (used to gate submit + navigator state). */
export const hasAnswer = (q, v) => {
  if (q?.type === 'multi_select') return Array.isArray(v) && v.length > 0;
  return v != null && String(v).trim() !== '';
};

/** The canonical correct-answer string for a question, for review + feedback display. */
export const correctAnswerText = (q) => {
  if (!q) return '';
  if (q.type === 'multi_select') return (q.correct_answers || []).join('; ');
  if (q.type === 'numeric') return q.unit ? `${q.correct_answer} ${q.unit}` : String(q.correct_answer ?? '');
  if (q.type === 'true_false') return q.correct_answer === 'true' ? 'True' : 'False';
  return String(q.correct_answer ?? '');
};

const optionClass = (state) => {
  switch (state) {
    case 'selected': return 'border-claude-accent bg-claude-accent/10 text-claude-text';
    case 'correct': return 'border-green-500/50 bg-green-500/15 text-green-400';
    case 'wrong': return 'border-red-500/50 bg-red-500/15 text-red-400';
    case 'muted': return 'glass-panel border-claude-border text-claude-secondary opacity-50';
    default: return 'glass-panel border-claude-border text-claude-text';
  }
};

function McqInput({ question, value, onChange, disabled, revealed }) {
  return (
    <div className="space-y-3">
      {question.options.map((opt, i) => {
        const selected = value === opt;
        const isCorrect = opt === question.correct_answer;
        let state = 'idle';
        if (revealed) state = isCorrect ? 'correct' : selected ? 'wrong' : 'muted';
        else if (selected) state = 'selected';
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3 transition-all duration-200 tap-action touch-target ${optionClass(state)}`}
          >
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold bg-claude-bg/50 border border-current/20">
              {revealed && isCorrect ? <CheckCircle2 className="w-4 h-4" />
                : revealed && selected ? <XCircle className="w-4 h-4" />
                  : LETTERS[i]}
            </span>
            <span className="font-body text-sm sm:text-base leading-relaxed pt-0.5">
              <SubjectRenderer content={opt} inline />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseInput({ question, value, onChange, disabled, revealed }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[{ v: 'true', label: 'True' }, { v: 'false', label: 'False' }].map(({ v, label }) => {
        const selected = value === v;
        const isCorrect = question.correct_answer === v;
        let state = 'idle';
        if (revealed) state = isCorrect ? 'correct' : selected ? 'wrong' : 'muted';
        else if (selected) state = 'selected';
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`py-6 rounded-2xl border font-serif italic text-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 tap-action touch-target ${optionClass(state)}`}
          >
            {revealed && isCorrect ? <CheckCircle2 className="w-5 h-5" />
              : revealed && selected ? <XCircle className="w-5 h-5" /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelectInput({ question, value, onChange, disabled, revealed }) {
  const picked = Array.isArray(value) ? value : [];
  const correct = new Set(question.correct_answers || []);
  const toggle = (opt) => {
    onChange(picked.includes(opt) ? picked.filter((o) => o !== opt) : [...picked, opt]);
  };
  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">Select all that apply</p>
      {question.options.map((opt, i) => {
        const isPicked = picked.includes(opt);
        const isCorrect = correct.has(opt);
        let state = 'idle';
        if (revealed) state = isCorrect ? 'correct' : isPicked ? 'wrong' : 'muted';
        else if (isPicked) state = 'selected';
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt)}
            className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3 transition-all duration-200 tap-action touch-target ${optionClass(state)}`}
          >
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-claude-bg/50 border border-current/20">
              {(isPicked || (revealed && isCorrect)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </span>
            <span className="font-body text-sm sm:text-base leading-relaxed pt-0.5">
              <SubjectRenderer content={opt} inline />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NumericInput({ question, value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-3 glass-panel rounded-2xl border border-claude-border px-4 focus-within:border-claude-accent transition-colors">
      <input
        type="text"
        inputMode="decimal"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your answer"
        className="flex-1 bg-transparent py-4 font-mono text-claude-text outline-none placeholder:text-claude-secondary/50"
        style={{ fontSize: '16px' }}
      />
      {question.unit && (
        <span className="font-mono text-sm text-claude-secondary shrink-0">
          <SubjectRenderer content={question.unit} inline />
        </span>
      )}
    </div>
  );
}

function ShortAnswerInput({ value, onChange, disabled }) {
  return (
    <textarea
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer here..."
      rows={5}
      className="w-full p-4 rounded-2xl glass-panel border border-claude-border text-claude-text font-body text-sm leading-relaxed resize-none focus:outline-none focus:border-claude-accent transition-colors placeholder:text-claude-secondary/50"
      style={{ fontSize: '16px' }}
    />
  );
}

export default function AnswerInput({ question, value, onChange, disabled = false, revealed = false }) {
  const props = { question, value, onChange, disabled, revealed };
  switch (question.type) {
    case 'true_false': return <TrueFalseInput {...props} />;
    case 'multi_select': return <MultiSelectInput {...props} />;
    case 'numeric': return <NumericInput {...props} />;
    case 'short_answer': return <ShortAnswerInput {...props} />;
    case 'mcq':
    default: return <McqInput {...props} />;
  }
}
