import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    CalendarDays,
    CalendarPlus2,
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
    calculateBestTimes,
    formatDateLabel,
    formatMemberName,
    formatMeetupRange,
    formatTimeLabel,
    fromLocalDateTimeValue,
    getVisibleMonthRange,
    isSameLocalDay,
    SHORT_DAY_LABELS,
    startOfDay,
    startOfMonth,
    summarizeDay,
    toLocalDateTimeValue,
} from './groupScheduleUtils.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import CalendarHeader from '../calendar/CalendarHeader.jsx';
import CalendarGrid from '../calendar/CalendarGrid.jsx';
import CalendarTimeline from '../calendar/CalendarTimeline.jsx';

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
const MEETUP_SOURCE_ID = 'group-meetups';
const MEETUP_COLOR = '#deb96a';
const MEMBER_COLORS = ['#7a9e72', '#5e7b8f', '#c47c7c', '#8b5cf6', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899'];
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const schedulePanelClass = 'glass-panel-premium rounded-[1.5rem] border border-white/10 shadow-[0_18px_42px_rgba(3,7,11,0.2)]';
const scheduleSoftPanelClass = 'guide-shell rounded-[1.1rem] border border-white/10 bg-white/[0.03]';
const scheduleChipClass = 'rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.14em]';

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

function getMemberSourceId(memberId) {
    return `member:${memberId}`;
}

function getCalendarVisibleRange(anchorDate, view) {
    if (view === 'month') return getVisibleMonthRange(anchorDate);

    const start = startOfDay(anchorDate);
    if (view === 'week') {
        start.setDate(start.getDate() - start.getDay());
        const end = startOfDay(start);
        end.setDate(start.getDate() + 6);
        return { start, end };
    }

    return { start, end: startOfDay(anchorDate) };
}

function getPreservedDayForMonth(selectedDate, targetMonth) {
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();
    const maxDay = new Date(year, month + 1, 0).getDate();
    return startOfDay(new Date(year, month, Math.min(selectedDate.getDate(), maxDay)));
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

function AvatarStack({ attendees = [], count = 0, dense = false }) {
    const displayCount = count || attendees.length;

    if (!displayCount) {
        return (
            <div className={`inline-flex items-center rounded-full border border-white/10 bg-white/5 font-mono font-semibold uppercase tracking-[0.14em] text-claude-secondary ${dense ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-1 text-[10px]'}`}>
                Nobody yet
            </div>
        );
    }

    return (
        <div className={`flex items-center ${dense ? 'gap-1.5' : 'gap-2'}`}>
            <div className="flex -space-x-2">
                {attendees.slice(0, 4).map((attendee) => (
                    <img
                        key={attendee.id}
                        src={attendee.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${attendee.username || attendee.id}`}
                        alt=""
                        loading="lazy"
                        className={`rounded-full border border-[rgba(24,42,49,0.92)] bg-white/90 p-0.5 ${dense ? 'h-6 w-6' : 'h-7 w-7'}`}
                    />
                ))}
            </div>
            <span className={`font-medium text-claude-secondary ${dense ? 'text-[10px]' : 'text-[11px]'}`}>
                {displayCount}
            </span>
        </div>
    );
}

function ShareModeControl({ currentMode, onChange, busy }) {
    return (
        <div className="grid grid-cols-3 gap-1.5">
            {SHARE_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = (currentMode || 'hidden') === mode.value;

                return (
                    <button
                        key={mode.value}
                        type="button"
                        onClick={() => onChange(mode.value)}
                        disabled={busy}
                        className={`relative overflow-hidden rounded-[1rem] border px-2.5 py-2 text-left transition-all ${
                            isActive
                                ? 'border-claude-accent/38 bg-[linear-gradient(150deg,rgba(222,185,106,0.18),rgba(40,29,10,0.5))] text-claude-text shadow-[0_18px_34px_rgba(28,20,7,0.2)]'
                                : 'border-white/10 bg-[linear-gradient(155deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] text-claude-secondary hover:border-white/20 hover:text-claude-text'
                        } disabled:opacity-50`}
                    >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(222,185,106,0.09),transparent_55%)]" />
                        <div className="flex items-center gap-2">
                            <Icon className="h-3 w-3" />
                            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.12em]">
                                {mode.label}
                            </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[9px] font-medium leading-4 text-inherit/75">
                            {mode.description}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}

function ScheduleBlockCard({ item, dense = false }) {
    return (
        <div className={`guide-shell rounded-[1.3rem] border border-[#7d9a86]/25 bg-[linear-gradient(135deg,rgba(93,132,112,0.24),rgba(23,47,40,0.76))] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ${dense ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={`font-semibold text-claude-text ${dense ? 'text-[12px]' : 'text-[13px]'}`}>
                        {item.title}
                    </p>
                    <p className={`mt-0.5 font-medium leading-4 text-[#d9e8dd]/75 ${dense ? 'text-[10px]' : 'text-[11px]'}`}>
                        {item.subtitle}
                    </p>
                </div>
                <div className={`${scheduleChipClass} px-2 py-0.5 text-[#d9e8dd]/80 ${dense ? 'text-[7px]' : 'text-[8px]'}`}>
                    {formatTimeLabel(item.startAt.toTimeString().slice(0, 5))}
                </div>
            </div>
            <p className={`mt-2 font-medium text-[#d9e8dd]/80 ${dense ? 'text-[10px]' : 'text-[11px]'}`}>
                {formatTimeLabel(item.startAt.toTimeString().slice(0, 5))} - {formatTimeLabel(item.endAt.toTimeString().slice(0, 5))}
            </p>
        </div>
    );
}

function MeetupCard({ meetup, isAdmin, onJoin, onLeave, onCancel, dense = false }) {
    const stateLabel = getMeetupStateLabel(meetup);
    const canCancel = !isMeetupCancelled(meetup) && (Boolean(meetup?.is_creator) || isAdmin);
    const locationHref = meetup.location_url || null;
    const locationLabel = meetup.location_label || (locationHref ? 'Shared link available' : '');

    return (
        <div className={`glass-panel-premium rounded-[1.35rem] border border-claude-accent/28 bg-[linear-gradient(145deg,rgba(222,185,106,0.16),rgba(43,30,12,0.74))] shadow-[0_24px_44px_rgba(17,10,2,0.24)] ${dense ? 'px-3 py-3' : 'px-3.5 py-3.5'}`}>
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
                    <h3 className={`line-clamp-2 font-semibold leading-5 text-claude-text ${dense ? 'mt-2 text-[14px]' : 'mt-2.5 text-[15px]'}`}>
                        {meetup.topic}
                    </h3>
                    <div className={`text-sm text-claude-secondary ${dense ? 'mt-2 space-y-1' : 'mt-2.5 space-y-1.5'}`}>
                        <div className="flex items-start gap-2">
                            <Clock3 className={`mt-0.5 shrink-0 text-claude-accent ${dense ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                            <div className="min-w-0">
                                <div>{formatMeetupRange(meetup.start_at, meetup.end_at)}</div>
                                <div className={`mt-0.5 text-claude-secondary/80 ${dense ? 'text-[10px]' : 'text-[11px]'}`}>
                                    {getLocalTimezoneLabel(meetup.start_at)}
                                </div>
                            </div>
                        </div>
                        {locationLabel && (
                            <div className="flex items-center gap-2">
                                {meetup.location_label ? (
                                    <MapPin className={`shrink-0 text-claude-accent ${dense ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                                ) : (
                                    <Link2 className={`shrink-0 text-claude-accent ${dense ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
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
                <AvatarStack attendees={meetup.attendees || []} count={meetup.attendee_count || 0} dense={dense} />
            </div>

            <div className={`flex flex-wrap items-center gap-2 ${dense ? 'mt-2' : 'mt-3'}`}>
                {isMeetupCancelled(meetup) ? (
                    <div className={`rounded-full border border-white/10 bg-white/[0.05] font-medium text-claude-secondary ${dense ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'}`}>
                        This session has been cancelled.
                    </div>
                ) : meetup.is_joined ? (
                    <button
                        type="button"
                        onClick={() => onLeave(meetup)}
                        className={`rounded-full border border-white/10 bg-white/[0.06] font-semibold text-claude-text transition-colors hover:border-white/20 hover:bg-white/[0.1] ${dense ? 'px-3 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'}`}
                    >
                        Leave
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onJoin(meetup)}
                        className={`rounded-full border border-claude-accent/30 bg-claude-accent font-semibold text-[#182a31] shadow-[0_12px_26px_rgba(41,28,7,0.2)] transition-transform hover:-translate-y-0.5 ${dense ? 'px-3 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'}`}
                    >
                        Join
                    </button>
                )}

                {canCancel && (
                    <button
                        type="button"
                        onClick={() => onCancel(meetup)}
                        className={`rounded-full border border-red-400/22 bg-red-500/12 font-semibold text-red-200 transition-colors hover:bg-red-500/18 ${dense ? 'px-3 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'}`}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}

// Day detail panel
function DayDetailSurface({
    selectedDate,
    agendaItems,
    suggestions,
    suggestionMode,
    renderAgendaItem,
    onToday,
    onPropose,
    onSuggestionSelect,
    density = 'comfortable',
    fitMode = 'default',
    className = '',
}) {
    const hasAgenda = agendaItems.length > 0;
    const denseDensity = density === 'dense';
    const fitWeekdayView = fitMode === 'group-weekday';
    const suggestionCopy = suggestionMode === 'fallback'
        ? 'Best nearby openings this month.'
        : 'Best overlap windows for this day.';

    return (
        <section
            data-testid="group-schedule-day-surface"
            data-density={denseDensity ? 'dense' : 'comfortable'}
            data-fit-mode={fitMode}
            className={`${schedulePanelClass} bg-[linear-gradient(160deg,rgba(20,26,38,0.94),rgba(10,14,23,0.92))] ${fitWeekdayView ? 'p-2 md:p-2' : denseDensity ? 'p-2 md:p-2.5' : 'p-2.5 md:p-3'} ${className}`.trim()}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <h3 className={`font-display font-bold italic leading-tight tracking-tight text-claude-text ${denseDensity ? 'text-[1rem] md:text-[1.1rem]' : 'text-[1.1rem] md:text-[1.25rem]'}`}>
                    {formatDateLabel(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>

                <div className={`flex shrink-0 items-center ${denseDensity ? 'gap-1.5' : 'gap-2'}`}>
                    <button
                        type="button"
                        onClick={onToday}
                        className={`rounded-full border border-emerald-400/20 bg-emerald-400/14 font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/22 ${denseDensity ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={onPropose}
                        className={`inline-flex items-center gap-1 rounded-[0.9rem] border border-claude-accent/30 bg-claude-accent/16 font-semibold text-claude-text transition-colors hover:bg-claude-accent/22 ${denseDensity ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
                    >
                        <CalendarPlus2 className={`${denseDensity ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-claude-accent`} />
                        <span className="hidden sm:inline">Propose</span>
                    </button>
                </div>
            </div>

            {/* Best Times panel */}
            <div className={`mt-2 ${scheduleSoftPanelClass} ${fitWeekdayView ? 'p-1.5' : denseDensity ? 'p-2' : 'p-2.5'}`}>
                <div className="flex items-center gap-2">
                    <Sparkles className={`${denseDensity ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-claude-accent`} />
                    <span className={`font-mono font-bold uppercase tracking-[0.14em] text-claude-accent ${denseDensity ? 'text-[8px]' : 'text-[9px]'}`}>
                        Best Times
                    </span>
                </div>

                {suggestions.length > 0 ? (
                    <>
                        <p className={`mt-1 text-claude-secondary ${denseDensity ? 'text-[10px] leading-4' : 'text-[11px] leading-4'}`}>
                            {suggestionCopy}
                        </p>
                        <div className={`mt-1.5 flex flex-wrap ${denseDensity ? 'gap-0.5' : 'gap-1'}`}>
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion.key}
                                    type="button"
                                    onClick={() => onSuggestionSelect(suggestion)}
                                    className={`rounded-full border border-claude-accent/20 bg-claude-accent/10 font-medium text-claude-text transition-colors hover:bg-claude-accent/16 ${denseDensity ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
                                >
                                    {formatSuggestionLabel(suggestion)}
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className={`mt-1 text-claude-secondary ${denseDensity ? 'text-[10px] leading-4' : 'text-[11px] leading-4'}`}>
                        Share your schedule to unlock overlap suggestions.
                    </p>
                )}
            </div>

            {/* Agenda */}
            <div className={fitWeekdayView ? 'mt-1.5' : denseDensity ? 'mt-2' : 'mt-2.5'}>
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
                                className={fitWeekdayView ? 'mb-1.5 last:mb-0' : denseDensity ? 'mb-2 last:mb-0' : 'mb-2.5 last:mb-0'}
                            >
                                {renderAgendaItem(item)}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                ) : (
                    <div className={`flex flex-col items-center text-center ${fitWeekdayView ? 'gap-1 py-2.5' : denseDensity ? 'gap-1.5 py-3' : 'gap-2 py-4'}`}>
                        <div className={`flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] ${fitWeekdayView ? 'h-6 w-6' : denseDensity ? 'h-7 w-7' : 'h-8 w-8'}`}>
                            <CalendarDays className={`${fitWeekdayView ? 'h-2.5 w-2.5' : denseDensity ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-claude-secondary`} />
                        </div>
                        <div>
                                <p className={`font-display font-bold italic tracking-tight text-claude-text ${fitWeekdayView ? 'text-[0.9rem]' : denseDensity ? 'text-[0.95rem]' : 'text-[1rem]'}`}>Nothing scheduled</p>
                                <p className={`mt-0.5 text-claude-secondary ${fitWeekdayView ? 'text-[9px] leading-4' : denseDensity ? 'text-[10px] leading-4' : 'text-[11px] leading-4'}`}>
                                    Propose a session to get things going.
                                </p>
                        </div>
                        <button
                            type="button"
                            onClick={onPropose}
                            className={`inline-flex items-center gap-1 rounded-full border border-claude-accent/30 bg-claude-accent/16 font-semibold text-claude-text transition-colors hover:bg-claude-accent/22 ${fitWeekdayView ? 'px-2 py-0.5 text-[9px]' : denseDensity ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
                        >
                            <CalendarPlus2 className={`${fitWeekdayView ? 'h-2.5 w-2.5' : denseDensity ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-claude-accent`} />
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
    const [view, setView] = useState('month');
    const [activeFilters, setActiveFilters] = useState([]);
    const [contentMode, setContentMode] = useState('both');
    const [shareBusy, setShareBusy] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerStep, setComposerStep] = useState(1);
    const [composer, setComposer] = useState(() => createComposerState(new Date()));
    const [submitting, setSubmitting] = useState(false);
    const [composerError, setComposerError] = useState('');
    const dialogRef = useRef(null);
    const restoreFocusRef = useRef(null);
    const titleIdRef = useRef(`group-meetup-composer-title-${Math.random().toString(36).slice(2, 9)}`);
    const scheduleDensity = view === 'month' ? 'compact' : 'dense';
    const denseDensity = scheduleDensity === 'dense';
    const timelineFitMode = view === 'month' ? 'default' : 'group-weekday';

    const members = calendarData?.members ?? EMPTY_ARRAY;
    const scheduleSlots = calendarData?.schedule_slots ?? EMPTY_ARRAY;
    const meetups = calendarData?.meetups ?? EMPTY_ARRAY;
    const myShareMode = calendarData?.my_share_mode || null;
    const visibleRange = useMemo(() => getCalendarVisibleRange(anchorDate, view), [anchorDate, view]);

    const calendarSources = useMemo(() => {
        const memberSources = members
            .filter((member) => member.share_mode !== 'hidden')
            .map((member, index) => ({
                id: getMemberSourceId(member.id),
                name: formatMemberName(member),
                color: MEMBER_COLORS[index % MEMBER_COLORS.length],
                room: member.share_mode === 'full' ? 'Full schedule' : 'Busy/free',
            }));

        return [
            {
                id: MEETUP_SOURCE_ID,
                name: 'Study Sessions',
                color: MEETUP_COLOR,
                room: 'Group meetup',
            },
            ...memberSources,
        ];
    }, [members]);

    const groupScheduleSlots = useMemo(() => {
        const visibleMemberSourceIds = new Set(calendarSources.map((source) => source.id));

        return scheduleSlots
            .filter((slot) => slot.class_is_archived !== true)
            .map((slot) => ({
                ...slot,
                class_id: getMemberSourceId(slot.user_id),
            }))
            .filter((slot) => visibleMemberSourceIds.has(slot.class_id));
    }, [calendarSources, scheduleSlots]);

    const groupMeetupAssignments = useMemo(() => meetups.map((meetup) => ({
        id: meetup.id,
        title: meetup.topic,
        due_date: meetup.start_at,
        end_date: meetup.end_at,
        class_id: MEETUP_SOURCE_ID,
        assignment_type: meetup.status === 'cancelled' ? 'cancelled' : 'study session',
        calendar_kind: 'meetup',
    })), [meetups]);

    const selectedDaySummary = useMemo(() => {
        const showSessions = contentMode === 'assignments' || contentMode === 'both';
        const showAvailability = contentMode === 'classes' || contentMode === 'both';
        const filteredMeetups = showSessions
            ? meetups.filter(() => activeFilters.length === 0 || activeFilters.includes(MEETUP_SOURCE_ID))
            : EMPTY_ARRAY;
        const filteredSlots = showAvailability
            ? groupScheduleSlots.filter((slot) => activeFilters.length === 0 || activeFilters.includes(slot.class_id))
            : EMPTY_ARRAY;

        return summarizeDay(selectedDate, filteredSlots, filteredMeetups);
    }, [activeFilters, contentMode, groupScheduleSlots, meetups, selectedDate]);

    const agendaItems = selectedDaySummary.agendaItems;
    const bestTimes = useMemo(
        () => calculateBestTimes({
            rangeStart: visibleRange.start,
            rangeEnd: visibleRange.end,
            members,
            meetups,
            scheduleSlots: groupScheduleSlots,
            limit: 6,
        }),
        [groupScheduleSlots, members, meetups, visibleRange.end, visibleRange.start],
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

    const handleFilterToggle = (id) => {
        if (id === 'all') {
            setActiveFilters([]);
            return;
        }

        setActiveFilters((current) => (
            current.includes(id)
                ? current.filter((filterId) => filterId !== id)
                : [...current, id]
        ));
    };

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

    const handleViewChange = (nextView) => {
        setView(nextView);
        if (nextView === 'week' || nextView === 'day') {
            setAnchorDate(selectedDate ? startOfDay(selectedDate) : startOfDay(new Date()));
        }
    };

    const handleNavigate = (direction) => {
        setAnchorDate((current) => {
            const next = startOfDay(current);
            if (view === 'month') {
                next.setMonth(current.getMonth() + direction, 1);
                setSelectedDate((currentSelected) => getPreservedDayForMonth(currentSelected, next));
            } else if (view === 'week') {
                next.setDate(current.getDate() + (direction * 7));
            } else {
                next.setDate(current.getDate() + direction);
            }
            return next;
        });
    };

    const handleDaySelect = (date) => {
        const nextDate = startOfDay(date);
        setSelectedDate(nextDate);
        setAnchorDate(nextDate);
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
            return <ScheduleBlockCard key={item.id} item={item} dense={denseDensity} />;
        }

        return (
            <MeetupCard
                key={item.id}
                meetup={item.meetup}
                isAdmin={isAdmin}
                onJoin={onJoinMeetup}
                onLeave={onLeaveMeetup}
                onCancel={onCancelMeetup}
                dense={denseDensity}
            />
        );
    };

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
                <div className="h-20 rounded-[1.9rem] border border-white/10 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] animate-pulse" />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_360px]">
                    <div className="h-[400px] rounded-[2rem] border border-white/10 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] animate-pulse" />
                    <div className="h-[400px] rounded-[2rem] border border-white/10 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div data-testid="group-schedule-hub" className="space-y-3">
            {/* Shared Availability — text-reduced header */}
            <section className={`${schedulePanelClass} p-2.5 md:p-3`}>
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <UsersRound className="h-3 w-3 text-claude-accent" />
                            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-claude-accent">
                                Shared Availability
                            </span>
                        </div>
                        <h2 className="mt-1 font-display text-[1.15rem] font-bold italic leading-tight tracking-tight text-claude-text md:text-[1.35rem]">
                            Keep your schedule visible to {group?.name || 'this group'} on your terms.
                        </h2>
                    </div>

                    <div className="w-full max-w-[22rem]">
                        <ShareModeControl currentMode={myShareMode} onChange={handleShareChange} busy={shareBusy} />
                    </div>
                </div>
            </section>

            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.55fr)_320px] xl:grid-cols-[minmax(0,1.7fr)_340px]">
                {/* Calendar section */}
                <section className={`${schedulePanelClass} bg-[radial-gradient(circle_at_top,rgba(31,41,60,0.20),rgba(9,13,21,0.94)_62%)] p-2.5 md:p-3`}>
                    <CalendarHeader
                        anchorDate={anchorDate}
                        onPrev={() => handleNavigate(-1)}
                        onNext={() => handleNavigate(1)}
                        onToday={handleSelectToday}
                        view={view}
                        onViewChange={handleViewChange}
                        contentMode={contentMode}
                        onContentModeChange={setContentMode}
                        contentOptions={[
                            { value: 'assignments', label: 'Sessions' },
                            { value: 'classes', label: 'Availability' },
                            { value: 'both', label: 'Both' },
                        ]}
                        classes={calendarSources}
                        activeFilters={activeFilters}
                        onFilterToggle={handleFilterToggle}
                        eyebrow="Group calendar"
                        density={scheduleDensity}
                    />

                    {view === 'month' && (
                        <CalendarGrid
                            anchorDate={anchorDate}
                            assignments={groupMeetupAssignments}
                            scheduleSlots={groupScheduleSlots}
                            classes={calendarSources}
                            activeFilters={activeFilters}
                            contentMode={contentMode}
                            selectedDay={selectedDate}
                            onDaySelect={handleDaySelect}
                            density={scheduleDensity}
                        />
                    )}

                    {(view === 'week' || view === 'day') && (
                        <CalendarTimeline
                            anchorDate={anchorDate}
                            view={view}
                            assignments={groupMeetupAssignments}
                            scheduleSlots={groupScheduleSlots}
                            classes={calendarSources}
                            activeFilters={activeFilters}
                            contentMode={contentMode}
                            onDaySelect={handleDaySelect}
                            density={scheduleDensity}
                            fitMode={timelineFitMode}
                        />
                    )}
                </section>

                {/* Day detail — inline below calendar on mobile, sidebar on desktop */}
                <DayDetailSurface
                    {...dayDetailProps}
                    density={scheduleDensity}
                    fitMode={timelineFitMode}
                    className="lg:sticky lg:top-24"
                />
            </div>

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
                            className="relative w-full max-w-lg rounded-t-[2.2rem] border border-white/10 bg-[linear-gradient(165deg,rgba(30,56,64,0.95),rgba(12,20,28,0.95))] p-6 shadow-[0_40px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl md:rounded-[2rem] md:p-7"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                        Propose Session
                                    </p>
                                    <h3 id={titleIdRef.current} className="mt-2 font-display text-[2rem] font-bold italic tracking-tight text-claude-text">
                                        {composerStep === 1 ? 'Pick the time' : 'Add the details'}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeComposer}
                                    disabled={submitting}
                                    className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-claude-text transition-colors hover:bg-white/[0.1]"
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
                                            className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
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
                                                            : 'border-white/10 bg-white/[0.05] text-claude-secondary'
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
                                            className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
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
                                            className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
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
                                            className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
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
                                        className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-claude-text"
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
