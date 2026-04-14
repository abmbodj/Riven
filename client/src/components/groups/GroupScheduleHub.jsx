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
        description: 'Stay private and keep your schedule out of the group view.',
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

function getCellPreview(summary) {
    if (summary.activeMeetupCount > 0) {
        return summary.meetups.find((meetup) => meetup.status !== 'cancelled')?.topic
            || `${summary.activeMeetupCount} study meetup${summary.activeMeetupCount === 1 ? '' : 's'}`;
    }

    if (summary.scheduleCount > 0) {
        return `${summary.scheduleCount} shared busy block${summary.scheduleCount === 1 ? '' : 's'}`;
    }

    if (summary.cancelledMeetupCount > 0) {
        return `${summary.cancelledMeetupCount} cancelled meetup${summary.cancelledMeetupCount === 1 ? '' : 's'}`;
    }

    return '';
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

function MonthGrid({
    anchorDate,
    monthDays,
    selectedDate,
    daySummaryByKey,
    onSelectDay,
}) {
    const today = startOfDay(new Date());

    return (
        <div role="grid" aria-label="Monthly group schedule" className="space-y-2">
            <div className="grid grid-cols-7 gap-2 px-1">
                {SHORT_DAY_LABELS.map((label) => (
                    <div
                        key={label}
                        className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-claude-secondary"
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
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
                    const preview = getCellPreview(summary);
                    const ariaLabel = [
                        formatDateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' }),
                        !inMonth ? 'outside the current month' : null,
                        summary.activeMeetupCount > 0 ? `${summary.activeMeetupCount} study meetup${summary.activeMeetupCount === 1 ? '' : 's'}` : null,
                        summary.cancelledMeetupCount > 0 ? `${summary.cancelledMeetupCount} cancelled meetup${summary.cancelledMeetupCount === 1 ? '' : 's'}` : null,
                        summary.scheduleCount > 0 ? `${summary.scheduleCount} shared busy block${summary.scheduleCount === 1 ? '' : 's'}` : null,
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
                            className={[
                                'group relative flex aspect-square min-h-[78px] min-w-0 flex-col rounded-[1.4rem] border px-2.5 py-2.5 text-left transition-all md:min-h-[96px] md:px-3 md:py-3',
                                inMonth
                                    ? 'border-white/10 bg-[rgba(12,19,30,0.54)] text-claude-text'
                                    : 'border-white/6 bg-[rgba(8,12,20,0.26)] text-claude-secondary/75',
                                isSelected
                                    ? 'border-claude-accent/45 bg-claude-accent/12 shadow-[0_0_0_1px_rgba(222,185,106,0.18),0_24px_44px_rgba(27,17,3,0.2)]'
                                    : 'hover:border-white/16 hover:bg-white/[0.045]',
                                isToday && !isSelected ? 'ring-1 ring-inset ring-emerald-400/60' : '',
                            ].join(' ')}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span
                                    className={[
                                        'inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold',
                                        isSelected
                                            ? 'bg-claude-accent/18 text-claude-text'
                                            : isToday
                                            ? 'bg-emerald-400/14 text-emerald-200'
                                            : 'text-current',
                                    ].join(' ')}
                                >
                                    {date.getDate()}
                                </span>

                                {summary.activeMeetupCount > 0 && (
                                    <span className="rounded-full border border-claude-accent/25 bg-claude-accent/12 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                        {summary.activeMeetupCount}
                                    </span>
                                )}
                            </div>

                            <div className="mt-auto min-w-0 space-y-2">
                                {preview && (
                                    <p className="hidden min-w-0 line-clamp-2 text-[11px] leading-4 text-claude-secondary md:block">
                                        {preview}
                                    </p>
                                )}

                                {summary.scheduleCount > 0 && (
                                    <div className="flex flex-col gap-1" aria-hidden="true">
                                        {Array.from({ length: Math.min(summary.scheduleCount, 2) }).map((_, index) => (
                                            <span
                                                key={`${key}-schedule-${index}`}
                                                className="h-1.5 rounded-full bg-[linear-gradient(90deg,rgba(95,134,113,0.72),rgba(64,96,80,0.28))]"
                                            />
                                        ))}
                                    </div>
                                )}

                                {summary.activeMeetupCount > 0 && (
                                    <div className="flex items-center gap-1.5" aria-hidden="true">
                                        {Array.from({ length: Math.min(summary.activeMeetupCount, 3) }).map((_, index) => (
                                            <span
                                                key={`${key}-meetup-${index}`}
                                                className="h-2.5 w-2.5 rounded-full bg-claude-accent shadow-[0_0_14px_rgba(222,185,106,0.42)]"
                                            />
                                        ))}
                                        {summary.activeMeetupCount > 3 && (
                                            <span className="text-[10px] font-mono font-semibold text-claude-accent">
                                                +{summary.activeMeetupCount - 3}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {summary.activeMeetupCount === 0 && summary.cancelledMeetupCount > 0 && (
                                    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary/70">
                                        Cancelled
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function DayDetailSurface({
    selectedDate,
    agendaItems,
    suggestions,
    suggestionMode,
    renderAgendaItem,
    onToday,
    onPropose,
    onSuggestionSelect,
    className = '',
}) {
    const hasAgenda = agendaItems.length > 0;
    const suggestionCopy = suggestionMode === 'fallback'
        ? 'No strong overlap landed on this day, so these nearby openings from the visible month are the best alternatives.'
        : 'Suggested overlap windows for the selected day.';

    return (
        <section
            data-testid="group-schedule-day-surface"
            className={`rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(20,26,38,0.92),rgba(10,14,23,0.9))] p-4 shadow-[0_32px_60px_rgba(4,7,10,0.22)] md:p-5 ${className}`.trim()}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                        Selected Day
                    </p>
                    <h3 className="mt-2 text-xl font-semibold leading-tight text-claude-text md:text-2xl">
                        {formatDateLabel(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-claude-secondary">
                        {hasAgenda
                            ? 'Meetups and shared class windows stay anchored here so you can see the day clearly before you RSVP.'
                            : 'Nothing is scheduled here yet. You can jump back to today or propose a session straight from this date.'}
                    </p>
                </div>

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
                        className="inline-flex items-center gap-2 rounded-[1.1rem] border border-claude-accent/28 bg-claude-accent/14 px-3.5 py-2.5 text-sm font-semibold text-claude-text transition-colors hover:bg-claude-accent/18"
                    >
                        <CalendarPlus2 className="h-4 w-4 text-claude-accent" />
                        <span className="hidden sm:inline">Propose Session</span>
                    </button>
                </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-claude-accent" />
                    <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                        Best Times
                    </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-claude-secondary">
                    {suggestions.length > 0
                        ? suggestionCopy
                        : 'Share schedules with at least one more member and this panel will surface the clearest overlap automatically.'}
                </p>

                {suggestions.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
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
                )}
            </div>

            <div className="mt-5 space-y-3">
                {hasAgenda ? agendaItems.map(renderAgendaItem) : (
                    <div className="rounded-[1.45rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-6 text-sm leading-6 text-claude-secondary">
                        No shared class blocks or study meetups are scheduled for this date yet.
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

    useBodyScrollLock(composerOpen);

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

    if (loading) {
        return (
            <div data-testid="group-schedule-hub" className="space-y-4">
                <div className="h-28 rounded-[1.9rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_360px]">
                    <div className="h-[520px] rounded-[2rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                    <div className="h-[520px] rounded-[2rem] border border-white/10 bg-white/[0.04] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div data-testid="group-schedule-hub" className="space-y-4 md:space-y-5">
            <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(150deg,rgba(21,27,38,0.9),rgba(11,16,25,0.92))] p-4 shadow-[0_24px_48px_rgba(6,9,12,0.18)] md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2">
                            <UsersRound className="h-4 w-4 text-claude-accent" />
                            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                Shared Availability
                            </span>
                        </div>
                        <h2 className="mt-2 text-lg font-semibold text-claude-text md:text-xl">
                            Keep your class schedule visible to {group?.name || 'this group'} on your terms.
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-claude-secondary">
                            {myShareMode && myShareMode !== 'hidden'
                                ? 'Your schedule is contributing to the calendar right now. Switch modes any time without changing your meetups.'
                                : 'Opt in with busy/free or full detail to help the group spot the easiest overlap windows.'}
                        </p>
                    </div>

                    <div className="w-full max-w-xl">
                        <ShareModeControl currentMode={myShareMode} onChange={handleShareChange} busy={shareBusy} />
                    </div>
                </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_360px] xl:grid-cols-[minmax(0,1.65fr)_380px]">
                <section className="rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(31,41,60,0.32),rgba(9,13,21,0.94)_62%)] p-4 shadow-[0_30px_60px_rgba(4,7,10,0.22)] md:p-5 lg:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => shiftMonth(-1)}
                            aria-label="Previous month"
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-claude-text transition-colors hover:bg-white/[0.08]"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>

                        <div className="min-w-0 flex-1 text-center">
                            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                Schedule
                            </p>
                            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-claude-text">
                                {formatDateLabel(anchorDate, { month: 'long', year: 'numeric' })}
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={() => shiftMonth(1)}
                            aria-label="Next month"
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-claude-text transition-colors hover:bg-white/[0.08]"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-6">
                        <MonthGrid
                            anchorDate={anchorDate}
                            monthDays={monthDays}
                            selectedDate={selectedDate}
                            daySummaryByKey={daySummaryByKey}
                            onSelectDay={(date) => setSelectedDate(startOfDay(date))}
                        />
                    </div>
                </section>

                <DayDetailSurface
                    selectedDate={selectedDate}
                    agendaItems={agendaItems}
                    suggestions={displayedSuggestions}
                    suggestionMode={suggestionMode}
                    renderAgendaItem={renderAgendaItem}
                    onToday={handleSelectToday}
                    onPropose={() => openComposer()}
                    onSuggestionSelect={(suggestion) => {
                        setSelectedDate(startOfDay(suggestion.startsAt));
                        openComposer(suggestion);
                    }}
                    className="lg:sticky lg:top-24"
                />
            </div>

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
