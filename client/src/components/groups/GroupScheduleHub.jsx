import { useEffect, useMemo, useRef, useState } from 'react';
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
    addMonths,
    calculateBestTimes,
    formatDateLabel,
    formatMeetupRange,
    formatTimeLabel,
    fromLocalDateTimeValue,
    getMonthGridDays,
    getVisibleMonthRange,
    isSameLocalDay,
    isSameLocalMonth,
    SHORT_DAY_LABELS,
    startOfDay,
    startOfMonth,
    summarizeDay,
    toDateKey,
    toLocalDateTimeValue,
} from './groupScheduleUtils.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

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
        description: 'Stay private.',
    },
];

const DURATION_OPTIONS = [45, 60, 90, 120];
const EMPTY_ARRAY = [];
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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

function getLocalTimezoneLabel(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Local time';

    const timezoneName = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')
        ?.value;

    return timezoneName ? `Local time (${timezoneName})` : 'Local time';
}

function formatSuggestionLabel(suggestion) {
    return `${SHORT_DAY_LABELS[suggestion.startsAt.getDay()]} ${formatDateLabel(suggestion.startsAt, {
        hour: 'numeric',
        minute: '2-digit',
    })} · ${suggestion.freeCount} free`;
}

function getPreservedDayForMonth(selectedDate, targetMonth) {
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();
    const maxDay = new Date(year, month + 1, 0).getDate();
    return startOfDay(new Date(year, month, Math.min(selectedDate.getDate(), maxDay)));
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
    const locationHref = meetup.location_url || null;
    const locationLabel = meetup.location_label || (locationHref ? 'Shared link available' : '');

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
                    <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-claude-text">
                        {meetup.topic}
                    </h3>
                    <div className="mt-3 space-y-2 text-sm text-claude-secondary">
                        <div className="flex items-start gap-2">
                            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-claude-accent" />
                            <div className="min-w-0">
                                <div>{formatMeetupRange(meetup.start_at, meetup.end_at)}</div>
                                <div className="mt-1 text-xs text-claude-secondary/80">
                                    {getLocalTimezoneLabel(meetup.start_at)}
                                </div>
                            </div>
                        </div>
                        {locationLabel && (
                            <div className="flex items-center gap-2">
                                {meetup.location_label ? (
                                    <MapPin className="h-4 w-4 shrink-0 text-claude-accent" />
                                ) : (
                                    <Link2 className="h-4 w-4 shrink-0 text-claude-accent" />
                                )}
                                {locationHref ? (
                                    <a
                                        href={locationHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="truncate underline-offset-4 hover:underline"
                                    >
                                        {locationLabel}
                                    </a>
                                ) : (
                                    <span className="truncate">{locationLabel}</span>
                                )}
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
                        Leave
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

// Compact Google Calendar-style month grid
function MonthGrid({
    anchorDate,
    monthDays,
    selectedDate,
    daySummaryByKey,
    onSelectDay,
}) {
    const today = startOfDay(new Date());

    return (
        <div role="grid" aria-label="Monthly group schedule">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 pb-2">
                {SHORT_DAY_LABELS.map((label) => (
                    <div
                        key={label}
                        className="text-center text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-claude-secondary/50"
                    >
                        {label}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
                {monthDays.map((date) => {
                    const key = toDateKey(date);
                    const summary = daySummaryByKey.get(key) || {
                        scheduleCount: 0,
                        meetupCount: 0,
                        activeMeetupCount: 0,
                        cancelledMeetupCount: 0,
                        meetups: EMPTY_ARRAY,
                    };
                    const inMonth = isSameLocalMonth(date, anchorDate);
                    const isSelected = isSameLocalDay(date, selectedDate);
                    const isToday = isSameLocalDay(date, today);
                    const hasMeetups = summary.activeMeetupCount > 0;
                    const hasSchedule = summary.scheduleCount > 0;
                    const hasCancelledOnly = !hasMeetups && !hasSchedule && summary.cancelledMeetupCount > 0;

                    const ariaLabel = [
                        formatDateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' }),
                        !inMonth ? 'outside current month' : null,
                        hasMeetups ? `${summary.activeMeetupCount} meetup${summary.activeMeetupCount === 1 ? '' : 's'}` : null,
                        summary.cancelledMeetupCount > 0 ? `${summary.cancelledMeetupCount} cancelled` : null,
                        hasSchedule ? `${summary.scheduleCount} busy block${summary.scheduleCount === 1 ? '' : 's'}` : null,
                    ].filter(Boolean).join(', ');

                    return (
                        <button
                            key={key}
                            type="button"
                            role="gridcell"
                            aria-label={ariaLabel}
                            aria-selected={isSelected}
                            aria-current={isToday ? 'date' : undefined}
                            onClick={() => onSelectDay(date)}
                            className="flex flex-col items-center gap-1 py-1.5 focus:outline-none focus-visible:ring-0"
                        >
                            {/* Day number circle */}
                            <span
                                className={[
                                    'inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-150',
                                    isSelected
                                        ? 'bg-claude-accent text-[#182a31] shadow-[0_0_18px_rgba(222,185,106,0.28)]'
                                        : isToday
                                        ? 'bg-emerald-400/[0.08] text-emerald-200 ring-1 ring-emerald-400/60'
                                        : inMonth
                                        ? 'text-claude-text hover:bg-white/[0.07]'
                                        : 'text-claude-secondary/30',
                                ].join(' ')}
                            >
                                {date.getDate()}
                            </span>

                            {/* Event indicator dots */}
                            <div className="flex h-2 items-center justify-center gap-[3px]" aria-hidden="true">
                                {hasMeetups && Array.from({ length: Math.min(summary.activeMeetupCount, 3) }).map((_, index) => (
                                    <span
                                        key={`${key}-dot-${index}`}
                                        className={[
                                            'h-1.5 w-1.5 rounded-full',
                                            isSelected ? 'bg-[#182a31]/50' : 'bg-claude-accent',
                                        ].join(' ')}
                                    />
                                ))}
                                {!hasMeetups && hasSchedule && (
                                    <span className="h-1 w-4 rounded-full bg-botanical-forest/55" />
                                )}
                                {hasCancelledOnly && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-white/[0.18]" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// Mobile-only slide-up bottom sheet wrapper
function DayDetailSheet({ open, onClose, children }) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="sheet-backdrop"
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />
                    <motion.div
                        key="sheet-panel"
                        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[76vh] flex-col rounded-t-[2rem] border-t border-white/10 bg-[rgba(20,32,38,0.97)] shadow-[0_-24px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:hidden"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
                    >
                        {/* Drag handle */}
                        <div className="mx-auto mt-3 mb-1 h-1 w-10 shrink-0 rounded-full bg-white/20" />
                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Day detail panel (used in both mobile sheet and desktop sidebar)
function DayDetailSurface({
    selectedDate,
    agendaItems,
    suggestions,
    suggestionMode,
    renderAgendaItem,
    onToday,
    onPropose,
    onSuggestionSelect,
    onClose,
    className = '',
}) {
    const hasAgenda = agendaItems.length > 0;
    const suggestionCopy = suggestionMode === 'fallback'
        ? 'Best nearby openings this month.'
        : 'Best overlap windows for this day.';

    return (
        <section
            data-testid="group-schedule-day-surface"
            className={`rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(20,26,38,0.92),rgba(10,14,23,0.9))] p-4 shadow-[0_32px_60px_rgba(4,7,10,0.22)] md:p-5 ${className}`.trim()}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold leading-tight text-claude-text">
                    {formatDateLabel(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>

                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={onToday}
                        className="rounded-full border border-emerald-400/18 bg-emerald-400/12 px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/18"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={onPropose}
                        className="inline-flex items-center gap-1.5 rounded-[1.1rem] border border-claude-accent/28 bg-claude-accent/14 px-3 py-2 text-sm font-semibold text-claude-text transition-colors hover:bg-claude-accent/18"
                    >
                        <CalendarPlus2 className="h-4 w-4 text-claude-accent" />
                        <span className="hidden sm:inline">Propose</span>
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-claude-secondary transition-colors hover:text-claude-text"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Best Times panel */}
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-claude-accent" />
                    <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                        Best Times
                    </span>
                </div>

                {suggestions.length > 0 ? (
                    <>
                        <p className="mt-1.5 text-xs leading-5 text-claude-secondary">
                            {suggestionCopy}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion.key}
                                    type="button"
                                    onClick={() => onSuggestionSelect(suggestion)}
                                    className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-4 py-2 text-sm font-medium text-claude-text transition-colors hover:bg-claude-accent/16"
                                >
                                    {formatSuggestionLabel(suggestion)}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="mt-1.5 text-xs leading-5 text-claude-secondary">
                        Share your schedule to unlock overlap suggestions.
                    </p>
                )}
            </div>

            {/* Agenda */}
            <div className="mt-5">
                {hasAgenda ? (
                    <AnimatePresence mode="popLayout" initial={false}>
                        {agendaItems.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                layout="position"
                                className="mb-3 last:mb-0"
                            >
                                {renderAgendaItem(item)}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                ) : (
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                            <CalendarDays className="h-5 w-5 text-claude-secondary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-claude-text">Nothing scheduled</p>
                            <p className="mt-1 text-xs leading-5 text-claude-secondary">
                                Propose a session to get things going.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onPropose}
                            className="inline-flex items-center gap-1.5 rounded-full border border-claude-accent/30 bg-claude-accent/14 px-4 py-2 text-sm font-semibold text-claude-text transition-colors hover:bg-claude-accent/20"
                        >
                            <CalendarPlus2 className="h-3.5 w-3.5 text-claude-accent" />
                            Propose Session
                        </button>
                    </div>
                )}
            </div>
        </section>
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
    const [sheetOpen, setSheetOpen] = useState(false);
    const [shareBusy, setShareBusy] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerStep, setComposerStep] = useState(1);
    const [composer, setComposer] = useState(() => createComposerState(new Date()));
    const [submitting, setSubmitting] = useState(false);
    const [composerError, setComposerError] = useState('');
    const dialogRef = useRef(null);
    const restoreFocusRef = useRef(null);
    const titleIdRef = useRef(`group-meetup-composer-title-${Math.random().toString(36).slice(2, 9)}`);

    const members = calendarData?.members ?? EMPTY_ARRAY;
    const scheduleSlots = calendarData?.schedule_slots ?? EMPTY_ARRAY;
    const meetups = calendarData?.meetups ?? EMPTY_ARRAY;
    const myShareMode = calendarData?.my_share_mode || null;
    const visibleRange = useMemo(() => getVisibleMonthRange(anchorDate), [anchorDate]);
    const monthDays = useMemo(() => getMonthGridDays(anchorDate), [anchorDate]);

    const daySummaryByKey = useMemo(() => {
        const summaryMap = new Map();

        monthDays.forEach((date) => {
            summaryMap.set(toDateKey(date), summarizeDay(date, scheduleSlots, meetups));
        });

        return summaryMap;
    }, [meetups, monthDays, scheduleSlots]);

    const selectedDaySummary = useMemo(
        () => daySummaryByKey.get(toDateKey(selectedDate)) || summarizeDay(selectedDate, scheduleSlots, meetups),
        [daySummaryByKey, meetups, scheduleSlots, selectedDate],
    );

    const agendaItems = selectedDaySummary.agendaItems;
    const bestTimes = useMemo(
        () => calculateBestTimes({
            rangeStart: visibleRange.start,
            rangeEnd: visibleRange.end,
            members,
            meetups,
            scheduleSlots,
            limit: 6,
        }),
        [members, meetups, scheduleSlots, visibleRange.end, visibleRange.start],
    );
    const selectedDaySuggestions = useMemo(
        () => bestTimes.filter((suggestion) => isSameLocalDay(suggestion.startsAt, selectedDate)).slice(0, 3),
        [bestTimes, selectedDate],
    );
    const displayedSuggestions = selectedDaySuggestions.length > 0
        ? selectedDaySuggestions
        : bestTimes.slice(0, 3);
    const suggestionMode = selectedDaySuggestions.length > 0
        ? 'selected'
        : bestTimes.length > 0
        ? 'fallback'
        : 'empty';

    useBodyScrollLock(composerOpen || sheetOpen);

    useEffect(() => {
        onRangeChange?.(visibleRange.start, visibleRange.end);
    }, [onRangeChange, visibleRange.end, visibleRange.start]);

    useEffect(() => {
        if (!composerRequestKey) return;
        openComposer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [composerRequestKey]);

    const handleSelectToday = () => {
        const today = startOfDay(new Date());
        setAnchorDate(today);
        setSelectedDate(today);
    };

    const shiftMonth = (direction) => {
        setAnchorDate((current) => {
            const nextMonth = addMonths(current, direction);
            setSelectedDate((currentSelected) => getPreservedDayForMonth(currentSelected, nextMonth));
            return nextMonth;
        });
    };

    const handleSelectDay = (date) => {
        setSelectedDate(startOfDay(date));
        setSheetOpen(true);
    };

    const openComposer = (suggestion = null) => {
        if (document.activeElement instanceof HTMLElement) {
            restoreFocusRef.current = document.activeElement;
        }

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

        const elementToRestore = restoreFocusRef.current;
        if (elementToRestore instanceof HTMLElement) {
            window.requestAnimationFrame(() => {
                if (elementToRestore.isConnected) {
                    elementToRestore.focus();
                }
            });
        }
    };

    useEffect(() => {
        if (!composerOpen || !dialogRef.current) return undefined;

        const dialog = dialogRef.current;
        const focusTarget = dialog.querySelector(
            composerStep === 1 ? 'input[name="meetup-start-at"]' : 'input[name="meetup-topic"]',
        );
        const focusableElements = dialog.querySelectorAll(FOCUSABLE_SELECTOR);
        const fallbackTarget = focusableElements[0];

        (focusTarget instanceof HTMLElement ? focusTarget : fallbackTarget)?.focus();

        const handleTab = (event) => {
            if (event.key !== 'Tab') return;

            const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)]
                .filter((element) => !element.hasAttribute('disabled'));

            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        dialog.addEventListener('keydown', handleTab);

        return () => {
            dialog.removeEventListener('keydown', handleTab);
        };
    }, [composerOpen, composerStep]);

    useEffect(() => {
        if (!composerOpen || submitting) return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeComposer();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [composerOpen, submitting]);

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
            setComposerError("Add a session topic so everyone knows what they're joining.");
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

            setAnchorDate(startOfMonth(startAt));
            setSelectedDate(startOfDay(startAt));
            closeComposer();
        } catch (error) {
            setComposerError(error?.message || 'Failed to create the study session.');
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

    // Shared props for both mobile sheet and desktop sidebar instances
    const dayDetailProps = {
        selectedDate,
        agendaItems,
        suggestions: displayedSuggestions,
        suggestionMode,
        renderAgendaItem,
        onToday: handleSelectToday,
        onPropose: () => openComposer(),
        onSuggestionSelect: (suggestion) => {
            setSelectedDate(startOfDay(suggestion.startsAt));
            openComposer(suggestion);
        },
    };

    if (loading) {
        return (
            <div data-testid="group-schedule-hub" className="space-y-4">
                <div className="h-20 rounded-[1.9rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_360px]">
                    <div className="h-[400px] rounded-[2rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                    <div className="hidden lg:block h-[400px] rounded-[2rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div data-testid="group-schedule-hub" className="space-y-4 md:space-y-5">
            {/* Shared Availability — text-reduced header */}
            <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(150deg,rgba(21,27,38,0.9),rgba(11,16,25,0.92))] p-4 shadow-[0_24px_48px_rgba(6,9,12,0.18)] md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <UsersRound className="h-4 w-4 text-claude-accent" />
                            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                Shared Availability
                            </span>
                        </div>
                        <h2 className="mt-2 text-lg font-semibold text-claude-text md:text-xl">
                            Keep your schedule visible to {group?.name || 'this group'} on your terms.
                        </h2>
                    </div>

                    <div className="w-full max-w-xl">
                        <ShareModeControl currentMode={myShareMode} onChange={handleShareChange} busy={shareBusy} />
                    </div>
                </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_360px] xl:grid-cols-[minmax(0,1.65fr)_380px]">
                {/* Calendar section */}
                <section className="rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(31,41,60,0.32),rgba(9,13,21,0.94)_62%)] p-4 shadow-[0_30px_60px_rgba(4,7,10,0.22)] md:p-5 lg:p-6">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => shiftMonth(-1)}
                            aria-label="Previous month"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-claude-text transition-colors hover:bg-white/[0.08]"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>

                        <div className="min-w-0 flex-1 text-center">
                            <h2 className="text-2xl font-semibold tracking-tight text-claude-text md:text-3xl">
                                {formatDateLabel(anchorDate, { month: 'long', year: 'numeric' })}
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={() => shiftMonth(1)}
                            aria-label="Next month"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-claude-text transition-colors hover:bg-white/[0.08]"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-5">
                        <MonthGrid
                            anchorDate={anchorDate}
                            monthDays={monthDays}
                            selectedDate={selectedDate}
                            daySummaryByKey={daySummaryByKey}
                            onSelectDay={handleSelectDay}
                        />
                    </div>
                </section>

                {/* Desktop sidebar — hidden on mobile */}
                <div className="hidden lg:block">
                    <DayDetailSurface
                        {...dayDetailProps}
                        className="lg:sticky lg:top-24"
                    />
                </div>
            </div>

            {/* Mobile bottom sheet — hidden on lg+ */}
            <DayDetailSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
                <DayDetailSurface
                    {...dayDetailProps}
                    onClose={() => setSheetOpen(false)}
                    className="rounded-none border-0 bg-transparent shadow-none"
                />
            </DayDetailSheet>

            {/* Meetup composer modal */}
            <AnimatePresence>
                {composerOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            aria-hidden="true"
                            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                            onClick={submitting ? undefined : closeComposer}
                        />

                        <motion.form
                            ref={dialogRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={titleIdRef.current}
                            initial={{ opacity: 0, y: 24, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.98 }}
                            onSubmit={handleComposerSubmit}
                            className="relative w-full max-w-lg rounded-t-[2.2rem] border border-white/10 bg-[rgba(22,42,49,0.92)] p-6 shadow-[0_40px_90px_rgba(0,0,0,0.34)] md:rounded-[2rem] md:p-7"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                        Propose Session
                                    </p>
                                    <h3 id={titleIdRef.current} className="mt-2 text-2xl font-semibold text-claude-text">
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
                                            name="meetup-start-at"
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
                                            name="meetup-topic"
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
