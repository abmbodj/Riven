import React from 'react';
import { BookOpen } from 'lucide-react';
import SubjectRenderer from '../ui/SubjectRenderer';

const TYPE_LABEL = {
  mcq: 'Multiple Choice',
  multi_select: 'Select All',
  true_false: 'True / False',
  numeric: 'Numeric',
  short_answer: 'Short Answer',
};

// The shared question header: type + marks labels, then the prompt (with KaTeX).
export default function QuestionStem({ question }) {
  const marks = Number(question.marks) > 0 ? Number(question.marks) : 1;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-claude-accent font-bold">
          {question.type === 'short_answer' && <BookOpen className="w-3.5 h-3.5" />}
          {TYPE_LABEL[question.type] || 'Question'}
        </span>
        <span className="w-1 h-1 rounded-full bg-claude-secondary/40" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">
          {marks} {marks === 1 ? 'mark' : 'marks'}
        </span>
      </div>
      <div className="text-xl sm:text-2xl font-serif italic font-bold text-claude-text leading-snug mb-8">
        <SubjectRenderer content={question.question} />
      </div>
    </div>
  );
}
