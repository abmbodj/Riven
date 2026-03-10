import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    Sparkles
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Garden from '../components/Garden';
import { useStreak } from '../hooks/useStreak';
import HeartsDisplay from '../components/ui/HeartsDisplay';
import PricingModal from '../components/ui/PricingModal';
import { PageLoader } from '../components/ui/PageLoader.jsx';
import GardenLanding from '../components/ui/GardenLanding';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '../hooks/useGSAP';
import { EASE, DURATION, STAGGER } from '../utils/animations';

gsap.registerPlugin(ScrollTrigger);

function getTypeBadgeClass(type) {
    if (type === 'exam' || type === 'test') return 'border-red-500/30 bg-red-500/10 text-red-400';
    if (type === 'project') return 'border-purple-500/30 bg-purple-500/10 text-purple-400';
    return 'glass-panel border-[#8fa6a8]/30 text-claude-secondary';
}

function getRelativeDueLabel(dueValue, now = new Date()) {
    if (!dueValue) return null;
    const dueDate = new Date(dueValue);

    if (Number.isNaN(dueDate.getTime())) return null;

    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((dueDay - nowDay) / 86400000);

    if (diffDays < 0) {
        return `Overdue ${Math.abs(diffDays)}d`;
    }
    if (diffDays === 0) {
        return 'Due Today';
    }
    if (diffDays === 1) {
        return 'Due Tomorrow';
    }
    return `Due in ${diffDays}d`;
}

function formatDueDateTime(dueValue) {
    const date = new Date(dueValue);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function SectionHeading({ icon, title, to, action = 'View All', tone = 'default' }) {
    const titleColor = tone === 'danger'
        ? 'text-red-400/80'
        : 'text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]';

    return (
        <div className="mb-4 flex items-center justify-between px-1">
            <h2 className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] ${titleColor}`}>
                {React.createElement(icon, { className: 'h-3.5 w-3.5' })} {title}
            </h2>
            {to ? (
                <Link
                    to={to}
                    className="tap-action rounded-lg px-1 py-0.5 text-[10px] font-bold uppercase tracking-widest text-claude-secondary transition-colors hover:text-claude-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                >
                    <span className="inline-flex items-center gap-1">
                        {action} <ArrowRight className="h-3 w-3" />
                    </span>
                </Link>
            ) : null}
        </div>
    );
}

function StatTile({ label, value, tone = 'default' }) {
    const valueColor = tone === 'danger' ? 'text-red-400' : 'text-botanical-parchment';
    const borderTone = tone === 'danger' ? 'border-red-500/20' : 'border-white/10';

    return (
        <div className={`glass-panel rounded-2xl border ${borderTone} p-3 sm:p-4`}>
            <p className={`font-mono text-xl font-bold tracking-tight sm:text-2xl ${valueColor}`}>{value}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-claude-secondary">{label}</p>
        </div>
    );
}

function QuickActionCard({ to, icon, label }) {
    return (
        <Link
            to={to}
            className="tap-action group glass-panel flex min-h-[56px] items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
        >
            {React.createElement(icon, { className: 'h-4 w-4 text-claude-accent transition-transform group-hover:scale-110' })}
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-botanical-parchment">
                {label}
            </span>
        </Link>
    );
}

function AssignmentItem({ assignment, associatedClass, onToggleStatus }) {
    const relativeDueLabel = getRelativeDueLabel(assignment.due_date);
    const isOverdue = Boolean(relativeDueLabel && relativeDueLabel.startsWith('Overdue'));
    const dueDateTime = assignment.due_date ? formatDueDateTime(assignment.due_date) : '';

    const statusIcon = assignment.status === 'Doing'
        ? <Clock className="h-5 w-5" />
        : assignment.status === 'Done'
            ? <CheckCircle2 className="h-5 w-5" />
            : <Circle className="h-5 w-5" />;

    return (
        <Motion.article
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="group flex min-h-[72px] flex-col gap-3 rounded-2xl border border-white/5 p-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] glass-panel sm:flex-row sm:items-center"
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <button
                    type="button"
                    onClick={() => onToggleStatus(assignment)}
                    className={`tap-action mt-0.5 rounded-md transition-[transform,opacity,color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 ${assignment.status === 'Doing' ? 'text-orange-400' : assignment.status === 'Done' ? 'text-claude-accent' : 'text-claude-secondary hover:text-claude-accent'}`}
                    aria-label={`Change status for ${assignment.title}`}
                >
                    {statusIcon}
                </button>

                <Link
                    to={`/class/${assignment.class_id}`}
                    className="min-w-0 flex-1 rounded-lg pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                >
                    <h4 className="truncate font-serif text-botanical-parchment transition-colors group-hover:text-white md:text-lg">
                        {assignment.title}
                    </h4>
                    {associatedClass ? (
                        <div
                            className="mt-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
                            style={{ color: associatedClass.color || '#7a9e72' }}
                        >
                            <Layers className="h-3 w-3" /> {associatedClass.name}
                        </div>
                    ) : null}
                </Link>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {assignment.due_date ? (
                    <>
                        <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${isOverdue ? 'border-red-400/20 bg-red-400/10 text-red-400' : 'border-[#8fa6a8]/20 bg-[#8fa6a8]/10 text-[color-mix(in_srgb,var(--secondary-text-color)_70%,white)]'}`}>
                            <Calendar className="h-3 w-3" />
                            <time dateTime={assignment.due_date}>{dueDateTime}</time>
                        </div>
                        {relativeDueLabel ? (
                            <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${isOverdue ? 'bg-red-500/15 text-red-300' : 'bg-claude-accent/10 text-claude-accent'}`}>
                                {relativeDueLabel}
                            </span>
                        ) : null}
                    </>
                ) : null}

                {assignment.type ? (
                    <div className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${getTypeBadgeClass(assignment.type)}`}>
                        {assignment.type}
                    </div>
                ) : null}
            </div>
        </Motion.article>
    );
}

function AssignmentsSection({
    title,
    icon,
    assignments,
    classesById,
    onToggleStatus,
    tone = 'default',
    emptyState
}) {
    return (
        <div>
            <SectionHeading icon={icon} title={title} tone={tone} />
            <div className="gsap-section glass-panel relative overflow-hidden rounded-3xl p-5 md:p-6">
                {assignments.length > 0 ? (
                    <div className="relative z-10 space-y-2">
                        <AnimatePresence>
                            {assignments.map((assignment) => (
                                <AssignmentItem
                                    key={assignment.id}
                                    assignment={assignment}
                                    associatedClass={classesById.get(assignment.class_id)}
                                    onToggleStatus={onToggleStatus}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                ) : emptyState ? (
                    emptyState
                ) : (
                    <div className="py-8 text-center opacity-70">
                        <p className="font-serif italic text-botanical-parchment">Nothing here yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

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

    return <GardenLanding />;
}

function DashboardHome() {
    const { user } = useAuth();
    const toast = useToast();
    const streak = useStreak();
    const pageRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState([]);
    const [decks, setDecks] = useState([]);
    const [classes, setClasses] = useState([]);
    const [pricingOpen, setPricingOpen] = useState(false);

    useGSAP(() => {
        if (loading || !pageRef.current) return;

        const ctx = gsap.context(() => {
            gsap.from('.gsap-hero > *', {
                y: 20,
                opacity: 0,
                duration: DURATION.slow,
                stagger: STAGGER.relaxed,
                ease: EASE.reveal
            });

            gsap.from('.gsap-class-pill', {
                x: 30,
                opacity: 0,
                duration: DURATION.normal,
                stagger: STAGGER.tight,
                ease: EASE.organic,
                delay: 0.25
            });

            gsap.utils.toArray('.gsap-section').forEach((section) => {
                gsap.from(section, {
                    y: 30,
                    opacity: 0,
                    duration: DURATION.slow,
                    ease: EASE.reveal,
                    scrollTrigger: {
                        trigger: section,
                        start: 'top 88%',
                        toggleActions: 'play none none none'
                    }
                });
            });

            gsap.from('.gsap-deck-card', {
                scale: 0.92,
                opacity: 0,
                duration: DURATION.slow,
                stagger: STAGGER.normal,
                ease: EASE.spring,
                delay: 0.15
            });
        }, pageRef.current);

        return () => ctx.revert();
    }, [loading]);

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

    const toggleAssignStatus = async (assignment) => {
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
                if (assignment.status === 'Done' || assignment.status === 'Archived' || !assignment.due_date) return false;
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
                if (assignment.status === 'Done' || assignment.status === 'Archived' || !assignment.due_date) return false;
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

    const classesById = useMemo(() => new Map(classes.map((classItem) => [classItem.id, classItem])), [classes]);

    const stats = useMemo(() => ([
        { label: 'This Week', value: upcomingAssignments.length },
        { label: 'Past Due', value: pastDueAssignments.length, tone: 'danger' },
        { label: 'Decks', value: decks.length },
        { label: 'Classes', value: classes.length }
    ]), [upcomingAssignments.length, pastDueAssignments.length, decks.length, classes.length]);

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
        <div ref={pageRef} className="min-h-screen overflow-x-hidden p-4 pb-32 pt-4 sm:p-6">
            <div className="relative mb-6 overflow-hidden rounded-3xl border border-[#d1c9b8] bg-[#fcfaf2] p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)] sm:mb-8 sm:p-8 lg:p-10">
                <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                <div className="gsap-hero relative z-10 flex items-center justify-between">
                    <div>
                        <h1 className="mb-2 text-3xl font-serif font-bold italic leading-none tracking-tight text-[#1a1c1d] sm:text-5xl">
                            {greeting},
                            <br className="sm:hidden" /> {user?.username || 'Student'}
                        </h1>
                        <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8a7f6a]">
                            <CalendarDays className="h-4 w-4" />
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                        <HeartsDisplay onClick={() => setPricingOpen(true)} />
                    </div>

                    <Link to="/garden" className="tap-action group relative shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60">
                        <div className="relative flex h-16 w-16 items-end justify-center overflow-hidden rounded-2xl border border-[#d1c9b8] bg-white shadow-sm transition-transform group-hover:-translate-y-1 sm:h-20 sm:w-20">
                            <div className="absolute inset-x-2 bottom-2 h-1/2 rounded-b-xl bg-gradient-to-t from-[#8fa6a8]/10 to-transparent" />
                            <div className="absolute -right-2 -top-1 z-20 h-2 w-6 rotate-[35deg] bg-[#e8e4d8] shadow-sm" />
                            <div className="origin-bottom translate-y-3 scale-[0.6] transform sm:scale-[0.75]">
                                <Garden streak={streak.currentStreak} status={streak.status} size="sm" showInfo={true} />
                            </div>
                        </div>
                        <div className="absolute -bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-claude-border bg-claude-surface px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-claude-accent opacity-0 shadow-sm transition-opacity group-hover:opacity-100 md:shadow-lg">
                            <Leaf className="h-2 w-2" /> {streak.currentStreak} Day
                        </div>
                    </Link>
                </div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                {stats.map((stat) => (
                    <StatTile key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
                ))}
            </div>

            <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <QuickActionCard to="/create" icon={BookOpen} label="New Deck" />
                <QuickActionCard to="/decks" icon={Layers} label="Open Decks" />
                <QuickActionCard to="/classes" icon={Library} label="Classes" />
                <QuickActionCard to="/messages" icon={MessageCircle} label="Messages" />
            </div>

            {classes.length > 0 ? (
                <div className="mb-10">
                    <SectionHeading icon={Library} title="Your Classes" to="/classes" />
                    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 hide-scrollbar sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible lg:gap-3">
                        {classes.map((classItem) => (
                            <div key={classItem.id} className="gsap-class-pill">
                                <Link
                                    to={`/class/${classItem.id}`}
                                    className="tap-action touch-target group flex h-[56px] min-w-[140px] cursor-pointer items-center gap-3 rounded-2xl border border-white/5 p-3 px-5 glass-panel transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                >
                                    <div
                                        className="h-3 w-3 shrink-0 rounded-full shadow-sm transition-transform group-hover:scale-125"
                                        style={{ backgroundColor: classItem.color || '#7a9e72' }}
                                    />
                                    <span className="truncate font-serif text-sm font-bold text-botanical-parchment transition-colors group-hover:text-claude-accent">
                                        {classItem.name}
                                    </span>
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
                <div>
                    <AssignmentsSection
                        title="Up Next"
                        icon={Sparkles}
                        assignments={upcomingAssignments}
                        classesById={classesById}
                        onToggleStatus={toggleAssignStatus}
                        emptyState={(
                            <div className="py-10 text-center opacity-60">
                                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-claude-accent opacity-50" />
                                <p className="font-serif italic text-botanical-parchment">All caught up!</p>
                                <p className="mt-1 text-[10px] uppercase tracking-widest text-claude-secondary">
                                    No upcoming tasks found.
                                </p>
                            </div>
                        )}
                    />

                    {pastDueAssignments.length > 0 ? (
                        <div className="mt-8">
                            <AssignmentsSection
                                title="Past Due"
                                icon={Clock}
                                assignments={pastDueAssignments}
                                classesById={classesById}
                                onToggleStatus={toggleAssignStatus}
                                tone="danger"
                            />
                        </div>
                    ) : null}
                </div>

                <div>
                    <SectionHeading icon={Layers} title="Recent Decks" to="/decks" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {recentDecks.length > 0 ? (
                            recentDecks.map((deck) => {
                                const associatedClass = classesById.get(deck.class_id);

                                return (
                                    <div key={deck.id} className="gsap-deck-card">
                                        <Link
                                            to={`/deck/${deck.id}`}
                                            className="tap-action group relative block cursor-pointer overflow-hidden rounded-2xl border border-[#d1c9b8]/80 bg-[#fcfaf2]/[0.98] p-5 shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[#deb96a]/60 hover:shadow-lg active:bg-[#f4f1e8] active:shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#deb96a]"
                                        >
                                            <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                                            <div className="absolute right-2 top-2 translate-x-2 transform text-claude-accent opacity-0 transition-[transform,opacity,color,background-color,border-color,box-shadow] group-hover:translate-x-0 group-hover:opacity-100">
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
                                                    {associatedClass ? (
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
                                                    ) : null}
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
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
