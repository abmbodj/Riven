import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import GlobalCommandPalette from './GlobalCommandPalette.jsx';

vi.mock('../api', () => ({
  api: {
    getDecks: vi.fn(),
    getClasses: vi.fn(),
    getFriends: vi.fn(),
    getGroups: vi.fn(),
  },
}));

const { api } = await import('../api');

describe('GlobalCommandPalette', () => {
  it('surfaces cross-workspace actions and filters live results', async () => {
    api.getDecks.mockResolvedValue([
      { id: 7, title: 'Biology Review' },
    ]);
    api.getClasses.mockResolvedValue([
      { id: 11, name: 'Biology' },
    ]);
    api.getFriends.mockResolvedValue([
      { id: 21, username: 'Bianca' },
    ]);
    api.getGroups.mockResolvedValue([
      { id: 31, name: 'Bio Study Group' },
    ]);

    render(
      <MemoryRouter>
        <GlobalCommandPalette isOpen={true} isLoggedIn={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Biology Review')).toBeInTheDocument();
    });

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Create Note')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search current Riven...'), {
      target: { value: 'bianca' },
    });

    expect(screen.getByText('Bianca')).toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });
});
