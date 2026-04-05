import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
    AlertTriangle, ArrowRight, BookOpen, Check, CheckCircle2, ChevronLeft, ClipboardCheck,
    Clock3, Layers, Loader2, Menu, MessageCircle, Pencil, Play, RotateCcw, Share2, Sparkles, Trash2, X
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import TiptapEditor from '../components/editor/TiptapEditor';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import ShareToFriendModal from '../components/ShareToFriendModal';
import {
    buildShareMessageContent,
    buildSharedPreviewText,
    cloneRichTextDoc,
    serializeSharedPayload,
} from '../utils/sharedResources';
import {
    ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION,
    getGuideProgress,
    getGuideMasterySnapshot,
    getGuideStudySourceText,
    getRecommendedSession,
    getSectionMasteryScore,
    getSessionDelta,
    getSessionSections,
    getSectionStatus,
    getWeakSections,
    estimateSessionEffortMinutes,
    estimateNextReviewAt,
    normalizeGuideData,
    normalizeGuideStudyState,
} from '../utils/studyGuides';
import StudySection from '../components/StudySection.jsx';
import GuideProgressDashboard from '../components/GuideProgressDashboard.jsx';
import QuizMeMode from '../components/QuizMeMode.jsx';
import SectionEditor from '../components/SectionEditor.jsx';
import { updateSection } from '../utils/studyGuides.js';
import { UIContext } from '../context/UIContext.jsx';

const EMPTY_STUDY_STATE = {
    current_section_id: null,
    section_states: {},
    last_reviewed_at: null,
};

const DEFAULT_SECTION_STATE = {
    revealed: false,
    confidence: null,
    completed: false,
    note: '',
    last_reviewed_at: null,
};

const getSectionIndex = (sections, sectionId) => {
    const matchIndex = sections.findIndex((section) => section.id === sectionId);
    return matchIndex >= 0 ? matchIndex : 0;
};

const formatLastReviewed = (value) => {
    if (!value) return 'Not started';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not started';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getGuideSynopsis = (overview) => {
    if (!overview?.trim()) return null;

    const compactOverview = overview.trim().replace(/\s+/g, ' ');
    const firstSentence = compactOverview.match(/.*?[.!?](?=\s|$)/)?.[0]?.trim();

    if (firstSentence && firstSentence.length >= 56) return firstSentence;
    if (compactOverview.length <= 180) return compactOverview;
    return `${compactOverview.slice(0, 177).trimEnd()}...`;
};

const getKeyTermLabel = (term) => {
    if (typeof term === 'string') return term;
    if (!term || typeof term !== 'object') return '';
    if (term.definition) return `${term.term} — ${term.definition}`;
    return term.term || '';
};

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';
const QUICK_SESSION_OPTIONS = [5, 10, 20];

const formatCountLabel = (count, singular, plural = `${singular}s`) => (
    `${count} ${count === 1 ? singular : plural}`
);

const joinSectionTitles = (sections, limit = 2) => {
    const names = (sections ?? []).slice(0, limit).map((section) => section.title);
    if (names.length === 0) return 'Ready to begin';
    if (names.length === 1) return names[0];
    const remainder = (sections?.length ?? 0) - names.length;
    return `${names.join(' + ')}${remainder > 0 ? ` + ${remainder} more` : ''}`;
};

const getMatches = (query) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
};

function MobileBottomSheet({ open, title, subtitle, onClose, children, testId, opaque = false }) {
    const panelBackgroundClass = opaque ? 'bg-claude-bg/95' : '';

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/50"
                        aria-label={`Close ${title}`}
                    />
                    <motion.div
                        data-testid={testId}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                        className={`guide-sheet fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t border-claude-border px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4 shadow-2xl ${panelBackgroundClass}`}
                    >
                        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-claude-border" />
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="font-display text-xl font-bold italic text-claude-text">{title}</p>
                                {subtitle ? (
                                    <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                        {subtitle}
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="touch-target rounded-full p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action"
                                aria-label={`Close ${title}`}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="max-h-[68dvh] overflow-auto pb-safe">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function DesktopSideSheet({ open, title, subtitle, onClose, children, testId }) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
                        aria-label={`Close ${title}`}
                    />
                    <motion.aside
                        data-testid={testId}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                        className="guide-sheet fixed inset-y-0 right-0 z-50 w-full max-w-[34rem] border-l border-claude-border p-5 shadow-[0_40px_100px_-48px_rgba(0,0,0,0.92)]"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-display text-[1.75rem] font-bold italic text-claude-text">{title}</p>
                                {subtitle ? (
                                    <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                        {subtitle}
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-3"
                                aria-label={`Close ${title}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mt-6 h-[calc(100%-5rem)] overflow-y-auto pb-4">
                            {children}
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}

function SessionMetric({ label, value, accent = false }) {
    return (
        <div className={`guide-metric min-h-[84px] rounded-[1.4rem] px-4 py-4 ${accent ? 'shadow-[0_24px_60px_-36px_rgba(0,0,0,0.82)]' : ''}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">{label}</p>
            <p className={`mt-2 font-display text-[1.5rem] font-bold italic leading-none ${accent ? 'text-claude-accent' : 'text-claude-text'}`}>{value}</p>
        </div>
    );
}

const GUIDE_STATUS_META = {
    review_now: {
        label: 'Review Now',
        tone: 'guide-status-pill--danger',
        panel: 'guide-tone-danger',
    },
    coming_up: {
        label: 'Coming Up',
        tone: 'guide-status-pill--warning',
        panel: 'guide-tone-warning',
    },
    review_soon: {
        label: 'Review Soon',
        tone: 'guide-status-pill--warning',
        panel: 'guide-tone-warning',
    },
    good: {
        label: 'Good',
        tone: 'guide-status-pill--success',
        panel: 'guide-tone-success',
    },
    unstudied: {
        label: 'Not Studied',
        tone: 'guide-status-pill--danger',
        panel: 'guide-tone-neutral',
    },
};

function getGuideStatusMeta(sectionState) {
    const rawStatus = getSectionStatus(sectionState, sectionState?.last_reviewed_at ?? null);
    const status = !sectionState?.confidence ? 'unstudied' : rawStatus;
    return {
        status,
        ...(GUIDE_STATUS_META[status] || GUIDE_STATUS_META.unstudied),
    };
}

export default function GuideView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const uiCtx = useContext(UIContext);
    const noopRef = useRef(() => {});
    const setStudyMode = uiCtx?.setStudyMode ?? noopRef.current;
    const clearStudyMode = uiCtx?.clearStudyMode ?? noopRef.current;

    const [title, setTitle] = useState('');
    const [content, setContent] = useState(null);
    const [guideData, setGuideData] = useState(null);
    const [studyState, setStudyState] = useState(EMPTY_STUDY_STATE);
    const [formatVersion, setFormatVersion] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [sharingTo, setSharingTo] = useState(null);
    const [generating, setGenerating] = useState(null);
    const [transitioningWorkbook, setTransitioningWorkbook] = useState(false);
    const [isMobileLayout, setIsMobileLayout] = useState(() => getMatches(MOBILE_MEDIA_QUERY));
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showMobileSections, setShowMobileSections] = useState(false);
    const [showMobileMoreDetails, setShowMobileMoreDetails] = useState(false);
    const [showMobileNoteEditor, setShowMobileNoteEditor] = useState(false);
    const [showDesktopNoteEditor, setShowDesktopNoteEditor] = useState(false);
    const [showAskSheet, setShowAskSheet] = useState(false);
    const [askDraft, setAskDraft] = useState('');
    const [askResponse, setAskResponse] = useState('');
    const [askLoading, setAskLoading] = useState(false);
    const [sessionSummary, setSessionSummary] = useState(null);
    const [sessionSummaryLoading, setSessionSummaryLoading] = useState(false);

    const [editingSectionId, setEditingSectionId] = useState(null);

    // Session mode state — drives the new study flow for v2 guides
    // 'entry' | 'studying' | 'quiz' | 'dashboard'
    const [sessionMode, setSessionMode] = useState('entry');
    const [sessionSections, setSessionSections] = useState([]);
    const [sessionIndex, setSessionIndex] = useState(0);
    const [showOnboardingHint, setShowOnboardingHint] = useState(
        () => !localStorage.getItem('riven_guide_onboarded')
    );

    const toastRef = useRef(toast);
    const saveTimerRef = useRef(null);
    const contentRef = useRef(null);
    const titleRef = useRef('');
    const guideDataRef = useRef(null);
    const studyStateRef = useRef(EMPTY_STUDY_STATE);
    const formatVersionRef = useRef(1);
    const guideRef = useRef(null);
    const activeSaveRef = useRef(Promise.resolve(null));
    const sessionStartStateRef = useRef(null);
    const sessionRequestMetaRef = useRef({ mode: 'guided', source: 'guide_view' });
    const sessionCompletionStartedRef = useRef(false);

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

        const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
        const handleChange = (event) => {
            setIsMobileLayout(event.matches);
        };

        setIsMobileLayout(mediaQuery.matches);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, []);

    const resetGuideState = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        setTitle('');
        setContent(null);
        setGuideData(null);
        setStudyState(EMPTY_STUDY_STATE);
        setFormatVersion(1);
        setSaved(true);
        setSaving(false);
        setShowAskSheet(false);
        setAskDraft('');
        setAskResponse('');
        setAskLoading(false);
        setSessionSummary(null);
        setSessionSummaryLoading(false);

        titleRef.current = '';
        contentRef.current = null;
        guideDataRef.current = null;
        studyStateRef.current = EMPTY_STUDY_STATE;
        formatVersionRef.current = 1;
        guideRef.current = null;
        activeSaveRef.current = Promise.resolve(null);
        sessionStartStateRef.current = null;
        sessionRequestMetaRef.current = { mode: 'guided', source: 'guide_view' };
        sessionCompletionStartedRef.current = false;
    }, []);

    const loadGuide = useCallback(async (guideId, { navigateOnError = true } = {}) => {
        setLoading(true);
        resetGuideState();

        try {
            const guide = await api.getStudyGuide(guideId);
            const normalizedData = normalizeGuideData(guide.guide_data);
            const normalizedState = normalizedData
                ? normalizeGuideStudyState(normalizedData, guide.study_state)
                : EMPTY_STUDY_STATE;
            const resolvedFormatVersion = Number(guide.format_version) || 1;

            setTitle(guide.title || '');
            setContent(guide.content || {});
            setGuideData(normalizedData);
            setStudyState(normalizedState);
            setFormatVersion(resolvedFormatVersion);
            setSessionMode('entry');
            setSessionSections([]);
            setSessionIndex(0);

            titleRef.current = guide.title || '';
            contentRef.current = guide.content || {};
            guideDataRef.current = normalizedData;
            studyStateRef.current = normalizedState;
            formatVersionRef.current = resolvedFormatVersion;
            guideRef.current = guide;

            return guide;
        } catch (error) {
            if (navigateOnError) {
                toastRef.current.error('Failed to load guide');
                navigate('/guides');
            }
            throw error;
        } finally {
            setLoading(false);
            setTransitioningWorkbook(false);
        }
    }, [navigate, resetGuideState]);

    useEffect(() => {
        loadGuide(id).catch(() => {});
    }, [id, loadGuide]);

    const normalizedGuideData = useMemo(() => normalizeGuideData(guideData), [guideData]);
    const normalizedStudyState = useMemo(
        () => normalizeGuideStudyState(normalizedGuideData, studyState),
        [normalizedGuideData, studyState],
    );
    const workbookGuide = Number(formatVersion) >= ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION;
    const workbookSchemaIssue = workbookGuide && !normalizedGuideData;
    const legacyGuide = !workbookGuide;
    const progress = useMemo(
        () => getGuideProgress(normalizedGuideData, normalizedStudyState),
        [normalizedGuideData, normalizedStudyState],
    );
    const sections = useMemo(() => normalizedGuideData?.sections || [], [normalizedGuideData]);
    const activeSectionIndex = getSectionIndex(sections, normalizedStudyState.current_section_id);
    const activeSection = sections[activeSectionIndex] || null;
    const activeSectionState = activeSection
        ? normalizedStudyState.section_states[activeSection.id] || DEFAULT_SECTION_STATE
        : null;
    const nextSection = sections.find((section) => section.id === progress.nextSectionId) || activeSection || sections[0] || null;
    const sessionStarted = Boolean(normalizedStudyState.last_reviewed_at) || progress.revealedCount > 0 || progress.completedCount > 0;
    const sessionLabel = sessionStarted ? 'Resume Session' : 'Start Session';
    const sessionMessage = sessionStarted
        ? `Pick up with ${nextSection?.title || 'your next checkpoint'} and keep the review moving.`
        : `Start with ${nextSection?.title || 'Section 1'} and work through one checkpoint at a time.`;
    const workbookActionLabel = legacyGuide ? 'Convert to coach' : 'Refresh coach';
    const collectionLabel = 'Coaches';
    const displayResourceLabel = legacyGuide ? 'Legacy Guide' : 'Exam Coach';
    const displayResourceLabelLower = legacyGuide ? 'legacy guide' : 'exam coach';
    const emptyResourceMessage = legacyGuide ? 'Guide is empty' : 'Exam coach is empty';
    const deleteResourceTitle = legacyGuide ? 'Delete this legacy guide?' : 'Delete this coach?';
    const deleteResourceMessage = legacyGuide
        ? 'This legacy guide will be permanently deleted.'
        : 'This exam coach will be permanently deleted.';
    const defaultSaveTitle = legacyGuide ? 'Untitled Guide' : 'Untitled Exam Coach';
    const placeholderTitle = legacyGuide ? 'Untitled Legacy Guide' : 'Untitled Exam Coach';
    const deletedResourceMessage = legacyGuide ? 'Legacy guide deleted' : 'Exam coach deleted';
    const shareSuccessMessage = legacyGuide ? 'Legacy guide shared successfully!' : 'Exam coach shared successfully!';
    const shareErrorMessage = legacyGuide ? 'Failed to share legacy guide' : 'Failed to share exam coach';
    const generatedTitleSeed = titleRef.current || (legacyGuide ? 'Guide' : 'Exam Coach');
    const mobileProgressLabel = `${progress.completedCount}/${progress.totalSections} complete`;
    const weakSections = useMemo(
        () => getWeakSections(normalizedGuideData, normalizedStudyState),
        [normalizedGuideData, normalizedStudyState],
    );
    const recommendedSession = useMemo(
        () => getRecommendedSession(normalizedGuideData, normalizedStudyState),
        [normalizedGuideData, normalizedStudyState]
    );
    const recommendedEstimateMinutes = useMemo(
        () => estimateSessionEffortMinutes(recommendedSession.sections),
        [recommendedSession.sections],
    );
    const recommendedHeadline = useMemo(() => {
        if (recommendedSession.type === 'weak') {
            return `Review ${formatCountLabel(recommendedSession.sections.length, 'weak checkpoint')}`;
        }

        if (recommendedSession.type === 'continue') {
            return `Resume with ${nextSection?.title || 'your next checkpoint'}`;
        }

        return sessionStarted ? 'Restart a full review pass' : 'Start your first review pass';
    }, [nextSection, recommendedSession, sessionStarted]);
    const recommendedReason = useMemo(() => {
        if (recommendedSession.type === 'weak') {
            return `Fastest payoff first. ${joinSectionTitles(recommendedSession.sections)} need the most attention right now, so this run will lift recall quickest.`;
        }

        if (recommendedSession.type === 'continue') {
            return `Momentum matters. Pick up where you stopped before the material cools off and the next checkpoint turns into rereading.`;
        }

        return 'Best first move: touch every checkpoint once, reveal only after you try, and let your confidence taps shape the next session.';
    }, [recommendedSession]);
    const recommendedPrimaryLabel = useMemo(() => {
        if (recommendedSession.type === 'weak') return 'Start recommended review';
        if (recommendedSession.type === 'continue') return 'Resume coach session';
        return 'Start full review';
    }, [recommendedSession.type]);
    const coachPanelMessage = useMemo(() => {
        if (weakSections.length > 0) {
            return `Coach note: ${joinSectionTitles(weakSections)} should come before quiz mode or a full reread.`;
        }

        if (sessionStarted) {
            return `Coach note: finish ${nextSection?.title || 'the next checkpoint'} before switching modes to keep recall effort high and friction low.`;
        }

        return 'Coach note: start with one checkpoint, reveal the answer only after you try, then rate confidence honestly so the next session stays focused.';
    }, [nextSection, sessionStarted, weakSections]);
    const quickSessionChoices = useMemo(() => (
        QUICK_SESSION_OPTIONS.map((durationMinutes) => {
            const sessionSelection = getSessionSections(normalizedGuideData, normalizedStudyState, durationMinutes);
            const effectiveSections = sessionSelection.length ? sessionSelection : sections;
            return {
                durationMinutes,
                sections: effectiveSections,
                checkpointCount: effectiveSections.length,
                estimateMinutes: estimateSessionEffortMinutes(effectiveSections),
                targetLabel: joinSectionTitles(effectiveSections, 1),
            };
        })
    ), [normalizedGuideData, normalizedStudyState, sections]);
    const sectionSummaries = useMemo(() => (
        sections.map((section, index) => {
            const state = normalizedStudyState.section_states[section.id] || DEFAULT_SECTION_STATE;
            return {
                section,
                index,
                state,
                ...getGuideStatusMeta(state),
            };
        })
    ), [sections, normalizedStudyState]);
    const activeSessionSection = sessionSections[sessionIndex] ?? null;
    const activeSessionSectionState = activeSessionSection
        ? normalizedStudyState.section_states[activeSessionSection.id] ?? DEFAULT_SECTION_STATE
        : null;
    const displaySection = sessionMode === 'studying' ? activeSessionSection : activeSection;
    const displaySectionState = sessionMode === 'studying' ? activeSessionSectionState : activeSectionState;
    const displaySectionMeta = displaySectionState
        ? getGuideStatusMeta(displaySectionState)
        : GUIDE_STATUS_META.unstudied;
    const railOverview = useMemo(() => {
        const overview = normalizedGuideData?.overview;
        if (!overview) return null;
        return sessionMode === 'entry' ? overview.trim() : getGuideSynopsis(overview);
    }, [normalizedGuideData, sessionMode]);
    const hasDisplayDetails = Boolean(
        displaySection?.key_terms?.length
        || displaySection?.common_traps?.length
    );
    const hasDisplayNote = Boolean(displaySectionState?.note?.trim());
    const noteDisclosureSummary = hasDisplayNote
        ? 'Saved to this checkpoint for the next pass.'
        : 'Keep one short memory hook here when you need it.';
    const railSections = useMemo(() => {
        if (sessionMode === 'studying' && sessionSections.length > 0) {
            return sessionSections.map((sessionSection, index) => {
                const existing = sectionSummaries.find((item) => item.section.id === sessionSection.id);
                return existing
                    ? { ...existing, index }
                    : {
                        section: sessionSection,
                        index,
                        state: normalizedStudyState.section_states[sessionSection.id] || DEFAULT_SECTION_STATE,
                        ...getGuideStatusMeta(normalizedStudyState.section_states[sessionSection.id] || DEFAULT_SECTION_STATE),
                    };
            });
        }

        return sectionSummaries;
    }, [normalizedStudyState, sectionSummaries, sessionMode, sessionSections]);
    const railActiveId = sessionMode === 'studying' ? activeSessionSection?.id : activeSection?.id;
    const canGoPrevious = sessionMode === 'studying' ? sessionIndex > 0 : activeSectionIndex > 0;
    const canGoNext = sessionMode === 'studying'
        ? sessionIndex < sessionSections.length - 1
        : activeSectionIndex < sections.length - 1;
    const displaySectionPosition = sessionMode === 'studying'
        ? sessionIndex + 1
        : activeSectionIndex + 1;
    const displaySectionCount = sessionMode === 'studying'
        ? sessionSections.length
        : sections.length;

    const deriveAdaptiveSectionState = useCallback((sectionId, baseState, overrides = {}) => {
        const section = sections.find((item) => item.id === sectionId);
        if (!section) {
            return {
                ...baseState,
                ...overrides,
            };
        }

        const mergedState = {
            ...baseState,
            ...overrides,
        };
        const nextReviewAt = mergedState.next_review_at || estimateNextReviewAt(mergedState);
        const masteryScore = getSectionMasteryScore(section, {
            ...mergedState,
            next_review_at: nextReviewAt,
        });
        const currentDifficulty = masteryScore < 40 ? 'support' : masteryScore < 75 ? 'standard' : 'challenge';

        return {
            ...mergedState,
            next_review_at: nextReviewAt,
            mastery_score: masteryScore,
            current_difficulty: currentDifficulty,
        };
    }, [sections]);

    const buildFallbackSessionSummary = useCallback(() => {
        const baseline = sessionStartStateRef.current || normalizedStudyState;
        const delta = getSessionDelta(normalizedGuideData, baseline, normalizedStudyState);
        const masterySnapshot = getGuideMasterySnapshot(normalizedGuideData, normalizedStudyState);
        const weakTopicsRemaining = getWeakSections(normalizedGuideData, normalizedStudyState)
            .slice(0, 3)
            .map((section) => ({ id: section.id, title: section.title }));
        const xpEarned = Math.max(
            12,
            (delta.sectionsReviewed * 20) + Math.max(0, delta.masteryDeltaPercent * 2),
        );

        return {
            xpEarned,
            masteryDelta: delta.masteryDeltaPercent,
            weakTopicsRemaining,
            nextReviewAt: masterySnapshot.nextReviewAt,
        };
    }, [normalizedGuideData, normalizedStudyState]);

    const buildAssistFallback = useCallback((question) => {
        const helperParts = [
            displaySection?.summary,
            displaySection?.ai_helpers?.simpler ? `Simpler: ${displaySection.ai_helpers.simpler}` : null,
            displaySection?.ai_helpers?.example ? `Example: ${displaySection.ai_helpers.example}` : null,
            displaySection?.ai_helpers?.mnemonic ? `Mnemonic: ${displaySection.ai_helpers.mnemonic}` : null,
            Array.isArray(displaySection?.answer_points) && displaySection.answer_points.length > 0
                ? `Key points: ${displaySection.answer_points.slice(0, 3).join(' ')}`
                : null,
        ].filter(Boolean);

        if (helperParts.length === 0) {
            return question ? `Try restating "${question}" from memory, then compare it with the answer points above.` : '';
        }

        return `${displaySection?.title || 'This checkpoint'}: ${helperParts.join(' ')}`;
    }, [displaySection]);

    useEffect(() => {
        if (!isMobileLayout) {
            setShowMobileMenu(false);
            setShowMobileSections(false);
            setShowMobileMoreDetails(false);
            setShowMobileNoteEditor(false);
            return;
        }

        setShowDesktopNoteEditor(false);
    }, [isMobileLayout]);

    useEffect(() => {
        setShowMobileSections(false);
        setShowMobileMoreDetails(false);
        setShowMobileNoteEditor(false);
        setShowDesktopNoteEditor(false);
    }, [displaySection?.id]);

    const saveGuide = useCallback(async () => {
        setSaving(true);
        try {
            const payload = {
                title: titleRef.current || defaultSaveTitle,
            };
            const currentFormatVersion = Number(formatVersionRef.current) || 1;
            const normalizedCurrentGuideData = normalizeGuideData(guideDataRef.current);

            if (currentFormatVersion >= ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION && normalizedCurrentGuideData) {
                payload.study_state = normalizeGuideStudyState(normalizedCurrentGuideData, studyStateRef.current);
            } else if (currentFormatVersion < ACTIVE_RECALL_STUDY_GUIDE_MIN_VERSION) {
                payload.content = cloneRichTextDoc(contentRef.current);
            }

            const updatedGuide = await api.updateStudyGuide(id, payload);
            const normalizedData = normalizeGuideData(updatedGuide.guide_data ?? guideDataRef.current);
            const normalizedState = normalizedData
                ? normalizeGuideStudyState(normalizedData, updatedGuide.study_state ?? studyStateRef.current)
                : EMPTY_STUDY_STATE;
            const resolvedFormatVersion = Number(updatedGuide.format_version) || currentFormatVersion;

            guideRef.current = updatedGuide;
            setGuideData(normalizedData);
            setStudyState(normalizedState);
            setContent(updatedGuide.content || contentRef.current || {});
            setFormatVersion(resolvedFormatVersion);

            guideDataRef.current = normalizedData;
            studyStateRef.current = normalizedState;
            contentRef.current = updatedGuide.content || contentRef.current || {};
            formatVersionRef.current = resolvedFormatVersion;

            setSaved(true);
            return updatedGuide;
        } catch {
            toast.error('Failed to save');
            throw new Error('Failed to save');
        } finally {
            setSaving(false);
        }
    }, [defaultSaveTitle, id, toast]);

    const commitSave = useCallback(() => {
        saveTimerRef.current = null;
        const pendingSave = saveGuide();
        activeSaveRef.current = pendingSave;
        return pendingSave;
    }, [saveGuide]);

    const scheduleSave = useCallback(({ immediate = false } = {}) => {
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        if (immediate) {
            commitSave().catch(() => {});
            return;
        }

        saveTimerRef.current = setTimeout(() => {
            commitSave().catch(() => {});
        }, 800);
    }, [commitSave]);

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
        titleRef.current = e.target.value;
        scheduleSave();
    };

    const handleLegacyContentUpdate = useCallback((json) => {
        setContent(json);
        contentRef.current = json;
        scheduleSave();
    }, [scheduleSave]);

    const updateStudyState = useCallback((updater, { immediate = false } = {}) => {
        if (!guideDataRef.current) return;

        const currentState = normalizeGuideStudyState(guideDataRef.current, studyStateRef.current);
        const nextCandidate = typeof updater === 'function' ? updater(currentState) : updater;
        const nextState = normalizeGuideStudyState(guideDataRef.current, nextCandidate);

        setStudyState(nextState);
        studyStateRef.current = nextState;
        scheduleSave({ immediate });
    }, [scheduleSave]);

    const handleSectionReveal = useCallback((sectionId) => {
        updateStudyState((state) => ({
            ...state,
            section_states: {
                ...state.section_states,
                [sectionId]: {
                    ...state.section_states[sectionId],
                    revealed: true,
                },
            },
        }));
    }, [updateStudyState]);

    const handleConfidenceSelect = useCallback((sectionId, confidence) => {
        const now = new Date().toISOString();
        updateStudyState((state) => ({
            ...state,
            section_states: {
                ...state.section_states,
                [sectionId]: deriveAdaptiveSectionState(
                    sectionId,
                    state.section_states[sectionId],
                    {
                        confidence,
                        revealed: true,
                        last_reviewed_at: now,
                    },
                ),
            },
            last_reviewed_at: now,
        }), { immediate: true });
    }, [deriveAdaptiveSectionState, updateStudyState]);

    const allQuizQuestions = useMemo(() => (
        (normalizedGuideData?.sections ?? []).flatMap((section) => (
            (section.mini_quiz ?? []).map((item) => ({
                prompt: item.prompt,
                answer: item.answer,
                sectionId: section.id,
                sectionTitle: section.title,
            }))
        ))
    ), [normalizedGuideData]);

    const flushPendingSave = useCallback(async () => {
        if (saveTimerRef.current) {
            return commitSave();
        }

        if (saving) {
            return activeSaveRef.current;
        }

        if (!saved) {
            return commitSave();
        }

        return guideRef.current;
    }, [commitSave, saved, saving]);

    const handleSaveSection = useCallback(async (sectionId, updates) => {
        const currentGuideData = guideDataRef.current;
        const updatedGuideData = updateSection(currentGuideData, sectionId, updates);
        const normalizedNewState = normalizeGuideStudyState(updatedGuideData, studyStateRef.current);

        setGuideData(updatedGuideData);
        guideDataRef.current = updatedGuideData;
        setStudyState(normalizedNewState);
        studyStateRef.current = normalizedNewState;
        setEditingSectionId(null);

        try {
            await api.updateStudyGuide(id, { guide_data: updatedGuideData });
        } catch {
            toast.error('Failed to save section');
        }
    }, [id, toast]);

    const handleShareGuide = async () => {
        setShowShareModal(true);
        setLoadingFriends(true);
        try {
            const friendsData = await api.getFriends();
            setFriends(friendsData);
        } catch (err) {
            toast.error(err?.message || 'Failed to load friends');
        } finally {
            setLoadingFriends(false);
        }
    };

    const handleSendGuideToFriend = async (friendId) => {
        if (sharingTo) return;
        setSharingTo(friendId);
        try {
            await flushPendingSave();
            const contentSnapshot = cloneRichTextDoc(contentRef.current);

            await api.sendMessage(
                friendId,
                buildShareMessageContent(displayResourceLabelLower, titleRef.current || placeholderTitle),
                'guide',
                serializeSharedPayload({
                    kind: 'guide',
                    sourceId: id,
                    title: titleRef.current || defaultSaveTitle,
                    previewText: buildSharedPreviewText(contentSnapshot),
                })
            );

            toast.success(shareSuccessMessage);
            setShowShareModal(false);
        } catch (err) {
            toast.error(err?.message || shareErrorMessage);
        } finally {
            setSharingTo(null);
        }
    };

    const handleGenerateFlashcards = async () => {
        const text = getGuideStudySourceText({
            format_version: formatVersionRef.current,
            guide_data: guideDataRef.current,
            content: contentRef.current,
        });

        if (!text.trim()) {
            toast.error(emptyResourceMessage);
            return;
        }

        setGenerating('flashcards');
        try {
            const stream = await api.generateAiDeckStream(
                text,
                null,
                `${generatedTitleSeed} - AI`,
                guideRef.current?.class_id,
                null,
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
                    toast.success(`Generated ${event.data.card_count} flashcards!`);
                    navigate(`/deck/${event.data.deck_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate flashcards');
        } finally {
            setGenerating(null);
        }
    };

    const handleGenerateExam = async () => {
        const text = getGuideStudySourceText({
            format_version: formatVersionRef.current,
            guide_data: guideDataRef.current,
            content: contentRef.current,
        });

        if (!text.trim()) {
            toast.error(emptyResourceMessage);
            return;
        }

        setGenerating('exam');
        try {
            const stream = await api.generateAiExamStream(
                text,
                null,
                `${generatedTitleSeed} Exam`,
                'guide',
                id,
                guideRef.current?.class_id,
                null,
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
                    toast.success(`Generated ${event.data.question_count} questions!`);
                    navigate(`/exam/${event.data.exam_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate exam');
        } finally {
            setGenerating(null);
        }
    };

    const handleRegenerateWorkbook = async () => {
        const text = getGuideStudySourceText({
            format_version: formatVersionRef.current,
            guide_data: guideDataRef.current,
            content: contentRef.current,
        });

        if (!text.trim()) {
            toast.error(emptyResourceMessage);
            return;
        }

        setGenerating('guide');
        setTransitioningWorkbook(true);

        try {
            const stream = await api.generateAiGuideStream(
                text,
                null,
                titleRef.current ? `${titleRef.current} Exam Coach` : 'Untitled Exam Coach',
                guideRef.current?.note_id || null,
                guideRef.current?.class_id || null,
                null,
                id,
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
                    if (event.data.guide_id === id) {
                        await loadGuide(id, { navigateOnError: false });
                    } else {
                        navigate(`/guide/${event.data.guide_id}`);
                    }
                    toast.success('Exam coach ready!');
                    return;
                }
            }
        } catch (err) {
            setTransitioningWorkbook(false);
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to refresh coach');
        } finally {
            setGenerating(null);
        }
    };

    const handleDelete = async () => {
        try {
            await api.deleteStudyGuide(id);
            toast.success(deletedResourceMessage);
            navigate('/guides');
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    const handleSectionNoteChange = useCallback((sectionId, nextNote) => {
        if (!sectionId) return;
        updateStudyState((current) => ({
            ...current,
            section_states: {
                ...current.section_states,
                [sectionId]: {
                    ...current.section_states[sectionId],
                    note: nextNote,
                },
            },
        }));
    }, [updateStudyState]);

    const handleSelectSection = useCallback((sectionId) => {
        if (!sectionId) return;
        updateStudyState((current) => ({
            ...current,
            current_section_id: sectionId,
            last_reviewed_at: new Date().toISOString(),
        }), { immediate: true });
    }, [updateStudyState]);

    const handleSessionIndexChange = useCallback((nextIndex) => {
        if (nextIndex < 0 || nextIndex >= sessionSections.length) return;
        const nextSessionSection = sessionSections[nextIndex];
        setSessionIndex(nextIndex);
        handleSelectSection(nextSessionSection?.id);
    }, [handleSelectSection, sessionSections]);

    useEffect(() => {
        if (sessionMode === 'studying') {
            setStudyMode({
                currentIndex: sessionIndex,
                totalSections: sessionSections.length,
                onMap: () => setShowMobileSections(true),
                onStuck: () => setShowAskSheet(true),
                onEdit: () => {
                    if (displaySection?.id) {
                        setEditingSectionId(displaySection.id);
                    } else {
                        setShowMobileMoreDetails(true);
                    }
                },
                onPrev: canGoPrevious ? () => handleSessionIndexChange(sessionIndex - 1) : undefined,
                onNext: canGoNext ? () => handleSessionIndexChange(sessionIndex + 1) : undefined,
                canPrev: canGoPrevious,
                canNext: canGoNext,
                canDetails: hasDisplayDetails,
            });
        } else {
            clearStudyMode();
        }
    }, [
        sessionMode, sessionIndex, sessionSections.length,
        canGoPrevious, canGoNext, hasDisplayDetails, displaySection,
        setStudyMode, clearStudyMode,
        handleSessionIndexChange,
    ]);

    // Clear on unmount
    useEffect(() => () => clearStudyMode(), [clearStudyMode]);

    const startStudySession = useCallback((sectionList, options = {}) => {
        if (!sectionList.length) return;
        sessionStartStateRef.current = normalizedStudyState; // snapshot before session
        sessionRequestMetaRef.current = {
            mode: options.mode || 'guided',
            source: options.source || 'guide_view',
        };
        sessionCompletionStartedRef.current = false;
        setSessionSummary(null);
        setSessionSections(sectionList);
        setSessionIndex(0);
        setSessionMode('studying');
        handleSelectSection(sectionList[0].id);
    }, [handleSelectSection, normalizedStudyState]);

    const startFullSession = useCallback(() => {
        const sectionList = normalizedGuideData?.sections ?? [];
        if (!sectionList.length) return;
        startStudySession(sectionList, { mode: 'guided' });
    }, [normalizedGuideData, startStudySession]);

    const startQuickSession = useCallback((durationMinutes) => {
        const sessionSelection = getSessionSections(normalizedGuideData, normalizedStudyState, durationMinutes);
        startStudySession(
            sessionSelection.length ? sessionSelection : normalizedGuideData?.sections ?? [],
            { mode: 'guided' },
        );
    }, [normalizedGuideData, normalizedStudyState, startStudySession]);

    const startWeakSession = useCallback(() => {
        startStudySession(
            weakSections.length ? weakSections : normalizedGuideData?.sections ?? [],
            { mode: 'cram' },
        );
    }, [normalizedGuideData, startStudySession, weakSections]);

    const startQuizMode = useCallback(() => {
        sessionStartStateRef.current = normalizedStudyState;
        sessionRequestMetaRef.current = { mode: 'quiz', source: 'guide_view' };
        sessionCompletionStartedRef.current = false;
        setSessionSummary(null);
        setSessionMode('quiz');
    }, [normalizedStudyState]);

    const handleSectionComplete = useCallback((sectionId, completionStats = {}) => {
        const now = new Date().toISOString();
        updateStudyState((state) => ({
            ...state,
            section_states: {
                ...state.section_states,
                [sectionId]: deriveAdaptiveSectionState(
                    sectionId,
                    state.section_states[sectionId],
                    {
                        completed: true,
                        revealed: true,
                        last_reviewed_at: now,
                        quiz_correct: Math.max(0, Number(completionStats.quizCorrect) || 0),
                        quiz_total: Math.max(0, Number(completionStats.quizTotal) || 0),
                    },
                ),
            },
            last_reviewed_at: now,
        }));
        if (sessionIndex + 1 >= sessionSections.length) {
            setSessionMode('post-session');
        } else {
            handleSessionIndexChange(sessionIndex + 1);
        }
    }, [deriveAdaptiveSectionState, handleSessionIndexChange, sessionIndex, sessionSections.length, updateStudyState]);

    const handleQuizComplete = useCallback(() => {
        setSessionMode('post-session');
    }, []);

    const weakCoachMessage = useMemo(() => {
        if (!weakSections.length) return null;
        if (weakSections.length === 1) return `You’re weakest on ${weakSections[0].title}. Start there first.`;
        if (weakSections.length === 2) return `Focus on ${weakSections[0].title} and ${weakSections[1].title} before anything else.`;
        return `${weakSections.length} sections need review. Start with the weakest ones and keep the session tight.`;
    }, [weakSections]);

    const openAskSheet = useCallback((seedQuestion = '') => {
        setAskDraft(seedQuestion);
        setAskResponse('');
        setShowAskSheet(true);
    }, []);

    const handleAskSubmit = useCallback(async (questionOverride) => {
        const question = String(questionOverride ?? askDraft).trim();
        if (!question) return;

        setAskLoading(true);
        try {
            const response = await api.assistStudyCoach({
                guideId: id,
                guideData: guideDataRef.current,
                sectionId: displaySection?.id || null,
                question,
            });
            setAskResponse(response?.answer || buildAssistFallback(question));
        } catch {
            setAskResponse(buildAssistFallback(question));
        } finally {
            setAskLoading(false);
        }
    }, [askDraft, buildAssistFallback, displaySection?.id, id]);

    const syncSessionSummary = useCallback(async () => {
        const fallbackSummary = buildFallbackSessionSummary();
        const baseline = sessionStartStateRef.current;

        if (!baseline) {
            setSessionSummary(fallbackSummary);
            return;
        }

        setSessionSummaryLoading(true);
        try {
            const response = await api.completeStudyCoachSession({
                guideId: id,
                guideData: guideDataRef.current,
                studyStateBefore: baseline,
                studyStateAfter: studyStateRef.current,
                mode: sessionRequestMetaRef.current.mode,
                source: sessionRequestMetaRef.current.source,
                classId: guideRef.current?.class_id || null,
            });
            setSessionSummary(response || fallbackSummary);
        } catch {
            setSessionSummary(fallbackSummary);
        } finally {
            setSessionSummaryLoading(false);
        }
    }, [buildFallbackSessionSummary, id]);

    useEffect(() => {
        if (sessionMode !== 'post-session' || sessionCompletionStartedRef.current) return;
        sessionCompletionStartedRef.current = true;
        syncSessionSummary();
    }, [sessionMode, syncSessionSummary]);

    const renderPostSession = () => {
        const delta = getSessionDelta(
            normalizedGuideData,
            sessionStartStateRef.current,
            normalizedStudyState
        );
        const stillWeak = getWeakSections(normalizedGuideData, normalizedStudyState);
        const summary = sessionSummary || buildFallbackSessionSummary();
        const nextReviewLabel = summary?.nextReviewAt
            ? new Date(summary.nextReviewAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : 'Ready now';
        const highlightedWeakTopics = summary?.weakTopicsRemaining?.length
            ? summary.weakTopicsRemaining
            : stillWeak.slice(0, 3).map((section) => ({ id: section.id, title: section.title }));

        return (
            <div data-testid="post-session" className="flex flex-col gap-4">
                <div className="guide-hero rounded-[2rem] p-5 sm:p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <span className="guide-status-pill guide-status-pill--success">
                            <CheckCircle2 className="h-4 w-4" />
                            Session complete
                        </span>
                        <div>
                            <h2 className="font-display text-[1.8rem] font-bold italic leading-none text-claude-text">
                                Session Complete
                            </h2>
                            <p className="mt-2 text-sm text-claude-secondary">
                                {delta.sectionsReviewed} section{delta.sectionsReviewed !== 1 ? 's' : ''} reviewed
                            </p>
                            {sessionSummaryLoading ? (
                                <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                    Syncing session summary
                                </p>
                            ) : null}
                        </div>

                        {/* Stats row */}
                        <div className="grid w-full grid-cols-3 gap-3">
                            {[
                                { label: 'XP Earned', value: `${summary?.xpEarned || 0} XP`, accent: true },
                                { label: 'Review Due', value: nextReviewLabel },
                                { label: 'Mastery', value: summary?.masteryDelta > 0 ? `+${summary.masteryDelta}%` : '—' },
                            ].map(({ label, value, accent }) => (
                                <div key={label} className="guide-shell rounded-[1.3rem] py-3">
                                    <p className={`text-[1.3rem] font-bold ${accent ? 'text-[#86efac]' : 'text-claude-text'}`}>
                                        {value}
                                    </p>
                                    <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.1em] text-claude-secondary">
                                        {label}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Primary CTA */}
                        <div className="guide-tone-success w-full rounded-[1.4rem] p-4">
                            <p className="font-semibold text-claude-text">
                                {highlightedWeakTopics.length > 0 ? 'Keep Going — Weak Sections Remain' : 'Study Again Tomorrow'}
                            </p>
                            <p className="mt-1 text-sm text-claude-secondary">
                                {highlightedWeakTopics.length > 0
                                    ? `${highlightedWeakTopics.length} section${highlightedWeakTopics.length !== 1 ? 's' : ''} still need review`
                                    : 'Riven will remind you when sections are due'}
                            </p>
                        </div>

                        {highlightedWeakTopics.length > 0 ? (
                            <div className="guide-shell w-full rounded-[1.4rem] p-4 text-left">
                                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                    Target next
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {highlightedWeakTopics.map((topic) => (
                                        <span key={topic.id || topic.title} className="guide-status-pill guide-status-pill--warning">
                                            {topic.title}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Secondary actions */}
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => setSessionMode('entry')}
                        className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                    >
                        Back to Coach
                    </button>
                    <button
                        type="button"
                        onClick={() => setSessionMode('dashboard')}
                        className="text-center text-[12px] text-claude-secondary/60 hover:text-claude-secondary transition-colors py-2"
                    >
                        View full progress dashboard ›
                    </button>
                </div>
            </div>
        );
    };

    const renderSessionEntry = () => (
        <div data-testid="session-entry" className="flex flex-col gap-3">
            <div data-testid="entry-hero-card" className="guide-hero rounded-[2rem] p-4 sm:p-5">
                <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                                Study coach
                            </p>
                            <p className="mt-2 inline-flex max-w-full items-center gap-2 text-sm text-claude-secondary">
                                <BookOpen className="h-4 w-4 shrink-0 text-claude-accent" />
                                <span className="truncate">{title}</span>
                            </p>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-claude-secondary line-clamp-2">
                                {recommendedReason}
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <p className="font-display text-[1.5rem] font-bold italic leading-none text-claude-text">
                                {progress.completedCount}/{progress.totalSections}
                            </p>
                            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                {normalizedStudyState.last_reviewed_at
                                    ? formatLastReviewed(normalizedStudyState.last_reviewed_at)
                                    : 'Not started'}
                            </p>
                        </div>
                    </div>

                    {/* First-run hint card — only shown once */}
                    <AnimatePresence>
                        {showOnboardingHint && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-start gap-3 rounded-[1.4rem] border border-[rgba(147,197,253,0.18)] bg-[#1a1f2e] p-4">
                                    <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(147,197,253,0.18)] bg-[#101826] text-[#93c5fd]">
                                        <Sparkles className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[#93c5fd]">
                                            How this works
                                        </p>
                                        <p className="mt-1.5 text-sm leading-6 text-claude-secondary">
                                            Recall each topic from memory, then reveal the answer and rate your confidence. Riven tracks what to review next.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Dismiss hint"
                                        onClick={() => {
                                            setShowOnboardingHint(false);
                                            localStorage.setItem('riven_guide_onboarded', 'true');
                                        }}
                                        className="shrink-0 rounded-full p-1 text-[#93c5fd]/40 hover:text-[#93c5fd]/70 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Recommended CTA */}
                    <button
                        type="button"
                        data-testid="recommended-cta"
                        onClick={() => {
                            if (recommendedSession.type === 'weak') startWeakSession();
                            else if (recommendedSession.type === 'continue') startStudySession(recommendedSession.sections);
                            else startFullSession();
                        }}
                        className="guide-tone-success guide-focus-ring rounded-[1.4rem] p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                    >
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#86efac]">
                            Recommended
                        </p>
                        <p className="mt-1.5 font-display text-[1.4rem] font-bold italic leading-none text-claude-text">
                            {recommendedHeadline}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="guide-status-pill guide-status-pill--neutral">
                                <Clock3 className="h-3.5 w-3.5" />
                                {recommendedEstimateMinutes > 0 ? `~${recommendedEstimateMinutes} min` : 'Ready now'}
                            </span>
                            <span className="guide-status-pill guide-status-pill--neutral">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {formatCountLabel(recommendedSession.sections.length, 'checkpoint')}
                            </span>
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 rounded-[1rem] bg-[#22c55e] py-2.5 text-black">
                            <span className="text-[13px] font-bold">{recommendedPrimaryLabel}</span>
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    </button>

                    <div className="guide-shell rounded-[1.4rem] p-3 sm:p-4">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                            Quick session
                        </p>
                        <div data-testid="checkpoint-chip-row" className="mt-2.5 grid grid-cols-3 gap-2">
                            {quickSessionChoices.map((option) => (
                                <button
                                    key={option.durationMinutes}
                                    type="button"
                                    onClick={() => startQuickSession(option.durationMinutes)}
                                    className="guide-chip guide-focus-ring rounded-[1.1rem] px-3 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5"
                                >
                                    <p className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                        {option.durationMinutes} min
                                    </p>
                                    <p className="mt-1.5 text-xs font-medium text-claude-text">
                                        {formatCountLabel(option.checkpointCount, 'checkpoint')}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={`grid gap-2 ${allQuizQuestions.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <button
                            type="button"
                            onClick={startFullSession}
                            className="guide-shell guide-focus-ring rounded-[1.2rem] p-3 text-left hover:-translate-y-0.5 transition-transform duration-200"
                        >
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">Full</p>
                            <p className="mt-1.5 text-xs font-medium text-claude-text">{sessionLabel}</p>
                        </button>

                        {allQuizQuestions.length > 0 ? (
                            <button
                                type="button"
                                onClick={startQuizMode}
                                className="guide-shell guide-focus-ring rounded-[1.2rem] p-3 text-left hover:-translate-y-0.5 transition-transform duration-200"
                            >
                                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">Quiz</p>
                                <p className="mt-1.5 text-xs font-medium text-claude-text">{formatCountLabel(allQuizQuestions.length, 'prompt')}</p>
                            </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={() => setSessionMode('dashboard')}
                            className="guide-shell guide-focus-ring rounded-[1.2rem] p-3 text-left hover:-translate-y-0.5 transition-transform duration-200"
                        >
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">Progress</p>
                            <p className="mt-1.5 text-xs font-medium text-claude-text">{progress.completionPercent}%</p>
                        </button>
                    </div>

                    <div className={`flex items-start gap-2.5 rounded-[1.2rem] px-3 py-3 ${weakSections.length > 0 ? 'guide-tone-warning' : 'guide-tone-neutral'}`}>
                        {weakSections.length > 0 ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
                        <p className="text-sm leading-6 text-claude-text">
                            {coachPanelMessage}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStudying = () => {
        if (!activeSessionSection) return null;
        return (
            <div data-testid="session-studying" className="flex flex-col gap-5">
                <div
                    data-testid={isMobileLayout ? 'mobile-focus-shell' : 'desktop-focus-shell'}
                    className="guide-stage rounded-[2rem] p-4 sm:p-5 xl:p-6"
                >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setSessionMode('entry')}
                            className="guide-cta guide-cta--ghost guide-focus-ring"
                        >
                            <span>Exit session</span>
                        </button>
                        <span className={`guide-status-pill ${displaySectionMeta.tone}`}>
                            {displaySectionMeta.label}
                        </span>
                    </div>

                    <StudySection
                        section={activeSessionSection}
                        sectionState={activeSessionSectionState}
                        onReveal={() => handleSectionReveal(activeSessionSection.id)}
                        onConfidenceSelect={(confidence) => handleConfidenceSelect(activeSessionSection.id, confidence)}
                        onComplete={(completionStats) => handleSectionComplete(activeSessionSection.id, completionStats)}
                        sectionIndex={sessionIndex}
                        sectionCount={sessionSections.length}
                        canGoPrevious={canGoPrevious}
                        canGoNext={canGoNext}
                        onPrevious={() => handleSessionIndexChange(sessionIndex - 1)}
                        onNext={() => handleSessionIndexChange(sessionIndex + 1)}
                        onEdit={() => setEditingSectionId(activeSessionSection.id)}
                        onAsk={() => openAskSheet()}
                    />
                </div>
            </div>
        );
    };

    const renderDashboard = () => (
        <div data-testid="session-dashboard" className="flex flex-col gap-5">
            <div className="guide-stage rounded-[2rem] p-4 sm:p-5 xl:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                            Workbook progress
                        </p>
                        <p className="mt-2 text-sm leading-6 text-claude-secondary">
                            Review the weak spots, edit fuzzy sections, then jump back into the next focused run.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSessionMode('entry')}
                        className="guide-cta guide-cta--ghost guide-focus-ring shrink-0"
                    >
                        <span>Back</span>
                    </button>
                </div>
                <GuideProgressDashboard
                    guideData={normalizedGuideData}
                    studyState={normalizedStudyState}
                    onStartWeakSession={startWeakSession}
                    onEditSection={setEditingSectionId}
                />
            </div>
        </div>
    );

    const renderQuiz = () => (
        <div data-testid="session-quiz" className="flex flex-col gap-5">
            <div className="guide-stage rounded-[2rem] p-4 sm:p-5 xl:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                            Quiz Me
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSessionMode('entry')}
                        className="guide-cta guide-cta--ghost guide-focus-ring shrink-0"
                    >
                        <span>Exit quiz</span>
                    </button>
                </div>
                <QuizMeMode questions={allQuizQuestions} onComplete={handleQuizComplete} />
            </div>
        </div>
    );

    const renderDesktopRail = () => (
        <aside
            data-testid="desktop-guide-rail"
            className="guide-rail rounded-[2rem] p-4 sm:p-5 lg:sticky lg:top-[calc(var(--safe-area-top)+0.9rem)] lg:row-span-2 lg:max-h-[calc(100dvh-var(--safe-area-top)-2rem)] lg:overflow-hidden 2xl:row-span-1"
        >
            <div className="flex h-full flex-col gap-4">
                <div className="shrink-0">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                        Workbook
                    </p>
                    <h1 className="mt-3 font-display text-[1.85rem] font-bold italic leading-[0.96] text-claude-text xl:text-[2.05rem]">
                        {title}
                    </h1>
                    {railOverview ? (
                        <div className="mt-4">
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                {sessionMode === 'entry' ? 'Workbook overview' : 'Session synopsis'}
                            </p>
                            <p
                                data-testid="desktop-rail-overview"
                                className={`mt-2 max-w-[28rem] text-[0.94rem] leading-[1.6] text-claude-secondary ${sessionMode === 'entry' ? '' : 'guide-clamp-4'}`}
                            >
                                {railOverview}
                            </p>
                        </div>
                    ) : null}
                </div>

                <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <SessionMetric label="Complete" value={`${progress.completionPercent}%`} accent />
                    <SessionMetric label="Weak Spots" value={weakSections.length} />
                </div>

                <div className="shrink-0 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setSessionMode('entry')}
                            className={`guide-chip guide-focus-ring min-h-[44px] rounded-[1.15rem] px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] transition-all ${sessionMode === 'entry' ? 'border-claude-accent/40 text-claude-accent' : 'text-claude-secondary'}`}
                        >
                            Overview
                        </button>
                        <button
                            type="button"
                            onClick={() => setSessionMode('dashboard')}
                            className={`guide-chip guide-focus-ring min-h-[44px] rounded-[1.15rem] px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] transition-all ${sessionMode === 'dashboard' ? 'border-claude-accent/40 text-claude-accent' : 'text-claude-secondary'}`}
                        >
                            Progress
                        </button>
                        {allQuizQuestions.length > 0 ? (
                            <button
                                type="button"
                                onClick={startQuizMode}
                                className={`guide-chip guide-focus-ring min-h-[44px] rounded-[1.15rem] px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] transition-all ${sessionMode === 'quiz' ? 'border-claude-accent/40 text-claude-accent' : 'text-claude-secondary'}`}
                            >
                                Quiz
                            </button>
                        ) : null}
                    </div>

                    <div className="grid gap-3">
                        <button
                            type="button"
                            onClick={startFullSession}
                            className="guide-cta guide-cta--primary guide-focus-ring w-full"
                        >
                            <Play className="h-4 w-4" />
                            <span>{sessionLabel}</span>
                        </button>
                        <button
                            type="button"
                            onClick={startWeakSession}
                            className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                        >
                            <Sparkles className="h-4 w-4" />
                            <span>Review Weak Sections</span>
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            Checkpoints
                        </p>
                        <span className="guide-status-pill guide-status-pill--neutral">
                            {railSections.length}
                        </span>
                    </div>
                    <div className="mt-3 space-y-2 overflow-y-auto pr-1">
                        {railSections.map((item) => (
                            <button
                                key={item.section.id}
                                type="button"
                                onClick={() => (
                                    sessionMode === 'studying'
                                        ? handleSessionIndexChange(item.index)
                                        : handleSelectSection(item.section.id)
                                )}
                                className={`w-full rounded-[1.3rem] p-3.5 text-left transition-all duration-200 ${
                                    railActiveId === item.section.id
                                        ? `${item.panel} shadow-[0_20px_50px_-34px_rgba(0,0,0,0.82)]`
                                        : 'guide-tone-neutral hover:border-claude-accent/20'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                            Section {item.index + 1}
                                        </p>
                                        <p className="mt-1.5 text-[0.95rem] font-medium leading-[1.4] text-claude-text">
                                            {item.section.title}
                                        </p>
                                    </div>
                                    <span className={`guide-status-pill ${item.tone}`}>{item.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );

    const renderDesktopContext = () => {
        const contextShellClassName = 'guide-rail rounded-[2rem] p-4 sm:p-5 lg:col-start-2 lg:row-start-2 2xl:col-start-3 2xl:row-start-1 2xl:sticky 2xl:top-[calc(var(--safe-area-top)+0.9rem)] 2xl:max-h-[calc(100dvh-var(--safe-area-top)-2rem)] 2xl:overflow-hidden';
        const contextBodyClassName = 'flex h-full flex-col gap-4 2xl:overflow-y-auto 2xl:pr-1';

        if (sessionMode === 'dashboard') {
            return (
                <aside data-testid="desktop-guide-context" className={contextShellClassName}>
                    <div className={contextBodyClassName}>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                            Next move
                        </p>
                        <h2 className="font-display text-[1.65rem] font-bold italic leading-none text-claude-text">
                            Coach Notes
                        </h2>
                        <p className="text-[0.95rem] leading-[1.6] text-claude-secondary">
                            {weakCoachMessage || 'You are in a strong spot. Use the dashboard to decide whether to tighten a section or run a quiz.'}
                        </p>
                        <div className="grid gap-3">
                            <button
                                type="button"
                                onClick={startWeakSession}
                                className="guide-cta guide-cta--primary guide-focus-ring w-full"
                            >
                                <Sparkles className="h-4 w-4" />
                                <span>Review Weak</span>
                            </button>
                            <button
                                type="button"
                                onClick={startQuizMode}
                                disabled={allQuizQuestions.length === 0}
                                className="guide-cta guide-cta--secondary guide-focus-ring w-full disabled:opacity-40"
                            >
                                <ClipboardCheck className="h-4 w-4" />
                                <span>Quiz Me</span>
                            </button>
                        </div>
                    </div>
                </aside>
            );
        }

        if (sessionMode === 'quiz') {
            return (
                <aside data-testid="desktop-guide-context" className={contextShellClassName}>
                    <div className={contextBodyClassName}>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                            Quiz context
                        </p>
                        <h2 className="font-display text-[1.65rem] font-bold italic leading-none text-claude-text">
                            Speed over comfort
                        </h2>
                        <p className="text-[0.95rem] leading-[1.6] text-claude-secondary">
                            Reveal only after you answer mentally. This mode is for pressure-testing retrieval, not rereading.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                            <SessionMetric label="Prompts" value={allQuizQuestions.length} accent />
                            <SessionMetric label="Weak Sections" value={weakSections.length} />
                        </div>
                    </div>
                </aside>
            );
        }

        return (
            <aside data-testid="desktop-guide-context" className={contextShellClassName}>
                <div className={contextBodyClassName}>
                    <div className="guide-sheet rounded-[1.7rem] p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                    Coach notes
                                </p>
                                <h2 className="mt-3 font-display text-[1.65rem] font-bold italic leading-[1.02] text-claude-text">
                                    {displaySection?.title || 'Session companion'}
                                </h2>
                            </div>
                            {displaySection ? (
                                <span className={`guide-status-pill ${displaySectionMeta.tone}`}>{displaySectionMeta.label}</span>
                            ) : null}
                        </div>

                        <p className="mt-4 max-w-[30rem] text-[0.95rem] leading-[1.6] text-claude-secondary">
                            {displaySection?.recall_prompt || weakCoachMessage || sessionMessage}
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={weakSections.length > 0 ? startWeakSession : startFullSession}
                                className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                            >
                                <Sparkles className="h-4 w-4" />
                                <span>{weakSections.length > 0 ? 'Review weak' : 'Start review'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={startQuizMode}
                                disabled={allQuizQuestions.length === 0}
                                className="guide-cta guide-cta--ghost guide-focus-ring w-full disabled:opacity-40"
                            >
                                <ClipboardCheck className="h-4 w-4" />
                                <span>Quiz me</span>
                            </button>
                        </div>

                        {displaySection?.key_terms?.length ? (
                            <div className="guide-tone-neutral mt-4 rounded-[1.35rem] p-3.5">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                        Key terms
                                    </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {displaySection.key_terms.map((term) => (
                                        <span key={getKeyTermLabel(term)} className="guide-status-pill guide-status-pill--neutral">
                                            {getKeyTermLabel(term)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {displaySection?.common_traps?.length ? (
                            <div className="guide-tone-warning mt-4 rounded-[1.35rem] p-3.5">
                                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                                    Common traps
                                </p>
                                <div className="mt-3 space-y-1.5 text-[0.95rem] leading-[1.6] text-claude-text">
                                    {displaySection.common_traps.map((trap) => (
                                        <p key={trap}>{trap}</p>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="guide-divider my-4" />

                        <div data-testid="desktop-note-module" className="guide-tone-neutral rounded-[1.4rem] p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                    Study note
                                </p>
                                <p className="mt-2 max-w-[28rem] text-sm leading-6 text-claude-secondary">
                                    {noteDisclosureSummary}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDesktopNoteEditor((current) => !current)}
                                    data-testid="desktop-note-toggle"
                                    className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                                >
                                    <span>{showDesktopNoteEditor ? 'Done' : hasDisplayNote ? 'Edit note' : 'Add note'}</span>
                                </button>
                                {displaySection ? (
                                    <button
                                        type="button"
                                        onClick={() => setEditingSectionId(displaySection.id)}
                                        className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        <span>Edit section</span>
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {showDesktopNoteEditor ? (
                            <textarea
                                data-testid="desktop-note-textarea"
                                aria-label="Study note"
                                value={displaySectionState?.note ?? ''}
                                onChange={(event) => handleSectionNoteChange(displaySection?.id, event.target.value)}
                                placeholder="Capture a contrast, mnemonic, or the one thing you keep missing."
                                className="mt-4 min-h-[96px] w-full resize-none rounded-[1.15rem] border border-white/10 bg-black/10 px-4 py-3.5 text-[0.95rem] leading-6 text-claude-text placeholder:text-claude-secondary/65 focus:outline-none focus:ring-1 focus:ring-claude-accent"
                            />
                        ) : hasDisplayNote ? (
                            <div className="guide-tone-neutral mt-4 rounded-[1.15rem] p-4">
                                <p className="whitespace-pre-wrap text-[0.95rem] leading-6 text-claude-text">
                                    {displaySectionState.note}
                                </p>
                            </div>
                        ) : (
                            <div className="guide-tone-neutral mt-4 rounded-[1.15rem] p-4">
                                <p className="text-sm leading-6 text-claude-secondary">
                                    Capture a contrast, mnemonic, or one thing you keep missing.
                                </p>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </aside>
        );
    };

    if (transitioningWorkbook) {
        return (
            <div className="min-h-dvh safe-area-top safe-area-bottom px-4 py-8 sm:py-16">
                <div className="guide-hero mx-auto flex max-w-2xl flex-col items-center rounded-[2.2rem] p-8 text-center">
                    <div className="guide-status-pill guide-status-pill--warning">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        Building
                    </div>
                    <p className="mt-6 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent">Coach Upgrade</p>
                    <h1 className="mt-3 font-display text-3xl font-bold italic text-claude-text">Converting guide into Exam Coach</h1>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-claude-secondary">
                        Rebuilding this guide into a checkpoint-by-checkpoint coaching session with reveal-first answers,
                        confidence tracking, and resume progress.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-claude-accent animate-spin" />
            </div>
        );
    }

    if (workbookSchemaIssue) {
        return (
            <div className="relative min-h-screen safe-area-bottom pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
                <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
                <ConfirmModal
                    isOpen={deleteConfirm}
                    title={deleteResourceTitle}
                    message={deleteResourceMessage}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(false)}
                />

                <div className="safe-area-top sticky top-0 z-30 border-b border-claude-border/10 bg-claude-bg/85 px-4 py-3 backdrop-blur-md">
                    <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
                        <button onClick={() => navigate('/guides')} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                            <ChevronLeft className="w-5 h-5" />
                            <span>{collectionLabel}</span>
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="guide-status-pill guide-status-pill--neutral">
                                {saving ? (
                                    <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                                ) : saved ? (
                                    <Check className="w-3.5 h-3.5 text-claude-accent" />
                                ) : null}
                                <span>{saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}</span>
                            </div>
                            <button onClick={() => setDeleteConfirm(true)} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mx-auto max-w-3xl px-4 pt-8">
                    <div className="guide-hero rounded-[2.1rem] p-6 sm:p-8">
                        <div className="guide-status-pill guide-status-pill--warning">
                            <AlertTriangle className="h-4 w-4" />
                            Repair Required
                        </div>
                        <p className="mt-5 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent">Exam Coach Needs Refresh</p>
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder={placeholderTitle}
                            className="mt-3 w-full bg-transparent text-3xl font-display font-bold italic tracking-tight leading-tight text-claude-text outline-none placeholder:text-claude-secondary/30 sm:text-4xl"
                        />
                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-claude-secondary">
                            This guide is marked as an Exam Coach, but its study sections are missing. Refresh it to restore
                            the guided coaching session, checkpoints, and confidence tracking.
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <button
                                type="button"
                                onClick={handleRegenerateWorkbook}
                                disabled={!!generating}
                                className="guide-cta guide-cta--primary guide-focus-ring w-full disabled:opacity-50 sm:w-auto"
                            >
                                {generating === 'guide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                {generating === 'guide' ? 'Refreshing coach' : 'Refresh coach'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/guides')}
                                className="guide-cta guide-cta--secondary guide-focus-ring w-full sm:w-auto"
                            >
                                Back to coaches
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (legacyGuide) {
        return (
            <div className="relative min-h-screen safe-area-bottom pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
                <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
                <ConfirmModal
                    isOpen={deleteConfirm}
                    title={deleteResourceTitle}
                    message={deleteResourceMessage}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(false)}
                />
                <ShareToFriendModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    friends={friends}
                    loading={loadingFriends}
                    sendingTo={sharingTo}
                    onSend={handleSendGuideToFriend}
                    resourceLabel={displayResourceLabel}
                    resourceTitle={title || placeholderTitle}
                />

                <div className="safe-area-top sticky top-0 z-30 border-b border-claude-border/10 bg-claude-bg/80 px-4 pt-3 pb-2 backdrop-blur-md">
                    <div className="mx-auto mb-2 flex max-w-4xl items-center justify-between gap-3">
                        <button onClick={() => navigate('/guides')} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                            <ChevronLeft className="w-5 h-5" />
                            <span>{collectionLabel}</span>
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="guide-status-pill guide-status-pill--neutral">
                                {saving ? (
                                    <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                                ) : saved ? (
                                    <Check className="w-3.5 h-3.5 text-claude-accent" />
                                ) : null}
                                <span>{saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}</span>
                            </div>
                            <button onClick={handleShareGuide} className="guide-cta guide-cta--ghost guide-focus-ring px-3" aria-label="Share legacy guide">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(true)} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="mx-auto flex max-w-4xl items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={handleRegenerateWorkbook}
                            disabled={!!generating}
                            className="guide-cta guide-cta--secondary guide-focus-ring shrink-0 disabled:opacity-50"
                        >
                            {generating === 'guide' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            <span>{generating === 'guide' ? 'Building coach' : workbookActionLabel}</span>
                        </button>

                        <button
                            onClick={handleGenerateFlashcards}
                            disabled={!!generating}
                            className="guide-cta guide-cta--secondary guide-focus-ring shrink-0 disabled:opacity-50"
                        >
                            {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                            <span>Flashcards</span>
                        </button>

                        <button
                            onClick={handleGenerateExam}
                            disabled={!!generating}
                            className="guide-cta guide-cta--secondary guide-focus-ring shrink-0 disabled:opacity-50"
                        >
                            {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                            <span>Mock Exam</span>
                        </button>
                    </div>
                </div>

                <div className="mx-auto max-w-4xl px-4 pt-6">
                    <div className="guide-hero mb-5 rounded-[2rem] p-5 sm:p-6">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent mb-2">Legacy Guide</p>
                        <p className="text-sm leading-6 text-claude-secondary">
                            This guide is still a document. Convert it into Exam Coach to get one-checkpoint-at-a-time
                            review, checkpoint reveals, confidence tracking, and resume progress.
                        </p>
                        <button
                            type="button"
                            onClick={handleRegenerateWorkbook}
                            disabled={!!generating}
                            className="guide-cta guide-cta--primary guide-focus-ring mt-4 w-full disabled:opacity-50 sm:w-auto"
                        >
                            {generating === 'guide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            {generating === 'guide' ? 'Building coach' : 'Convert guide to coach'}
                        </button>
                    </div>

                    <div className="guide-shell rounded-[2rem] p-5 sm:p-6">
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder={placeholderTitle}
                            className="mb-4 w-full bg-transparent text-3xl font-display font-bold italic tracking-tight leading-tight text-claude-text outline-none placeholder:text-claude-secondary/30 sm:text-4xl"
                        />

                        <TiptapEditor
                            content={content}
                            onUpdate={handleLegacyContentUpdate}
                            editable={true}
                            placeholder="Your legacy guide content..."
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            data-testid="guide-screen"
            className="relative min-h-screen safe-area-bottom pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]"
        >
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm}
                title={deleteResourceTitle}
                message={deleteResourceMessage}
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm(false)}
            />
            <ShareToFriendModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                friends={friends}
                loading={loadingFriends}
                sendingTo={sharingTo}
                onSend={handleSendGuideToFriend}
                resourceLabel={displayResourceLabel}
                resourceTitle={title || placeholderTitle}
            />

            {isMobileLayout ? (
                <div className="safe-area-top sticky top-0 z-30 px-4 py-3">
                    <div className="mobile-top-nav-glass rounded-[1.6rem] border border-claude-border px-4 py-3">
                        <div className="mx-auto flex max-w-5xl items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/guides')}
                                className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-3"
                                aria-label="Back to coaches"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>

                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Exam Coach</p>
                                <p className="truncate text-sm font-medium text-claude-text">{displaySection?.title || title || 'Exam coach'}</p>
                                <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                    {mobileProgressLabel}
                                    {displaySection ? ` • Section ${displaySectionPosition}/${Math.max(displaySectionCount, 1)}` : ''}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowMobileMenu(true)}
                                className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-3"
                                aria-label="More coach actions"
                            >
                                <Menu className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="safe-area-top sticky top-0 z-30 pb-3">
                    <div data-testid="desktop-guide-toolbar" className="guide-shell flex w-full items-center justify-between gap-4 rounded-[1.7rem] px-4 py-3.5 sm:px-5">
                        <button onClick={() => navigate('/guides')} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                            <ChevronLeft className="w-5 h-5" />
                            <span>{collectionLabel}</span>
                        </button>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="guide-status-pill guide-status-pill--neutral">
                                {saving ? (
                                    <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                                ) : saved ? (
                                    <Check className="w-3.5 h-3.5 text-claude-accent" />
                                ) : null}
                                <span>{saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}</span>
                            </div>
                            <button onClick={handleShareGuide} className="guide-cta guide-cta--ghost guide-focus-ring px-3" aria-label="Share coach">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(true)} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={isMobileLayout ? 'px-4 pt-4' : 'pt-3'}>
                {isMobileLayout ? (
                    <>
                        {sessionMode === 'entry' && renderSessionEntry()}
                        {sessionMode === 'studying' && renderStudying()}
                        {sessionMode === 'quiz' && renderQuiz()}
                        {sessionMode === 'post-session' && renderPostSession()}
                        {sessionMode === 'dashboard' && renderDashboard()}
                    </>
                ) : (
                    <div
                        data-testid="workbook-shell-grid"
                        data-desktop-layout="adaptive"
                        className="grid gap-5 lg:grid-cols-[minmax(17rem,18.75rem)_minmax(0,1fr)] xl:gap-6 2xl:grid-cols-[minmax(17rem,18.75rem)_minmax(0,1.15fr)_minmax(18rem,20rem)] 2xl:items-start"
                    >
                        {renderDesktopRail()}
                        <div data-testid="desktop-guide-stage" className="min-w-0 lg:col-start-2 lg:row-start-1">
                            {sessionMode === 'entry' && renderSessionEntry()}
                            {sessionMode === 'studying' && renderStudying()}
                            {sessionMode === 'quiz' && renderQuiz()}
                            {sessionMode === 'post-session' && renderPostSession()}
                            {sessionMode === 'dashboard' && renderDashboard()}
                        </div>
                        {renderDesktopContext()}
                    </div>
                )}
            </div>

            {editingSectionId && (() => {
                const sectionToEdit = normalizedGuideData?.sections.find((section) => section.id === editingSectionId);
                if (!sectionToEdit) return null;

                if (isMobileLayout) {
                    return (
                        <MobileBottomSheet
                            open
                            title="Edit Section"
                            subtitle={sectionToEdit.title}
                            onClose={() => setEditingSectionId(null)}
                            testId="mobile-edit-sheet"
                            opaque
                        >
                            <SectionEditor
                                section={sectionToEdit}
                                onSave={(updates) => handleSaveSection(editingSectionId, updates)}
                                onCancel={() => setEditingSectionId(null)}
                            />
                        </MobileBottomSheet>
                    );
                }

                return (
                    <DesktopSideSheet
                        open
                        title="Edit Section"
                        subtitle={sectionToEdit.title}
                        onClose={() => setEditingSectionId(null)}
                        testId="desktop-edit-sheet"
                    >
                        <SectionEditor
                            section={sectionToEdit}
                            onSave={(updates) => handleSaveSection(editingSectionId, updates)}
                            onCancel={() => setEditingSectionId(null)}
                        />
                    </DesktopSideSheet>
                );
            })()}

            {showAskSheet ? (
                isMobileLayout ? (
                    <MobileBottomSheet
                        open
                        title="Ask coach"
                        subtitle={displaySection?.title || 'Current checkpoint'}
                        onClose={() => setShowAskSheet(false)}
                        testId="study-ask-sheet"
                    >
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleAskSubmit(`Explain ${displaySection?.title || 'this topic'} in simpler terms.`)}
                                    className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                                >
                                    Explain simpler
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAskSubmit(`Give me one concrete example for ${displaySection?.title || 'this topic'}.`)}
                                    className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                                >
                                    Show example
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAskSubmit(`Give me a mnemonic for ${displaySection?.title || 'this topic'}.`)}
                                    className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                                >
                                    Mnemonic
                                </button>
                            </div>
                            <label className="block">
                                <span className="sr-only">Ask a follow-up</span>
                                <textarea
                                    aria-label="Ask a follow-up"
                                    value={askDraft}
                                    onChange={(event) => setAskDraft(event.target.value)}
                                    placeholder="Ask a follow-up about this checkpoint."
                                    className="min-h-[140px] w-full resize-none rounded-[1.3rem] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-6 text-claude-text placeholder:text-claude-secondary/65 focus:outline-none focus:ring-1 focus:ring-claude-accent"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => handleAskSubmit()}
                                disabled={askLoading || !askDraft.trim()}
                                className="guide-cta guide-cta--primary guide-focus-ring w-full disabled:opacity-50"
                            >
                                {askLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                                <span>Send question</span>
                            </button>
                            {askResponse ? (
                                <div className="guide-tone-success rounded-[1.3rem] p-4">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                                        Coach answer
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-claude-text">{askResponse}</p>
                                </div>
                            ) : null}
                        </div>
                    </MobileBottomSheet>
                ) : (
                    <DesktopSideSheet
                        open
                        title="Ask coach"
                        subtitle={displaySection?.title || 'Current checkpoint'}
                        onClose={() => setShowAskSheet(false)}
                        testId="study-ask-sheet"
                    >
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleAskSubmit(`Explain ${displaySection?.title || 'this topic'} in simpler terms.`)}
                                    className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                                >
                                    Explain simpler
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAskSubmit(`Give me one concrete example for ${displaySection?.title || 'this topic'}.`)}
                                    className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                                >
                                    Show example
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAskSubmit(`Give me a mnemonic for ${displaySection?.title || 'this topic'}.`)}
                                    className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                                >
                                    Mnemonic
                                </button>
                            </div>
                            <label className="block">
                                <span className="sr-only">Ask a follow-up</span>
                                <textarea
                                    aria-label="Ask a follow-up"
                                    value={askDraft}
                                    onChange={(event) => setAskDraft(event.target.value)}
                                    placeholder="Ask a follow-up about this checkpoint."
                                    className="min-h-[180px] w-full resize-none rounded-[1.3rem] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-6 text-claude-text placeholder:text-claude-secondary/65 focus:outline-none focus:ring-1 focus:ring-claude-accent"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => handleAskSubmit()}
                                disabled={askLoading || !askDraft.trim()}
                                className="guide-cta guide-cta--primary guide-focus-ring w-full disabled:opacity-50"
                            >
                                {askLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                                <span>Send question</span>
                            </button>
                            {askResponse ? (
                                <div className="guide-tone-success rounded-[1.3rem] p-4">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                                        Coach answer
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-claude-text">{askResponse}</p>
                                </div>
                            ) : null}
                        </div>
                    </DesktopSideSheet>
                )
            ) : null}

            {isMobileLayout ? (
                <>
                    <MobileBottomSheet
                        open={showMobileMenu}
                        title="Coach actions"
                        subtitle="Share, generate, or rebuild."
                        onClose={() => setShowMobileMenu(false)}
                        testId="mobile-more-sheet"
                        opaque
                    >
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleShareGuide();
                                }}
                                className="guide-cta guide-cta--secondary guide-focus-ring w-full justify-between"
                            >
                                <span>Share</span>
                                <Share2 className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleGenerateFlashcards();
                                }}
                                disabled={!!generating}
                                className="guide-cta guide-cta--secondary guide-focus-ring w-full justify-between disabled:opacity-50"
                            >
                                <span>Flashcards</span>
                                {generating === 'flashcards' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleGenerateExam();
                                }}
                                disabled={!!generating}
                                className="guide-cta guide-cta--secondary guide-focus-ring w-full justify-between disabled:opacity-50"
                            >
                                <span>Mock Exam</span>
                                {generating === 'exam' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleRegenerateWorkbook();
                                }}
                                disabled={!!generating}
                                className="guide-cta guide-cta--primary guide-focus-ring w-full justify-between disabled:opacity-50"
                            >
                                <span>Rebuild Workbook</span>
                                {generating === 'guide' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    setDeleteConfirm(true);
                                }}
                                className="guide-cta guide-cta--danger guide-focus-ring w-full justify-between"
                            >
                                <span>Delete</span>
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </MobileBottomSheet>

                    <MobileBottomSheet
                        open={showMobileSections}
                        title="Checkpoints"
                        subtitle={`${progress.completedCount}/${progress.totalSections} complete`}
                        onClose={() => setShowMobileSections(false)}
                        testId="mobile-sections-sheet"
                    >
                        <div className="space-y-2">
                            {railSections.map((item) => (
                                <button
                                    key={item.section.id}
                                    type="button"
                                    onClick={() => {
                                        setShowMobileSections(false);
                                        if (sessionMode === 'studying') {
                                            handleSessionIndexChange(item.index);
                                        } else {
                                            handleSelectSection(item.section.id);
                                        }
                                    }}
                                    className={`w-full rounded-[1.35rem] p-4 text-left transition-all ${
                                        railActiveId === item.section.id
                                            ? `${item.panel} shadow-[0_18px_48px_-34px_rgba(0,0,0,0.82)]`
                                            : 'guide-tone-neutral'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                                Section {item.index + 1}
                                            </p>
                                            <p className="mt-2 text-sm font-medium text-claude-text">{item.section.title}</p>
                                        </div>
                                        <span className={`guide-status-pill ${item.tone}`}>{item.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </MobileBottomSheet>

                    <MobileBottomSheet
                        open={showMobileMoreDetails}
                        title={displaySection?.title || 'Coach notes'}
                        subtitle={displaySectionMeta.label}
                        onClose={() => setShowMobileMoreDetails(false)}
                        testId="mobile-details-sheet"
                    >
                        <div className="space-y-4">
                            {displaySection?.key_terms?.length ? (
                                <div className="guide-tone-neutral rounded-[1.4rem] p-4">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">Key terms</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {displaySection.key_terms.map((term) => (
                                            <span key={getKeyTermLabel(term)} className="guide-status-pill guide-status-pill--neutral">{getKeyTermLabel(term)}</span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            {displaySection?.common_traps?.length ? (
                                <div className="guide-tone-warning rounded-[1.4rem] p-4">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">Common traps</p>
                                    <div className="mt-3 space-y-2 text-sm leading-6 text-claude-text">
                                        {displaySection.common_traps.map((trap) => (
                                            <p key={trap}>{trap}</p>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            {displaySection ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowMobileMoreDetails(false);
                                        setEditingSectionId(displaySection.id);
                                    }}
                                    className="guide-cta guide-cta--secondary guide-focus-ring w-full"
                                >
                                    <Pencil className="h-4 w-4" />
                                    <span>Edit Section</span>
                                </button>
                            ) : null}
                        </div>
                    </MobileBottomSheet>

                    <MobileBottomSheet
                        open={showMobileNoteEditor}
                        title="Checkpoint note"
                        subtitle={noteDisclosureSummary}
                        onClose={() => setShowMobileNoteEditor(false)}
                        testId="mobile-note-sheet"
                    >
                        <div className="space-y-4">
                            <textarea
                                value={displaySectionState?.note ?? ''}
                                onChange={(event) => handleSectionNoteChange(displaySection?.id, event.target.value)}
                                placeholder="Capture a memory hook or reminder for this checkpoint."
                                className="min-h-[180px] w-full resize-none rounded-[1.3rem] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-6 text-claude-text placeholder:text-claude-secondary/65 focus:outline-none focus:ring-1 focus:ring-claude-accent"
                            />
                        </div>
                    </MobileBottomSheet>

                </>
            ) : null}
        </div>
    );
}
