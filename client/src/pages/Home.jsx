import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
    ArrowRight,
    BookOpen,
    Calendar,
    CalendarDays,
    CheckCircle2,
    Clock,
    Layers,
    Leaf,
    MessageCircle,
    Play,
    Sparkles,
    Target,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useStreak } from '../hooks/useStreak';
import HeartsDisplay from '../components/ui/HeartsDisplay';
import AIGenDisplay from '../components/ui/AIGenDisplay';
import PricingModal from '../components/ui/PricingModal';
import { PageLoader } from '../components/ui/PageLoader.jsx';
import GardenLanding from '../components/ui/GardenLanding';
import PriorityItems from '../components/dashboard/PriorityItems.jsx';
import WeeklySummary from '../components/dashboard/WeeklySummary.jsx';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '../hooks/useGSAP';
import { useMobileVisualBudget } from '../hooks/useMobileVisualBudget';
import { EASE, DURATION, STAGGER, animateCounter, breathe } from '../utils/animations';
import { scheduleAssignmentNotifications } from '../utils/notifications';
import { subscribeMediaQueryList } from '../utils/matchMediaSubscribe';


gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION_MQ = '(prefers-reduced-motion: reduce)';
const XP_PER_LEVEL = 120;

function subscribeReducedMotion(cb) {
    if (typeof window === 'undefined') return () => {};
    const mq = window.matchMedia(REDUCED_MOTION_MQ);
    return subscribeMediaQueryList(mq, cb);
}

function getReducedMotionSnapshot() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(REDUCED_MOTION_MQ).matches;
}

function getXpProgress(stats = {}) {
    const xpTotal = Number(stats?.xpTotal) || 0;
    const level = Math.max(1, Number(stats?.level) || Math.floor(xpTotal / XP_PER_LEVEL) + 1);
    const currentLevelXp = xpTotal % XP_PER_LEVEL;

    return {
        xpTotal,
        level,
        remaining: XP_PER_LEVEL - currentLevelXp,
        percent: Math.max(0, Math.min(100, Math.round((currentLevelXp / XP_PER_LEVEL) * 100))),
    };
}

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

function getLast7DayFallback(now = new Date()) {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (6 - index));
        return {
            date: date.toISOString().slice(0, 10),
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            studied: false,
            is_today: index === 6,
        };
    });
}

function getAssignmentDayDiff(dueValue, now = new Date()) {
    if (!dueValue) return null;
    const dueDate = new Date(dueValue);
    if (Number.isNaN(dueDate.getTime())) return null;

    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((dueDay - nowDay) / 86400000);
}

function isDueInCurrentLocalWeek(dueValue, now = new Date()) {
    if (!dueValue) return false;

    const dueDate = new Date(dueValue);
    if (Number.isNaN(dueDate.getTime())) return false;

    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    return dueDay >= weekStart && dueDay < weekEnd;
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

function ActivityStreakCard({ streak, weeklySummary, loading }) {
    const days = weeklySummary?.daily_breakdown?.length
        ? weeklySummary.daily_breakdown
        : getLast7DayFallback();

    const statusTone = streak.status === 'at-risk'
        ? 'border-orange-400/30 bg-orange-400/10 text-orange-400'
        : streak.status === 'active'
            ? 'border-claude-accent/25 bg-claude-accent/10 text-claude-accent'
            : 'border-claude-border/60 bg-claude-bg/20 text-claude-secondary';

    return (
        <Link
            to="/garden"
            className="glass-panel-premium gsap-section tap-action block rounded-[28px] p-5 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 sm:p-6"
            data-testid="streak-activity-card"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.26em] text-claude-secondary">
                        Study Rhythm
                    </p>
                    <div className="mt-3 flex items-end gap-3">
                        <div className="flex items-end gap-2">
                            <span className="font-display text-[2.2rem] font-bold leading-none text-claude-text">
                                {streak.currentStreak || 0}
                            </span>
                            <span className="pb-1 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary">
                                day streak
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.18em] ${statusTone}`}>
                    <Leaf className={`h-3.5 w-3.5${streak.status === 'at-risk' ? ' streak-leaf-icon' : ''}`} />
                    {streak.status === 'at-risk' ? 'Needs care' : streak.status === 'active' ? 'In motion' : 'Restart'}
                </div>
            </div>

            <div className="mt-5" role="list" aria-label="Study activity for the last seven days">
                <div className="flex items-center justify-between gap-2">
                    {days.map((day) => (
                        <div key={day.date} className="flex flex-1 flex-col items-center gap-2" role="listitem">
                            <span
                                className={`block rounded-full ${loading ? 'animate-pulse bg-claude-border/50' : day.studied ? 'bg-claude-accent' : 'bg-claude-border/40'} ${day.is_today ? 'ring-2 ring-claude-accent/35 ring-offset-2 ring-offset-transparent' : ''} h-3.5 w-3.5`}
                                aria-label={`${day.day}: ${day.studied ? 'studied' : 'no study activity'}`}
                            />
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.16em] ${day.is_today ? 'text-claude-accent' : 'text-claude-secondary/70'}`}>
                                {day.day.slice(0, 1)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </Link>
    );
}

function StudyCoachCard({ coach }) {
    if (!coach) return null;

    const recommendation = coach.recommendation || null;
    const weakTopics = Array.isArray(coach.weakTopics) ? coach.weakTopics.slice(0, 4) : [];
    const upcomingExam = coach.upcomingExam || null;
    const stats = coach.stats || { xpTotal: 0, level: 1 };
    const xpProgress = getXpProgress(stats);
    const suggestedGuide = coach.suggestedGuide || null;
    const hasVisibleProgress = xpProgress.xpTotal > 0 || xpProgress.level > 1 || Number(stats.sessionsCompleted || 0) > 0;

    if (!recommendation && !upcomingExam && weakTopics.length === 0 && !suggestedGuide && !hasVisibleProgress) {
        return null;
    }

    return (
        <section
            data-testid="study-coach-card"
            className="gsap-section glass-panel-premium rounded-[28px] p-5 sm:p-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-claude-accent">
                        River Snapshot
                    </p>
                    <h2 className="mt-2 font-display text-[1.6rem] font-bold italic leading-none text-claude-text">
                        {recommendation?.label || 'Keep momentum moving'}
                    </h2>
                    {recommendation?.guideTitle ? (
                        <p className="mt-2 text-sm leading-6 text-claude-secondary">
                            {recommendation.guideTitle}
                        </p>
                    ) : null}
                </div>

                <div className="guide-shell rounded-[1.15rem] px-3 py-2 text-right">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">Progress</p>
                    <p className="mt-1 font-mono text-base font-bold text-claude-text">{xpProgress.xpTotal} XP</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Level {xpProgress.level}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-claude-border/40" aria-label={`Level ${xpProgress.level} progress`}>
                        <div className="h-full rounded-full bg-claude-accent" style={{ width: `${xpProgress.percent}%` }} />
                    </div>
                    <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-claude-secondary">
                        {xpProgress.remaining} XP to next level
                    </p>
                </div>
            </div>

            {recommendation?.detail ? (
                <div className="mt-4 guide-tone-success rounded-[1.35rem] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#86efac]">
                                Recommended Next
                            </p>
                            <p className="mt-1.5 text-sm leading-6 text-claude-text">{recommendation.detail}</p>
                        </div>
                        <Link
                            to={recommendation.to || '/guides'}
                            className="tap-action inline-flex items-center gap-2 rounded-full bg-[#22c55e] px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86efac]/60"
                        >
                            Start
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>
            ) : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="guide-shell rounded-[1.35rem] p-4">
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-claude-accent" />
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            Weak Concepts
                        </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {weakTopics.length > 0 ? weakTopics.map((topic) => (
                            <span key={topic.id || topic.title} className="guide-status-pill guide-status-pill--warning">
                                {topic.title}
                            </span>
                        )) : (
                            <span className="text-sm text-claude-secondary">Nothing urgent right now.</span>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {upcomingExam ? (
                        <div className="guide-tone-warning rounded-[1.35rem] p-4">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-current">
                                    Cram Window
                                </p>
                            </div>
                            <p className="mt-2 text-sm font-medium text-claude-text">{upcomingExam.title}</p>
                            <p className="mt-1 text-sm text-claude-secondary">{upcomingExam.countdownLabel}</p>
                        </div>
                    ) : null}

                    {suggestedGuide ? (
                        <Link
                            to={suggestedGuide.to || '/guides'}
                            className="tap-action block rounded-[1.35rem] border border-claude-accent/20 bg-claude-accent/5 p-4 transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-claude-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                        One Tap Setup
                                    </p>
                                    <p className="mt-1.5 text-sm text-claude-text">{suggestedGuide.label}</p>
                                    {suggestedGuide.className ? (
                                        <p className="mt-1 text-sm text-claude-secondary">{suggestedGuide.className}</p>
                                    ) : null}
                                </div>
                                <BookOpen className="h-4 w-4 text-claude-accent" />
                            </div>
                        </Link>
                    ) : null}
                </div>
            </div>
        </section>
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
    const [archivedClassCount, setArchivedClassCount] = useState(0);
    const [notes, setNotes] = useState([]);
    const [guides, setGuides] = useState([]);
    const [exams, setExams] = useState([]);
    const [studyCoach, setStudyCoach] = useState(null);
    const [weeklySummary, setWeeklySummary] = useState(null);
    const [weeklySummaryLoading, setWeeklySummaryLoading] = useState(true);
    const [pricingOpen, setPricingOpen] = useState(false);
    const [completingAssignmentIds, setCompletingAssignmentIds] = useState([]);
    const lightVisualBudget = useMobileVisualBudget();
    const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
    const timeZone = useMemo(
        () => (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
        [],
    );

    useGSAP(() => {
        if (loading || !pageRef.current || reducedMotion) return;

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

            // Scroll-triggered sections (skip ScrollTrigger on mobile — lighter main thread during scroll)
            if (lightVisualBudget) {
                gsap.from('.gsap-section', {
                    y: 20,
                    opacity: 0,
                    duration: DURATION.normal,
                    stagger: STAGGER.tight,
                    ease: EASE.reveal,
                    delay: 0.2,
                    clearProps: 'opacity,transform',
                });
            } else {
                gsap.utils.toArray('.gsap-section').forEach((section) => {
                    gsap.from(section, {
                        y: 30,
                        opacity: 0,
                        duration: DURATION.slow,
                        ease: EASE.reveal,
                        clearProps: 'opacity,transform',
                        scrollTrigger: {
                            trigger: section,
                            start: 'top 88%',
                            toggleActions: 'play none none none',
                        },
                    });
                });
            }

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
    }, [loading, lightVisualBudget, reducedMotion]);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const [assignData, decksData, classesData, notesData, guidesData, coachData, examsData] = await Promise.all([
                    api.getAssignments().catch(() => []),
                    api.getDecks().catch(() => []),
                    api.getClasses().catch(() => []),
                    api.getNotes().catch(() => []),
                    api.getStudyGuides().catch(() => []),
                    api.getStudyCoach().catch(() => null),
                    api.getMockExams().catch(() => []),
                ]);
                const activeClassIds = new Set((classesData || [])
                    .filter((classItem) => !classItem.is_archived)
                    .map((classItem) => classItem.id));
                const activeClasses = (classesData || []).filter((classItem) => !classItem.is_archived);
                const visibleAssignments = (assignData || []).filter((assignment) => (
                    assignment.status !== 'Archived'
                    && (!assignment.class_id || activeClassIds.has(assignment.class_id))
                ));

                setAssignments(visibleAssignments);
                setDecks(decksData || []);
                setClasses(activeClasses);
                setArchivedClassCount(Math.max(0, (classesData || []).length - activeClasses.length));
                setNotes(notesData || []);
                setGuides(guidesData || []);
                setStudyCoach(coachData || null);
                setExams(examsData || []);

                // Schedule local notifications for assignments
                if (assignData) {
                    const saved = localStorage.getItem('notifications_enabled');
                    const notificationsEnabled = saved === null ? true : saved === 'true';
                    scheduleAssignmentNotifications(assignData, notificationsEnabled);
                }

            } catch (err) {
                console.error('Dashboard load error', err);
                toast.error('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [toast]);

    useEffect(() => {
        let active = true;

        const loadWeeklySummary = async () => {
            setWeeklySummaryLoading(true);
            try {
                const summary = await api.getWeeklySummary(timeZone);
                if (active) {
                    setWeeklySummary(summary);
                }
            } catch (error) {
                console.error('Weekly summary load error', error);
                if (active) {
                    setWeeklySummary({
                        cards_studied: 0,
                        accuracy: null,
                        total_minutes: 0,
                        daily_breakdown: getLast7DayFallback(),
                    });
                }
            } finally {
                if (active) {
                    setWeeklySummaryLoading(false);
                }
            }
        };

        loadWeeklySummary();
        return () => {
            active = false;
        };
    }, [timeZone]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    const upcomingAssignments = useMemo(() => {
        const now = new Date();

        return assignments
            .filter((assignment) => {
                if (assignment.status === 'Done' || assignment.status === 'Archived' || !assignment.due_date) return false;
                const dueDate = new Date(assignment.due_date);
                if (Number.isNaN(dueDate.getTime())) return false;
                return dueDate >= now;
            })
            .sort((left, right) => new Date(left.due_date) - new Date(right.due_date));
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

    const recentStudyItems = useMemo(() => {
        const typed = [
            ...decks.map((d) => ({
                ...d,
                _type: 'flashcard',
                _date: d.last_studied || d.created_at,
                _route: `/deck/${d.id}`,
            })),
            ...notes.map((n) => ({
                ...n,
                _type: 'note',
                _date: n.updated_at || n.created_at,
                _route: `/note/${n.id}`,
            })),
            ...guides.map((g) => ({
                ...g,
                _type: 'guide',
                _date: g.updated_at || g.created_at,
                _route: `/guide/${g.id}`,
            })),
            ...exams.map((e) => ({
                ...e,
                _type: 'exam',
                _date: e.created_at,
                _route: `/exam/${e.id}`,
            })),
        ];
        return typed
            .sort((a, b) => new Date(b._date) - new Date(a._date))
            .slice(0, 4);
    }, [decks, notes, guides, exams]);

    const classesById = useMemo(() => new Map(classes.map((classItem) => [classItem.id, classItem])), [classes]);
    const rescheduleDashboardAssignmentNotifications = (nextAssignments) => {
        const saved = localStorage.getItem('notifications_enabled');
        const notificationsEnabled = saved === null ? true : saved === 'true';
        scheduleAssignmentNotifications(nextAssignments, notificationsEnabled);
    };

    const handleCompletePriorityItem = async (item) => {
        const assignmentId = item?.assignmentId;

        if (!assignmentId || completingAssignmentIds.includes(assignmentId)) {
            return;
        }

        const previousAssignments = assignments;
        const nextAssignments = previousAssignments.map((assignment) => (
            assignment.id === assignmentId
                ? { ...assignment, status: 'Done' }
                : assignment
        ));

        setCompletingAssignmentIds((current) => [...current, assignmentId]);
        setAssignments(nextAssignments);
        rescheduleDashboardAssignmentNotifications(nextAssignments);

        try {
            await api.updateAssignment(assignmentId, { status: 'Done' });
            toast.success('Assignment completed');
        } catch (error) {
            console.error('Priority completion error', error);
            setAssignments(previousAssignments);
            rescheduleDashboardAssignmentNotifications(previousAssignments);
            toast.error('Failed to mark assignment complete');
        } finally {
            setCompletingAssignmentIds((current) => current.filter((id) => id !== assignmentId));
        }
    };

    const priorityItems = useMemo(() => {
        const now = new Date();

        return assignments
            .filter((assignment) => assignment.status !== 'Done' && assignment.status !== 'Archived')
            .map((assignment) => {
                const diffDays = getAssignmentDayDiff(assignment.due_date, now);
                if (diffDays == null || diffDays > 1) {
                    return null;
                }

                const rawTitle = assignment?.title ?? assignment?.name ?? assignment?.assignment_title ?? '';
                const associatedClass = classesById.get(assignment.class_id);
                const tone = diffDays < 0 ? 'overdue' : diffDays === 0 ? 'today' : 'tomorrow';

                return {
                    id: assignment.id,
                    assignmentId: assignment.id,
                    title: String(rawTitle).trim() || 'Untitled Assignment',
                    tone,
                    urgencyLabel: diffDays < 0
                        ? `Overdue ${formatDuration(Math.abs(diffDays))}`
                        : diffDays === 0
                            ? 'Due today'
                            : 'Due tomorrow',
                    dueDate: assignment.due_date,
                    sortDays: diffDays,
                    className: associatedClass?.name || '',
                    classColor: associatedClass?.color || 'var(--border-color)',
                    to: assignment.class_id ? `/class/${assignment.class_id}` : '/classes',
                };
            })
            .filter(Boolean)
            .sort((left, right) => {
                if (left.sortDays !== right.sortDays) {
                    return left.sortDays - right.sortDays;
                }
                return new Date(left.dueDate) - new Date(right.dueDate);
            });
    }, [assignments, classesById]);
    const dueThisWeekCount = useMemo(() => {
        const now = new Date();

        return assignments.filter((assignment) => {
            if (assignment.status === 'Done' || assignment.status === 'Archived') return false;
            return isDueInCurrentLocalWeek(assignment.due_date, now);
        }).length;
    }, [assignments]);
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
                        : 'You have upcoming work ahead.',
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
        { label: 'Up Next', value: upcomingAssignments.length },
        { label: 'Past Due', value: pastDueAssignments.length, tone: 'danger' },
        { label: 'Decks', value: decks.length },
        { label: 'Classes', value: classes.length }
    ]), [upcomingAssignments.length, pastDueAssignments.length, decks.length, classes.length]);

    if (loading) {
        return (
            <div className="min-h-screen space-y-8 px-4 pb-32 pt-4 sm:px-6">
                {/* Hero skeleton */}
                <div className="glass-panel-premium rounded-[34px] p-5 sm:p-6 lg:p-7">
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
            <div className="gsap-hero glass-panel-premium relative mb-6 overflow-hidden rounded-[34px] p-5 sm:mb-8 sm:p-6 lg:p-7">
                <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[url('/textures/paper-fibers.png')]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-claude-accent/8 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/[0.02] to-transparent" />

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
                                <AIGenDisplay onClick={() => setPricingOpen(true)} />
                                <HeartsDisplay onClick={() => setPricingOpen(true)} />
                            </div>
                        </div>

                        {/* Adaptive headline */}
                        <h1 className="gsap-hero-row mb-1 font-display text-[1.75rem] font-bold italic leading-[1.05] tracking-tight text-claude-text sm:text-4xl lg:text-5xl">
                            Home
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

                        {/* Class snapshot: desktop only, fills left-column vertical space */}
                        <div className="gsap-hero-row mt-5 hidden border-t border-claude-border/30 pt-4 lg:block">
                            {classes.length > 0 ? (
                                <div className="space-y-0.5">
                                    {classes.slice(0, 4).map((classItem) => {
                                        const insight = classInsights.get(classItem.id);
                                        return (
                                            <Link
                                                key={classItem.id}
                                                to={`/class/${classItem.id}`}
                                                className="tap-action group flex items-center gap-3 rounded-xl px-2 py-2 transition-[background-color,color] hover:bg-claude-bg/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                            >
                                                <div
                                                    className="h-2 w-2 shrink-0 rounded-full"
                                                    style={{ backgroundColor: classItem.color || '#7a9e72' }}
                                                />
                                                <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-claude-secondary transition-colors group-hover:text-claude-text">
                                                    {classItem.name}
                                                </span>
                                                {insight?.activeCount > 0 && (
                                                    <span className="shrink-0 font-mono text-[9px] font-bold text-claude-secondary/50">
                                                        {insight.activeCount} active
                                                    </span>
                                                )}
                                                {insight?.nextDueLabel && (
                                                    <span className="shrink-0 rounded border border-claude-border/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-claude-secondary/50">
                                                        {insight.nextDueLabel}
                                                    </span>
                                                )}
                                                <ArrowRight className="h-3 w-3 shrink-0 text-claude-secondary/30 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-claude-accent" />
                                            </Link>
                                        );
                                    })}
                                    {classes.length > 4 && (
                                        <Link
                                            to="/classes"
                                            className="tap-action block px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-claude-secondary/40 transition-colors hover:text-claude-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                        >
                                            +{classes.length - 4} more classes
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div
                                    className="rounded-[24px] border border-dashed p-4"
                                    style={{
                                        borderColor: 'color-mix(in srgb, var(--border-color) 82%, var(--accent-color) 18%)',
                                        background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface-color) 72%, transparent) 0%, color-mix(in srgb, var(--bg-color) 68%, var(--surface-color)) 100%)',
                                        boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--text-color) 7%, transparent)'
                                    }}
                                >
                                    <div
                                        className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border"
                                        style={{
                                            borderColor: 'color-mix(in srgb, var(--border-color) 78%, var(--accent-color) 22%)',
                                            backgroundColor: 'color-mix(in srgb, var(--surface-color) 88%, var(--accent-color) 12%)',
                                            color: 'color-mix(in srgb, var(--accent-color) 62%, var(--secondary-text-color))'
                                        }}
                                    >
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                    <h2 className="font-serif text-xl font-bold italic text-claude-text">
                                        {archivedClassCount > 0 ? 'No active classes right now' : 'No active classes yet'}
                                    </h2>
                                    <p
                                        className="mt-2 max-w-md text-sm leading-relaxed"
                                        style={{ color: 'color-mix(in srgb, var(--secondary-text-color) 88%, var(--text-color) 12%)' }}
                                    >
                                        {archivedClassCount > 0
                                            ? 'Your past courses are still saved in Classes. Add or sync the next one to bring planning, assignments, and due dates back into focus.'
                                            : 'Add a class to unlock assignment tracking, planning, and due dates across your dashboard.'}
                                    </p>
                                    <div className="mt-4 flex items-center gap-3">
                                        <Link
                                            to="/classes"
                                            className="tap-action inline-flex items-center gap-2 rounded-2xl border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-[transform,border-color,color,background-color] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                            style={{
                                                borderColor: 'color-mix(in srgb, var(--border-color) 72%, var(--accent-color) 28%)',
                                                backgroundColor: 'color-mix(in srgb, var(--bg-color) 58%, var(--surface-color))',
                                                color: 'color-mix(in srgb, var(--accent-color) 58%, var(--text-color) 42%)'
                                            }}
                                        >
                                            {archivedClassCount > 0 ? 'View classes' : 'Add first class'}
                                            <ArrowRight className="h-3.5 w-3.5" />
                                        </Link>
                                        <p
                                            className="text-[10px] font-mono font-bold uppercase tracking-[0.18em]"
                                            style={{ color: 'color-mix(in srgb, var(--secondary-text-color) 82%, var(--accent-color) 18%)' }}
                                        >
                                            {archivedClassCount > 0
                                                ? `${archivedClassCount} past ${archivedClassCount === 1 ? 'course stays' : 'courses stay'} in Classes`
                                                : 'Manual setup and Canvas sync live in Classes'}
                                        </p>
                                    </div>
                                </div>
                            )}
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
                            <AIGenDisplay onClick={() => setPricingOpen(true)} />
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
            <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
                <div className="order-1 space-y-6">
                    <StudyCoachCard coach={studyCoach} />
                    <ActivityStreakCard
                        streak={streak}
                        weeklySummary={weeklySummary}
                        loading={weeklySummaryLoading}
                    />
                    <WeeklySummary
                        summary={weeklySummary}
                        loading={weeklySummaryLoading}
                        dueThisWeekCount={dueThisWeekCount}
                        reducedMotion={reducedMotion}
                        lowVisualBudget={lightVisualBudget}
                    />
                </div>

                <div className="order-2 lg:row-span-2">
                    <PriorityItems
                        items={priorityItems}
                        onComplete={handleCompletePriorityItem}
                        completingIds={completingAssignmentIds}
                    />
                </div>

                <div className="order-3">
                    <SectionHeading icon={Clock} title="Recently Visited" to="/notes" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {recentStudyItems.length > 0 ? (
                            recentStudyItems.map((item) => {
                                const associatedClass = classesById.get(item.class_id);
                                const isFlashcard = item._type === 'flashcard';
                                const TypeIcon = isFlashcard ? Layers : item._type === 'note' ? BookOpen : item._type === 'guide' ? Sparkles : CheckCircle2;
                                const typeLabel = isFlashcard ? `${item.cardCount || 0} Cards` : item._type === 'note' ? 'Note' : item._type === 'guide' ? 'Tutor Session' : 'Mock Exam';
                                const HoverIcon = isFlashcard ? Play : ArrowRight;

                                return (
                                    <div key={`${item._type}-${item.id}`} className="gsap-deck-card">
                                        <Link
                                            to={item._route}
                                            className="tap-action group relative block cursor-pointer overflow-hidden rounded-2xl border border-[#d1c9b8]/80 bg-[#fcfaf2]/[0.98] p-5 shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[#deb96a]/60 hover:shadow-lg active:bg-[#f4f1e8] active:shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#deb96a]"
                                        >
                                            <div className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[url('/textures/paper-fibers.png')]" />
                                            <div className="absolute right-2 top-2 translate-x-2 transform text-claude-accent opacity-0 transition-[transform,opacity,color,background-color,border-color,box-shadow] group-hover:translate-x-0 group-hover:opacity-100">
                                                <HoverIcon className={`h-4 w-4${isFlashcard ? ' fill-current' : ''}`} />
                                            </div>

                                            <div className="relative z-10 pr-6">
                                                <h3 className="mb-3 line-clamp-2 font-serif text-lg font-bold italic leading-[1.1] tracking-tight text-[#1a1c1d] transition-colors duration-300 group-hover:text-claude-accent">
                                                    {item.title}
                                                </h3>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-1.5 rounded-sm border border-[#e8e4d8] bg-[#f4f1e8] px-2 py-0.5 shadow-sm">
                                                        <TypeIcon className="h-2.5 w-2.5 text-[#5d6466]" />
                                                        <span className="text-[8px] font-bold uppercase tracking-wider text-[#5d6466] sm:text-[9px]">
                                                            {typeLabel}
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
                                <Clock className="mx-auto mb-2 h-8 w-8 text-claude-secondary opacity-50" />
                                <p className="font-serif italic text-botanical-parchment">No study activity yet</p>
                                <Link to="/create" className="mt-2 font-mono text-[10px] uppercase tracking-widest text-claude-accent hover:underline">
                                    Create or open something
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
