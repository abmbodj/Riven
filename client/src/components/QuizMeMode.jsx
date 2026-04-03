import React, { useState } from 'react';

export default function QuizMeMode({ questions, onComplete }) {
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [results, setResults] = useState([]); // { sectionId, correct }[]

    if (questions.length === 0) {
        return (
            <div data-testid="quiz-empty" className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-sm text-claude-secondary">
                    No quiz questions available for this guide.
                </p>
            </div>
        );
    }

    const question = questions[index];
    const progress = `${index + 1} / ${questions.length}`;

    const handleAnswer = (correct) => {
        const newResults = [...results, { sectionId: question.sectionId, correct }];
        if (index + 1 >= questions.length) {
            const score = newResults.filter((r) => r.correct).length;
            const weakSectionIds = [...new Set(newResults.filter((r) => !r.correct).map((r) => r.sectionId))];
            setResults(newResults);
            onComplete({ score, total: questions.length, weakSectionIds });
        } else {
            setResults(newResults);
            setIndex(index + 1);
            setRevealed(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                    Quiz Me
                </p>
                <p className="text-xs text-claude-secondary">{progress}</p>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-claude-border">
                <div
                    className="h-full rounded-full bg-claude-accent transition-all"
                    style={{ width: `${((index + 1) / questions.length) * 100}%` }}
                />
            </div>

            <p className="text-base font-semibold leading-relaxed text-claude-text">
                {question.prompt}
            </p>

            {!revealed ? (
                <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="w-full rounded-2xl bg-claude-accent px-4 py-4 text-sm font-bold text-white transition-opacity active:opacity-80"
                >
                    Show Answer
                </button>
            ) : (
                <>
                    <div className="rounded-xl border border-claude-border bg-claude-surface px-4 py-3">
                        <p className="text-sm text-claude-text">{question.answer}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            data-testid="quiz-incorrect"
                            onClick={() => handleAnswer(false)}
                            className="flex flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700"
                        >
                            Got it wrong
                        </button>
                        <button
                            type="button"
                            data-testid="quiz-correct"
                            onClick={() => handleAnswer(true)}
                            className="flex flex-1 items-center justify-center rounded-xl border border-green-200 bg-green-50 py-3 text-sm font-semibold text-green-700"
                        >
                            Got it right
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
