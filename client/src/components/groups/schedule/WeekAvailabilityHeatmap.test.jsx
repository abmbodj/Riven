import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeekAvailabilityHeatmap from './WeekAvailabilityHeatmap.jsx';
import { getRollingWeekDays, startOfWeek } from '../../../utils/calendarDates';

const WEEK_DAYS = getRollingWeekDays(startOfWeek(new Date(2026, 5, 17)));

const MEMBERS = new Map([
    ['a', { id: 'a', username: 'ada', display_name: 'Ada Lovelace', avatar: 'https://cdn.test/ada.png' }],
    ['b', { id: 'b', username: 'ben', display_name: 'Ben Bit' }],
    ['c', { id: 'c', username: 'cy', display_name: 'Cy Compiler' }],
    ['d', { id: 'd', username: 'dot', display_name: 'Dot Debugger' }],
]);

function renderHeatmapCell({ freeMemberIds = [], denominator = 4 } = {}) {
    const heatmap = {
        denominator,
        maxFree: freeMemberIds.length,
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

    render(
        <WeekAvailabilityHeatmap
            mode="group"
            weekDays={WEEK_DAYS}
            startHour={10}
            endHour={11}
            heatmap={heatmap}
            memberById={MEMBERS}
            onProposeCell={vi.fn()}
        />,
    );

    return screen.getByRole('button', { name: /Sun 10a/i });
}

describe('WeekAvailabilityHeatmap', () => {
    it('renders one free member as an avatar without visible count text', () => {
        const cell = renderHeatmapCell({ freeMemberIds: ['a'] });

        expect(cell).toHaveAccessibleName(/Sun 10a: 1 of 4 free; free: Ada Lovelace/i);
        expect(within(cell).getByTestId('free-member-avatar')).toHaveAttribute('src', 'https://cdn.test/ada.png');
        expect(within(cell).queryByText('1')).not.toBeInTheDocument();
        expect(within(cell).queryByTestId('free-member-avatar-overflow')).not.toBeInTheDocument();
    });

    it('renders multiple free members as overlapping avatars', () => {
        const cell = renderHeatmapCell({ freeMemberIds: ['a', 'b', 'c'] });

        expect(cell).toHaveAccessibleName(/Ada Lovelace, Ben Bit, Cy Compiler/i);
        expect(within(cell).getAllByTestId('free-member-avatar')).toHaveLength(3);
        expect(within(cell).queryByTestId('free-member-avatar-overflow')).not.toBeInTheDocument();
    });

    it('renders three avatars plus a compact overflow badge for crowded cells', () => {
        const cell = renderHeatmapCell({ freeMemberIds: ['a', 'b', 'c', 'd'] });

        expect(within(cell).getAllByTestId('free-member-avatar')).toHaveLength(3);
        expect(within(cell).getByTestId('free-member-avatar-overflow')).toHaveTextContent('+1');
    });

    it('uses the DiceBear fallback when a member has no avatar', () => {
        const cell = renderHeatmapCell({ freeMemberIds: ['b'] });

        expect(within(cell).getByTestId('free-member-avatar')).toHaveAttribute(
            'src',
            'https://api.dicebear.com/7.x/notionists/svg?seed=ben',
        );
    });

    it('renders no avatars for a zero-free cell while preserving the count label', () => {
        const cell = renderHeatmapCell({ freeMemberIds: [] });

        expect(cell).toHaveAccessibleName('Sun 10a: 0 of 4 free');
        expect(within(cell).queryByTestId('free-member-avatar')).not.toBeInTheDocument();
        expect(within(cell).queryByTestId('free-member-avatar-overflow')).not.toBeInTheDocument();
    });
});
