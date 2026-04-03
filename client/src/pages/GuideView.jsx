import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
    AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronLeft, ClipboardCheck,
    ChevronDown, Eye, Layers, Loader2, Menu, Play, RotateCcw, Share2, Sparkles, Trash2, X
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
    STUDY_GUIDE_CONFIDENCE_OPTIONS,
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
    const panelBackgroundClass = opaque ? 'bg-claude-bg' : 'bg-claude-bg/95';

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
                        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t border-claude-border ${panelBackgroundClass} px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4 shadow-2xl`}
                    >
                        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-claude-border" />
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="font-serif text-xl font-bold italic text-claude-text">{title}</p>
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

function DisclosureCard({ label, summary, open, onToggle, children, testId }) {
    return (
        <div data-testid={testId} className="rounded-[24px] border border-claude-border bg-claude-surface/80">
            <button
                type="button"
                onClick={onToggle}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-4 text-left"
            >
                <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">{label}</p>
                    {summary ? <p className="mt-1 text-sm text-claude-secondary">{summary}</p> : null}
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-claude-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? <div className="border-t border-claude-border px-4 py-4">{children}</div> : null}
        </div>
    );
}

function ConfidenceButton({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex min-h-[44px] w-full items-center justify-center rounded-2xl border px-3 py-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all ${
                active
                    ? 'border-claude-accent bg-claude-accent/10 text-claude-accent'
                    : 'border-claude-border bg-claude-surface text-claude-secondary hover:border-claude-accent/30 hover:text-claude-accent'
            }`}
        >
            {label}
        </button>
    );
}

function SessionMetric({ label, value, accent = false }) {
    return (
        <div className={`min-h-[84px] rounded-2xl border px-4 py-4 ${accent ? 'border-claude-accent/20 bg-claude-accent/5' : 'border-claude-border bg-claude-surface/70'}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">{label}</p>
            <p className={`mt-2 text-sm sm:text-base ${accent ? 'text-claude-accent' : 'text-claude-text'}`}>{value}</p>
        </div>
    );
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
    const [showMobileGuideInfo, setShowMobileGuideInfo] = useState(false);
    const [showMobileMoreDetails, setShowMobileMoreDetails] = useState(false);
    const [showMobileNoteEditor, setShowMobileNoteEditor] = useState(false);

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
    const sessionCardRef = useRef(null);

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
    const sections = normalizedGuideData?.sections || [];
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
    const activeSectionStatusLabel = activeSectionState?.completed
        ? 'Completed'
        : activeSectionState?.revealed
            ? 'Revealed'
            : 'Recall first';
    const hasMobileMoreDetails = Boolean(
        activeSection?.key_terms?.length
        || activeSection?.mini_quiz?.length
        || activeSection?.common_traps?.length
    );
    const noteDisclosureSummary = activeSectionState?.note?.trim()
        ? 'Your note is saved here.'
        : 'Add a quick memory hook or reminder.';
    const guideInfoSummary = `${progress.completedCount}/${progress.totalSections} checkpoints complete`;
    const canGoPrevious = activeSectionIndex > 0;
    const canGoNext = activeSectionIndex < sections.length - 1;
    const mobileProgressLabel = `${progress.completedCount}/${progress.totalSections} complete`;

    const focusSession = useCallback(() => {
        sessionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const startStudySession = useCallback((sectionList) => {
        if (!sectionList.length) return;
        setSessionSections(sectionList);
        setSessionIndex(0);
        setSessionMode('studying');
    }, []);

    const startFullSession = useCallback(() => {
        const sectionList = normalizedGuideData?.sections ?? [];
        if (!sectionList.length) return;
        startStudySession(sectionList);
    }, [startStudySession, normalizedGuideData]);

    const startQuickSession = useCallback((durationMinutes) => {
        const sessionSecs = getSessionSections(normalizedGuideData, normalizedStudyState, durationMinutes);
        startStudySession(sessionSecs.length ? sessionSecs : normalizedGuideData?.sections ?? []);
    }, [startStudySession, normalizedGuideData, normalizedStudyState]);

    const startWeakSession = useCallback(() => {
        const weak = getWeakSections(normalizedGuideData, normalizedStudyState);
        startStudySession(weak.length ? weak : normalizedGuideData?.sections ?? []);
    }, [startStudySession, normalizedGuideData, normalizedStudyState]);

    const startQuizMode = useCallback(() => {
        setSessionMode('quiz');
    }, []);

    useEffect(() => {
        if (!isMobileLayout) {
            setShowMobileMenu(false);
            setShowMobileSections(false);
            setShowMobileGuideInfo(false);
            setShowMobileMoreDetails(false);
            setShowMobileNoteEditor(false);
        }
    }, [isMobileLayout]);

    useEffect(() => {
        setShowMobileSections(false);
        setShowMobileMoreDetails(false);
        setShowMobileNoteEditor(false);
    }, [activeSection?.id]);

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
            setSessionIndex(sessionIndex + 1);
        }
    }, [updateStudyState, sessionSections.length, sessionIndex]);

    const handleQuizComplete = useCallback(() => {
        setSessionMode('dashboard');
    }, []);

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

    const weakCoachMessage = useMemo(() => {
        if (!normalizedGuideData || !normalizedStudyState) return null;
        const weak = getWeakSections(normalizedGuideData, normalizedStudyState);
        if (!weak.length) return null;
        if (weak.length === 1) return `You're weak on ${weak[0].title}. Focus there first.`;
        if (weak.length === 2) return `You're weak on ${weak[0].title} and ${weak[1].title}. Start there.`;
        return `${weak.length} sections need review. Start with the weakest ones.`;
    }, [normalizedGuideData, normalizedStudyState]);

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

    const handleRevealAnswer = () => {
        if (!activeSection) return;
        updateStudyState((current) => ({
            ...current,
            last_reviewed_at: new Date().toISOString(),
            section_states: {
                ...current.section_states,
                [activeSection.id]: {
                    ...current.section_states[activeSection.id],
                    revealed: true,
                },
            },
        }), { immediate: true });
    };

    const handleConfidenceChange = (value) => {
        if (!activeSection) return;
        updateStudyState((current) => ({
            ...current,
            last_reviewed_at: new Date().toISOString(),
            section_states: {
                ...current.section_states,
                [activeSection.id]: {
                    ...current.section_states[activeSection.id],
                    revealed: true,
                    confidence: value,
                    completed: true,
                },
            },
        }), { immediate: true });
    };

    const handleSectionNoteChange = (e) => {
        if (!activeSection) return;
        const nextNote = e.target.value;
        updateStudyState((current) => ({
            ...current,
            section_states: {
                ...current.section_states,
                [activeSection.id]: {
                    ...current.section_states[activeSection.id],
                    note: nextNote,
                },
            },
        }));
    };

    const handleSelectSection = (sectionId) => {
        updateStudyState((current) => ({
            ...current,
            current_section_id: sectionId,
            last_reviewed_at: new Date().toISOString(),
        }), { immediate: true });
    };

    const handleStepNavigation = (direction) => {
        if (!activeSection) return;
        const nextIndex = activeSectionIndex + direction;
        if (nextIndex < 0 || nextIndex >= sections.length) return;
        handleSelectSection(sections[nextIndex].id);
    };

    const activeSessionSection = sessionSections[sessionIndex] ?? null;
    const activeSessionSectionState = activeSessionSection
        ? normalizedStudyState.section_states[activeSessionSection.id] ?? DEFAULT_SECTION_STATE
        : null;

    const renderSessionEntry = () => (
        <div data-testid="session-entry" className="flex flex-col gap-4 px-4 py-4">
            <div>
                <h1 className="font-serif text-2xl font-bold italic text-claude-text">{title}</h1>
                {normalizedStudyState.last_reviewed_at && (
                    <p className="mt-1 text-xs text-claude-secondary">
                        Last studied {formatLastReviewed(normalizedStudyState.last_reviewed_at)}
                    </p>
                )}
            </div>

            {weakCoachMessage && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-blue-600">Study Coach</p>
                    <p className="text-sm text-blue-800">{weakCoachMessage}</p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                <div className="rounded-2xl bg-claude-accent p-4 text-white">
                    <p className="font-bold">⚡ Quick Session</p>
                    <p className="mt-1 text-xs opacity-80">Pick a time — app selects what matters most</p>
                    <div className="mt-3 flex gap-2">
                        {[5, 10, 20].map((min) => (
                            <button
                                key={min}
                                type="button"
                                onClick={() => startQuickSession(min)}
                                className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30 transition-colors"
                            >
                                {min} min
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={startFullSession}
                    className="rounded-2xl border border-claude-border bg-claude-surface p-4 text-left"
                >
                    <p className="font-bold text-claude-text">📚 Full Session</p>
                    <p className="mt-1 text-xs text-claude-secondary">
                        All {sections.length} sections · ~{sections.length * 3} min
                    </p>
                </button>

                {allQuizQuestions.length > 0 && (
                    <button
                        type="button"
                        onClick={startQuizMode}
                        className="rounded-2xl border border-claude-border bg-claude-surface p-4 text-left"
                    >
                        <p className="font-bold text-claude-text">🎯 Quiz Me</p>
                        <p className="mt-1 text-xs text-claude-secondary">
                            Rapid-fire · {allQuizQuestions.length} questions · Pure recall
                        </p>
                    </button>
                )}
            </div>

            <button
                type="button"
                onClick={() => setSessionMode('dashboard')}
                className="text-center text-xs text-claude-secondary underline"
            >
                View progress dashboard
            </button>
        </div>
    );

    const renderStudying = () => {
        if (!activeSessionSection) return null;
        return (
            <div data-testid="session-studying" className="flex flex-col gap-4 px-4 py-4">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setSessionMode('entry')}
                        className="flex items-center gap-1 text-xs text-claude-secondary"
                    >
                        <ChevronLeft className="h-3 w-3" /> Exit session
                    </button>
                    <p className="text-xs text-claude-secondary">
                        {sessionIndex + 1} / {sessionSections.length}
                    </p>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-claude-border">
                    <div
                        className="h-full rounded-full bg-claude-accent transition-all"
                        style={{ width: `${(sessionIndex / sessionSections.length) * 100}%` }}
                    />
                </div>

                <StudySection
                    section={activeSessionSection}
                    sectionState={activeSessionSectionState}
                    onReveal={() => handleSectionReveal(activeSessionSection.id)}
                    onConfidenceSelect={(confidence) => handleConfidenceSelect(activeSessionSection.id, confidence)}
                    onComplete={() => handleSectionComplete(activeSessionSection.id)}
                />
            </div>
        );
    };

    const renderDashboard = () => (
        <div data-testid="session-dashboard" className="flex flex-col gap-4 px-4 py-4">
            <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-bold italic text-claude-text">Progress</h2>
                <button
                    type="button"
                    onClick={() => setSessionMode('entry')}
                    className="text-xs text-claude-secondary underline"
                >
                    Back
                </button>
            </div>
            <GuideProgressDashboard
                guideData={normalizedGuideData}
                studyState={normalizedStudyState}
                onStartWeakSession={startWeakSession}
            />
        </div>
    );

    const renderQuiz = () => (
        <div data-testid="session-quiz" className="flex flex-col gap-4 px-4 py-4">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => setSessionMode('entry')}
                    className="flex items-center gap-1 text-xs text-claude-secondary"
                >
                    <ChevronLeft className="h-3 w-3" /> Exit quiz
                </button>
            </div>
            <QuizMeMode questions={allQuizQuestions} onComplete={handleQuizComplete} />
        </div>
    );

    if (transitioningWorkbook) {
        return (
            <div className="min-h-dvh safe-area-top safe-area-bottom bg-claude-bg px-4 py-8 sm:py-16">
                <div className="mx-auto flex max-w-2xl flex-col items-center rounded-[32px] border border-claude-accent/20 bg-claude-surface/85 p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.10)]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-claude-accent/20 bg-claude-accent/10 text-claude-accent">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                    <p className="mt-6 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent">Workbook Upgrade</p>
                    <h1 className="mt-3 text-3xl font-serif font-bold italic text-claude-text">Converting guide into a workbook</h1>
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

                <div className="safe-area-top sticky top-0 z-30 bg-claude-bg/85 backdrop-blur-md border-b border-claude-border/10 px-4 py-3">
                    <div className="flex items-center justify-between max-w-4xl mx-auto gap-4">
                        <button onClick={() => navigate('/guides')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Guides</span>
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                {saving ? (
                                    <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                                ) : saved ? (
                                    <Check className="w-3.5 h-3.5 text-claude-accent" />
                                ) : null}
                                <span className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary hidden sm:inline">
                                    {saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}
                                </span>
                            </div>
                            <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 pt-8">
                    <div className="rounded-[32px] border border-amber-500/20 bg-amber-500/5 p-6 sm:p-8 shadow-[0_14px_40px_rgba(0,0,0,0.08)]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <p className="mt-5 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300">Workbook Needs Rebuilding</p>
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Untitled Guide"
                            className="mt-3 w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none tracking-tight leading-tight"
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
                                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 disabled:opacity-50 sm:w-auto"
                            >
                                {generating === 'guide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                {generating === 'guide' ? 'Rebuilding workbook' : 'Rebuild workbook'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/guides')}
                                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-border px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-claude-accent sm:w-auto"
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

                <div className="safe-area-top sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10 px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between max-w-3xl mx-auto mb-2">
                        <button onClick={() => navigate('/guides')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Guides</span>
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                {saving ? (
                                    <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                                ) : saved ? (
                                    <Check className="w-3.5 h-3.5 text-claude-accent" />
                                ) : null}
                                <span className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary">
                                    {saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}
                                </span>
                            </div>
                            <button onClick={handleShareGuide} className="p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action" aria-label="Share guide">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="max-w-3xl mx-auto flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={handleRegenerateWorkbook}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'guide' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            <span>{generating === 'guide' ? 'Building workbook' : workbookActionLabel}</span>
                        </button>

                        <button
                            onClick={handleGenerateFlashcards}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                            <span>Flashcards</span>
                        </button>

                        <button
                            onClick={handleGenerateExam}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                            <span>Mock Exam</span>
                        </button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 pt-6">
                    <div className="mb-4 rounded-2xl border border-claude-accent/20 bg-claude-accent/5 p-4 text-sm text-claude-secondary">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent mb-2">Classic Guide</p>
                        <p>
                            This guide is still a document. Convert it into an active-recall workbook to get one-section-at-a-time
                            review, checkpoint reveals, confidence tracking, and resume progress.
                        </p>
                        <button
                            type="button"
                            onClick={handleRegenerateWorkbook}
                            disabled={!!generating}
                            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 disabled:opacity-50 sm:w-auto"
                        >
                            {generating === 'guide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            {generating === 'guide' ? 'Building workbook' : 'Convert guide to workbook'}
                        </button>
                    </div>

                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled Guide"
                        className="w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none mb-2 tracking-tight leading-tight"
                    />

                    <TiptapEditor
                        content={content}
                        onUpdate={handleLegacyContentUpdate}
                        editable={true}
                        placeholder="Your study guide content..."
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            data-testid="guide-screen"
            className={`relative min-h-screen safe-area-bottom ${isMobileLayout ? 'pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]' : 'pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]'}`}
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
                <div className="safe-area-top sticky top-0 z-30 border-b border-claude-border/10 bg-claude-bg/92 px-4 py-3 backdrop-blur-md">
                    <div className="mx-auto flex max-w-5xl items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/guides')}
                            className="touch-target rounded-full p-2 text-claude-secondary transition-colors hover:text-claude-accent tap-action"
                            aria-label="Back to guides"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Workbook</p>
                            <p className="truncate text-sm font-medium text-claude-text">{activeSection?.title || title || 'Recall workbook'}</p>
                            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                {mobileProgressLabel}
                                {activeSection ? ` • Section ${activeSectionIndex + 1}/${sections.length}` : ''}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowMobileMenu(true)}
                            className="touch-target rounded-full border border-claude-border bg-claude-surface/80 p-2 text-claude-secondary transition-colors hover:text-claude-accent tap-action"
                            aria-label="More workbook actions"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="safe-area-top sticky top-0 z-30 border-b border-claude-border/10 bg-claude-bg/85 px-4 py-3 backdrop-blur-md">
                    <div className="flex items-center justify-between max-w-5xl mx-auto gap-4">
                        <button onClick={() => navigate('/guides')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Guides</span>
                        </button>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center gap-1.5">
                                {saving ? (
                                    <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                                ) : saved ? (
                                    <Check className="w-3.5 h-3.5 text-claude-accent" />
                                ) : null}
                                <span className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary hidden sm:inline">
                                    {saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}
                                </span>
                            </div>
                            <button onClick={handleShareGuide} className="touch-target rounded-full p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action" aria-label="Share guide">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(true)} className="touch-target rounded-full p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`max-w-5xl mx-auto px-4 ${isMobileLayout ? 'pt-4' : 'pt-6'}`}>
                {sessionMode === 'entry' && renderSessionEntry()}
                {sessionMode === 'studying' && renderStudying()}
                {sessionMode === 'quiz' && renderQuiz()}
                {sessionMode === 'dashboard' && renderDashboard()}
            </div>


            {isMobileLayout ? (
                <>
                    <MobileBottomSheet
                        open={showMobileMenu}
                        title="Workbook actions"
                        subtitle="Everything else lives here."
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
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-claude-border bg-claude-surface/80 px-4 py-3 text-left text-sm text-claude-text"
                            >
                                <span>Share</span>
                                <Share2 className="h-4 w-4 text-claude-secondary" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleGenerateFlashcards();
                                }}
                                disabled={!!generating}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-claude-border bg-claude-surface/80 px-4 py-3 text-left text-sm text-claude-text disabled:opacity-50"
                            >
                                <span>Flashcards</span>
                                {generating === 'flashcards' ? <Loader2 className="h-4 w-4 animate-spin text-claude-secondary" /> : <Layers className="h-4 w-4 text-claude-secondary" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleGenerateExam();
                                }}
                                disabled={!!generating}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-claude-border bg-claude-surface/80 px-4 py-3 text-left text-sm text-claude-text disabled:opacity-50"
                            >
                                <span>Mock Exam</span>
                                {generating === 'exam' ? <Loader2 className="h-4 w-4 animate-spin text-claude-secondary" /> : <ClipboardCheck className="h-4 w-4 text-claude-secondary" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleRegenerateWorkbook();
                                }}
                                disabled={!!generating}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-3 text-left text-sm text-claude-text disabled:opacity-50"
                            >
                                <span>Rebuild Workbook</span>
                                {generating === 'guide' ? <Loader2 className="h-4 w-4 animate-spin text-claude-accent" /> : <RotateCcw className="h-4 w-4 text-claude-accent" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    setDeleteConfirm(true);
                                }}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-left text-sm text-red-200"
                            >
                                <span>Delete</span>
                                <Trash2 className="h-4 w-4 text-red-300" />
                            </button>
                        </div>
                    </MobileBottomSheet>

                    <MobileBottomSheet
                        open={showMobileSections}
                        title="Sections"
                        subtitle={`${progress.completedCount}/${progress.totalSections} complete`}
                        onClose={() => setShowMobileSections(false)}
                        testId="mobile-sections-sheet"
                    >
                        <div className="space-y-2">
                            {sections.map((section, index) => {
                                const sectionState = normalizedStudyState.section_states[section.id] || {};
                                const isCurrent = normalizedStudyState.current_section_id === section.id;
                                const isComplete = sectionState.completed;
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        onClick={() => {
                                            setShowMobileSections(false);
                                            handleSelectSection(section.id);
                                        }}
                                        className={`w-full rounded-[22px] border px-4 py-4 text-left transition-all ${
                                            isCurrent
                                                ? 'border-claude-accent bg-claude-accent/10'
                                                : isComplete
                                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                                    : 'border-claude-border bg-claude-surface/80'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Section {index + 1}</p>
                                                <p className="mt-2 text-sm font-medium text-claude-text">{section.title}</p>
                                            </div>
                                            <div className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] ${
                                                isCurrent
                                                    ? 'bg-claude-accent/15 text-claude-accent'
                                                    : isComplete
                                                        ? 'bg-emerald-500/15 text-emerald-300'
                                                        : 'bg-claude-bg/60 text-claude-secondary'
                                            }`}>
                                                {isCurrent ? 'Current' : isComplete ? 'Done' : 'Next'}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </MobileBottomSheet>
                </>
            ) : null}
        </div>
    );
}
