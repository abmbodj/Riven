import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DeckView from './DeckView.jsx';

vi.mock('../api', () => ({
  api: {
    getDeck: vi.fn(),
    getFolders: vi.fn(),
    getClasses: vi.fn(),
    getTags: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: true,
  }),
}));

vi.mock('../components/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('../components/AlertModal', () => ({
  default: () => null,
}));

vi.mock('../components/CardImageUpload', () => ({
  default: () => null,
}));

const { api } = await import('../api');

describe('DeckView workspace', () => {
  it('surfaces deck workbench context with cards and utility rail', async () => {
    api.getDeck.mockResolvedValue({
      id: 'deck-42',
      title: 'Cell Respiration',
      description: 'The core pathways and definitions.',
      folder_id: 'folder-1',
      class_id: 'class-1',
      tags: [{ id: 'tag-1', name: 'exam', color: '#7a9e72' }],
      cards: [
        { id: 'card-1', front: 'ATP', back: 'Cell energy currency' },
      ],
    });
    api.getFolders.mockResolvedValue([
      { id: 'folder-1', name: 'Midterm', color: '#deb96a' },
    ]);
    api.getClasses.mockResolvedValue([
      { id: 'class-1', name: 'Biology', color: '#7a9e72' },
    ]);
    api.getTags.mockResolvedValue([
      { id: 'tag-1', name: 'exam', color: '#7a9e72' },
    ]);

    render(
      <MemoryRouter initialEntries={['/deck/deck-42']}>
        <Routes>
          <Route path="/deck/:id" element={<DeckView />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Deck Workbench')).toBeInTheDocument();
    });

    expect(screen.getByText('Study paths and card editing stay in one place.')).toBeInTheDocument();
    expect(screen.getByText('Deck Context')).toBeInTheDocument();
    expect(screen.getByText('Deck Tools')).toBeInTheDocument();
    expect(screen.getByText('Cell Respiration')).toBeInTheDocument();
    expect(screen.getAllByText('Biology').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Midterm').length).toBeGreaterThan(0);
    expect(screen.getByText('ATP')).toBeInTheDocument();
  });
});
