import React, { useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

export default function StudySection({
    section,
    sectionState,
    onReveal,
    onConfidenceSelect,
    onComplete,
}) {
    const [step, setStep] = useState('recall');
    const [quizRevealed, setQuizRevealed] = useState(false);
    const hasQuiz = section.mini_quiz?.length > 0;
    const quizItem = section.mini_quiz?.[0] ?? null;

    useEffect(() => {
        setStep('recall');
        setQuizRevealed(false);
    }, [section.id]);

    const handleShowAnswer = () => {
        onReveal();
        setStep('answer');
    };

    const handleConfidence = (confidence) => {
        onConfidenceSelect(confidence);
        if (hasQuiz) {
            setStep('quiz');
        } else {
            onComplete();
        }
    };

    if (step === 'recall') {
        return (
            <div data-testid="study-section-recall" className="flex flex-col gap-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                    {section.title}
                </p>
                <p className="text-base font-semibold leading-relaxed text-claude-text">
                    {section.recall_prompt}
                </p>
                <textarea
                    className="w-full resize-none rounded-xl border border-claude-border bg-claude-surface px-3 py-3 text-sm text-claude-text placeholder:text-claude-secondary focus:outline-none focus:ring-1 focus:ring-claude-accent"
                    rows={3}
                    placeholder="Type your answer here (optional)..."
                    aria-label="Draft answer"
                />
                <p className="text-center text-xs text-claude-secondary">
                    Can&apos;t recall? That&apos;s okay — just tap.
                </p>
                <button
                    type="button"
                    onClick={handleShowAnswer}
                    className="w-full rounded-2xl bg-claude-accent px-4 py-4 text-sm font-bold text-white transition-opacity active:opacity-80"
                >
                    Show Answer
                </button>
            </div>
        );
    }

    if (step === 'answer') {
        return (
            <div data-testid="study-section-answer" className="flex flex-col gap-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                    {section.title}
                </p>
                <ul className="space-y-1 pl-4">
                    {section.answer_points.map((point, i) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={i} className="list-disc text-sm leading-relaxed text-claude-text">
                            {point}
                        </li>
                    ))}
                </ul>
                {section.common_traps.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-amber-700">
                            Common trap
                        </p>
                        {section.common_traps.map((trap, i) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <p key={i} className="text-xs text-amber-800">{trap}</p>
                        ))}
                    </div>
                )}
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                    How did you do?
                </p>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { value: 'need_work', label: 'Need Work', className: 'border-red-200 bg-red-50 text-red-700' },
                        { value: 'okay', label: 'Okay', className: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
                        { value: 'know_it', label: 'Got It', className: 'border-green-200 bg-green-50 text-green-700' },
                    ].map(({ value, label, className }) => (
                        <button
                            key={value}
                            type="button"
                            data-testid={`confidence-${value}`}
                            onClick={() => handleConfidence(value)}
                            className={`rounded-xl border px-2 py-3 text-xs font-semibold transition-opacity active:opacity-70 ${className}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // step === 'quiz'
    return (
        <div data-testid="study-section-quiz" className="flex flex-col gap-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                Checkpoint
            </p>
            <p className="text-base font-semibold leading-relaxed text-claude-text">
                {quizItem.prompt}
            </p>
            {!quizRevealed ? (
                <button
                    type="button"
                    onClick={() => setQuizRevealed(true)}
                    className="w-full rounded-2xl border border-claude-border bg-claude-surface px-4 py-3 text-sm font-semibold text-claude-text"
                >
                    Show Answer
                </button>
            ) : (
                <>
                    <div className="rounded-xl border border-claude-border bg-claude-surface px-3 py-3">
                        <p className="text-sm text-claude-text">{quizItem.answer}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            data-testid="quiz-thumbs-down"
                            onClick={onComplete}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700"
                        >
                            <ThumbsDown className="h-4 w-4" />
                            Got it wrong
                        </button>
                        <button
                            type="button"
                            data-testid="quiz-thumbs-up"
                            onClick={onComplete}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm font-semibold text-green-700"
                        >
                            <ThumbsUp className="h-4 w-4" />
                            Got it right
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
