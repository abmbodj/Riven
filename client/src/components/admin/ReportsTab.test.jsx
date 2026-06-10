import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReportsTab from './ReportsTab.jsx';

const haptics = {
  light: vi.fn(),
  medium: vi.fn(),
  heavy: vi.fn(),
};

const reports = [
  {
    id: 10,
    status: 'pending',
    content_type: 'group_message',
    reporter_username: 'reporter',
    reported_username: 'reported',
    reported_user_id: 77,
    reason: 'Harassment',
    details: 'Repeated hostile messages.',
    created_at: '2026-05-01T12:00:00.000Z',
  },
  {
    id: 11,
    status: 'resolved',
    content_type: 'deck',
    reporter_username: 'kai',
    reported_username: 'mira',
    reported_user_id: 78,
    reason: 'Spam',
    created_at: '2026-05-02T12:00:00.000Z',
  },
];

describe('ReportsTab', () => {
  it('renders pending reports by default and fires moderation actions', () => {
    const onResolve = vi.fn();
    const onClose = vi.fn();
    const onBan = vi.fn();

    render(
      <ReportsTab
        reports={reports}
        onResolve={onResolve}
        onClose={onClose}
        onBan={onBan}
        haptics={haptics}
      />
    );

    expect(screen.getByText('reported')).toBeInTheDocument();
    expect(screen.queryByText('mira')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    fireEvent.click(screen.getByRole('button', { name: /ban user/i }));

    expect(onResolve).toHaveBeenCalledWith(10);
    expect(onClose).toHaveBeenCalledWith(10);
    expect(onBan).toHaveBeenCalledWith(77, 10);
  });

  it('filters reports by status', () => {
    render(
      <ReportsTab
        reports={reports}
        onResolve={vi.fn()}
        onClose={vi.fn()}
        onBan={vi.fn()}
        haptics={haptics}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /resolved/i }));

    expect(screen.getByText('mira')).toBeInTheDocument();
    expect(screen.queryByText('reported')).not.toBeInTheDocument();
  });
});
