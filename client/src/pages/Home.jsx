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
            className="tap-action group glass-panel flex min-h-[88px] flex-col items-start justify-between gap-3 rounded-2xl border border-white/10 px-4 py-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
        >
            <div className="flex w-full items-center justify-between gap-3">
                {React.createElement(icon, { className: 'h-4 w-4 text-claude-accent transition-transform group-hover:scale-110' })}
                <ArrowRight className="h-3.5 w-3.5 text-claude-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-claude-accent" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-botanical-parchment">
                {label}
            </span>
        </Link>
    );
}

function QueueChip({ icon, eyebrow, title, meta, to, tone = 'default' }) {
    const toneClasses = tone === 'danger'
        ? 'border-red-500/20 bg-red-500/[0.08]'
        : tone === 'accent'
            ? 'border-claude-accent/20 bg-claude-accent/[0.08]'
            : 'border-white/10 bg-white/[0.03]';

    return (
        <Link
            to={to}
            className={`tap-action group inline-flex min-h-[52px] min-w-[220px] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 ${toneClasses}`}
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/15 text-claude-accent">
                {React.createElement(icon, { className: 'h-4 w-4' })}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-claude-secondary">{eyebrow}</p>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                    <h3 className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-botanical-parchment transition-colors group-hover:text-claude-accent">
                        {title}
                    </h3>
                    {meta ? (
                        <p className="truncate text-xs text-white/55">{meta}</p>
                    ) : null}
                </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-claude-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-claude-accent" />
        </Link>
    );
}

function AssignmentItem({ assignment, associatedClass, onToggleStatus }) {
    const rawTitle = assignment?.title ?? assignment?.name ?? assignment?.assignment_title ?? '';
    const assignmentTitle = String(rawTitle).trim() || 'Untitled Assignment';
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
            className="group flex min-h-[92px] flex-col gap-3 rounded-2xl border border-white/5 p-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] glass-panel sm:flex-row sm:items-start"
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <button
                    type="button"
                    onClick={() => onToggleStatus(assignment)}
                    className={`tap-action mt-0.5 rounded-md transition-[transform,opacity,color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 ${assignment.status === 'Doing' ? 'text-orange-400' : assignment.status === 'Done' ? 'text-claude-accent' : 'text-claude-secondary hover:text-claude-accent'}`}
                    aria-label={`Change status for ${assignmentTitle}`}
                >
                    {statusIcon}
                </button>

                <Link
                    to={`/class/${assignment.class_id}`}
                    className="block min-w-0 w-full flex-1 rounded-lg pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                >
                    <h4
                        title={assignmentTitle}
                        className="line-clamp-2 max-w-full font-serif leading-tight text-white transition-colors group-hover:text-claude-accent md:text-lg"
                    >
                        {assignmentTitle}
                    </h4>
                    {associatedClass ? (
                        <div
                            className="mt-1 flex max-w-full min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
                            style={{ color: associatedClass.color || '#7a9e72' }}
                        >
                            <Layers className="h-3 w-3 shrink-0" />
                            <span title={associatedClass.name} className="block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                                {associatedClass.name}
                            </span>
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
    const focusDeck = recentDecks[0] ?? null;
    const focusAssignment = pastDueAssignments[0] ?? upcomingAssignments[0] ?? null;
    const focusClass = focusAssignment ? classesById.get(focusAssignment.class_id) : (classes[0] ?? null);

    const heroSummary = useMemo(() => {
        if (focusAssignment) {
            const dueLabel = getRelativeDueLabel(focusAssignment.due_date);
            const className = classesById.get(focusAssignment.class_id)?.name;
            const parts = [dueLabel, focusAssignment.title || focusAssignment.name || 'Upcoming work', className].filter(Boolean);
            return parts.join(' • ');
        }

        if (focusDeck) {
            return `Resume ${focusDeck.title} or capture a new deck while your study session is fresh.`;
        }

        return 'You are caught up. Use today to study, plan classes, or reconnect with your study circle.';
    }, [classesById, focusAssignment, focusDeck]);

    const priorityActions = useMemo(() => ([
        {
            to: focusDeck ? `/deck/${focusDeck.id}/study` : '/create',
            icon: Play,
            label: 'Resume Study',
        },
        {
            to: '/create',
            icon: BookOpen,
            label: 'Create Deck',
        },
        {
            to: focusClass ? `/class/${focusClass.id}` : '/classes',
            icon: Calendar,
            label: 'Plan Classes',
        },
        {
            to: '/messages',
            icon: MessageCircle,
            label: 'Open Social',
        },
    ]), [focusClass, focusDeck]);

    const todayQueue = useMemo(() => ([
        {
            eyebrow: focusDeck ? 'Resume study' : 'Start studying',
            title: focusDeck ? focusDeck.title : 'Create your next study deck',
            detail: focusDeck
                ? `Pick up where you left off with ${focusDeck.cardCount || focusDeck.cards?.length || 0} cards ready to review.`
                : 'Capture notes, import material, or build a fresh deck before the week gets busier.',
            to: focusDeck ? `/deck/${focusDeck.id}/study` : '/create',
            cta: focusDeck ? 'Open study session' : 'Create deck',
            icon: focusDeck ? Play : BookOpen,
            tone: 'accent',
            meta: focusDeck ? `${focusDeck.cardCount || focusDeck.cards?.length || 0} cards ready` : 'New deck setup',
            compactTitle: 'Resume Study',
            compactMeta: focusDeck ? `${focusDeck.cardCount || focusDeck.cards?.length || 0} cards ready` : 'Create a deck'
        },
        {
            eyebrow: pastDueAssignments.length > 0 ? 'Needs attention' : 'Plan next',
            title: focusAssignment ? (focusAssignment.title || focusAssignment.name || 'Review assignments') : 'Review your class workload',
            detail: focusAssignment
                ? `${getRelativeDueLabel(focusAssignment.due_date) || 'Upcoming'}${focusClass ? ` • ${focusClass.name}` : ''}`
                : 'Check upcoming deadlines, update statuses, and keep class work moving.',
            to: focusClass ? `/class/${focusClass.id}` : '/classes',
            cta: focusClass ? 'Open class view' : 'View classes',
            icon: Calendar,
            tone: pastDueAssignments.length > 0 ? 'danger' : 'default',
            compactTitle: pastDueAssignments.length > 0 ? 'Needs Attention' : 'Plan Next',
            compactMeta: focusAssignment ? (getRelativeDueLabel(focusAssignment.due_date) || 'Upcoming work') : 'Class workload'
        },
        {
            eyebrow: 'Stay connected',
            title: 'Check your study circle',
            detail: 'Open messages, catch shared decks, and keep group momentum moving.',
            to: '/messages',
            cta: 'Open social',
            icon: MessageCircle,
            tone: 'default',
            compactTitle: 'Check your study circle',
            compactMeta: 'Messages and shared decks'
        }
    ]), [focusAssignment, focusClass, focusDeck, pastDueAssignments.length]);

    const classInsights = useMemo(() => {
        const now = new Date();
        const insights = new Map();

        for (const classItem of classes) {
            const classAssignments = assignments.filter((assignment) => assignment.class_id === classItem.id);
            const activeAssignments = classAssignments.filter(
                (assignment) => assignment.status !== 'Done' && assignment.status !== 'Archived'
            );

            const nextDue = activeAssignments
                .filter((assignment) => assignment.due_date && !Number.isNaN(new Date(assignment.due_date).getTime()))
                .map((assignment) => new Date(assignment.due_date))
                .filter((dueDate) => dueDate >= now)
                .sort((left, right) => left - right)[0];

            insights.set(classItem.id, {
                activeCount: activeAssignments.length,
                nextDueLabel: nextDue
                    ? nextDue.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : null
            });
        }

        return insights;
    }, [classes, assignments]);

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
            <div className="relative mb-6 overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(25,70,82,0.9),rgba(13,27,32,0.98)_62%)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:mb-8 sm:p-6 lg:p-7">
                <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-claude-accent/8 to-transparent" />
                <div className="gsap-hero relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-center">
                    <div className="min-w-0">
                        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-botanical-sepia">
                            <CalendarDays className="h-4 w-4" />
                            {greeting} • {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                        <h1 className="mb-2 text-3xl font-serif font-bold italic leading-none tracking-tight text-botanical-parchment sm:text-5xl">
                            Today Queue
                        </h1>
                        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-white/68 sm:text-base">
                            {heroSummary}
                        </p>

                        <div className="mb-4 flex flex-wrap items-center gap-3">
                            <Link
                                to={todayQueue[0].to}
                                className="tap-action inline-flex items-center gap-3 rounded-2xl bg-[#a8c07f] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#102228] shadow-[0_10px_30px_rgba(168,192,127,0.28)] transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(168,192,127,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c07f]/60"
                            >
                                <Play className="h-4 w-4" /> {todayQueue[0].cta}
                            </Link>
                            <HeartsDisplay onClick={() => setPricingOpen(true)} />
                            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                                {user?.username || 'Student'}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {todayQueue.map((item) => (
                                <QueueChip
                                    key={item.eyebrow + item.title}
                                    icon={item.icon}
                                    eyebrow={item.eyebrow}
                                    title={item.compactTitle}
                                    meta={item.compactMeta}
                                    to={item.to}
                                    tone={item.tone}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="xl:justify-self-end">
                        <Link to="/garden" className="tap-action group block rounded-[26px] border border-white/10 bg-white/[0.04] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60">
                            <div className="flex items-center gap-4">
                                <div className="relative flex h-20 w-20 shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/10 shadow-sm transition-transform group-hover:-translate-y-1">
                                    <div className="absolute inset-x-2 bottom-2 h-1/2 rounded-b-xl bg-gradient-to-t from-[#8fa6a8]/10 to-transparent" />
                                    <div className="absolute -right-2 -top-1 z-20 h-2 w-6 rotate-[35deg] bg-[#e8e4d8] shadow-sm" />
                                    <div className="origin-bottom translate-y-3 scale-[0.75] transform">
                                        <Garden streak={streak.currentStreak} status={streak.status} size="sm" showInfo={true} />
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-claude-secondary">Garden streak</p>
                                    <p className="mt-2 font-serif text-xl font-bold italic text-botanical-parchment">
                                        {streak.currentStreak} day rhythm
                                    </p>
                                    <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/10 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-claude-accent">
                                        <Leaf className="h-2 w-2" /> Open garden
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
                {stats.map((stat) => (
                    <StatTile key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
                ))}
            </div>

            <div className="mb-4">
                <SectionHeading icon={Sparkles} title="Focus Actions" />
            </div>

            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {priorityActions.map((action) => (
                    <QuickActionCard key={action.label} to={action.to} icon={action.icon} label={action.label} />
                ))}
            </div>

            {classes.length > 0 ? (
                <div className="mb-10">
                    <SectionHeading icon={Library} title="Your Classes" to="/classes" />
                    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 hide-scrollbar sm:mx-0 sm:px-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:px-0 xl:grid-cols-3">
                        {classes.map((classItem) => {
                            const insight = classInsights.get(classItem.id);
                            const activeCount = insight?.activeCount ?? 0;
                            const nextDueLabel = insight?.nextDueLabel;

                            return (
                                <div key={classItem.id} className="gsap-class-pill">
                                    <Link
                                        to={`/class/${classItem.id}`}
                                        className="tap-action touch-target group relative flex min-h-[126px] min-w-[220px] cursor-pointer flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-white/10 p-4 glass-panel transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                    >
                                        <div
                                            className="pointer-events-none absolute inset-y-0 left-0 w-1.5"
                                            style={{ backgroundColor: classItem.color || '#7a9e72' }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                                        <div className="relative z-10 flex items-start justify-between gap-3">
                                            <span
                                                title={classItem.name}
                                                className="line-clamp-2 block min-w-0 max-w-[calc(100%-1.5rem)] pr-2 font-serif text-base font-bold leading-snug text-botanical-parchment transition-colors group-hover:text-claude-accent"
                                            >
                                                {classItem.name}
                                            </span>
                                            <div
                                                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white/10 transition-transform group-hover:scale-125"
                                                style={{ backgroundColor: classItem.color || '#7a9e72' }}
                                            />
                                        </div>

                                        <div className="relative z-10 flex flex-wrap items-center gap-2">
                                            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                                {activeCount} Active
                                            </span>
                                            {nextDueLabel ? (
                                                <span className="rounded-md border border-claude-accent/20 bg-claude-accent/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-claude-accent">
                                                    Next {nextDueLabel}
                                                </span>
                                            ) : (
                                                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                                    No Due Date
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </div>
                            );
                        })}
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
