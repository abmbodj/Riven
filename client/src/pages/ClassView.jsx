import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'motion/react';
import {
    ChevronLeft, Settings, Library, Calendar, CheckCircle2, Circle, Clock, Plus, X, Trash2, Layers, Sparkles, Loader2, Upload
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import PricingModal from '../components/ui/PricingModal';
import ConfirmModal from '../components/ConfirmModal';

const STATUSES = ['Todo', 'Doing', 'Done', 'Archived'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatSlotTime(timeValue) {
    return new Date(`2000-01-01T${timeValue}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ClassView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [cls, setCls] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [decks, setDecks] = useState([]);
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPricingModal, setShowPricingModal] = useState(false);

    // Modal state for editing Class
    const [showEditClassModal, setShowEditClassModal] = useState(false);
    const [classFormData, setClassFormData] = useState({ name: '', color: '', professor: '', room: '', zoom_link: '' });
    const [deleteClassConfirm, setDeleteClassConfirm] = useState(false);

    // Modal state for Assignments
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [editingAssign, setEditingAssign] = useState(null);
    const [assignForm, setAssignForm] = useState({ title: '', description: '', due_date: '', status: 'Todo', type: 'homework' });
    const [deleteAssignConfirm, setDeleteAssignConfirm] = useState({ show: false, item: null });

    // Modal state for Schedule
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({ day_of_week: 1, start_time: '09:00', end_time: '10:00' });

    // AI Generation
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiFile, setAiFile] = useState(null);
    const [aiFilePreview, setAiFilePreview] = useState('');

    const loadData = useCallback(async () => {
        try {
            const classesData = await api.getClasses();
            const currentClass = classesData.find(c => c.id === id);

            if (!currentClass) {
                toast.error('Class not found');
                navigate('/classes');
                return;
            }
            setCls(currentClass);
            setClassFormData({
                name: currentClass.name,
                color: currentClass.color || 'var(--accent-color)',
                professor: currentClass.professor || '',
                room: currentClass.room || '',
                zoom_link: currentClass.zoom_link || ''
            });

            const assignData = await api.getAssignments(id);
            setAssignments(assignData);

            const allDecks = await api.getDecks();
            setDecks(allDecks.filter(d => d.class_id === id));

            const scheduleData = await api.getSchedule();
            setScheduleSlots(scheduleData.filter(s => s.class_id === id));
        } catch {
            toast.error('Failed to load class details');
            navigate('/classes');
        } finally {
            setLoading(false);
        }
    }, [id, navigate, toast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSaveClass = async (e) => {
        e.preventDefault();
        try {
            await api.updateClass(id, classFormData.name, classFormData.color, classFormData.professor, classFormData.room, classFormData.zoom_link);
            toast.success('Class updated');
            setShowEditClassModal(false);
            loadData();
        } catch {
            toast.error('Failed to update class');
        }
    };

    const handleDeleteClass = async () => {
        try {
            await api.deleteClass(id);
            toast.success('Class deleted');
            navigate('/classes');
        } catch {
            toast.error('Failed to delete class');
        }
    };

    const handleSaveAssignment = async (e) => {
        e.preventDefault();
        if (!assignForm.title.trim()) {
            toast.error('Title is required');
            return;
        }

        try {
            if (editingAssign) {
                await api.updateAssignment(editingAssign.id, assignForm);
                toast.success('Assignment updated');
            } else {
                await api.createAssignment(id, assignForm.title, assignForm.description, assignForm.due_date);
                toast.success('Assignment created');
            }
            setShowAssignModal(false);
            setEditingAssign(null);
            setAssignForm({ title: '', description: '', due_date: '', status: 'Todo', type: 'homework' });
            loadData();
        } catch {
            toast.error('Failed to save assignment');
        }
    };

    const handleDeleteAssignment = async () => {
        try {
            await api.deleteAssignment(deleteAssignConfirm.item.id);
            toast.success('Assignment deleted');
            setDeleteAssignConfirm({ show: false, item: null });
            setShowAssignModal(false);
            setEditingAssign(null);
            loadData();
        } catch {
            toast.error('Failed to delete assignment');
        }
    };

    const openCreateAssign = () => {
        setEditingAssign(null);
        setAssignForm({ title: '', description: '', due_date: '', status: 'Todo', type: 'homework' });
        setAiFile(null);
        setAiFilePreview('');
        setShowAssignModal(true);
    };

    const openEditAssign = (a) => {
        setEditingAssign(a);
        setAssignForm({
            title: a.title,
            description: a.description || '',
            due_date: a.due_date ? new Date(a.due_date).toISOString().slice(0, 16) : '',
            status: a.status,
            type: a.type || 'homework'
        });
        setAiFile(null);
        setAiFilePreview('');
        setShowAssignModal(true);
    };

    const toggleAssignStatus = async (e, a) => {
        e.stopPropagation();
        const nextStatus = a.status === 'Archived' ? 'Todo' : a.status === 'Todo' ? 'Doing' : (a.status === 'Doing' ? 'Done' : 'Todo');
        try {
            await api.updateAssignment(a.id, { status: nextStatus });
            loadData();
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleSaveScheduleSlot = async (e) => {
        e.preventDefault();
        try {
            await api.createScheduleSlot(id, scheduleForm.day_of_week, scheduleForm.start_time, scheduleForm.end_time);
            toast.success('Time slot added');
            setShowScheduleModal(false);
            setScheduleForm({ day_of_week: 1, start_time: '09:00', end_time: '10:00' });
            loadData();
        } catch {
            toast.error('Failed to add time slot');
        }
    };

    const handleDeleteScheduleSlot = async (slotId) => {
        try {
            await api.deleteScheduleSlot(slotId);
            toast.success('Time slot removed');
            loadData();
        } catch {
            toast.error('Failed to remove time slot');
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
                data: reader.result.split(',')[1], // Keep only the base64 part
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
            toast.error('Please upload a file to generate flashcards from.');
            return;
        }

        setIsGeneratingAI(true);
        try {
            const result = await api.generateAiDeck(
                assignForm.description,
                aiFile,
                `${assignForm.title} - AI ✨`,
                id
            );
            toast.success(`Generated ${result.card_count} flashcards!`);
            setShowAssignModal(false);
            loadData(); // Will refresh decks list
            navigate(`/deck/${result.deck_id}`);
        } catch (err) {
            if (err.status === 429) {
                setShowPricingModal(true);
            } else {
                toast.error(err.message || 'Failed to generate flashcards.');
            }
        } finally {
            setIsGeneratingAI(false);
        }
    };

    if (loading) return (
        <div className="p-6 pt-4 min-h-screen">
            <div className="h-8 w-24 bg-claude-border rounded-xl animate-pulse mb-6" />
            <div className="h-24 w-full bg-claude-surface border border-claude-border rounded-sm animate-pulse mb-8" />
            <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-16 w-full bg-claude-surface rounded-xl animate-pulse" />)}
            </div>
        </div>
    );

    const groupedAssignments = STATUSES.map(status => ({
        status,
        items: assignments.filter(a => a.status === status)
    }));
    const activeAssignments = assignments.filter((assignment) => assignment.status !== 'Done' && assignment.status !== 'Archived');
    const nextAssignment = [...activeAssignments]
        .filter((assignment) => assignment.due_date && !Number.isNaN(new Date(assignment.due_date).getTime()))
        .sort((left, right) => new Date(left.due_date) - new Date(right.due_date))[0] || null;
    const nextScheduleSlot = [...scheduleSlots]
        .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))[0] || null;
    const statTiles = [
        { label: 'Active Tasks', value: activeAssignments.length },
        { label: 'Decks', value: decks.length },
        { label: 'Class Times', value: scheduleSlots.length },
        { label: 'Completed', value: assignments.filter((assignment) => assignment.status === 'Done').length },
    ];

    return (
        <div className="relative min-h-screen pb-24">
            {/* Header */}
            <div className="sticky top-0 z-40 glass-panel md:backdrop-blur-xl border-b border-claude-border px-4 sm:px-6 py-4 flex items-center justify-between">
                <button
                    onClick={() => navigate('/classes')}
                    className="w-10 h-10 glass-panel rounded-xl flex items-center justify-center text-claude-secondary hover:text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowEditClassModal(true)}
                        className="w-10 h-10 glass-panel rounded-xl flex items-center justify-center text-claude-secondary hover:text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={openCreateAssign}
                        className="h-10 px-4 bg-claude-accent/20 border border-claude-accent/40 rounded-xl text-claude-accent font-mono text-xs uppercase tracking-widest font-bold hover:bg-claude-accent hover:text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Add Task</span>
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 py-6">
                {/* Class Details Hero */}
                <div className="relative bg-claude-surface border border-claude-border p-6 rounded-sm shadow-sm mb-8 overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none transform translate-x-8 -translate-y-8" style={{ color: cls.color || 'var(--accent-color)' }}>
                        <Library className="w-full h-full" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color || 'var(--accent-color)' }} />
                            <span className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary opacity-80">{cls.id.slice(-6)}</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-serif font-bold italic text-claude-text tracking-tight">{cls.name}</h1>
                        {(cls.professor || cls.room || cls.zoom_link) && (
                            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono font-bold uppercase tracking-wider text-claude-secondary">
                                {cls.professor && <span>Prof: {cls.professor}</span>}
                                {cls.room && <span>Loc: {cls.room}</span>}
                                {cls.zoom_link && <a href={cls.zoom_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Zoom</a>}
                            </div>
                        )}
                        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {statTiles.map((tile) => (
                                <div key={tile.label} className="rounded-2xl border border-claude-border bg-claude-surface/60 px-4 py-3">
                                    <div className="font-mono text-lg font-bold text-claude-text">{tile.value}</div>
                                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-claude-secondary">{tile.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_360px]">
                    <div className="space-y-8">
                        <div className="rounded-[28px] border border-claude-border bg-[linear-gradient(145deg,rgba(22,39,45,0.96),rgba(17,29,35,0.96))] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.16)]">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-claude-secondary">Class Workbench</p>
                                    <h2 className="font-serif text-2xl font-bold italic text-claude-text">
                                        {nextAssignment ? 'Next priority is already in view.' : 'Use this page to plan, study, and keep pace.'}
                                    </h2>
                                    <p className="max-w-2xl text-sm text-claude-secondary">
                                        {nextAssignment
                                            ? `${nextAssignment.title}${nextAssignment.due_date ? ` is due ${new Date(nextAssignment.due_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : ' is your next active task.'}`
                                            : 'Create the next assignment, add a class time, or jump into one of the linked decks.'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={openCreateAssign}
                                        className="rounded-full border border-claude-accent/35 bg-claude-accent/10 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent transition hover:bg-claude-accent hover:text-claude-bg"
                                    >
                                        Add task
                                    </button>
                                    <button
                                        onClick={() => setShowScheduleModal(true)}
                                        className="rounded-full border border-claude-border bg-claude-bg/10 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-text transition hover:border-claude-border"
                                    >
                                        Add class time
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-8">
                            {groupedAssignments.map(group => group.items.length > 0 && (
                                <div key={group.status}>
                                    <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-claude-secondary mb-4 flex items-center gap-2">
                                        {group.status === 'Todo' ? 'Assignments' : group.status === 'Doing' ? 'In Progress' : group.status === 'Archived' ? 'Archived' : 'Completed'} <span className="opacity-40 text-[10px]">({group.items.length})</span>
                                    </h3>
                                    <div className="space-y-3">
                                        {group.items.map(a => (
                                            <Motion.div
                                                key={a.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                onClick={() => openEditAssign(a)}
                                                className={`group relative glass-panel rounded-2xl p-4 cursor-pointer hover:glass-panel transition-[transform,opacity,color,background-color,border-color,box-shadow] ${a.status === 'Done' || a.status === 'Archived' ? 'opacity-60 saturate-50' : ''}`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <button
                                                        onClick={(e) => toggleAssignStatus(e, a)}
                                                        className={`mt-0.5 shrink-0 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action ${a.status === 'Done' ? 'text-claude-accent' : a.status === 'Doing' ? 'text-orange-400' : 'text-claude-secondary hover:text-claude-accent'}`}
                                                    >
                                                        {a.status === 'Done' ? <CheckCircle2 className="w-5 h-5" /> : a.status === 'Doing' ? <Clock className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                                    </button>

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`font-serif text-lg font-bold truncate transition-[transform,opacity,color,background-color,border-color,box-shadow] ${a.status === 'Done' ? 'text-claude-text/60 line-through' : 'text-claude-text group-hover:text-claude-text'}`}>
                                                            {a.title}
                                                        </h4>
                                                        {a.description && (
                                                            <p className="text-sm text-[color-mix(in_srgb,var(--secondary-text-color)_80%,transparent)] line-clamp-2 mt-1">{a.description}</p>
                                                        )}
                                                        {a.due_date && (
                                                            <div className={`flex items-center gap-1.5 mt-3 font-mono text-[10px] uppercase tracking-widest font-bold ${new Date(a.due_date) < new Date() && a.status !== 'Todo' ? 'text-red-400' : 'text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]'}`}>
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                {new Date(a.due_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                            </div>
                                                        )}
                                                        {a.type && (
                                                            <div className={`mt-2 inline-flex items-center px-1.5 py-0.5 rounded uppercase font-mono tracking-widest text-[8px] font-bold border ${a.type === 'exam' || a.type === 'test' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                                                                a.type === 'project' ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' :
                                                                    'border-claude-secondary/30 text-claude-secondary glass-panel'
                                                                }`}>
                                                                {a.type}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Motion.div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {assignments.length === 0 && (
                                <div className="text-center py-16 opacity-50">
                                    <Clock className="w-12 h-12 text-claude-secondary mx-auto mb-4 opacity-50" />
                                    <p className="font-serif italic text-claude-text text-lg mb-2">No upcoming tasks</p>
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-claude-secondary">Add an assignment to track your progress.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                        <div className="glass-panel rounded-[28px] p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-claude-secondary flex items-center gap-2">
                                    Class Times <span className="opacity-40 text-[10px]">({scheduleSlots.length})</span>
                                </h3>
                                <button onClick={() => setShowScheduleModal(true)} className="text-claude-accent text-[10px] font-mono uppercase tracking-widest font-bold hover:underline tap-action">
                                    + Add Time
                                </button>
                            </div>

                            {scheduleSlots.length === 0 ? (
                                <div className="border border-dashed border-claude-border rounded-xl p-6 text-center">
                                    <Calendar className="w-8 h-8 text-[color-mix(in_srgb,var(--secondary-text-color)_40%,transparent)] mx-auto mb-2" />
                                    <p className="text-xs font-mono uppercase tracking-widest text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">No times set</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {scheduleSlots.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)).map(slot => (
                                        <div key={slot.id} className={`relative group rounded-2xl border px-4 py-3 ${nextScheduleSlot?.id === slot.id ? 'border-claude-accent/30 bg-claude-accent/8' : 'border-claude-border bg-claude-bg/15'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm tracking-tighter" style={{ backgroundColor: `${cls.color || 'var(--accent-color)'}20`, color: cls.color || 'var(--accent-color)' }}>
                                                    {DAY_LABELS[slot.day_of_week]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-mono text-[10px] uppercase font-bold text-claude-text">{formatSlotTime(slot.start_time)} - {formatSlotTime(slot.end_time)}</p>
                                                    {nextScheduleSlot?.id === slot.id ? (
                                                        <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Next on deck</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <button onClick={() => handleDeleteScheduleSlot(slot.id)} className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity p-1">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="glass-panel rounded-[28px] p-5">
                            <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-claude-secondary mb-4 flex items-center gap-2">
                                Study Decks <span className="opacity-40 text-[10px]">({decks.length})</span>
                            </h3>
                            {decks.length > 0 ? (
                                <div className="space-y-3">
                                    {decks.map(deck => (
                                        <a
                                            key={deck.id}
                                            href={`/deck/${deck.id}`}
                                            className="group relative block rounded-2xl border border-claude-border bg-claude-bg/15 p-4 hover:border-claude-accent/25 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border shadow-inner mt-0.5"
                                                    style={{ backgroundColor: `${cls.color || 'var(--accent-color)'}15`, borderColor: `${cls.color || 'var(--accent-color)'}30`, color: cls.color || 'var(--accent-color)' }}
                                                >
                                                    <Layers className="w-5 h-5 opacity-70" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-serif text-lg font-bold truncate text-claude-text group-hover:text-claude-text transition-colors">
                                                        {deck.title}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="font-mono text-[10px] uppercase tracking-widest text-[color-mix(in_srgb,var(--secondary-text-color)_80%,transparent)] font-bold">{deck.cardCount} Cards</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-claude-border px-4 py-8 text-center">
                                    <Layers className="mx-auto mb-3 h-8 w-8 text-claude-secondary/60" />
                                    <p className="font-serif italic text-claude-text">No linked decks yet</p>
                                    <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">Generate or create one from this class.</p>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>

            {/* Edit Class Modal */}
            <AnimatePresence>
                {showEditClassModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditClassModal(false)} className="absolute inset-0 bg-claude-bg/90 md:backdrop-blur-md" />
                        <Motion.form initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onSubmit={handleSaveClass} className="relative bg-claude-bg w-full p-8 rounded-t-[3rem] border-t border-claude-border pb-safe max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-8 sticky top-0 bg-claude-bg pt-2 pb-4 z-10">
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">Edit Class</h3>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setDeleteClassConfirm(true)} className="p-2 text-red-400 hover:text-red-300">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <button type="button" onClick={() => setShowEditClassModal(false)} className="p-2 text-claude-secondary hover:text-claude-text">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Class Name *</label>
                                    <input type="text" required value={classFormData.name} onChange={e => setClassFormData({ ...classFormData, name: e.target.value })} className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Professor</label>
                                    <input type="text" value={classFormData.professor} onChange={e => setClassFormData({ ...classFormData, professor: e.target.value })} className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none" placeholder="e.g. Dr. Smith" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Location</label>
                                    <input type="text" value={classFormData.room} onChange={e => setClassFormData({ ...classFormData, room: e.target.value })} className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none" placeholder="e.g. Room 101" />
                                </div>
                                <button type="submit" className="claude-button-primary w-full py-5 text-lg mt-4">Save Changes</button>
                            </div>
                        </Motion.form>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmModal isOpen={deleteClassConfirm} title="Delete Class?" message="This will delete the class and all its assignments." onConfirm={handleDeleteClass} onCancel={() => setDeleteClassConfirm(false)} />

            {/* Edit Assignment Modal */}
            <AnimatePresence>
                {showAssignModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssignModal(false)} className="absolute inset-0 bg-claude-bg/90 md:backdrop-blur-md" />
                        <Motion.form initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onSubmit={handleSaveAssignment} className="relative bg-claude-bg w-full p-8 rounded-t-[3rem] border-t border-claude-border pb-safe max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-8 sticky top-0 bg-claude-bg pt-2 pb-4 z-10">
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">{editingAssign ? 'Edit Task' : 'New Task'}</h3>
                                <div className="flex items-center gap-2">
                                    {editingAssign && (
                                        <button type="button" onClick={() => setDeleteAssignConfirm({ show: true, item: editingAssign })} className="p-2 text-red-400 hover:text-red-300">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button type="button" onClick={() => setShowAssignModal(false)} className="p-2 text-claude-secondary hover:text-claude-text">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Task Title *</label>
                                    <input type="text" required value={assignForm.title} onChange={e => setAssignForm({ ...assignForm, title: e.target.value })} className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none" placeholder="Read Chapter 4" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Due Date & Time</label>
                                        <input type="datetime-local" value={assignForm.due_date} onChange={e => setAssignForm({ ...assignForm, due_date: e.target.value })} className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Status</label>
                                        <select value={assignForm.status} onChange={e => setAssignForm({ ...assignForm, status: e.target.value })} className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none appearance-none">
                                            <option value="Todo">To Do</option>
                                            <option value="Doing">Doing</option>
                                            <option value="Done">Done</option>
                                            <option value="Archived">Archived</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Type</label>
                                        <select value={assignForm.type} onChange={e => setAssignForm({ ...assignForm, type: e.target.value })} className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none appearance-none">
                                            <option value="homework">Homework</option>
                                            <option value="reading">Reading</option>
                                            <option value="project">Project</option>
                                            <option value="test">Test</option>
                                            <option value="exam">Exam</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Description</label>
                                    <textarea rows="4" value={assignForm.description} onChange={e => setAssignForm({ ...assignForm, description: e.target.value })} className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none resize-none mb-3" placeholder="Add a description for this task..." />

                                    {aiFilePreview ? (
                                        <div className="flex items-center justify-between glass-panel rounded-xl p-3 mb-3">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-8 h-8 rounded shrink-0 bg-claude-surface flex items-center justify-center text-claude-secondary">
                                                    <Layers className="w-4 h-4" />
                                                </div>
                                                <span className="font-mono text-xs text-claude-text truncate">{aiFilePreview}</span>
                                            </div>
                                            <button type="button" onClick={removeFile} className="p-2 text-red-400 hover:text-red-300">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mb-3">
                                            <label className="flex items-center justify-center w-full h-12 px-4 glass-panel border border-dashed border-claude-border rounded-xl cursor-pointer hover:border-claude-accent/50 transition-colors group">
                                                <div className="flex items-center gap-2 text-claude-secondary group-hover:text-claude-accent">
                                                    <Upload className="w-4 h-4" />
                                                    <span className="font-mono text-xs uppercase tracking-widest font-bold">Upload File (PDF, Doc, Image)</span>
                                                </div>
                                                <input type="file" className="hidden" accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={handleFileChange} />
                                            </label>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleGenerateAI}
                                        disabled={isGeneratingAI || !aiFile}
                                        className="w-full h-12 flex items-center justify-center gap-2 glass-panel hover:glass-panel border border-claude-accent/40 text-claude-accent rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        {isGeneratingAI ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating Deck...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4 group-hover:text-yellow-300 transition-colors" />
                                                Generate AI Flashcards
                                            </>
                                        )}
                                    </button>
                                </div>
                                <button type="submit" disabled={isGeneratingAI} className="claude-button-primary w-full py-5 text-lg mt-4 disabled:opacity-50">Save Task</button>
                            </div>
                        </Motion.form>
                    </div>
                )}

                {showScheduleModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowScheduleModal(false)} className="absolute inset-0 bg-claude-bg/90 md:backdrop-blur-md" />
                        <Motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleSaveScheduleSlot}
                            className="relative bg-claude-bg w-full p-8 rounded-t-[3rem] border-t border-claude-border pb-safe"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-serif italic font-bold text-claude-text">Add Class Time</h3>
                                <button type="button" onClick={() => setShowScheduleModal(false)} className="p-2 text-claude-secondary hover:text-claude-text transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Day of Week</label>
                                    <select
                                        value={scheduleForm.day_of_week}
                                        onChange={e => setScheduleForm({ ...scheduleForm, day_of_week: parseInt(e.target.value) })}
                                        className="w-full glass-panel border-2 border-claude-border rounded-2xl p-4 font-mono text-claude-text focus:border-claude-accent outline-none appearance-none"
                                    >
                                        <option value={1}>Monday</option>
                                        <option value={2}>Tuesday</option>
                                        <option value={3}>Wednesday</option>
                                        <option value={4}>Thursday</option>
                                        <option value={5}>Friday</option>
                                        <option value={6}>Saturday</option>
                                        <option value={0}>Sunday</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">Start Time</label>
                                        <div className="flex items-center glass-panel border-2 border-claude-border rounded-2xl px-4 py-4 w-full focus-within:border-claude-accent transition-colors">
                                            <input
                                                type="time"
                                                value={scheduleForm.start_time}
                                                onChange={e => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                                                className="w-full bg-transparent font-mono text-claude-text outline-none"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary mb-3">End Time</label>
                                        <div className="flex items-center glass-panel border-2 border-claude-border rounded-2xl px-4 py-4 w-full focus-within:border-claude-accent transition-colors">
                                            <input
                                                type="time"
                                                value={scheduleForm.end_time}
                                                onChange={e => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                                                className="w-full bg-transparent font-mono text-claude-text outline-none"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" className="claude-button-primary w-full py-5 text-lg mt-4">Save Time</button>
                            </div>
                        </Motion.form>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmModal isOpen={deleteAssignConfirm.show} title="Delete Task?" message="Are you sure you want to delete this task forever?" onConfirm={handleDeleteAssignment} onCancel={() => setDeleteAssignConfirm({ show: false, item: null })} />


            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
        </div>
    );
}
