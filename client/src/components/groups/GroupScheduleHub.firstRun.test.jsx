import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupScheduleHub from './GroupScheduleHub.jsx';

// Stub animation + heavy schedule children so the test exercises only the
// first-run vs group-view decision (showFirstRun) in the hub itself.
vi.mock('motion/react', () => ({
    motion: new Proxy({}, {
        get: () => ({ children, ...props }) => <div {...props}>{children}</div>,
    }),
    AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('./schedule/WeekAvailabilityHeatmap.jsx', () => ({
    default: () => <div data-testid="week-heatmap" />,
}));
vi.mock('./schedule/UpcomingSessions.jsx', () => ({ default: () => <div /> }));
vi.mock('./schedule/MonthOverview.jsx', () => ({ default: () => <div /> }));
vi.mock('./schedule/ProposeSessionSheet.jsx', () => ({ default: () => null }));
vi.mock('./schedule/SessionDetailSheet.jsx', () => ({ default: () => null }));

const baseData = {
    members: [],
    schedule_slots: [],
    availability: [],
    my_availability: [],
    my_schedule_slots: [],
    meetups: [],
    my_share_mode: null,
};

function renderHub(overrides = {}) {
    return render(
        <GroupScheduleHub
            calendarData={{ ...baseData, ...overrides }}
            loading={false}
            isAdmin={false}
            onRangeChange={vi.fn()}
            onSetShareMode={vi.fn()}
            onSaveAvailability={vi.fn()}
            onCreateMeetup={vi.fn()}
            onJoinMeetup={vi.fn()}
            onLeaveMeetup={vi.fn()}
            onCancelMeetup={vi.fn()}
        />
    );
}

describe('GroupScheduleHub first-run guard', () => {
    it('shows the "Find a time to meet" empty state when nobody has shared', () => {
        renderHub();
        expect(screen.getByText('Find a time to meet')).toBeInTheDocument();
    });

    it('hides the empty state once the current user has painted, even if the heatmap denominator is still 0', () => {
        // Simulates the optimistic / transient post-save state: my cells exist and
        // I am shared, but the group `availability` array hasn't reconciled yet
        // (denominator === 0). The guard must keep the group view, not bounce back.
        renderHub({
            my_share_mode: 'busy_free',
            my_availability: [{ day_of_week: 1, hour: 9 }],
            members: [{ id: 1, username: 'me', share_mode: 'busy_free' }],
            availability: [],
        });
        expect(screen.queryByText('Find a time to meet')).not.toBeInTheDocument();
    });
});
