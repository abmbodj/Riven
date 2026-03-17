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
import { useStreak } from '../hooks/useStreak';
import HeartsDisplay from '../components/ui/HeartsDisplay';
import PricingModal from '../components/ui/PricingModal';
import { PageLoader } from '../components/ui/PageLoader.jsx';
import GardenLanding from '../components/ui/GardenLanding';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '../hooks/useGSAP';
import { EASE, DURATION, STAGGER, animateCounter, breathe } from '../utils/animations';

gsap.registerPlugin(ScrollTrigger);

function getRelativeDueLabel(dueValue, now = new Date()) {
    if (!dueValue) return null;
    const dueDate = new Date(dueValue);

    if (Number.isNaN(dueDate.getTime())) return null;

    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = dueDay - nowDay;
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays < 0) {
        const absDays = Math.abs(diffDays);
        return `Overdue ${formatDuration(absDays)}`;
    }
    if (diffDays === 0) {
        return 'Due Today';
    }
    if (diffDays === 1) {
        return 'Due Tomorrow';
    }
    return `Due in ${formatDuration(diffDays)}`;
}

function formatDuration(totalDays) {
    if (totalDays < 7) {
        return `${totalDays}d`;
    }
    if (totalDays < 30) {
        const weeks = Math.floor(totalDays / 7);
        const days = totalDays % 7;
        return days > 0 ? `${weeks}w ${days}d` : `${weeks}w`;
    }
    if (totalDays < 365) {
        const months = Math.floor(totalDays / 30);
        const days = totalDays % 30;
        return days > 0 ? `${months}mo ${days}d` : `${months}mo`;
    }
    const years = Math.floor(totalDays / 365);
    const remainingDays = totalDays % 365;
    const months = Math.floor(remainingDays / 30);
    if (months > 0) {
        return `${years}y ${months}mo`;
    }
    return `${years}y`;
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

function StreakBadge({ streak, status }) {
    const statusColor = status === 'active'
        ? 'text-botanical-forest border-botanical-forest/30 bg-botanical-forest/10'
        : status === 'at-risk'
            ? 'text-orange-400 border-orange-400/30 bg-orange-400/10'
            : 'text-claude-secondary border-claude-border bg-claude-surface/50';

    return (
        <Link
            to="/garden"
            className={`tap-action inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 ${statusColor}`}
        >
            <Leaf className={`h-3 w-3${status === 'at-risk' ? ' streak-leaf-icon' : ''}`} />
            {streak > 0 ? `${streak}d` : 'Start'}
        </Link>
    );
}

function StatStrip({ stats }) {
    return (
        <div className="flex items-center gap-0 divide-x divide-claude-border/60">
            {stats.map(({ label, value, tone }) => (
                <div key={label} className="px-4 first:pl-0 last:pr-0">
                    <p
                        data-stat-value={value}
                        className={`font-mono text-base font-bold leading-none tracking-tight ${tone === 'danger' && value > 0 ? 'text-red-400' : 'text-claude-text'}`}
                    >
                        {value}
                    </p>
                    <p className="mt-0.5 text-[8px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary/70">
                        {label}
                    </p>
                </div>
            ))}
        </div>
    );
}


function QueueChip({ icon, eyebrow, title, meta, to, tone = 'default' }) {
    const toneClasses = tone === 'danger'
        ? 'border-red-500/20 bg-red-500/[0.08]'
        : tone === 'accent'
            ? 'border-claude-accent/20 bg-claude-accent/[0.08]'
            : 'border-claude-border bg-claude-bg/20';

    return (
        <Link
            to={to}
            className={`tap-action group inline-flex min-h-[44px] min-w-[180px] items-center gap-3 rounded-2xl border px-2.5 py-2 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 sm:min-h-[52px] sm:min-w-[220px] sm:px-3 sm:py-2.5 ${toneClasses}`}
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-claude-border bg-claude-bg/50 text-claude-accent">
                {React.createElement(icon, { className: 'h-4 w-4' })}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-claude-secondary">{eyebrow}</p>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                    <h3 className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-claude-text transition-colors group-hover:text-claude-accent">
                        {title}
                    </h3>
                    {meta ? (
                        <p className="truncate text-xs text-claude-secondary/80">{meta}</p>
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

            </div>
        </Motion.article>
    );
}

function AssignmentStream({ upcoming, pastDue, classesById, onToggleStatus }) {
    const [pastDueExpanded, setPastDueExpanded] = useState(false);
    const visiblePastDue = pastDueExpanded ? pastDue : pastDue.slice(0, 3);

    return (
        <div className="gsap-section">
            {pastDue.length > 0 && (
                <div className="mb-6">
                    <SectionHeading icon={Clock} title="Past Due" tone="danger" />
                    <div className="glass-panel relative overflow-hidden rounded-3xl p-5 md:p-6">
                        <div className="relative z-10 space-y-2">
                            <AnimatePresence>
                                {visiblePastDue.map((assignment) => (
                                    <AssignmentItem
                                        key={assignment.id}
                                        assignment={assignment}
                                        associatedClass={classesById.get(assignment.class_id)}
                                        onToggleStatus={onToggleStatus}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                        {pastDue.length > 3 && (
                            <Motion.button
                                type="button"
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setPastDueExpanded((v) => !v)}
                                className="mt-3 w-full rounded-xl border border-claude-border/60 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-claude-secondary transition-colors hover:text-claude-accent tap-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                            >
                                {pastDueExpanded ? 'Show less' : `+${pastDue.length - 3} more overdue`}
                            </Motion.button>
                        )}
                    </div>
                </div>
            )}

            <SectionHeading icon={Sparkles} title="Up Next" to="/classes" />
            <div className="glass-panel relative overflow-hidden rounded-3xl p-5 md:p-6">
                {upcoming.length > 0 ? (
                    <div className="relative z-10 space-y-2">
                        <AnimatePresence>
                            {upcoming.map((assignment) => (
                                <AssignmentItem
                                    key={assignment.id}
                                    assignment={assignment}
                                    associatedClass={classesById.get(assignment.class_id)}
                                    onToggleStatus={onToggleStatus}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="py-10 text-center opacity-60">
                        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-claude-accent opacity-50" />
                        <p className="font-display italic text-botanical-parchment">All caught up!</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-claude-secondary">
                            No upcoming tasks this week.
                        </p>
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
            // Hero rows stagger in
            gsap.from('.gsap-hero-row', {
                y: 18,
                opacity: 0,
                duration: DURATION.slow,
                stagger: STAGGER.relaxed,
                ease: EASE.reveal
            });

            // Stat counter animation
            const statEls = pageRef.current.querySelectorAll('[data-stat-value]');
            statEls.forEach((el) => {
                const target = Number(el.dataset.statValue);
                if (target > 0) {
                    animateCounter(el, target, { duration: 1.2, ease: EASE.organic });
                }
            });

            // Breathe animation for at-risk streak
            const streakLeaf = pageRef.current.querySelector('.streak-leaf-icon');
            if (streakLeaf) {
                breathe(streakLeaf, { scale: 1.15, duration: 2.5 });
            }

            // Class pills slide in
            gsap.from('.gsap-class-pill', {
                x: 30,
                opacity: 0,
                duration: DURATION.normal,
                stagger: STAGGER.tight,
                ease: EASE.organic,
                delay: 0.25
            });

            // Scroll-triggered sections
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

            // Deck cards scale in
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

    const heroState = useMemo(() => {
        if (pastDueAssignments.length > 0) {
            const topItem = pastDueAssignments[0];
            const dueLabel = getRelativeDueLabel(topItem.due_date);
            const className = classesById.get(topItem.class_id)?.name;
            return {
                state: 'overdue',
                headline: 'Time to catch up.',
                summary: [dueLabel, topItem.title || topItem.name || 'Assignment needs attention', className].filter(Boolean).join(' · '),
                cta: {
                    to: focusClass ? `/class/${focusClass.id}` : '/classes',
                    icon: Clock,
                    label: `Review ${pastDueAssignments.length} overdue`
                }
            };
        }

        if (upcomingAssignments.length > 0 || focusDeck) {
            return {
                state: 'study',
                headline: 'Today Queue.',
                summary: focusAssignment
                    ? [getRelativeDueLabel(focusAssignment.due_date), focusAssignment.title || focusAssignment.name, classesById.get(focusAssignment.class_id)?.name].filter(Boolean).join(' · ')
                    : focusDeck
                        ? `Resume ${focusDeck.title} — ${focusDeck.cardCount || 0} cards ready.`
                        : 'You have upcoming work this week.',
                cta: {
                    to: focusDeck ? `/deck/${focusDeck.id}/study` : '/classes',
                    icon: Play,
                    label: focusDeck ? 'Open study session' : 'View schedule'
                }
            };
        }

        return {
            state: 'clear',
            headline: "You're all caught up.",
            summary: 'Use today to study, plan ahead, or connect with your study circle.',
            cta: {
                to: '/create',
                icon: BookOpen,
                label: 'Create a deck'
            }
        };
    }, [pastDueAssignments, upcomingAssignments, focusDeck, focusAssignment, focusClass, classesById]);

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
            <div className="min-h-screen space-y-8 px-4 pb-32 pt-4 sm:px-6">
                {/* Hero skeleton */}
                <div className="rounded-[34px] border border-claude-border bg-claude-surface p-5 sm:p-6 lg:p-7">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="h-3 w-40 animate-pulse rounded bg-claude-surface" />
                        <div className="flex gap-2">
                            <div className="h-6 w-16 animate-pulse rounded-full bg-white/10" />
                            <div className="h-6 w-12 animate-pulse rounded-full bg-white/10" />
                        </div>
                    </div>
                    <div className="mb-2 h-10 w-64 animate-pulse rounded-lg bg-claude-surface sm:h-12 sm:w-80" />
                    <div className="mb-5 h-4 w-72 animate-pulse rounded bg-claude-surface/50" />
                    <div className="mb-5 flex gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="space-y-1">
                                <div className="h-4 w-8 animate-pulse rounded bg-claude-surface" />
                                <div className="h-2 w-12 animate-pulse rounded bg-claude-surface/50" />
                            </div>
                        ))}
                    </div>
                    <div className="mb-4 h-10 w-44 animate-pulse rounded-2xl bg-claude-accent/20" />
                    <div className="flex gap-2.5">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-[52px] w-[220px] animate-pulse rounded-2xl border border-claude-border bg-claude-bg/20" />
                        ))}
                    </div>
                </div>

                {/* Work surface skeleton */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <div className="space-y-4">
                        <div className="mb-2 h-4 w-24 animate-pulse rounded bg-claude-surface" />
                        <div className="glass-panel h-64 animate-pulse rounded-3xl" />
                    </div>
                    <div className="space-y-4">
                        <div className="mb-2 h-4 w-24 animate-pulse rounded bg-claude-surface" />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-32 animate-pulse rounded-2xl border border-[#d1c9b8]/40 bg-[#fcfaf2]/30" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={pageRef} className="min-h-screen overflow-x-hidden p-4 pb-32 pt-4 sm:p-6">
            {/* ZONE A — Command Surface */}
            <div className="gsap-hero relative mb-6 overflow-hidden rounded-[34px] border border-claude-border bg-claude-surface p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:mb-8 sm:p-6 lg:p-7">
                <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[url('/textures/paper-fibers.png')]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-claude-accent/10 to-transparent" />

                {/* Hero inner: 2-col on lg+ */}
                <div className="relative z-10 lg:grid lg:grid-cols-[1fr_280px] lg:gap-6 xl:grid-cols-[1fr_320px]">
                    {/* LEFT — Identity + CTA */}
                    <div className="min-w-0">
                        {/* Meta row */}
                        <div className="gsap-hero-row mb-2 flex items-center justify-between gap-3">
                            <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-claude-secondary">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {greeting} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                            <div className="flex items-center gap-2 lg:hidden">
                                <StreakBadge streak={streak.currentStreak} status={streak.status} />
                                <HeartsDisplay onClick={() => setPricingOpen(true)} />
                            </div>
                        </div>

                        {/* Adaptive headline */}
                        <h1 className="gsap-hero-row mb-1 font-display text-[1.75rem] font-bold italic leading-[1.05] tracking-tight text-claude-text sm:text-4xl lg:text-5xl">
                            {heroState.headline}
                        </h1>

                        {/* Contextual subtitle */}
                        <p className="gsap-hero-row mb-2 max-w-2xl text-sm leading-relaxed text-claude-secondary lg:mb-3 sm:text-base">
                            {heroState.summary}
                        </p>

                        {/* StatStrip: mobile only */}
                        <div className="gsap-hero-row mb-3 lg:hidden">
                            <StatStrip stats={stats} />
                        </div>

                        {/* CTA + username */}
                        <div className="gsap-hero-row mb-3 flex flex-wrap items-center gap-3 lg:mb-0">
                            <Link
                                to={heroState.cta.to}
                                className="tap-action inline-flex items-center gap-2.5 rounded-2xl bg-claude-accent px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-claude-bg shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                            >
                                {React.createElement(heroState.cta.icon, { className: 'h-3.5 w-3.5' })}
                                {heroState.cta.label}
                            </Link>
                            <span className="rounded-full border border-claude-border bg-claude-bg/30 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-claude-secondary">
                                {user?.username || 'Student'}
                            </span>
                        </div>

                        {/* QueueChips: mobile horizontal scroll only */}
                        <div className="gsap-hero-row -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 hide-scrollbar lg:hidden">
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

                    {/* RIGHT — Stats + Queue (desktop only) */}
                    <div className="hidden lg:flex lg:flex-col lg:gap-4 lg:justify-between">
                        <div className="gsap-hero-row flex items-center justify-end gap-2">
                            <StreakBadge streak={streak.currentStreak} status={streak.status} />
                            <HeartsDisplay onClick={() => setPricingOpen(true)} />
                        </div>

                        <div className="gsap-hero-row">
                            <StatStrip stats={stats} />
                        </div>

                        <div className="gsap-hero-row flex flex-col gap-2">
                            {todayQueue.map((item) => (
                                <QueueChip
                                    key={`desktop-${item.eyebrow}${item.title}`}
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
                </div>
            </div>

            {/* ZONE B — Work Surface */}
            <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
                <AssignmentStream
                    upcoming={upcomingAssignments}
                    pastDue={pastDueAssignments}
                    classesById={classesById}
                    onToggleStatus={toggleAssignStatus}
                />

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
                                            <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[url('/textures/paper-fibers.png')]" />
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
                                <Link to="/create" className="mt-2 font-mono text-[10px] uppercase tracking-widest text-claude-accent hover:underline">
                                    Create one now
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ZONE C — Class Rail */}
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

            <PricingModal
                isOpen={pricingOpen}
                onClose={() => setPricingOpen(false)}
                currentTier={user?.subscription_tier || 'free'}
            />
        </div>
    );
}
