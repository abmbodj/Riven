import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeekAvailabilityHeatmap from './WeekAvailabilityHeatmap.jsx';
import { getRollingWeekDays, startOfWeek } from '../../../utils/calendarDates';

// Week anchored to 2026-06-17 (Wed) — gives Sun 2026-06-14 through Sat 2026-06-20.
const WEEK_DAYS = getRollingWeekDays(startOfWeek(new Date(2026, 5, 17)));

// Before the week starts — all cells are in the future, so content renders normally.
const BEFORE_WEEK_MS = new Date(2026, 5, 13, 0, 0, 0).getTime(); // Sat Jun 13 midnight

// Mid-week — Sun/Mon/Tue/Wed cells at hour 10 are past.
const MID_WEEK_MS = new Date(2026, 5, 18, 11, 0, 0).getTime(); // Thu Jun 18 11am

const MEMBERS = new Map([
    ['a', { id: 'a', username: 'ada', display_name: 'Ada Lovelace', avatar: 'https://cdn.test/ada.png' }],
    ['b', { id: 'b', username: 'ben', display_name: 'Ben Bit' }],
    ['c', { id: 'c', username: 'cy', display_name: 'Cy Compiler' }],
    ['d', { id: 'd', username: 'dot', display_name: 'Dot Debugger' }],
]);

function makeFutureHeatmap({ freeMemberIds = [], denominator = 4, maxFree } = {}) {
    return {
        denominator,
        maxFree: maxFree ?? freeMemberIds.length,
        participatingMemberIds: ['a', 'b', 'c', 'd'],
        cells: new Map([
            ['0-10', {
                dayIndex: 0,
                hour: 10,
                freeCount: freeMemberIds.length,
                freeMemberIds,
                busyMemberIds: [],
                meetup: null,
            }],
        ]),
    };
}

function renderWithHeatmap(heatmap, { nowMs = BEFORE_WEEK_MS } = {}) {
    render(
        <WeekAvailabilityHeatmap
            mode="group"
            weekDays={WEEK_DAYS}
            startHour={10}
            endHour={11}
            heatmap={heatmap}
            memberById={MEMBERS}
            nowMs={nowMs}
            onProposeCell={vi.fn()}
        />,
    );
}

describe('WeekAvailabilityHeatmap — faces mode (denominator ≤ 4)', () => {
    function renderFacesCell({ freeMemberIds = [] } = {}) {
        renderWithHeatmap(makeFutureHeatmap({ freeMemberIds, denominator: 4 }));
        return screen.getByRole('button', { name: /Sun 10a/i });
    }

    it('renders one free member as an avatar without visible count text', () => {
        const cell = renderFacesCell({ freeMemberIds: ['a'] });

        expect(cell).toHaveAccessibleName(/Sun 10a: 1 of 4 free; free: Ada Lovelace/i);
        expect(within(cell).getByTestId('free-member-avatar')).toHaveAttribute('src', 'https://cdn.test/ada.png');
        expect(within(cell).queryByText('1')).not.toBeInTheDocument();
        expect(within(cell).queryByTestId('free-member-avatar-overflow')).not.toBeInTheDocument();
    });

    it('renders multiple free members as overlapping avatars', () => {
        const cell = renderFacesCell({ freeMemberIds: ['a', 'b', 'c'] });

        expect(cell).toHaveAccessibleName(/Ada Lovelace, Ben Bit, Cy Compiler/i);
        expect(within(cell).getAllByTestId('free-member-avatar')).toHaveLength(3);
        expect(within(cell).queryByTestId('free-member-avatar-overflow')).not.toBeInTheDocument();
    });

    it('renders three avatars plus a compact overflow badge for crowded cells', () => {
        const cell = renderFacesCell({ freeMemberIds: ['a', 'b', 'c', 'd'] });

        expect(within(cell).getAllByTestId('free-member-avatar')).toHaveLength(3);
        expect(within(cell).getByTestId('free-member-avatar-overflow')).toHaveTextContent('+1');
    });

    it('uses the DiceBear fallback when a member has no avatar', () => {
        const cell = renderFacesCell({ freeMemberIds: ['b'] });

        expect(within(cell).getByTestId('free-member-avatar')).toHaveAttribute(
            'src',
            'https://api.dicebear.com/7.x/notionists/svg?seed=ben',
        );
    });

    it('renders no avatars for a zero-free cell while preserving the count label', () => {
        const cell = renderFacesCell({ freeMemberIds: [] });

        expect(cell).toHaveAccessibleName(/Sun 10a: 0 of 4 free/i);
        expect(within(cell).queryByTestId('free-member-avatar')).not.toBeInTheDocument();
        expect(within(cell).queryByTestId('free-member-avatar-overflow')).not.toBeInTheDocument();
    });
});

describe('WeekAvailabilityHeatmap — numbers mode (denominator > 4)', () => {
    function renderNumbersCell({ freeMemberIds = [] } = {}) {
        renderWithHeatmap(
            makeFutureHeatmap({ freeMemberIds, denominator: 6, maxFree: freeMemberIds.length }),
        );
        return screen.getByRole('button', { name: /Sun 10a/i });
    }

    it('shows count badge instead of avatars', () => {
        const cell = renderNumbersCell({ freeMemberIds: ['a', 'b', 'c'] });

        expect(within(cell).queryByTestId('free-member-avatar')).not.toBeInTheDocument();
        expect(within(cell).getByTestId('free-count-badge')).toBeInTheDocument();
    });

    it('count badge contains the free count and denominator', () => {
        const cell = renderNumbersCell({ freeMemberIds: ['a', 'b', 'c'] });
        const badge = within(cell).getByTestId('free-count-badge');

        expect(badge).toHaveTextContent('3');
        expect(badge).toHaveTextContent('/6');
    });

    it('shows no badge when zero are free', () => {
        const cell = renderNumbersCell({ freeMemberIds: [] });

        expect(within(cell).queryByTestId('free-count-badge')).not.toBeInTheDocument();
        expect(within(cell).queryByTestId('free-member-avatar')).not.toBeInTheDocument();
    });
});

describe('WeekAvailabilityHeatmap — best-slot marker', () => {
    function renderBestSlot({ freeCount, maxFree, denominator = 4 }) {
        const freeMemberIds = ['a', 'b'].slice(0, freeCount);
        renderWithHeatmap(makeFutureHeatmap({ freeMemberIds, denominator, maxFree }));
        return screen.getByRole('button', { name: /Sun 10a/i });
    }

    it('shows star marker when cell is at peak overlap (≥2)', () => {
        const cell = renderBestSlot({ freeCount: 2, maxFree: 2 });
        expect(within(cell).getByTestId('best-slot-star')).toBeInTheDocument();
    });

    it('does NOT show star marker when maxFree is 1', () => {
        const cell = renderBestSlot({ freeCount: 1, maxFree: 1 });
        expect(within(cell).queryByTestId('best-slot-star')).not.toBeInTheDocument();
    });

    it('does NOT show star marker when cell is below peak', () => {
        const cell = renderBestSlot({ freeCount: 1, maxFree: 3 });
        expect(within(cell).queryByTestId('best-slot-star')).not.toBeInTheDocument();
    });

    it('aria-label includes "best time" hint for peak cells', () => {
        const cell = renderBestSlot({ freeCount: 2, maxFree: 2 });
        expect(cell).toHaveAccessibleName(/best time/i);
    });
});

describe('WeekAvailabilityHeatmap — past cells', () => {
    it('past cell is not a button (non-interactive)', () => {
        // Sun Jun 14 10a is past relative to Thu Jun 18 11am.
        renderWithHeatmap(makeFutureHeatmap({ freeMemberIds: ['a', 'b'], maxFree: 2 }), { nowMs: MID_WEEK_MS });

        expect(screen.queryByRole('button', { name: /Sun 10a/i })).not.toBeInTheDocument();
    });

    it('aria-label for past cell includes "unavailable"', () => {
        renderWithHeatmap(makeFutureHeatmap({ freeMemberIds: ['a', 'b'], maxFree: 2 }), { nowMs: MID_WEEK_MS });

        const cell = screen.getByLabelText(/Sun 10a/i);
        expect(cell).toHaveAccessibleName(/unavailable/i);
    });

    it('past cell still shows the availability background instead of a blank placeholder', () => {
        // A cell with 2 of 4 free must render the same graded green background
        // whether it's past or future — saved availability shouldn't disappear
        // just because the slot already passed.
        renderWithHeatmap(makeFutureHeatmap({ freeMemberIds: ['a', 'b'], denominator: 4, maxFree: 2 }), { nowMs: MID_WEEK_MS });

        const cell = screen.getByLabelText(/Sun 10a/i);
        expect(cell.style.backgroundColor).toContain('122, 158, 114');
    });

    it('past cell with no data falls back to the neutral placeholder', () => {
        renderWithHeatmap(makeFutureHeatmap({ freeMemberIds: [], denominator: 0, maxFree: 0 }), { nowMs: MID_WEEK_MS });

        const cell = screen.getByLabelText(/Sun 10a/i);
        expect(cell.style.backgroundColor).toBe('rgba(255, 255, 255, 0.03)');
    });
});
