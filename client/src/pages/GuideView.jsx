import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
    AlertTriangle, Check, ChevronLeft, ClipboardCheck,
    Layers, Loader2, Menu, Pencil, Play, RotateCcw, Share2, Sparkles, Trash2, X
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
    STUDY_GUIDE_FORMAT_VERSION,
    getGuideProgress,
    getGuideStudySourceText,
    getSessionSections,
    getSectionStatus,
    getWeakSections,
    normalizeGuideData,
    normalizeGuideStudyState,
} from '../utils/studyGuides';
import StudySection from '../components/StudySection.jsx';
import GuideProgressDashboard from '../components/GuideProgressDashboard.jsx';
import QuizMeMode from '../components/QuizMeMode.jsx';
import SectionEditor from '../components/SectionEditor.jsx';
import { updateSection } from '../utils/studyGuides.js';

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

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

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

    const [editingSectionId, setEditingSectionId] = useState(null);

    // Session mode state — drives the new study flow for v2 guides
    // 'entry' | 'studying' | 'quiz' | 'dashboard'
    const [sessionMode, setSessionMode] = useState('entry');
    const [sessionSections, setSessionSections] = useState([]);
    const [sessionIndex, setSessionIndex] = useState(0);

    const toastRef = useRef(toast);
    const saveTimerRef = useRef(null);
    const contentRef = useRef(null);
    const titleRef = useRef('');
    const guideDataRef = useRef(null);
    const studyStateRef = useRef(EMPTY_STUDY_STATE);
    const formatVersionRef = useRef(1);
    const guideRef = useRef(null);
    const activeSaveRef = useRef(Promise.resolve(null));

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

        titleRef.current = '';
        contentRef.current = null;
        guideDataRef.current = null;
        studyStateRef.current = EMPTY_STUDY_STATE;
        formatVersionRef.current = 1;
        guideRef.current = null;
        activeSaveRef.current = Promise.resolve(null);
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
    const workbookGuide = Number(formatVersion) >= STUDY_GUIDE_FORMAT_VERSION;
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
    const workbookActionLabel = legacyGuide ? 'Convert to workbook' : 'Rebuild workbook';
    const mobileProgressLabel = `${progress.completedCount}/${progress.totalSections} complete`;
    const weakSections = useMemo(
        () => getWeakSections(normalizedGuideData, normalizedStudyState),
        [normalizedGuideData, normalizedStudyState],
    );
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
    const hasDisplayDetails = Boolean(
        displaySection?.key_terms?.length
        || displaySection?.common_traps?.length
    );
    const noteDisclosureSummary = displaySectionState?.note?.trim()
        ? 'Your note is saved here.'
        : 'Add a quick memory hook or reminder.';
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

    useEffect(() => {
        if (!isMobileLayout) {
            setShowMobileMenu(false);
            setShowMobileSections(false);
            setShowMobileMoreDetails(false);
            setShowMobileNoteEditor(false);
        }
    }, [isMobileLayout]);

    useEffect(() => {
        setShowMobileSections(false);
        setShowMobileMoreDetails(false);
        setShowMobileNoteEditor(false);
    }, [displaySection?.id]);

    const saveGuide = useCallback(async () => {
        setSaving(true);
        try {
            const payload = {
                title: titleRef.current || 'Untitled Guide',
            };
            const currentFormatVersion = Number(formatVersionRef.current) || 1;
            const normalizedCurrentGuideData = normalizeGuideData(guideDataRef.current);

            if (currentFormatVersion >= STUDY_GUIDE_FORMAT_VERSION && normalizedCurrentGuideData) {
                payload.study_state = normalizeGuideStudyState(normalizedCurrentGuideData, studyStateRef.current);
            } else if (currentFormatVersion < STUDY_GUIDE_FORMAT_VERSION) {
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
    }, [id, toast]);

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
                [sectionId]: {
                    ...state.section_states[sectionId],
                    confidence,
                    revealed: true,
                    last_reviewed_at: now,
                },
            },
            last_reviewed_at: now,
        }), { immediate: true });
    }, [updateStudyState]);

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
                buildShareMessageContent('guide', titleRef.current || 'Untitled Guide'),
                'guide',
                serializeSharedPayload({
                    kind: 'guide',
                    sourceId: id,
                    title: titleRef.current || 'Untitled Guide',
                    previewText: buildSharedPreviewText(contentSnapshot),
                })
            );

            toast.success('Guide shared successfully!');
            setShowShareModal(false);
        } catch (err) {
            toast.error(err?.message || 'Failed to share guide');
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
            toast.error('Guide is empty');
            return;
        }

        setGenerating('flashcards');
        try {
            const stream = await api.generateAiDeckStream(
                text,
                null,
                `${titleRef.current || 'Guide'} - AI`,
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
            toast.error('Guide is empty');
            return;
        }

        setGenerating('exam');
        try {
            const stream = await api.generateAiExamStream(
                text,
                null,
                `${titleRef.current || 'Guide'} Exam`,
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
            toast.error('Guide is empty');
            return;
        }

        setGenerating('guide');
        setTransitioningWorkbook(true);

        try {
            const stream = await api.generateAiGuideStream(
                text,
                null,
                `${titleRef.current || 'Guide'} Recall Workbook`,
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
                    toast.success('Recall workbook generated!');
                    return;
                }
            }
        } catch (err) {
            setTransitioningWorkbook(false);
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate workbook');
        } finally {
            setGenerating(null);
        }
    };

    const handleDelete = async () => {
        try {
            await api.deleteStudyGuide(id);
            toast.success('Guide deleted');
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

    const startStudySession = useCallback((sectionList) => {
        if (!sectionList.length) return;
        setSessionSections(sectionList);
        setSessionIndex(0);
        setSessionMode('studying');
        handleSelectSection(sectionList[0].id);
    }, [handleSelectSection]);

    const startFullSession = useCallback(() => {
        const sectionList = normalizedGuideData?.sections ?? [];
        if (!sectionList.length) return;
        startStudySession(sectionList);
    }, [normalizedGuideData, startStudySession]);

    const startQuickSession = useCallback((durationMinutes) => {
        const sessionSelection = getSessionSections(normalizedGuideData, normalizedStudyState, durationMinutes);
        startStudySession(sessionSelection.length ? sessionSelection : normalizedGuideData?.sections ?? []);
    }, [normalizedGuideData, normalizedStudyState, startStudySession]);

    const startWeakSession = useCallback(() => {
        startStudySession(weakSections.length ? weakSections : normalizedGuideData?.sections ?? []);
    }, [normalizedGuideData, startStudySession, weakSections]);

    const startQuizMode = useCallback(() => {
        setSessionMode('quiz');
    }, []);

    const handleSectionComplete = useCallback((sectionId) => {
        updateStudyState((state) => ({
            ...state,
            section_states: {
                ...state.section_states,
                [sectionId]: {
                    ...state.section_states[sectionId],
                    completed: true,
                },
            },
        }));
        if (sessionIndex + 1 >= sessionSections.length) {
            setSessionMode('dashboard');
        } else {
            handleSessionIndexChange(sessionIndex + 1);
        }
    }, [handleSessionIndexChange, sessionIndex, sessionSections.length, updateStudyState]);

    const handleQuizComplete = useCallback(() => {
        setSessionMode('dashboard');
    }, []);

    const weakCoachMessage = useMemo(() => {
        if (!weakSections.length) return null;
        if (weakSections.length === 1) return `You’re weakest on ${weakSections[0].title}. Start there first.`;
        if (weakSections.length === 2) return `Focus on ${weakSections[0].title} and ${weakSections[1].title} before anything else.`;
        return `${weakSections.length} sections need review. Start with the weakest ones and keep the session tight.`;
    }, [weakSections]);

    const renderSessionEntry = () => (
        <div data-testid="session-entry" className="flex flex-col gap-5">
            <div data-testid="entry-hero-card" className="guide-hero rounded-[2rem] p-5 sm:p-6">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                                Botanical Observatory
                            </p>
                            <h1 className="mt-3 font-display text-[2.2rem] font-bold italic leading-[0.94] text-claude-text sm:text-[2.8rem]">
                                {title}
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-claude-secondary">
                                {sessionMessage}
                            </p>
                        </div>
                        <span className="guide-status-pill guide-status-pill--neutral self-start sm:self-auto">
                            {normalizedStudyState.last_reviewed_at ? `Last studied ${formatLastReviewed(normalizedStudyState.last_reviewed_at)}` : 'Not started'}
                        </span>
                    </div>

                    {weakCoachMessage ? (
                        <div className="guide-tone-warning rounded-[1.6rem] p-4 sm:p-5">
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                Study Coach
                            </p>
                            <p className="mt-3 text-sm leading-6 text-claude-text">{weakCoachMessage}</p>
                        </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-3">
                        <SessionMetric label="Complete" value={`${progress.completionPercent}%`} accent />
                        <SessionMetric label="Weak Spots" value={weakSections.length} />
                        <SessionMetric label="Quiz Prompts" value={allQuizQuestions.length} />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <button
                    type="button"
                    onClick={startFullSession}
                    className="guide-shell guide-focus-ring rounded-[1.7rem] p-5 text-left transition-transform duration-200 hover:-translate-y-1"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                Full Session
                            </p>
                            <p className="mt-3 font-display text-[1.75rem] font-bold italic leading-none text-claude-text">
                                {sessionLabel}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-claude-secondary">
                                All {sections.length} checkpoints with answer reveals, confidence rating, and progress tracking.
                            </p>
                        </div>
                        <div className="guide-status-pill guide-status-pill--neutral">
                            <Play className="h-3.5 w-3.5" />
                            ~{Math.max(sections.length * 3, 1)} min
                        </div>
                    </div>
                </button>

                <div className="guide-shell rounded-[1.7rem] p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                Quick Session
                            </p>
                            <p className="mt-3 font-display text-[1.75rem] font-bold italic leading-none text-claude-text">
                                Time-box the review
                            </p>
                            <p className="mt-3 text-sm leading-6 text-claude-secondary">
                                Pick a time and Riven will queue the most important sections first.
                            </p>
                        </div>
                        <div className="guide-status-pill guide-status-pill--warning">
                            <Sparkles className="h-3.5 w-3.5" />
                            Adaptive
                        </div>
                    </div>
                    <div data-testid="checkpoint-chip-row" className="mt-5 grid grid-cols-3 gap-2">
                        {[5, 10, 20].map((minutes) => (
                            <button
                                key={minutes}
                                type="button"
                                onClick={() => startQuickSession(minutes)}
                                className="guide-chip guide-focus-ring min-h-[48px] rounded-[1.2rem] px-3 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-text transition-all hover:border-claude-accent/35 hover:text-claude-accent"
                            >
                                {minutes} min
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={allQuizQuestions.length > 0 ? startQuizMode : () => setSessionMode('dashboard')}
                    className="guide-shell guide-focus-ring rounded-[1.7rem] p-5 text-left transition-transform duration-200 hover:-translate-y-1"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                {allQuizQuestions.length > 0 ? 'Quiz Me' : 'Progress'}
                            </p>
                            <p className="mt-3 font-display text-[1.75rem] font-bold italic leading-none text-claude-text">
                                {allQuizQuestions.length > 0 ? 'Rapid recall' : 'Review dashboard'}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-claude-secondary">
                                {allQuizQuestions.length > 0
                                    ? `${allQuizQuestions.length} prompts with no filler. Great for exam-speed recall.`
                                    : 'Open the progress dashboard to see what needs attention next.'}
                            </p>
                        </div>
                        <div className="guide-status-pill guide-status-pill--neutral">
                            {allQuizQuestions.length > 0 ? `${allQuizQuestions.length} prompts` : `${weakSections.length} weak`}
                        </div>
                    </div>
                </button>
            </div>

            <div className="guide-shell rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            Session snapshot
                        </p>
                        <p className="mt-2 text-sm leading-6 text-claude-secondary">
                            A quick map of the sections most likely to matter next.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSessionMode('dashboard')}
                        className="guide-cta guide-cta--ghost guide-focus-ring shrink-0"
                    >
                        <span>View progress</span>
                    </button>
                </div>
                <div className="mt-5 space-y-3">
                    {sectionSummaries.slice(0, 4).map((item) => (
                        <div key={item.section.id} className={`rounded-[1.4rem] p-4 ${item.panel}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                        Section {item.index + 1}
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-claude-text">{item.section.title}</p>
                                </div>
                                <span className={`guide-status-pill ${item.tone}`}>{item.label}</span>
                            </div>
                        </div>
                    ))}
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
                    className="guide-stage rounded-[2rem] p-5 sm:p-6"
                >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setSessionMode('entry')}
                            className="guide-cta guide-cta--ghost guide-focus-ring"
                        >
                            <span>Exit session</span>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="guide-status-pill guide-status-pill--neutral">
                                {sessionIndex + 1}/{sessionSections.length}
                            </span>
                            <span className={`guide-status-pill ${displaySectionMeta.tone}`}>
                                {displaySectionMeta.label}
                            </span>
                        </div>
                    </div>

                    <StudySection
                        section={activeSessionSection}
                        sectionState={activeSessionSectionState}
                        onReveal={() => handleSectionReveal(activeSessionSection.id)}
                        onConfidenceSelect={(confidence) => handleConfidenceSelect(activeSessionSection.id, confidence)}
                        onComplete={() => handleSectionComplete(activeSessionSection.id)}
                        sectionIndex={sessionIndex}
                        sectionCount={sessionSections.length}
                        canGoPrevious={canGoPrevious}
                        canGoNext={canGoNext}
                        onPrevious={() => handleSessionIndexChange(sessionIndex - 1)}
                        onNext={() => handleSessionIndexChange(sessionIndex + 1)}
                        onEdit={() => setEditingSectionId(activeSessionSection.id)}
                    />
                </div>
            </div>
        );
    };

    const renderDashboard = () => (
        <div data-testid="session-dashboard" className="flex flex-col gap-5">
            <div className="guide-stage rounded-[2rem] p-5 sm:p-6">
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
            <div className="guide-stage rounded-[2rem] p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                            Quiz Me
                        </p>
                        <p className="mt-2 text-sm leading-6 text-claude-secondary">
                            Fast recall, no reading mode. Reveal, judge honestly, move on.
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
            className="guide-rail h-fit rounded-[2rem] p-5 sm:p-6 lg:sticky lg:top-[calc(var(--safe-area-top)+1.25rem)]"
        >
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">
                Workbook
            </p>
            <h1 className="mt-3 font-display text-[2rem] font-bold italic leading-[0.95] text-claude-text">
                {title}
            </h1>
            {normalizedGuideData?.overview ? (
                <p className="mt-4 text-sm leading-6 text-claude-secondary">
                    {normalizedGuideData.overview}
                </p>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <SessionMetric label="Complete" value={`${progress.completionPercent}%`} accent />
                <SessionMetric label="Weak Spots" value={weakSections.length} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
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

            <div className="mt-5 grid gap-3">
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

            <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                        Checkpoints
                    </p>
                    <span className="guide-status-pill guide-status-pill--neutral">
                        {railSections.length}
                    </span>
                </div>
                <div className="mt-4 space-y-2.5">
                    {railSections.map((item) => (
                        <button
                            key={item.section.id}
                            type="button"
                            onClick={() => (
                                sessionMode === 'studying'
                                    ? handleSessionIndexChange(item.index)
                                    : handleSelectSection(item.section.id)
                            )}
                            className={`w-full rounded-[1.35rem] p-4 text-left transition-all duration-200 ${
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
                                    <p className="mt-2 text-sm font-medium leading-snug text-claude-text">
                                        {item.section.title}
                                    </p>
                                </div>
                                <span className={`guide-status-pill ${item.tone}`}>{item.label}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </aside>
    );

    const renderDesktopContext = () => {
        if (sessionMode === 'dashboard') {
            return (
                <aside data-testid="desktop-guide-context" className="guide-rail rounded-[2rem] p-5 sm:p-6">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                        Next move
                    </p>
                    <h2 className="mt-3 font-display text-[1.8rem] font-bold italic leading-none text-claude-text">
                        Coach Notes
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-claude-secondary">
                        {weakCoachMessage || 'You are in a strong spot. Use the dashboard to decide whether to tighten a section or run a quiz.'}
                    </p>
                    <div className="mt-5 grid gap-3">
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
                </aside>
            );
        }

        if (sessionMode === 'quiz') {
            return (
                <aside data-testid="desktop-guide-context" className="guide-rail rounded-[2rem] p-5 sm:p-6">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                        Quiz context
                    </p>
                    <h2 className="mt-3 font-display text-[1.8rem] font-bold italic leading-none text-claude-text">
                        Speed over comfort
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-claude-secondary">
                        Reveal only after you answer mentally. This mode is for pressure-testing retrieval, not rereading.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <SessionMetric label="Prompts" value={allQuizQuestions.length} accent />
                        <SessionMetric label="Weak Sections" value={weakSections.length} />
                    </div>
                </aside>
            );
        }

        return (
            <aside data-testid="desktop-guide-context" className="guide-rail rounded-[2rem] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                            Context
                        </p>
                        <h2 className="mt-3 font-display text-[1.8rem] font-bold italic leading-none text-claude-text">
                            {displaySection?.title || 'Session companion'}
                        </h2>
                    </div>
                    {displaySection ? (
                        <span className={`guide-status-pill ${displaySectionMeta.tone}`}>{displaySectionMeta.label}</span>
                    ) : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-claude-secondary">
                    {displaySection?.recall_prompt || weakCoachMessage || sessionMessage}
                </p>

                {displaySection?.key_terms?.length ? (
                    <div className="guide-tone-neutral mt-5 rounded-[1.5rem] p-4">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            Key terms
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {displaySection.key_terms.map((term) => (
                                <span key={term} className="guide-status-pill guide-status-pill--neutral">
                                    {term}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}

                {displaySection?.common_traps?.length ? (
                    <div className="guide-tone-warning mt-5 rounded-[1.5rem] p-4">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                            Common traps
                        </p>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-claude-text">
                            {displaySection.common_traps.map((trap) => (
                                <p key={trap}>{trap}</p>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="guide-shell mt-5 rounded-[1.5rem] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            Study note
                        </p>
                        {displaySection ? (
                            <button
                                type="button"
                                onClick={() => setEditingSectionId(displaySection.id)}
                                className="guide-cta guide-cta--ghost guide-focus-ring px-3"
                            >
                                <Pencil className="h-4 w-4" />
                                <span>Edit</span>
                            </button>
                        ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-claude-secondary">{noteDisclosureSummary}</p>
                    <textarea
                        value={displaySectionState?.note ?? ''}
                        onChange={(event) => handleSectionNoteChange(displaySection?.id, event.target.value)}
                        placeholder="Capture a memory hook, a tricky contrast, or the thing you keep missing."
                        className="mt-4 min-h-[140px] w-full resize-none rounded-[1.2rem] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-6 text-claude-text placeholder:text-claude-secondary/65 focus:outline-none focus:ring-1 focus:ring-claude-accent"
                    />
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
                    <p className="mt-6 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent">Workbook Upgrade</p>
                    <h1 className="mt-3 font-display text-3xl font-bold italic text-claude-text">Converting guide into a workbook</h1>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-claude-secondary">
                        Rebuilding this guide into a checkpoint-by-checkpoint study session with reveal-first answers,
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
                    title="Delete this guide?"
                    message="This study guide will be permanently deleted."
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(false)}
                />

                <div className="safe-area-top sticky top-0 z-30 border-b border-claude-border/10 bg-claude-bg/85 px-4 py-3 backdrop-blur-md">
                    <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
                        <button onClick={() => navigate('/guides')} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                            <ChevronLeft className="w-5 h-5" />
                            <span>Guides</span>
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
                        <p className="mt-5 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent">Workbook Needs Rebuilding</p>
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Untitled Guide"
                            className="mt-3 w-full bg-transparent text-3xl font-display font-bold italic tracking-tight leading-tight text-claude-text outline-none placeholder:text-claude-secondary/30 sm:text-4xl"
                        />
                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-claude-secondary">
                            This guide is marked as a workbook, but its study sections are missing. Rebuild it to restore
                            the guided review session, checkpoints, and confidence tracking.
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <button
                                type="button"
                                onClick={handleRegenerateWorkbook}
                                disabled={!!generating}
                                className="guide-cta guide-cta--primary guide-focus-ring w-full disabled:opacity-50 sm:w-auto"
                            >
                                {generating === 'guide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                {generating === 'guide' ? 'Rebuilding workbook' : 'Rebuild workbook'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/guides')}
                                className="guide-cta guide-cta--secondary guide-focus-ring w-full sm:w-auto"
                            >
                                Back to guides
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
                    title="Delete this guide?"
                    message="This study guide will be permanently deleted."
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
                    resourceLabel="Guide"
                    resourceTitle={title || 'Untitled Guide'}
                />

                <div className="safe-area-top sticky top-0 z-30 border-b border-claude-border/10 bg-claude-bg/80 px-4 pt-3 pb-2 backdrop-blur-md">
                    <div className="mx-auto mb-2 flex max-w-4xl items-center justify-between gap-3">
                        <button onClick={() => navigate('/guides')} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                            <ChevronLeft className="w-5 h-5" />
                            <span>Guides</span>
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
                            <button onClick={handleShareGuide} className="guide-cta guide-cta--ghost guide-focus-ring px-3" aria-label="Share guide">
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
                            <span>{generating === 'guide' ? 'Building workbook' : workbookActionLabel}</span>
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
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent mb-2">Classic Guide</p>
                        <p className="text-sm leading-6 text-claude-secondary">
                            This guide is still a document. Convert it into an active-recall workbook to get one-section-at-a-time
                            review, checkpoint reveals, confidence tracking, and resume progress.
                        </p>
                        <button
                            type="button"
                            onClick={handleRegenerateWorkbook}
                            disabled={!!generating}
                            className="guide-cta guide-cta--primary guide-focus-ring mt-4 w-full disabled:opacity-50 sm:w-auto"
                        >
                            {generating === 'guide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            {generating === 'guide' ? 'Building workbook' : 'Convert guide to workbook'}
                        </button>
                    </div>

                    <div className="guide-shell rounded-[2rem] p-5 sm:p-6">
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Untitled Guide"
                            className="mb-4 w-full bg-transparent text-3xl font-display font-bold italic tracking-tight leading-tight text-claude-text outline-none placeholder:text-claude-secondary/30 sm:text-4xl"
                        />

                        <TiptapEditor
                            content={content}
                            onUpdate={handleLegacyContentUpdate}
                            editable={true}
                            placeholder="Your study guide content..."
                        />
                    </div>
                </div>
            </div>
        );
    }

    const showWorkbookBottomBar = isMobileLayout && sessionMode === 'studying';

    return (
        <div
            data-testid="guide-screen"
            className={`relative min-h-screen safe-area-bottom ${showWorkbookBottomBar ? 'pb-[calc(env(safe-area-inset-bottom,0px)+8.5rem)]' : 'pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]'}`}
        >
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm}
                title="Delete this guide?"
                message="This study guide will be permanently deleted."
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
                resourceLabel="Guide"
                resourceTitle={title || 'Untitled Guide'}
            />

            {isMobileLayout ? (
                <div className="safe-area-top sticky top-0 z-30 px-4 py-3">
                    <div className="mobile-top-nav-glass rounded-[1.6rem] border border-claude-border px-4 py-3">
                        <div className="mx-auto flex max-w-5xl items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/guides')}
                                className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-3"
                                aria-label="Back to guides"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>

                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Workbook</p>
                                <p className="truncate text-sm font-medium text-claude-text">{displaySection?.title || title || 'Recall workbook'}</p>
                                <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                    {mobileProgressLabel}
                                    {displaySection ? ` • Section ${displaySectionPosition}/${Math.max(displaySectionCount, 1)}` : ''}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowMobileMenu(true)}
                                className="guide-cta guide-cta--ghost guide-focus-ring shrink-0 px-3"
                                aria-label="More workbook actions"
                            >
                                <Menu className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="safe-area-top sticky top-0 z-30 px-4 py-3">
                    <div className="guide-shell mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[1.8rem] px-5 py-4">
                        <button onClick={() => navigate('/guides')} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                            <ChevronLeft className="w-5 h-5" />
                            <span>Guides</span>
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
                            <button onClick={handleShareGuide} className="guide-cta guide-cta--ghost guide-focus-ring px-3" aria-label="Share guide">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(true)} className="guide-cta guide-cta--ghost guide-focus-ring px-3">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`mx-auto max-w-7xl px-4 ${isMobileLayout ? 'pt-4' : 'pt-6'}`}>
                {isMobileLayout ? (
                    <>
                        {sessionMode === 'entry' && renderSessionEntry()}
                        {sessionMode === 'studying' && renderStudying()}
                        {sessionMode === 'quiz' && renderQuiz()}
                        {sessionMode === 'dashboard' && renderDashboard()}
                    </>
                ) : (
                    <div data-testid="workbook-shell-grid" className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
                        {renderDesktopRail()}
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                            <div data-testid="desktop-guide-stage">
                                {sessionMode === 'entry' && renderSessionEntry()}
                                {sessionMode === 'studying' && renderStudying()}
                                {sessionMode === 'quiz' && renderQuiz()}
                                {sessionMode === 'dashboard' && renderDashboard()}
                            </div>
                            {renderDesktopContext()}
                        </div>
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

            {isMobileLayout ? (
                <>
                    <MobileBottomSheet
                        open={showMobileMenu}
                        title="Workbook actions"
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
                        title={displaySection?.title || 'Checkpoint details'}
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
                                            <span key={term} className="guide-status-pill guide-status-pill--neutral">{term}</span>
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
                        title="Study note"
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

                    {showWorkbookBottomBar ? (
                        <div data-testid="mobile-bottom-bar" className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
                            <div className="mobile-bottom-nav-shell rounded-[1.75rem]">
                                <div className="mobile-bottom-nav-shell__clip rounded-[inherit] px-4 py-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowMobileSections(true)}
                                            className="guide-cta guide-cta--ghost guide-focus-ring w-full"
                                        >
                                            <span>Sections</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowMobileMoreDetails(true)}
                                            disabled={!hasDisplayDetails}
                                            className="guide-cta guide-cta--ghost guide-focus-ring w-full disabled:opacity-35"
                                        >
                                            <span>Details</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowMobileNoteEditor(true)}
                                            className="guide-cta guide-cta--ghost guide-focus-ring w-full"
                                        >
                                            <span>Notes</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
