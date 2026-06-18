import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UpcomingSessions from './UpcomingSessions.jsx';
import MeetupCard from './MeetupCard.jsx';
import SessionDetailSheet from './SessionDetailSheet.jsx';

vi.mock('motion/react', () => {
    const createMotionComponent = (tag) => React.forwardRef(
        ({
            children,
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            layout: _layout,
            ...props
        }, ref) => React.createElement(tag, { ...props, ref }, children),
    );

    return {
        AnimatePresence: ({ children }) => <>{children}</>,
        motion: new Proxy({}, {
            get: (_, tag) => createMotionComponent(tag),
        }),
    };
});

vi.mock('../../../hooks/useBodyScrollLock', () => ({
    default: () => undefined,
}));

const NOW_MS = new Date('2026-06-18T17:00:00Z').getTime();
const WEEK_START = new Date('2026-05-31T00:00:00');
const WEEK_END = new Date('2026-06-06T00:00:00');

function makeMeetup(overrides = {}) {
    return {
        id: 'meetup-math',
        topic: 'Math Tetst',
        start_at: '2026-06-01T16:00:00Z',
        end_at: '2026-06-01T17:00:00Z',
        status: 'scheduled',
        attendee_count: 1,
        attendees: [],
        attendee_ids: ['user-1'],
        is_joined: false,
        is_creator: false,
        ...overrides,
    };
}

describe('UpcomingSessions', () => {
    it('shows past sessions inside the visible week range', () => {
        render(
            <UpcomingSessions
                meetups={[makeMeetup()]}
                rangeStart={WEEK_START}
                rangeEnd={WEEK_END}
                view="week"
                nowMs={NOW_MS}
            />,
        );

        expect(screen.getByText('Sessions this week')).toBeInTheDocument();
        expect(screen.getByText('Math Tetst')).toBeInTheDocument();
        expect(screen.getByText('Ended')).toBeInTheDocument();
        expect(screen.queryByText('No sessions this week')).not.toBeInTheDocument();
    });

    it('hides cancelled and out-of-range sessions from the visible week range', () => {
        render(
            <UpcomingSessions
                meetups={[
                    makeMeetup({ id: 'cancelled', topic: 'Cancelled review', status: 'cancelled' }),
                    makeMeetup({
                        id: 'outside',
                        topic: 'Next week review',
                        start_at: '2026-06-08T16:00:00Z',
                        end_at: '2026-06-08T17:00:00Z',
                    }),
                ]}
                rangeStart={WEEK_START}
                rangeEnd={WEEK_END}
                view="week"
                nowMs={NOW_MS}
            />,
        );

        expect(screen.getByText('No sessions this week')).toBeInTheDocument();
        expect(screen.queryByText('Cancelled review')).not.toBeInTheDocument();
        expect(screen.queryByText('Next week review')).not.toBeInTheDocument();
    });
});

describe('MeetupCard', () => {
    it('shows ended sessions without RSVP or cancel actions', () => {
        render(
            <MeetupCard
                meetup={makeMeetup({ is_creator: true })}
                nowMs={NOW_MS}
                isAdmin
                onJoin={vi.fn()}
                onLeave={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByText('Ended')).toBeInTheDocument();
        expect(screen.getByText('This session has ended.')).toBeInTheDocument();
        expect(screen.queryByText("I'm going")).not.toBeInTheDocument();
        expect(screen.queryByText("Can't make it")).not.toBeInTheDocument();
        expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
});

describe('SessionDetailSheet', () => {
    it('shows ended sessions without RSVP or cancel actions', () => {
        render(
            <SessionDetailSheet
                open
                meetup={makeMeetup({ is_joined: true, is_creator: true })}
                nowMs={NOW_MS}
                isAdmin
                onClose={vi.fn()}
                onJoin={vi.fn()}
                onLeave={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByRole('dialog', { name: 'Math Tetst' })).toBeInTheDocument();
        expect(screen.getByText('Ended')).toBeInTheDocument();
        expect(screen.queryByText("I'm going")).not.toBeInTheDocument();
        expect(screen.queryByText("Can't make it")).not.toBeInTheDocument();
        expect(screen.queryByText('Cancel session')).not.toBeInTheDocument();
    });
});
