import React, { useEffect, useState, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    BookOpen, ChevronLeft, Sparkles, Calendar, Clock3, Loader2, X, Upload, Check, ArrowRight, Target, Play, CheckSquare
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

const ACCEPTED_FILES = '.pdf,.docx,.doc,.txt,image/*';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const COACH_TONES = ['calm review', 'focused', 'challenge'];

const parseListInput = (value) => (
    String(value || '')
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
);

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

export default function GuidesLibrary() {
    const visualConstrained = useIsVisualBudgetConstrained();
    const navigate = useNavigate();
    const toast = useToast();
    const [guides, setGuides] = useState([]);
    const [notes, setNotes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

    // Generate form
    const [genSource, setGenSource] = useState('none'); // 'none' | 'note' | 'file'
    const [selectedNotes, setSelectedNotes] = useState([]);
    const [genFile, setGenFile] = useState(null);
    const [genTitle, setGenTitle] = useState('');
    const [genExamLabel, setGenExamLabel] = useState('');
    const [genExamDate, setGenExamDate] = useState('');
    const [genTopics, setGenTopics] = useState('');
    const [genWeakTopics, setGenWeakTopics] = useState('');
    const [genTone, setGenTone] = useState('calm review');
    const [showSetupQuestions, setShowSetupQuestions] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const [guidesData, notesData, classesData] = await Promise.all([
                api.getStudyGuides().catch(() => []),
                api.getNotes().catch(() => []),
                api.getClasses().catch(() => []),
            ]);
            setGuides((guidesData || []).filter((guide) => isActiveRecallGuide(guide)));
            setNotes(notesData);
            setClasses(classesData);
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

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) { toast.error('File must be under 5MB'); return; }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            setGenFile({ data: base64, mimeType: file.type, name: file.name });
        };
        reader.readAsDataURL(file);
    };

    const extractTextFromNote = (note) => {
        if (!note?.content?.content) return '';
        const texts = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.text) texts.push(node.text);
                if (node.content) walk(node.content);
            }
        };
        walk(note.content.content);
        return texts.join('\n');
    };

    const toggleNoteSelection = (noteId) => {
        setSelectedNotes(prev =>
            prev.includes(noteId)
                ? prev.filter(id => id !== noteId)
                : [...prev, noteId]
        );
    };

    const handleGenerate = async () => {
        let noteText = '';
        let file = null;
        let noteId = null;
        let classId = null;
        const examLabel = genExamLabel.trim();
        const title = genTitle.trim() || (examLabel ? `${examLabel} Tutor Session` : 'Tutor Session');
        const userTopics = parseListInput(genTopics);
        const weakTopics = parseListInput(genWeakTopics);

        if (!examLabel) {
            toast.error('Tell us what you are studying for first');
            return;
        }

        if (genSource === 'note' && selectedNotes.length > 0) {
            const selected = selectedNotes.map(id => notes.find(n => n.id === id)).filter(Boolean);
            if (selected.length === 0) { toast.error('Select at least one note'); return; }
            noteText = selected.map(note => {
                const title = note.title || 'Untitled';
                const text = extractTextFromNote(note);
                return `--- ${title} ---\n${text}`;
            }).join('\n\n');
            if (!noteText.trim()) { toast.error('Selected notes are empty'); return; }
            noteId = selected.length === 1 ? selected[0].id : null;
            classId = selected[0].class_id;
        } else if (genSource === 'file' && genFile) {
            file = genFile;
        } else if (genSource === 'note' || genSource === 'file') {
            toast.error(genSource === 'note' ? 'Select at least one note' : 'Upload a file');
            return;
        }

        const hasSource = Boolean(noteText.trim() || file);
        const hasSetupDetails = Boolean(examLabel || genExamDate || userTopics.length || weakTopics.length || genTone);
        const coachConfig = {
            creationMode: hasSource && hasSetupDetails ? 'hybrid' : hasSource ? 'source' : 'setup',
            examLabel,
            ...(genExamDate ? { examDate: genExamDate } : {}),
            ...(userTopics.length ? { userTopics } : {}),
            ...(weakTopics.length ? { weakTopics } : {}),
            ...(genTone ? { preferredTone: genTone } : {}),
        };

        const classData = classId ? classes.find(c => c.id === classId) : null;
        const className = classData?.name || null;
        const subject = classData?.subject || null;

        setGenerating(true);
        try {
            const result = await api.generateAiGuide(
                noteText || null,
                file,
                title,
                noteId,
                classId,
                className,
                null,
                coachConfig,
                subject,
            );
            toast.success('Tutor session generated!');
            setShowGenerateModal(false);
            navigate(`/guide/${result.guide_id}`);
        } catch (err) {
            if (err.status === 429) { setShowGenerateModal(false); setShowPricingModal(true); }
            else toast.error(err.message || 'Failed to generate tutor session');
        } finally {
            setGenerating(false);
        }
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

            {/* Generate Guide Modal */}
            <AnimatePresence>
                {showGenerateModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGenerateModal(false)} className="absolute inset-0 bg-claude-bg/60 md:backdrop-blur-md" />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="relative bg-claude-bg w-full p-8 rounded-t-[3rem] border-t border-claude-border pb-safe max-h-[80dvh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">Create Tutor Session</h3>
                                <button onClick={() => setShowGenerateModal(false)} className="p-2 text-claude-secondary"><X className="w-6 h-6" /></button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <div className="mb-4 rounded-[2rem] border border-claude-border/70 bg-claude-surface/70 p-4 sm:p-5">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">River-led active recall</p>
                                                <p className="mt-2 text-sm leading-6 text-claude-text">
                                                    Start with the exam, weak spots, and preferred tone. Notes or a file can sharpen the first topic map, but they are optional.
                                                </p>
                                            </div>
                                            <OnboardingArt className="w-full max-w-[160px] sm:max-w-[150px]" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="coach-exam-label" className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">
                                        What are you studying for
                                    </label>
                                    <input
                                        id="coach-exam-label"
                                        type="text"
                                        value={genExamLabel}
                                        onChange={e => setGenExamLabel(e.target.value)}
                                        placeholder="AP Biology midterm, Organic Chemistry quiz, Civics final..."
                                        className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                    />
                                </div>

                                <div className="rounded-[2rem] border border-claude-border/70 bg-claude-bg/55 p-4 sm:p-5">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">4-question setup</p>
                                            <p className="mt-1 text-sm text-claude-secondary">Skip it in one tap if you just want the defaults.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowSetupQuestions((value) => !value)}
                                            className="rounded-full border border-claude-border px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:border-claude-accent/40 hover:text-claude-accent"
                                        >
                                            {showSetupQuestions ? 'Skip for now' : 'Show setup'}
                                        </button>
                                    </div>

                                    {showSetupQuestions ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="coach-exam-date" className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                                    What test or goal is this for, and when is it
                                                </label>
                                                <input
                                                    id="coach-exam-date"
                                                    type="date"
                                                    value={genExamDate}
                                                    onChange={(event) => setGenExamDate(event.target.value)}
                                                    className="w-full glass-panel border border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label htmlFor="coach-topics" className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                                    What topics should we cover
                                                </label>
                                                <textarea
                                                    id="coach-topics"
                                                    value={genTopics}
                                                    onChange={(event) => setGenTopics(event.target.value)}
                                                    placeholder="Cells, mitosis, membrane transport"
                                                    className="min-h-[110px] w-full glass-panel border border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none resize-none"
                                                />
                                            </div>

                                            <div>
                                                <label htmlFor="coach-weak-topics" className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                                    Which topics feel weakest right now
                                                </label>
                                                <textarea
                                                    id="coach-weak-topics"
                                                    value={genWeakTopics}
                                                    onChange={(event) => setGenWeakTopics(event.target.value)}
                                                    placeholder="Mitosis, meiosis"
                                                    className="min-h-[96px] w-full glass-panel border border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none resize-none"
                                                />
                                            </div>

                                            <div>
                                                <span className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                                    What tutor tone do you want
                                                </span>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                    {COACH_TONES.map((tone) => (
                                                        <button
                                                            key={tone}
                                                            type="button"
                                                            onClick={() => setGenTone(tone)}
                                                            className={`min-h-[48px] rounded-2xl border px-4 py-3 text-sm font-mono font-bold capitalize transition-all ${
                                                                genTone === tone
                                                                    ? 'border-claude-accent bg-claude-accent/10 text-claude-accent'
                                                                    : 'border-claude-border bg-claude-surface/50 text-claude-secondary'
                                                            }`}
                                                        >
                                                            {tone}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div>
                                    <label htmlFor="coach-title" className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">
                                        Coach title
                                    </label>
                                    <input
                                        id="coach-title"
                                        type="text"
                                        value={genTitle}
                                        onChange={e => setGenTitle(e.target.value)}
                                        placeholder={genExamLabel ? `${genExamLabel} Tutor Session` : 'Final Tutor Session'}
                                        className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Optional source material</label>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        <button type="button" onClick={() => setGenSource('none')} className={`p-3 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${genSource === 'none' ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}>
                                            No source yet
                                        </button>
                                        <button type="button" onClick={() => setGenSource('note')} className={`p-3 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${genSource === 'note' ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}>
                                            Add notes
                                        </button>
                                        <button type="button" onClick={() => setGenSource('file')} className={`p-3 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${genSource === 'file' ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}>
                                            Upload file
                                        </button>
                                    </div>
                                </div>

                                {genSource === 'note' ? (
                                    <div>
                                        {selectedNotes.length > 1 && (
                                            <p className="text-[10px] font-mono text-claude-accent mb-2 tracking-wider">{selectedNotes.length} notes selected — will be combined</p>
                                        )}
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {notes.length === 0 ? (
                                                <p className="text-claude-secondary italic font-serif text-sm text-center py-4">No notes yet</p>
                                            ) : notes.map(note => {
                                                const isSelected = selectedNotes.includes(note.id);
                                                return (
                                                    <button
                                                        key={note.id}
                                                        onClick={() => toggleNoteSelection(note.id)}
                                                        className={`w-full p-3 rounded-xl text-left border transition-all flex items-center gap-3 ${isSelected ? 'bg-claude-accent/10 border-claude-accent/40 text-claude-accent' : 'glass-panel border-claude-border text-claude-text'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-claude-accent border-claude-accent' : 'border-claude-border'}`}>
                                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <span className="font-serif italic text-sm truncate">{note.title || 'Untitled'}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {genFile ? (
                                            <div className="flex items-center gap-3 p-3 glass-panel rounded-xl border border-claude-border">
                                                <Upload className="w-4 h-4 text-claude-accent" />
                                                <span className="font-mono text-xs text-claude-text truncate flex-1">{genFile.name}</span>
                                                <button onClick={() => setGenFile(null)} className="text-claude-secondary hover:text-red-400"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <label className="block p-8 border-2 border-dashed border-claude-border rounded-2xl text-center cursor-pointer hover:border-claude-accent/30 transition-colors">
                                                <Upload className="w-8 h-8 text-claude-secondary mx-auto mb-2" />
                                                <p className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary">Tap to upload (PDF, DOCX, TXT, Image)</p>
                                                <input type="file" accept={ACCEPTED_FILES} onChange={handleFileChange} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="claude-button-primary w-full py-5 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                    {generating ? 'Building...' : 'Build Tutor Session'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="mb-6 pt-4 px-1 flex items-end justify-between">
                <div>
                    <Link to="/decks" className="inline-flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors mb-1.5 tap-action">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Study</span>
                    </Link>
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-[#f59e0b] text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">AI</span>
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
                            setShowGenerateModal(true);
                            setGenSource('none');
                            setSelectedNotes([]);
                            setGenFile(null);
                            setGenTitle('');
                            setGenExamLabel('');
                            setGenExamDate('');
                            setGenTopics('');
                            setGenWeakTopics('');
                            setGenTone('calm review');
                            setShowSetupQuestions(true);
                        }}
                        className="min-h-[3.25rem] rounded-xl sm:rounded-2xl bg-claude-accent border border-claude-border/20 shadow-botanical-glow text-white hover:brightness-110 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center gap-2 px-3 sm:px-4 hover:-translate-y-1 hover:shadow-lg active:scale-95"
                        aria-label="Create tutor session"
                    >
                        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
                        <span className="hidden sm:inline text-[10px] font-mono font-bold uppercase tracking-[0.18em]">New session</span>
                    </button>
                </div>
            </div>

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
