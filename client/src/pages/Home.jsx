import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    Calendar, Layers, Clock, CheckCircle2, Circle,
    Sparkles, Library, CalendarDays, ArrowRight, Play, Leaf
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Garden from '../components/Garden';
import { useStreak } from '../hooks/useStreak';
import { getGardenStage } from '../utils/gardenCustomization';

export default function Home() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const streak = useStreak();

    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState([]);
    const [decks, setDecks] = useState([]);
    const [classes, setClasses] = useState([]);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const [assignData, decksData, classesData] = await Promise.all([
                    api.getAssignments(),
                    api.getDecks(),
                    api.getClasses()
                ]);
                setAssignments(assignData || []);
                setDecks(decksData || []);
                setClasses(classesData || []);
            } catch (err) {
                console.error("Dashboard load error", err);
                toast.error("Failed to load dashboard data");
            } finally {
                setLoading(false);
            }
        };
        loadDashboard();
    }, [toast]);

    const toggleAssignStatus = async (e, a) => {
        e.preventDefault();
        e.stopPropagation();
        const nextStatus = a.status === 'Todo' ? 'Doing' : (a.status === 'Doing' ? 'Done' : 'Todo');
        try {
            await api.updateAssignment(a.id, { status: nextStatus });
            setAssignments(prev => prev.map(item => item.id === a.id ? { ...item, status: nextStatus } : item));
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    // Calculate Greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    // Filter and Sort Assignments (Show only Todo/Doing, sorted by nearest due date, max 5)
    const upcomingAssignments = useMemo(() => {
        return assignments
            .filter(a => a.status !== 'Done')
            .sort((a, b) => {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            })
            .slice(0, 5);
    }, [assignments]);

    // Recent Decks (limit to 4)
    const recentDecks = useMemo(() => {
        return [...decks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
    }, [decks]);

    // Garden stage parsing
    const currentStage = getGardenStage(streak.currentStreak);

    if (loading) {
        return (
            <div className="p-6 pt-4 pb-24 min-h-screen">
                <div className="h-10 w-48 bg-claude-bg border border-claude-border rounded-xl animate-pulse mb-8" />
                <div className="h-32 w-full bg-[#fcfaf2] rounded-2xl animate-pulse mb-8" />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 w-full bg-[#1e3840]/30 rounded-2xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 pt-4 pb-32 min-h-screen">
            {/* Header Hero */}
            <div className="relative bg-[#fcfaf2] border border-[#d1c9b8] rounded-3xl p-6 sm:p-8 shadow-[0_4px_16px_rgba(0,0,0,0.02)] mb-8 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                            className="text-3xl sm:text-5xl font-serif font-bold italic text-[#1a1c1d] tracking-tight leading-none mb-2"
                        >
                            {greeting},<br className="sm:hidden" /> {user?.username || 'Student'}
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-[#8a7f6a] font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2"
                        >
                            <CalendarDays className="w-4 h-4" />
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </motion.p>
                    </div>

                    <Link to="/garden" className="shrink-0 group relative tap-action">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.2 }}
                            className="w-16 h-16 sm:w-20 sm:h-20 bg-white border border-[#d1c9b8] shadow-sm rounded-2xl flex items-end justify-center transform-style-3d group-hover:-translate-y-1 transition-transform relative overflow-hidden"
                        >
                            <div className="absolute inset-x-2 bottom-2 h-1/2 bg-gradient-to-t from-[#8fa6a8]/10 to-transparent rounded-b-xl" />
                            <div className="absolute -top-1 -right-2 w-6 h-2 bg-[#e8e4d8] rotate-[35deg] shadow-sm z-20" />
                            <div className="transform scale-[0.6] sm:scale-[0.75] origin-bottom translate-y-3">
                                <Garden streak={streak.currentStreak} status={streak.status} size="sm" showInfo={true} />
                            </div>
                        </motion.div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#1e3840] text-claude-accent border border-[#233e46] text-[8px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-30">
                            <Leaf className="w-2 h-2" /> {streak.currentStreak} Day
                        </div>
                    </Link>
                </div>
            </div>

            {/* Quick Classes Roster */}
            {classes.length > 0 && (
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60 flex items-center gap-2">
                            <Library className="w-3.5 h-3.5" /> Your Classes
                        </h2>
                        <Link to="/classes" className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] hover:text-claude-accent transition-colors flex items-center gap-1 tap-action">
                            View All <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                        {classes.map((cls, i) => (
                            <motion.div
                                key={cls.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            >
                                <Link
                                    to={`/class/${cls.id}`}
                                    className="flex items-center gap-3 bg-[#1e3840]/40 border border-[#233e46] rounded-2xl p-3 px-4 min-w-[140px] hover:bg-[#1e3840]/80 transition-all tap-action overflow-hidden group"
                                >
                                    <div className="w-3 h-3 rounded-full shrink-0 group-hover:scale-125 transition-transform" style={{ backgroundColor: cls.color || '#7a9e72' }} />
                                    <span className="font-serif font-bold text-botanical-parchment truncate text-sm">{cls.name}</span>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Action Center - Assignments */}
                <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5" /> Up Next
                        </h2>
                    </div>

                    <div className="relative bg-[#162a31] border border-[#233e46] rounded-3xl p-5 overflow-hidden">
                        {upcomingAssignments.length > 0 ? (
                            <div className="space-y-2 relative z-10">
                                <AnimatePresence>
                                    {upcomingAssignments.map((a, i) => {
                                        const assocClass = classes.find(c => c.id === a.class_id);
                                        const isOverdue = a.due_date && new Date(a.due_date) < new Date();
                                        return (
                                            <motion.div
                                                layout key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.05 }}
                                            >
                                                <Link
                                                    to={`/class/${a.class_id}`}
                                                    className="group flex flex-col sm:flex-row sm:items-center gap-3 bg-[#1e3840]/30 hover:bg-[#1e3840]/60 border border-[#233e46] rounded-2xl p-3.5 transition-all tap-action"
                                                >
                                                    <div className="flex items-start gap-3 w-full sm:w-auto flex-1 min-w-0">
                                                        <button
                                                            onClick={(e) => toggleAssignStatus(e, a)}
                                                            className={`mt-0.5 shrink-0 transition-all tap-action ${a.status === 'Doing' ? 'text-orange-400' : 'text-[#8fa6a8] hover:text-claude-accent'}`}
                                                        >
                                                            {a.status === 'Doing' ? <Clock className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                                        </button>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-serif md:text-lg font-bold truncate text-botanical-parchment group-hover:text-white transition-colors">
                                                                {a.title}
                                                            </h4>
                                                            {assocClass && (
                                                                <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px] uppercase tracking-widest font-bold" style={{ color: assocClass.color || '#7a9e72' }}>
                                                                    <Layers className="w-3 h-3" /> {assocClass.name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">
                                                        {a.due_date && (
                                                            <div className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest font-bold ${isOverdue ? 'text-red-400 bg-red-400/10 px-2 py-1 rounded-lg border border-red-400/20' : 'text-[#8fa6a8]/60'}`}>
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(a.due_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                            </div>
                                                        )}
                                                        {a.type && (
                                                            <div className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase font-mono tracking-widest text-[8px] font-bold border ${a.type === 'exam' || a.type === 'test' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                                                                    a.type === 'project' ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' :
                                                                        'border-[#8fa6a8]/30 text-[#8fa6a8] bg-[#1e3840]/40'
                                                                }`}>
                                                                {a.type}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="text-center py-10 opacity-60">
                                <CheckCircle2 className="w-10 h-10 text-claude-accent mx-auto mb-3 opacity-50" />
                                <p className="font-serif italic text-botanical-parchment">All caught up!</p>
                                <p className="text-[10px] font-mono uppercase tracking-widest mt-1 text-[#8fa6a8]">No upcoming tasks found.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Continue - Decks */}
                <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#8fa6a8]/60 flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" /> Recent Decks
                        </h2>
                        <Link to="/decks" className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8fa6a8] hover:text-claude-accent transition-colors flex items-center gap-1 tap-action">
                            View All <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {recentDecks.length > 0 ? recentDecks.map((deck, i) => {
                            const assocClass = classes.find(c => c.id === deck.class_id);
                            return (
                                <motion.div key={deck.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
                                    <Link
                                        to={`/deck/${deck.id}`}
                                        className="group relative block bg-[#fcfaf2] border border-[#d1c9b8] p-5 rounded-sm shadow-sm active:shadow-inner active:bg-[#f4f1e8] transition-all duration-300 overflow-hidden tap-action"
                                    >
                                        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                                        <div className="absolute top-2 right-2 text-claude-accent opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                                            <Play className="w-4 h-4 fill-current" />
                                        </div>

                                        <div className="relative z-10 pr-6">
                                            <h3 className="font-serif text-lg font-bold text-[#1a1c1d] leading-[1.1] group-hover:text-claude-accent transition-colors duration-300 italic mb-3 tracking-tight line-clamp-2">
                                                {deck.title}
                                            </h3>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#f4f1e8] rounded-sm border border-[#e8e4d8] shadow-sm">
                                                    <span className="font-mono text-[8px] sm:text-[9px] font-bold text-[#5d6466] uppercase tracking-wider">{deck.cardCount || 0} Cards</span>
                                                </div>
                                                {assocClass && (
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm border shadow-sm" style={{ borderColor: `${assocClass.color}40`, backgroundColor: `${assocClass.color}10`, color: assocClass.color }}>
                                                        <Calendar className="w-2.5 h-2.5" />
                                                        <span className="font-mono text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">{assocClass.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            )
                        }) : (
                            <div className="col-span-full text-center py-10 bg-[#1e3840]/10 border-2 border-dashed border-[#233e46]/20 rounded-3xl opacity-60">
                                <Layers className="w-8 h-8 text-[#8fa6a8] mx-auto mb-2 opacity-50" />
                                <p className="font-serif italic text-botanical-parchment">No decks yet</p>
                                <Link to="/create" className="text-[10px] font-mono uppercase tracking-widest mt-2 text-claude-accent hover:underline">Create one now</Link>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
