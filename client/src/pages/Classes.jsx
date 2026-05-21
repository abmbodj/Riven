import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
    Calendar, RefreshCw, X, Plus, Sparkles, BookOpen, MapPin, Video, User, Trash2, Upload, Loader2, Layers, CheckCircle2,
    Lock, Network, Link, Crown, CheckSquare
} from 'lucide-react';
import InlineCalendar from '../components/calendar/InlineCalendar';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import ClassTimeInput from '../components/schedule/ClassTimeInput';
import useHaptics from '../hooks/useHaptics';
import { canvasIcalUrlSchema, classNameSchema } from '../schemas/forms';
import { scheduleAssignmentNotifications } from '../utils/notifications';
import { buildDefaultClassTimeRow, isValidTimeRange } from '../utils/classTime';
import { inferSubject, SUBJECT_VALUES } from '../utils/subjectInference';
import CanvasSemesterCleanupModal from '../components/canvas/CanvasSemesterCleanupModal';
import { useSelection } from '../hooks/useSelection';
import BulkActionBar from '../components/BulkActionBar';
import { useIsVisualBudgetConstrained } from '../hooks/useVisualBudget';


const CLASS_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6',
    '#7a9e72', '#b8a379', '#c47c7c', '#5e7b8f'
];

const ClassCard = memo(({ cls, index, onClick, isSelectMode = false, isSelected = false, onToggle, visualConstrained = false }) => {
    const handleActivate = () => {
        if (isSelectMode) {
            onToggle?.(cls.id);
            return;
        }
        onClick?.();
    };

    const handleKeyDown = (event) => {
        if (!isSelectMode) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle?.(cls.id);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.8 : 0.8 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.3 } }}
            transition={{ delay: visualConstrained ? 0 : (index % 10) * 0.05, duration: visualConstrained ? 0.28 : 0.55, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
            role={isSelectMode ? 'button' : undefined}
            aria-pressed={isSelectMode ? isSelected : undefined}
            tabIndex={isSelectMode ? 0 : undefined}
            className="perf-card relative tap-action group cursor-pointer"
        >
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-claude-border/60 rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 md:backdrop-blur-sm pointer-events-none" />

            <div className={`relative block bg-claude-surface border p-5 sm:p-6 pt-7 sm:pt-8 rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 overflow-hidden active:scale-[0.97] ${isSelected ? 'border-claude-accent ring-2 ring-claude-accent/60 bg-claude-accent/5' : 'border-claude-border'}`}>
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary hidden xs:inline">ID:{cls.id?.toString().slice(-6) || '000000'}</span>
                        <div className="h-px flex-1 bg-claude-border/40" />
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-claude-secondary italic">Added: {new Date(cls.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-start gap-4">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border border-current/10 shadow-inner"
                            style={{ backgroundColor: (cls.color || 'var(--accent-color)') + '15', color: cls.color || 'var(--accent-color)' }}
                        >
                            <Calendar className="w-5 h-5 opacity-80" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-serif text-xl sm:text-2xl font-bold text-claude-text leading-[1.1] group-hover:text-claude-accent transition-colors duration-300 italic mb-3 tracking-tight truncate">{cls.name}</h3>

                            <div className="space-y-1.5 mt-2">
                                {cls.professor && (
                                    <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-claude-secondary truncate">
                                        <User className="w-3.5 h-3.5 opacity-60 shrink-0" /> <span className="truncate">{cls.professor}</span>
                                    </div>
                                )}
                                {cls.room && (
                                    <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-claude-secondary truncate">
                                        <MapPin className="w-3.5 h-3.5 opacity-60 shrink-0" /> <span className="truncate">{cls.room}</span>
                                    </div>
                                )}
                                {cls.zoom_link && (
                                    <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#3b82f6] truncate">
                                        <Video className="w-3.5 h-3.5 opacity-60 shrink-0" /> <span className="truncate">{cls.zoom_link}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute -bottom-4 -right-4 opacity-[0.03] transition-opacity duration-700 pointer-events-none group-active:opacity-[0.08] transform scale-150">
                    <BookOpen className="w-32 h-32" />
                </div>

                {isSelectMode && (
                    <div className={`absolute top-3 right-3 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 pointer-events-none ${isSelected ? 'bg-claude-accent border-claude-accent' : 'border-claude-border bg-claude-bg/80 backdrop-blur-sm'}`}>
                        {isSelected && (
                            <svg className="w-3.5 h-3.5 text-[#162a31]" viewBox="0 0 14 14" fill="none">
                                <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
});
ClassCard.displayName = 'ClassCard';

export default function Classes() {
    const visualConstrained = useIsVisualBudgetConstrained();
    const navigate = useNavigate();
    const toast = useToast();
    const { user } = useAuth();
    const isPremium = user?.subscription_tier === 'supporter' || user?.subscription_tier === 'lifetime';
    const [classes, setClasses] = useState([]);
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState('Roster'); // 'Roster' | 'Calendar'

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
    const [pricingOpen, setPricingOpen] = useState(false);

    // Form
    const [formData, setFormData] = useState({
        name: '', color: '#7a9e72', professor: '', room: '', zoom_link: '', subject: '', times: [buildDefaultClassTimeRow()], assignments: []
    });

    const [subjectManuallySet, setSubjectManuallySet] = useState(false);

    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiFile, setAiFile] = useState(null);
    const [aiFilePreview, setAiFilePreview] = useState('');

    const [creationMethod, setCreationMethod] = useState('manual'); // 'manual' | 'ai' | 'canvas'
    const [canvasStatus, setCanvasStatus] = useState({ isConnected: false, url: '', loading: true, syncing: false });
    const [canvasFormUrl, setCanvasFormUrl] = useState('');
    const [semesterCleanupOpen, setSemesterCleanupOpen] = useState(false);
    const haptics = useHaptics();
    const activeClasses = useMemo(() => classes.filter(cls => !cls.is_archived), [classes]);
    const activeClassIdSet = useMemo(() => new Set(activeClasses.map(cls => cls.id)), [activeClasses]);
    const selectableClasses = activeClasses;
    const {
        isSelectMode,
        selectedIds,
        selectedCount,
        isAllSelected,
        enterSelectMode,
        exitSelectMode,
        toggleSelect,
        toggleSelectAll,
    } = useSelection(selectableClasses);

    const fetchCanvasStatus = useCallback(async () => {
        try {
            const res = await api.getCanvasSettings();
            setCanvasStatus(prev => ({ ...prev, isConnected: res.isConnected, url: res.canvasUrl || '', loading: false }));
        } catch (err) {
            console.error(err);
            setCanvasStatus(prev => ({ ...prev, loading: false }));
        }
    }, []);

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const data = await api.getClasses();
            setClasses(data);
            const schedData = await api.getSchedule();
            setScheduleSlots(schedData);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load classes');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
        fetchCanvasStatus();
    }, [loadData, fetchCanvasStatus]);

    const handleSave = async (e) => {
        e.preventDefault();
        const result = classNameSchema.safeParse(formData.name.trim());
        if (!result.success) {
            toast.error(result.error.errors[0]?.message || 'Class name is required');
            return;
        }
        const validatedName = result.data;
        const invalidTimeRows = formData.times.filter((slot) => slot.day !== '' && !isValidTimeRange(slot.start_time, slot.end_time));
        if (invalidTimeRows.length > 0) {
            toast.error('Each class time must end after it starts.');
            return;
        }

        try {
            let savedClassId;
            if (editingClass) {
                await api.updateClass(editingClass.id, validatedName, formData.color, formData.professor, formData.room, formData.zoom_link, formData.subject || null);
                savedClassId = editingClass.id;
                toast.success('Class updated');
            } else {
                const newClass = await api.createClass(validatedName, formData.color, formData.professor, formData.room, formData.zoom_link, formData.subject || null);
                savedClassId = newClass?.id;
                toast.success('Class created');
            }

            if (savedClassId) {
                // If editing, existing slots will be in scheduleSlots state. We need to diff.
                const existingSlots = scheduleSlots.filter(s => s.class_id === savedClassId);
                const slotsToKeepIds = formData.times.filter(t => t.id).map(t => t.id);

                // Delete removed slots
                const slotsToDelete = existingSlots.filter(s => !slotsToKeepIds.includes(s.id));
                for (const slot of slotsToDelete) {
                    await api.deleteScheduleSlot(slot.id);
                }

                // Add new slots
                const slotsToAdd = formData.times.filter(t => (!t.id && t.day !== '' && t.start_time && t.end_time));
                for (const slot of slotsToAdd) {
                    await api.createScheduleSlot(savedClassId, slot.day, slot.start_time, slot.end_time);
                }

                if (formData.assignments && formData.assignments.length > 0) {
                    for (const assign of formData.assignments) {
                        try {
                            await api.createAssignment(savedClassId, assign.title, assign.description, assign.due_date, assign.type);
                        } catch (err) {
                            console.error("Failed to create isolated assignment:", err);
                        }
                    }
                }
            }

            setShowModal(false);
            setEditingClass(null);
            setFormData({ name: '', color: '#7a9e72', professor: '', room: '', zoom_link: '', subject: '', times: [buildDefaultClassTimeRow()], assignments: [] });
            setAiFile(null);
            setAiFilePreview('');
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to save class');
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setAiFile({
                data: reader.result.split(',')[1],
                mimeType: file.type
            });
            setAiFilePreview(file.name);
        };
        reader.readAsDataURL(file);
    };

    const removeFile = () => {
        setAiFile(null);
        setAiFilePreview('');
    };

    const handleGenerateAI = async () => {
        if (!aiFile) {
            toast.error('Please upload a syllabus file.');
            return;
        }

        setIsGeneratingAI(true);
        try {
            const result = await api.generateAiClass('', aiFile);
            const { classData } = result;

            toast.success('Successfully extracted syllabus data!');

            // Map days
            const newTimes = [];
            if (classData.times && classData.times.length > 0) {
                classData.times.forEach(t => {
                    newTimes.push({
                        day: String(t.day),
                        start_time: t.start_time,
                        end_time: t.end_time,
                        id: null
                    });
                });
            } else {
                newTimes.push(buildDefaultClassTimeRow());
            }

            setFormData({
                ...formData,
                name: classData.name || formData.name,
                professor: classData.professor || formData.professor,
                room: classData.room || formData.room,
                times: newTimes,
                assignments: classData.assignments || []
            });

            setAiFile(null);
            setAiFilePreview('');

        } catch (err) {
            toast.error(err.message || 'Failed to process syllabus.');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleCanvasConnect = async () => {
        const result = canvasIcalUrlSchema.safeParse(canvasFormUrl.trim());
        if (!result.success) {
            toast.error(result.error.errors[0]?.message || 'Please enter a valid Canvas link.');
            return;
        }

        setCanvasStatus(prev => ({ ...prev, loading: true }));
        try {
            await api.connectCanvas(result.data);
            setCanvasStatus(prev => ({ ...prev, isConnected: true, url: 'Canvas Feed Active', loading: false }));
            setCanvasFormUrl('');
            toast.success('Canvas connected! Beginning initial sync...');

            // Auto start sync
            handleCanvasSync();
        } catch (err) {
            toast.error(err.message || 'Failed to connect Canvas.');
            setCanvasStatus(prev => ({ ...prev, loading: false }));
        }
    };

    const handleCanvasSync = async () => {
        setCanvasStatus(prev => ({ ...prev, syncing: true }));
        try {
            const res = await api.syncCanvas();
            toast.success(`Synced ${res.classesAdded} classes and ${res.assignmentsAdded} assignments!`);
            handleCloseModal();
            loadData(true);
            
            // Trigger a global assignment fetch to reschedule everything
            try {
                const allAssignments = await api.getAssignments();
                const saved = localStorage.getItem('notifications_enabled');
                const notificationsEnabled = saved === null ? true : saved === 'true';
                scheduleAssignmentNotifications(allAssignments, notificationsEnabled);
            } catch (e) {
                console.error("Failed to reschedule after Canvas sync", e);
            }

        } catch (err) {
            toast.error(err.message || 'Canvas sync failed.');
        } finally {
            setCanvasStatus(prev => ({ ...prev, syncing: false }));
        }
    };

    const handleSemesterCleanupArchived = (result) => {
        toast.success(`Archived ${result.classesArchived} classes for the semester.`);
        loadData(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingClass(null);
        setFormData({ name: '', color: '#7a9e72', professor: '', room: '', zoom_link: '', subject: '', times: [buildDefaultClassTimeRow()], assignments: [] });
        setSubjectManuallySet(false);
        setAiFile(null);
        setAiFilePreview('');
        setCreationMethod('manual');
    };

    const handleDelete = async () => {
        try {
            await api.deleteClass(deleteConfirm.item.id);
            toast.success('Class deleted');
            setDeleteConfirm({ show: false, item: null });
            setShowModal(false);
            setEditingClass(null);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete class');
        }
    };

    const handleBulkDelete = async () => {
        const ids = [...selectedIds].filter(id => activeClassIdSet.has(id));
        if (ids.length === 0) return;
        const idSet = new Set(ids);

        setClasses(prev => prev.filter(cls => !idSet.has(cls.id)));
        exitSelectMode();

        try {
            await Promise.all(ids.map(id => api.deleteClass(id)));
            toast.success(`${ids.length} class${ids.length === 1 ? '' : 'es'} deleted`);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error(err?.message || 'Failed to delete some classes');
            loadData();
        }
    };

    const openCreateModal = () => {
        setEditingClass(null);
        setSubjectManuallySet(false);
        setFormData({ name: '', color: '#7a9e72', professor: '', room: '', zoom_link: '', subject: '', times: [buildDefaultClassTimeRow()], assignments: [] });
        setAiFile(null);
        setAiFilePreview('');
        setCreationMethod('manual');
        fetchCanvasStatus();
        setShowModal(true);
    };

    const confirmDelete = (cls) => {
        setDeleteConfirm({ show: true, item: cls });
    };

    if (loading) return (
        <div className="p-6 pt-4 pb-24 min-h-screen space-y-4">
            <div className="h-12 w-48 bg-claude-border rounded-xl animate-pulse mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {[1, 2, 3].map((_, idx) => (
                    <div key={idx} className="h-48 bg-claude-surface border border-claude-border rounded-sm animate-pulse" />
                ))}
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen pb-24">
            {/* Header Area */}
            <div className="mb-6 pt-4 px-4 sm:px-6 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-claude-accent text-claude-text text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Education</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-claude-text tracking-tighter leading-none">Classes</h1>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                        onClick={openCreateModal}
                        aria-label="Add class"
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-claude-accent/20 border border-claude-accent/40 rounded-xl sm:rounded-2xl text-claude-accent hover:text-white hover:bg-claude-accent/40 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    {activeClasses.length > 0 && (
                        <button
                            onClick={() => setSemesterCleanupOpen(true)}
                            aria-label="End semester"
                            title="End Semester"
                            className="h-[3.25rem] sm:h-[3.75rem] inline-flex items-center justify-center gap-2 px-3 sm:px-4 border border-claude-accent/30 bg-claude-accent/10 text-claude-accent rounded-xl sm:rounded-2xl hover:bg-claude-accent/20 hover:text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action disabled:opacity-50 transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                        >
                            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
                            <span className="hidden md:inline font-mono text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap">End Semester</span>
                        </button>
                    )}
                    {!isSelectMode ? (
                        <button
                            onClick={() => {
                                setViewMode('Roster');
                                enterSelectMode();
                            }}
                            className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
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
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        aria-label="Refresh classes"
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] glass-panel rounded-xl sm:rounded-2xl text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action disabled:opacity-50 flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Classes List */}
            <div className="px-4 sm:px-6">
                {/* Segmented Control */}
                <div className="flex glass-panel rounded-xl p-1 mb-6 max-w-xs transition-[transform,opacity,color,background-color,border-color,box-shadow]">
                    {['Calendar', 'Roster'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => {
                                setViewMode(mode);
                                if (mode === 'Calendar') exitSelectMode();
                            }}
                            className={`flex-1 py-2 font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action ${viewMode === mode ? 'bg-claude-accent text-claude-text shadow-sm' : 'text-claude-secondary hover:text-claude-text'}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                {viewMode === 'Calendar' && (
                    <InlineCalendar classes={classes} scheduleSlots={scheduleSlots} />
                )}

                {viewMode === 'Roster' && (() => {
                    const currentClasses = activeClasses;
                    const archivedClasses = classes.filter(c => c.is_archived);

                    return (
                        <>
                            {/* Current Courses */}
                            {currentClasses.length === 0 && archivedClasses.length === 0 ? (
                                <div className="text-center py-16 glass-panel border-dashed border-2 border-claude-border rounded-3xl mt-8">
                                    <Sparkles className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                                    <h3 className="font-serif italic text-xl text-claude-text opacity-40">No Classes</h3>
                                    <p className="text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)] text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Track your courses by adding a class.</p>
                                    <button onClick={openCreateModal} className="mt-6 px-6 py-3 bg-claude-accent/20 border border-claude-accent/30 text-claude-accent rounded-xl font-mono text-xs uppercase tracking-widest font-bold tap-action hover:bg-claude-accent hover:text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow]">
                                        Add First Class
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                                        {currentClasses.map((cls, i) => (
                                            <ClassCard
                                                key={cls.id}
                                                cls={cls}
                                                index={i}
                                                onClick={() => navigate(`/class/${cls.id}`)}
                                                isSelectMode={isSelectMode}
                                                isSelected={selectedIds.has(cls.id)}
                                                onToggle={toggleSelect}
                                                visualConstrained={visualConstrained}
                                            />
                                        ))}
                                    </div>

                                    {/* Past Courses */}
                                    {archivedClasses.length > 0 && (
                                        <div className="mt-10">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">Past Courses</span>
                                                <div className="flex-1 h-px bg-claude-surface/40" />
                                                <span className="font-mono text-[9px] text-[color-mix(in_srgb,var(--secondary-text-color)_40%,transparent)]">{archivedClasses.length}</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 opacity-50">
                                                {archivedClasses.map((cls, i) => (
                                                    <ClassCard
                                                        key={cls.id}
                                                        cls={cls}
                                                        index={i}
                                                        onClick={() => navigate(`/class/${cls.id}`)}
                                                        visualConstrained={visualConstrained}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    );
                })()}

            </div>

            <ConfirmModal
                isOpen={deleteConfirm.show}
                title="Delete Class?"
                message="Are you sure you want to remove this class from your schedule? Associated data might be affected."
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm({ show: false, item: null })}
            />

            <ConfirmModal
                isOpen={bulkDeleteConfirm}
                title={`Delete ${selectedCount} class${selectedCount === 1 ? '' : 'es'}?`}
                message={`This will permanently delete ${selectedCount} selected class${selectedCount === 1 ? '' : 'es'}. This cannot be undone.`}
                confirmText="Delete All"
                onConfirm={() => {
                    setBulkDeleteConfirm(false);
                    handleBulkDelete();
                }}
                onCancel={() => setBulkDeleteConfirm(false)}
                destructive
            />

            <BulkActionBar
                isVisible={isSelectMode && selectedCount > 0}
                selectedCount={selectedCount}
                isAllSelected={isAllSelected}
                onSelectAll={toggleSelectAll}
                onDelete={() => setBulkDeleteConfirm(true)}
                onExit={exitSelectMode}
            />

            <PricingModal
                isOpen={pricingOpen}
                onClose={() => setPricingOpen(false)}
                currentTier={user?.subscription_tier || 'free'}
            />

            <CanvasSemesterCleanupModal
                isOpen={semesterCleanupOpen}
                onClose={() => setSemesterCleanupOpen(false)}
                onArchived={handleSemesterCleanupArchived}
            />

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseModal} className="absolute inset-0 bg-claude-bg/80 md:backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleSave}
                            className="relative bg-claude-bg w-full p-8 rounded-t-[3rem] border-t border-claude-border pb-safe max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-8 sticky top-0 bg-claude-bg pt-2 pb-4 z-10">
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">{editingClass ? 'Edit Class' : 'New Class'}</h3>
                                <div className="flex items-center gap-2">
                                    {editingClass && (
                                        <button type="button" onClick={() => confirmDelete(editingClass)} className="p-2 text-red-400 hover:text-red-300 transition-colors">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button type="button" onClick={handleCloseModal} className="p-2 text-claude-secondary hover:text-claude-text transition-colors">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {!editingClass && (
                                    <div className="mb-6">
                                        <div className="flex p-1 glass-panel rounded-xl mb-6 max-w-full overflow-x-auto hide-scrollbar">
                                            {[
                                                { id: 'manual', label: 'Manual', icon: BookOpen },
                                                { id: 'ai', label: 'AI Syllabus', icon: Sparkles },
                                                { id: 'canvas', label: 'Canvas Sync', icon: Network }
                                            ].map(method => {
                                                const isActive = creationMethod === method.id;
                                                const Icon = method.icon;
                                                const isCanvasLocked = method.id === 'canvas' && !isPremium;
                                                return (
                                                    <button
                                                        key={method.id}
                                                        type="button"
                                                        onClick={() => {
                                                            haptics.light();
                                                            if (isCanvasLocked) {
                                                                setPricingOpen(true);
                                                            } else {
                                                                setCreationMethod(method.id);
                                                            }
                                                        }}
                                                        className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-mono text-[10px] uppercase font-bold tracking-widest transition-[transform,opacity,color,background-color,border-color,box-shadow] ${isActive ? 'bg-claude-accent text-claude-text shadow-sm' : 'text-claude-secondary hover:text-claude-text'}`}
                                                    >
                                                        <Icon className="w-3.5 h-3.5" />
                                                        <span className="truncate">{method.label}</span>
                                                        {isCanvasLocked && (
                                                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <AnimatePresence mode="wait">
                                            {creationMethod === 'canvas' && (
                                                <motion.div
                                                    key="canvas"
                                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl relative overflow-hidden"
                                                >
                                                    <div className="absolute -top-4 -right-4 w-32 h-32 opacity-10 pointer-events-none text-blue-500">
                                                        {/* Icon placeholder for Network/Canvas */}
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="9" y="2" width="6" height="6" rx="1" /><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" /><path d="M12 12V8" /></svg>
                                                    </div>
                                                    <div className="relative z-10">
                                                        <h4 className="font-serif italic font-bold text-lg text-claude-text flex items-center gap-2 mb-2">
                                                            Import from Canvas
                                                        </h4>

                                                        {canvasStatus.isConnected ? (
                                                            <div className="space-y-4 pt-2">
                                                                <p className="text-xs font-mono text-claude-secondary">
                                                                    Your account is already linked to Canvas. Riven checks for updates about every 12 hours, and you can still sync manually any time.
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { haptics.medium(); handleCanvasSync(); }}
                                                                    disabled={canvasStatus.syncing}
                                                                    className="w-full h-11 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50 active:scale-[0.98] shadow-md shadow-blue-500/20"
                                                                >
                                                                    {canvasStatus.syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                                    {canvasStatus.syncing ? 'Syncing...' : 'Sync Now'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { haptics.medium(); setSemesterCleanupOpen(true); }}
                                                                    className="w-full h-11 flex items-center justify-center gap-2 border border-claude-accent/30 bg-claude-accent/10 text-claude-accent rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98]"
                                                                >
                                                                    <Layers className="w-4 h-4" />
                                                                    End Semester
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4 pt-2">
                                                                <p className="text-xs font-mono text-claude-secondary">
                                                                    Connect your Canvas Calendar feed to instantly auto-fill your classes and assignments.
                                                                </p>
                                                                <input
                                                                    type="url"
                                                                    placeholder="Canvas Calendar Link (.ics)"
                                                                    value={canvasFormUrl}
                                                                    onChange={e => setCanvasFormUrl(e.target.value)}
                                                                    className="w-full glass-panel border border-blue-500/30 rounded-xl px-4 py-3 font-mono text-sm text-claude-text focus:border-blue-500 outline-none placeholder-claude-secondary/50"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { haptics.medium(); handleCanvasConnect(); }}
                                                                    disabled={canvasStatus.loading || !canvasFormUrl.trim()}
                                                                    className="w-full h-11 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50 active:scale-[0.98] shadow-md shadow-blue-500/20"
                                                                >
                                                                    {canvasStatus.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                                                    {canvasStatus.loading ? 'Connecting...' : 'Connect & Sync'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}

                                            {creationMethod === 'ai' && (
                                                <motion.div
                                                    key="ai"
                                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="p-5 bg-claude-accent/5 border border-claude-accent/20 rounded-2xl relative overflow-hidden"
                                                >
                                                    <div className="absolute -top-4 -right-4 w-32 h-32 opacity-5 pointer-events-none text-claude-accent">
                                                        <Sparkles className="w-full h-full" />
                                                    </div>
                                                    <div className="relative z-10">
                                                        <h4 className="font-serif italic font-bold text-lg text-claude-text flex items-center gap-2 mb-2">
                                                            <Sparkles className="w-4 h-4 text-claude-accent" /> Auto-fill with AI
                                                        </h4>
                                                        <p className="text-xs font-mono text-claude-secondary mb-4">Upload your syllabus (PDF or Image) and let AI extract the class details, schedule, and assignments automatically.</p>

                                                        {aiFilePreview ? (
                                                            <div className="flex items-center justify-between glass-panel rounded-xl p-3 mb-3">
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <div className="w-8 h-8 rounded shrink-0 bg-claude-surface flex items-center justify-center text-claude-secondary">
                                                                        <Layers className="w-4 h-4" />
                                                                    </div>
                                                                    <span className="font-mono text-xs text-claude-text truncate">{aiFilePreview}</span>
                                                                </div>
                                                                <button type="button" onClick={removeFile} className="p-2 text-red-400 hover:text-red-300 transition-colors">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="mb-3">
                                                                <label className="flex items-center justify-center w-full h-12 px-4 glass-panel border border-dashed border-claude-border rounded-xl cursor-pointer hover:border-claude-accent/50 transition-colors group">
                                                                    <div className="flex items-center gap-2 text-claude-secondary group-hover:text-claude-accent">
                                                                        <Upload className="w-4 h-4" />
                                                                        <span className="font-mono text-xs uppercase tracking-widest font-bold">Upload Syllabus</span>
                                                                    </div>
                                                                    <input type="file" className="hidden" accept="image/*,application/pdf,line/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={handleFileChange} />
                                                                </label>
                                                            </div>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={handleGenerateAI}
                                                            disabled={isGeneratingAI || !aiFile}
                                                            className="w-full h-11 flex items-center justify-center gap-2 bg-claude-accent/10 hover:bg-claude-accent/20 border border-claude-accent/40 text-claude-accent rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]"
                                                        >
                                                            {isGeneratingAI ? (
                                                                <>
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                    Extracting Data...
                                                                </>
                                                            ) : (
                                                                'Process Syllabus'
                                                            )}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {formData.assignments?.length > 0 && (
                                    <div className="mb-6 p-4 glass-panel rounded-2xl">
                                        <h4 className="font-serif italic font-bold text-sm text-claude-text mb-2 flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-claude-accent" /> {formData.assignments.length} Assignments Extracted
                                        </h4>
                                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                            {formData.assignments.map((a, i) => (
                                                <div key={i} className="flex justify-between items-center glass-panel p-2 rounded-lg text-xs font-mono">
                                                    <span className="text-claude-text truncate flex-1">{a.title}</span>
                                                    <span className="text-claude-secondary uppercase tracking-widest ml-2 shrink-0">{a.type}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <AnimatePresence>
                                    {(creationMethod === 'manual' || creationMethod === 'ai' || editingClass) && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-6"
                                        >
                                            {/* Name Entry */}
                                            <div>
                                                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Class Name *</label>
                                                <input
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={e => {
                                                        const name = e.target.value;
                                                        const updates = { ...formData, name };
                                                        if (!subjectManuallySet) {
                                                            updates.subject = inferSubject(name) || '';
                                                        }
                                                        setFormData(updates);
                                                    }}
                                                    className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none transition-colors"
                                                    placeholder="e.g. CS 101"
                                                    autoFocus
                                                    required={creationMethod === 'manual' || editingClass}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Professor Entry */}
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Professor</label>
                                                    <div className="relative">
                                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]" />
                                                        <input
                                                            type="text"
                                                            value={formData.professor}
                                                            onChange={e => setFormData({ ...formData, professor: e.target.value })}
                                                            className="w-full glass-panel rounded-xl pl-11 pr-4 py-3 font-mono text-sm text-claude-text focus:border-claude-accent outline-none transition-colors"
                                                            placeholder="Dr. Smith"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Subject Dropdown */}
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Subject</label>
                                                    <div className="relative">
                                                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]" />
                                                        <select
                                                            value={formData.subject}
                                                            onChange={e => {
                                                                setSubjectManuallySet(e.target.value !== '');
                                                                setFormData({ ...formData, subject: e.target.value });
                                                            }}
                                                            className="w-full glass-panel rounded-xl pl-11 pr-4 py-3 font-mono text-sm text-claude-text focus:border-claude-accent outline-none transition-colors appearance-none"
                                                        >
                                                            <option value="">Auto-detect</option>
                                                            {SUBJECT_VALUES.map(s => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Room Entry */}
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Room / Zoom Link</label>
                                                    <div className="relative">
                                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]" />
                                                        <input
                                                            type="text"
                                                            value={formData.room}
                                                            onChange={e => setFormData({ ...formData, room: e.target.value })}
                                                            className="w-full glass-panel rounded-xl pl-11 pr-4 py-3 font-mono text-sm text-claude-text focus:border-claude-accent outline-none transition-colors"
                                                            placeholder="Room 101 or Zoom URL"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Times */}
                                                <div className="col-span-2">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary">Class Times</label>
                                                        <button type="button" onClick={() => setFormData({ ...formData, times: [...formData.times, buildDefaultClassTimeRow()] })} className="text-claude-accent text-[10px] font-mono uppercase tracking-widest font-bold hover:underline tap-action">
                                                            + Add Time
                                                        </button>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {formData.times.map((t, idx) => (
                                                            <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center glass-panel p-4 rounded-xl border border-claude-border">
                                                                <div className="w-full sm:w-1/3">
                                                                    <select
                                                                        value={t.day}
                                                                        onChange={e => {
                                                                            const newTimes = [...formData.times];
                                                                            newTimes[idx].day = e.target.value;
                                                                            setFormData({ ...formData, times: newTimes });
                                                                        }}
                                                                        className="w-full glass-panel rounded-xl px-3 py-2.5 font-mono text-sm text-claude-text focus:border-claude-accent outline-none transition-colors"
                                                                    >
                                                                        <option value="">Day</option>
                                                                        <option value="1">Monday</option>
                                                                        <option value="2">Tuesday</option>
                                                                        <option value="3">Wednesday</option>
                                                                        <option value="4">Thursday</option>
                                                                        <option value="5">Friday</option>
                                                                        <option value="6">Saturday</option>
                                                                        <option value="0">Sunday</option>
                                                                    </select>
                                                                </div>
                                                                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-2/3">
                                                                    <div className="w-full">
                                                                        <ClassTimeInput
                                                                            idPrefix={`class-time-start-${idx}`}
                                                                            label="Start"
                                                                            value={t.start_time}
                                                                            onChange={(nextTime) => {
                                                                                const newTimes = [...formData.times];
                                                                                newTimes[idx].start_time = nextTime;
                                                                                setFormData({ ...formData, times: newTimes });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="w-full">
                                                                        <ClassTimeInput
                                                                            idPrefix={`class-time-end-${idx}`}
                                                                            label="End"
                                                                            value={t.end_time}
                                                                            onChange={(nextTime) => {
                                                                                const newTimes = [...formData.times];
                                                                                newTimes[idx].end_time = nextTime;
                                                                                setFormData({ ...formData, times: newTimes });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    {formData.times.length > 1 && (
                                                                        <button type="button" onClick={() => {
                                                                            const newTimes = formData.times.filter((_, i) => i !== idx);
                                                                            setFormData({ ...formData, times: newTimes });
                                                                        }} className="w-full sm:w-auto p-2 sm:p-2.5 text-red-400 hover:bg-red-400/10 rounded-lg shrink-0 flex justify-center items-center transition-colors sm:self-end">
                                                                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {formData.times.some((slot) => slot.day !== '' && !isValidTimeRange(slot.start_time, slot.end_time)) && (
                                                        <p className="mt-3 text-[10px] font-mono font-bold uppercase tracking-widest text-red-400">
                                                            End time must be later than start time.
                                                        </p>
                                                    )}
                                                </div>

                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Color Label</label>
                                                <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                                                    {CLASS_COLORS.map(color => (
                                                        <button key={color} type="button" onClick={() => setFormData({ ...formData, color })} className={`w-10 h-10 rounded-xl flex-shrink-0 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action ${formData.color === color ? 'ring-2 ring-white ring-offset-4 ring-offset-claude-bg scale-110 shadow-md' : 'opacity-40 hover:opacity-80'}`} style={{ backgroundColor: color }} />
                                                    ))}
                                                </div>
                                            </div>

                                            <button type="submit" className="claude-button-primary w-full py-5 text-lg mt-4 shadow-sm md:shadow-lg active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow]">
                                                {editingClass ? 'Save Changes' : 'Create Class'}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
