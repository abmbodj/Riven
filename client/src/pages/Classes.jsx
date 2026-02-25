import React, { useEffect, useState, useCallback, memo } from 'react';
import {
    Calendar, RefreshCw, X, Plus, Sparkles, BookOpen, MapPin, Video, User, Trash2, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import ConfirmModal from '../components/ConfirmModal';

const CLASS_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6',
    '#7a9e72', '#b8a379', '#c47c7c', '#5e7b8f'
];

const ClassCard = memo(({ cls, index, onClick }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.8 : 0.8 }}
            viewport={{ once: true }}
            whileHover={{ y: -8, scale: 1.01, transition: { duration: 0.3 } }}
            onClick={onClick}
            className="relative tap-action group cursor-pointer"
        >
            <div className="absolute -top-1 left-1/4 w-10 h-3 bg-[#e8e4d8] rotate-[-2deg] rounded-sm z-10 shadow-sm opacity-80 backdrop-blur-sm pointer-events-none" />

            <div className="relative block bg-[#fcfaf2] border border-[#d1c9b8] p-5 sm:p-6 pt-7 sm:pt-8 rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.02)] active:shadow-inner active:bg-[#f4f1e8] transition-all duration-300 overflow-hidden active:scale-[0.97]">
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 opacity-70">
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[#8a7f6a] hidden xs:inline">ID:{cls.id?.toString().slice(-6) || '000000'}</span>
                        <div className="h-px flex-1 bg-[#d1c9b8]/40" />
                        <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[#8a7f6a] italic">Added: {new Date(cls.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-start gap-4">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border border-current/10 shadow-inner"
                            style={{ backgroundColor: (cls.color || '#7a9e72') + '15', color: cls.color || '#7a9e72' }}
                        >
                            <Calendar className="w-5 h-5 opacity-80" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1a1c1d] leading-[1.1] group-hover:text-claude-accent transition-colors duration-300 italic mb-3 tracking-tight truncate">{cls.name}</h3>

                            <div className="space-y-1.5 mt-2">
                                {cls.professor && (
                                    <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#5d6466] truncate">
                                        <User className="w-3.5 h-3.5 opacity-60 shrink-0" /> <span className="truncate">{cls.professor}</span>
                                    </div>
                                )}
                                {cls.room && (
                                    <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#5d6466] truncate">
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
            </div>
        </motion.div>
    );
});
ClassCard.displayName = 'ClassCard';

export default function Classes() {
    const navigate = useNavigate();
    const toast = useToast();
    const [classes, setClasses] = useState([]);
    const [scheduleSlots, setScheduleSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState('Roster'); // 'Roster' | 'Timetable'

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });

    // Form
    const [formData, setFormData] = useState({
        name: '', color: '#7a9e72', professor: '', room: '', day: '', start_time: '', end_time: ''
    });

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const data = await api.getClasses();
            setClasses(data);
            const schedData = await api.getSchedule();
            setScheduleSlots(schedData);
        } catch (err) {
            toast.error('Failed to load classes');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Class name is required');
            return;
        }

        try {
            if (editingClass) {
                await api.updateClass(editingClass.id, formData.name, formData.color, formData.professor, formData.room, '');
                toast.success('Class updated');
            } else {
                const newClass = await api.createClass(formData.name, formData.color, formData.professor, formData.room, '');
                // If time slot was filled in, also create a schedule entry
                if (newClass?.id && formData.day !== '' && formData.start_time && formData.end_time) {
                    await api.createScheduleSlot(newClass.id, formData.day, formData.start_time, formData.end_time);
                }
                toast.success('Class created');
            }
            setShowModal(false);
            setEditingClass(null);
            setFormData({ name: '', color: '#7a9e72', professor: '', room: '', zoom_link: '' });
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to save class');
        }
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
            toast.error('Failed to delete class');
        }
    };

    const openCreateModal = () => {
        setEditingClass(null);
        setFormData({ name: '', color: '#7a9e72', professor: '', room: '', zoom_link: '' });
        setShowModal(true);
    };

    const openEditModal = (cls) => {
        setEditingClass(cls);
        setFormData({
            name: cls.name,
            color: cls.color || '#7a9e72',
            professor: cls.professor || '',
            room: cls.room || '',
            day: '', start_time: '', end_time: ''
        });
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
                    <div key={idx} className="h-48 bg-[#fcfaf2] border border-[#d1c9b8] rounded-sm animate-pulse" />
                ))}
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen pb-24">
            {/* Header Area */}
            <div className="mb-6 pt-4 px-4 sm:px-6 flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1.5 translate-y-[-2px]">
                        <span className="px-1.5 py-0.5 bg-claude-accent text-botanical-ink text-[7px] sm:text-[8px] font-mono font-bold uppercase tracking-[0.3em] rounded-sm shadow-sm">Education</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-serif font-bold italic text-botanical-parchment tracking-tighter leading-none">Classes</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={openCreateModal}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-claude-accent/20 border border-claude-accent/40 rounded-xl sm:rounded-2xl text-claude-accent hover:text-white hover:bg-claude-accent/40 transition-all tap-action flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="w-[3.25rem] h-[3.25rem] sm:w-[3.75rem] sm:h-[3.75rem] bg-[#1e3840]/40 border border-[#233e46] rounded-xl sm:rounded-2xl text-[#8fa6a8] hover:text-claude-accent transition-all tap-action disabled:opacity-50 flex items-center justify-center transform-style-3d hover:-translate-y-1 hover:shadow-lg active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Classes List */}
            <div className="px-4 sm:px-6">
                {/* Segmented Control */}
                <div className="flex bg-[#1e3840]/30 border border-[#233e46] rounded-xl p-1 mb-6 max-w-xs transition-all">
                    {['Timetable', 'Roster'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`flex-1 py-2 font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all tap-action ${viewMode === mode ? 'bg-claude-accent text-[#162a31] shadow-sm' : 'text-[#8fa6a8] hover:text-botanical-parchment'}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                {viewMode === 'Roster' && (() => {
                    const currentClasses = classes.filter(c => !c.is_archived);
                    const archivedClasses = classes.filter(c => c.is_archived);

                    return (
                        <>
                            {/* Current Courses */}
                            {currentClasses.length === 0 && archivedClasses.length === 0 ? (
                                <div className="text-center py-16 bg-[#1e3840]/10 border-2 border-dashed border-[#233e46]/20 rounded-3xl mt-8">
                                    <Sparkles className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                                    <h3 className="font-serif italic text-xl text-botanical-parchment opacity-40">No Classes</h3>
                                    <p className="text-[#8fa6a8]/60 text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Track your courses by adding a class.</p>
                                    <button onClick={openCreateModal} className="mt-6 px-6 py-3 bg-claude-accent/20 border border-claude-accent/30 text-claude-accent rounded-xl font-mono text-xs uppercase tracking-widest font-bold tap-action hover:bg-claude-accent hover:text-[#162a31] transition-all">
                                        Add First Class
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                                        {currentClasses.map((cls, i) => (
                                            <ClassCard key={cls.id} cls={cls} index={i} onClick={() => navigate(`/class/${cls.id}`)} />
                                        ))}
                                    </div>

                                    {/* Past Courses */}
                                    {archivedClasses.length > 0 && (
                                        <div className="mt-10">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8fa6a8]/60">Past Courses</span>
                                                <div className="flex-1 h-px bg-[#233e46]/40" />
                                                <span className="font-mono text-[9px] text-[#8fa6a8]/40">{archivedClasses.length}</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 opacity-50">
                                                {archivedClasses.map((cls, i) => (
                                                    <ClassCard key={cls.id} cls={cls} index={i} onClick={() => navigate(`/class/${cls.id}`)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    );
                })()}

                {viewMode === 'Timetable' && (
                    <div className="space-y-8 animate-fade-in pb-12">
                        {scheduleSlots.length === 0 ? (
                            <div className="text-center py-16 bg-[#1e3840]/10 border-2 border-dashed border-[#233e46]/20 rounded-3xl mt-8">
                                <Calendar className="w-12 h-12 text-claude-accent opacity-20 mx-auto mb-4" />
                                <h3 className="font-serif italic text-xl text-botanical-parchment opacity-40">Empty Schedule</h3>
                                <p className="text-[#8fa6a8]/60 text-[10px] font-mono uppercase tracking-widest mt-2 px-8">Define class times inside your class settings.</p>
                            </div>
                        ) : (
                            [1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                                const daySlots = scheduleSlots.filter(s => s.day_of_week === dayIdx).sort((a, b) => a.start_time.localeCompare(b.start_time));
                                if (daySlots.length === 0) return null;

                                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                const formatTime = t => new Date(`2000-01-01T${t}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                                return (
                                    <div key={dayIdx} className="relative">
                                        <h3 className="font-serif italic text-2xl font-bold text-botanical-parchment flex items-center gap-3 mb-4 sticky top-16 bg-[#162a31]/80 backdrop-blur-md z-10 py-2">
                                            {days[dayIdx]}
                                            <div className="flex-1 h-px bg-gradient-to-r from-claude-accent/30 to-transparent" />
                                        </h3>
                                        <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-claude-accent/20 ml-2">
                                            {daySlots.map((slot, i) => {
                                                const cls = classes.find(c => c.id === slot.class_id);
                                                if (!cls) return null;
                                                return (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: -10 }}
                                                        whileInView={{ opacity: 1, x: 0 }}
                                                        viewport={{ once: true }}
                                                        transition={{ delay: i * 0.05 }}
                                                        key={slot.id}
                                                        onClick={() => navigate(`/class/${cls.id}`)}
                                                        className="relative group bg-[#fcfaf2] border border-[#d1c9b8] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:scale-[1.01] transition-transform tap-action before:absolute before:left-[-11px] sm:before:left-[-19px] before:top-1/2 before:-translate-y-1/2 before:w-3 before:h-3 before:rounded-full before:border-2 before:border-[#162a31] before:bg-claude-accent"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: cls.color || '#7a9e72' }} />
                                                            <div>
                                                                <h4 className="font-serif text-xl font-bold italic text-[#1a1c1d] tracking-tight">{cls.name}</h4>
                                                                <div className="flex items-center gap-3 mt-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[#8a7f6a]">
                                                                    {cls.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {cls.room}</span>}
                                                                    {cls.zoom_link && <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Zoom</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-[#1e3840]/5 rounded-lg px-3 py-1.5 border border-[#d1c9b8]/50 sm:text-right mt-2 sm:mt-0 ml-5 sm:ml-0">
                                                            <span className="font-mono text-xs font-bold text-[#1a1c1d] tracking-tighter block">{formatTime(slot.start_time)}</span>
                                                            <span className="font-mono text-[9px] uppercase tracking-widest text-[#8a7f6a] block -mt-0.5">{formatTime(slot.end_time)}</span>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={deleteConfirm.show}
                title="Delete Class?"
                message="Are you sure you want to remove this class from your schedule? Associated data might be affected."
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm({ show: false, item: null })}
            />

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.form
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            onSubmit={handleSave}
                            className="relative bg-[#162a31] w-full p-8 rounded-t-[3rem] border-t border-[#233e46] pb-safe max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-8 sticky top-0 bg-[#162a31] pt-2 pb-4 z-10">
                                <h3 className="text-2xl font-serif italic font-bold text-botanical-parchment">{editingClass ? 'Edit Class' : 'New Class'}</h3>
                                <div className="flex items-center gap-2">
                                    {editingClass && (
                                        <button type="button" onClick={() => confirmDelete(editingClass)} className="p-2 text-red-400 hover:text-red-300 transition-colors">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button type="button" onClick={() => setShowModal(false)} className="p-2 text-[#8fa6a8] hover:text-white transition-colors">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Class Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-[#1e3840]/40 border-2 border-[#233e46] rounded-2xl p-4 font-mono text-botanical-parchment focus:border-claude-accent outline-none"
                                        placeholder="e.g. CS 101"
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Professor</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8fa6a8]/60" />
                                            <input
                                                type="text"
                                                value={formData.professor}
                                                onChange={e => setFormData({ ...formData, professor: e.target.value })}
                                                className="w-full bg-[#1e3840]/40 border border-[#233e46] rounded-xl pl-11 pr-4 py-3 font-mono text-sm text-botanical-parchment focus:border-claude-accent outline-none"
                                                placeholder="Dr. Smith"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Room</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8fa6a8]/60" />
                                            <input
                                                type="text"
                                                value={formData.room}
                                                onChange={e => setFormData({ ...formData, room: e.target.value })}
                                                className="w-full bg-[#1e3840]/40 border border-[#233e46] rounded-xl pl-9 pr-3 py-3 font-mono text-sm text-botanical-parchment focus:border-claude-accent outline-none"
                                                placeholder="Bldg 4, 102"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Class Time</label>
                                        <div className="flex flex-col gap-2">
                                            <select
                                                value={formData.day}
                                                onChange={e => setFormData({ ...formData, day: e.target.value })}
                                                className="w-full bg-[#1e3840]/40 border border-[#233e46] rounded-xl px-3 py-3 font-mono text-sm text-botanical-parchment focus:border-claude-accent outline-none"
                                            >
                                                <option value="">Day (optional)</option>
                                                <option value="1">Monday</option>
                                                <option value="2">Tuesday</option>
                                                <option value="3">Wednesday</option>
                                                <option value="4">Thursday</option>
                                                <option value="5">Friday</option>
                                                <option value="6">Saturday</option>
                                                <option value="0">Sunday</option>
                                            </select>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8fa6a8]/60" />
                                                    <input
                                                        type="time"
                                                        value={formData.start_time}
                                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                        className="w-full bg-[#1e3840]/40 border border-[#233e46] rounded-xl pl-9 pr-2 py-2.5 font-mono text-xs text-botanical-parchment focus:border-claude-accent outline-none"
                                                    />
                                                </div>
                                                <div className="relative flex-1">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8fa6a8]/60" />
                                                    <input
                                                        type="time"
                                                        value={formData.end_time}
                                                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                        className="w-full bg-[#1e3840]/40 border border-[#233e46] rounded-xl pl-9 pr-2 py-2.5 font-mono text-xs text-botanical-parchment focus:border-claude-accent outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] mb-3">Color Label</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {CLASS_COLORS.map(color => (
                                            <button key={color} type="button" onClick={() => setFormData({ ...formData, color })} className={`w-10 h-10 rounded-xl flex-shrink-0 transition-all ${formData.color === color ? 'ring-2 ring-white ring-offset-4 ring-offset-[#162a31] scale-110' : 'opacity-40'}`} style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" className="claude-button-primary w-full py-5 text-lg mt-4">Save Class</button>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
