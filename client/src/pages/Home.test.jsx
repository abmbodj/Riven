import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Home from './Home.jsx';

vi.mock('../api', () => ({
  api: {
    getAssignments: vi.fn(),
    getDecks: vi.fn(),
    getClasses: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: true,
    loading: false,
    user: { username: 'Avery' },
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    show: vi.fn(),
  }),
}));

vi.mock('../hooks/useStreak', () => ({
  useStreak: () => ({
    currentStreak: 5,
    status: 'active',
  }),
}));

vi.mock('../hooks/useGSAP', () => ({
  useGSAP: vi.fn(),
}));

vi.mock('../components/Garden', () => ({
  default: () => <div data-testid="garden-preview" />,
}));

vi.mock('../components/ui/HeartsDisplay', () => ({
  default: () => <button type="button">Hearts</button>,
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

describe('DashboardHome', () => {
  it('surfaces productivity-first actions for resuming work', async () => {
    api.getAssignments.mockResolvedValue([
      {
        id: 1,
        title: 'Biology quiz',
        class_id: 11,
        status: 'Todo',
        due_date: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);
    api.getDecks.mockResolvedValue([
      {
        id: 7,
        title: 'Cell Respiration',
        created_at: new Date().toISOString(),
      },
    ]);
    api.getClasses.mockResolvedValue([
      {
        id: 11,
        name: 'Biology',
        color: '#7a9e72',
      },
    ]);

    render(
      <MemoryRouter>
        <Home mode="dashboard" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Today Queue')).toBeInTheDocument();
    });

    expect(screen.getByText('Work the next useful thing, not the loudest thing.')).toBeInTheDocument();
    expect(screen.getByText('Study Cell Respiration')).toBeInTheDocument();
    expect(screen.getByText('Review class plan')).toBeInTheDocument();
    expect(screen.getByText('Check your circle')).toBeInTheDocument();
    expect(screen.getByText('Plan Classes')).toBeInTheDocument();
    expect(screen.getByText('Open Social')).toBeInTheDocument();
  });
});
