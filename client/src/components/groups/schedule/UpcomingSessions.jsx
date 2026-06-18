import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, CalendarPlus2 } from 'lucide-react';
import { formatDateLabel, isSameLocalDay, startOfDay } from '../../../utils/calendarDates';
import MeetupCard from './MeetupCard';

function getValidTime(value) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
}

function getRangeEndExclusive(rangeEnd) {
    if (!rangeEnd) return null;

    const end = startOfDay(rangeEnd);
    end.setDate(end.getDate() + 1);
    return end.getTime();
}

function overlapsVisibleRange(meetup, rangeStart, rangeEnd) {
    const meetupStart = getValidTime(meetup?.start_at);
    const meetupEnd = getValidTime(meetup?.end_at);
    if (meetupStart === null || meetupEnd === null) return false;

    const rangeStartTime = rangeStart ? startOfDay(rangeStart).getTime() : -Infinity;
    const rangeEndTime = getRangeEndExclusive(rangeEnd) ?? Infinity;
    return meetupStart < rangeEndTime && meetupEnd >= rangeStartTime;
}

function groupByDay(meetups) {
    const groups = [];
    meetups.forEach((meetup) => {
        const day = startOfDay(meetup.start_at);
        const existing = groups.find((group) => isSameLocalDay(group.date, day));
        if (existing) {
            existing.meetups.push(meetup);
        } else {
            groups.push({ date: day, meetups: [meetup] });
        }
    });
    return groups;
}

/**
 * The scrollable sessions list for the currently visible calendar range.
 * Sessions are grouped by day; tapping one highlights its slot on the week strip
 * via `onSelectMeetup`.
 */
export default function UpcomingSessions({
    meetups = [],
    rangeStart = null,
    rangeEnd = null,
    view = 'week',
    nowMs,
    isAdmin,
    onJoin,
    onLeave,
    onCancel,
    onSelectMeetup,
    onPropose,
}) {
    // Stable "now" per mount (the schedule tab re-mounts on entry); avoids an
    // impure Date.now() during render.
    const [mountedNowMs] = useState(() => Date.now());
    const effectiveNowMs = nowMs ?? mountedNowMs;
    const rangeName = view === 'month' ? 'month' : 'week';
    const dayGroups = useMemo(() => {
        const sessions = meetups
            .filter((meetup) => meetup.status !== 'cancelled' && overlapsVisibleRange(meetup, rangeStart, rangeEnd))
            .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
        return groupByDay(sessions);
    }, [meetups, rangeEnd, rangeStart]);

    return (
        <section data-testid="upcoming-sessions" className="space-y-3 md:flex md:h-full md:min-h-0 md:flex-col md:space-y-0 md:gap-3">
            <div className="flex shrink-0 items-center justify-between gap-3">
                <h3 className="font-display text-[1.15rem] font-bold italic leading-tight tracking-tight text-claude-text">
                    Sessions this {rangeName}
                </h3>
                <button
                    type="button"
                    onClick={onPropose}
                    className="inline-flex items-center gap-1.5 rounded-full border border-claude-accent/30 bg-claude-accent/16 px-3 py-1.5 text-[11px] font-semibold text-claude-text transition-colors hover:bg-claude-accent/22"
                >
                    <CalendarPlus2 className="h-3 w-3 text-claude-accent" />
                    Propose
                </button>
            </div>

            {dayGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[1.4rem] border border-white/10 bg-white/[0.03] py-8 text-center md:flex-1 md:justify-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                        <CalendarDays className="h-4 w-4 text-claude-secondary" />
                    </div>
                    <div>
                        <p className="font-display text-[1rem] font-bold italic tracking-tight text-claude-text">
                            No sessions this {rangeName}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-4 text-claude-secondary">
                            {view === 'month'
                                ? 'Use Propose to add one.'
                                : 'Tap an open slot on the week to propose one.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1 md:no-scrollbar">
                    {dayGroups.map((group) => (
                        <div key={group.date.toISOString()} className="space-y-2">
                            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-claude-secondary">
                                {formatDateLabel(group.date, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                            <AnimatePresence mode="popLayout" initial={false}>
                                {group.meetups.map((meetup) => (
                                    <motion.div
                                        key={meetup.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                        layout="position"
                                        className="mb-2 last:mb-0"
                                    >
                                        <MeetupCard
                                            meetup={meetup}
                                            nowMs={effectiveNowMs}
                                            isAdmin={isAdmin}
                                            onJoin={onJoin}
                                            onLeave={onLeave}
                                            onCancel={onCancel}
                                            onSelect={onSelectMeetup}
                                            dense
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
