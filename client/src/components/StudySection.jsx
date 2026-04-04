import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Brain,
    CheckCircle2,
    Eye,
    PenSquare,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
} from 'lucide-react';

const CONFIDENCE_STYLES = {
    need_work: {
        label: 'Need Work',
        icon: AlertTriangle,
        tone: 'guide-status-pill--danger',
        button: 'guide-tone-danger',
        helper: 'Needs another pass',
    },
    okay: {
        label: 'Okay',
        icon: Sparkles,
        tone: 'guide-status-pill--warning',
        button: 'guide-tone-warning',
        helper: 'Close, but still shaky',
    },
    know_it: {
        label: 'Got It',
        icon: CheckCircle2,
        tone: 'guide-status-pill--success',
        button: 'guide-tone-success',
        helper: 'Feels exam-ready',
    },
};

function getInitialStep(sectionState) {
    return sectionState?.revealed ? 'answer' : 'recall';
}

function NavButton({ direction, disabled, onClick }) {
    const Icon = direction === 'previous' ? ArrowLeft : ArrowRight;
    const label = direction === 'previous' ? 'Previous' : 'Next';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            data-testid={`study-${direction}`}
            className="guide-cta guide-cta--ghost guide-focus-ring flex-1 disabled:cursor-not-allowed disabled:opacity-35"
        >
            {direction === 'previous' ? <Icon className="h-4 w-4" /> : null}
            <span>{label}</span>
            {direction === 'next' ? <Icon className="h-4 w-4" /> : null}
        </button>
    );
}

function StudySectionBody({
    section,
    sectionState,
    onReveal,
    onConfidenceSelect,
    onComplete,
    sectionIndex = 0,
    sectionCount = 1,
    canGoPrevious = false,
    canGoNext = false,
    onPrevious,
    onNext,
    onEdit,
}) {
    const [step, setStep] = useState(() => getInitialStep(sectionState));
    const [quizRevealed, setQuizRevealed] = useState(false);
    const [draftAnswer, setDraftAnswer] = useState('');
    const hasQuiz = section.mini_quiz?.length > 0;
    const quizItem = section.mini_quiz?.[0] ?? null;
    const activeConfidence = sectionState?.confidence ?? null;

    const nextDisabled = useMemo(() => {
        if (!canGoNext) return true;
        return !sectionState?.revealed && !sectionState?.completed;
    }, [canGoNext, sectionState?.completed, sectionState?.revealed]);

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

    const renderRecall = () => (
        <div data-testid="study-section-recall" className="flex flex-col gap-4">
            <div className="guide-tone-neutral rounded-[1.6rem] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-claude-accent">
                        <Brain className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-accent">
                            Recall First
                        </p>
                        <h2 className="mt-2 font-display text-[1.6rem] font-bold italic leading-[1.02] text-claude-text xl:text-[1.7rem]">
                            {section.title}
                        </h2>
                        <p className="mt-3 max-w-[38rem] text-[0.95rem] leading-[1.6] text-claude-secondary">
                            {section.recall_prompt}
                        </p>
                    </div>
                </div>
            </div>

            <label className="guide-sheet rounded-[1.5rem] p-4 sm:p-5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                    Draft your answer
                </span>
                <textarea
                    value={draftAnswer}
                    onChange={(event) => setDraftAnswer(event.target.value)}
                    className="mt-3 min-h-[128px] w-full resize-none rounded-[1.3rem] border border-white/10 bg-black/10 px-4 py-4 text-[0.95rem] leading-6 text-claude-text placeholder:text-claude-secondary/65 focus:outline-none focus:ring-1 focus:ring-claude-accent"
                    rows={4}
                    placeholder="Type what you remember. This stays on-device for your current session."
                    aria-label="Draft answer"
                />
            </label>

            <div className="guide-tone-warning rounded-[1.5rem] p-4">
                <p className="text-[0.95rem] leading-[1.6] text-claude-text">
                    Can&apos;t recall everything? That&apos;s okay. Try your best, then reveal the answer and compare.
                </p>
            </div>

            <button
                type="button"
                onClick={handleShowAnswer}
                className="guide-cta guide-cta--primary guide-focus-ring w-full"
            >
                <Eye className="h-4 w-4" />
                <span>Show Answer</span>
            </button>
        </div>
    );

    const renderAnswer = () => (
        <div data-testid="study-section-answer" className="flex flex-col gap-4">
            <div className="guide-tone-success rounded-[1.6rem] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-accent">
                            Reveal + Compare
                        </p>
                        <p className="mt-2 text-[0.95rem] leading-[1.6] text-claude-secondary">
                            Scan the answer points, then rate how solid the recall felt.
                        </p>
                    </div>
                    {activeConfidence && (
                        <span className={`guide-status-pill ${CONFIDENCE_STYLES[activeConfidence]?.tone || 'guide-status-pill--neutral'}`}>
                            {CONFIDENCE_STYLES[activeConfidence]?.label || 'In progress'}
                        </span>
                    )}
                </div>
            </div>

            <div className="guide-sheet rounded-[1.5rem] p-4 sm:p-5">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                    Answer points
                </p>
                <ul className="mt-3 space-y-2.5">
                    {(section.answer_points ?? []).map((point, index) => (
                        <li key={`${section.id}-answer-${index}`} className="flex items-start gap-3">
                            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-claude-accent" aria-hidden="true" />
                            <span className="max-w-[40rem] text-[0.95rem] leading-[1.6] text-claude-text">{point}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {(section.common_traps ?? []).length > 0 && (
                <div className="guide-tone-warning rounded-[1.5rem] p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-current" />
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                                Common trap
                            </p>
                            <div className="mt-3 space-y-1.5 text-[0.95rem] leading-[1.6] text-claude-text">
                                {(section.common_traps ?? []).map((trap, index) => (
                                    <p key={`${section.id}-trap-${index}`}>{trap}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="guide-sheet rounded-[1.5rem] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            Rate your recall
                        </p>
                        <p className="mt-2 text-[0.95rem] leading-[1.6] text-claude-secondary">
                            Be honest. This is what powers weak-section review.
                        </p>
                    </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {Object.entries(CONFIDENCE_STYLES).map(([value, config]) => {
                        const Icon = config.icon;
                        const isActive = activeConfidence === value;

                        return (
                            <button
                                key={value}
                                type="button"
                                data-testid={`confidence-${value}`}
                                onClick={() => handleConfidence(value)}
                                className={`guide-focus-ring rounded-[1.3rem] border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
                                    isActive
                                        ? `${config.button} shadow-[0_18px_44px_-28px_rgba(0,0,0,0.7)]`
                                        : 'guide-tone-neutral hover:border-claude-accent/30 hover:text-claude-text'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em]">
                                            {config.label}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-inherit opacity-80">
                                            {config.helper}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderQuiz = () => (
        <div data-testid="study-section-quiz" className="flex flex-col gap-4">
            <div className="guide-tone-warning rounded-[1.6rem] p-4 sm:p-5">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                    Checkpoint Quiz
                </p>
                <p className="mt-3 text-[0.95rem] leading-[1.6] text-claude-secondary">
                    One more fast recall check before moving on.
                </p>
            </div>

            <div className="guide-sheet rounded-[1.5rem] p-4 sm:p-5">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                    Prompt
                </p>
                <p className="mt-3 max-w-[40rem] text-[1.02rem] leading-7 text-claude-text">
                    {quizItem.prompt}
                </p>
            </div>

            {!quizRevealed ? (
                <button
                    type="button"
                    onClick={() => setQuizRevealed(true)}
                    className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                >
                    <Eye className="h-4 w-4" />
                    <span>Show Answer</span>
                </button>
            ) : (
                <>
                    <div className="guide-tone-success rounded-[1.5rem] p-4 sm:p-5">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                            Answer
                        </p>
                        <p className="mt-3 text-[0.98rem] leading-[1.65] text-claude-text">{quizItem.answer}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            data-testid="quiz-thumbs-down"
                            onClick={onComplete}
                            className="guide-cta guide-cta--danger guide-focus-ring w-full"
                        >
                            <ThumbsDown className="h-4 w-4" />
                            <span>Got it wrong</span>
                        </button>
                        <button
                            type="button"
                            data-testid="quiz-thumbs-up"
                            onClick={onComplete}
                            className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                        >
                            <ThumbsUp className="h-4 w-4" />
                            <span>Got it right</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div data-testid="study-section" className="flex flex-col gap-4">
            <div className="guide-shell rounded-[1.75rem] p-4 sm:p-5">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="guide-status-pill guide-status-pill--neutral">
                                <Brain className="h-3.5 w-3.5" />
                                {`Checkpoint ${sectionIndex + 1} / ${sectionCount}`}
                            </span>
                            <span className={`guide-status-pill ${sectionState?.completed ? 'guide-status-pill--success' : sectionState?.revealed ? 'guide-status-pill--warning' : 'guide-status-pill--neutral'}`}>
                                {sectionState?.completed ? 'Completed' : sectionState?.revealed ? 'Revealed' : 'Recall first'}
                            </span>
                        </div>

                        {onEdit ? (
                            <button
                                type="button"
                                onClick={onEdit}
                                data-testid="study-edit"
                                className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-4"
                            >
                                <PenSquare className="h-4 w-4" />
                                <span>Edit</span>
                            </button>
                        ) : null}
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-claude-accent transition-all duration-300"
                            style={{ width: `${((sectionIndex + 1) / Math.max(sectionCount, 1)) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {step === 'recall' ? renderRecall() : null}
            {step === 'answer' ? renderAnswer() : null}
            {step === 'quiz' ? renderQuiz() : null}

            <div className="grid grid-cols-2 gap-3">
                <NavButton direction="previous" disabled={!canGoPrevious} onClick={onPrevious} />
                <NavButton direction="next" disabled={nextDisabled} onClick={onNext} />
            </div>
        </div>
    );
}

export default function StudySection(props) {
    const resetKey = `${props.section.id}:${props.sectionState?.revealed ? 'revealed' : 'hidden'}`;
    return <StudySectionBody key={resetKey} {...props} />;
}
