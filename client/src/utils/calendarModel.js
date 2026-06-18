/**
 * View-model helpers for the coordination-first study group calendar.
 *
 * The group calendar no longer borrows the personal calendar's per-member "lane"
 * model. Instead it renders a graded availability heatmap (how many members are
 * free per hour-cell) plus a separate list of scheduled sessions. This module
 * owns the small mapping helpers shared by those surfaces — the heavier density
 * math lives in `calendarDates.buildAvailabilityHeatmap`.
 */

// Gold used for scheduled sessions across the group calendar.
export const MEETUP_COLOR = '#deb96a';

// Botanical green the heatmap fades in to signal "free".
export const AVAILABILITY_RGB = '122, 158, 114'; // #7a9e72

const MIN_FREE_ALPHA = 0.16;
const MAX_FREE_ALPHA = 0.92;

/**
 * Background style for a heatmap cell given how many members are free.
 *
 * - `denominator === 0` → no shared data yet (unknown); returns a faint neutral.
 * - otherwise opacity scales with the free ratio so denser overlap reads stronger.
 */
export function getHeatmapCellStyle(freeCount, denominator) {
    if (!denominator) {
        return { backgroundColor: 'rgba(255, 255, 255, 0.03)' };
    }

    const ratio = Math.max(0, Math.min(1, freeCount / denominator));
    if (ratio === 0) {
        return { backgroundColor: 'rgba(255, 255, 255, 0.04)' };
    }

    const alpha = MIN_FREE_ALPHA + (MAX_FREE_ALPHA - MIN_FREE_ALPHA) * ratio;
    return { backgroundColor: `rgba(${AVAILABILITY_RGB}, ${alpha.toFixed(3)})` };
}

/** Compact "X of N free" label for a cell (or null when there's no data). */
export function formatFreeLabel(freeCount, denominator) {
    if (!denominator) return null;
    return `${freeCount} of ${denominator} free`;
}

/** True when a meetup row represents a cancelled session. */
export function isMeetupCancelled(meetup) {
    return meetup?.status === 'cancelled';
}

/** True once a scheduled meetup has ended relative to a stable clock. */
export function isMeetupEnded(meetup, nowMs = Date.now()) {
    if (isMeetupCancelled(meetup)) return false;

    const endTime = new Date(meetup?.end_at).getTime();
    if (!Number.isFinite(endTime)) return false;

    return endTime < nowMs;
}

/** Short status chip label for a session card. */
export function getMeetupStateLabel(meetup, nowMs = Date.now()) {
    if (isMeetupCancelled(meetup)) return 'Cancelled';
    if (isMeetupEnded(meetup, nowMs)) return 'Ended';
    if (meetup?.is_joined) return 'Going';
    if (meetup?.is_creator) return 'You proposed';
    return 'Open';
}
