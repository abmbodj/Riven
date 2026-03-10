import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ClassView from './ClassView.jsx';

vi.mock('../api', () => ({
  api: {
    getClasses: vi.fn(),
    getAssignments: vi.fn(),
    getDecks: vi.fn(),
    getSchedule: vi.fn(),
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

vi.mock('../components/ConfirmModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

describe('ClassView workspace', () => {
  it('surfaces class workbench context with assignments and side rail tools', async () => {
    api.getClasses.mockResolvedValue([
      {
        id: 'class-42',
        name: 'Biology',
        color: '#7a9e72',
        professor: 'Dr. Stone',
        room: 'Lab 201',
      },
    ]);
    api.getAssignments.mockResolvedValue([
      {
        id: 'assign-1',
        title: 'Lab write-up',
        description: 'Summarize the microscope observations.',
        due_date: '2026-03-12T13:00:00.000Z',
        status: 'Todo',
        type: 'project',
      },
    ]);
    api.getDecks.mockResolvedValue([
      {
        id: 'deck-1',
        class_id: 'class-42',
        title: 'Cell Respiration',
        cardCount: 24,
      },
    ]);
    api.getSchedule.mockResolvedValue([
      {
        id: 'slot-1',
        class_id: 'class-42',
        day_of_week: 2,
        start_time: '09:00',
        end_time: '10:15',
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/class/class-42']}>
        <Routes>
          <Route path="/class/:id" element={<ClassView />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Class Workbench')).toBeInTheDocument();
    });

    expect(screen.getByText('Next priority is already in view.')).toBeInTheDocument();
    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Class Times').length).toBeGreaterThan(0);
    expect(screen.getByText('Study Decks')).toBeInTheDocument();
    expect(screen.getByText('Lab write-up')).toBeInTheDocument();
    expect(screen.getByText('Cell Respiration')).toBeInTheDocument();
    expect(screen.getByText('Next on deck')).toBeInTheDocument();
  });
});
