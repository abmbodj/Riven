import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Decks from './Decks.jsx';

vi.mock('../api', () => ({
  api: {
    getDecks: vi.fn(),
    getFolders: vi.fn(),
    getTags: vi.fn(),
    getClasses: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../components/GlobalMessages', () => ({
  default: () => null,
}));

vi.mock('../components/OnboardingArt', () => ({
  default: () => <div data-testid="onboarding-art" />,
}));

const { api } = await import('../api');

describe('Decks desktop workspace', () => {
  it('shows a filter rail and default preview panel for the selected deck', async () => {
    localStorage.setItem('riven_onboarded', 'true');
    window.innerWidth = 1440;
    window.dispatchEvent(new Event('resize'));

    api.getDecks.mockResolvedValue([
      {
        id: 7,
        title: 'Biology Review',
        description: 'Cell respiration and mitosis',
        cardCount: 24,
        created_at: new Date().toISOString(),
        folder_id: 3,
        class_id: 11,
        tags: [{ id: 41, name: 'Exam', color: '#ef4444' }],
      },
      {
        id: 8,
        title: 'Chemistry Quiz',
        description: 'Periodic table drill',
        cardCount: 12,
        created_at: new Date().toISOString(),
        folder_id: null,
        class_id: null,
        tags: [],
      },
    ]);
    api.getFolders.mockResolvedValue([
      { id: 3, name: 'Science', color: '#22c55e' },
    ]);
    api.getTags.mockResolvedValue([
      { id: 41, name: 'Exam', color: '#ef4444' },
    ]);
    api.getClasses.mockResolvedValue([
      { id: 11, name: 'Biology', color: '#7a9e72' },
    ]);

    render(
      <MemoryRouter>
        <Decks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open Deck')).toBeInTheDocument();
    });

    expect(screen.getByText('Deck Preview')).toBeInTheDocument();
    expect(screen.getByText('Library Filters')).toBeInTheDocument();
    expect(screen.getAllByText('Biology Review').length).toBeGreaterThan(0);
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('Open Deck')).toBeInTheDocument();
  });
});
