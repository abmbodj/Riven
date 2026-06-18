import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import {
    getMinutesSinceStart,
    isSameLocalDay,
    SHORT_DAY_LABELS,
    startOfDay,
} from '../../../utils/calendarDates';
import { getHeatmapCellStyle, MEETUP_COLOR } from '../../../utils/calendarModel';

const MAX_CELL_AVATARS = 3;

function formatHourLabel(hour) {
    const meridiem = hour >= 12 ? 'p' : 'a';
    const normalized = hour % 12 || 12;
    return `${normalized}${meridiem}`;
}

function getMemberName(member, fallbackId) {
    return member?.display_name || member?.username || fallbackId || 'Member';
}

function getMemberAvatar(member, fallbackId) {
    const seed = member?.username || member?.id || fallbackId || 'member';
    return member?.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}`;
}

function getCellMembers(memberIds = [], memberById) {
    return memberIds.map((memberId) => {
        const key = String(memberId);
        const member = memberById?.get(key);
        return {
            id: String(member?.id || key),
            name: getMemberName(member, key),
            avatar: getMemberAvatar(member, key),
        };
    });
}

function buildAvailabilityLabel(dayOfWeek, hour, freeCount, denominator, freeMembers) {
    const base = denominator
        ? `${SHORT_DAY_LABELS[dayOfWeek]} ${formatHourLabel(hour)}: ${freeCount} of ${denominator} free`
        : `${SHORT_DAY_LABELS[dayOfWeek]} ${formatHourLabel(hour)}`;
    const freeNames = freeMembers.map((member) => member.name).filter(Boolean);
    return freeNames.length ? `${base}; free: ${freeNames.join(', ')}` : base;
}

function FreeMemberAvatarStack({ members = [] }) {
    if (!members.length) return null;

    const visibleMembers = members.slice(0, MAX_CELL_AVATARS);
    const overflowCount = members.length - visibleMembers.length;

    return (
        <span data-testid="free-member-avatar-stack" className="flex min-w-0 items-center justify-center -space-x-1 overflow-hidden px-0.5">
            {visibleMembers.map((member) => (
                <img
                    key={member.id}
                    src={member.avatar}
                    alt=""
                    loading="lazy"
                    data-testid="free-member-avatar"
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-[rgba(24,42,49,0.88)] bg-white/90 object-cover p-[1px] shadow-[0_1px_2px_rgba(0,0,0,0.24)] md:h-4 md:w-4"
                />
            ))}
            {overflowCount > 0 && (
                <span
                    data-testid="free-member-avatar-overflow"
                    className="relative z-10 flex h-3.5 min-w-[0.875rem] shrink-0 items-center justify-center rounded-full border border-[rgba(24,42,49,0.88)] bg-[rgba(15,26,18,0.82)] px-1 font-mono text-[7px] font-bold leading-none text-[#e9f2df] md:h-4 md:min-w-[1rem]"
                >
                    +{overflowCount}
                </span>
            )}
        </span>
    );
}

function buildBlockedHours(myClassSlots = []) {
    // Map<dayOfWeek, Set<hour>> of the current user's class hours (pre-blocked
    // in edit mode — you can't mark yourself free during a class).
    const blocked = new Map();
    myClassSlots.forEach((slot) => {
        const day = Number(slot.day_of_week);
        const startHour = Math.floor(getMinutesSinceStart(slot.start_time) / 60);
        const endHour = Math.ceil(getMinutesSinceStart(slot.end_time) / 60);
        const set = blocked.get(day) || new Set();
        for (let hour = startHour; hour < endHour; hour += 1) set.add(hour);
        blocked.set(day, set);
    });
    return blocked;
}

/**
 * The week availability grid. Two modes:
 *   - `group`: read-only graded heatmap of how many members are free per cell;
 *     tapping a free cell proposes a session prefilled to that slot.
 *   - `edit`:  the same grid as a paint surface for the current user's own free
 *     cells; class hours are locked pre-blocks.
 */
export default function WeekAvailabilityHeatmap({
    mode = 'group',
    weekDays = [],
    startHour,
    endHour,
    heatmap = null,
    memberById = null,
    myCells = null,
    myClassSlots = [],
    highlightedMeetupId = null,
    onProposeCell,
    onToggleCell,
    onMeetupSelect,
}) {
    const today = useMemo(() => startOfDay(new Date()), []);
    const hours = useMemo(() => {
        const list = [];
        for (let hour = startHour; hour < endHour; hour += 1) list.push(hour);
        return list;
    }, [startHour, endHour]);
    const blockedHours = useMemo(() => buildBlockedHours(myClassSlots), [myClassSlots]);

    const denominator = heatmap?.denominator ?? 0;
    const isEdit = mode === 'edit';

    return (
        <div data-testid="week-availability-heatmap" data-mode={mode} className="select-none md:flex md:min-h-0 md:flex-1 md:flex-col">
            {/* Day headers */}
            <div
                className="grid shrink-0 items-end gap-px"
                style={{ gridTemplateColumns: '2rem repeat(7, minmax(0, 1fr))' }}
            >
                <div />
                {weekDays.map((date) => {
                    const isToday = isSameLocalDay(date, today);
                    return (
                        <div key={date.toISOString()} className="pb-1 text-center">
                            <div className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-claude-secondary">
                                {SHORT_DAY_LABELS[date.getDay()]}
                            </div>
                            <div className={`mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${isToday ? 'bg-claude-accent text-[#182a31]' : 'text-claude-text'}`}>
                                {date.getDate()}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Hour rows */}
            <div
                className="space-y-px md:grid md:min-h-0 md:flex-1 md:space-y-0 md:gap-px"
                style={{ gridTemplateRows: `repeat(${hours.length}, minmax(1.35rem, 1fr))` }}
            >
                {hours.map((hour) => (
                    <div
                        key={hour}
                        className="grid gap-px md:min-h-0"
                        style={{ gridTemplateColumns: '2rem repeat(7, minmax(0, 1fr))' }}
                    >
                        <div className="flex items-start justify-end pr-1 pt-0.5 font-mono text-[8px] font-medium text-claude-secondary/70 md:h-full">
                            {formatHourLabel(hour)}
                        </div>

                        {weekDays.map((date, dayIndex) => {
                            const dayOfWeek = startOfDay(date).getDay();
                            const cell = heatmap?.cells.get(`${dayIndex}-${hour}`);
                            const meetup = cell?.meetup || null;

                            // ---- Edit mode: paint your own free cells ----
                            if (isEdit) {
                                const isBlocked = blockedHours.get(dayOfWeek)?.has(hour);
                                const isFree = myCells?.has(`${dayOfWeek}-${hour}`);

                                if (isBlocked) {
                                    return (
                                        <div
                                            key={dayIndex}
                                            aria-label="Class time (locked)"
                                            className="flex h-7 items-center justify-center rounded-[3px] bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.07),rgba(255,255,255,0.07)_3px,transparent_3px,transparent_6px)] md:h-full md:min-h-[1.35rem]"
                                        >
                                            <Lock className="h-2.5 w-2.5 text-claude-secondary/60" />
                                        </div>
                                    );
                                }

                                return (
                                    <button
                                        key={dayIndex}
                                        type="button"
                                        aria-pressed={Boolean(isFree)}
                                        aria-label={`${SHORT_DAY_LABELS[dayOfWeek]} ${formatHourLabel(hour)} ${isFree ? 'free' : 'not set'}`}
                                        onClick={() => onToggleCell?.(dayOfWeek, hour)}
                                        className={`h-7 rounded-[3px] border transition-colors md:h-full md:min-h-[1.35rem] ${
                                            isFree
                                                ? 'border-[#7a9e72]/50 bg-[rgba(122,158,114,0.55)]'
                                                : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07]'
                                        }`}
                                    />
                                );
                            }

                            // ---- Group mode: read heatmap, tap to propose ----
                            if (meetup) {
                                const isHighlighted = highlightedMeetupId && meetup.id === highlightedMeetupId;
                                return (
                                    <button
                                        key={dayIndex}
                                        type="button"
                                        aria-label={`Session: ${meetup.topic}`}
                                        onClick={() => onMeetupSelect?.(meetup)}
                                        className={`h-7 overflow-hidden rounded-[3px] border text-left md:h-full md:min-h-[1.35rem] ${isHighlighted ? 'ring-2 ring-claude-accent' : ''}`}
                                        style={{ backgroundColor: `${MEETUP_COLOR}40`, borderColor: `${MEETUP_COLOR}99` }}
                                    >
                                        <span className="flex h-full items-center truncate px-1 text-[8px] font-semibold leading-7 text-claude-accent md:leading-none">
                                            {meetup.topic}
                                        </span>
                                    </button>
                                );
                            }

                            const freeCount = cell?.freeCount ?? 0;
                            const freeMembers = getCellMembers(cell?.freeMemberIds || [], memberById);
                            const style = getHeatmapCellStyle(freeCount, denominator);
                            const canPropose = Boolean(onProposeCell);
                            const availabilityLabel = buildAvailabilityLabel(dayOfWeek, hour, freeCount, denominator, freeMembers);

                            return (
                                <button
                                    key={dayIndex}
                                    type="button"
                                    disabled={!canPropose}
                                    aria-label={availabilityLabel}
                                    title={availabilityLabel}
                                    onClick={() => onProposeCell?.(date, hour, cell)}
                                    className="flex h-7 items-center justify-center rounded-[3px] border border-white/5 transition-transform enabled:hover:scale-[1.04] enabled:hover:border-white/20 md:h-full md:min-h-[1.35rem]"
                                    style={style}
                                >
                                    {denominator > 0 && freeCount > 0 && <FreeMemberAvatarStack members={freeMembers} />}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
