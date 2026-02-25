import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ChevronLeft, Settings, Library, Calendar, CheckCircle2, Circle, Clock, Plus, X, Trash2, Layers
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';

const STATUSES = ['Todo', 'Doing', 'Done'];

export default function ClassView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [cls, setCls] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [decks, setDecks] = useState([]);
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state for editing Class
    const [showEditClassModal, setShowEditClassModal] = useState(false);
    const [classFormData, setClassFormData] = useState({ name: '', color: '', professor: '', room: '', zoom_link: '' });
    const [deleteClassConfirm, setDeleteClassConfirm] = useState(false);

    // Modal state for Assignments
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [editingAssign, setEditingAssign] = useState(null);
    const [assignForm, setAssignForm] = useState({ title: '', description: '', due_date: '', status: 'Todo' });
    const [deleteAssignConfirm, setDeleteAssignConfirm] = useState({ show: false, item: null });

    // Modal state for Schedule
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({ day_of_week: 1, start_time: '09:00', end_time: '10:00' });

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
                color: currentClass.color || '#7a9e72',
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
        } catch (err) {
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
        } catch (err) {
            toast.error('Failed to update class');
        }
    };

    const handleDeleteClass = async () => {
        try {
            await api.deleteClass(id);
            toast.success('Class deleted');
            navigate('/classes');
        } catch (err) {
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
            setAssignForm({ title: '', description: '', due_date: '', status: 'Todo' });
            loadData();
        } catch (err) {
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
        } catch (err) {
            toast.error('Failed to delete assignment');
        }
    };

    const openCreateAssign = () => {
        setEditingAssign(null);
        setAssignForm({ title: '', description: '', due_date: '', status: 'Todo' });
        setShowAssignModal(true);
    };

    const openEditAssign = (a) => {
        setEditingAssign(a);
        setAssignForm({
            title: a.title,
            description: a.description || '',
            due_date: a.due_date ? new Date(a.due_date).toISOString().slice(0, 16) : '',
            status: a.status
        });
        setShowAssignModal(true);
    };

    const toggleAssignStatus = async (e, a) => {
        e.stopPropagation();
        const nextStatus = a.status === 'Todo' ? 'Doing' : (a.status === 'Doing' ? 'Done' : 'Todo');
        try {
            await api.updateAssignment(a.id, { status: nextStatus });
            loadData();
        } catch (err) {
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
        } catch (err) {
            toast.error('Failed to add time slot');
        }
    };

    const handleDeleteScheduleSlot = async (slotId) => {
        try {
            await api.deleteScheduleSlot(slotId);
            toast.success('Time slot removed');
            loadData();
        } catch (err) {
            toast.error('Failed to remove time slot');
        }
    };

    if (loading) return (
        <div className="p-6 pt-4 min-h-screen">
            <div className="h-8 w-24 bg-claude-border rounded-xl animate-pulse mb-6" />
            <div className="h-24 w-full bg-[#fcfaf2] border border-[#d1c9b8] rounded-sm animate-pulse mb-8" />
            <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-16 w-full bg-[#fcfaf2] rounded-xl animate-pulse" />)}
            </div>
        </div>
    );

    const groupedAssignments = STATUSES.map(status => ({
        status,
        items: assignments.filter(a => a.status === status)
    }));

    return (
        <div className="relative min-h-screen pb-24">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#162a31]/80 backdrop-blur-xl border-b border-[#233e46] px-4 sm:px-6 py-4 flex items-center justify-between">
                <button
                    onClick={() => navigate('/classes')}
                    className="w-10 h-10 bg-[#1e3840]/40 border border-[#233e46] rounded-xl flex items-center justify-center text-[#8fa6a8] hover:text-claude-accent transition-all tap-action"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowEditClassModal(true)}
                        className="w-10 h-10 bg-[#1e3840]/40 border border-[#233e46] rounded-xl flex items-center justify-center text-[#8fa6a8] hover:text-botanical-parchment transition-all tap-action"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={openCreateAssign}
                        className="h-10 px-4 bg-claude-accent/20 border border-claude-accent/40 rounded-xl text-claude-accent font-mono text-xs uppercase tracking-widest font-bold hover:bg-claude-accent hover:text-[#162a31] transition-all tap-action flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Add Task</span>
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 py-6">
                {/* Class Details Hero */}
                <div className="relative bg-[#fcfaf2] border border-[#d1c9b8] p-6 rounded-sm shadow-sm mb-8 overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none transform translate-x-8 -translate-y-8" style={{ color: cls.color || '#7a9e72' }}>
                        <Library className="w-full h-full" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color || '#7a9e72' }} />
                            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8a7f6a] opacity-80">{cls.id.slice(-6)}</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-serif font-bold italic text-[#1a1c1d] tracking-tight">{cls.name}</h1>
                        {(cls.professor || cls.room || cls.zoom_link) && (
                            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono font-bold uppercase tracking-wider text-[#5d6466]">
                                {cls.professor && <span>Prof: {cls.professor}</span>}
                                {cls.room && <span>Loc: {cls.room}</span>}
                                {cls.zoom_link && <a href={cls.zoom_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Zoom</a>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Class Schedule */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-[#8fa6a8] flex items-center gap-2">
                            Class Times <span className="opacity-40 text-[10px]">({scheduleSlots.length})</span>
                        </h3>
                        <button onClick={() => setShowScheduleModal(true)} className="text-claude-accent text-[10px] font-mono uppercase tracking-widest font-bold hover:underline tap-action">
                            + Add Time
                        </button>
                    </div>

                    {scheduleSlots.length === 0 ? (
                        <div className="bg-[#1e3840]/20 border border-dashed border-[#233e46] rounded-xl p-6 text-center">
                            <Calendar className="w-8 h-8 text-[#8fa6a8]/40 mx-auto mb-2" />
                            <p className="text-xs font-mono uppercase tracking-widest text-[#8fa6a8]/60">No times set</p>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {scheduleSlots.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)).map(slot => {
                                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                const formatTime = t => new Date(`2000-01-01T${t}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                return (
                                    <div key={slot.id} className="relative group bg-[#1e3840]/40 border border-[#233e46] rounded-xl pl-4 pr-10 py-3 flex items-center gap-3 shadow-sm hover:border-claude-accent transition-colors">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm tracking-tighter" style={{ backgroundColor: `${cls.color || '#7a9e72'}20`, color: cls.color || '#7a9e72' }}>
                                            {days[slot.day_of_week]}
                                        </div>
                                        <div>
                                            <p className="font-mono text-[10px] uppercase font-bold text-botanical-parchment">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
                                        </div>
                                        <button onClick={() => handleDeleteScheduleSlot(slot.id)} className="absolute right-3 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity p-1">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Class Decks */}
                {decks.length > 0 && (
                    <div className="mb-8">
                        <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-[#8fa6a8] mb-4 flex items-center gap-2">
                            Study Decks <span className="opacity-40 text-[10px]">({decks.length})</span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {decks.map(deck => (
                                <a
                                    key={deck.id}
                                    href={`/deck/${deck.id}`}
                                    className="group relative bg-[#1e3840]/30 border border-[#233e46] rounded-2xl p-4 cursor-pointer hover:bg-[#1e3840]/60 transition-all tap-action flex items-start gap-4"
                                >
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border shadow-inner mt-0.5"
                                        style={{ backgroundColor: `${cls.color || '#7a9e72'}15`, borderColor: `${cls.color || '#7a9e72'}30`, color: cls.color || '#7a9e72' }}
                                    >
                                        <Layers className="w-5 h-5 opacity-70" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-serif text-lg font-bold truncate text-botanical-parchment group-hover:text-white transition-colors">
                                            {deck.title}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8fa6a8]/80 font-bold">{deck.cardCount} Cards</span>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Assignments Tracker */}
                <div className="space-y-8">
                    {groupedAssignments.map(group => group.items.length > 0 && (
                        <div key={group.status}>
                            <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-[#8fa6a8] mb-4 flex items-center gap-2">
                                {group.status} <span className="opacity-40 text-[10px]">({group.items.length})</span>
                            </h3>
                            <div className="space-y-3">
                                {group.items.map(a => (
                                    <motion.div
                                        key={a.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        onClick={() => openEditAssign(a)}
                                        className={`group relative bg-[#1e3840]/30 border border-[#233e46] rounded-2xl p-4 cursor-pointer hover:bg-[#1e3840]/60 transition-all ${a.status === 'Done' ? 'opacity-60 saturate-50' : ''}`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <button
                                                onClick={(e) => toggleAssignStatus(e, a)}
                                                className={`mt-0.5 shrink-0 transition-all tap-action ${a.status === 'Done' ? 'text-claude-accent' : a.status === 'Doing' ? 'text-orange-400' : 'text-[#8fa6a8] hover:text-claude-accent'}`}
                                            >
                                                {a.status === 'Done' ? <CheckCircle2 className="w-5 h-5" /> : a.status === 'Doing' ? <Clock className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <h4 className={`font-serif text-lg font-bold truncate transition-all ${a.status === 'Done' ? 'text-botanical-parchment/60 line-through' : 'text-botanical-parchment group-hover:text-white'}`}>
                                                    {a.title}
                                                </h4>
                                                {a.description && (
                                                    <p className="text-sm text-[#8fa6a8]/80 line-clamp-2 mt-1">{a.description}</p>
                                                )}
                                                {a.due_date && (
                                                    <div className={`flex items-center gap-1.5 mt-3 font-mono text-[10px] uppercase tracking-widest font-bold ${new Date(a.due_date) < new Date() && a.status !== 'Done' ? 'text-red-400' : 'text-[#8fa6a8]/60'}`}>
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {new Date(a.due_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {assignments.length === 0 && (
                        <div className="text-center py-16 opacity-50">
                            <Clock className="w-12 h-12 text-[#8fa6a8] mx-auto mb-4 opacity-50" />
                            <p className="font-serif italic text-botanical-parchment text-lg mb-2">No upcomings tasks</p>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8fa6a8]">Add an assignment to track your progress.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Class Modal */}
            <AnimatePresence>
                {showEditClassModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditClassModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.form initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onSubmit={handleSaveClass} className="relative bg-[#162a31] w-full p-8 rounded-t-[3rem] border-t border-[#233e46] pb-safe max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-8 sticky top-0 bg-[#162a31] pt-2 pb-4 z-10">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">Edit Class</h3>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setDeleteClassConfirm(true)} className="p-2 text-red-400 hover:text-red-300">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <button type="button" onClick={() => setShowEditClassModal(false)} className="p-2 text-[#8fa6a8] hover:text-white">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Class Name *</label>
                                    <input type="text" required value={classFormData.name} onChange={e => setClassFormData({ ...classFormData, name: e.target.value })} className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Professor</label>
                                    <input type="text" value={classFormData.professor} onChange={e => setClassFormData({ ...classFormData, professor: e.target.value })} className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none" />
                                </div>
                                <button type="submit" className="claude-button-primary w-full py-5 text-lg mt-4">Save Changes</button>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmModal isOpen={deleteClassConfirm} title="Delete Class?" message="This will delete the class and all its assignments." onConfirm={handleDeleteClass} onCancel={() => setDeleteClassConfirm(false)} />

            {/* Edit Assignment Modal */}
            <AnimatePresence>
                {showAssignModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssignModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.form initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onSubmit={handleSaveAssignment} className="relative bg-[#162a31] w-full p-8 rounded-t-[3rem] border-t border-[#233e46] pb-safe max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-8 sticky top-0 bg-[#162a31] pt-2 pb-4 z-10">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">{editingAssign ? 'Edit Task' : 'New Task'}</h3>
                                <div className="flex items-center gap-2">
                                    {editingAssign && (
                                        <button type="button" onClick={() => setDeleteAssignConfirm({ show: true, item: editingAssign })} className="p-2 text-red-400 hover:text-red-300">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button type="button" onClick={() => setShowAssignModal(false)} className="p-2 text-[#8fa6a8] hover:text-white">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Task Title *</label>
                                    <input type="text" required value={assignForm.title} onChange={e => setAssignForm({ ...assignForm, title: e.target.value })} className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none" placeholder="Read Chapter 4" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Due Date & Time</label>
                                        <input type="datetime-local" value={assignForm.due_date} onChange={e => setAssignForm({ ...assignForm, due_date: e.target.value })} className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Status</label>
                                        <select value={assignForm.status} onChange={e => setAssignForm({ ...assignForm, status: e.target.value })} className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none appearance-none">
                                            <option value="Todo">To Do</option>
                                            <option value="Doing">Doing</option>
                                            <option value="Done">Done</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Description</label>
                                    <textarea rows="3" value={assignForm.description} onChange={e => setAssignForm({ ...assignForm, description: e.target.value })} className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none resize-none" placeholder="Add any details or notes here..." />
                                </div>
                                <button type="submit" className="claude-button-primary w-full py-5 text-lg mt-4">Save Task</button>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmModal isOpen={deleteAssignConfirm.show} title="Delete Task?" message="Are you sure you want to delete this task forever?" onConfirm={handleDeleteAssignment} onCancel={() => setDeleteAssignConfirm({ show: false, item: null })} />
        </div>
    );
}
