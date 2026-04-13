import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    CalendarDays,
    CalendarPlus2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Eye,
    EyeOff,
    Link2,
    MapPin,
    Sparkles,
    UsersRound,
    X,
} from 'lucide-react';
import {
    addDays,
    buildAgendaForDate,
    calculateBestTimes,
    formatDateLabel,
    formatMeetupRange,
    formatTimeLabel,
    fromLocalDateTimeValue,
    getRollingWeekDays,
    isSameLocalDay,
    SHORT_DAY_LABELS,
    startOfDay,
    toLocalDateTimeValue,
} from './groupScheduleUtils.js';

const SHARE_MODES = [
    {
        value: 'busy_free',
        label: 'Busy/free',
        icon: EyeOff,
        description: 'Share only your occupied windows.',
    },
    {
        value: 'full',
        label: 'Full',
        icon: Eye,
        description: 'Show class names and time blocks.',
    },
    {
        value: 'hidden',
        label: 'Hidden',
        icon: X,
        description: 'Stay private and keep your schedule out of the group view.',
    },
];

const DURATION_OPTIONS = [45, 60, 90, 120];
const EMPTY_ARRAY = [];

function createDefaultComposerDate(selectedDate = new Date()) {
    const base = startOfDay(selectedDate);
    const now = new Date();
    base.setHours(18, 0, 0, 0);

    if (base <= now) {
        const roundedNow = new Date(now);
        const currentMinutes = roundedNow.getMinutes();
        roundedNow.setMinutes(currentMinutes < 30 ? 30 : 60, 0, 0);
        return roundedNow;
    }

    return base;
}

function createComposerState(selectedDate) {
    return {
        startAtLocal: toLocalDateTimeValue(createDefaultComposerDate(selectedDate)),
        durationMinutes: 60,
        topic: '',
        locationLabel: '',
        locationUrl: '',
    };
}

function isMeetupCancelled(meetup) {
    return meetup?.status === 'cancelled';
}

function getMeetupStateLabel(meetup) {
    if (isMeetupCancelled(meetup)) return 'Cancelled';
    if (meetup?.is_joined) return 'Going';
    if (meetup?.is_creator) return 'You proposed';
    return 'Open';
}

function formatSuggestionLabel(suggestion) {
    return `${SHORT_DAY_LABELS[suggestion.startsAt.getDay()]} ${formatDateLabel(suggestion.startsAt, {
        hour: 'numeric',
        minute: '2-digit',
    })} · ${suggestion.freeCount} free`;
}

function AvatarStack({ attendees = [], count = 0 }) {
    const displayCount = count || attendees.length;

    if (!displayCount) {
        return (
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-claude-secondary">
                Nobody yet
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
                {attendees.slice(0, 4).map((attendee) => (
                    <img
                        key={attendee.id}
                        src={attendee.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${attendee.username || attendee.id}`}
                        alt=""
                        loading="lazy"
                        className="h-7 w-7 rounded-full border border-[rgba(24,42,49,0.92)] bg-white/90 p-0.5"
                    />
                ))}
            </div>
            <span className="text-[11px] font-medium text-claude-secondary">
                {displayCount}
            </span>
        </div>
    );
}

function ShareModeControl({ currentMode, onChange, busy }) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                {SHARE_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = (currentMode || 'hidden') === mode.value;

                    return (
                        <button
                            key={mode.value}
                            type="button"
                            onClick={() => onChange(mode.value)}
                            disabled={busy}
                            className={`rounded-[1.15rem] border px-3 py-3 text-left transition-all ${
                                isActive
                                    ? 'border-claude-accent/40 bg-claude-accent/12 text-claude-text shadow-[0_18px_34px_rgba(28,20,7,0.18)]'
                                    : 'border-white/10 bg-white/[0.04] text-claude-secondary hover:border-white/20 hover:text-claude-text'
                            } disabled:opacity-50`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span className="text-[11px] font-mono font-bold uppercase tracking-[0.14em]">
                                    {mode.label}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
            <p className="max-w-xl text-sm leading-6 text-claude-secondary">
                {SHARE_MODES.find((mode) => mode.value === (currentMode || 'hidden'))?.description}
            </p>
        </div>
    );
}

function ScheduleBlockCard({ item }) {
    return (
        <div className="rounded-[1.3rem] border border-[#7d9a86]/20 bg-[linear-gradient(135deg,rgba(93,132,112,0.2),rgba(23,47,40,0.72))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-claude-text">
                        {item.title}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#d9e8dd]/75">
                        {item.subtitle}
                    </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-[#d9e8dd]/80">
                    {formatTimeLabel(item.startAt.toTimeString().slice(0, 5))}
                </div>
            </div>
            <p className="mt-3 text-xs font-medium text-[#d9e8dd]/80">
                {formatTimeLabel(item.startAt.toTimeString().slice(0, 5))} - {formatTimeLabel(item.endAt.toTimeString().slice(0, 5))}
            </p>
        </div>
    );
}

function MeetupCard({ meetup, isAdmin, onJoin, onLeave, onCancel }) {
    const stateLabel = getMeetupStateLabel(meetup);
    const canCancel = !isMeetupCancelled(meetup) && (Boolean(meetup?.is_creator) || isAdmin);

    return (
        <div className="rounded-[1.45rem] border border-claude-accent/25 bg-[linear-gradient(145deg,rgba(222,185,106,0.14),rgba(43,30,12,0.72))] px-4 py-4 shadow-[0_24px_44px_rgba(17,10,2,0.2)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-claude-accent/25 bg-claude-accent/12 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                            {stateLabel}
                        </span>
                        <span className="text-[11px] font-medium text-claude-secondary">
                            {meetup.attendee_count || 0} attending
                        </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold leading-6 text-claude-text">
                        {meetup.topic}
                    </h3>
                    <div className="mt-3 space-y-2 text-sm text-claude-secondary">
                        <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-claude-accent" />
                            <span>{formatMeetupRange(meetup.start_at, meetup.end_at)}</span>
                        </div>
                        {meetup.location_label && (
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-claude-accent" />
                                <span className="truncate">{meetup.location_label}</span>
                            </div>
                        )}
                        {!meetup.location_label && meetup.location_url && (
                            <div className="flex items-center gap-2">
                                <Link2 className="h-4 w-4 text-claude-accent" />
                                <span className="truncate">Shared link available</span>
                            </div>
                        )}
                    </div>
                </div>
                <AvatarStack attendees={meetup.attendees || []} count={meetup.attendee_count || 0} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {isMeetupCancelled(meetup) ? (
                    <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-claude-secondary">
                        This session has been cancelled.
                    </div>
                ) : meetup.is_joined ? (
                    <button
                        type="button"
                        onClick={() => onLeave(meetup)}
                        className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-claude-text transition-colors hover:border-white/20 hover:bg-white/[0.09]"
                    >
                        Going
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onJoin(meetup)}
                        className="rounded-full border border-claude-accent/30 bg-claude-accent px-4 py-2 text-sm font-semibold text-[#182a31] transition-transform hover:-translate-y-0.5"
                    >
                        Join
                    </button>
                )}

                {canCancel && (
                    <button
                        type="button"
                        onClick={() => onCancel(meetup)}
                        className="rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/16"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}

export default function GroupScheduleHub({
    group,
    calendarData,
    loading,
    isAdmin,
    composerRequestKey = 0,
    onRangeChange,
    onSetShareMode,
    onCreateMeetup,
    onJoinMeetup,
    onLeaveMeetup,
    onCancelMeetup,
}) {
    const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
    const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
    const [shareBusy, setShareBusy] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerStep, setComposerStep] = useState(1);
    const [composer, setComposer] = useState(() => createComposerState(new Date()));
    const [submitting, setSubmitting] = useState(false);
    const [composerError, setComposerError] = useState('');

    const members = calendarData?.members ?? EMPTY_ARRAY;
    const scheduleSlots = calendarData?.schedule_slots ?? EMPTY_ARRAY;
    const meetups = calendarData?.meetups ?? EMPTY_ARRAY;
    const myShareMode = calendarData?.my_share_mode || null;
    const weekDays = useMemo(() => getRollingWeekDays(anchorDate), [anchorDate]);
    const agendaItems = useMemo(
        () => buildAgendaForDate(selectedDate, scheduleSlots, meetups),
        [meetups, scheduleSlots, selectedDate],
    );
    const bestTimes = useMemo(
        () => calculateBestTimes({ anchorDate, members, meetups, scheduleSlots }),
        [anchorDate, members, meetups, scheduleSlots],
    );
    const upcomingMeetups = useMemo(
        () => meetups
            .filter((meetup) => !isMeetupCancelled(meetup))
            .sort((left, right) => new Date(left.start_at) - new Date(right.start_at))
            .slice(0, 5),
        [meetups],
    );

    useEffect(() => {
        const isSelectedVisible = weekDays.some((day) => isSameLocalDay(day, selectedDate));
        if (!isSelectedVisible) {
            setSelectedDate(weekDays[0]);
        }
    }, [selectedDate, weekDays]);

    useEffect(() => {
        onRangeChange?.(weekDays[0], weekDays[6]);
    }, [onRangeChange, weekDays]);

    useEffect(() => {
        if (!composerRequestKey) return;
        openComposer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [composerRequestKey]);

    const handlePrevWeek = () => setAnchorDate((current) => addDays(current, -7));
    const handleNextWeek = () => setAnchorDate((current) => addDays(current, 7));

    const openComposer = (suggestion = null) => {
        const baseDate = suggestion?.startsAt || selectedDate;
        const nextComposer = createComposerState(baseDate);

        if (suggestion?.startsAt) {
            nextComposer.startAtLocal = toLocalDateTimeValue(suggestion.startsAt);
            nextComposer.durationMinutes = Math.round((suggestion.endsAt.getTime() - suggestion.startsAt.getTime()) / (60 * 1000));
        }

        setComposer(nextComposer);
        setComposerError('');
        setComposerStep(suggestion?.startsAt ? 2 : 1);
        setComposerOpen(true);
    };

    const closeComposer = () => {
        setComposerOpen(false);
        setComposerError('');
        setComposerStep(1);
        setSubmitting(false);
    };

    const handleShareChange = async (mode) => {
        setShareBusy(true);
        try {
            await onSetShareMode(mode);
        } finally {
            setShareBusy(false);
        }
    };

    const handleComposerContinue = () => {
        const startAt = fromLocalDateTimeValue(composer.startAtLocal);
        if (!startAt) {
            setComposerError('Choose a start time.');
            return;
        }

        setComposerError('');
        setComposerStep(2);
    };

    const handleComposerSubmit = async (event) => {
        event.preventDefault();
        const startAt = fromLocalDateTimeValue(composer.startAtLocal);

        if (!startAt) {
            setComposerError('Choose a valid start time.');
            setComposerStep(1);
            return;
        }

        if (!composer.topic.trim()) {
            setComposerError('Add a session topic so everyone knows what they’re joining.');
            return;
        }

        setSubmitting(true);
        setComposerError('');

        try {
            const endAt = new Date(startAt.getTime() + Number(composer.durationMinutes) * 60 * 1000);
            await onCreateMeetup({
                topic: composer.topic.trim(),
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                location_label: composer.locationLabel.trim() || null,
                location_url: composer.locationUrl.trim() || null,
            });

            setSelectedDate(startOfDay(startAt));
            closeComposer();
        } finally {
            setSubmitting(false);
        }
    };

    const renderAgendaItem = (item) => {
        if (item.kind === 'schedule') {
            return <ScheduleBlockCard key={item.id} item={item} />;
        }

        return (
            <MeetupCard
                key={item.id}
                meetup={item.meetup}
                isAdmin={isAdmin}
                onJoin={onJoinMeetup}
                onLeave={onLeaveMeetup}
                onCancel={onCancelMeetup}
            />
        );
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-32 rounded-[2rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_320px]">
                    <div className="h-[420px] rounded-[2rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                    <div className="h-[420px] rounded-[2rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6">
            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-5 shadow-[0_30px_60px_rgba(9,13,16,0.2)] md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                Schedule
                            </span>
                            <span className="text-[11px] font-medium text-claude-secondary">
                                Coordination hub for {group?.name}
                            </span>
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-claude-text md:text-[2rem]">
                            Shared availability, clear RSVPs, fast session planning.
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-claude-secondary md:text-[15px]">
                            Everyone sees the same week, shared class time stays opt-in, and proposing a study session takes just a couple of taps.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => openComposer()}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-claude-accent px-5 py-3 text-sm font-semibold text-[#182a31] shadow-[0_18px_36px_rgba(40,28,9,0.24)] transition-transform hover:-translate-y-0.5"
                    >
                        <CalendarPlus2 className="h-4 w-4" />
                        Propose Session
                    </button>
                </div>

                <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-black/10 p-4 md:p-5">
                    <div className="flex items-center gap-2">
                        <UsersRound className="h-4 w-4 text-claude-accent" />
                        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                            Shared Availability
                        </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-claude-secondary">
                        {myShareMode && myShareMode !== 'hidden'
                            ? 'Your schedule is contributing to the group calendar right now.'
                            : 'You can keep this private, share only busy/free time, or reveal full class names for this group.'}
                    </p>
                    <div className="mt-4">
                        <ShareModeControl currentMode={myShareMode} onChange={handleShareChange} busy={shareBusy} />
                    </div>
                </div>
            </section>

            <div className="md:hidden space-y-4">
                <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(255,255,255,0.035)] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                Next 7 Days
                            </p>
                            <p className="mt-1 text-sm text-claude-secondary">
                                Swipe across the week and tap a day to inspect it.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={handlePrevWeek} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-claude-text">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={handleNextWeek} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-claude-text">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="-mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
                        {weekDays.map((day) => {
                            const isActive = isSameLocalDay(day, selectedDate);
                            const dayAgendaCount = buildAgendaForDate(day, scheduleSlots, meetups).length;

                            return (
                                <button
                                    key={day.toISOString()}
                                    type="button"
                                    onClick={() => setSelectedDate(day)}
                                    className={`snap-start rounded-[1.3rem] border px-4 py-3 text-left transition-all ${
                                        isActive
                                            ? 'border-claude-accent/40 bg-claude-accent/12 text-claude-text'
                                            : 'border-white/10 bg-white/[0.04] text-claude-secondary'
                                    }`}
                                >
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em]">
                                        {SHORT_DAY_LABELS[day.getDay()]}
                                    </p>
                                    <p className="mt-1 text-xl font-semibold">
                                        {day.getDate()}
                                    </p>
                                    <p className="mt-2 text-xs font-medium">
                                        {dayAgendaCount} items
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(255,255,255,0.035)] p-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-claude-accent" />
                        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                            Best Times
                        </span>
                    </div>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {bestTimes.length > 0 ? bestTimes.map((suggestion) => (
                            <button
                                key={suggestion.key}
                                type="button"
                                onClick={() => {
                                    setSelectedDate(startOfDay(suggestion.startsAt));
                                    openComposer(suggestion);
                                }}
                                className="shrink-0 rounded-full border border-claude-accent/20 bg-claude-accent/10 px-4 py-2 text-sm font-medium text-claude-text transition-colors hover:bg-claude-accent/16"
                            >
                                {formatSuggestionLabel(suggestion)}
                            </button>
                        )) : (
                            <p className="text-sm leading-6 text-claude-secondary">
                                Share schedules with at least one more member and we’ll surface the clearest overlap here.
                            </p>
                        )}
                    </div>
                </section>

                <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(255,255,255,0.035)] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                {formatDateLabel(selectedDate, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="mt-1 text-sm text-claude-secondary">
                                Today’s classes and proposed sessions.
                            </p>
                        </div>
                        <CalendarDays className="h-5 w-5 text-claude-secondary" />
                    </div>

                    <div className="mt-4 space-y-3">
                        {agendaItems.length > 0 ? agendaItems.map(renderAgendaItem) : (
                            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm leading-6 text-claude-secondary">
                                No shared class blocks or study sessions are scheduled for this day yet.
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="hidden md:grid md:grid-cols-[minmax(0,1.7fr)_320px] md:gap-6">
                <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.035)] p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                Rolling Week
                            </p>
                            <h3 className="mt-2 text-xl font-semibold text-claude-text">
                                {formatDateLabel(weekDays[0], { month: 'short', day: 'numeric' })} - {formatDateLabel(weekDays[6], { month: 'short', day: 'numeric' })}
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={handlePrevWeek} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-claude-text transition-colors hover:bg-white/[0.08]">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={handleNextWeek} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-claude-text transition-colors hover:bg-white/[0.08]">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-7 gap-3">
                        {weekDays.map((day) => {
                            const items = buildAgendaForDate(day, scheduleSlots, meetups);
                            const isActive = isSameLocalDay(day, selectedDate);

                            return (
                                <button
                                    key={day.toISOString()}
                                    type="button"
                                    onClick={() => setSelectedDate(day)}
                                    className={`flex min-h-[420px] flex-col rounded-[1.45rem] border p-3 text-left transition-all ${
                                        isActive
                                            ? 'border-claude-accent/32 bg-claude-accent/8 shadow-[0_18px_32px_rgba(30,18,3,0.16)]'
                                            : 'border-white/8 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]'
                                    }`}
                                >
                                    <div className="shrink-0">
                                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                            {SHORT_DAY_LABELS[day.getDay()]}
                                        </p>
                                        <p className="mt-2 text-2xl font-semibold text-claude-text">
                                            {day.getDate()}
                                        </p>
                                    </div>

                                    <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                                        {items.length > 0 ? items.map((item) => (
                                            item.kind === 'schedule' ? (
                                                <div key={item.id} className="rounded-[1rem] border border-[#7d9a86]/18 bg-[rgba(84,114,98,0.18)] px-3 py-2">
                                                    <p className="text-xs font-semibold text-claude-text">{item.title}</p>
                                                    <p className="mt-1 text-[11px] text-[#d9e8dd]/70">
                                                        {formatTimeLabel(item.startAt.toTimeString().slice(0, 5))}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div key={item.id} className="rounded-[1rem] border border-claude-accent/20 bg-claude-accent/10 px-3 py-2">
                                                    <p className="text-xs font-semibold text-claude-text line-clamp-2">{item.meetup.topic}</p>
                                                    <p className="mt-1 text-[11px] text-claude-secondary">
                                                        {formatDateLabel(new Date(item.meetup.start_at), { hour: 'numeric', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            )
                                        )) : (
                                            <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-[11px] leading-5 text-claude-secondary">
                                                Open
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <aside className="space-y-4">
                    <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.035)] p-5">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-claude-accent" />
                            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                Best Times
                            </span>
                        </div>
                        <div className="mt-4 space-y-2">
                            {bestTimes.length > 0 ? bestTimes.map((suggestion) => (
                                <button
                                    key={suggestion.key}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDate(startOfDay(suggestion.startsAt));
                                        openComposer(suggestion);
                                    }}
                                    className="w-full rounded-[1.2rem] border border-claude-accent/18 bg-claude-accent/10 px-4 py-3 text-left transition-colors hover:bg-claude-accent/16"
                                >
                                    <p className="text-sm font-semibold text-claude-text">
                                        {formatSuggestionLabel(suggestion)}
                                    </p>
                                </button>
                            )) : (
                                <p className="text-sm leading-6 text-claude-secondary">
                                    Once more members share class time, this panel will surface the easiest overlap windows automatically.
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.035)] p-5">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-claude-accent" />
                            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                Upcoming
                            </span>
                        </div>
                        <div className="mt-4 space-y-3">
                            {upcomingMeetups.length > 0 ? upcomingMeetups.map((meetup) => (
                                <button
                                    key={meetup.id}
                                    type="button"
                                    onClick={() => setSelectedDate(startOfDay(meetup.start_at))}
                                    className="w-full rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
                                >
                                    <p className="text-sm font-semibold text-claude-text line-clamp-2">{meetup.topic}</p>
                                    <p className="mt-1 text-xs font-medium text-claude-secondary">
                                        {formatMeetupRange(meetup.start_at, meetup.end_at)}
                                    </p>
                                    <p className="mt-2 text-[11px] font-medium text-claude-secondary">
                                        {meetup.attendee_count || 0} attending
                                    </p>
                                </button>
                            )) : (
                                <p className="text-sm leading-6 text-claude-secondary">
                                    No upcoming sessions yet. Pick a suggestion above or propose one from scratch.
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-white/10 bg-[rgba(255,255,255,0.035)] p-5">
                        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                            Selected Day
                        </p>
                        <p className="mt-2 text-lg font-semibold text-claude-text">
                            {formatDateLabel(selectedDate, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                        <div className="mt-4 space-y-3">
                            {agendaItems.length > 0 ? agendaItems.map(renderAgendaItem) : (
                                <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm leading-6 text-claude-secondary">
                                    This day is open right now.
                                </div>
                            )}
                        </div>
                    </section>
                </aside>
            </div>

            <AnimatePresence>
                {composerOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                            onClick={submitting ? undefined : closeComposer}
                        />

                        <motion.form
                            initial={{ opacity: 0, y: 24, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.98 }}
                            onSubmit={handleComposerSubmit}
                            className="relative w-full max-w-lg rounded-t-[2.2rem] border border-white/10 bg-[rgba(22,42,49,0.92)] p-6 shadow-[0_40px_90px_rgba(0,0,0,0.34)] md:rounded-[2rem] md:p-7"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                        Propose Session
                                    </p>
                                    <h3 className="mt-2 text-2xl font-semibold text-claude-text">
                                        {composerStep === 1 ? 'Pick the time' : 'Add the details'}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeComposer}
                                    disabled={submitting}
                                    className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-claude-text"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {composerStep === 1 ? (
                                <div className="mt-6 space-y-5">
                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                            Start time
                                        </span>
                                        <input
                                            type="datetime-local"
                                            value={composer.startAtLocal}
                                            onChange={(event) => setComposer((current) => ({ ...current, startAtLocal: event.target.value }))}
                                            className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                            Duration
                                        </span>
                                        <div className="grid grid-cols-4 gap-2">
                                            {DURATION_OPTIONS.map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => setComposer((current) => ({ ...current, durationMinutes: option }))}
                                                    className={`rounded-[1rem] border px-3 py-3 text-sm font-semibold transition-colors ${
                                                        Number(composer.durationMinutes) === option
                                                            ? 'border-claude-accent/35 bg-claude-accent/12 text-claude-text'
                                                            : 'border-white/10 bg-white/[0.04] text-claude-secondary'
                                                    }`}
                                                >
                                                    {option}m
                                                </button>
                                            ))}
                                        </div>
                                    </label>
                                </div>
                            ) : (
                                <div className="mt-6 space-y-5">
                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                            Topic
                                        </span>
                                        <input
                                            type="text"
                                            value={composer.topic}
                                            onChange={(event) => setComposer((current) => ({ ...current, topic: event.target.value }))}
                                            placeholder="e.g. Organic chemistry problem set"
                                            className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                            Place or label
                                        </span>
                                        <input
                                            type="text"
                                            value={composer.locationLabel}
                                            onChange={(event) => setComposer((current) => ({ ...current, locationLabel: event.target.value }))}
                                            placeholder="Library East, Room 202"
                                            className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                            Optional link
                                        </span>
                                        <input
                                            type="url"
                                            value={composer.locationUrl}
                                            onChange={(event) => setComposer((current) => ({ ...current, locationUrl: event.target.value }))}
                                            placeholder="https://..."
                                            className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
                                        />
                                    </label>
                                </div>
                            )}

                            {composerError && (
                                <p className="mt-4 rounded-[1rem] border border-red-400/16 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
                                    {composerError}
                                </p>
                            )}

                            <div className="mt-6 flex items-center gap-3">
                                {composerStep === 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setComposerStep(1)}
                                        disabled={submitting}
                                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-claude-text"
                                    >
                                        Back
                                    </button>
                                )}

                                {composerStep === 1 ? (
                                    <button
                                        type="button"
                                        onClick={handleComposerContinue}
                                        className="flex-1 rounded-full bg-claude-accent px-5 py-3 text-sm font-semibold text-[#182a31]"
                                    >
                                        Continue
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 rounded-full bg-claude-accent px-5 py-3 text-sm font-semibold text-[#182a31] disabled:opacity-60"
                                    >
                                        {submitting ? 'Creating…' : 'Create Session'}
                                    </button>
                                )}
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
