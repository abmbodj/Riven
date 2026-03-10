import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Classes from './Classes.jsx';

vi.mock('../api', () => ({
  api: {
    getClasses: vi.fn(),
    getSchedule: vi.fn(),
    getCanvasSettings: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { subscription_tier: 'free' },
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../hooks/useHaptics', () => ({
  default: () => ({
    light: vi.fn(),
    medium: vi.fn(),
  }),
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

describe('Classes desktop roster workspace', () => {
  it('shows a default class preview while keeping the roster visible', async () => {
    window.innerWidth = 1440;
    window.dispatchEvent(new Event('resize'));

    api.getClasses.mockResolvedValue([
      {
        id: 'class-1',
        name: 'Biology',
        color: '#7a9e72',
        professor: 'Dr. Rivera',
        room: 'Lab 204',
        zoom_link: '',
        is_archived: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'class-2',
        name: 'Philosophy',
        color: '#b8a379',
        professor: 'Prof. Hale',
        room: 'Hall 3',
        zoom_link: '',
        is_archived: true,
        created_at: new Date().toISOString(),
      },
    ]);
    api.getSchedule.mockResolvedValue([
      {
        id: 'slot-1',
        class_id: 'class-1',
        day_of_week: 2,
        start_time: '09:00:00',
        end_time: '10:15:00',
      },
    ]);
    api.getCanvasSettings.mockResolvedValue({
      isConnected: false,
      canvasUrl: '',
    });

    render(
      <MemoryRouter>
        <Classes />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open Class')).toBeInTheDocument();
    });

    expect(screen.getByText('Class Preview')).toBeInTheDocument();
    expect(screen.getAllByText('Biology').length).toBeGreaterThan(0);
    expect(screen.getByText('Past Courses')).toBeInTheDocument();
    expect(screen.getAllByText('Dr. Rivera').length).toBeGreaterThan(0);
  });
});
