import { useMemo } from 'react';
import {
    getMeetupsForDate,
    getMonthGridDays,
    isSameLocalDay,
    isSameLocalMonth,
    SHORT_DAY_LABELS,
    startOfDay,
} from '../../../utils/calendarDates';
import { MEETUP_COLOR } from '../../../utils/calendarModel';

/**
 * Lightweight month overview: scheduled sessions shown as dots on each day. No
 * availability, no member lanes — a big-picture "what's coming" companion to the
 * week strip. Tapping a day selects it so the parent can surface that day's
 * sessions.
 */
export default function MonthOverview({ anchorDate, meetups = [], selectedDate, onDaySelect }) {
    const today = useMemo(() => startOfDay(new Date()), []);
    const days = useMemo(() => getMonthGridDays(anchorDate), [anchorDate]);

    return (
        <div data-testid="month-overview" className="md:flex md:h-full md:min-h-0 md:flex-col">
            <div className="grid shrink-0 grid-cols-7 gap-px pb-1">
                {SHORT_DAY_LABELS.map((label) => (
                    <div key={label} className="text-center font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-claude-secondary">
                        {label[0]}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-px md:min-h-0 md:flex-1 md:auto-rows-fr">
                {days.map((date) => {
                    const inMonth = isSameLocalMonth(date, anchorDate);
                    const isToday = isSameLocalDay(date, today);
                    const isSelected = selectedDate && isSameLocalDay(date, selectedDate);
                    const dayMeetups = getMeetupsForDate(date, meetups)
                        .filter((meetup) => meetup.status !== 'cancelled');

                    return (
                        <button
                            key={date.toISOString()}
                            type="button"
                            onClick={() => onDaySelect?.(date)}
                            className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[6px] border text-[11px] transition-colors md:aspect-auto md:min-h-0 ${
                                isSelected
                                    ? 'border-claude-accent/45 bg-claude-accent/12'
                                    : 'border-white/5 hover:bg-white/[0.05]'
                            } ${inMonth ? 'text-claude-text' : 'text-claude-secondary/40'}`}
                        >
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full font-semibold ${isToday ? 'bg-claude-accent text-[#182a31]' : ''}`}>
                                {date.getDate()}
                            </span>
                            <span className="flex h-1.5 items-center gap-0.5">
                                {dayMeetups.slice(0, 3).map((meetup) => (
                                    <span
                                        key={meetup.id}
                                        className="h-1 w-1 rounded-full"
                                        style={{ backgroundColor: MEETUP_COLOR }}
                                    />
                                ))}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
