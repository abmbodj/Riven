import React, { useMemo } from 'react';
import {
    formatDateLabel,
    getMonthGridDays,
    isSameLocalDay,
    isSameLocalMonth,
    summarizeDay,
    toDateKey,
} from './groupScheduleUtils.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pluralizeCount(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function getOverlapTone(bestFreeCount) {
    if (bestFreeCount >= 4) return 'from-emerald-400/22 via-emerald-300/12 to-transparent';
    if (bestFreeCount === 3) return 'from-sky-400/20 via-sky-300/10 to-transparent';
    if (bestFreeCount === 2) return 'from-amber-300/16 via-amber-200/8 to-transparent';
    return 'from-transparent via-transparent to-transparent';
}

function buildOverlapMap(overlapCandidates = []) {
    return overlapCandidates.reduce((accumulator, candidate) => {
        const key = toDateKey(candidate.startsAt);
        const current = accumulator[key] || { bestFreeCount: 0, candidateCount: 0 };
        current.bestFreeCount = Math.max(current.bestFreeCount, candidate.freeCount || 0);
        current.candidateCount += 1;
        accumulator[key] = current;
        return accumulator;
    }, {});
}

export default function GroupPlannerMonthView({
    anchorDate,
    selectedDay,
    onDaySelect,
    scheduleSlots,
    meetups,
    activeFilters,
    contentMode,
    overlapCandidates,
}) {
    const today = useMemo(() => new Date(), []);
    const monthDays = useMemo(() => getMonthGridDays(anchorDate), [anchorDate]);
    const overlapByDate = useMemo(() => buildOverlapMap(overlapCandidates), [overlapCandidates]);
    const showSessions = contentMode === 'assignments' || contentMode === 'both';
    const showAvailability = contentMode === 'classes' || contentMode === 'both';
    const showMeetups = showSessions && (activeFilters.length === 0 || activeFilters.includes('group-meetups'));
    const filteredMeetups = useMemo(
        () => (showMeetups ? meetups : []),
        [meetups, showMeetups],
    );
    const filteredScheduleSlots = useMemo(
        () => (
            showAvailability
                ? scheduleSlots.filter((slot) => activeFilters.length === 0 || activeFilters.includes(slot.class_id))
                : []
        ),
        [activeFilters, scheduleSlots, showAvailability],
    );

    return (
        <section className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(165deg,rgba(12,18,28,0.96),rgba(8,11,18,0.98))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:p-3">
            <div role="grid" aria-label="Monthly calendar">
                <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_LABELS.map((label) => (
                        <div
                            key={label}
                            className="py-1 text-center text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary"
                        >
                            {label}
                        </div>
                    ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                    {monthDays.map((date) => {
                        const daySummary = summarizeDay(date, filteredScheduleSlots, filteredMeetups);
                        const overlapSummary = overlapByDate[toDateKey(date)] || { bestFreeCount: 0, candidateCount: 0 };
                        const inMonth = isSameLocalMonth(date, anchorDate);
                        const isToday = isSameLocalDay(date, today);
                        const isSelected = selectedDay && isSameLocalDay(date, selectedDay);
                        const stateLabel = [
                            formatDateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' }),
                            daySummary.activeMeetupCount > 0
                                ? pluralizeCount(daySummary.activeMeetupCount, 'study session', 'study sessions')
                                : null,
                            daySummary.scheduleCount > 0
                                ? pluralizeCount(daySummary.scheduleCount, 'availability block', 'availability blocks')
                                : null,
                            overlapSummary.bestFreeCount >= 2
                                ? `best overlap ${overlapSummary.bestFreeCount} free`
                                : null,
                        ].filter(Boolean).join(', ');

                        return (
                            <button
                                key={date.toISOString()}
                                type="button"
                                role="gridcell"
                                aria-label={stateLabel}
                                onClick={() => onDaySelect(date)}
                                className={[
                                    'relative min-h-[104px] overflow-hidden rounded-[1.25rem] border p-2 text-left transition-all',
                                    inMonth
                                        ? 'border-white/10 bg-[linear-gradient(170deg,rgba(19,27,41,0.94),rgba(10,14,22,0.98))]'
                                        : 'border-white/6 bg-[linear-gradient(170deg,rgba(13,18,28,0.68),rgba(7,10,16,0.92))] opacity-45',
                                    isSelected ? 'border-claude-accent/35 shadow-[0_0_0_1px_rgba(222,185,106,0.24)]' : 'hover:border-white/20',
                                    isToday ? 'ring-1 ring-inset ring-claude-accent/55' : '',
                                ].join(' ')}
                            >
                                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${getOverlapTone(overlapSummary.bestFreeCount)}`} />
                                <div className="relative z-10 flex h-full flex-col">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-mono font-bold ${
                                            isToday
                                                ? 'bg-claude-accent text-[#182a31]'
                                                : 'bg-white/[0.05] text-claude-text'
                                        }`}>
                                            {date.getDate()}
                                        </span>

                                        {overlapSummary.bestFreeCount >= 2 && (
                                            <span className="rounded-full border border-emerald-300/22 bg-emerald-400/12 px-2 py-1 text-[8px] font-mono font-bold uppercase tracking-[0.16em] text-emerald-100">
                                                {overlapSummary.bestFreeCount} free
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {daySummary.activeMeetupCount > 0 && (
                                            <span className="rounded-full border border-claude-accent/24 bg-claude-accent/12 px-2 py-1 text-[8px] font-mono font-bold uppercase tracking-[0.14em] text-claude-accent">
                                                {daySummary.activeMeetupCount} session{daySummary.activeMeetupCount === 1 ? '' : 's'}
                                            </span>
                                        )}
                                        {daySummary.scheduleCount > 0 && (
                                            <span className="rounded-full border border-sky-300/18 bg-sky-400/10 px-2 py-1 text-[8px] font-mono font-bold uppercase tracking-[0.14em] text-sky-100">
                                                {daySummary.scheduleCount} avail
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto space-y-1">
                                        {daySummary.meetups.slice(0, 2).map((meetup) => (
                                            <div
                                                key={meetup.id}
                                                className="truncate rounded-[0.9rem] border border-claude-accent/16 bg-claude-accent/10 px-2 py-1 text-[10px] font-medium text-claude-text"
                                            >
                                                {meetup.topic}
                                            </div>
                                        ))}
                                        {daySummary.meetups.length > 2 && (
                                            <div className="text-[9px] font-medium text-claude-secondary">
                                                +{daySummary.meetups.length - 2} more sessions
                                            </div>
                                        )}
                                        {daySummary.meetups.length === 0 && daySummary.scheduleCount === 0 && overlapSummary.bestFreeCount < 2 && (
                                            <div className="text-[9px] font-medium text-claude-secondary/70">
                                                Open planning day
                                            </div>
                                        )}
                                        {overlapSummary.candidateCount > 0 && (
                                            <div className="flex gap-1">
                                                {Array.from({ length: Math.min(overlapSummary.candidateCount, 4) }).map((_, index) => (
                                                    <span
                                                        key={index}
                                                        aria-hidden="true"
                                                        className="h-1.5 flex-1 rounded-full bg-emerald-300/45"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
