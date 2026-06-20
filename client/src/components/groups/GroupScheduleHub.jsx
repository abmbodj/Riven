import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    CalendarPlus2,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Sparkles,
} from 'lucide-react';
import {
    addMonths,
    buildAvailabilityHeatmap,
    formatDateLabel,
    formatMemberName,
    getRollingWeekDays,
    getVisibleMonthRange,
    isSameLocalMonth,
    resolveAvailabilityWindow,
    startOfDay,
    startOfWeek,
} from '../../utils/calendarDates';
import WeekAvailabilityHeatmap from './schedule/WeekAvailabilityHeatmap.jsx';
import UpcomingSessions from './schedule/UpcomingSessions.jsx';
import MonthOverview from './schedule/MonthOverview.jsx';
import ProposeSessionSheet from './schedule/ProposeSessionSheet.jsx';
import SessionDetailSheet from './schedule/SessionDetailSheet.jsx';

const EMPTY_ARRAY = [];
const schedulePanelClass = 'glass-panel-premium rounded-[1.5rem] border border-white/10 shadow-[0_18px_42px_rgba(3,7,11,0.2)]';

function cellKey(dayOfWeek, hour) {
    return `${dayOfWeek}-${hour}`;
}

function SegmentToggle({ options, value, onChange }) {
    return (
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-0.5">
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                            isActive ? 'bg-claude-accent text-[#182a31]' : 'text-claude-secondary hover:text-claude-text'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export default function GroupScheduleHub({
    calendarData,
    loading,
    revalidating = false,
    isAdmin,
    composerRequestKey = 0,
    onRangeChange,
    onSetShareMode,
    onSaveAvailability,
    onCreateMeetup,
    onJoinMeetup,
    onLeaveMeetup,
    onCancelMeetup,
}) {
    const [view, setView] = useState('week');
    const [mode, setMode] = useState('group');
    const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
    const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
    const [draftCells, setDraftCells] = useState(() => new Set());
    const [highlightedMeetupId, setHighlightedMeetupId] = useState(null);
    const [proposeOpen, setProposeOpen] = useState(false);
    const [proposeContext, setProposeContext] = useState({ start: null, freeNames: [], denominator: 0 });
    const [proposeKey, setProposeKey] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [selectedMeetup, setSelectedMeetup] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailKey, setDetailKey] = useState(0);
    const [nowMs] = useState(() => Date.now());

    const members = calendarData?.members ?? EMPTY_ARRAY;
    const scheduleSlots = calendarData?.schedule_slots ?? EMPTY_ARRAY;
    const availability = calendarData?.availability ?? EMPTY_ARRAY;
    const myAvailability = calendarData?.my_availability ?? EMPTY_ARRAY;
    const myScheduleSlots = calendarData?.my_schedule_slots ?? EMPTY_ARRAY;
    const meetups = calendarData?.meetups ?? EMPTY_ARRAY;
    const myShareMode = calendarData?.my_share_mode || null;
    const isShared = myShareMode && myShareMode !== 'hidden';
    const visibleScheduleSlots = useMemo(
        () => scheduleSlots.filter((slot) => slot?.class_is_archived !== true),
        [scheduleSlots],
    );
    const visibleMyScheduleSlots = useMemo(
        () => myScheduleSlots.filter((slot) => slot?.class_is_archived !== true),
        [myScheduleSlots],
    );

    const weekDays = useMemo(() => getRollingWeekDays(startOfWeek(anchorDate)), [anchorDate]);
    const { startHour, endHour } = useMemo(
        () => resolveAvailabilityWindow(availability, visibleScheduleSlots),
        [availability, visibleScheduleSlots],
    );
    const heatmap = useMemo(
        () => buildAvailabilityHeatmap({
            weekDays,
            startHour,
            endHour,
            members,
            availability,
            scheduleSlots: visibleScheduleSlots,
            meetups,
        }),
        [weekDays, startHour, endHour, members, availability, visibleScheduleSlots, meetups],
    );

    const memberNameById = useMemo(() => {
        const map = new Map();
        members.forEach((member) => map.set(String(member.id), formatMemberName(member)));
        return map;
    }, [members]);
    const memberById = useMemo(() => {
        const map = new Map();
        members.forEach((member) => map.set(String(member.id), member));
        return map;
    }, [members]);

    const myAvailabilitySet = useMemo(
        () => new Set(myAvailability.map((cell) => cellKey(Number(cell.day_of_week), Number(cell.hour)))),
        [myAvailability],
    );

    // Fetch at month granularity so week + month share one payload.
    const fetchRange = useMemo(() => getVisibleMonthRange(anchorDate), [anchorDate]);
    const visibleSessionRange = useMemo(() => (
        view === 'month'
            ? fetchRange
            : { start: weekDays[0], end: weekDays[6] }
    ), [fetchRange, view, weekDays]);
    useEffect(() => {
        onRangeChange?.(fetchRange.start, fetchRange.end);
    }, [onRangeChange, fetchRange.start, fetchRange.end]);

    // External "+" trigger from the page header.
    useEffect(() => {
        if (!composerRequestKey) return;
        openPropose(startOfDay(selectedDate || new Date()), 18);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [composerRequestKey]);

    const enterEditMode = () => {
        setDraftCells(new Set(myAvailabilitySet));
        setMode('edit');
    };

    const exitEditMode = () => setMode('group');

    const handleToggleCell = (dayOfWeek, hour) => {
        setDraftCells((current) => {
            const next = new Set(current);
            const key = cellKey(dayOfWeek, hour);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const handleSaveAvailability = () => {
        const cells = [...draftCells].map((key) => {
            const [dayOfWeek, hour] = key.split('-').map(Number);
            return { day_of_week: dayOfWeek, hour };
        });
        // Optimistic + instant: the hook updates state synchronously (including
        // flipping my share_mode when painting implies participation), so switch
        // to the group view immediately instead of blocking on the round-trip.
        // On failure the hook rolls back and we drop back into edit mode with the
        // draft intact.
        setMode('group');
        Promise.resolve(onSaveAvailability?.(cells)).catch(() => {
            setMode('edit');
        });
    };

    const openPropose = (start, hour = null) => {
        const startDate = new Date(start);
        if (hour !== null) startDate.setHours(hour, 0, 0, 0);

        let freeNames = [];
        let denominator = heatmap.denominator;
        if (hour !== null) {
            const dayIndex = weekDays.findIndex((day) => startOfDay(day).getTime() === startOfDay(startDate).getTime());
            const cell = dayIndex >= 0 ? heatmap.cells.get(`${dayIndex}-${hour}`) : null;
            if (cell) {
                freeNames = cell.freeMemberIds.map((id) => memberNameById.get(String(id))).filter(Boolean);
            }
        }

        setProposeContext({ start: startDate, freeNames, denominator });
        setProposeKey((key) => key + 1);
        setProposeOpen(true);
    };

    const handleProposeCell = (date, hour, cell) => {
        const freeNames = (cell?.freeMemberIds || []).map((id) => memberNameById.get(String(id))).filter(Boolean);
        const startDate = new Date(date);
        startDate.setHours(hour, 0, 0, 0);
        setProposeContext({ start: startDate, freeNames, denominator: heatmap.denominator });
        setProposeKey((key) => key + 1);
        setProposeOpen(true);
    };

    const handleProposeSubmit = async (payload) => {
        setSubmitting(true);
        try {
            await onCreateMeetup?.(payload);
            setProposeOpen(false);
            setAnchorDate(startOfWeek(new Date(payload.start_at)));
        } catch {
            // Toast handled upstream; keep the sheet open.
        } finally {
            setSubmitting(false);
        }
    };

    const handleSelectMeetup = (meetup) => {
        setHighlightedMeetupId(meetup.id);
        setView('week');
        setMode('group');
        setAnchorDate(startOfWeek(new Date(meetup.start_at)));
        setSelectedMeetup(meetup);
        setDetailKey((k) => k + 1);
        setDetailOpen(true);
    };

    const handleNavigate = (direction) => {
        if (view === 'month') {
            setAnchorDate((current) => addMonths(current, direction));
        } else {
            setAnchorDate((current) => {
                const next = startOfDay(current);
                next.setDate(next.getDate() + direction * 7);
                return next;
            });
        }
    };

    const handleToday = () => {
        const today = startOfDay(new Date());
        setAnchorDate(today);
        setSelectedDate(today);
    };

    const periodLabel = view === 'month'
        ? formatDateLabel(anchorDate, { month: 'long', year: 'numeric' })
        : `${formatDateLabel(weekDays[0], { month: 'short', day: 'numeric' })} – ${formatDateLabel(weekDays[6], isSameLocalMonth(weekDays[0], weekDays[6]) ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;

    // Once the current user has shared or painted their own availability, keep the
    // group view sticky — a slow or racing refetch must never bounce the UI back
    // to the "Find a time to meet" first-run empty state.
    const hasMyData = isShared || myAvailability.length > 0;
    const showFirstRun = mode === 'group'
        && view === 'week'
        && heatmap.denominator === 0
        && meetups.filter((meetup) => meetup.status !== 'cancelled').length === 0
        && !hasMyData;

    if (loading) {
        return (
            <div data-testid="group-schedule-hub" className="space-y-4 md:flex md:h-full md:min-h-0 md:w-full md:flex-col md:space-y-0 md:gap-3">
                <div className="h-16 shrink-0 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]" />
                <div className="grid gap-3 md:min-h-0 md:flex-1 lg:grid-cols-[minmax(0,1.6fr)_340px]">
                    <div className="h-[420px] animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04] md:h-full md:min-h-0" />
                    <div className="h-[420px] animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04] md:h-full md:min-h-0" />
                </div>
            </div>
        );
    }

    return (
        <div data-testid="group-schedule-hub" className="mx-auto max-w-4xl space-y-3 md:flex md:h-full md:min-h-0 md:w-full md:flex-col md:space-y-0 md:gap-3">
            {/* Controls */}
            <section className={`${schedulePanelClass} p-2.5 md:shrink-0 md:p-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleNavigate(-1)}
                            className="rounded-full border border-white/10 bg-white/[0.04] p-1.5 text-claude-text transition-colors hover:bg-white/[0.08]"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleToday}
                            className="rounded-full border border-emerald-400/20 bg-emerald-400/14 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/22"
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => handleNavigate(1)}
                            className="rounded-full border border-white/10 bg-white/[0.04] p-1.5 text-claude-text transition-colors hover:bg-white/[0.08]"
                            aria-label="Next"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <span className="ml-1 font-display text-[1.05rem] font-bold italic tracking-tight text-claude-text">
                            {periodLabel}
                        </span>
                        {revalidating && (
                            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-claude-accent/60 animate-pulse" aria-label="Loading" />
                        )}
                    </div>

                    <SegmentToggle
                        options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
                        value={view}
                        onChange={setView}
                    />
                </div>

                {view === 'week' && (
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                        <SegmentToggle
                            options={[{ value: 'group', label: 'Group' }, { value: 'edit', label: 'My availability' }]}
                            value={mode}
                            onChange={(next) => (next === 'edit' ? enterEditMode() : exitEditMode())}
                        />
                        {mode === 'group' ? (
                            <div className="flex items-center gap-3 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-claude-secondary">
                                <span className="flex items-center gap-1">
                                    <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[rgba(122,158,114,0.7)]" />
                                    More free
                                </span>
                                {heatmap.maxFree >= 2 && (
                                    <span className="flex items-center gap-1" style={{ color: '#7dd3c0' }}>
                                        <span>★</span>
                                        Best time
                                    </span>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onSetShareMode?.(isShared ? 'hidden' : 'busy_free')}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                    isShared
                                        ? 'border-emerald-400/25 bg-emerald-400/12 text-emerald-100'
                                        : 'border-white/10 bg-white/[0.04] text-claude-secondary'
                                }`}
                            >
                                {isShared ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                {isShared ? 'Visible to group' : 'Hidden'}
                            </button>
                        )}
                    </div>
                )}
            </section>

            <div data-testid="group-schedule-main-grid" className="grid gap-3 md:min-h-0 md:flex-1 md:overflow-hidden lg:grid-cols-[minmax(0,1.6fr)_340px]">
                {/* Calendar surface */}
                <section data-testid="group-schedule-calendar-surface" className={`${schedulePanelClass} bg-[radial-gradient(circle_at_top,rgba(31,41,60,0.20),rgba(9,13,21,0.94)_62%)] p-2.5 md:flex md:min-h-0 md:flex-col md:overflow-hidden md:p-3`}>
                    <AnimatePresence mode="wait" initial={false}>
                        {view === 'month' ? (
                            <motion.div key="month" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="md:h-full md:min-h-0">
                                <MonthOverview
                                    anchorDate={anchorDate}
                                    meetups={meetups}
                                    selectedDate={selectedDate}
                                    onDaySelect={(date) => {
                                        setSelectedDate(startOfDay(date));
                                        setAnchorDate(startOfDay(date));
                                    }}
                                />
                            </motion.div>
                        ) : showFirstRun ? (
                            <motion.div
                                key="first-run"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                className="flex flex-col items-center gap-3 px-4 py-12 text-center md:h-full md:justify-center md:py-6"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-claude-accent/30 bg-claude-accent/12">
                                    <Sparkles className="h-5 w-5 text-claude-accent" />
                                </div>
                                <div>
                                    <h3 className="font-display text-[1.3rem] font-bold italic tracking-tight text-claude-text">
                                        Find a time to meet
                                    </h3>
                                    <p className="mx-auto mt-1 max-w-xs text-[12px] leading-5 text-claude-secondary">
                                        Add your availability so the group can see when everyone&apos;s free — the more people share, the easier it is to plan.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={enterEditMode}
                                        className="rounded-full bg-claude-accent px-5 py-2.5 text-[12px] font-semibold text-[#182a31]"
                                    >
                                        Set my availability
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openPropose(startOfDay(new Date()), 18)}
                                        className="text-[11px] font-semibold text-claude-secondary underline-offset-4 hover:text-claude-text hover:underline"
                                    >
                                        or propose a time
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key={`week-${mode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="md:flex md:h-full md:min-h-0 md:flex-col">
                                {mode === 'edit' && (
                                    <div className="mb-2.5 flex items-center justify-between gap-2 rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-2 md:shrink-0">
                                        <p className="text-[11px] leading-4 text-claude-secondary">
                                            Tap the hours you&apos;re usually free. Class times are locked.
                                        </p>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={exitEditMode}
                                                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-claude-text"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveAvailability}
                                                className="rounded-full bg-claude-accent px-3 py-1 text-[11px] font-semibold text-[#182a31]"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <WeekAvailabilityHeatmap
                                    mode={mode}
                                    weekDays={weekDays}
                                    startHour={startHour}
                                    endHour={endHour}
                                    heatmap={heatmap}
                                    memberById={memberById}
                                    myCells={draftCells}
                                    myClassSlots={visibleMyScheduleSlots}
                                    highlightedMeetupId={highlightedMeetupId}
                                    nowMs={nowMs}
                                    onProposeCell={mode === 'group' ? handleProposeCell : undefined}
                                    onToggleCell={handleToggleCell}
                                    onMeetupSelect={handleSelectMeetup}
                                />

                                {mode === 'group' && heatmap.denominator > 0 && (
                                    <p className="mt-2 text-center text-[10px] text-claude-secondary">
                                        Tap any open slot to propose a session · {heatmap.denominator} member{heatmap.denominator === 1 ? '' : 's'} sharing
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* Sessions rail */}
                <section data-testid="group-schedule-sessions-rail" className={`${schedulePanelClass} bg-[linear-gradient(160deg,rgba(20,26,38,0.94),rgba(10,14,23,0.92))] p-2.5 md:flex md:min-h-0 md:flex-col md:overflow-hidden md:p-3`}>
                    <UpcomingSessions
                        meetups={meetups}
                        rangeStart={visibleSessionRange.start}
                        rangeEnd={visibleSessionRange.end}
                        view={view}
                        nowMs={nowMs}
                        isAdmin={isAdmin}
                        onJoin={onJoinMeetup}
                        onLeave={onLeaveMeetup}
                        onCancel={onCancelMeetup}
                        onSelectMeetup={handleSelectMeetup}
                        onPropose={() => openPropose(startOfDay(selectedDate || new Date()), 18)}
                    />
                </section>
            </div>

            <ProposeSessionSheet
                key={proposeKey}
                open={proposeOpen}
                initialStart={proposeContext.start}
                rosterFreeNames={proposeContext.freeNames}
                rosterDenominator={proposeContext.denominator}
                submitting={submitting}
                onClose={() => (submitting ? undefined : setProposeOpen(false))}
                onSubmit={handleProposeSubmit}
            />

            <SessionDetailSheet
                key={detailKey}
                open={detailOpen}
                meetup={selectedMeetup}
                nowMs={nowMs}
                isAdmin={isAdmin}
                onClose={() => setDetailOpen(false)}
                onJoin={() => onJoinMeetup?.(selectedMeetup?.id)}
                onLeave={() => onLeaveMeetup?.(selectedMeetup?.id)}
                onCancel={(id) => { onCancelMeetup?.(id); setDetailOpen(false); }}
            />
        </div>
    );
}
