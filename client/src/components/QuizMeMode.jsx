import React, { useMemo, useState } from 'react';
import { Brain, CircleAlert, Eye, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';

export default function QuizMeMode({ questions, onComplete }) {
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [results, setResults] = useState([]); // { sectionId, correct }[]

    const question = questions[index];
    const progress = useMemo(() => (
        questions.length ? `${index + 1} / ${questions.length}` : '0 / 0'
    ), [index, questions.length]);

    if (questions.length === 0) {
        return (
            <div data-testid="quiz-empty" className="guide-shell rounded-[1.8rem] p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-claude-accent">
                    <CircleAlert className="h-5 w-5" />
                </div>
                <p className="mt-5 font-display text-[1.5rem] font-bold italic text-claude-text">
                    No quiz prompts yet
                </p>
                <p className="mt-3 text-sm leading-6 text-claude-secondary">
                    Add a mini-quiz item to any section and this mode will turn it into a rapid-fire recall run.
                </p>
            </div>
        );
    }

    const handleAnswer = (correct) => {
        const newResults = [...results, { sectionId: question.sectionId, correct }];
        if (index + 1 >= questions.length) {
            const score = newResults.filter((result) => result.correct).length;
            const weakSectionIds = [...new Set(newResults.filter((result) => !result.correct).map((result) => result.sectionId))];
            setResults(newResults);
            onComplete({ score, total: questions.length, weakSectionIds });
        } else {
            setResults(newResults);
            setIndex(index + 1);
            setRevealed(false);
        }
    };

    return (
        <div data-testid="quiz-mode-root" className="flex flex-col gap-5">
            <div className="guide-shell rounded-[1.8rem] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="guide-status-pill guide-status-pill--warning">
                            <Brain className="h-3.5 w-3.5" />
                            Quiz Me
                        </span>
                        {question.sectionTitle ? (
                            <span className="guide-status-pill guide-status-pill--neutral">
                                {question.sectionTitle}
                            </span>
                        ) : null}
                    </div>
                    <span className="guide-status-pill guide-status-pill--neutral">{progress}</span>
                </div>

                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-claude-accent transition-all duration-300"
                        style={{ width: `${((index + 1) / questions.length) * 100}%` }}
                    />
                </div>

                <div className="mt-5 guide-tone-neutral rounded-[1.55rem] p-4 sm:p-5">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                        Prompt
                    </p>
                    <p className="mt-3 text-lg leading-8 text-claude-text">
                        {question.prompt}
                    </p>
                </div>
            </div>

            {!revealed ? (
                <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="guide-cta guide-cta--primary guide-focus-ring w-full"
                >
                    <Eye className="h-4 w-4" />
                    <span>Show Answer</span>
                </button>
            ) : (
                <>
                    <div className="guide-tone-success rounded-[1.55rem] p-4 sm:p-5">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                            Answer
                        </p>
                        <p className="mt-3 text-base leading-7 text-claude-text">{question.answer}</p>
                    </div>

                    <div className="guide-tone-warning rounded-[1.55rem] p-4">
                        <p className="text-sm leading-6 text-claude-secondary">
                            Mark this based on whether you truly recalled it before revealing, not whether it looks familiar now.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            data-testid="quiz-incorrect"
                            onClick={() => handleAnswer(false)}
                            className="guide-cta guide-cta--danger guide-focus-ring w-full"
                        >
                            <ThumbsDown className="h-4 w-4" />
                            <span>Got it wrong</span>
                        </button>
                        <button
                            type="button"
                            data-testid="quiz-correct"
                            onClick={() => handleAnswer(true)}
                            className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                        >
                            <ThumbsUp className="h-4 w-4" />
                            <span>Got it right</span>
                        </button>
                    </div>
                </>
            )}

            <div className="guide-tone-neutral rounded-[1.5rem] p-4 text-sm leading-6 text-claude-secondary">
                <div className="flex items-center gap-2 text-claude-accent">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em]">Quiz rhythm</span>
                </div>
                <p className="mt-2">
                    One prompt at a time, no filler. This mode is built for pressure-testing recall speed before an exam.
                </p>
            </div>
        </div>
    );
}
