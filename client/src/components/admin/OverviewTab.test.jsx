import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OverviewTab from './OverviewTab.jsx';

function buildStats(dailyUsers) {
    return {
        users: 128,
        decks: 64,
        cards: 512,
        recentSignups: dailyUsers.reduce((sum, entry) => sum + entry.count, 0),
        recentSessions: 431,
        dailyUsers,
        topDecks: [],
    };
}

describe('OverviewTab', () => {
    it('renders the admin activity graph as a line chart with one point per day', () => {
        const dailyUsers = [
            { date: '2026-03-10', count: 2 },
            { date: '2026-03-11', count: 5 },
            { date: '2026-03-12', count: 1 },
            { date: '2026-03-13', count: 7 },
            { date: '2026-03-14', count: 4 },
        ];

        render(<OverviewTab stats={buildStats(dailyUsers)} />);

        expect(screen.getByTestId('admin-activity-line-chart')).toBeInTheDocument();
        expect(screen.getAllByTestId('admin-activity-line-point')).toHaveLength(dailyUsers.length);
        expect(screen.getByText(/new user signups over time/i)).toBeInTheDocument();
    });

    it('renders a visible flat line when every signup count is zero', () => {
        const dailyUsers = [
            { date: '2026-03-10', count: 0 },
            { date: '2026-03-11', count: 0 },
            { date: '2026-03-12', count: 0 },
            { date: '2026-03-13', count: 0 },
        ];

        render(<OverviewTab stats={buildStats(dailyUsers)} />);

        const points = screen.getAllByTestId('admin-activity-line-point');
        const uniqueYValues = new Set(points.map((point) => point.getAttribute('cy')));

        expect(screen.getByTestId('admin-activity-line-chart')).toBeInTheDocument();
        expect(points).toHaveLength(dailyUsers.length);
        expect(uniqueYValues.size).toBe(1);
    });
});
