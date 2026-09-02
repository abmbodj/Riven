import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useMobileVisualBudget } from '../../hooks/useMobileVisualBudget.js';
import useMediaQuery from '../../hooks/useMediaQuery.js';
import SubjectRenderer from '../ui/SubjectRenderer.jsx';
import PredictBeat from './PredictBeat.jsx';
import RiverMascot from './RiverMascot.jsx';

const PANEL_EASE = [0.22, 1, 0.36, 1];

const BOARD_FRAME_STYLE = {
    padding: 'clamp(6px, 1.2vw, 14px)',
    background: 'linear-gradient(165deg, #5c3d2e 0%, #4a2f20 30%, #3d251a 70%, #2e1c13 100%)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
};
const BOARD_GRAIN_STYLE = {
    backgroundImage: 'repeating-linear-gradient(95deg, transparent, transparent 8px, rgba(255,220,180,0.15) 8px, rgba(255,220,180,0.15) 9px)',
};
const BOARD_SURFACE_STYLE = {
    background: 'linear-gradient(175deg, #2a4a3a 0%, #243f33 40%, #1e362c 70%, #1a3028 100%)',
    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.35), inset 0 0 60px rgba(0,0,0,0.15)',
};
const BOARD_DUST_STYLE = {
    backgroundImage: 'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 70% 15%, rgba(255,255,255,0.6), transparent), radial-gradient(1.5px 1.5px at 45% 80%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 85% 60%, rgba(255,255,255,0.7), transparent)',
};
const BOARD_TRAY_STYLE = {
    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.06) 80%, transparent)',
};

const hasMathSyntax = (value) => (
    typeof value === 'string'
    && /(\$\$[\s\S]+?\$\$|(^|[^$])\$(?!\$)[^$\n]+?\$(?!\$))/u.test(value)
);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPrefersReducedMotion = () => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

function DesktopRiverTracker({ state, boardRef, targetRef, activeSection, revealIndex }) {
    const constrained = useMobileVisualBudget();
    const reduceMotion = constrained || getPrefersReducedMotion();
    const [placement, setPlacement] = useState({
        boardWidth: 900,
        boardHeight: 540,
        teacherWidth: 224,
        left: 690,
        top: 124,
        startX: 745,
        startY: 261,
        endX: 548,
        endY: 230,
    });
    const rafRef = useRef(0);
    const semanticTargetOffset = (
        [...(activeSection?.key || 'explain')]
            .reduce((total, character) => total + character.charCodeAt(0), 0)
        + revealIndex
    ) % 24;

    const measure = useCallback(() => {
        const boardRect = boardRef.current?.getBoundingClientRect?.();
        const targetRect = targetRef.current?.getBoundingClientRect?.();
        const boardWidth = Math.max(boardRect?.width || 900, 480);
        const boardHeight = Math.max(boardRect?.height || 540, 420);
        const teacherWidth = Math.min(244, Math.max(212, boardWidth * 0.2));
        const teacherHeight = teacherWidth * 1.04;
        const targetCenterY = targetRect?.height
            ? targetRect.top - (boardRect?.top || 0) + (targetRect.height / 2)
            : 158 + semanticTargetOffset;
        const top = clamp(targetCenterY - (teacherHeight * 0.52), 24, Math.max(24, boardHeight - teacherHeight - 26));
        const targetRight = targetRect?.width
            ? targetRect.right - (boardRect?.left || 0)
            : boardWidth * 0.64;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : boardWidth + 24;
        const rightLimit = viewportWidth - (boardRect?.left || 0) - teacherWidth - 12;
        const left = clamp(boardWidth - (teacherWidth * 0.94), targetRight + 76, rightLimit);
        const startX = left + (teacherWidth * 0.245);
        const startY = clamp(top + (teacherWidth * 0.61), 82, boardHeight - 72);
        const endX = targetRight + 10;
        const endY = clamp(targetCenterY, 78, boardHeight - 74);

        setPlacement((current) => {
            const next = { boardWidth, boardHeight, teacherWidth, left, top, startX, startY, endX, endY };
            const changed = Object.keys(next).some((key) => Math.abs((current[key] || 0) - next[key]) > 0.5);
            return changed ? next : current;
        });
    }, [boardRef, semanticTargetOffset, targetRef]);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const schedule = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(measure);
        };
        schedule();
        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, true);
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
        if (boardRef.current) observer?.observe(boardRef.current);
        if (targetRef.current) observer?.observe(targetRef.current);
        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, true);
            observer?.disconnect();
        };
    }, [activeSection?.key, boardRef, measure, revealIndex, targetRef]);

    const pointerPath = `M${placement.startX.toFixed(1)} ${placement.startY.toFixed(1)} L${placement.endX.toFixed(1)} ${placement.endY.toFixed(1)}`;

    return (
        <div
            className="pointer-events-none absolute inset-0 z-20 hidden overflow-visible lg:block"
            data-river-side="right"
            data-testid="desktop-board-teacher"
        >
            <motion.div
                className="absolute inset-0 z-20 overflow-visible"
                data-testid="desktop-board-teacher-unit"
                data-river-lockstep="true"
                animate={reduceMotion ? { y: 0 } : { y: [0, -1.2, 0] }}
                transition={reduceMotion ? { duration: 0 } : { duration: 4.8, repeat: Infinity, ease: PANEL_EASE }}
            >
                <svg
                    aria-hidden="true"
                    className="absolute inset-0 z-20 h-full w-full overflow-visible"
                    viewBox={`0 0 ${placement.boardWidth} ${placement.boardHeight}`}
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="river-pointer-wood" x1="0%" x2="100%" y1="0%" y2="0%">
                            <stop offset="0%" stopColor="#6f3f22" />
                            <stop offset="42%" stopColor="#b8783e" />
                            <stop offset="72%" stopColor="#d29a58" />
                            <stop offset="100%" stopColor="#7b4525" />
                        </linearGradient>
                    </defs>
                    <g data-testid="desktop-board-teacher-pointer">
                        <motion.path
                            data-testid="desktop-board-teacher-stick"
                            d={pointerPath}
                            fill="url(#river-pointer-wood)"
                            stroke="rgba(67,37,21,0.86)"
                            strokeWidth="0.55"
                            strokeLinecap="round"
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                        />
                        <circle
                            data-testid="desktop-board-teacher-stick-tip"
                            cx={placement.endX}
                            cy={placement.endY}
                            r="2.2"
                            fill="rgba(66,38,22,0.96)"
                        />
                        <circle
                            data-testid="desktop-board-teacher-stick-handle"
                            cx={placement.startX}
                            cy={placement.startY}
                            r="4.8"
                            fill="rgba(83,48,28,0.96)"
                            stroke="rgba(214,150,79,0.55)"
                            strokeWidth="0.8"
                        />
                    </g>
                </svg>

                <motion.div
                    className="absolute left-0 top-0 z-30"
                    data-testid="desktop-board-teacher-rig"
                    style={{ width: placement.teacherWidth }}
                    initial={reduceMotion ? false : { opacity: 0, x: placement.left, y: placement.top + 10 }}
                    animate={{ opacity: 1, x: placement.left, y: placement.top }}
                    transition={{ duration: reduceMotion ? 0 : 0.42, ease: PANEL_EASE }}
                >
                    <div
                        data-testid="desktop-board-teacher-perch"
                        className="absolute bottom-[10%] left-[8%] z-0 h-5 w-[84%] rounded-md border"
                        style={{
                            borderColor: 'rgba(222,185,106,0.28)',
                            background: 'linear-gradient(180deg,rgba(126,84,55,0.98),rgba(72,44,29,0.98))',
                            boxShadow: '0 12px 18px rgba(0,0,0,0.34)',
                        }}
                    />
                    <div className="relative z-10" style={{ transform: 'scaleX(-1)', transformOrigin: 'center' }}>
                        <RiverMascot
                            state={state}
                            compact
                            variant="board-teacher"
                            className="drop-shadow-[0_18px_28px_rgba(0,0,0,0.34)]"
                        />
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}

function MobileRiverStrip({ state, caption, roleLabel, stageLabel }) {
    return (
        <div
            data-testid="mobile-river-strip"
            className="sticky top-3 z-30 mb-5 rounded-[1.35rem] border px-3 py-3 lg:hidden"
            style={{
                borderColor: 'rgba(255,255,255,0.16)',
                background: 'linear-gradient(180deg,rgba(11,24,20,0.96),rgba(11,24,20,0.9))',
                boxShadow: '0 14px 32px rgba(0,0,0,0.28)',
                backdropFilter: 'blur(16px)',
            }}
        >
            <div className="flex items-center gap-3">
                <div className="w-[82px] shrink-0">
                    <RiverMascot state={state} compact className="rounded-[1.15rem] border-white/10 p-2" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: '#deb96a' }}>River</p>
                        <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-claude-secondary/70">{roleLabel}</span>
                    </div>
                    <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.14em] text-claude-secondary/70">{stageLabel}</p>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-5" style={{ color: '#efe4d1' }}>{caption}</p>
                </div>
            </div>
        </div>
    );
}

function LectureSection({
    section,
    sectionIndex,
    isActive,
    currentCard,
    visibleBeats,
    explainRevealed,
    onActiveTarget,
    onSectionRef,
    expandedSteps,
    showFuzzyPrompt,
    fuzzyPeek,
    reduceMotion,
    onRevealNext,
    onGotIt,
    onFuzzy,
    onToggleStep,
    onToggleAllSteps,
}) {
    const animation = reduceMotion ? { duration: 0 } : { duration: 0.38, ease: PANEL_EASE };
    const isSectionTarget = isActive && section.type !== 'explain';

    return (
        <motion.div
            ref={(node) => {
                onSectionRef(section.key, node);
                if (isSectionTarget) onActiveTarget(node);
            }}
            data-current-teach-target={isSectionTarget ? 'true' : undefined}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={animation}
        >
            <div className="mb-3 flex items-center gap-3">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] sm:text-[10px]" style={{ color: 'rgba(222,185,106,0.55)' }}>
                    {section.label}
                </span>
                <div className="h-px flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            </div>

            {section.type === 'explain' ? (
                <div className="space-y-3">
                    {visibleBeats.map((beat, index) => {
                        const isCurrent = isActive && index === explainRevealed - 1;
                        const shared = {
                            ref: (node) => { if (isCurrent) onActiveTarget(node); },
                            'data-current-teach-target': isCurrent ? 'true' : undefined,
                        };
                        const beatKey = beat.id || `${beat.kind}-${index}`;
                        if (beat.kind === 'block') {
                            return <div key={beatKey} {...shared}><SubjectRenderer content={beat.raw} /></div>;
                        }
                        if (beat.kind === 'predict') {
                            return (
                                <div key={beatKey} {...shared}>
                                    <PredictBeat prompt={beat.prompt} answer={beat.answer} isCurrent={isCurrent} onReveal={onRevealNext} />
                                </div>
                            );
                        }
                        return (
                            <motion.p
                                key={beatKey}
                                {...shared}
                                className="max-w-[72ch] text-[15px] leading-[1.8] transition-[color,opacity] duration-500 sm:text-base"
                                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={animation}
                                style={{ color: isCurrent ? '#e8dcc8' : 'color-mix(in oklab, #d4ccb8 55%, transparent)' }}
                            >
                                <SubjectRenderer content={beat.text} inline />
                            </motion.p>
                        );
                    })}

                    {showFuzzyPrompt && !fuzzyPeek ? (
                        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-dashed border-amber-200/15 pt-4">
                            <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: 'rgba(222,185,106,0.55)' }}>Does this click?</span>
                            <button type="button" onClick={onGotIt} className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3.5 py-1.5 text-xs font-medium" style={{ color: '#deb96a' }}>Got it</button>
                            <button type="button" onClick={onFuzzy} className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium" style={{ color: 'rgba(212,204,184,0.7)' }}>Still fuzzy</button>
                        </div>
                    ) : null}

                    {fuzzyPeek && currentCard.teaching.intuition ? (
                        <div className="mt-4 rounded-xl border border-amber-200/15 bg-amber-200/[0.06] px-5 py-4">
                            <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: 'rgba(222,185,106,0.6)' }}>Another way to see it</p>
                            <p className="max-w-[68ch] text-[15px] italic leading-[1.8] sm:text-base" style={{ color: '#e8dcc8' }}>
                                <SubjectRenderer content={currentCard.teaching.intuition} inline />
                            </p>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {section.type === 'intuition' ? (
                <div className="rounded-xl border border-amber-200/10 bg-amber-200/[0.06] px-5 py-4">
                    <p className="max-w-[68ch] text-[15px] italic leading-[1.8] sm:text-base" style={{ color: '#d4ccb8' }}>
                        <SubjectRenderer content={currentCard.teaching.intuition} inline />
                    </p>
                </div>
            ) : null}

            {section.type === 'worked_example' && section.data ? (
                <div data-testid="inline-worked-example" className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                    {section.data.problem ? (
                        <div className="border-b border-white/[0.06] px-5 py-4">
                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.55)' }}>Example</p>
                            <p className="mt-2 text-[15px] font-medium leading-[1.7] sm:text-base" style={{ color: '#e8dcc8' }}>
                                <SubjectRenderer content={section.data.problem} inline />
                            </p>
                        </div>
                    ) : null}
                    {section.data.steps?.length > 1 ? (
                        <div className="flex justify-end px-5 pb-1 pt-2.5">
                            <button type="button" onClick={() => onToggleAllSteps(sectionIndex, section.data.steps)} className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: 'rgba(222,185,106,0.48)' }}>
                                {section.data.steps.every((_, stepIndex) => expandedSteps[`${sectionIndex}-${stepIndex}`]) ? 'Hide step details' : 'Show step details'}
                            </button>
                        </div>
                    ) : null}
                    <div className="divide-y divide-white/[0.04]">
                        {(section.data.steps || []).map((step, stepIndex) => {
                            const stepKey = `${sectionIndex}-${stepIndex}`;
                            const expanded = Boolean(expandedSteps[stepKey]);
                            const math = hasMathSyntax(step.step);
                            return (
                                <div key={stepKey}>
                                    <button type="button" onClick={() => onToggleStep(sectionIndex, stepIndex)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-white/[0.02]">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200/15 text-[10px] font-mono" style={{ color: 'rgba(222,185,106,0.8)' }}>{stepIndex + 1}</span>
                                        <span className={math ? 'flex-1 rounded-lg border border-white/[0.06] bg-white/[0.035] px-3 py-2' : 'flex-1 text-sm leading-6'} style={{ color: math ? '#e8dcc8' : '#d4ccb8' }}>
                                            {math ? <span className="mb-1 block text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.45)' }}>Equation</span> : null}
                                            <SubjectRenderer content={step.step} inline />
                                        </span>
                                        <ChevronLeft className="mt-0.5 h-4 w-4 shrink-0 transition-transform" style={{ color: 'rgba(255,255,255,0.25)', transform: expanded ? 'rotate(-90deg)' : 'rotate(0)' }} />
                                    </button>
                                    {expanded && step.detail ? (
                                        <div className="px-5 pb-3 pl-13">
                                            {math ? <p className="mb-1 pl-8 text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.42)' }}>Reasoning</p> : null}
                                            <p className="pl-8 text-sm leading-6" style={{ color: 'rgba(212,204,184,0.7)' }}><SubjectRenderer content={step.detail} inline /></p>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                    {section.data.result || section.data.takeaway ? (
                        <div className="border-t border-white/[0.06] bg-amber-200/[0.04] px-5 py-4">
                            {section.data.result ? <p className="text-sm font-medium leading-6" style={{ color: '#e8dcc8' }}><SubjectRenderer content={section.data.result} inline /></p> : null}
                            {section.data.takeaway ? <p className="mt-1 text-sm italic leading-6" style={{ color: 'rgba(222,185,106,0.6)' }}>{section.data.takeaway}</p> : null}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {section.type === 'common_mistakes' ? (
                <div className="space-y-2.5">
                    {currentCard.teaching.common_mistakes.map((mistake, index) => (
                        <div key={`${mistake}-${index}`} className="flex items-start gap-3 rounded-xl border border-[#d59678]/15 bg-[#d59678]/[0.08] px-4 py-3">
                            <span className="mt-0.5 shrink-0 text-sm text-[#d59678]">&times;</span>
                            <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}><SubjectRenderer content={mistake} inline /></p>
                        </div>
                    ))}
                </div>
            ) : null}

            {section.type === 'legacy_steps' ? (
                <div className="space-y-2.5">
                    {currentCard.teaching.steps.map((step, index) => (
                        <div key={`${step}-${index}`} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/15 px-4 py-3">
                            <span className="mt-0.5 shrink-0 text-sm font-mono" style={{ color: 'rgba(222,185,106,0.6)' }}>{index + 1}.</span>
                            <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}><SubjectRenderer content={step} inline /></p>
                        </div>
                    ))}
                </div>
            ) : null}

            {section.type === 'legacy_why' ? (
                <div>
                    <p className="text-sm leading-7" style={{ color: 'rgba(212,204,184,0.75)' }}><SubjectRenderer content={currentCard.teaching.why_it_matters} /></p>
                    {currentCard.teaching.example ? (
                        <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 px-4 py-3">
                            <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.45)' }}>Example</p>
                            <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}><SubjectRenderer content={currentCard.teaching.example} inline /></p>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </motion.div>
    );
}

function TutorDock({ chat, progress, actions }) {
    const [expanded, setExpanded] = useState(false);
    const hasHistory = chat.history.length > 0;
    const latestReply = [...chat.history].reverse().find((message) => message.role === 'assistant');
    const capped = chat.turnCount >= chat.softCap;
    const nextLabel = progress.onExplainSection && progress.explainRevealed < progress.explainTotal
        ? `Go on \u2192  (${progress.explainRevealed}/${progress.explainTotal})`
        : progress.activeSectionIndex < progress.sections.length - 1
            ? `Continue \u2192 ${progress.sections[progress.activeSectionIndex + 1]?.label}`
            : 'I\u2019m ready to answer';

    return (
        <div
            data-testid="tutor-lecture-dock"
            className="sticky bottom-3 z-40 mt-8 rounded-[1.35rem] border p-3 sm:p-4"
            style={{
                borderColor: 'rgba(255,255,255,0.16)',
                background: 'linear-gradient(180deg,rgba(18,39,30,0.97),rgba(12,28,22,0.98))',
                boxShadow: '0 18px 44px rgba(0,0,0,0.38)',
                backdropFilter: 'blur(18px)',
            }}
        >
            {hasHistory || chat.loading ? (
                <div className="mb-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>River reply</p>
                        {hasHistory ? <button type="button" onClick={() => setExpanded((value) => !value)} className="text-[10px]" style={{ color: 'rgba(228,219,201,0.6)' }}>{expanded ? 'Hide conversation' : 'Show conversation'}</button> : null}
                    </div>
                    {chat.loading ? <p className="mt-1.5 text-sm" style={{ color: 'rgba(228,219,201,0.55)' }}>River is thinking…</p> : null}
                    {!chat.loading && !expanded && latestReply ? <div className="mt-1.5 line-clamp-2 text-sm leading-6" style={{ color: '#efe4d1' }}><SubjectRenderer content={latestReply.content} /></div> : null}
                    {expanded ? (
                        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                            {chat.history.map((message, index) => (
                                <div key={`${message.role}-${index}`} className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm leading-6" style={{ color: message.role === 'assistant' ? '#efe4d1' : 'rgba(239,228,209,0.65)' }}>
                                    {message.role === 'assistant' ? <SubjectRenderer content={message.content} /> : message.content}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="flex gap-2 overflow-x-auto pb-2">
                {chat.assistOptions.slice(0, 4).map((option) => (
                    <button key={option.id} type="button" disabled={chat.loading || capped} onClick={() => actions.onSelectAssist(option)} className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs disabled:opacity-40" style={{ color: 'rgba(228,219,201,0.9)' }}>{option.label}</button>
                ))}
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                {capped ? (
                    <p className="min-w-0 flex-1 text-xs" style={{ color: 'rgba(222,185,106,0.65)' }}>Ready to try answering the question?</p>
                ) : (
                    <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); if (chat.input.trim()) actions.onSendChat(chat.input.trim()); }}>
                        <input aria-label="Ask River" type="text" value={chat.input} onChange={(event) => actions.onChatInput(event.target.value)} placeholder="Ask River anything…" disabled={chat.loading} className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/10 px-4 py-2 text-sm outline-none disabled:opacity-40" style={{ color: '#efe4d1' }} />
                        <button type="submit" disabled={chat.loading || !chat.input.trim()} className="rounded-full border border-amber-200/30 px-3 py-2 text-sm disabled:opacity-40" style={{ color: '#deb96a' }}>Ask</button>
                    </form>
                )}
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={actions.onContinue} className="min-h-[42px] rounded-xl px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'rgba(222,185,106,0.9)', color: '#1a3028' }}>{nextLabel}</button>
                    {progress.activeSectionIndex < progress.sections.length - 1 ? <button type="button" onClick={actions.onSkip} className="min-h-[40px] rounded-xl px-3 py-2 text-xs" style={{ color: 'rgba(212,204,184,0.58)' }}>Skip to question</button> : null}
                    <button type="button" onClick={actions.onSave} className="min-h-[40px] rounded-xl px-3 py-2 text-xs" style={{ color: 'rgba(212,204,184,0.46)' }}>Save and leave</button>
                </div>
            </div>
        </div>
    );
}

export default function TutorLecture({ content, progress, river, chat, actions }) {
    const constrained = useMobileVisualBudget();
    const isNarrowScreen = useMediaQuery('(max-width: 1023px)');
    const reduceMotion = constrained || getPrefersReducedMotion();
    const activeSection = progress.sections[progress.activeSectionIndex] || null;
    const sectionRefs = useRef({});
    const boardFrameRef = useRef(null);
    const activeTargetRef = useRef(null);
    const scrollRafRef = useRef(0);
    const hasMountedRef = useRef(false);

    const registerSectionRef = useCallback((key, node) => {
        sectionRefs.current[key] = node;
    }, []);

    const registerActiveTarget = useCallback((node) => {
        if (node) activeTargetRef.current = node;
    }, []);

    useLayoutEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return undefined;
        }

        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = requestAnimationFrame(() => {
            activeTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return () => cancelAnimationFrame(scrollRafRef.current);
    }, [progress.activeSectionIndex, progress.explainRevealed]);

    if (!content.currentCard?.teaching) {
        return (
            <section data-testid="river-session-teach" className="guide-perf-section mt-8">
                <div data-testid="tutor-teaching-unavailable" className="rounded-[1.25rem] border border-white/15 bg-[#243f33] px-6 py-8 text-center">
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.7)' }}>Teaching unavailable</p>
                    <h2 className="mt-3 text-2xl font-serif italic" style={{ color: '#efe4d1' }}>River can’t open this lesson yet.</h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6" style={{ color: 'rgba(228,219,201,0.76)' }}>This tutor card is missing its teaching content. Save your place and regenerate the session.</p>
                    <button type="button" onClick={actions.onSave} className="mt-5 rounded-xl border border-white/15 px-4 py-2 text-sm" style={{ color: '#efe4d1' }}>Save and leave</button>
                </div>
            </section>
        );
    }

    return (
        <motion.section
            data-testid="river-session-teach"
            className="guide-perf-section mt-8"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.38, ease: PANEL_EASE }}
        >
            <div className="relative overflow-visible" data-testid="river-board-stage">
                {!isNarrowScreen ? (
                    <DesktopRiverTracker
                        state={river.state}
                        boardRef={boardFrameRef}
                        targetRef={activeTargetRef}
                        activeSection={activeSection}
                        revealIndex={progress.explainRevealed}
                    />
                ) : null}

                <div ref={boardFrameRef} data-testid="river-board-frame" className="relative z-10 overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]" style={BOARD_FRAME_STYLE}>
                    <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={BOARD_GRAIN_STYLE} />
                    <div data-testid="river-board-surface" className="relative rounded-[0.5rem] px-5 py-6 sm:rounded-[0.75rem] sm:px-8 sm:py-8" style={BOARD_SURFACE_STYLE}>
                        <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.04]" style={BOARD_DUST_STYLE} />
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]" style={BOARD_TRAY_STYLE} />

                        <div data-testid="river-lecture-document" className="relative z-10 pb-40" data-active-section={activeSection?.key || 'explain'}>
                            {isNarrowScreen ? (
                                <MobileRiverStrip state={river.state} caption={river.caption} roleLabel={content.roleLabel} stageLabel={activeSection?.label || 'Explanation'} />
                            ) : null}

                            <div className="mb-6 pt-1 sm:mb-8" data-testid="river-board-header">
                                <p className="text-[10px] font-mono uppercase tracking-[0.2em] sm:text-[11px]" style={{ color: 'rgba(222,185,106,0.7)' }}>
                                    {content.roleLabel} &middot; {progress.activeSectionIndex + 1}/{Math.max(progress.sections.length, 1)}
                                </p>
                                <h2 className="mt-2 text-2xl font-serif italic font-bold leading-tight sm:text-3xl lg:text-4xl" style={{ color: '#e8dcc8' }}>
                                    <SubjectRenderer content={content.currentConcept?.title || content.currentCard.prompt} />
                                </h2>
                                {content.currentCard.teaching.learning_objective ? (
                                    <p className="mt-3 max-w-[68ch] text-sm leading-6 lg:max-w-[52ch]" style={{ color: 'rgba(232,220,200,0.74)' }}>
                                        <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Goal</span>
                                        <span className="ml-2"><SubjectRenderer content={content.currentCard.teaching.learning_objective} inline /></span>
                                    </p>
                                ) : null}
                                <div className="mt-3 flex items-center gap-1.5">
                                    {progress.sections.map((section, index) => (
                                        <div key={section.key} className="transition-all duration-300" style={{ width: index <= progress.activeSectionIndex ? 20 : 6, height: 4, borderRadius: 2, backgroundColor: index <= progress.activeSectionIndex ? 'rgba(222,185,106,0.65)' : 'rgba(255,255,255,0.12)' }} />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6 lg:pr-[15rem] 2xl:pr-[17rem]" data-testid="river-board-content">
                                {progress.sections.slice(0, progress.activeSectionIndex + 1).map((section, sectionIndex) => (
                                    <LectureSection
                                        key={section.key}
                                        section={section}
                                        sectionIndex={sectionIndex}
                                        isActive={sectionIndex === progress.activeSectionIndex}
                                        currentCard={content.currentCard}
                                        visibleBeats={progress.visibleBeats}
                                        explainRevealed={progress.explainRevealed}
                                        onActiveTarget={registerActiveTarget}
                                        onSectionRef={registerSectionRef}
                                        expandedSteps={progress.expandedSteps}
                                        showFuzzyPrompt={progress.showFuzzyPrompt}
                                        fuzzyPeek={progress.fuzzyPeek}
                                        reduceMotion={reduceMotion}
                                        onRevealNext={actions.onRevealNext}
                                        onGotIt={actions.onGotIt}
                                        onFuzzy={actions.onFuzzy}
                                        onToggleStep={actions.onToggleStep}
                                        onToggleAllSteps={actions.onToggleAllSteps}
                                    />
                                ))}
                            </div>

                            <TutorDock chat={chat} progress={progress} actions={actions} />
                        </div>
                    </div>
                </div>
            </div>
        </motion.section>
    );
}
