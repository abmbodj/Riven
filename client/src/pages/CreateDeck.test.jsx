import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CreateDeck from './CreateDeck.jsx';

vi.mock('../api', () => ({
  api: {
    getFolders: vi.fn(),
    getClasses: vi.fn(),
    getTags: vi.fn(),
    getAILimits: vi.fn(),
    warmupAiFunctions: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

describe('CreateDeck guided flow', () => {
  it('opens folder picker as a sheet and applies the selected folder', async () => {
    api.getFolders.mockResolvedValue([
      { id: 3, name: 'Science', color: '#22c55e' },
    ]);
    api.getClasses.mockResolvedValue([
      { id: 7, name: 'Biology', color: '#7a9e72' },
    ]);
    api.getTags.mockResolvedValue([]);
    api.getAILimits.mockResolvedValue({ remaining: 5, max: 5 });

    render(
      <MemoryRouter>
        <CreateDeck />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Deck Setup')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /folder/i }));

    await waitFor(() => {
      expect(screen.getByText('Choose Folder')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /science/i }));

    expect(screen.getAllByText('Science').length).toBeGreaterThan(0);
  });
  it('lets a user name and generate an AI deck without switching modes', async () => {
    api.getFolders.mockResolvedValue([]);
    api.getClasses.mockResolvedValue([]);
    api.getTags.mockResolvedValue([]);
    api.getAILimits.mockResolvedValue({ remaining: 5, max: 5 });
    render(<MemoryRouter><CreateDeck /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /generate from notes/i }));
    await screen.findByPlaceholderText(/paste your notes/i);
    fireEvent.change(screen.getByPlaceholderText('Deck name'), { target: { value: 'Biology' } });
    fireEvent.change(screen.getByPlaceholderText(/paste your notes/i), { target: { value: 'Photosynthesis converts light to chemical energy.' } });
    expect(screen.getByRole('button', { name: /generate flashcards/i })).toBeEnabled();
  });

});
