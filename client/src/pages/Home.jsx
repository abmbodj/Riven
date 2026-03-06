import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'motion/react';
import {
    ArrowRight,
    BookOpen,
    Calendar,
    CalendarDays,
    CheckCircle2,
    Circle,
    Clock,
    Layers,
    Leaf,
    Library,
    MessageCircle,
    Play,
    Sparkles,
    Users
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Garden from '../components/Garden';
import { useStreak } from '../hooks/useStreak';
import HeartsDisplay from '../components/ui/HeartsDisplay';
import PricingModal from '../components/ui/PricingModal';
import { PageLoader } from '../components/ui/PageLoader.jsx';

export default function Home({ mode = 'landing' }) {
    const { isLoggedIn, loading } = useAuth();

    if (loading) {
        return <PageLoader />;
    }

    if (mode === 'dashboard') {
        return isLoggedIn ? <DashboardHome /> : <Navigate to="/account" replace />;
    }

    if (isLoggedIn) {
        return <Navigate to="/dashboard" replace />;
    }

    return <PublicHome />;
}

function PublicHome() {
    const highlights = [
        {
            icon: BookOpen,
            title: 'Capture class material once',
            description: 'Build decks from your notes, assignments, and upcoming exams instead of juggling separate tools.'
        },
        {
            icon: Sparkles,
            title: 'Study what matters today',
            description: 'Riven surfaces the work that is due now, overdue, or ready for spaced repetition.'
        },
        {
            icon: Users,
            title: 'Stay in sync with friends',
            description: 'Keep study groups, direct messages, and class momentum inside the same flow.'
        }
    ];

    const features = [
        {
            icon: Layers,
            eyebrow: 'Decks',
            title: 'Organize every subject into focused practice decks.'
        },
        {
            icon: Calendar,
            eyebrow: 'Assignments',
            title: 'See deadlines and study prompts in one command center.'
        },
        {
            icon: MessageCircle,
            eyebrow: 'Social',
            title: 'Coordinate with classmates without leaving the app.'
        }
    ];

    return (
        <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
            <section className="relative overflow-hidden rounded-[2rem] border border-[#d1c9b8] bg-[#fcfaf2] px-6 py-8 shadow-[0_10px_30px_rgba(35,29,17,0.06)] sm:px-8 sm:py-10">
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                <div className="absolute -right-20 top-10 h-48 w-48 rounded-full bg-[#8fa6a8]/15 blur-3xl" />
                <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-[#deb96a]/15 blur-3xl" />

                <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d1c9b8] bg-white/80 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#6f6455]">
                            <Sparkles className="h-3.5 w-3.5 text-[#deb96a]" />
                            Riven Study System
                        </div>

                        <Motion.h1
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45 }}
                            className="max-w-2xl text-4xl font-bold italic tracking-tight text-[#1a1c1d] sm:text-5xl lg:text-6xl"
                        >
                            Stay on top of classes without stitching together five separate apps.
                        </Motion.h1>

                        <Motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.08 }}
                            className="mt-5 max-w-2xl text-base leading-7 text-[#5d564d] sm:text-lg"
                        >
                            Riven combines flashcards, due-now work, class context, and study group coordination into one mobile-first flow.
                        </Motion.p>

                        <Motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.16 }}
                            className="mt-8 flex flex-col gap-3 sm:flex-row"
                        >
                            <Link
                                to="/account"
                                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#1a1c1d] px-5 py-3 text-sm font-mono font-bold uppercase tracking-[0.2em] text-[#fcfaf2] transition-transform hover:-translate-y-0.5"
                            >
                                Create account
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                to="/account"
                                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#d1c9b8] bg-white/80 px-5 py-3 text-sm font-mono font-bold uppercase tracking-[0.2em] text-[#1a1c1d] transition-colors hover:bg-white"
                            >
                                Sign in
                            </Link>
                        </Motion.div>

                        <div className="mt-8 flex flex-wrap gap-3 text-[11px] font-mono font-bold uppercase tracking-[0.24em] text-[#7b705f]">
                            <span className="rounded-full border border-[#d1c9b8] px-3 py-2">Flashcards</span>
                            <span className="rounded-full border border-[#d1c9b8] px-3 py-2">Assignments</span>
                            <span className="rounded-full border border-[#d1c9b8] px-3 py-2">Study groups</span>
                        </div>
                    </div>

                    <Motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.45, delay: 0.12 }}
                        className="w-full max-w-md self-center rounded-[2rem] border border-[#d1c9b8] bg-white/85 p-5 shadow-[0_12px_35px_rgba(35,29,17,0.08)] backdrop-blur"
                    >
                        <div className="rounded-[1.5rem] border border-[#e6dfd1] bg-[#f7f2e8] p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.28em] text-[#8a7f6a]">
                                        Today in Riven
                                    </p>
                                    <h2 className="mt-2 text-2xl font-serif font-bold italic text-[#1a1c1d]">
                                        Resume studying in one tap
                                    </h2>
                                </div>
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d1c9b8] bg-white shadow-sm">
                                    <Play className="h-5 w-5 fill-current text-[#1a1c1d]" />
                                </div>
                            </div>

                            <div className="mt-6 space-y-3">
                                {highlights.map(({ icon: HighlightIcon, title, description }) => (
                                    <div key={title} className="rounded-2xl border border-[#e2daca] bg-white/85 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1a1c1d] text-[#fcfaf2]">
                                                {React.createElement(HighlightIcon, { className: 'h-4 w-4' })}
                                            </div>
                                            <div>
                                                <h3 className="font-serif text-lg font-bold text-[#1a1c1d]">{title}</h3>
                                                <p className="mt-1 text-sm leading-6 text-[#5d564d]">{description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Motion.div>
                </div>
            </section>

            <section className="mx-auto mt-8 grid max-w-6xl gap-4 lg:grid-cols-3">
                {features.map(({ icon: FeatureIcon, eyebrow, title }) => (
                    <div
                        key={eyebrow}
                        className="rounded-[2rem] border border-[color:color-mix(in_srgb,var(--secondary-text-color)_15%,transparent)] bg-[color:color-mix(in_srgb,var(--background-color)_92%,white)] p-5 shadow-sm"
                    >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a1c1d] text-[#fcfaf2]">
                            {React.createElement(FeatureIcon, { className: 'h-5 w-5' })}
                        </div>
                        <p className="mt-4 text-[10px] font-mono font-bold uppercase tracking-[0.28em] text-[color-mix(in_srgb,var(--secondary-text-color)_65%,transparent)]">
                            {eyebrow}
                        </p>
                        <p className="mt-2 text-lg font-serif font-bold text-botanical-parchment">{title}</p>
                    </div>
                ))}
            </section>
        </div>
    );
}

function DashboardHome() {
    const { user } = useAuth();
    const toast = useToast();
    const streak = useStreak();

    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState([]);
    const [decks, setDecks] = useState([]);
    const [classes, setClasses] = useState([]);
    const [pricingOpen, setPricingOpen] = useState(false);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const [assignData, decksData, classesData] = await Promise.all([
                    api.getAssignments().catch(() => []),
                    api.getDecks().catch(() => []),
                    api.getClasses().catch(() => [])
                ]);
                setAssignments(assignData || []);
                setDecks(decksData || []);
                setClasses(classesData || []);
            } catch (err) {
                console.error('Dashboard load error', err);
                toast.error('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [toast]);

    const toggleAssignStatus = async (event, assignment) => {
        event.preventDefault();
        event.stopPropagation();
        const nextStatus = assignment.status === 'Todo'
            ? 'Doing'
            : assignment.status === 'Doing'
                ? 'Done'
                : 'Todo';

        try {
            await api.updateAssignment(assignment.id, { status: nextStatus });
            setAssignments((current) =>
                current.map((item) => (
                    item.id === assignment.id ? { ...item, status: nextStatus } : item
                ))
            );
        } catch {
            toast.error('Failed to update status');
        }
    };

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    const upcomingAssignments = useMemo(() => {
        const now = new Date();
        const endOfWeek = new Date(now);
        const daysUntilSunday = (7 - now.getDay()) % 7;
        endOfWeek.setDate(now.getDate() + daysUntilSunday);
        endOfWeek.setHours(23, 59, 59, 999);

        return assignments
            .filter((assignment) => {
                if (assignment.status === 'Done' || !assignment.due_date) return false;
                const dueDate = new Date(assignment.due_date);
                if (Number.isNaN(dueDate.getTime())) return false;
                return dueDate >= now && dueDate <= endOfWeek;
            })
            .sort((left, right) => new Date(left.due_date) - new Date(right.due_date))
            .slice(0, 5);
    }, [assignments]);

    const pastDueAssignments = useMemo(() => {
        const now = new Date();

        return assignments
            .filter((assignment) => {
                if (assignment.status === 'Done' || !assignment.due_date) return false;
                const dueDate = new Date(assignment.due_date);
                if (Number.isNaN(dueDate.getTime())) return false;
                return dueDate < now;
            })
            .sort((left, right) => new Date(left.due_date) - new Date(right.due_date))
            .slice(0, 5);
    }, [assignments]);

    const recentDecks = useMemo(
        () => [...decks].sort((left, right) => new Date(right.created_at) - new Date(left.created_at)).slice(0, 4),
        [decks]
    );

    if (loading) {
        return (
            <div className="min-h-screen space-y-8 p-4 pb-32 pt-4 sm:p-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-8 w-48 animate-pulse rounded-lg bg-claude-surface" />
                        <div className="h-4 w-32 animate-pulse rounded-lg bg-claude-surface/50" />
                    </div>
                    <div className="h-16 w-16 animate-pulse rounded-2xl bg-white/10" />
                </div>
                <div className="glass-panel h-24 w-full animate-pulse" />
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <div className="space-y-4">
                        <div className="mb-2 h-4 w-24 animate-pulse rounded bg-claude-surface" />
                        <div className="glass-panel h-64 animate-pulse" />
                    </div>
                    <div className="space-y-4">
                        <div className="mb-2 h-4 w-24 animate-pulse rounded bg-claude-surface" />
                        <div className="glass-panel h-64 animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 pb-32 pt-4 sm:p-6">
            <div className="relative mb-8 overflow-hidden rounded-3xl border border-[#d1c9b8] bg-[#fcfaf2] p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)] sm:p-8">
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <Motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="mb-2 text-3xl font-serif font-bold italic leading-none tracking-tight text-[#1a1c1d] sm:text-5xl"
                        >
                            {greeting},
                            <br className="sm:hidden" /> {user?.username || 'Student'}
                        </Motion.h1>
                        <Motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8a7f6a]"
                        >
                            <CalendarDays className="h-4 w-4" />
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Motion.p>
                        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                            <HeartsDisplay onClick={() => setPricingOpen(true)} />
                        </Motion.div>
                    </div>

                    <Link to="/garden" className="tap-action relative shrink-0 group">
                        <Motion.div
                            initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="relative flex h-16 w-16 items-end justify-center overflow-hidden rounded-2xl border border-[#d1c9b8] bg-white shadow-sm transition-transform group-hover:-translate-y-1 sm:h-20 sm:w-20"
                        >
                            <div className="absolute inset-x-2 bottom-2 h-1/2 rounded-b-xl bg-gradient-to-t from-[#8fa6a8]/10 to-transparent" />
                            <div className="absolute -right-2 -top-1 z-20 h-2 w-6 rotate-[35deg] bg-[#e8e4d8] shadow-sm" />
                            <div className="origin-bottom translate-y-3 scale-[0.6] transform sm:scale-[0.75]">
                                <Garden streak={streak.currentStreak} status={streak.status} size="sm" showInfo={true} />
                            </div>
                        </Motion.div>
                        <div className="absolute -bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-claude-border bg-claude-surface px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-claude-accent opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                            <Leaf className="h-2 w-2" /> {streak.currentStreak} Day
                        </div>
                    </Link>
                </div>
            </div>

            {classes.length > 0 && (
                <div className="mb-10">
                    <div className="mb-4 flex items-center justify-between px-1">
                        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">
                            <Library className="h-3.5 w-3.5" /> Your Classes
                        </h2>
                        <Link to="/classes" className="tap-action flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-claude-secondary transition-colors hover:text-claude-accent">
                            View All <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 hide-scrollbar sm:mx-0 sm:px-0">
                        {classes.map((classItem, index) => (
                            <Motion.div
                                key={classItem.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Link
                                    to={`/class/${classItem.id}`}
                                    className="tap-action touch-target group flex h-[56px] min-w-[140px] cursor-pointer items-center gap-3 rounded-2xl p-3 px-5 glass-panel"
                                >
                                    <div
                                        className="h-3 w-3 shrink-0 rounded-full shadow-sm transition-transform group-hover:scale-125"
                                        style={{ backgroundColor: classItem.color || '#7a9e72' }}
                                    />
                                    <span className="truncate font-serif text-sm font-bold text-botanical-parchment transition-colors group-hover:text-claude-accent">
                                        {classItem.name}
                                    </span>
                                </Link>
                            </Motion.div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
                <div>
                    <div className="mb-4 flex items-center justify-between px-1">
                        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">
                            <Sparkles className="h-3.5 w-3.5" /> Up Next
                        </h2>
                    </div>

                    <div className="glass-panel relative overflow-hidden rounded-3xl p-5 md:p-6">
                        {upcomingAssignments.length > 0 ? (
                            <div className="relative z-10 space-y-2">
                                <AnimatePresence>
                                    {upcomingAssignments.map((assignment, index) => {
                                        const associatedClass = classes.find((classItem) => classItem.id === assignment.class_id);
                                        const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();

                                        return (
                                            <Motion.div
                                                key={assignment.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <Link
                                                    to={`/class/${assignment.class_id}`}
                                                    className="tap-action group flex min-h-[64px] cursor-pointer flex-col gap-3 rounded-2xl p-4 transition-all glass-panel sm:flex-row sm:items-center"
                                                >
                                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                                        <button
                                                            onClick={(event) => toggleAssignStatus(event, assignment)}
                                                            className={`tap-action mt-0.5 shrink-0 transition-all ${assignment.status === 'Doing' ? 'text-orange-400' : 'text-claude-secondary hover:text-claude-accent'}`}
                                                            aria-label={`Set ${assignment.title} status`}
                                                        >
                                                            {assignment.status === 'Doing' ? <Clock className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                                        </button>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="truncate font-serif text-botanical-parchment transition-colors group-hover:text-white md:text-lg">
                                                                {assignment.title}
                                                            </h4>
                                                            {associatedClass && (
                                                                <div
                                                                    className="mt-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
                                                                    style={{ color: associatedClass.color || '#7a9e72' }}
                                                                >
                                                                    <Layers className="h-3 w-3" /> {associatedClass.name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 flex shrink-0 items-center gap-2 sm:mt-0">
                                                        {assignment.due_date && (
                                                            <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${isOverdue ? 'rounded-lg border border-red-400/20 bg-red-400/10 px-2 py-1 text-red-400' : 'text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]'}`}>
                                                                <Calendar className="h-3 w-3" />
                                                                {new Date(assignment.due_date).toLocaleString(undefined, {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    hour: 'numeric',
                                                                    minute: '2-digit'
                                                                })}
                                                            </div>
                                                        )}
                                                        {assignment.type && (
                                                            <div className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${assignment.type === 'exam' || assignment.type === 'test'
                                                                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                                                                : assignment.type === 'project'
                                                                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                                                                    : 'glass-panel border-[#8fa6a8]/30 text-claude-secondary'
                                                                }`}>
                                                                {assignment.type}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>
                                            </Motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="py-10 text-center opacity-60">
                                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-claude-accent opacity-50" />
                                <p className="font-serif italic text-botanical-parchment">All caught up!</p>
                                <p className="mt-1 text-[10px] uppercase tracking-widest text-claude-secondary">
                                    No upcoming tasks found.
                                </p>
                            </div>
                        )}
                    </div>

                    {pastDueAssignments.length > 0 && (
                        <div className="mt-8">
                            <div className="mb-4 flex items-center justify-between px-1">
                                <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-red-400/80">
                                    <Clock className="h-3.5 w-3.5" /> Past Due
                                </h2>
                            </div>

                            <div className="glass-panel relative overflow-hidden rounded-3xl p-5 md:p-6">
                                <div className="relative z-10 space-y-2">
                                    <AnimatePresence>
                                        {pastDueAssignments.map((assignment, index) => {
                                            const associatedClass = classes.find((classItem) => classItem.id === assignment.class_id);
                                            const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();

                                            return (
                                                <Motion.div
                                                    key={assignment.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ delay: index * 0.05 }}
                                                >
                                                    <Link
                                                        to={`/class/${assignment.class_id}`}
                                                        className="tap-action group flex min-h-[64px] cursor-pointer flex-col gap-3 rounded-2xl p-4 transition-all glass-panel sm:flex-row sm:items-center"
                                                    >
                                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                                            <button
                                                                onClick={(event) => toggleAssignStatus(event, assignment)}
                                                                className={`tap-action mt-0.5 shrink-0 transition-all ${assignment.status === 'Doing' ? 'text-orange-400' : 'text-claude-secondary hover:text-claude-accent'}`}
                                                                aria-label={`Set ${assignment.title} status`}
                                                            >
                                                                {assignment.status === 'Doing' ? <Clock className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                                            </button>
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="truncate font-serif text-botanical-parchment transition-colors group-hover:text-white md:text-lg">
                                                                    {assignment.title}
                                                                </h4>
                                                                {associatedClass && (
                                                                    <div
                                                                        className="mt-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
                                                                        style={{ color: associatedClass.color || '#7a9e72' }}
                                                                    >
                                                                        <Layers className="h-3 w-3" /> {associatedClass.name}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex shrink-0 items-center gap-2 sm:mt-0">
                                                            {assignment.due_date && (
                                                                <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${isOverdue ? 'rounded-lg border border-red-400/20 bg-red-400/10 px-2 py-1 text-red-400' : 'text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]'}`}>
                                                                    <Calendar className="h-3 w-3" />
                                                                    {new Date(assignment.due_date).toLocaleString(undefined, {
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        hour: 'numeric',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </div>
                                                            )}
                                                            {assignment.type && (
                                                                <div className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${assignment.type === 'exam' || assignment.type === 'test'
                                                                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                                                                    : assignment.type === 'project'
                                                                        ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                                                                        : 'glass-panel border-[#8fa6a8]/30 text-claude-secondary'
                                                                    }`}>
                                                                    {assignment.type}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Link>
                                                </Motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <div className="mb-4 flex items-center justify-between px-1">
                        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">
                            <Layers className="h-3.5 w-3.5" /> Recent Decks
                        </h2>
                        <Link to="/decks" className="tap-action flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-claude-secondary transition-colors hover:text-claude-accent">
                            View All <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {recentDecks.length > 0 ? (
                            recentDecks.map((deck, index) => {
                                const associatedClass = classes.find((classItem) => classItem.id === deck.class_id);

                                return (
                                    <Motion.div
                                        key={deck.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <Link
                                            to={`/deck/${deck.id}`}
                                            className="tap-action group relative block cursor-pointer overflow-hidden rounded-2xl border border-[#d1c9b8]/80 bg-[#fcfaf2]/[0.98] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#deb96a]/60 hover:shadow-lg active:bg-[#f4f1e8] active:shadow-inner"
                                        >
                                            <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                                            <div className="absolute right-2 top-2 translate-x-2 transform text-claude-accent opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                                                <Play className="h-4 w-4 fill-current" />
                                            </div>

                                            <div className="relative z-10 pr-6">
                                                <h3 className="mb-3 line-clamp-2 font-serif text-lg font-bold italic leading-[1.1] tracking-tight text-[#1a1c1d] transition-colors duration-300 group-hover:text-claude-accent">
                                                    {deck.title}
                                                </h3>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-1.5 rounded-sm border border-[#e8e4d8] bg-[#f4f1e8] px-2 py-0.5 shadow-sm">
                                                        <span className="text-[8px] font-bold uppercase tracking-wider text-[#5d6466] sm:text-[9px]">
                                                            {deck.cardCount || 0} Cards
                                                        </span>
                                                    </div>
                                                    {associatedClass && (
                                                        <div
                                                            className="flex items-center gap-1.5 rounded-sm border px-2 py-0.5 shadow-sm"
                                                            style={{
                                                                borderColor: `${associatedClass.color}40`,
                                                                backgroundColor: `${associatedClass.color}10`,
                                                                color: associatedClass.color
                                                            }}
                                                        >
                                                            <Calendar className="h-2.5 w-2.5" />
                                                            <span className="text-[8px] font-bold uppercase tracking-wider sm:text-[9px]">
                                                                {associatedClass.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    </Motion.div>
                                );
                            })
                        ) : (
                            <div className="glass-panel col-span-full rounded-3xl border-2 border-dashed border-claude-border py-10 text-center opacity-60">
                                <Layers className="mx-auto mb-2 h-8 w-8 text-claude-secondary opacity-50" />
                                <p className="font-serif italic text-botanical-parchment">No decks yet</p>
                                <Link to="/create" className="mt-2 text-[10px] uppercase tracking-widest text-claude-accent hover:underline">
                                    Create one now
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <PricingModal
                isOpen={pricingOpen}
                onClose={() => setPricingOpen(false)}
                currentTier={user?.subscription_tier || 'free'}
            />
        </div>
    );
}
