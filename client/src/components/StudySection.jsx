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
    const [showDraftAnswer, setShowDraftAnswer] = useState(false);
    const hasQuiz = section.mini_quiz?.length > 0;
    const quizItem = section.mini_quiz?.[0] ?? null;
    const activeConfidence = sectionState?.confidence ?? null;
    const stepState = useMemo(() => ({
        recall: step === 'recall' ? 'active' : 'complete',
        reveal: step === 'answer' ? 'active' : (step === 'quiz' || sectionState?.completed ? 'complete' : 'idle'),
        check: step === 'quiz' ? 'active' : (sectionState?.completed ? 'complete' : 'idle'),
    }), [sectionState?.completed, step]);

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
        <div data-testid="study-section-recall" className="flex flex-col gap-3">
            <div className="guide-tone-neutral rounded-[1.4rem] p-3.5 sm:p-4">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-accent">
                    Recall First
                </p>
                <h2 className="mt-1.5 font-display text-[1.4rem] font-bold italic leading-[1.02] text-claude-text xl:text-[1.5rem]">
                    {section.title}
                </h2>
                <p className="mt-2 max-w-[38rem] text-[0.92rem] leading-[1.55] text-claude-secondary">
                    {section.recall_prompt}
                </p>
            </div>

            <div className="guide-sheet rounded-[1.3rem] p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                        Scratchpad
                    </p>
                    <button
                        type="button"
                        data-testid="study-write-toggle"
                        onClick={() => setShowDraftAnswer((current) => !current)}
                        className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-3"
                    >
                        <span>{showDraftAnswer ? 'Hide' : 'Write it out'}</span>
                    </button>
                </div>

                {showDraftAnswer ? (
                    <label className="mt-3 block">
                        <span className="sr-only">Draft answer</span>
                        <textarea
                            data-testid="study-draft-answer"
                            value={draftAnswer}
                            onChange={(event) => setDraftAnswer(event.target.value)}
                            className="min-h-[100px] w-full resize-none rounded-[1.1rem] border border-white/10 bg-black/10 px-3.5 py-3 text-[0.92rem] leading-6 text-claude-text placeholder:text-claude-secondary/65 focus:outline-none focus:ring-1 focus:ring-claude-accent"
                            rows={3}
                            placeholder="Type what you remember."
                            aria-label="Draft answer"
                        />
                    </label>
                ) : null}
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
        <div data-testid="study-section-answer" className="flex flex-col gap-3">
            <div className="guide-tone-success rounded-[1.4rem] p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-accent">
                        Reveal + Compare
                    </p>
                    {activeConfidence && (
                        <span className={`guide-status-pill ${CONFIDENCE_STYLES[activeConfidence]?.tone || 'guide-status-pill--neutral'}`}>
                            {CONFIDENCE_STYLES[activeConfidence]?.label || 'In progress'}
                        </span>
                    )}
                </div>
            </div>

            <div className="guide-stage rounded-[1.3rem] p-3.5 sm:p-4">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                    Answer points
                </p>
                <ul className="mt-2.5 space-y-2">
                    {(section.answer_points ?? []).map((point, index) => (
                        <li key={`${section.id}-answer-${index}`} className="flex items-start gap-2.5">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-claude-accent" aria-hidden="true" />
                            <span className="max-w-[40rem] text-[0.92rem] leading-[1.55] text-claude-text">{point}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {(section.common_traps ?? []).length > 0 && (
                <div className="guide-tone-warning rounded-[1.3rem] px-3.5 py-3 sm:px-4">
                    <div className="flex items-start gap-2.5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-current" />
                        <div className="space-y-1 text-[0.92rem] leading-[1.55] text-claude-text">
                            {(section.common_traps ?? []).map((trap, index) => (
                                <p key={`${section.id}-trap-${index}`}>{trap}</p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="guide-sheet rounded-[1.3rem] p-3.5 sm:p-4">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                    Rate your recall
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {Object.entries(CONFIDENCE_STYLES).map(([value, config]) => {
                        const Icon = config.icon;
                        const isActive = activeConfidence === value;

                        return (
                            <button
                                key={value}
                                type="button"
                                data-testid={`confidence-${value}`}
                                onClick={() => handleConfidence(value)}
                                className={`guide-focus-ring cursor-pointer rounded-[1.1rem] border px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.98] ${
                                    isActive
                                        ? `${config.button} shadow-[0_18px_44px_-28px_rgba(0,0,0,0.7)]`
                                        : 'guide-tone-neutral hover:border-claude-accent/30 hover:text-claude-text'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                <p className="mt-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em]">
                                    {config.label}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderQuiz = () => (
        <div data-testid="study-section-quiz" className="flex flex-col gap-3">
            <div className="guide-tone-warning rounded-[1.3rem] p-3.5 sm:p-4">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                    Checkpoint Quiz
                </p>
            </div>

            <div className="guide-sheet rounded-[1.3rem] p-3.5 sm:p-4">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                    Prompt
                </p>
                <p className="mt-2 max-w-[40rem] text-[0.95rem] leading-[1.55] text-claude-text">
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
                    <div className="guide-tone-success rounded-[1.3rem] p-3.5 sm:p-4">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                            Answer
                        </p>
                        <p className="mt-2 text-[0.92rem] leading-[1.55] text-claude-text">{quizItem.answer}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            data-testid="quiz-thumbs-down"
                            onClick={onComplete}
                            className="guide-cta guide-cta--danger guide-focus-ring w-full"
                        >
                            <ThumbsDown className="h-4 w-4" />
                            <span>Wrong</span>
                        </button>
                        <button
                            type="button"
                            data-testid="quiz-thumbs-up"
                            onClick={onComplete}
                            className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                        >
                            <ThumbsUp className="h-4 w-4" />
                            <span>Right</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div data-testid="study-section" className="flex flex-col gap-3">
            <div data-testid="study-step-track" className="guide-step-track">
                {[
                    {
                        id: 'recall',
                        eyebrow: 'Step 1',
                        title: 'Recall from memory',
                        icon: Brain,
                        state: stepState.recall,
                    },
                    {
                        id: 'reveal',
                        eyebrow: 'Step 2',
                        title: 'Reveal the answer',
                        icon: Eye,
                        state: stepState.reveal,
                    },
                    {
                        id: 'check',
                        eyebrow: 'Step 3',
                        title: hasQuiz ? 'Check with a quiz' : 'Check your confidence',
                        icon: CheckCircle2,
                        state: stepState.check,
                    },
                ].map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.id}
                            data-testid={`study-step-${item.id}`}
                            className={`guide-step-pill ${item.state === 'active' ? 'guide-step-pill--active' : ''} ${item.state === 'complete' ? 'guide-step-pill--complete' : ''}`}
                        >
                            <span className="guide-step-pill__icon">
                                <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                                <p className="guide-step-pill__eyebrow">{item.eyebrow}</p>
                                <p className="guide-step-pill__title">{item.title}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="guide-shell rounded-[1.4rem] px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="guide-status-pill guide-status-pill--neutral">
                            <Brain className="h-3.5 w-3.5" />
                            {`${sectionIndex + 1}/${sectionCount}`}
                        </span>
                        <span className={`guide-status-pill ${sectionState?.completed ? 'guide-status-pill--success' : sectionState?.revealed ? 'guide-status-pill--warning' : 'guide-status-pill--neutral'}`}>
                            {sectionState?.completed ? 'Done' : sectionState?.revealed ? 'Revealed' : 'Recall'}
                        </span>
                    </div>

                    {onEdit ? (
                        <button
                            type="button"
                            onClick={onEdit}
                            data-testid="study-edit"
                            className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-3"
                        >
                            <PenSquare className="h-3.5 w-3.5" />
                        </button>
                    ) : null}
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-claude-accent transition-all duration-300"
                        style={{ width: `${((sectionIndex + 1) / Math.max(sectionCount, 1)) * 100}%` }}
                    />
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
