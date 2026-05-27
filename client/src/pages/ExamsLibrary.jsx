import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ClipboardCheck, ChevronLeft, Sparkles, Calendar, Loader2, X, Upload, FileText, BookOpen,
    BarChart3, Trash2, CheckSquare
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import { useSelection } from '../hooks/useSelection';
import BulkActionBar from '../components/BulkActionBar';
import PricingModal from '../components/ui/PricingModal';
import ExamAnalytics from '../components/ExamAnalytics';

const ACCEPTED_FILES = '.pdf,.docx,.doc,.txt,image/*';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ExamCard = memo(({ exam, classes, index, onDelete, isSelectMode = false, isSelected = false, onToggle }) => {
    const cls = exam.class_id ? classes.find(c => c.id === exam.class_id) : null;

    const CardWrapper = isSelectMode ? 'div' : Link;
    const wrapperProps = isSelectMode
        ? {
            onClick: () => onToggle?.(exam.id),
            role: 'button',
            'aria-pressed': isSelected,
            tabIndex: 0,
            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(exam.id); } },
          }
        : { to: `/exam/${exam.id}` };
    const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0;
    const mcqCount = Array.isArray(exam.questions) ? exam.questions.filter(q => q.type !== 'short_answer').length : 0;
    const saCount = questionCount - mcqCount;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.8 : 0.8 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.3, ease: [0.33, 1, 0.68, 0.9] } }}
            transition={{ delay: (index % 10) * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative tap-action group/card"
        >
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-claude-border/60 rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 pointer-events-none" />

            <CardWrapper
                {...wrapperProps}
                className={`group relative block bg-claude-surface border p-5 sm:p-6 pt-7 sm:pt-8 rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 overflow-hidden active:scale-[0.97] touch-target ${isSelected ? 'border-claude-accent ring-2 ring-claude-accent/60 bg-claude-accent/5' : 'border-claude-border'}`}
            >
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />
                <div className="absolute inset-0 bg-gradient-to-br from-claude-text/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary italic">
                            {new Date(exam.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <div className="h-px flex-1 bg-claude-border/40" />
                        {exam.exam_mode && exam.exam_mode !== 'standard' && (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase bg-claude-accent/10 text-claude-accent border border-claude-accent/20">
                                {exam.exam_mode}
                            </span>
                        )}
                        <ClipboardCheck className="w-3 h-3 text-claude-secondary/50" />
                    </div>

                    <h3 className="font-serif text-lg sm:text-xl font-bold text-claude-text leading-[1.15] group-hover:text-claude-accent transition-colors duration-300 italic mb-3 tracking-tight line-clamp-2">
                        {exam.title}
                    </h3>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-claude-bg rounded-sm border border-claude-border shadow-sm">
                            <span className="font-mono text-[8px] sm:text-[9px] font-bold text-claude-secondary uppercase tracking-wider">
                                {mcqCount} MCQ{saCount > 0 ? ` + ${saCount} SA` : ''}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-claude-bg rounded-sm border border-claude-border shadow-sm">
                            <span className="font-mono text-[8px] sm:text-[9px] font-bold text-claude-secondary uppercase tracking-wider">
                                {exam.source_type === 'guide' ? 'From Guide' : exam.source_type === 'deck' ? 'From Deck' : 'From Notes'}
                            </span>
                        </div>

                        {cls && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border shadow-sm" style={{
                                borderColor: `${cls.color}40`,
                                backgroundColor: `${cls.color}10`,
                                color: cls.color,
                            }}>
                                <Calendar className="w-2.5 h-2.5" />
                                <span className="font-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">{cls.name}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute -bottom-4 -right-4 opacity-[0.03] transition-opacity duration-700 pointer-events-none group-active:opacity-[0.08] scale-[1.2] sm:scale-150">
                    <ClipboardCheck className="w-24 h-24 sm:w-32 sm:h-32" />
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
            </CardWrapper>

            {/* Per-card delete button — hidden in select mode */}
            {!isSelectMode && (
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(exam); }}
                    className="absolute top-2 right-2 z-20 p-2 rounded-lg bg-claude-bg/80 border border-claude-border text-claude-secondary hover:text-red-400 hover:border-red-500/30 transition-colors sm:opacity-0 sm:group-hover/card:opacity-100 tap-action"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}
        </motion.div>
    );
});
ExamCard.displayName = 'ExamCard';

export default function ExamsLibrary() {
    const navigate = useNavigate();
    const toast = useToast();
    const [exams, setExams] = useState([]);
    const [notes, setNotes] = useState([]);
    const [guides, setGuides] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState('insights'); // 'insights' | 'exams'
    const [insights, setInsights] = useState(null);
    const [insightsLoading, setInsightsLoading] = useState(true);

    // Generate form
    const [genSource, setGenSource] = useState('note');
    const [selectedNote, setSelectedNote] = useState(null);
    const [selectedGuide, setSelectedGuide] = useState(null);
    const [genFile, setGenFile] = useState(null);
    const [genTitle, setGenTitle] = useState('');
    const [genClassOverrideId, setGenClassOverrideId] = useState(null);

    const loadData = useCallback(async () => {
        try {
            const [examsData, notesData, guidesData, classesData] = await Promise.all([
                api.getMockExams().catch(() => []),
                api.getNotes().catch(() => []),
                api.getStudyGuides().catch(() => []),
                api.getClasses().catch(() => []),
            ]);
            setExams(examsData);
            setNotes(notesData);
            setGuides(guidesData);
            setClasses(classesData);
            setError(null);
        } catch (err) {
            setError(err?.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const loadInsights = useCallback(async () => {
        setInsightsLoading(true);
        try {
            const nextInsights = await api.getExamInsights();
            setInsights(nextInsights);
        } catch (err) {
            toast.error(err?.message || 'Failed to load exam insights');
            setInsights(null);
        } finally {
            setInsightsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadInsights();
    }, [loadInsights]);

    const {
        isSelectMode, selectedIds, selectedCount, isAllSelected,
        enterSelectMode, exitSelectMode, toggleSelect, toggleSelectAll,
    } = useSelection(exams);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab !== 'exams') exitSelectMode();
    };

    const handleBulkDelete = async () => {
        const ids = [...selectedIds];
        setExams(prev => prev.filter(e => !selectedIds.has(e.id)));
        exitSelectMode();
        try {
            await api.bulkDeleteMockExams(ids);
            toast.success(`${ids.length} exam${ids.length === 1 ? '' : 's'} deleted`);
            loadData();
            loadInsights();
        } catch (err) {
            toast.error(err?.message || 'Failed to delete some exams');
            loadData();
            loadInsights();
        }
    };

    const openGenerateModal = useCallback((preset = {}) => {
        setShowGenerateModal(true);
        setGenSource('note');
        setSelectedNote(null);
        setSelectedGuide(null);
        setGenFile(null);
        setGenTitle(preset.title || '');
        setGenClassOverrideId(preset.classId || null);
    }, []);

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

    const extractText = (doc) => {
        if (!doc?.content) return '';
        const texts = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.text) texts.push(node.text);
                if (node.content) walk(node.content);
            }
        };
        walk(doc.content);
        return texts.join('\n');
    };

    const generationClass = useMemo(
        () => (genClassOverrideId ? classes.find(c => c.id === genClassOverrideId) || null : null),
        [classes, genClassOverrideId]
    );

    const visibleNotes = useMemo(() => {
        if (!genClassOverrideId) return notes;
        const matching = notes.filter((note) => note.class_id === genClassOverrideId);
        return matching.length > 0 ? matching : notes;
    }, [notes, genClassOverrideId]);

    const visibleGuides = useMemo(() => {
        if (!genClassOverrideId) return guides;
        const matching = guides.filter((guide) => guide.class_id === genClassOverrideId);
        return matching.length > 0 ? matching : guides;
    }, [guides, genClassOverrideId]);

    const handleGenerate = async () => {
        let noteText = '';
        let file = null;
        let sourceType = 'notes';
        let sourceId = null;
        let classId = genClassOverrideId || null;

        if (genSource === 'note' && selectedNote) {
            const note = notes.find(n => n.id === selectedNote);
            if (!note) { toast.error('Select a note'); return; }
            noteText = extractText(note.content);
            sourceType = 'notes';
            sourceId = note.id;
            classId = note.class_id;
            if (!noteText.trim()) { toast.error('Selected note is empty'); return; }
        } else if (genSource === 'guide' && selectedGuide) {
            const guide = guides.find(g => g.id === selectedGuide);
            if (!guide) { toast.error('Select a guide'); return; }
            noteText = extractText(guide.content);
            sourceType = 'guide';
            sourceId = guide.id;
            classId = guide.class_id;
            if (!noteText.trim()) { toast.error('Selected guide is empty'); return; }
        } else if (genSource === 'file' && genFile) {
            file = genFile;
        } else {
            toast.error('Select a source');
            return;
        }

        setGenerating(true);
        try {
            const classData = classId ? classes.find(c => c.id === classId) : null;
            const className = classData?.name || null;
            const subject = classData?.subject || null;
            const result = await api.generateAiExam(
                noteText || null,
                file,
                genTitle || 'AI Mock Exam',
                sourceType,
                sourceId,
                classId,
                className,
                {
                    examMode: 'standard',
                    subject,
                }
            );
            toast.success(`Generated ${result.question_count} questions!`);
            setShowGenerateModal(false);
            navigate(`/exam/${result.exam_id}`);
        } catch (err) {
            if (err.status === 429) { setShowGenerateModal(false); setShowPricingModal(true); }
            else toast.error(err.message || 'Failed to generate exam');
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.deleteMockExam(deleteConfirm.item.id);
            toast.success('Exam deleted');
            loadData();
            loadInsights();
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    const handleInsightAction = useCallback((action) => {
        if (!action) return;

        if (action.kind === 'retake_exam' && action.examId) {
            navigate(`/exam/${action.examId}`);
            return;
        }

        if (action.kind === 'generate_standard') {
            openGenerateModal(action.payload || {});
        }
    }, [navigate, openGenerateModal]);

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
                <p className="font-medium mb-4">Couldn't load mock exams</p>
                <button onClick={loadData} className="claude-button-primary bg-red-500 text-white">Try Again</button>
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen pb-24">
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm.show}
                title="Delete exam?"
                message="This removes the mock exam from your library. Completed attempts stay in Insights Hub."
                onConfirm={() => { handleDelete(); setDeleteConfirm({ show: false, item: null }); }}
                onCancel={() => setDeleteConfirm({ show: false, item: null })}
            />

            {/* Generate Exam Modal */}
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
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">Generate Mock Exam</h3>
                                <button onClick={() => setShowGenerateModal(false)} className="p-2 text-claude-secondary"><X className="w-6 h-6" /></button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Title</label>
                                    <input type="text" value={genTitle} onChange={e => setGenTitle(e.target.value)} placeholder="AI Mock Exam" className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none" style={{ fontSize: '16px' }} />
                                </div>

                                {generationClass ? (
                                    <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/10 p-4">
                                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-accent">
                                            Class context
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {generationClass ? (
                                                <span className="rounded-full border border-claude-accent/25 bg-claude-bg/30 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-text">
                                                    {generationClass.name}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}

                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Source</label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'note', label: 'Note', icon: FileText },
                                            { id: 'guide', label: 'Guide', icon: BookOpen },
                                            { id: 'file', label: 'File', icon: Upload },
                                        ].map(s => (
                                            <button key={s.id} onClick={() => setGenSource(s.id)} className={`flex-1 p-3 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${genSource === s.id ? 'bg-claude-accent/20 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}>
                                                <s.icon className="w-3.5 h-3.5" />
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {genSource === 'note' && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {visibleNotes.length === 0 ? (
                                            <p className="text-claude-secondary italic font-serif text-sm text-center py-4">No notes yet</p>
                                        ) : visibleNotes.map(note => (
                                            <button key={note.id} onClick={() => setSelectedNote(note.id)} className={`w-full p-3 rounded-xl text-left border transition-all ${selectedNote === note.id ? 'bg-claude-accent/10 border-claude-accent/40 text-claude-accent' : 'glass-panel border-claude-border text-claude-text'}`}>
                                                <span className="font-serif italic text-sm">{note.title || 'Untitled'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {genSource === 'guide' && (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {visibleGuides.length === 0 ? (
                                            <p className="text-claude-secondary italic font-serif text-sm text-center py-4">No guides yet</p>
                                        ) : visibleGuides.map(guide => (
                                            <button key={guide.id} onClick={() => setSelectedGuide(guide.id)} className={`w-full p-3 rounded-xl text-left border transition-all ${selectedGuide === guide.id ? 'bg-claude-accent/10 border-claude-accent/40 text-claude-accent' : 'glass-panel border-claude-border text-claude-text'}`}>
                                                <span className="font-serif italic text-sm">{guide.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {genSource === 'file' && (
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
                                                <p className="text-[10px] font-mono uppercase tracking-widest text-claude-secondary">Tap to upload</p>
                                                <input type="file" accept={ACCEPTED_FILES} onChange={handleFileChange} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                )}

                                <button onClick={handleGenerate} disabled={generating} className="claude-button-primary w-full py-5 text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                    {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                    {generating ? 'Generating...' : 'Generate Exam'}
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
                        <span className="px-1.5 py-0.5 bg-[#ec4899] text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Test</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">Mock Exams</h1>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'exams' && (!isSelectMode ? (
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
                    ))}
                    <button
                        onClick={() => openGenerateModal()}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-claude-accent border border-claude-border/20 shadow-botanical-glow text-white rounded-xl sm:rounded-2xl hover:brightness-110 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                </div>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-2 px-1 mb-6">
                <button
                    onClick={() => handleTabChange('insights')}
                    className={`px-4 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold border transition-all tap-action ${activeTab === 'insights' ? 'bg-claude-accent/15 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}
                >
                    <BarChart3 className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                    Insights
                </button>
                <button
                    onClick={() => handleTabChange('exams')}
                    className={`px-4 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest font-bold border transition-all tap-action ${activeTab === 'exams' ? 'bg-claude-accent/15 border-claude-accent text-claude-accent' : 'glass-panel border-claude-border text-claude-secondary'}`}
                >
                    <ClipboardCheck className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                    Exams ({exams.length})
                </button>
            </div>

            {/* Content */}
            <div className="px-1">
                {activeTab === 'insights' ? (
                    <div className="space-y-4 pb-20">
                        <ExamAnalytics
                            insights={insights}
                            loading={insightsLoading}
                            onAction={handleInsightAction}
                        />
                    </div>
                ) : (
                    exams.length === 0 ? (
                        <div className="text-center py-16 glass-panel border-dashed border-2 border-claude-border rounded-3xl">
                            <ClipboardCheck className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                            <h3 className="font-serif italic text-xl text-claude-text opacity-40">No Mock Exams</h3>
                            <p className="text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Generate your first exam from notes or a Tutor Session.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 pb-20">
                            {exams.map((exam, i) => (
                                <ExamCard
                                    key={exam.id}
                                    exam={exam}
                                    classes={classes}
                                    index={i}
                                    onDelete={(item) => setDeleteConfirm({ show: true, item })}
                                    isSelectMode={isSelectMode}
                                    isSelected={selectedIds.has(exam.id)}
                                    onToggle={toggleSelect}
                                />
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Bulk delete confirmation */}
            <ConfirmModal
                isOpen={bulkDeleteConfirm}
                title={`Delete ${selectedCount} exam${selectedCount === 1 ? '' : 's'}?`}
                message={`This will permanently delete ${selectedCount} selected exam${selectedCount === 1 ? '' : 's'}. This cannot be undone.`}
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
