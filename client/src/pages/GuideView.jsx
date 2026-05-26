import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { useMobileVisualBudget } from '../hooks/useMobileVisualBudget.js';
import SubjectRenderer from '../components/ui/SubjectRenderer';
import RiverMascot from '../components/study/RiverMascot.jsx';
import { UIContext } from '../context/UIContext.jsx';
import {
    ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION,
    evaluateTutorCardResponse,
    getGuideMasterySnapshot,
    normalizeGuideData,
    normalizeGuideStudyState,
    STUDY_SESSION_STATUSES,
} from '../utils/studyGuides.js';

const PANEL_EASE = [0.22, 1, 0.36, 1];

// Static style objects hoisted at module level — never recreated on re-render
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
const UNSUPPORTED_FRAME_STYLE = {
    padding: 'clamp(6px, 1vw, 12px)',
    background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
    boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
};
const UNSUPPORTED_GRAIN_STYLE = {
    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
};
const UNSUPPORTED_SURFACE_STYLE = {
    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
};
const UNSUPPORTED_DUST_STYLE = {
    backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
};
const UNSUPPORTED_TRAY_STYLE = {
    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
};

// Explain chunking: keep paragraphs whole when short; otherwise reveal one digestible board beat at a time.
const CHUNK_MIN_CHARS = 150;
const CHUNK_TARGET_CHARS = 240;
const CHUNK_MAX_CHARS = 320;

const chunkExplain = (raw) => {
    if (!raw || typeof raw !== 'string') return [];
    const paragraphs = raw.split('\n\n').map((p) => p.trim()).filter(Boolean);
    const out = [];
    for (const para of paragraphs) {
        if (para.length <= CHUNK_MAX_CHARS) {
            out.push(para);
            continue;
        }
        const sentences = (para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [para])
            .map((s) => s.trim())
            .filter(Boolean);
        let buf = '';
        for (const s of sentences) {
            if (!buf) {
                buf = s;
                continue;
            }
            if ((`${buf} ${s}`).length > CHUNK_TARGET_CHARS && buf.length >= CHUNK_MIN_CHARS) {
                out.push(buf);
                buf = s;
            } else {
                buf = `${buf} ${s}`;
            }
        }
        if (buf) out.push(buf);
    }
    return out;
};

const hasMathSyntax = (value) => (
    typeof value === 'string'
    && /(\$\$[\s\S]+?\$\$|(^|[^$])\$(?!\$)[^$\n]+?\$(?!\$))/u.test(value)
);

// Mirrors POSES.accent values from RiverMascot — drives surface tinting on feedback
const RIVER_POSE_ACCENT = {
    idle: '#8fb27c',
    teach: '#79ad75',
    point: '#c5b56d',
    encourage: '#dcb679',
    thinking: '#8ea9a0',
    'gentle-correct': '#d59678',
    celebrate: '#e7c86f',
};

const EMPTY_STATE = {
    current_card_id: null,
    session_phase: null,
    session_status: STUDY_SESSION_STATUSES.NOT_STARTED,
    active_stage: 'intro',
    teach_section_index: 0,
    explain_revealed_count: 1,
    card_states: {},
    concept_mastery: {},
    last_interaction_at: null,
    paused_at: null,
    completed_at: null,
    last_reviewed_at: null,
};

const XP_PER_LEVEL = 120;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getConceptStatus = (score) => {
    if (score >= 80) return 'mastered';
    if (score >= 65) return 'secure';
    if (score >= 45) return 'developing';
    if (score > 0) return 'struggling';
    return 'unseen';
};

const getScoreDelta = (outcome, weight = 1) => {
    if (outcome === 'correct') return 32 * weight;
    if (outcome === 'partial') return 18 * weight;
    if (outcome === 'misconception') return -10;
    if (outcome === 'incorrect') return -6;
    if (outcome === 'empty') return -4;
    return 0;
};

const getResumeStage = (studyState) => {
    if (studyState?.completed_at || studyState?.session_status === STUDY_SESSION_STATUSES.COMPLETE) {
        return 'complete';
    }

    if (![STUDY_SESSION_STATUSES.ACTIVE, STUDY_SESSION_STATUSES.PAUSED].includes(studyState?.session_status)) {
        return 'intro';
    }

    if (studyState.active_stage === 'feedback') return 'check';
    if (['teach', 'check'].includes(studyState.active_stage)) return studyState.active_stage;
    return 'teach';
};

const getPersistableStage = (stage) => (stage === 'feedback' ? 'check' : stage);

const getXpProgress = (stats = {}) => {
    const xpTotal = Number(stats?.xpTotal) || 0;
    const level = Math.max(1, Number(stats?.level) || Math.floor(xpTotal / XP_PER_LEVEL) + 1);
    const currentLevelXp = xpTotal % XP_PER_LEVEL;
    return {
        xpTotal,
        level,
        remaining: XP_PER_LEVEL - currentLevelXp,
        percent: Math.max(0, Math.min(100, Math.round((currentLevelXp / XP_PER_LEVEL) * 100))),
    };
};

const getNextCardId = (guideData, currentCardId, transitionCardId, cardStates) => {
    if (transitionCardId && !['retry', 'hint'].includes(transitionCardId)) {
        return transitionCardId;
    }

    return guideData.cards.find((card) => (
        card.id !== currentCardId && !cardStates[card.id]?.completed
    ))?.id || null;
};

const buildDefaultCardState = (cardState = {}) => ({
    attempts: cardState.attempts || 0,
    hints_used: cardState.hints_used || 0,
    status: cardState.status || 'unseen',
    last_outcome: cardState.last_outcome || null,
    completed: Boolean(cardState.completed),
    assist_count: cardState.assist_count || 0,
    last_assist_at: cardState.last_assist_at || null,
    revealed_answer: Boolean(cardState.revealed_answer),
    intuition_previewed: Boolean(cardState.intuition_previewed),
    skipped: Boolean(cardState.skipped),
});

const getIntroCaption = (guideData) => (
    guideData?.lecture?.opening
    || guideData?.river?.dialogue_variants?.opening?.[0]
    || 'River is ready to teach this lesson one clean idea at a time.'
);

const getTeachCaption = (currentCard) => (
    currentCard?.teaching?.explain
    || currentCard?.river?.intro
    || 'River is setting the frame before the recall check.'
);

const getCheckCaption = (currentCard) => (
    currentCard?.presentation?.emphasis_target
    ? `Hold onto this anchor: ${currentCard.presentation.emphasis_target}`
    : 'Answer from memory first, then let River tighten the frame.'
);

const getFeedbackState = (outcome) => {
    if (outcome === 'correct' || outcome === 'partial') return 'encourage';
    if (outcome === 'revealed') return 'point';
    return 'gentle-correct';
};

const getFeedbackCaption = (currentCard, result) => {
    if (!result) return getTeachCaption(currentCard);
    if (result.outcome === 'correct') {
        return currentCard?.river?.success || result.feedback;
    }
    if (result.outcome === 'partial') {
        return 'You\'re close! Let me help you get the rest.';
    }
    if (result.outcome === 'revealed') {
        return 'River has revealed the clean answer. Take it in, then decide whether to retry or move on.';
    }
    if (result.followUpQuestion) {
        return 'Don\'t worry, let\'s try again.';
    }
    return currentCard?.river?.struggle || result.feedback;
};

const getCompleteCaption = (guideData, completionPayload) => {
    if (completionPayload?.sessionOutcome === 'stopped_early') {
        return 'Your place is saved. River can pick this lecture back up exactly where you stopped.';
    }

    return guideData?.lecture?.closing
        || guideData?.completion?.confidence_close
        || 'That was a clean pass. Come back tomorrow and retrieve it again.';
};

const getTeachSectionPresentation = (section, currentCard) => {
    const captions = {
        explain: 'River is teaching.',
        intuition: 'Here is the mental model.',
        worked_example: 'Watch how this plays out step by step.',
        common_mistakes: 'Before you try, watch out for these.',
        legacy_steps: 'Let me break this down.',
        legacy_why: currentCard?.teaching?.why_it_matters?.slice(0, 100) || 'Here is why this matters.',
    };
    const poses = {
        explain: 'teach',
        intuition: 'thinking',
        worked_example: 'point',
        common_mistakes: 'gentle-correct',
        legacy_steps: 'teach',
        legacy_why: 'thinking',
    };

    return {
        caption: captions[section?.type] || 'River is teaching.',
        state: poses[section?.type] || 'teach',
    };
};

/**
 * Animates a number from 0 to `target` over `duration` ms with ease-out cubic.
 * Immediately returns `target` when prefers-reduced-motion is active.
 */
function useCountUp(target, duration = 600) {
    const [value, setValue] = useState(0);
    const prefersReduced = useRef(
        typeof window !== 'undefined'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    useEffect(() => {
        if (!target) { setValue(0); return; }
        if (prefersReduced.current) { setValue(target); return; }
        const start = performance.now();
        let raf;
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return value;
}

function MobileTeacherStrip({
    state,
    caption,
    roleLabel,
    stageLabel,
    accent = 'rgba(222,185,106,0.76)',
}) {
    return (
        <div
            className="rounded-[1.55rem] border px-3 py-3"
            style={{
                borderColor: 'rgba(255,255,255,0.16)',
                background: 'linear-gradient(180deg,rgba(11,24,20,0.34),rgba(11,24,20,0.18))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
        >
            <div className="flex items-center gap-3">
                <div className="w-[104px] shrink-0">
                    <RiverMascot
                        state={state}
                        compact
                        className="rounded-[1.45rem] border-white/10 p-2.5 pt-3"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: accent }}>
                            River
                        </p>
                        {roleLabel ? (
                            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary/70">
                                {roleLabel}
                            </span>
                        ) : null}
                    </div>
                    {stageLabel ? (
                        <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary/70">
                            {stageLabel}
                        </p>
                    ) : null}
                    <p className="mt-2 text-sm leading-6" style={{ color: '#efe4d1' }}>
                        {caption}
                    </p>
                </div>
            </div>
        </div>
    );
}

const getPrefersReducedMotion = () => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

function DesktopBoardTeacher({
    state,
    boardRef,
    targetRef,
    activeSection,
    sectionIndex,
    revealIndex,
}) {
    const visualBudgetConstrained = useMobileVisualBudget();
    const reduceMotion = visualBudgetConstrained || getPrefersReducedMotion();
    const side = 'right';
    const [placement, setPlacement] = useState(() => ({
        boardWidth: 900,
        boardHeight: 540,
        teacherWidth: 224,
        left: 690,
        top: 124,
        path: 'M745 261 L548 230',
        stickStartX: 745,
        stickStartY: 261,
        pointerEndX: 548,
        pointerEndY: 230,
        perchLeft: 36,
        perchTop: 184,
        perchWidth: 184,
    }));

    useEffect(() => {
        let raf = 0;

        const measure = () => {
            const board = boardRef.current;
            const target = targetRef.current;
            const boardRect = board?.getBoundingClientRect?.();
            const targetRect = target?.getBoundingClientRect?.();
            const boardWidth = Math.max(boardRect?.width || 900, 480);
            const boardHeight = Math.max(boardRect?.height || 540, 420);
            const teacherWidth = Math.min(244, Math.max(212, boardWidth * 0.2));
            const teacherHeight = teacherWidth * 1.04;
            const targetCenterY = targetRect?.height
                ? targetRect.top - (boardRect?.top || 0) + (targetRect.height / 2)
                : 170 + (sectionIndex * 92);
            const top = clamp(targetCenterY - (teacherHeight * 0.52), 24, Math.max(24, boardHeight - teacherHeight - 26));
            const targetLeft = targetRect?.width
                ? targetRect.left - (boardRect?.left || 0)
                : boardWidth * 0.38;
            const targetRight = targetRect?.width
                ? targetRect.right - (boardRect?.left || 0)
                : boardWidth * 0.64;
            const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : (boardRect?.right || boardWidth) + 24;
            const boardLeft = boardRect?.left || 0;
            const leftViewportLimit = 72 - boardLeft;
            const rightViewportLimit = viewportWidth - boardLeft - teacherWidth - 12;
            const handOffsetX = teacherWidth * 0.245;
            const handOffsetY = teacherWidth * 0.61;
            const minStickReach = clamp(teacherWidth * 0.48, 98, 124);
            const preferredLeft = side === 'left'
                ? -teacherWidth * 0.26
                : boardWidth - teacherWidth * 0.94;
            const textSafeLeft = side === 'left'
                ? Math.min(-teacherWidth * 0.18, targetLeft - teacherWidth - 18)
                : targetRight + 20;
            const reachSafeLeft = targetRight + 10 + minStickReach - handOffsetX;
            const rightSafeLeft = Math.min(Math.max(textSafeLeft, reachSafeLeft), rightViewportLimit);
            const rightPreferredLeft = Math.min(Math.max(preferredLeft, rightSafeLeft), rightViewportLimit);
            const left = side === 'left'
                ? clamp(preferredLeft, leftViewportLimit, textSafeLeft)
                : clamp(rightPreferredLeft, rightSafeLeft, rightViewportLimit);
            const targetY = targetRect?.height ? targetCenterY : top + (teacherHeight * 0.42);
            const startX = side === 'left'
                ? left + (teacherWidth * 0.8)
                : left + handOffsetX;
            const startY = clamp(top + handOffsetY, 82, boardHeight - 72);
            const endX = side === 'left'
                ? Math.max(startX + 42, targetLeft - 8)
                : targetRight + 10;
            const endY = clamp(targetY, 78, boardHeight - 74);
            const path = `M${startX.toFixed(1)} ${startY.toFixed(1)} L${endX.toFixed(1)} ${endY.toFixed(1)}`;
            const edgeWithinRig = side === 'left' ? -left : boardWidth - left;
            const perchWidth = clamp(teacherWidth * 0.84, 168, 208);
            const perchLeft = side === 'left'
                ? edgeWithinRig - 34
                : edgeWithinRig - perchWidth + 34;
            const perchTop = teacherWidth * 0.82;

            setPlacement({
                boardWidth,
                boardHeight,
                teacherWidth,
                left,
                top,
                path,
                stickStartX: startX,
                stickStartY: startY,
                pointerEndX: endX,
                pointerEndY: endY,
                perchLeft,
                perchTop,
                perchWidth,
            });
        };

        const scheduleMeasure = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(measure);
        };

        scheduleMeasure();
        window.addEventListener('resize', scheduleMeasure);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', scheduleMeasure);
        };
    }, [activeSection?.key, activeSection?.type, boardRef, revealIndex, sectionIndex, side, targetRef]);

    const stickGeometry = useMemo(() => {
        const startX = placement.stickStartX;
        const startY = placement.stickStartY;
        const endX = placement.pointerEndX;
        const endY = placement.pointerEndY;
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const startRadius = 3.6;
        const endRadius = 2.2;
        const handleRadius = 4.8;
        const bandDistance = 10;
        const bodyPath = [
            `M${(startX + px * startRadius).toFixed(1)} ${(startY + py * startRadius).toFixed(1)}`,
            `L${(endX + px * endRadius).toFixed(1)} ${(endY + py * endRadius).toFixed(1)}`,
            `Q${endX.toFixed(1)} ${endY.toFixed(1)} ${(endX - px * endRadius).toFixed(1)} ${(endY - py * endRadius).toFixed(1)}`,
            `L${(startX - px * startRadius).toFixed(1)} ${(startY - py * startRadius).toFixed(1)}`,
            `Q${startX.toFixed(1)} ${startY.toFixed(1)} ${(startX + px * startRadius).toFixed(1)} ${(startY + py * startRadius).toFixed(1)}Z`,
        ].join(' ');
        const grainPath = [
            `M${(startX + px * 2.1 + ux * 4).toFixed(1)} ${(startY + py * 2.1 + uy * 4).toFixed(1)}`,
            `L${(endX + px * 1.1 - ux * 7).toFixed(1)} ${(endY + py * 1.1 - uy * 7).toFixed(1)}`,
            `M${(startX - px * 1.8 + ux * 7).toFixed(1)} ${(startY - py * 1.8 + uy * 7).toFixed(1)}`,
            `L${(endX - px * 0.8 - ux * 12).toFixed(1)} ${(endY - py * 0.8 - uy * 12).toFixed(1)}`,
        ].join(' ');
        const tipBandPath = [
            `M${(endX - ux * bandDistance + px * endRadius).toFixed(1)} ${(endY - uy * bandDistance + py * endRadius).toFixed(1)}`,
            `L${(endX + px * endRadius).toFixed(1)} ${(endY + py * endRadius).toFixed(1)}`,
            `Q${endX.toFixed(1)} ${endY.toFixed(1)} ${(endX - px * endRadius).toFixed(1)} ${(endY - py * endRadius).toFixed(1)}`,
            `L${(endX - ux * bandDistance - px * endRadius).toFixed(1)} ${(endY - uy * bandDistance - py * endRadius).toFixed(1)}Z`,
        ].join(' ');
        return {
            bodyPath,
            grainPath,
            tipBandPath,
            handleRadius,
        };
    }, [placement.pointerEndX, placement.pointerEndY, placement.stickStartX, placement.stickStartY]);

    return (
        <div
            className="pointer-events-none absolute inset-0 z-20 hidden overflow-visible lg:block"
            data-river-side={side}
            data-testid="desktop-board-teacher"
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
                        key={`stick-shadow-${activeSection?.key || 'section'}-${revealIndex}-${side}`}
                        d={stickGeometry.bodyPath}
                        fill="rgba(27,16,10,0.38)"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.3, ease: PANEL_EASE }}
                        style={{
                            transform: 'translate3d(1.2px, 1.8px, 0)',
                        }}
                    />
                    <motion.path
                        key={`stick-${activeSection?.key || 'section'}-${revealIndex}-${side}`}
                        data-testid="desktop-board-teacher-stick"
                        d={stickGeometry.bodyPath}
                        fill="url(#river-pointer-wood)"
                        stroke="rgba(67,37,21,0.86)"
                        strokeWidth="0.55"
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.34, ease: PANEL_EASE }}
                        style={{
                            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.26))',
                            transformBox: 'fill-box',
                            transformOrigin: side === 'left' ? 'left center' : 'right center',
                        }}
                    />
                    <motion.path
                        key={`stick-highlight-${activeSection?.key || 'section'}-${revealIndex}-${side}`}
                        d={stickGeometry.grainPath}
                        fill="none"
                        stroke="rgba(83,42,18,0.36)"
                        strokeWidth="0.65"
                        strokeLinecap="round"
                        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.82 }}
                        transition={{ duration: reduceMotion ? 0 : 0.5, ease: PANEL_EASE }}
                    />
                    <motion.path
                        key={`tip-${activeSection?.key || 'section'}-${revealIndex}-${side}`}
                        data-testid="desktop-board-teacher-stick-tip"
                        d={stickGeometry.tipBandPath}
                        fill="rgba(66,38,22,0.96)"
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.32, ease: PANEL_EASE, delay: 0.05 }}
                        style={{
                            transformBox: 'fill-box',
                            transformOrigin: 'center',
                        }}
                    />
                    <motion.circle
                        key={`handle-${activeSection?.key || 'section'}-${revealIndex}-${side}`}
                        data-testid="desktop-board-teacher-stick-handle"
                        cx={placement.stickStartX}
                        cy={placement.stickStartY}
                        r={stickGeometry.handleRadius}
                        fill="rgba(83,48,28,0.96)"
                        stroke="rgba(214,150,79,0.55)"
                        strokeWidth="0.8"
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.28, ease: PANEL_EASE }}
                        style={{
                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.32))',
                            transformBox: 'fill-box',
                            transformOrigin: 'center',
                        }}
                    />
                </g>
            </svg>

            <motion.div
                className="absolute left-0 top-0 z-30"
                data-testid="desktop-board-teacher-rig"
                style={{ width: placement.teacherWidth }}
                initial={reduceMotion ? false : { opacity: 0, x: placement.left, y: placement.top + 10 }}
                animate={{ opacity: 1, x: placement.left, y: placement.top }}
                transition={{ duration: reduceMotion ? 0 : 0.58, ease: PANEL_EASE }}
            >
                <div
                    data-testid="desktop-board-teacher-perch"
                    className="absolute z-0 h-[20px] overflow-visible rounded-[0.42rem] border"
                    style={{
                        width: placement.perchWidth,
                        transform: `translate3d(${placement.perchLeft}px, ${placement.perchTop}px, 0)`,
                        borderColor: 'rgba(222,185,106,0.28)',
                        background: 'linear-gradient(180deg,rgba(126,84,55,0.98),rgba(72,44,29,0.98))',
                        boxShadow: '0 12px 18px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,234,189,0.24), inset 0 -4px 7px rgba(0,0,0,0.28)',
                    }}
                >
                    <span
                        aria-hidden="true"
                        className="absolute left-[12%] top-[-12px] h-[20px] w-[72%] rounded-full"
                        style={{ background: 'radial-gradient(ellipse,rgba(0,0,0,0.34),transparent 72%)' }}
                    />
                    <span
                        aria-hidden="true"
                        className="absolute inset-x-3 top-[4px] h-px"
                        style={{ background: 'linear-gradient(90deg,transparent,rgba(255,235,190,0.34),transparent)' }}
                    />
                    <span
                        aria-hidden="true"
                        className="absolute bottom-[-5px] h-[7px] w-[26px] rounded-b-md"
                        style={{
                            [side === 'left' ? 'left' : 'right']: '18px',
                            background: 'linear-gradient(180deg,rgba(76,47,31,0.92),rgba(35,22,16,0.96))',
                        }}
                    />
                </div>

                <motion.div
                    className="relative z-10"
                    animate={reduceMotion
                        ? { x: 0, y: 0, rotate: 0, scale: 1 }
                        : { x: [0, 1.2, 0], y: [0, -1.2, 0], rotate: [0, -0.7, 0], scale: [1, 1.006, 1] }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 4.8, repeat: Infinity, ease: PANEL_EASE }}
                    style={{ transformOrigin: '50% 84%' }}
                >
                    <div
                        style={{
                            transform: side === 'right' ? 'scaleX(-1)' : undefined,
                            transformOrigin: 'center',
                        }}
                    >
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

function MobileSessionActionTray({ children }) {
    return (
        <div
            className="sticky z-20 mt-5 flex flex-wrap items-center gap-3 rounded-[1.4rem] border px-4 py-3 md:hidden"
            style={{
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.9rem)',
                borderColor: 'rgba(255,255,255,0.16)',
                background: 'linear-gradient(180deg,rgba(19,39,31,0.98),rgba(16,32,26,0.96))',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 12px 34px rgba(0,0,0,0.28)',
            }}
        >
            {children}
        </div>
    );
}

export default function GuideView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const toastRef = useRef(toast);
    const isMobileSession = useMobileVisualBudget();
    const { setStudyMode, clearStudyMode } = useContext(UIContext) || {};

    const [loading, setLoading] = useState(true);
    const [guide, setGuide] = useState(null);
    const [guideData, setGuideData] = useState(null);
    const [studyState, setStudyState] = useState(EMPTY_STATE);
    const [formatVersion, setFormatVersion] = useState(0);
    const [sessionStage, setSessionStage] = useState('intro');
    const [answer, setAnswer] = useState('');
    const [result, setResult] = useState(null);
    const [completionPayload, setCompletionPayload] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [riverState, setRiverState] = useState('idle');
    const [riverCaption, setRiverCaption] = useState('River is ready to teach.');
    const [activeAssistOption, setActiveAssistOption] = useState(null);
    const [refinedAnswer, setRefinedAnswer] = useState('');
    const [teachSection, setTeachSection] = useState(0);
    const [expandedSteps, setExpandedSteps] = useState({});
    const [explainRevealed, setExplainRevealed] = useState(1);
    const [fuzzyPeek, setFuzzyPeek] = useState(false);

    const sessionStartStateRef = useRef(null);
    const finalizingRef = useRef(false);
    const sectionRefs = useRef({});
    const boardFrameRef = useRef(null);
    const activeTeachTargetRef = useRef(null);
    const scrollRafRef = useRef(null);
    const hasSeenRevealHint = useRef(localStorage.getItem('riven_reveal_hint_seen') === '1');

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    const loadGuide = useCallback(async () => {
        setLoading(true);
        try {
            const nextGuide = await api.getStudyGuide(id);
            const normalizedGuideData = normalizeGuideData(nextGuide.guide_data);
            const normalizedStudyState = normalizedGuideData
                ? normalizeGuideStudyState(normalizedGuideData, nextGuide.study_state)
                : EMPTY_STATE;
            const nextFormatVersion = Number(nextGuide.format_version) || 0;
            const restoredStage = getResumeStage(normalizedStudyState);
            const restoredCard = normalizedGuideData?.cards.find(
                (card) => card.id === normalizedStudyState.current_card_id,
            ) || normalizedGuideData?.cards[0] || null;
            const shouldRestoreFuzzyPeek = Boolean(
                restoredStage === 'teach'
                && (normalizedStudyState.teach_section_index || 0) === 0
                && normalizedStudyState.card_states?.[restoredCard?.id]?.intuition_previewed
                && restoredCard?.teaching?.intuition,
            );

            setGuide(nextGuide);
            setGuideData(normalizedGuideData);
            setStudyState(normalizedStudyState);
            setFormatVersion(nextFormatVersion);
            setSessionStage(restoredStage);
            setAnswer('');
            setResult(null);
            setCompletionPayload(null);
            setActiveAssistOption(null);
            setRefinedAnswer('');
            setTeachSection(normalizedStudyState.teach_section_index || 0);
            setExpandedSteps({});
            setExplainRevealed(normalizedStudyState.explain_revealed_count || 1);
            setFuzzyPeek(shouldRestoreFuzzyPeek);
            setRiverState(restoredStage === 'complete'
                ? 'celebrate'
                : restoredStage === 'check'
                    ? 'thinking'
                    : restoredStage === 'teach'
                        ? (restoredCard?.presentation?.pose || 'teach')
                        : 'idle');
            setRiverCaption(restoredStage === 'complete'
                ? getCompleteCaption(normalizedGuideData, { sessionOutcome: 'complete' })
                : restoredStage === 'check'
                    ? getCheckCaption(restoredCard)
                    : restoredStage === 'teach'
                        ? getTeachCaption(restoredCard)
                        : (normalizedGuideData ? getIntroCaption(normalizedGuideData) : 'River is ready to teach.'));
            sessionStartStateRef.current = normalizedStudyState;
            finalizingRef.current = false;
        } catch {
            toastRef.current.error('Failed to load tutor session');
            navigate('/guides');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        loadGuide();
        api.warmupAiFunctions('study-session-complete');
    }, [loadGuide]);

    const unsupported = formatVersion < ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION || !guideData;
    const currentCard = useMemo(() => (
        guideData?.cards.find((card) => card.id === studyState.current_card_id) || guideData?.cards[0] || null
    ), [guideData, studyState.current_card_id]);
    const currentCardState = currentCard
        ? buildDefaultCardState(studyState.card_states?.[currentCard.id] || null)
        : null;
    const currentConcept = currentCard
        ? guideData?.knowledge_map?.concepts.find((concept) => concept.id === currentCard.concept_id) || null
        : null;

    const isToctStyleCard = currentCard?.teaching?.worked_examples?.length >= 2
        && Boolean(currentCard?.teaching?.intuition);

    const teachSections = useMemo(() => {
        if (!currentCard?.teaching) return [];
        const t = currentCard.teaching;
        const sections = [];
        sections.push({ key: 'explain', label: 'Explanation', type: 'explain' });
        if (t.intuition && !currentCardState?.intuition_previewed) {
            sections.push({ key: 'intuition', label: 'Mental Model', type: 'intuition' });
        }
        if (t.worked_examples?.length > 0) {
            t.worked_examples.forEach((ex, i) => {
                sections.push({ key: `example-${i}`, label: ex.title || `Example ${i + 1}`, type: 'worked_example', data: { ...ex, index: i } });
            });
        }
        if (t.common_mistakes?.length > 0) {
            sections.push({ key: 'mistakes', label: 'Common Mistakes', type: 'common_mistakes' });
        }
        // Fallback for old guides without TOCT fields
        if (sections.length === 1) {
            if (t.steps?.length > 0) sections.push({ key: 'steps', label: 'Breakdown', type: 'legacy_steps' });
            if (t.why_it_matters) sections.push({ key: 'why', label: 'Why It Matters', type: 'legacy_why' });
        }
        return sections;
    }, [currentCard, currentCardState?.intuition_previewed]);

    const explainParagraphs = useMemo(
        () => chunkExplain(currentCard?.teaching?.explain),
        [currentCard],
    );

    const onExplainSection = teachSections[teachSection]?.type === 'explain';
    const explainTotal = explainParagraphs.length;
    const explainFullyRevealed = !onExplainSection || explainRevealed >= explainTotal;
    const teachRevealCaption = (!hasSeenRevealHint.current && onExplainSection && explainRevealed === 1)
        ? "I'll walk through this one part at a time. Press space or ↓ to keep going."
        : riverCaption;
    const showFuzzyPrompt = (
        onExplainSection
        && Boolean(currentCard?.teaching?.intuition)
        && explainRevealed >= 3
        && explainRevealed < explainTotal
        && explainTotal > 4
    );

    useEffect(() => {
        if (teachSections.length === 0 || teachSection < teachSections.length) return;
        setTeachSection(Math.max(0, teachSections.length - 1));
    }, [teachSection, teachSections.length]);

    const persistStudyState = useCallback(async (nextState) => {
        const updatedGuide = await api.updateStudyGuide(id, { study_state: nextState });
        const normalizedGuideData = normalizeGuideData(updatedGuide?.guide_data ?? guideData);
        const normalizedStudyState = normalizeGuideStudyState(
            normalizedGuideData,
            updatedGuide?.study_state ?? nextState,
        );

        setGuide((prev) => ({ ...(prev || {}), ...(updatedGuide || {}), guide_data: normalizedGuideData }));
        setGuideData(normalizedGuideData);
        setStudyState(normalizedStudyState);
        return normalizedStudyState;
    }, [guideData, id]);

    const finalizeSession = useCallback(async ({
        nextState,
        sessionOutcome,
        exitReason,
    }) => {
        if (!guideData || finalizingRef.current) return;
        finalizingRef.current = true;
        const nowIso = new Date().toISOString();
        const finalState = normalizeGuideStudyState(guideData, {
            ...(nextState || studyState),
            session_status: sessionOutcome === 'complete'
                ? STUDY_SESSION_STATUSES.COMPLETE
                : STUDY_SESSION_STATUSES.PAUSED,
            active_stage: sessionOutcome === 'complete' ? 'complete' : 'teach',
            teach_section_index: sessionOutcome === 'complete' ? 0 : teachSection,
            explain_revealed_count: sessionOutcome === 'complete' ? 1 : explainRevealed,
            paused_at: sessionOutcome === 'complete' ? null : nowIso,
            completed_at: sessionOutcome === 'complete'
                ? ((nextState || studyState)?.completed_at || nowIso)
                : (nextState || studyState)?.completed_at || null,
            last_interaction_at: nowIso,
        });

        try {
            const payload = await api.completeStudyCoachSession({
                guideId: id,
                guideData,
                studyStateBefore: sessionStartStateRef.current || studyState,
                studyStateAfter: finalState,
                mode: 'guided',
                source: 'guide_view',
                classId: guide?.class_id || null,
                sessionOutcome,
                exitReason,
            });

            const normalizedAfter = normalizeGuideStudyState(guideData, finalState);
            setStudyState(normalizedAfter);
            setCompletionPayload({
                ...payload,
                sessionOutcome,
                exitReason,
            });
            setResult(null);
            setActiveAssistOption(null);
            setRiverState('celebrate');
            setRiverCaption(getCompleteCaption(guideData, {
                ...payload,
                sessionOutcome,
                exitReason,
            }));
            setSessionStage('complete');
        } catch (error) {
            const isNetworkError = error instanceof TypeError && !error.status;
            const message = error?.body?.error
                || (isNetworkError
                    ? 'Unable to save your session — check your connection and try again.'
                    : error?.message)
                || 'Failed to complete tutor session';
            toastRef.current.error(message);
            finalizingRef.current = false;
        }
    }, [explainRevealed, guide?.class_id, guideData, id, studyState, teachSection]);

    const moveToNextCard = useCallback(async (baseState, { allowIncompleteFinish = true } = {}) => {
        if (!guideData || !currentCard) return;

        const nextCardId = getNextCardId(
            guideData,
            currentCard.id,
            null,
            baseState.card_states,
        );

        if (!nextCardId) {
            await finalizeSession({
                nextState: baseState,
                sessionOutcome: allowIncompleteFinish ? 'stopped_early' : 'complete',
                exitReason: allowIncompleteFinish ? 'skipped_remaining' : 'finished',
            });
            return;
        }

        const nextCard = guideData.cards.find((card) => card.id === nextCardId) || null;
        const nextState = normalizeGuideStudyState(guideData, {
            ...baseState,
            current_card_id: nextCardId,
            session_phase: nextCard?.phase || baseState.session_phase,
            session_status: STUDY_SESSION_STATUSES.ACTIVE,
            active_stage: 'teach',
            teach_section_index: 0,
            explain_revealed_count: 1,
            paused_at: null,
        });

        const persistedState = await persistStudyState(nextState);
        setAnswer('');
        setResult(null);
        setActiveAssistOption(null);
        setTeachSection(0);
        setExpandedSteps({});
        setExplainRevealed(1);
        setFuzzyPeek(false);
        setRiverState(nextCard?.presentation?.pose || 'teach');
        setRiverCaption(getTeachCaption(nextCard));
        setSessionStage('teach');
        return persistedState;
    }, [currentCard, finalizeSession, guideData, persistStudyState]);

    const handleStart = useCallback(() => {
        setAnswer('');
        setResult(null);
        setActiveAssistOption(null);
        setTeachSection(0);
        setExpandedSteps({});
        setExplainRevealed(1);
        setFuzzyPeek(false);
        if (guideData) {
            setStudyState((prev) => normalizeGuideStudyState(guideData, {
                ...prev,
                session_status: STUDY_SESSION_STATUSES.ACTIVE,
                active_stage: 'teach',
                teach_section_index: 0,
                explain_revealed_count: 1,
                paused_at: null,
                completed_at: null,
            }));
        }
        setSessionStage('teach');
        setRiverState(currentCard?.presentation?.pose || 'teach');
        setRiverCaption(getTeachCaption(currentCard));
    }, [currentCard, guideData]);

    const handleSelectAssist = useCallback((option) => {
        setActiveAssistOption(option);
        setRiverState(option.pose || 'point');
        setRiverCaption(option.text);
    }, []);

    const handleBeginCheck = useCallback(() => {
        setActiveAssistOption(null);
        if (guideData) {
            setStudyState((prev) => normalizeGuideStudyState(guideData, {
                ...prev,
                session_status: STUDY_SESSION_STATUSES.ACTIVE,
                active_stage: 'check',
                teach_section_index: teachSection,
                explain_revealed_count: explainRevealed,
                paused_at: null,
            }));
        }
        setSessionStage('check');
        setRiverState('thinking');
        setRiverCaption(getCheckCaption(currentCard));
    }, [currentCard, explainRevealed, guideData, teachSection]);

    const handleRevealNext = useCallback(() => {
        setFuzzyPeek(false);
        setExplainRevealed((prev) => {
            const next = Math.min(prev + 1, explainTotal);
            const reachedEnd = next >= explainTotal;
            setRiverState(reachedEnd ? 'point' : 'thinking');
            setRiverCaption(reachedEnd
                ? 'That’s the whole thought. Ready for the why?'
                : 'Take a beat. Then keep going.');
            return next;
        });
    }, [explainTotal]);

    const handleAdvanceTeach = useCallback(() => {
        // On the explain section, advance the progressive reveal first; only
        // move to the next teaching section once all paragraphs are revealed.
        if (onExplainSection && explainRevealed < explainTotal) {
            handleRevealNext();
            return;
        }
        const nextIndex = teachSection + 1;
        if (nextIndex >= teachSections.length) {
            handleBeginCheck();
            return;
        }
        setTeachSection(nextIndex);
        setFuzzyPeek(false);
        const section = teachSections[nextIndex];
        const presentation = getTeachSectionPresentation(section, currentCard);
        setRiverState(presentation.state);
        setRiverCaption(presentation.caption);
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = requestAnimationFrame(() => {
            sectionRefs.current[section.key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [
        currentCard,
        explainRevealed,
        explainTotal,
        handleBeginCheck,
        handleRevealNext,
        onExplainSection,
        teachSection,
        teachSections,
    ]);

    const toggleStep = useCallback((exampleIndex, stepIndex) => {
        const key = `${exampleIndex}-${stepIndex}`;
        setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const toggleAllSteps = useCallback((exampleIndex, steps) => {
        setExpandedSteps((prev) => {
            const allOpen = steps.every((_, si) => !!prev[`${exampleIndex}-${si}`]);
            const next = {};
            steps.forEach((_, si) => { next[`${exampleIndex}-${si}`] = !allOpen; });
            return { ...prev, ...next };
        });
    }, []);

    const markCurrentCardIntuitionPreviewed = useCallback(() => {
        if (!guideData || !currentCard?.teaching?.intuition) return;

        setStudyState((prev) => normalizeGuideStudyState(guideData, {
            ...prev,
            card_states: {
                ...prev.card_states,
                [currentCard.id]: {
                    ...buildDefaultCardState(prev.card_states?.[currentCard.id]),
                    intuition_previewed: true,
                },
            },
        }));
    }, [currentCard, guideData]);

    const handleFuzzy = useCallback(() => {
        markCurrentCardIntuitionPreviewed();
        setFuzzyPeek(true);
        setRiverState('thinking');
        setRiverCaption('No rush. Let me put it another way.');
    }, [markCurrentCardIntuitionPreviewed]);

    const handleGotIt = useCallback(() => {
        setRiverState('encourage');
        setRiverCaption('Good — keep that.');
        handleRevealNext();
    }, [handleRevealNext]);

    useEffect(() => {
        if (explainRevealed > 1 && !hasSeenRevealHint.current) {
            hasSeenRevealHint.current = true;
            localStorage.setItem('riven_reveal_hint_seen', '1');
        }
    }, [explainRevealed]);

    useEffect(() => {
        if (sessionStage !== 'teach' || !onExplainSection || explainFullyRevealed) return undefined;
        const onKey = (e) => {
            if (e.key !== ' ' && e.key !== 'ArrowDown') return;
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
            e.preventDefault();
            handleRevealNext();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [sessionStage, onExplainSection, explainFullyRevealed, handleRevealNext]);

    const handleTeachBack = useCallback(() => {
        if (onExplainSection && explainRevealed > 1) {
            setExplainRevealed((prev) => Math.max(1, prev - 1));
            setRiverState('thinking');
            setRiverCaption('Let me restate that more slowly.');
            return;
        }

        if (teachSection <= 0) return;

        const nextIndex = teachSection - 1;
        const section = teachSections[nextIndex];
        const presentation = getTeachSectionPresentation(section, currentCard);
        setTeachSection(nextIndex);
        setFuzzyPeek(Boolean(
            section?.type === 'explain'
            && currentCardState?.intuition_previewed
            && currentCard?.teaching?.intuition,
        ));
        setRiverState(presentation.state);
        setRiverCaption(presentation.caption);
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = requestAnimationFrame(() => {
            sectionRefs.current[section.key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [currentCard, currentCardState?.intuition_previewed, explainRevealed, onExplainSection, teachSection, teachSections]);

    const handleReturnToTeach = useCallback(() => {
        const section = teachSections[teachSection];
        const presentation = getTeachSectionPresentation(section, currentCard);
        if (guideData) {
            setStudyState((prev) => normalizeGuideStudyState(guideData, {
                ...prev,
                session_status: STUDY_SESSION_STATUSES.ACTIVE,
                active_stage: 'teach',
                teach_section_index: teachSection,
                explain_revealed_count: explainRevealed,
                paused_at: null,
            }));
        }
        setSessionStage('teach');
        setFuzzyPeek(Boolean(
            section?.type === 'explain'
            && currentCardState?.intuition_previewed
            && currentCard?.teaching?.intuition,
        ));
        setRiverState(presentation.state);
        setRiverCaption(section?.type === 'explain' ? getTeachCaption(currentCard) : presentation.caption);
    }, [currentCard, currentCardState?.intuition_previewed, explainRevealed, guideData, teachSection, teachSections]);

    const handleSubmit = async () => {
        if (!guideData || !currentCard || submitting) return;

        setSubmitting(true);
        try {
            const evaluation = evaluateTutorCardResponse(guideData, currentCard, answer);
            const nowIso = new Date().toISOString();
            const cardState = buildDefaultCardState(currentCardState);
            const conceptState = studyState.concept_mastery?.[currentCard.concept_id] || {
                score: 0,
                status: 'unseen',
                attempts: 0,
                correct_attempts: 0,
                last_outcome: null,
            };

            const nextScore = clamp(
                conceptState.score + getScoreDelta(evaluation.outcome, currentCard.mastery_weight || 1),
                0,
                100,
            );
            const nextConceptState = {
                ...conceptState,
                score: nextScore,
                status: getConceptStatus(nextScore),
                attempts: (conceptState.attempts || 0) + 1,
                correct_attempts: (conceptState.correct_attempts || 0) + (evaluation.shouldAdvance ? 1 : 0),
                last_outcome: evaluation.outcome,
            };
            const nextCardState = {
                ...cardState,
                attempts: (cardState.attempts || 0) + 1,
                status: evaluation.outcome === 'correct'
                    ? 'mastered'
                    : evaluation.shouldAdvance
                        ? 'needs_review'
                        : evaluation.outcome === 'misconception'
                            ? 'retry'
                            : 'needs_review',
                last_outcome: evaluation.outcome,
                completed: Boolean(evaluation.shouldAdvance),
                skipped: false,
            };

            const provisionalCardStates = {
                ...studyState.card_states,
                [currentCard.id]: nextCardState,
            };
            const transitionCardId = evaluation.shouldAdvance
                ? getNextCardId(
                    guideData,
                    currentCard.id,
                    currentCard.transitions?.on_correct || null,
                    provisionalCardStates,
                )
                : null;
            const sessionComplete = evaluation.shouldAdvance && !transitionCardId;

            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: provisionalCardStates,
                concept_mastery: {
                    ...studyState.concept_mastery,
                    [currentCard.concept_id]: nextConceptState,
                },
                last_interaction_at: nowIso,
                last_reviewed_at: nowIso,
                session_status: STUDY_SESSION_STATUSES.ACTIVE,
                active_stage: 'feedback',
                teach_section_index: teachSection,
                explain_revealed_count: explainRevealed,
                paused_at: null,
                completed_at: sessionComplete ? nowIso : studyState.completed_at,
            });

            const persistedState = await persistStudyState(nextState);
            const nextResult = {
                ...evaluation,
                feedback: evaluation.feedback,
                persistedState,
                sessionComplete,
                nextCardId: transitionCardId,
                modelAnswer: currentCard.target_answer,
            };
            setResult(nextResult);
            setSessionStage('feedback');
            setRiverState(getFeedbackState(evaluation.outcome));
            setRiverCaption(getFeedbackCaption(currentCard, nextResult));
        } catch {
            toastRef.current.error('Failed to update tutor session');
        } finally {
            setSubmitting(false);
        }
    };

    const handleShowAnswer = async () => {
        if (!guideData || !currentCard || submitting) return;

        try {
            const nowIso = new Date().toISOString();
            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: {
                    ...studyState.card_states,
                    [currentCard.id]: {
                        ...buildDefaultCardState(currentCardState),
                        status: 'needs_review',
                        last_outcome: 'revealed',
                        completed: false,
                        revealed_answer: true,
                        skipped: false,
                    },
                },
                last_interaction_at: nowIso,
                last_reviewed_at: nowIso,
                session_status: STUDY_SESSION_STATUSES.ACTIVE,
                active_stage: 'feedback',
                teach_section_index: teachSection,
                explain_revealed_count: explainRevealed,
                paused_at: null,
            });

            const persistedState = await persistStudyState(nextState);
            const nextResult = {
                outcome: 'revealed',
                shouldAdvance: false,
                feedback: "Here's the answer — take a moment to study it, then decide whether to try again or move on.",
                persistedState,
                sessionComplete: false,
                nextCardId: null,
                modelAnswer: currentCard.target_answer,
            };
            setResult(nextResult);
            setSessionStage('feedback');
            setRiverState('point');
            setRiverCaption(getFeedbackCaption(currentCard, nextResult));
        } catch {
            toastRef.current.error('Failed to reveal the answer');
        }
    };

    const handleSkipForNow = async () => {
        if (!guideData || !currentCard || submitting) return;

        try {
            const nowIso = new Date().toISOString();
            const provisionalCardStates = {
                ...studyState.card_states,
                [currentCard.id]: {
                    ...buildDefaultCardState(currentCardState),
                    status: 'skipped',
                    last_outcome: 'skipped',
                    completed: false,
                    skipped: true,
                },
            };
            const nextCardId = getNextCardId(guideData, currentCard.id, null, provisionalCardStates);

            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: provisionalCardStates,
                current_card_id: nextCardId || studyState.current_card_id,
                session_phase: nextCardId
                    ? (guideData.cards.find((card) => card.id === nextCardId)?.phase || studyState.session_phase)
                    : studyState.session_phase,
                last_interaction_at: nowIso,
                last_reviewed_at: nowIso,
                session_status: STUDY_SESSION_STATUSES.ACTIVE,
                active_stage: nextCardId ? 'teach' : 'check',
                teach_section_index: nextCardId ? 0 : teachSection,
                explain_revealed_count: nextCardId ? 1 : explainRevealed,
                paused_at: null,
            });

            if (!nextCardId) {
                const persistedState = await persistStudyState(nextState);
                await finalizeSession({
                    nextState: persistedState,
                    sessionOutcome: 'stopped_early',
                    exitReason: 'skipped_remaining',
                });
                return;
            }

            await persistStudyState(nextState);
            setAnswer('');
            setResult(null);
            setActiveAssistOption(null);
            setTeachSection(0);
            setExpandedSteps({});
            setExplainRevealed(1);
            setFuzzyPeek(false);
            setRiverState('encourage');
            setRiverCaption('River has marked this for later so you can keep your momentum.');
            setSessionStage('teach');
        } catch {
            toastRef.current.error('Failed to skip this card');
        }
    };

    const handleTryAgain = useCallback(() => {
        setResult(null);
        setActiveAssistOption(null);
        setRefinedAnswer('');
        setSessionStage('check');
        setRiverState('thinking');
        setRiverCaption(getCheckCaption(currentCard));
    }, [currentCard]);

    const handleRefinedSubmit = async () => {
        if (!guideData || !currentCard || submitting || !refinedAnswer.trim()) return;

        setSubmitting(true);
        try {
            const evaluation = evaluateTutorCardResponse(guideData, currentCard, refinedAnswer);
            const nowIso = new Date().toISOString();
            const cardState = buildDefaultCardState(currentCardState);
            const conceptState = studyState.concept_mastery?.[currentCard.concept_id] || {
                score: 0,
                status: 'unseen',
                attempts: 0,
                correct_attempts: 0,
                last_outcome: null,
            };

            const nextScore = clamp(
                conceptState.score + getScoreDelta(evaluation.outcome, currentCard.mastery_weight || 1),
                0,
                100,
            );
            const nextConceptState = {
                ...conceptState,
                score: nextScore,
                status: getConceptStatus(nextScore),
                attempts: (conceptState.attempts || 0) + 1,
                correct_attempts: (conceptState.correct_attempts || 0) + (evaluation.shouldAdvance ? 1 : 0),
                last_outcome: evaluation.outcome,
            };
            const nextCardState = {
                ...cardState,
                attempts: (cardState.attempts || 0) + 1,
                status: evaluation.outcome === 'correct'
                    ? 'mastered'
                    : evaluation.shouldAdvance
                        ? 'needs_review'
                        : evaluation.outcome === 'misconception'
                            ? 'retry'
                            : 'needs_review',
                last_outcome: evaluation.outcome,
                completed: Boolean(evaluation.shouldAdvance),
                skipped: false,
            };

            const provisionalCardStates = {
                ...studyState.card_states,
                [currentCard.id]: nextCardState,
            };
            const transitionCardId = evaluation.shouldAdvance
                ? getNextCardId(
                    guideData,
                    currentCard.id,
                    currentCard.transitions?.on_correct || null,
                    provisionalCardStates,
                )
                : null;
            const sessionComplete = evaluation.shouldAdvance && !transitionCardId;

            const nextState = normalizeGuideStudyState(guideData, {
                ...studyState,
                card_states: provisionalCardStates,
                concept_mastery: {
                    ...studyState.concept_mastery,
                    [currentCard.concept_id]: nextConceptState,
                },
                last_interaction_at: nowIso,
                last_reviewed_at: nowIso,
                session_status: STUDY_SESSION_STATUSES.ACTIVE,
                active_stage: 'feedback',
                teach_section_index: teachSection,
                explain_revealed_count: explainRevealed,
                paused_at: null,
                completed_at: sessionComplete ? nowIso : studyState.completed_at,
            });

            const persistedState = await persistStudyState(nextState);
            const nextResult = {
                ...evaluation,
                feedback: evaluation.feedback,
                persistedState,
                sessionComplete,
                nextCardId: transitionCardId,
                modelAnswer: currentCard.target_answer,
            };
            setResult(nextResult);
            setAnswer(refinedAnswer);
            setRefinedAnswer('');
            setSessionStage('feedback');
            setRiverState(getFeedbackState(evaluation.outcome));
            setRiverCaption(getFeedbackCaption(currentCard, nextResult));
        } catch {
            toastRef.current.error('Failed to update tutor session');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAdvance = useCallback(async () => {
        if (!guideData || !result) return;

        if (result.sessionComplete) {
            await finalizeSession({
                nextState: result.persistedState || studyState,
                sessionOutcome: 'complete',
                exitReason: 'finished',
            });
            return;
        }

        await moveToNextCard(result.persistedState || studyState, {
            allowIncompleteFinish: !result.shouldAdvance,
        });
    }, [finalizeSession, guideData, moveToNextCard, result, studyState]);

    const pauseSession = useCallback(async () => {
        if (!guideData || !currentCard || submitting) return;

        const nowIso = new Date().toISOString();
        const nextState = normalizeGuideStudyState(guideData, {
            ...studyState,
            current_card_id: currentCard.id,
            session_phase: currentCard.phase || studyState.session_phase,
            session_status: STUDY_SESSION_STATUSES.PAUSED,
            active_stage: getPersistableStage(sessionStage),
            teach_section_index: teachSection,
            explain_revealed_count: explainRevealed,
            paused_at: nowIso,
            completed_at: null,
            last_interaction_at: nowIso,
        });

        try {
            await persistStudyState(nextState);
            toastRef.current.success('Session paused. Your place is saved.');
            navigate('/guides');
        } catch {
            toastRef.current.error('Failed to pause tutor session');
        }
    }, [
        currentCard,
        explainRevealed,
        guideData,
        navigate,
        persistStudyState,
        sessionStage,
        studyState,
        submitting,
        teachSection,
    ]);

    const handleSaveAndLeave = useCallback(() => {
        pauseSession();
    }, [pauseSession]);

    const handleResumeFromWrapUp = useCallback(() => {
        finalizingRef.current = false;
        setCompletionPayload(null);
        setResult(null);
        setActiveAssistOption(null);
        setTeachSection(0);
        setExpandedSteps({});
        setExplainRevealed(1);
        setFuzzyPeek(false);
        if (guideData) {
            setStudyState((prev) => normalizeGuideStudyState(guideData, {
                ...prev,
                session_status: STUDY_SESSION_STATUSES.ACTIVE,
                active_stage: 'teach',
                teach_section_index: 0,
                explain_revealed_count: 1,
                paused_at: null,
                completed_at: null,
            }));
        }
        setSessionStage('teach');
        setRiverState(currentCard?.presentation?.pose || 'teach');
        setRiverCaption(getTeachCaption(currentCard));
    }, [currentCard, guideData]);

    const handleStartReviewPass = useCallback(async () => {
        if (!guideData || !currentCard || submitting) return;

        const snapshot = getGuideMasterySnapshot(guideData, studyState);
        const targetSection = snapshot.recommendedSections[0] || guideData.sections?.[0] || null;
        const targetCard = guideData.cards.find((card) => card.concept_id === targetSection?.id)
            || guideData.cards[0]
            || currentCard;
        const nowIso = new Date().toISOString();
        const nextState = normalizeGuideStudyState(guideData, {
            ...studyState,
            current_card_id: targetCard.id,
            session_phase: targetCard.phase || studyState.session_phase,
            session_status: STUDY_SESSION_STATUSES.ACTIVE,
            active_stage: 'teach',
            teach_section_index: 0,
            explain_revealed_count: 1,
            paused_at: null,
            completed_at: null,
            last_interaction_at: nowIso,
        });

        try {
            sessionStartStateRef.current = studyState;
            const persistedState = await persistStudyState(nextState);
            setAnswer('');
            setResult(null);
            setCompletionPayload(null);
            setActiveAssistOption(null);
            setRefinedAnswer('');
            setTeachSection(0);
            setExpandedSteps({});
            setExplainRevealed(1);
            setFuzzyPeek(false);
            setSessionStage('teach');
            setRiverState(targetCard?.presentation?.pose || 'teach');
            setRiverCaption(getTeachCaption(targetCard));
            finalizingRef.current = false;
            return persistedState;
        } catch {
            toastRef.current.error('Failed to start review pass');
        }
    }, [currentCard, guideData, persistStudyState, studyState, submitting]);

    const handleBackToGuides = useCallback(() => {
        if (['teach', 'check', 'feedback'].includes(sessionStage)) {
            pauseSession();
            return;
        }
        navigate('/guides');
    }, [navigate, pauseSession, sessionStage]);

    const visibleParagraphs = useMemo(
        () => explainParagraphs.slice(0, explainRevealed),
        [explainParagraphs, explainRevealed],
    );

    // Hooks must be called before any conditional returns (Rules of Hooks)
    const currentCardIndex = useMemo(
        () => (guideData && currentCard
            ? guideData.cards.findIndex((c) => c.id === currentCard.id) + 1
            : 0),
        [guideData, currentCard],
    );
    const totalCards = guideData?.cards?.length ?? 0;
    const animatedXP = useCountUp(completionPayload?.xpEarned ?? 0, 700);
    const animatedMastery = useCountUp(completionPayload?.masteryDelta ?? 0, 600);
    const xpProgress = getXpProgress(completionPayload?.stats);
    const currentTeachSectionMeta = teachSections[teachSection] || null;

    useEffect(() => {
        if (!clearStudyMode) return undefined;

        if (!isMobileSession || unsupported || loading || !currentCard) {
            clearStudyMode();
            return undefined;
        }

        if (sessionStage === 'teach') {
            setStudyMode?.({
                tabs: [
                    { label: 'River', handler: () => window.scrollTo({ top: 0, behavior: 'smooth' }), active: true },
                    { label: 'Anchor', handler: handleBeginCheck },
                    { label: 'Pause', handler: handleSaveAndLeave },
                ],
                currentIndex: teachSection,
                totalSections: Math.max(teachSections.length, 1),
                progressLabel: currentTeachSectionMeta?.label || 'Lesson beat',
                prevLabel: onExplainSection && explainRevealed > 1 ? 'Rewind' : 'Back',
                nextLabel: onExplainSection && explainRevealed < explainTotal ? 'More' : 'Next beat',
                onPrev: handleTeachBack,
                onNext: handleAdvanceTeach,
                canPrev: teachSection > 0 || (onExplainSection && explainRevealed > 1),
                canNext: true,
            });
            return () => clearStudyMode();
        }

        if (sessionStage === 'check') {
            setStudyMode?.({
                tabs: [
                    { label: 'River', handler: () => window.scrollTo({ top: 0, behavior: 'smooth' }), active: true },
                    { label: 'Answer', handler: () => document.getElementById('river-answer')?.focus() },
                    { label: 'Pause', handler: handleSaveAndLeave },
                ],
                currentIndex: currentCardIndex > 0 ? currentCardIndex - 1 : 0,
                totalSections: Math.max(totalCards, 1),
                progressLabel: 'Recall check',
                prevLabel: 'Review',
                nextLabel: 'Pause',
                onPrev: handleReturnToTeach,
                onNext: handleSaveAndLeave,
                canPrev: true,
                canNext: true,
            });
            return () => clearStudyMode();
        }

        if (sessionStage === 'feedback' && result) {
            setStudyMode?.({
                tabs: [
                    { label: 'River', handler: () => window.scrollTo({ top: 0, behavior: 'smooth' }), active: true },
                    { label: result.shouldAdvance ? 'Model' : 'Hint', handler: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
                    { label: 'Pause', handler: handleSaveAndLeave },
                ],
                currentIndex: currentCardIndex > 0 ? currentCardIndex - 1 : 0,
                totalSections: Math.max(totalCards, 1),
                progressLabel: result.shouldAdvance ? 'River response' : 'Try the next angle',
                prevLabel: result.shouldAdvance ? 'Review' : 'Retry',
                nextLabel: result.shouldAdvance ? 'Next card' : 'Mark later',
                onPrev: result.shouldAdvance ? handleReturnToTeach : handleTryAgain,
                onNext: handleAdvance,
                canPrev: true,
                canNext: true,
            });
            return () => clearStudyMode();
        }

        clearStudyMode();
        return undefined;
    }, [
        clearStudyMode,
        currentCard,
        currentCardIndex,
        currentTeachSectionMeta?.label,
        explainRevealed,
        explainTotal,
        handleAdvance,
        handleAdvanceTeach,
        handleBeginCheck,
        handleReturnToTeach,
        handleSaveAndLeave,
        handleTeachBack,
        handleTryAgain,
        isMobileSession,
        loading,
        onExplainSection,
        result,
        sessionStage,
        setStudyMode,
        teachSection,
        teachSections.length,
        totalCards,
        unsupported,
    ]);

    if (loading) {
        return (
            <div className="min-h-screen bg-claude-bg text-claude-text flex items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-claude-secondary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading River Session...
                </div>
            </div>
        );
    }

    if (unsupported) {
        return (
            <div className="min-h-screen bg-claude-bg text-claude-text px-4 py-10">
                <button
                    type="button"
                    onClick={handleBackToGuides}
                    className="inline-flex items-center gap-2 text-sm text-claude-secondary hover:text-claude-text transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Tutor Sessions
                </button>

                <div data-testid="river-session-unsupported" className="mx-auto mt-12 max-w-2xl">
                    <div
                        className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                        style={UNSUPPORTED_FRAME_STYLE}
                    >
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.1]"
                            style={UNSUPPORTED_GRAIN_STYLE}
                        />
                        <div
                            className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                            style={UNSUPPORTED_SURFACE_STYLE}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                style={UNSUPPORTED_DUST_STYLE}
                            />
                            <div
                                className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                style={UNSUPPORTED_TRAY_STYLE}
                            />

                            <p className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.78)' }}>River Session</p>
                            <h1 className="mt-3 text-3xl font-serif italic font-bold" style={{ color: '#efe4d1' }}>This guide is no longer supported</h1>
                            <p className="mt-4 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                River Tutor Session v4 is a hard cutover. Older study-guide and exam-coach artifacts no longer run inside this route.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const title = guide?.title || 'Tutor Session';
    const completionIsPartial = completionPayload?.sessionOutcome === 'stopped_early';
    const assistOptions = currentCard?.assist_options || [];
    const reviewPassLabel = completionPayload?.weakTopicsRemaining?.length
        ? 'Review weak concepts'
        : 'Start review pass';

    // Current River pose accent color — drives surface tinting on feedback stage
    const poseAccent = RIVER_POSE_ACCENT[riverState] ?? '#8fb27c';

    return (
        <div className="min-h-screen bg-claude-bg text-claude-text px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-6xl">
                <button
                    type="button"
                    onClick={handleBackToGuides}
                    className="inline-flex items-center gap-2 text-sm text-claude-secondary hover:text-claude-text transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Tutor Sessions
                </button>

                {['teach', 'check', 'feedback'].includes(sessionStage) && totalCards > 1 ? (
                    <motion.div
                        key={`pip-${currentCard?.id}-${sessionStage}`}
                        className="mt-5 flex items-center gap-1.5"
                        aria-label={`Concept ${currentCardIndex} of ${totalCards}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, ease: PANEL_EASE }}
                    >
                        {guideData.cards.map((card) => {
                            const done = studyState.card_states?.[card.id]?.completed;
                            const active = card.id === currentCard?.id;
                            return (
                                <div
                                    key={card.id}
                                    className={`h-[5px] rounded-full transition-all duration-500 ${
                                        done
                                            ? 'w-5 bg-claude-accent'
                                            : active
                                                ? 'w-5 bg-claude-accent/55'
                                                : 'w-[5px] bg-claude-border'
                                    }`}
                                />
                            );
                        })}
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary">
                            {sessionStage === 'teach' && (
                                isToctStyleCard && teachSections.length > 1
                                    ? <span>Teach <span className="text-claude-accent">{teachSection + 1}/{teachSections.length}</span></span>
                                    : <span>Teach</span>
                            )}
                            {sessionStage === 'check' && (
                                <><span className="opacity-40">Teach &rarr;</span>{' '}<span className="text-claude-accent">Check</span></>
                            )}
                            {sessionStage === 'feedback' && (
                                <><span className="opacity-40">Check &rarr;</span>{' '}<span className="text-claude-accent">Feedback</span></>
                            )}
                        </span>
                    </motion.div>
                ) : null}

                {sessionStage === 'intro' ? (
                    <motion.section
                        data-testid="river-session-intro"
                        className="guide-perf-section mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.42, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />
                            <div
                                className={`relative rounded-[0.5rem] sm:rounded-[0.75rem] ${isMobileSession ? 'px-4 py-5' : 'px-6 py-6 sm:px-8 sm:py-8'}`}
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                {isMobileSession ? (
                                    <div className="space-y-4 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]">
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: 'rgba(222,185,106,0.78)' }}>
                                                River session
                                            </p>
                                            <h1 className="mt-2 text-[2rem] font-serif italic font-bold leading-[1.02]" style={{ color: '#efe4d1' }}>
                                                {title}
                                            </h1>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em]" style={{ borderColor: 'rgba(255,255,255,0.14)', color: '#efe4d1', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                                    {guideData.session_meta.subject}
                                                </span>
                                                <span className="rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em]" style={{ borderColor: 'rgba(255,255,255,0.14)', color: 'rgba(228,219,201,0.82)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                                    {guideData.lecture.agenda.length} stops
                                                </span>
                                            </div>
                                        </div>

                                        <MobileTeacherStrip
                                            state={riverState}
                                            caption={riverCaption}
                                            roleLabel={guideData.session_meta.river_role}
                                            stageLabel="River opens the lesson"
                                        />

                                        <div className="rounded-[1.45rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.66)' }}>
                                                What we&apos;ll cover
                                            </p>
                                            <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.86)' }}>
                                                {guideData.lecture.opening}
                                            </p>
                                            {guideData.lecture.agenda.length > 0 ? (
                                                <div className="mt-3 space-y-2">
                                                    {guideData.lecture.agenda.slice(0, 3).map((item, index) => (
                                                        <div
                                                            key={`${item}-${index}`}
                                                            className="rounded-[1rem] border px-3 py-2.5 text-sm leading-6"
                                                            style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#efe4d1' }}
                                                        >
                                                            <span className="mr-2" style={{ color: 'rgba(222,185,106,0.85)' }}>{index + 1}.</span>
                                                            {item}
                                                        </div>
                                                    ))}
                                                    {guideData.lecture.agenda.length > 3 ? (
                                                        <p className="text-xs leading-5 text-claude-secondary/80">
                                                            {guideData.lecture.agenda.length - 3} more lesson beats are waiting once River gets started.
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="grid gap-3 sm:hidden">
                                            <div className="rounded-[1.2rem] border p-3" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Goal</p>
                                                <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.88)' }}>{guideData.session_meta.student_goal}</p>
                                            </div>
                                            <div className="rounded-[1.2rem] border p-3" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Style</p>
                                                <p className="mt-2 text-sm leading-6 capitalize" style={{ color: 'rgba(228,219,201,0.88)' }}>{guideData.session_meta.lecture_style}</p>
                                            </div>
                                        </div>

                                        <MobileSessionActionTray>
                                            <button
                                                type="button"
                                                onClick={handleStart}
                                                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                            >
                                                Start with River
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleBackToGuides}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors"
                                                style={{ color: 'rgba(228,219,201,0.76)' }}
                                            >
                                                Back
                                            </button>
                                        </MobileSessionActionTray>
                                    </div>
                                ) : (
                                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                                        <div>
                                            <p className="text-[11px] font-mono uppercase tracking-[0.2em]" style={{ color: 'rgba(222,185,106,0.78)' }}>Today&apos;s lecture</p>
                                            <h1 className="mt-3 text-4xl sm:text-5xl font-serif italic font-bold tracking-tight" style={{ color: '#efe4d1' }}>{title}</h1>
                                            <p className="mt-4 max-w-2xl text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                                {guideData.lecture.opening}
                                            </p>
                                            <div className="mt-6 grid gap-3 md:grid-cols-3">
                                                <div className="rounded-[1.4rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Subject</p>
                                                    <p className="mt-2 text-lg font-semibold" style={{ color: '#efe4d1' }}>{guideData.session_meta.subject}</p>
                                                </div>
                                                <div className="rounded-[1.4rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Goal</p>
                                                    <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.88)' }}>{guideData.session_meta.student_goal}</p>
                                                </div>
                                                <div className="rounded-[1.4rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Style</p>
                                                    <p className="mt-2 text-sm leading-6 capitalize" style={{ color: 'rgba(228,219,201,0.88)' }}>{guideData.session_meta.lecture_style}</p>
                                                </div>
                                            </div>
                                            {guideData.lecture.agenda.length > 0 ? (
                                                <div className="mt-6 rounded-[1.6rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Agenda</p>
                                                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                        {guideData.lecture.agenda.map((item, index) => (
                                                            <div key={`${item}-${index}`} className="rounded-[1rem] border px-3 py-3 text-sm leading-6" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)', color: 'rgba(228,219,201,0.9)' }}>
                                                                <span className="mr-2" style={{ color: 'rgba(222,185,106,0.85)' }}>{index + 1}.</span>
                                                                {item}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                            <div className="mt-6 flex flex-wrap gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleStart}
                                                    className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                >
                                                    Start with River
                                                </button>
                                            </div>
                                        </div>

                                        <RiverMascot state={riverState} caption={riverCaption} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {sessionStage === 'teach' && currentCard ? (
                    isMobileSession ? (
                    <motion.section
                        data-testid="river-session-teach"
                        className="guide-perf-section mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={BOARD_FRAME_STYLE}
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={BOARD_GRAIN_STYLE} />
                            <div
                                className="relative rounded-[0.5rem] px-4 py-5"
                                style={BOARD_SURFACE_STYLE}
                            >
                                <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.04]" style={BOARD_DUST_STYLE} />
                                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]" style={BOARD_TRAY_STYLE} />

                                <div className="space-y-4 pb-[calc(8.75rem+env(safe-area-inset-bottom,0px))]">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: 'rgba(222,185,106,0.72)' }}>
                                                {guideData.session_meta.river_role}
                                            </p>
                                            <h2 className="mt-2 text-[2rem] font-serif italic font-bold leading-[1.02]" style={{ color: '#efe4d1' }}>
                                                <SubjectRenderer content={currentConcept?.title || currentCard.prompt} />
                                            </h2>
                                        </div>
                                        <div className="rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em]" style={{ borderColor: 'rgba(255,255,255,0.14)', color: '#efe4d1', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                            Beat {teachSection + 1}/{Math.max(teachSections.length, 1)}
                                        </div>
                                    </div>

                                    <MobileTeacherStrip
                                        state={riverState}
                                        caption={teachRevealCaption}
                                        roleLabel={guideData.session_meta.river_role}
                                        stageLabel={currentTeachSectionMeta?.label || 'Explanation'}
                                    />

                                    <div
                                        ref={(node) => {
                                            if (currentTeachSectionMeta?.key) sectionRefs.current[currentTeachSectionMeta.key] = node;
                                        }}
                                        className="rounded-[1.55rem] border p-4"
                                        style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}
                                    >
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.68)' }}>
                                            {currentTeachSectionMeta?.label || 'Explanation'}
                                        </p>

                                        {currentTeachSectionMeta?.type === 'explain' ? (
                                            <div className="mt-3 space-y-3">
                                                {visibleParagraphs.map((paragraph, index) => (
                                                    <p key={`${currentCard.id}-mobile-explain-${index}`} className="text-base leading-8" style={{ color: '#efe4d1' }}>
                                                        <SubjectRenderer content={paragraph} />
                                                    </p>
                                                ))}
                                                {showFuzzyPrompt && !fuzzyPeek ? (
                                                    <div className="rounded-[1.15rem] border px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                                        <p className="text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                                            River can restate this before you move on.
                                                        </p>
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleFuzzy}
                                                                className="inline-flex min-h-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm transition-colors"
                                                                style={{ borderColor: 'rgba(255,255,255,0.18)', color: '#efe4d1' }}
                                                            >
                                                                Put it another way
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleGotIt}
                                                                className="inline-flex min-h-[42px] items-center justify-center rounded-full px-4 py-2 text-sm font-medium"
                                                                style={{ color: 'rgba(228,219,201,0.78)' }}
                                                            >
                                                                I&apos;ve got it
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                {fuzzyPeek ? (
                                                    <div className="rounded-[1.15rem] border px-4 py-3" style={{ borderColor: 'rgba(143,178,124,0.26)', backgroundColor: 'rgba(143,178,124,0.08)' }}>
                                                        <p className="text-sm leading-6" style={{ color: '#efe4d1' }}>
                                                            <SubjectRenderer content={currentCard.teaching.intuition} />
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        {currentTeachSectionMeta?.type === 'intuition' ? (
                                            <div className="mt-3 text-base leading-8" style={{ color: '#efe4d1' }}>
                                                <SubjectRenderer content={currentCard.teaching.intuition} />
                                            </div>
                                        ) : null}

                                        {currentTeachSectionMeta?.type === 'worked_example' ? (
                                            <div className="mt-3 space-y-3">
                                                {currentTeachSectionMeta.data?.title ? (
                                                    <h3 className="text-lg font-semibold" style={{ color: '#efe4d1' }}>
                                                        {currentTeachSectionMeta.data.title}
                                                    </h3>
                                                ) : null}
                                                {currentTeachSectionMeta.data?.scenario ? (
                                                    <p className="text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                                        <SubjectRenderer content={currentTeachSectionMeta.data.scenario} />
                                                    </p>
                                                ) : null}
                                                <div className="space-y-2.5">
                                                    {(currentTeachSectionMeta.data?.steps || []).map((step, index) => (
                                                        <button
                                                            key={`${currentTeachSectionMeta.key}-step-${index}`}
                                                            type="button"
                                                            onClick={() => toggleStep(currentTeachSectionMeta.data?.index || 0, index)}
                                                            className="block w-full rounded-[1rem] border px-3 py-3 text-left transition-colors"
                                                            style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)' }}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <span className="mt-0.5 text-xs font-mono" style={{ color: 'rgba(222,185,106,0.8)' }}>{index + 1}.</span>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm leading-6" style={{ color: '#efe4d1' }}>
                                                                        <SubjectRenderer content={step.step || step} inline />
                                                                    </p>
                                                                    {expandedSteps[`${currentTeachSectionMeta.data?.index || 0}-${index}`] && step.explanation ? (
                                                                        <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.76)' }}>
                                                                            <SubjectRenderer content={step.explanation} inline />
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}

                                        {currentTeachSectionMeta?.type === 'common_mistakes' ? (
                                            <div className="mt-3 space-y-2.5">
                                                {currentCard.teaching.common_mistakes.map((mistake, index) => (
                                                    <div
                                                        key={`${currentCard.id}-mistake-${index}`}
                                                        className="rounded-[1rem] border px-3 py-3"
                                                        style={{ borderColor: 'rgba(213,150,120,0.18)', backgroundColor: 'rgba(213,150,120,0.08)' }}
                                                    >
                                                        <p className="text-sm leading-6" style={{ color: '#efe4d1' }}>
                                                            <SubjectRenderer content={mistake} inline />
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}

                                        {currentTeachSectionMeta?.type === 'legacy_steps' ? (
                                            <div className="mt-3 space-y-2.5">
                                                {currentCard.teaching.steps.map((step, index) => (
                                                    <div
                                                        key={`${currentCard.id}-legacy-step-${index}`}
                                                        className="rounded-[1rem] border px-3 py-3"
                                                        style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)' }}
                                                    >
                                                        <span className="mr-2 text-xs font-mono" style={{ color: 'rgba(222,185,106,0.8)' }}>{index + 1}.</span>
                                                        <span className="text-sm leading-6" style={{ color: '#efe4d1' }}>
                                                            <SubjectRenderer content={step} inline />
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}

                                        {currentTeachSectionMeta?.type === 'legacy_why' ? (
                                            <div className="mt-3 space-y-3">
                                                <p className="text-base leading-8" style={{ color: '#efe4d1' }}>
                                                    <SubjectRenderer content={currentCard.teaching.why_it_matters} />
                                                </p>
                                                {currentCard.teaching.example ? (
                                                    <div className="rounded-[1rem] border px-3 py-3" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Anchor example</p>
                                                        <p className="mt-2 text-sm leading-6" style={{ color: '#efe4d1' }}>
                                                            <SubjectRenderer content={currentCard.teaching.example} />
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>

                                    {assistOptions.length > 0 ? (
                                        <div className="rounded-[1.35rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.66)' }}>Ask River</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {assistOptions.slice(0, 3).map((option) => (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() => handleSelectAssist(option)}
                                                        className="inline-flex min-h-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm transition-colors"
                                                        style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#efe4d1' }}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {activeAssistOption ? (
                                                <div className="mt-3 rounded-[1rem] border px-3 py-3" style={{ borderColor: 'rgba(143,178,124,0.26)', backgroundColor: 'rgba(143,178,124,0.08)' }}>
                                                    <p className="text-sm leading-6" style={{ color: '#efe4d1' }}>
                                                        <SubjectRenderer content={activeAssistOption.text} />
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <MobileSessionActionTray>
                                        <button
                                            type="button"
                                            onClick={handleAdvanceTeach}
                                            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                        >
                                            {onExplainSection && explainRevealed < explainTotal
                                                ? `Keep going (${explainRevealed}/${explainTotal})`
                                                : teachSection < teachSections.length - 1
                                                    ? `Next: ${teachSections[teachSection + 1]?.label}`
                                                    : 'Ready to answer'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={teachSection < teachSections.length - 1 ? handleBeginCheck : handleSaveAndLeave}
                                            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors"
                                            style={{ color: 'rgba(228,219,201,0.78)' }}
                                        >
                                            {teachSection < teachSections.length - 1 ? 'Skip to question' : 'Pause here'}
                                        </button>
                                    </MobileSessionActionTray>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                    ) : isToctStyleCard ? (
                    /* ── Blackboard Lecture (TOCT-style cards) ── */
                    <motion.section
                        data-testid="river-session-teach"
                        className="guide-perf-section mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: PANEL_EASE }}
                    >
                        <div className="relative overflow-visible" data-testid="river-board-stage">
                            <DesktopBoardTeacher
                                state={riverState}
                                boardRef={boardFrameRef}
                                targetRef={activeTeachTargetRef}
                                activeSection={currentTeachSectionMeta}
                                sectionIndex={teachSection}
                                revealIndex={explainRevealed}
                            />

                            {/* Wooden frame */}
                            <div
                                ref={boardFrameRef}
                                data-testid="river-board-frame"
                                className="relative z-10 overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                                style={BOARD_FRAME_STYLE}
                            >
                            {/* Wood grain texture */}
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.12]"
                                style={BOARD_GRAIN_STYLE}
                            />

                            {/* Chalkboard surface */}
                            <div
                                data-testid="river-board-surface"
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-5 py-6 sm:px-8 sm:py-8"
                                style={BOARD_SURFACE_STYLE}
                            >
                                {/* Chalk dust particles overlay */}
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.04]"
                                    style={BOARD_DUST_STYLE}
                                />

                                {/* Chalk tray line at bottom */}
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={BOARD_TRAY_STYLE}
                                />

                                {/* Section progress header */}
                                <div className="relative z-10 mb-6 sm:mb-8" data-testid="river-board-header">
                                    <div className="min-w-0 pt-1">
                                    <p
                                        className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.2em]"
                                        style={{ color: 'rgba(222,185,106,0.7)' }}
                                    >
                                        {guideData.session_meta.river_role} &middot; {teachSection + 1}/{teachSections.length}
                                    </p>
                                    <h2
                                        className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-serif italic font-bold leading-tight"
                                        style={{ color: '#e8dcc8' }}
                                    >
                                        <SubjectRenderer content={currentConcept?.title || currentCard.prompt} />
                                    </h2>
                                    {currentCard.teaching.learning_objective ? (
                                        <p
                                            className="mt-3 max-w-[68ch] text-sm leading-6 lg:max-w-[52ch]"
                                            style={{ color: 'rgba(232,220,200,0.74)' }}
                                        >
                                            <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>
                                                Goal
                                            </span>
                                            <span className="ml-2">
                                                <SubjectRenderer content={currentCard.teaching.learning_objective} inline />
                                            </span>
                                        </p>
                                    ) : null}
                                    {/* Chalk progress dots */}
                                    <div className="mt-3 flex items-center gap-1.5">
                                        {teachSections.map((section, i) => (
                                            <div
                                                key={section.key}
                                                className="transition-all duration-500"
                                                style={{
                                                    width: i <= teachSection ? 20 : 6,
                                                    height: 4,
                                                    borderRadius: 2,
                                                    backgroundColor: i <= teachSection
                                                        ? 'rgba(222,185,106,0.65)'
                                                        : 'rgba(255,255,255,0.12)',
                                                }}
                                            />
                                        ))}
                                    </div>
                                    </div>
                                </div>

                                {/* ── Lecture sections ── */}
                                <div className="relative z-10 space-y-6 lg:pr-[15rem] 2xl:pr-[17rem]" data-testid="river-board-content">
                                    {teachSections.map((section, sectionIndex) => {
                                        if (sectionIndex > teachSection) return null;
                                        const isActiveSectionTarget = sectionIndex === teachSection && section.type !== 'explain';

                                        return (
                                            <motion.div
                                                key={section.key}
                                                ref={(el) => {
                                                    sectionRefs.current[section.key] = el;
                                                    if (isActiveSectionTarget) activeTeachTargetRef.current = el;
                                                }}
                                                data-current-teach-target={isActiveSectionTarget ? 'true' : undefined}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.5, ease: PANEL_EASE }}
                                            >
                                                {/* Section label */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span
                                                        className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em]"
                                                        style={{ color: 'rgba(222,185,106,0.55)' }}
                                                    >
                                                        {section.label}
                                                    </span>
                                                    <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
                                                </div>

                                                {/* ── Explain section (progressive reveal) ── */}
                                                {section.type === 'explain' && (
                                                    <div className="space-y-3">
                                                        {visibleParagraphs.map((paragraph, pi) => {
                                                            const isCurrent = sectionIndex === teachSection && pi === explainRevealed - 1;
                                                            return (
                                                                <motion.p
                                                                    key={pi}
                                                                    ref={(el) => {
                                                                        if (isCurrent) activeTeachTargetRef.current = el;
                                                                    }}
                                                                    data-current-teach-target={isCurrent ? 'true' : undefined}
                                                                    className="text-[15px] sm:text-base leading-[1.8] max-w-[72ch] transition-[color,opacity] duration-500 ease-out"
                                                                    initial={{ opacity: 0, y: 8 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ duration: 0.45, ease: PANEL_EASE }}
                                                                    style={{
                                                                        color: isCurrent
                                                                            ? '#e8dcc8'
                                                                            : 'color-mix(in oklab, #d4ccb8 55%, transparent)',
                                                                    }}
                                                                >
                                                                    <SubjectRenderer content={paragraph} inline />
                                                                </motion.p>
                                                            );
                                                        })}

                                                        {/* Mid-reveal checkpoint */}
                                                        {showFuzzyPrompt && !fuzzyPeek && (
                                                            <motion.div
                                                                key="fuzzy-prompt"
                                                                initial={{ opacity: 0, y: 6 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.35, ease: PANEL_EASE, delay: 0.15 }}
                                                                className="mt-5 flex flex-wrap items-center gap-3 pt-4"
                                                                style={{ borderTop: '1px dashed rgba(222,185,106,0.18)' }}
                                                            >
                                                                <span
                                                                    className="text-[10px] font-mono uppercase tracking-[0.2em]"
                                                                    style={{ color: 'rgba(222,185,106,0.55)' }}
                                                                >
                                                                    Does this click?
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleGotIt}
                                                                    className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
                                                                    style={{
                                                                        backgroundColor: 'rgba(222,185,106,0.12)',
                                                                        color: '#deb96a',
                                                                        border: '1px solid rgba(222,185,106,0.22)',
                                                                    }}
                                                                >
                                                                    Got it
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleFuzzy}
                                                                    className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
                                                                    style={{
                                                                        backgroundColor: 'rgba(255,255,255,0.04)',
                                                                        color: 'rgba(212,204,184,0.7)',
                                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                                    }}
                                                                >
                                                                    Still fuzzy
                                                                </button>
                                                            </motion.div>
                                                        )}

                                                        {/* Fuzzy peek: show intuition inline as an alternate framing */}
                                                        {fuzzyPeek && currentCard?.teaching?.intuition && (
                                                            <motion.div
                                                                key="fuzzy-peek"
                                                                initial={{ opacity: 0, y: 6 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.4, ease: PANEL_EASE }}
                                                                className="mt-4 rounded-xl px-5 py-4"
                                                                style={{
                                                                    backgroundColor: 'rgba(222,185,106,0.06)',
                                                                    border: '1px solid rgba(222,185,106,0.14)',
                                                                }}
                                                            >
                                                                <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(222,185,106,0.6)' }}>
                                                                    Another way to see it
                                                                </p>
                                                                <p
                                                                    className="text-[15px] sm:text-base leading-[1.8] italic max-w-[68ch]"
                                                                    style={{ color: '#e8dcc8' }}
                                                                >
                                                                    <SubjectRenderer content={currentCard.teaching.intuition} inline />
                                                                </p>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ── Intuition section ── */}
                                                {section.type === 'intuition' && (
                                                    <div
                                                        className="rounded-xl px-5 py-4"
                                                        style={{
                                                            backgroundColor: 'rgba(222,185,106,0.06)',
                                                            border: '1px solid rgba(222,185,106,0.12)',
                                                        }}
                                                    >
                                                        <p
                                                            className="text-[15px] sm:text-base leading-[1.8] italic max-w-[68ch]"
                                                            style={{ color: '#d4ccb8' }}
                                                        >
                                                            <SubjectRenderer content={currentCard.teaching.intuition} inline />
                                                        </p>
                                                    </div>
                                                )}

                                                {/* ── Worked example section ── */}
                                                {section.type === 'worked_example' && section.data && (
                                                    <div
                                                        className="rounded-xl overflow-hidden"
                                                        style={{
                                                            backgroundColor: 'rgba(0,0,0,0.18)',
                                                            border: '1px solid rgba(255,255,255,0.06)',
                                                        }}
                                                    >
                                                        {/* Problem statement */}
                                                        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.55)' }}>
                                                                Problem
                                                            </p>
                                                            <p className="mt-2 text-[15px] sm:text-base leading-[1.7] font-medium" style={{ color: '#e8dcc8' }}>
                                                                <SubjectRenderer content={section.data.problem} inline />
                                                            </p>
                                                        </div>

                                                        {/* Steps */}
                                                        {section.data.steps.length > 1 && (
                                                            <div className="flex justify-end px-5 pt-2.5 pb-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleAllSteps(sectionIndex, section.data.steps)}
                                                                    className="text-[10px] font-mono uppercase tracking-[0.14em] transition-opacity hover:opacity-100"
                                                                    style={{ color: 'rgba(222,185,106,0.4)' }}
                                                                >
                                                                    {section.data.steps.every((_, si) => expandedSteps[`${sectionIndex}-${si}`] !== false)
                                                                        ? 'Hide step details' : 'Show step details'}
                                                                </button>
                                                            </div>
                                                        )}
                                                        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                                                            {section.data.steps.map((exStep, si) => {
                                                                const stepKey = `${sectionIndex}-${si}`;
                                                                const isExpanded = !!expandedSteps[stepKey];
                                                                const stepIsMath = hasMathSyntax(exStep.step);
                                                                return (
                                                                    <div key={si}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleStep(sectionIndex, si)}
                                                                            className="w-full text-left px-5 py-3 flex items-start gap-3 transition-colors hover:bg-white/[0.02]"
                                                                        >
                                                                            <span
                                                                                className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-medium"
                                                                                style={{
                                                                                    backgroundColor: 'rgba(222,185,106,0.15)',
                                                                                    color: 'rgba(222,185,106,0.8)',
                                                                                }}
                                                                            >
                                                                                {si + 1}
                                                                            </span>
                                                                            <span
                                                                                className={stepIsMath ? 'flex-1 rounded-lg px-3 py-2' : 'flex-1 text-sm leading-6'}
                                                                                style={stepIsMath
                                                                                    ? {
                                                                                        color: '#e8dcc8',
                                                                                        backgroundColor: 'rgba(255,255,255,0.035)',
                                                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                                                    }
                                                                                    : { color: '#d4ccb8' }}
                                                                            >
                                                                                {stepIsMath ? (
                                                                                    <span className="mb-1 block text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.45)' }}>
                                                                                        Equation
                                                                                    </span>
                                                                                ) : null}
                                                                                <span className={stepIsMath ? 'block text-base leading-7' : undefined}>
                                                                                    <SubjectRenderer content={exStep.step} inline />
                                                                                </span>
                                                                            </span>
                                                                            <ChevronLeft
                                                                                className="shrink-0 mt-0.5 w-4 h-4 transition-transform duration-200"
                                                                                style={{
                                                                                    color: 'rgba(255,255,255,0.25)',
                                                                                    transform: isExpanded ? 'rotate(-90deg)' : 'rotate(0)',
                                                                                }}
                                                                            />
                                                                        </button>
                                                                        {isExpanded && exStep.detail && (
                                                                            <motion.div
                                                                                initial={{ opacity: 0, height: 0 }}
                                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                                exit={{ opacity: 0, height: 0 }}
                                                                                transition={{ duration: 0.25, ease: PANEL_EASE }}
                                                                                className="px-5 pb-3 pl-13"
                                                                            >
                                                                                {stepIsMath ? (
                                                                                    <p className="mb-1 text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.42)', paddingLeft: 32 }}>
                                                                                        Reasoning
                                                                                    </p>
                                                                                ) : null}
                                                                                <p className="text-sm leading-6" style={{ color: 'rgba(212,204,184,0.7)', paddingLeft: 32 }}>
                                                                                    <SubjectRenderer content={exStep.detail} inline />
                                                                                </p>
                                                                            </motion.div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Result + Takeaway */}
                                                        {(section.data.result || section.data.takeaway) && (
                                                            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(222,185,106,0.04)' }}>
                                                                {section.data.result && (
                                                                    <p className="text-sm leading-6 font-medium" style={{ color: '#e8dcc8' }}>
                                                                        <SubjectRenderer content={section.data.result} inline />
                                                                    </p>
                                                                )}
                                                                {section.data.takeaway && (
                                                                    <p className="mt-1 text-sm leading-6 italic" style={{ color: 'rgba(222,185,106,0.6)' }}>
                                                                        {section.data.takeaway}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ── Common mistakes section ── */}
                                                {section.type === 'common_mistakes' && (
                                                    <div className="space-y-2.5">
                                                        {currentCard.teaching.common_mistakes.map((mistake, mi) => (
                                                            <div
                                                                key={mi}
                                                                className="flex items-start gap-3 rounded-xl px-4 py-3"
                                                                style={{
                                                                    backgroundColor: 'rgba(213,150,120,0.08)',
                                                                    border: '1px solid rgba(213,150,120,0.15)',
                                                                }}
                                                            >
                                                                <span className="shrink-0 mt-0.5 text-sm" style={{ color: 'rgba(213,150,120,0.7)' }}>&times;</span>
                                                                <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}>
                                                                    <SubjectRenderer content={mistake} inline />
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* ── Legacy: steps ── */}
                                                {section.type === 'legacy_steps' && (
                                                    <div className="space-y-2.5">
                                                        {currentCard.teaching.steps.map((step, si) => (
                                                            <div
                                                                key={si}
                                                                className="flex items-start gap-3 rounded-xl px-4 py-3"
                                                                style={{
                                                                    backgroundColor: 'rgba(0,0,0,0.15)',
                                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                                }}
                                                            >
                                                                <span className="shrink-0 mt-0.5 text-sm font-mono" style={{ color: 'rgba(222,185,106,0.6)' }}>{si + 1}.</span>
                                                                <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}>
                                                                    <SubjectRenderer content={step} inline />
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* ── Legacy: why it matters ── */}
                                                {section.type === 'legacy_why' && (
                                                    <div>
                                                        <p className="text-sm leading-7" style={{ color: 'rgba(212,204,184,0.75)' }}>
                                                            <SubjectRenderer content={currentCard.teaching.why_it_matters} />
                                                        </p>
                                                        {currentCard.teaching.example && (
                                                            <div
                                                                className="mt-3 rounded-xl px-4 py-3"
                                                                style={{
                                                                    backgroundColor: 'rgba(0,0,0,0.15)',
                                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                                }}
                                                            >
                                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] mb-2" style={{ color: 'rgba(222,185,106,0.45)' }}>
                                                                    Example
                                                                </p>
                                                                <p className="text-sm leading-6" style={{ color: '#d4ccb8' }}>
                                                                    <SubjectRenderer content={currentCard.teaching.example} inline />
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* ── Bottom actions ── */}
                                <div
                                    className="sticky bottom-0 z-30 -mx-5 mt-8 flex flex-wrap items-center gap-3 px-5 py-3 sm:static sm:mx-0 sm:px-0 sm:py-0"
                                    style={{ backgroundColor: 'rgba(22, 48, 36, 0.97)', backdropFilter: 'blur(8px)' }}
                                >
                                    <button
                                        type="button"
                                        onClick={handleAdvanceTeach}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200"
                                        style={{
                                            backgroundColor: teachSection < teachSections.length - 1
                                                ? 'rgba(222,185,106,0.15)'
                                                : 'rgba(222,185,106,0.9)',
                                            color: teachSection < teachSections.length - 1 ? '#deb96a' : '#1a3028',
                                            border: teachSection < teachSections.length - 1 ? '1px solid rgba(222,185,106,0.25)' : 'none',
                                        }}
                                    >
                                        {onExplainSection && explainRevealed < explainTotal
                                            ? `Go on \u2192  (${explainRevealed}/${explainTotal})`
                                            : (teachSection < teachSections.length - 1
                                                ? `Continue \u2192 ${teachSections[teachSection + 1]?.label}`
                                                : 'I\u2019m ready to answer')}
                                    </button>
                                    {teachSection < teachSections.length - 1 && (
                                        <button
                                            type="button"
                                            onClick={handleBeginCheck}
                                            className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm transition-colors"
                                            style={{ color: 'rgba(212,204,184,0.45)' }}
                                        >
                                            Skip to question
                                        </button>
                                    )}
                                    <span className="flex-1" aria-hidden="true" />
                                    <button
                                        type="button"
                                        onClick={handleSaveAndLeave}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-xs transition-colors"
                                        style={{ color: 'rgba(212,204,184,0.35)' }}
                                    >
                                        Save and leave
                                    </button>
                                </div>
                            </div>
                        </div>
                        </div>
                    </motion.section>
                    ) : (
                    /* ── Legacy teach layout (old v4 cards without TOCT fields) ── */
                    <motion.section
                        data-testid="river-session-teach"
                        className="guide-perf-section mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.32, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />

                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
                                    <RiverMascot state={riverState} caption={riverCaption} />

                                    <div className="space-y-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, ease: PANEL_EASE }}
                                >
                                    <div className="rounded-[1.8rem] border p-5" style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))' }}>
                                        <p className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.8)' }}>
                                            {guideData.session_meta.river_role}
                                        </p>
                                        <h2 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold leading-tight" style={{ color: '#efe4d1' }}><SubjectRenderer content={currentConcept?.title || currentCard.prompt} /></h2>
                                        <div className="mt-4 text-base leading-7" style={{ color: 'rgba(228,219,201,0.9)' }}>
                                            <SubjectRenderer content={currentCard.teaching.explain} />
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: 0.08, ease: PANEL_EASE }}
                                >
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                                        <div className="rounded-[1.6rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Breakdown</p>
                                            <div className="mt-3 space-y-2.5">
                                                {currentCard.teaching.steps.map((step, index) => (
                                                    <div key={`${step}-${index}`} className="rounded-[1rem] border px-3 py-3 text-sm leading-6" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)', color: 'rgba(228,219,201,0.9)' }}>
                                                        <span className="mr-2" style={{ color: 'rgba(222,185,106,0.85)' }}>{index + 1}.</span>
                                                        <SubjectRenderer content={step} inline />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-[1.6rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Why it matters</p>
                                            <div className="mt-3 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}><SubjectRenderer content={currentCard.teaching.why_it_matters} /></div>
                                            <div className="mt-4 rounded-[1rem] border px-3 py-3" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(0,0,0,0.14)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Anchor example</p>
                                                <div className="mt-2 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.9)' }}><SubjectRenderer content={currentCard.teaching.example} /></div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: 0.16, ease: PANEL_EASE }}
                                >
                                <div className="rounded-[1.6rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.62)' }}>Ask River</p>
                                    <div className="mt-3 flex flex-wrap gap-2.5">
                                        {assistOptions.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => handleSelectAssist(option)}
                                                className="inline-flex min-h-[40px] items-center justify-center rounded-full border px-4 py-2 text-sm transition-colors hover:border-claude-accent/40 hover:bg-claude-accent/10"
                                                style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(228,219,201,0.9)' }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    {activeAssistOption ? (
                                        <div className="mt-4 rounded-[1.2rem] border border-claude-accent/20 bg-claude-accent/8 px-4 py-4 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.92)' }}>
                                            <SubjectRenderer content={activeAssistOption.text} />
                                        </div>
                                    ) : null}
                                </div>
                                </motion.div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={handleBeginCheck}
                                        className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                    >
                                        I'm ready to answer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAndLeave}
                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors"
                                        style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(228,219,201,0.82)' }}
                                    >
                                        Save and leave
                                    </button>
                                </div>
                            </div>
                        </div>
                            </div>
                        </div>
                    </motion.section>
                    )
                ) : null}

                {sessionStage === 'check' && currentCard ? (
                    <motion.section
                        data-testid="river-session-check"
                        className="guide-perf-section mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />

                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-5 py-6 sm:px-10 sm:py-10"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                {isMobileSession ? (
                                    <div className="space-y-4 pb-[calc(8.75rem+env(safe-area-inset-bottom,0px))]">
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: 'rgba(222,185,106,0.78)' }}>
                                                Check understanding
                                            </p>
                                            <h2 className="mt-2 text-[2rem] font-serif italic font-bold leading-[1.02]" style={{ color: '#efe4d1' }}>
                                                <SubjectRenderer content={currentCard.prompt} />
                                            </h2>
                                        </div>

                                        <MobileTeacherStrip
                                            state={riverState}
                                            caption={riverCaption}
                                            roleLabel={guideData.session_meta.river_role}
                                            stageLabel="Answer from memory"
                                            accent={poseAccent}
                                        />

                                        <div className="rounded-[1.55rem] border p-4" style={{ borderColor: `${poseAccent}42`, backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                            <div className="flex items-center justify-between gap-3">
                                                <label htmlFor="river-answer" className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.66)' }}>
                                                    Your answer
                                                </label>
                                                <span className="text-[10px] font-mono text-claude-secondary/60">
                                                    Short and clear is fine
                                                </span>
                                            </div>
                                            <textarea
                                                id="river-answer"
                                                aria-label="Your answer"
                                                value={answer}
                                                onChange={(event) => setAnswer(event.target.value)}
                                                onKeyDown={(e) => {
                                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !submitting) {
                                                        e.preventDefault();
                                                        handleSubmit();
                                                    }
                                                }}
                                                disabled={submitting}
                                                className="mt-3 min-h-[220px] w-full rounded-[1.25rem] border px-4 py-4 text-[15px] leading-7 outline-none transition-colors focus:border-claude-accent"
                                                style={{
                                                    color: '#f1e8d8',
                                                    backgroundColor: 'rgba(15, 35, 28, 0.34)',
                                                    borderColor: answer.length > 0 ? 'rgba(255,255,255,0.2)' : `${poseAccent}45`,
                                                    boxShadow: 'inset 0 1px 8px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.05)',
                                                }}
                                                placeholder="Answer from memory first."
                                            />
                                        </div>

                                        <MobileSessionActionTray>
                                            <button
                                                type="button"
                                                onClick={handleSubmit}
                                                disabled={submitting}
                                                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
                                            >
                                                {submitting ? 'Checking...' : 'Submit answer'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleShowAnswer}
                                                disabled={submitting}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium text-claude-text transition-colors disabled:opacity-60"
                                                style={{
                                                    borderColor: 'rgba(255,255,255,0.22)',
                                                    backgroundColor: 'rgba(0,0,0,0.16)',
                                                }}
                                            >
                                                Show answer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSkipForNow}
                                                disabled={submitting}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                                                style={{ color: 'rgba(228,219,201,0.78)' }}
                                            >
                                                Skip
                                            </button>
                                        </MobileSessionActionTray>
                                    </div>
                                ) : (
                                    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
                                        <RiverMascot state={riverState} caption={riverCaption} />

                                        <div className="max-w-2xl">
                                            <p className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.78)' }}>
                                                Check understanding
                                            </p>
                                            <h2 className="mt-4 text-4xl sm:text-5xl font-serif italic font-bold leading-tight" style={{ color: '#efe4d1' }}>
                                                <SubjectRenderer content={currentCard.prompt} />
                                            </h2>
                                            {riverCaption ? (
                                                <p className="mt-3 max-w-prose text-sm italic leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                                    {riverCaption}
                                                </p>
                                            ) : null}

                                            <div className="mt-8 flex items-center justify-between">
                                                <label htmlFor="river-answer" className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.66)' }}>
                                                    Your answer
                                                </label>
                                                <span className="hidden sm:block text-[10px] font-mono" style={{ color: 'rgba(222,185,106,0.3)' }}>
                                                    Ctrl/⌘+↵ to submit
                                                </span>
                                            </div>
                                            <textarea
                                                id="river-answer"
                                                aria-label="Your answer"
                                                value={answer}
                                                onChange={(event) => setAnswer(event.target.value)}
                                                onKeyDown={(e) => {
                                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !submitting) {
                                                        e.preventDefault();
                                                        handleSubmit();
                                                    }
                                                }}
                                                disabled={submitting}
                                                className="mt-3 min-h-[260px] w-full rounded-[1.4rem] border px-5 py-4 text-sm leading-7 outline-none transition-colors focus:border-claude-accent"
                                                style={{
                                                    color: '#f1e8d8',
                                                    backgroundColor: 'rgba(15, 35, 28, 0.34)',
                                                    borderColor: answer.length > 0 ? 'rgba(255,255,255,0.2)' : `${poseAccent}45`,
                                                    boxShadow: 'inset 0 1px 8px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.05)',
                                                }}
                                                placeholder="Answer from memory first."
                                            />

                                            <div
                                                className="sticky bottom-0 z-10 -mx-5 mt-5 flex flex-wrap items-center gap-3 px-5 py-3 sm:static sm:mx-0 sm:px-0 sm:py-0"
                                                style={{ backgroundColor: 'rgba(22, 48, 36, 0.97)', backdropFilter: 'blur(8px)' }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={handleSubmit}
                                                    disabled={submitting}
                                                    className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
                                                >
                                                    {submitting ? 'Checking...' : 'Submit Answer'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleShowAnswer}
                                                    disabled={submitting}
                                                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium text-claude-text transition-colors disabled:opacity-60"
                                                    style={{
                                                        borderColor: 'rgba(255,255,255,0.22)',
                                                        backgroundColor: 'rgba(0,0,0,0.16)',
                                                    }}
                                                >
                                                    Show Answer
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSkipForNow}
                                                    disabled={submitting}
                                                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                                                    style={{ color: 'rgba(228,219,201,0.78)' }}
                                                >
                                                    Skip for now
                                                </button>
                                                <span className="flex-1" aria-hidden="true" />
                                                <button
                                                    type="button"
                                                    onClick={handleSaveAndLeave}
                                                    disabled={submitting}
                                                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-xs transition-colors disabled:opacity-60"
                                                    style={{ color: 'rgba(228,219,201,0.62)' }}
                                                >
                                                    Save and leave
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {sessionStage === 'feedback' && currentCard && result ? (
                    <motion.section
                        data-testid="river-session-feedback"
                        className="guide-perf-section mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />

                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                {isMobileSession ? (
                                    <div className="space-y-4 pb-[calc(8.75rem+env(safe-area-inset-bottom,0px))]">
                                        <MobileTeacherStrip
                                            state={riverState}
                                            caption={riverCaption}
                                            roleLabel={guideData.session_meta.river_role}
                                            stageLabel={result.shouldAdvance ? 'River is confirming the idea' : 'River is coaching your next try'}
                                            accent={poseAccent}
                                        />

                                        <div
                                            className="rounded-[1.55rem] border p-4 transition-colors duration-500"
                                            style={{
                                                borderColor: `${poseAccent}48`,
                                                backgroundColor: 'rgba(0,0,0,0.16)',
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>River&apos;s response</p>
                                                {result.outcome && result.outcome !== 'revealed' ? (
                                                    <span
                                                        className="rounded-full px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em]"
                                                        style={{
                                                            color: '#efe4d1',
                                                            backgroundColor: `${poseAccent}26`,
                                                            border: `1px solid ${poseAccent}4a`,
                                                        }}
                                                    >
                                                        {result.outcome}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-3 text-base leading-7" style={{ color: 'rgba(228,219,201,0.9)' }}>{result.feedback}</p>
                                        </div>

                                        {(result.shouldAdvance || result.outcome === 'revealed') && (
                                            <div className="rounded-[1.45rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Clean answer</p>
                                                <p className="mt-3 text-base leading-7" style={{ color: 'rgba(228,219,201,0.9)' }}>{result.modelAnswer}</p>
                                            </div>
                                        )}

                                        {result.missingTags?.length ? (
                                            <div className="rounded-[1.35rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>
                                                    Hold onto these anchors
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {result.missingTags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full px-3 py-1.5 text-xs"
                                                            style={{
                                                                border: `1px solid ${poseAccent}40`,
                                                                backgroundColor: `${poseAccent}20`,
                                                                color: '#efe4d1',
                                                            }}
                                                        >
                                                            {tag.replace(/-/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}

                                        {result.followUpQuestion && !result.shouldAdvance ? (
                                            <motion.div
                                                className="rounded-[1.45rem] border p-4"
                                                style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.35, delay: 0.12, ease: PANEL_EASE }}
                                            >
                                                <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Try this angle</p>
                                                <p className="mt-3 text-base leading-7 italic" style={{ color: 'rgba(228,219,201,0.9)' }}>
                                                    {result.followUpQuestion}
                                                </p>
                                                <label
                                                    htmlFor="river-refined-answer"
                                                    className="mt-4 block text-[10px] font-mono uppercase tracking-[0.16em]"
                                                    style={{ color: 'rgba(222,185,106,0.62)' }}
                                                >
                                                    Refine your answer
                                                </label>
                                                <textarea
                                                    id="river-refined-answer"
                                                    aria-label="Refine your answer"
                                                    value={refinedAnswer}
                                                    onChange={(event) => setRefinedAnswer(event.target.value)}
                                                    disabled={submitting}
                                                    className="mt-2 min-h-[120px] w-full rounded-[1.2rem] border px-4 py-3 text-sm leading-7 outline-none transition-colors focus:border-claude-accent"
                                                    style={{
                                                        color: '#f1e8d8',
                                                        backgroundColor: 'rgba(15, 35, 28, 0.28)',
                                                        borderColor: `${poseAccent}42`,
                                                        boxShadow: 'inset 0 1px 6px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.04)',
                                                    }}
                                                    placeholder="Try again with River's hint in mind..."
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleRefinedSubmit}
                                                    disabled={submitting || !refinedAnswer.trim()}
                                                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                                                >
                                                    {submitting ? 'Checking...' : 'Submit refined answer'}
                                                </button>
                                            </motion.div>
                                        ) : null}

                                        <MobileSessionActionTray>
                                            {result.shouldAdvance ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={handleAdvance}
                                                        className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                    >
                                                        Keep going
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleReturnToTeach}
                                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors"
                                                        style={{ color: 'rgba(228,219,201,0.78)' }}
                                                    >
                                                        Review once more
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={handleTryAgain}
                                                        className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-claude-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                    >
                                                        Try again
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleAdvance}
                                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors"
                                                        style={{ borderColor: 'rgba(255,255,255,0.22)', color: 'rgba(228,219,201,0.9)', backgroundColor: 'rgba(0,0,0,0.16)' }}
                                                    >
                                                        Mark for later
                                                    </button>
                                                </>
                                            )}
                                        </MobileSessionActionTray>
                                    </div>
                                ) : (
                                    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
                                        <RiverMascot state={riverState} caption={riverCaption} />

                                        <div className="space-y-4">
                                            <div
                                                className="rounded-[1.6rem] border p-5 transition-colors duration-500"
                                                style={{
                                                    borderColor: `${poseAccent}48`,
                                                    backgroundColor: 'rgba(0,0,0,0.16)',
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>River&apos;s feedback</p>
                                                    {result.outcome && result.outcome !== 'revealed' ? (
                                                        <span
                                                            className="rounded-full px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em]"
                                                            style={{
                                                                color: '#efe4d1',
                                                                backgroundColor: `${poseAccent}26`,
                                                                border: `1px solid ${poseAccent}4a`,
                                                            }}
                                                        >
                                                            {result.outcome}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="mt-3 text-base leading-7" style={{ color: 'rgba(228,219,201,0.9)' }}>{result.feedback}</p>
                                            </div>

                                            {(result.shouldAdvance || result.outcome === 'revealed') && (
                                                <div className="rounded-[1.6rem] border p-5" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Model answer</p>
                                                    <p className="mt-3 text-base leading-7" style={{ color: 'rgba(228,219,201,0.9)' }}>{result.modelAnswer}</p>
                                                </div>
                                            )}

                                            {result.missingTags?.length ? (
                                                <div
                                                    className="rounded-[1.4rem] border p-4"
                                                    style={{
                                                        borderColor: 'rgba(255,255,255,0.16)',
                                                        backgroundColor: 'rgba(0,0,0,0.16)',
                                                    }}
                                                >
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>
                                                        Concepts to revisit
                                                    </p>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {result.missingTags.map((tag) => (
                                                            <span
                                                                key={tag}
                                                                className="rounded-full px-3 py-1.5 text-xs"
                                                                style={{
                                                                    border: `1px solid ${poseAccent}40`,
                                                                    backgroundColor: `${poseAccent}20`,
                                                                    color: '#efe4d1',
                                                                }}
                                                            >
                                                                {tag.replace(/-/g, ' ')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {result.followUpQuestion && !result.shouldAdvance ? (
                                                <motion.div
                                                    className="rounded-[1.6rem] border p-5"
                                                    style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.35, delay: 0.12, ease: PANEL_EASE }}
                                                >
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.72)' }}>River&apos;s hint</p>
                                                    <p className="mt-3 text-base leading-7 italic" style={{ color: 'rgba(228,219,201,0.9)' }}>
                                                        {result.followUpQuestion}
                                                    </p>
                                                    <label
                                                        htmlFor="river-refined-answer"
                                                        className="mt-4 block text-[10px] font-mono uppercase tracking-[0.16em]"
                                                        style={{ color: 'rgba(222,185,106,0.62)' }}
                                                    >
                                                        Refine your answer
                                                    </label>
                                                    <textarea
                                                        id="river-refined-answer"
                                                        aria-label="Refine your answer"
                                                        value={refinedAnswer}
                                                        onChange={(event) => setRefinedAnswer(event.target.value)}
                                                        disabled={submitting}
                                                        className="mt-2 min-h-[120px] w-full rounded-[1.2rem] border px-4 py-3 text-sm leading-7 outline-none transition-colors focus:border-claude-accent"
                                                        style={{
                                                            color: '#f1e8d8',
                                                            backgroundColor: 'rgba(15, 35, 28, 0.28)',
                                                            borderColor: `${poseAccent}42`,
                                                            boxShadow: 'inset 0 1px 6px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.04)',
                                                        }}
                                                        placeholder="Try again with River's hint in mind..."
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleRefinedSubmit}
                                                        disabled={submitting || !refinedAnswer.trim()}
                                                        className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                                                    >
                                                        {submitting ? 'Checking...' : 'Submit refined answer'}
                                                    </button>
                                                </motion.div>
                                            ) : null}

                                            <div className="flex flex-wrap gap-3">
                                                {result.shouldAdvance ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleAdvance}
                                                        className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                    >
                                                        Keep going
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={handleTryAgain}
                                                            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                        >
                                                            Try again
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleAdvance}
                                                            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors"
                                                            style={{ borderColor: 'rgba(255,255,255,0.22)', color: 'rgba(228,219,201,0.9)', backgroundColor: 'rgba(0,0,0,0.16)' }}
                                                        >
                                                            Mark for later
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {sessionStage === 'complete' ? (
                    <motion.section
                        data-testid="river-session-complete"
                        className="guide-perf-section mt-8"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.34, ease: PANEL_EASE }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]"
                            style={{
                                padding: 'clamp(6px, 1vw, 12px)',
                                background: 'linear-gradient(165deg, #6a4a38 0%, #5b3f31 35%, #4a3428 70%, #3a2a20 100%)',
                                boxShadow: '0 8px 34px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(96deg, transparent, transparent 8px, rgba(255,220,180,0.16) 8px, rgba(255,220,180,0.16) 9px)',
                                }}
                            />

                            <div
                                className="relative rounded-[0.5rem] sm:rounded-[0.75rem] px-6 py-6 sm:px-8 sm:py-8"
                                style={{
                                    background: 'linear-gradient(175deg, #3f6753 0%, #365a49 40%, #315042 72%, #2b483c 100%)',
                                    boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.26), inset 0 0 48px rgba(0,0,0,0.12)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035]"
                                    style={{
                                        backgroundImage: 'radial-gradient(1px 1px at 18% 28%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 44% 82%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 84% 62%, rgba(255,255,255,0.75), transparent)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]"
                                    style={{
                                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.05) 80%, transparent)',
                                    }}
                                />

                                {isMobileSession ? (
                                    <div className="space-y-4 pb-[calc(8.75rem+env(safe-area-inset-bottom,0px))]">
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: 'rgba(222,185,106,0.78)' }}>
                                                {completionIsPartial ? 'Session saved' : 'Session complete'}
                                            </p>
                                            <h1 className="mt-2 text-[2rem] font-serif italic font-bold leading-[1.02]" style={{ color: '#efe4d1' }}>
                                                {completionIsPartial ? 'Session saved' : (guideData.completion?.title || 'Session complete')}
                                            </h1>
                                        </div>

                                        <MobileTeacherStrip
                                            state={riverState}
                                            caption={riverCaption}
                                            roleLabel={guideData.session_meta.river_role}
                                            stageLabel={completionIsPartial ? 'River kept your place' : 'River is wrapping the lesson'}
                                        />

                                        <div className="rounded-[1.45rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                            <p className="text-sm leading-6" style={{ color: 'rgba(228,219,201,0.86)' }}>
                                                {completionIsPartial
                                                    ? 'River has preserved this lecture exactly where you left it.'
                                                    : (guideData.completion?.mastery_message || 'You converted recall into structure.')}
                                            </p>
                                            <p className="mt-3 text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                                {getCompleteCaption(guideData, completionPayload)}
                                            </p>
                                        </div>

                                        {completionPayload ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-[1.35rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>XP earned</p>
                                                    <p className="mt-2 font-serif italic text-5xl font-bold leading-none" style={{ color: '#efe4d1' }}>
                                                        {animatedXP}
                                                    </p>
                                                </div>
                                                <div className="rounded-[1.35rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Mastery</p>
                                                    <p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: '#efe4d1' }}>{animatedMastery}%</p>
                                                </div>
                                                <div className="col-span-2 rounded-[1.35rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Next review</p>
                                                    <p className="mt-2 text-base font-medium" style={{ color: 'rgba(228,219,201,0.92)' }}>
                                                        {completionPayload.nextReviewAt
                                                            ? new Date(completionPayload.nextReviewAt).toLocaleDateString()
                                                            : 'When you are ready'}
                                                    </p>
                                                </div>
                                                <div className="col-span-2 rounded-[1.35rem] border p-4" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Level progress</p>
                                                            <p className="mt-2 text-base font-semibold" style={{ color: '#efe4d1' }}>Level {xpProgress.level}</p>
                                                        </div>
                                                        <p className="text-sm font-mono tabular-nums" style={{ color: 'rgba(228,219,201,0.88)' }}>{xpProgress.xpTotal} total XP</p>
                                                    </div>
                                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
                                                        <div className="h-full rounded-full bg-claude-accent transition-all duration-500" style={{ width: `${xpProgress.percent}%` }} />
                                                    </div>
                                                    <p className="mt-2 text-xs leading-5" style={{ color: 'rgba(228,219,201,0.76)' }}>
                                                        {xpProgress.remaining} XP to Level {xpProgress.level + 1}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : null}

                                        <MobileSessionActionTray>
                                            {completionIsPartial ? (
                                                <button
                                                    type="button"
                                                    onClick={handleResumeFromWrapUp}
                                                    className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-claude-accent px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                >
                                                    Resume session
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleStartReviewPass}
                                                    className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-claude-accent px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                >
                                                    {reviewPassLabel}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleBackToGuides}
                                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors"
                                                style={{ borderColor: 'rgba(255,255,255,0.22)', color: 'rgba(228,219,201,0.9)' }}
                                            >
                                                Back to sessions
                                            </button>
                                        </MobileSessionActionTray>
                                    </div>
                                ) : (
                                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                                        <div>
                                            <p className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: 'rgba(222,185,106,0.78)' }}>
                                                {completionIsPartial ? 'Session saved' : 'Session complete'}
                                            </p>
                                            <h1 className="mt-3 text-3xl sm:text-4xl font-serif italic font-bold" style={{ color: '#efe4d1' }}>
                                                {completionIsPartial ? 'Session saved' : (guideData.completion?.title || 'Session complete')}
                                            </h1>
                                            <p className="mt-4 max-w-2xl text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                                {completionIsPartial
                                                    ? 'River has preserved this lecture exactly where you left it.'
                                                    : (guideData.completion?.mastery_message || 'You converted recall into structure.')}
                                            </p>
                                            <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: 'rgba(228,219,201,0.82)' }}>
                                                {getCompleteCaption(guideData, completionPayload)}
                                            </p>
                                            {completionPayload ? (
                                                <div className="mt-8 rounded-[1.4rem] border p-5" style={{ borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.16)' }}>
                                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>XP earned</p>
                                                    <p className="mt-1 font-serif italic text-7xl font-bold tabular-nums leading-none" style={{ color: '#efe4d1' }}>
                                                        {animatedXP}
                                                    </p>
                                                    <div className="mt-6 flex flex-wrap gap-8">
                                                        <div>
                                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Mastery</p>
                                                            <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: '#efe4d1' }}>{animatedMastery}%</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Next review</p>
                                                            <p className="mt-1 text-base font-medium" style={{ color: 'rgba(228,219,201,0.92)' }}>
                                                                {completionPayload.nextReviewAt
                                                                    ? new Date(completionPayload.nextReviewAt).toLocaleDateString()
                                                                    : 'When you are ready'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: 'rgba(222,185,106,0.72)' }}>Level progress</p>
                                                            <p className="mt-1 text-base font-semibold" style={{ color: '#efe4d1' }}>Level {xpProgress.level} · {xpProgress.xpTotal} total XP</p>
                                                            <p className="mt-1 text-xs" style={{ color: 'rgba(228,219,201,0.76)' }}>{xpProgress.remaining} XP to Level {xpProgress.level + 1}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/25">
                                                        <div className="h-full rounded-full bg-claude-accent transition-all duration-500" style={{ width: `${xpProgress.percent}%` }} />
                                                    </div>
                                                </div>
                                            ) : null}
                                            <div className="mt-6 flex flex-wrap gap-3">
                                                {completionIsPartial ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleResumeFromWrapUp}
                                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                    >
                                                        Resume session
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={handleStartReviewPass}
                                                        className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-claude-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                                                    >
                                                        {reviewPassLabel}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleBackToGuides}
                                                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors"
                                                    style={{ borderColor: 'rgba(255,255,255,0.22)', color: 'rgba(228,219,201,0.9)' }}
                                                >
                                                    Back to Tutor Sessions
                                                </button>
                                            </div>
                                        </div>

                                        <RiverMascot state={riverState} caption={riverCaption} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.section>
                ) : null}
            </div>
        </div>
    );
}
