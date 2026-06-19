import React, { useEffect, useState, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    BookOpen, ChevronLeft, Sparkles, ArrowRight, Play, CheckSquare, Clock3, Calendar, Target, X
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import OnboardingArt from '../components/OnboardingArt.jsx';
import { useSelection } from '../hooks/useSelection';
import BulkActionBar from '../components/BulkActionBar';
import { useIsVisualBudgetConstrained } from '../hooks/useVisualBudget';
import {
    estimateSessionEffortMinutes,
    getGuideMasterySnapshot,
    getGuideProgress,
    isActiveRecallGuide,
    normalizeGuideData,
    normalizeGuideStudyState,
    STUDY_SESSION_STATUSES,
} from '../utils/studyGuides';
import CreateSessionSheet from '../components/study/CreateSessionSheet.jsx';

const getGuideDisplayLabel = (guide) => (
    isActiveRecallGuide(guide) ? 'tutor session' : 'unsupported guide'
);

const GuideCard = memo(({ guide, classes, index, isSelectMode = false, isSelected = false, onToggle, visualConstrained = false }) => {
    const navigate = useNavigate();
    const cls = guide.class_id ? classes.find(c => c.id === guide.class_id) : null;
    const activeRecall = isActiveRecallGuide(guide);
    const normalizedGuideData = activeRecall ? normalizeGuideData(guide.guide_data) : null;
    const normalizedStudyState = normalizedGuideData
        ? normalizeGuideStudyState(normalizedGuideData, guide.study_state)
        : guide.study_state;
    const progress = getGuideProgress(normalizedGuideData || guide.guide_data, normalizedStudyState);
    const masterySnapshot = activeRecall
        ? getGuideMasterySnapshot(normalizedGuideData, normalizedStudyState)
        : null;
    const lastReviewed = normalizedStudyState?.last_reviewed_at
        ? new Date(normalizedStudyState.last_reviewed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Not started';
    const updatedAt = guide.updated_at
        ? new Date(guide.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Recently updated';
    const nextSection = normalizedGuideData?.sections?.find((section) => section.id === progress.nextSectionId) || normalizedGuideData?.sections?.[0] || null;
    const sessionStatus = normalizedStudyState?.session_status || STUDY_SESSION_STATUSES.NOT_STARTED;
    const sessionIsResumable = [STUDY_SESSION_STATUSES.ACTIVE, STUDY_SESSION_STATUSES.PAUSED].includes(sessionStatus);
    const sessionIsComplete = sessionStatus === STUDY_SESSION_STATUSES.COMPLETE || Boolean(normalizedStudyState?.completed_at);
    const sessionCta = sessionIsComplete
        ? 'Review Again'
        : sessionIsResumable
            ? 'Resume Session'
            : 'Start Session';
    const sessionPanelLabel = sessionIsComplete
        ? 'Review River Session'
        : sessionIsResumable
            ? 'Resume River Session'
            : 'Best next move';
    const nextStepMinutes = nextSection ? estimateSessionEffortMinutes([nextSection]) : 0;
    const weakConceptCount = masterySnapshot?.masteryBands?.support?.length || 0;
    const nextReviewLabel = masterySnapshot?.nextReviewAt
        ? new Date(masterySnapshot.nextReviewAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Ready now';
    const adaptiveGuide = activeRecall && Number(guide.format_version) >= 4;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.8 : 0.8 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.3, ease: [0.33, 1, 0.68, 0.9] } }}
            transition={{ delay: visualConstrained ? 0 : (index % 10) * 0.05, duration: visualConstrained ? 0.28 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="perf-card relative tap-action"
        >
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-claude-border/60 rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 pointer-events-none" />

            <button
                type="button"
                onClick={() => isSelectMode ? onToggle?.(guide.id) : navigate(`/guide/${guide.id}`)}
                aria-pressed={isSelectMode ? isSelected : undefined}
                className={`group relative block w-full bg-claude-surface border p-4 sm:p-6 pt-6 sm:pt-8 rounded-[1.35rem] sm:rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 overflow-hidden active:scale-[0.97] touch-target text-left ${isSelected ? 'border-claude-accent ring-2 ring-claude-accent/60 bg-claude-accent/5' : 'border-claude-border'}`}
            >
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />
                <div className="absolute inset-0 bg-gradient-to-br from-claude-text/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3 mb-4 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.18em] text-claude-secondary">
                            {activeRecall ? 'Tutor session' : 'Unsupported guide'}
                        </span>
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary italic">
                            {updatedAt}
                        </span>
                    </div>

                    <h3 className="font-serif text-lg sm:text-xl font-bold text-claude-text leading-[1.15] group-hover:text-claude-accent transition-colors duration-300 italic mb-3 tracking-tight line-clamp-2">
                        {guide.title}
                    </h3>

                    {cls && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border shadow-sm w-fit" style={{
                            borderColor: `${cls.color}40`,
                            backgroundColor: `${cls.color}10`,
                            color: cls.color,
                        }}>
                            <Calendar className="w-2.5 h-2.5" />
                            <span className="font-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">{cls.name}</span>
                        </div>
                    )}

                    {activeRecall ? (
                        <div className="mt-4 space-y-3">
                            {adaptiveGuide ? (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-3 py-3">
                                        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Mastery</p>
                                        <p className="mt-1.5 text-lg font-semibold text-claude-text">{masterySnapshot?.averageMastery || 0}%</p>
                                    </div>
                                    <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-3 py-3">
                                        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Weak concepts</p>
                                        <p className="mt-1.5 text-lg font-semibold text-claude-text">{weakConceptCount}</p>
                                    </div>
                                    <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-3 py-3">
                                        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Review due</p>
                                        <p className="mt-1.5 text-lg font-semibold text-claude-text">{nextReviewLabel}</p>
                                    </div>
                                </div>
                            ) : null}

                            <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-3">
                                <div className="flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent">
                                    <span>{sessionPanelLabel}</span>
                                    {nextStepMinutes > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-claude-secondary">
                                            <Clock3 className="w-3.5 h-3.5" />
                                            ~{nextStepMinutes} min
                                        </span>
                                    ) : null}
                                </div>
                                <p className="mt-3 text-sm leading-6 text-claude-text">
                                    {nextSection?.title || 'Start your first checkpoint'}.
                                </p>
                                <p className="mt-1 text-[11px] leading-5 text-claude-secondary">
                                    {sessionIsComplete
                                        ? 'Start a fresh pass through weak or due concepts while keeping your mastery history.'
                                        : sessionIsResumable
                                            ? 'Pick up where you left off and keep the recall rhythm going.'
                                            : 'River opens with one low-pressure prompt and adapts from your answer.'}
                                </p>
                            </div>

                            <div className="flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-claude-secondary">
                                <span className="inline-flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 text-claude-accent" />
                                    {progress.completedCount}/{progress.totalSections} complete
                                </span>
                                <span>{progress.totalSections} concepts</span>
                            </div>
                            <div className="h-2 rounded-full bg-claude-border/30 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-claude-accent transition-all duration-300"
                                    style={{ width: `${progress.completionPercent}%` }}
                                />
                            </div>
                            <div className="rounded-2xl border border-claude-border/60 bg-claude-bg/60 px-3 py-3 text-[11px] text-claude-secondary">
                                <p>Next checkpoint: {nextSection?.title || 'Ready to begin'}</p>
                                <p className="mt-1">Last reviewed: {lastReviewed}</p>
                                {adaptiveGuide ? (
                                    <p className="mt-1">Support queue: {weakConceptCount}</p>
                                ) : null}
                            </div>
                            <div className="rounded-2xl border border-claude-accent/20 bg-claude-surface/70 px-4 py-3">
                                <div className="flex items-center justify-between gap-3 text-[11px] text-claude-secondary">
                                    <span>{progress.completionPercent}% complete</span>
                                    <span className="inline-flex items-center gap-1.5 text-claude-accent font-mono uppercase tracking-[0.16em]">
                                        <Play className="w-3.5 h-3.5" />
                                        {sessionCta}
                                    </span>
                                </div>
                                <div className="mt-3 flex min-h-[44px] items-center justify-center rounded-xl border border-claude-accent/25 bg-claude-surface/70 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">
                                    Open session
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3 text-[11px] text-claude-secondary">
                            <div className="rounded-2xl border border-claude-border/60 bg-claude-bg/60 px-3 py-3">
                                <p>Classic editable guide</p>
                                <p className="mt-1">This guide is unsupported after the River Session cutover.</p>
                            </div>
                            <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-3">
                                <span>Unsupported</span>
                                <span className="inline-flex items-center gap-1.5 text-claude-accent font-mono uppercase tracking-[0.16em]">
                                    <ArrowRight className="w-3.5 h-3.5" />
                                    Open
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="absolute -bottom-4 -right-4 opacity-[0.03] transition-opacity duration-700 pointer-events-none group-active:opacity-[0.08] scale-[1.2] sm:scale-150">
                    <BookOpen className="w-24 h-24 sm:w-32 sm:h-32" />
                </div>

                {/* Checkbox overlay — visible in select mode */}
                {isSelectMode && (
                    <div className={`absolute top-3 right-3 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 pointer-events-none ${isSelected ? 'bg-claude-accent border-claude-accent' : 'border-claude-border bg-claude-bg/80 backdrop-blur-sm'}`}>
                        {isSelected && (
                            <svg className="w-3.5 h-3.5 text-[#162a31]" viewBox="0 0 14 14" fill="none">
                                <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        )}
                    </div>
                )}
            </button>
        </motion.div>
    );
});
GuideCard.displayName = 'GuideCard';

const COVERAGE_SEGMENTS = [
    { key: 'mastered', label: 'Mastered', color: '#7a9e72' },
    { key: 'taught', label: 'In progress', color: '#deb96a' },
    { key: 'untaught', label: 'Not yet', color: 'rgba(255,255,255,0.14)' },
];

// Shows how much of the material has been taught and mastered across all sessions, with a
// one-tap path to a new session targeting whatever still needs work.
const CoverageTracker = memo(function CoverageTracker({ coverage, onStudyNext }) {
    const totals = coverage?.totals;
    if (!totals || !totals.total) return null;

    const nextTopics = coverage.nextTopics || [];
    const segments = COVERAGE_SEGMENTS
        .map((seg) => ({ ...seg, count: totals[seg.key] || 0 }))
        .filter((seg) => seg.count > 0);

    return (
        <div className="mb-6 rounded-3xl border border-claude-border glass-panel px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/70">Coverage</p>
                    <p className="mt-1 font-serif italic text-2xl text-claude-text">
                        {totals.masteredPct}% mastered
                        <span className="ml-2 text-sm not-italic text-claude-secondary/70">
                            {totals.mastered}/{totals.total} topics
                        </span>
                    </p>
                </div>
                {nextTopics.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => onStudyNext(nextTopics)}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl bg-claude-accent px-4 py-2 text-sm font-semibold text-white transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
                    >
                        <Sparkles className="h-4 w-4" />
                        Study what&apos;s next
                    </button>
                ) : (
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/60">
                        All topics covered
                    </span>
                )}
            </div>

            <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                {segments.map((seg) => (
                    <div
                        key={seg.key}
                        style={{ width: `${Math.round((seg.count / totals.total) * 100)}%`, backgroundColor: seg.color }}
                        title={`${seg.label}: ${seg.count}`}
                    />
                ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {COVERAGE_SEGMENTS.map((seg) => (
                    <span key={seg.key} className="inline-flex items-center gap-1.5 text-[11px] text-claude-secondary/80">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
                        {seg.label} {totals[seg.key] || 0}
                    </span>
                ))}
            </div>

            {nextTopics.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                    {nextTopics.slice(0, 6).map((topic) => (
                        <span
                            key={topic}
                            className="rounded-full border border-claude-border bg-claude-bg/30 px-3 py-1 text-xs text-claude-text/90"
                        >
                            {topic}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
});

export default function GuidesLibrary() {
    const visualConstrained = useIsVisualBudgetConstrained();
    const navigate = useNavigate();
    const toast = useToast();
    const [guides, setGuides] = useState([]);
    const [notes, setNotes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [coverage, setCoverage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
    const [studyNextTopics, setStudyNextTopics] = useState([]);

    const loadData = useCallback(async () => {
        try {
            const [guidesData, notesData, classesData, coverageData] = await Promise.all([
                api.getStudyGuides().catch(() => []),
                api.getNotes().catch(() => []),
                api.getClasses().catch(() => []),
                api.getStudyCoverageMap().catch(() => null),
            ]);
            setGuides((guidesData || []).filter((guide) => isActiveRecallGuide(guide)));
            setNotes(notesData);
            setClasses(classesData);
            setCoverage(coverageData);
            setError(null);
        } catch (err) {
            setError(err?.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const {
        isSelectMode, selectedIds, selectedCount, isAllSelected,
        enterSelectMode, exitSelectMode, toggleSelect, toggleSelectAll,
    } = useSelection(guides);
    const handleBulkDelete = async () => {
        const ids = [...selectedIds];
        setGuides(prev => prev.filter(g => !selectedIds.has(g.id)));
        exitSelectMode();
        try {
            await api.bulkDeleteStudyGuides(ids);
            toast.success(`${ids.length} tutor session${ids.length === 1 ? '' : 's'} deleted`);
            loadData();
        } catch (err) {
            toast.error(err?.message || 'Failed to delete some sessions');
            loadData();
        }
    };

    const handleGenerate = async ({ noteText, file, title, noteId, classId, coachConfig }) => {
        const classData = classId ? classes.find((c) => c.id === classId) : null;
        const className = classData?.name || null;
        const subject = classData?.subject || null;
        const result = await api.generateAiGuide(
            noteText, file, title, noteId,
            classId, className, null, coachConfig, subject,
        );
        toast.success('Tutor session generated!');
        navigate(`/guide/${result.guide_id}`);
    };

    const handleDelete = async () => {
        try {
            await api.deleteStudyGuide(deleteConfirm.item.id);
            toast.success(`${getGuideDisplayLabel(deleteConfirm.item)} deleted`);
            loadData();
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    // Open the create flow pre-targeted at the topics that still need work.
    const handleStudyNext = useCallback((topics = []) => {
        setStudyNextTopics(topics || []);
        setShowGenerateModal(true);
    }, []);

    if (loading) return (
        <div className="space-y-4 pt-4">
            {[1, 2, 3].map((_, idx) => (
                <div key={idx} className="claude-card p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 bg-claude-border rounded-xl" />
                    <div className="flex-1"><div className="h-4 bg-claude-border rounded w-3/4 mb-2" /><div className="h-3 bg-claude-border rounded w-1/2" /></div>
                </div>
            ))}
        </div>
    );

    if (error) return (
        <div className="text-center py-10">
            <div className="bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 p-6">
                <p className="font-medium mb-4">Couldn't load Tutor Sessions</p>
                <button onClick={loadData} className="claude-button-primary bg-red-500 text-white">Try Again</button>
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen pb-24">
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm.show}
                title={`Delete ${getGuideDisplayLabel(deleteConfirm.item || {})}?`}
                message={`This ${getGuideDisplayLabel(deleteConfirm.item || {})} will be permanently deleted.`}
                onConfirm={() => { handleDelete(); setDeleteConfirm({ show: false, item: null }); }}
                onCancel={() => setDeleteConfirm({ show: false, item: null })}
            />

            <CreateSessionSheet
                open={showGenerateModal}
                onClose={() => { setShowGenerateModal(false); setStudyNextTopics([]); }}
                onGenerate={handleGenerate}
                onPricingRequired={() => setShowPricingModal(true)}
                notes={notes}
                defaultTopics={studyNextTopics}
            />

            {/* Header */}
            <div className="mb-6 pt-4 px-1 flex items-end justify-between">
                <div>
                    <Link to="/decks" className="inline-flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors mb-1.5 tap-action">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Study</span>
                    </Link>
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-[#f59e0b] text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Tutor</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">Tutor Sessions</h1>
                    <p className="mt-2 text-sm text-claude-secondary">River-led active recall that turns setup answers, notes, or files into a one-card training flow.</p>
                </div>
                <div className="flex items-center gap-2">
                    {!isSelectMode ? (
                        <button
                            onClick={enterSelectMode}
                            className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center hover:-translate-y-1 active:scale-95"
                            aria-label="Enter selection mode"
                        >
                            <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    ) : (
                        <button
                            onClick={exitSelectMode}
                            className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-accent border border-claude-accent/40 tap-action flex items-center justify-center active:scale-95"
                            aria-label="Exit selection mode"
                        >
                            <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setStudyNextTopics([]);
                            setShowGenerateModal(true);
                        }}
                        className="min-h-[3.25rem] rounded-xl sm:rounded-2xl bg-claude-accent border border-claude-border/20 shadow-botanical-glow text-white hover:brightness-110 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center gap-2 px-3 sm:px-4 hover:-translate-y-1 hover:shadow-lg active:scale-95"
                        aria-label="Create tutor session"
                    >
                        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
                        <span className="hidden sm:inline text-[10px] font-mono font-bold uppercase tracking-[0.18em]">New session</span>
                    </button>
                </div>
            </div>

            {/* Coverage tracker */}
            {guides.length > 0 ? (
                <div className="px-1">
                    <CoverageTracker coverage={coverage} onStudyNext={handleStudyNext} />
                </div>
            ) : null}

            {/* Guides Grid */}
            <div className="px-1">
                {guides.length === 0 ? (
                    <div className="text-center py-16 glass-panel border-dashed border-2 border-claude-border rounded-3xl">
                        <div className="mx-auto mb-3 max-w-[180px]">
                            <OnboardingArt className="w-full max-w-[180px]" />
                        </div>
                        <h3 className="font-serif italic text-xl text-claude-text opacity-70">No Tutor Sessions Yet</h3>
                        <p className="text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Start with what you are studying for, then add notes or a file only if you want extra context.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 pb-20">
                        {guides.map((guide, i) => (
                            <GuideCard
                                key={guide.id}
                                guide={guide}
                                classes={classes}
                                index={i}
                                isSelectMode={isSelectMode}
                                isSelected={selectedIds.has(guide.id)}
                                onToggle={toggleSelect}
                                visualConstrained={visualConstrained}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Bulk delete confirmation */}
            <ConfirmModal
                isOpen={bulkDeleteConfirm}
                title={`Delete ${selectedCount} tutor session${selectedCount === 1 ? '' : 's'}?`}
                message={`This will permanently delete ${selectedCount} selected tutor session${selectedCount === 1 ? '' : 's'}. This cannot be undone.`}
                confirmText="Delete All"
                onConfirm={() => { setBulkDeleteConfirm(false); handleBulkDelete(); }}
                onCancel={() => setBulkDeleteConfirm(false)}
                destructive
            />

            {/* Bulk action bar */}
            <BulkActionBar
                isVisible={isSelectMode && selectedCount > 0}
                selectedCount={selectedCount}
                isAllSelected={isAllSelected}
                onSelectAll={toggleSelectAll}
                onDelete={() => setBulkDeleteConfirm(true)}
                onExit={exitSelectMode}
            />
        </div>
    );
}
