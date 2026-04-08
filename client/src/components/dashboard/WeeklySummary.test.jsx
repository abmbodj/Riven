import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WeeklySummary from './WeeklySummary.jsx';

describe('WeeklySummary', () => {
  it('shows a reserved skeleton while loading', () => {
    render(<WeeklySummary summary={null} loading reducedMotion lowVisualBudget />);

    expect(screen.getByLabelText(/loading weekly summary/i)).toBeInTheDocument();
  });

  it('renders the empty-week accuracy copy as -- with accessible labeling', () => {
    render(
      <WeeklySummary
        dueThisWeekCount={0}
        loading={false}
        reducedMotion
        lowVisualBudget
        summary={{
          cards_studied: 0,
          accuracy: null,
          total_minutes: 0,
          daily_breakdown: [
            { date: '2026-03-15', day: 'Sun', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-16', day: 'Mon', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-17', day: 'Tue', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-18', day: 'Wed', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-19', day: 'Thu', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-20', day: 'Fri', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-21', day: 'Sat', cards: 0, minutes: 0, studied: false, is_today: true },
          ],
        }}
      />,
    );

    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText(/no study accuracy yet this week/i)).toBeInTheDocument();
  });

  it('renders a visible study-activity line chart even when the week is flat', () => {
    render(
      <WeeklySummary
        dueThisWeekCount={3}
        loading={false}
        reducedMotion
        lowVisualBudget
        summary={{
          cards_studied: 0,
          accuracy: null,
          total_minutes: 0,
          daily_breakdown: [
            { date: '2026-03-15', day: 'Sun', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-16', day: 'Mon', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-17', day: 'Tue', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-18', day: 'Wed', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-19', day: 'Thu', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-20', day: 'Fri', cards: 0, minutes: 0, studied: false, is_today: false },
            { date: '2026-03-21', day: 'Sat', cards: 0, minutes: 0, studied: false, is_today: true },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('weekly-summary-line-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('weekly-summary-line-point')).toHaveLength(7);
    expect(screen.getByText('Due This Week')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
