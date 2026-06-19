import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Lock, Star } from 'lucide-react';
import {
    getMinutesSinceStart,
    isSameLocalDay,
    SHORT_DAY_LABELS,
    startOfDay,
} from '../../../utils/calendarDates';
import { FACES_MODE_MAX, getHeatmapCellStyle, MEETUP_COLOR } from '../../../utils/calendarModel';

const MAX_CELL_AVATARS = 3;

// Accent hue for the best-slot ring — distinct from meetup gold (#deb96a).
const BEST_SLOT_RING = '#7dd3c0'; // teal-mint

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

function buildAvailabilityLabel(dayOfWeek, hour, freeCount, denominator, freeMembers, isPast, isBest) {
    const base = denominator
        ? `${SHORT_DAY_LABELS[dayOfWeek]} ${formatHourLabel(hour)}: ${freeCount} of ${denominator} free`
        : `${SHORT_DAY_LABELS[dayOfWeek]} ${formatHourLabel(hour)}`;
    const freeNames = freeMembers.map((member) => member.name).filter(Boolean);
    let label = freeNames.length ? `${base}; free: ${freeNames.join(', ')}` : base;
    if (isBest) label += ' · best time';
    if (isPast) label += ' · unavailable';
    return label;
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

function FreeCountBadge({ freeCount, denominator }) {
    if (freeCount === 0) return null;
    return (
        <span
            data-testid="free-count-badge"
            className="flex items-baseline gap-[1px] font-mono leading-none"
        >
            <span className="text-[9px] font-bold text-white/90 md:text-[10px]">{freeCount}</span>
            <span className="text-[7px] font-medium text-white/40 md:text-[8px]">/{denominator}</span>
        </span>
    );
}

function buildBlockedHours(myClassSlots = []) {
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
 *   - `group`: read-only hybrid heatmap (faces or count + best-slot ring);
 *     tapping a free future cell proposes a session prefilled to that slot.
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
    nowMs = 0,
    onProposeCell,
    onToggleCell,
    onMeetupSelect,
}) {
    const today = useMemo(() => startOfDay(new Date(nowMs)), [nowMs]);
    const shouldReduceMotion = useReducedMotion();

    const hours = useMemo(() => {
        const list = [];
        for (let hour = startHour; hour < endHour; hour += 1) list.push(hour);
        return list;
    }, [startHour, endHour]);

    const blockedHours = useMemo(() => buildBlockedHours(myClassSlots), [myClassSlots]);

    const denominator = heatmap?.denominator ?? 0;
    const maxFree = heatmap?.maxFree ?? 0;
    const isEdit = mode === 'edit';
    const useFacesMode = denominator <= FACES_MODE_MAX;

    // Current time broken down for the "now" line.
    const nowDate = useMemo(() => new Date(nowMs), [nowMs]);
    const nowHour = nowDate.getHours();
    const nowMinuteFraction = nowDate.getMinutes() / 60;

    const rowVariants = shouldReduceMotion ? {} : {
        hidden: { opacity: 0 },
        visible: (i) => ({
            opacity: 1,
            transition: { delay: i * 0.012, duration: 0.15 },
        }),
    };

    const bestSlotPulse = shouldReduceMotion ? {} : {
        animate: {
            boxShadow: [
                `0 0 0 0px ${BEST_SLOT_RING}60`,
                `0 0 0 3px ${BEST_SLOT_RING}30`,
                `0 0 0 0px ${BEST_SLOT_RING}00`,
            ],
        },
        transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
    };

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
                {hours.map((hour, rowIndex) => (
                    <motion.div
                        key={hour}
                        className="grid gap-px md:min-h-0"
                        style={{ gridTemplateColumns: '2rem repeat(7, minmax(0, 1fr))' }}
                        custom={rowIndex}
                        initial={shouldReduceMotion ? undefined : 'hidden'}
                        animate={shouldReduceMotion ? undefined : 'visible'}
                        variants={rowVariants}
                    >
                        <div className="flex items-start justify-end pr-1 pt-0.5 font-mono text-[8px] font-medium text-claude-secondary/70 md:h-full">
                            {formatHourLabel(hour)}
                        </div>

                        {weekDays.map((date, dayIndex) => {
                            const dayOfWeek = startOfDay(date).getDay();
                            const cell = heatmap?.cells.get(`${dayIndex}-${hour}`);
                            const meetup = cell?.meetup || null;

                            const isToday = isSameLocalDay(date, today);
                            const cellEndMs = new Date(date).setHours(hour + 1, 0, 0, 0);
                            const isPast = cellEndMs <= nowMs;
                            const isCurrentHour = isToday && hour === nowHour;

                            // ---- Edit mode ----
                            if (isEdit) {
                                const isBlocked = blockedHours.get(dayOfWeek)?.has(hour);
                                const isFree = myCells?.has(`${dayOfWeek}-${hour}`);

                                if (isBlocked) {
                                    return (
                                        <div
                                            key={dayIndex}
                                            aria-label="Class time (locked)"
                                            className="flex h-9 items-center justify-center rounded-[3px] bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.07),rgba(255,255,255,0.07)_3px,transparent_3px,transparent_6px)] md:h-full md:min-h-[1.35rem]"
                                        >
                                            <Lock className="h-2.5 w-2.5 text-claude-secondary/60" />
                                        </div>
                                    );
                                }

                                return (
                                    <motion.button
                                        key={dayIndex}
                                        type="button"
                                        aria-pressed={Boolean(isFree)}
                                        aria-label={`${SHORT_DAY_LABELS[dayOfWeek]} ${formatHourLabel(hour)} ${isFree ? 'free' : 'not set'}`}
                                        onClick={() => onToggleCell?.(dayOfWeek, hour)}
                                        whileTap={shouldReduceMotion ? undefined : { scale: 0.93 }}
                                        className={`h-9 rounded-[3px] border transition-colors md:h-full md:min-h-[1.35rem] ${
                                            isFree
                                                ? 'border-[#7a9e72]/50 bg-[rgba(122,158,114,0.55)]'
                                                : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07]'
                                        }`}
                                    />
                                );
                            }

                            // ---- Group mode: meetup cell ----
                            if (meetup) {
                                const isHighlighted = highlightedMeetupId && meetup.id === highlightedMeetupId;
                                return (
                                    <motion.button
                                        key={dayIndex}
                                        type="button"
                                        aria-label={`Session: ${meetup.topic}`}
                                        onClick={() => onMeetupSelect?.(meetup)}
                                        whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                                        className={`h-9 overflow-hidden rounded-[3px] border text-left md:h-full md:min-h-[1.35rem] ${isHighlighted ? 'ring-2 ring-claude-accent' : ''}`}
                                        style={{ backgroundColor: `${MEETUP_COLOR}40`, borderColor: `${MEETUP_COLOR}99` }}
                                    >
                                        <span className="flex h-full items-center truncate px-1 text-[8px] font-semibold leading-none text-claude-accent">
                                            {meetup.topic}
                                        </span>
                                    </motion.button>
                                );
                            }

                            // ---- Group mode: availability cell ----
                            const freeCount = cell?.freeCount ?? 0;
                            const freeMembers = getCellMembers(cell?.freeMemberIds || [], memberById);
                            const style = getHeatmapCellStyle(freeCount, denominator);
                            const canPropose = Boolean(onProposeCell) && !isPast;
                            const isBest = denominator > 0 && maxFree >= 2 && freeCount === maxFree;
                            const availabilityLabel = buildAvailabilityLabel(dayOfWeek, hour, freeCount, denominator, freeMembers, isPast, isBest);

                            // Today-column tint overlay classes
                            const todayTint = isToday && !isPast ? 'ring-1 ring-inset ring-claude-accent/10' : '';

                            // Past cells: muted, non-interactive
                            if (isPast) {
                                return (
                                    <div
                                        key={dayIndex}
                                        aria-label={availabilityLabel}
                                        className="flex h-9 items-center justify-center rounded-[3px] border border-white/[0.03] bg-white/[0.02] opacity-30 md:h-full md:min-h-[1.35rem]"
                                    />
                                );
                            }

                            const cellContent = denominator > 0 && freeCount > 0
                                ? (useFacesMode
                                    ? <FreeMemberAvatarStack members={freeMembers} />
                                    : <FreeCountBadge freeCount={freeCount} denominator={denominator} />)
                                : null;

                            return (
                                <motion.button
                                    key={dayIndex}
                                    type="button"
                                    disabled={!canPropose}
                                    aria-label={availabilityLabel}
                                    title={availabilityLabel}
                                    onClick={() => onProposeCell?.(date, hour, cell)}
                                    whileTap={shouldReduceMotion || !canPropose ? undefined : { scale: 0.93 }}
                                    data-testid={isBest ? 'best-slot-cell' : undefined}
                                    className={`relative flex h-9 items-center justify-center rounded-[3px] border border-white/5 transition-colors enabled:hover:border-white/20 md:h-full md:min-h-[1.35rem] ${todayTint}`}
                                    style={style}
                                >
                                    {/* "now" line within the current hour */}
                                    {isCurrentHour && (
                                        <span
                                            className="pointer-events-none absolute inset-x-0 z-10 h-px bg-claude-accent/70"
                                            style={{ top: `${nowMinuteFraction * 100}%` }}
                                        />
                                    )}

                                    {/* Best-slot ring */}
                                    {isBest && (
                                        <motion.span
                                            className="pointer-events-none absolute inset-0 rounded-[3px]"
                                            style={{ outline: `2px solid ${BEST_SLOT_RING}`, outlineOffset: '-1px' }}
                                            {...(shouldReduceMotion ? {} : bestSlotPulse)}
                                        />
                                    )}

                                    {/* Cell content */}
                                    {cellContent}

                                    {/* Best-slot star marker */}
                                    {isBest && (
                                        <Star
                                            data-testid="best-slot-star"
                                            className="absolute right-0.5 top-0.5 h-2 w-2 shrink-0 fill-current"
                                            style={{ color: BEST_SLOT_RING }}
                                        />
                                    )}
                                </motion.button>
                            );
                        })}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
