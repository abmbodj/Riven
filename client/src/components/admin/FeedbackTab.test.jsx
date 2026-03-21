import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FeedbackTab from './FeedbackTab.jsx';

const haptics = {
  light: vi.fn(),
  medium: vi.fn(),
};

describe('FeedbackTab', () => {
  it('renders feedback metadata and owner actions', () => {
    const onToggleFavorite = vi.fn();
    const onDelete = vi.fn();
    const onThank = vi.fn();

    render(
      <FeedbackTab
        feedback={[
          {
            id: 11,
            username: 'bianca',
            content: 'Please add a way to favorite suggestions in admin.',
            isFavorited: false,
            createdAt: '2026-03-21T14:00:00.000Z',
            consideringNotifiedAt: null,
            consideringByName: null,
          },
        ]}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
        onThank={onThank}
        haptics={haptics}
      />
    );

    expect(screen.getByText('bianca')).toBeInTheDocument();
    expect(screen.getByText(/please add a way to favorite suggestions/i)).toBeInTheDocument();
    expect(screen.getByText(/submitted/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /favorite/i }));
    fireEvent.click(screen.getByRole('button', { name: /thank user/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(onToggleFavorite).toHaveBeenCalledWith(11, true);
    expect(onThank).toHaveBeenCalledWith(11);
    expect(onDelete).toHaveBeenCalledWith(11);
  });

  it('locks the thank action once feedback was already acknowledged', () => {
    render(
      <FeedbackTab
        feedback={[
          {
            id: 15,
            username: 'kai',
            content: 'A themed admin inbox would be nice.',
            isFavorited: true,
            createdAt: '2026-03-21T14:00:00.000Z',
            consideringNotifiedAt: '2026-03-21T16:00:00.000Z',
            consideringByName: 'owner',
          },
        ]}
        onToggleFavorite={vi.fn()}
        onDelete={vi.fn()}
        onThank={vi.fn()}
        haptics={haptics}
      />
    );

    expect(screen.getByText(/considering/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thanked/i })).toBeDisabled();
  });
});
