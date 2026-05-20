import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Classes from './Classes.jsx';

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    getClasses: vi.fn(),
    getSchedule: vi.fn(),
    getCanvasSettings: vi.fn(),
    deleteClass: vi.fn(),
    previewCanvasSemesterCleanup: vi.fn(),
    archiveCanvasSemesterClasses: vi.fn(),
    getAssignments: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      subscription_tier: 'supporter',
    },
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => mockToast,
}));

vi.mock('../hooks/useHaptics', () => ({
  default: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

vi.mock('../utils/notifications', () => ({
  scheduleAssignmentNotifications: vi.fn().mockResolvedValue(undefined),
}));

const { api } = await import('../api');

const classRows = [
  {
    id: 'class-1',
    name: 'Biology',
    color: '#7a9e72',
    professor: 'Dr. Stone',
    created_at: '2026-04-13T12:00:00.000Z',
    is_archived: false,
  },
  {
    id: 'class-2',
    name: 'Literature',
    color: '#ec4899',
    professor: 'Prof. Vale',
    created_at: '2026-04-12T12:00:00.000Z',
    is_archived: false,
  },
];

const renderClasses = () => render(
  <MemoryRouter>
    <Classes />
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  api.getClasses.mockResolvedValue(classRows);
  api.getSchedule.mockResolvedValue([]);
  api.getCanvasSettings.mockResolvedValue({
    isConnected: false,
    canvasUrl: '',
    autoSyncEnabled: false,
    lastSyncAt: null,
    lastAutoSyncError: '',
  });
  api.deleteClass.mockResolvedValue({ message: 'Class deleted' });
  api.previewCanvasSemesterCleanup.mockResolvedValue({
    classes: [],
    suggestedClassIds: [],
  });
  api.archiveCanvasSemesterClasses.mockResolvedValue({
    classesArchived: 0,
    assignmentsArchived: 0,
  });
  api.getAssignments.mockResolvedValue([]);
});

describe('Classes page actions', () => {
  it('shows the End Semester action when active classes exist and opens cleanup preview for manual classes', async () => {
    api.previewCanvasSemesterCleanup.mockResolvedValue({
      classes: [
        {
          id: 'class-1',
          name: 'Biology',
          activeAssignmentCount: 2,
          totalAssignmentCount: 3,
        },
        {
          id: 'class-2',
          name: 'Literature',
          activeAssignmentCount: 1,
          totalAssignmentCount: 1,
        },
      ],
      suggestedClassIds: ['class-1', 'class-2'],
    });

    renderClasses();

    expect(await screen.findByText('Biology')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /end semester/i }));

    await waitFor(() => {
      expect(api.previewCanvasSemesterCleanup).toHaveBeenCalled();
    });
    const dialog = await screen.findByRole('dialog', { name: /end semester/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Literature')).toBeInTheDocument();
  });

  it('hides the End Semester action when there are no active classes', async () => {
    api.getClasses.mockResolvedValue([
      {
        id: 'archived-class',
        name: 'History',
        color: '#7a9e72',
        created_at: '2026-04-13T12:00:00.000Z',
        is_archived: true,
      },
    ]);

    renderClasses();

    expect(await screen.findByText('History')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end semester/i })).not.toBeInTheDocument();
  });

  it('bulk-selects classes and deletes the selected classes', async () => {
    renderClasses();

    expect(await screen.findByText('Biology')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enter selection mode/i }));
    fireEvent.click(screen.getByRole('button', { name: /Biology/i }));
    fireEvent.click(screen.getByRole('button', { name: /Literature/i }));

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete all/i }));

    await waitFor(() => {
      expect(api.deleteClass).toHaveBeenCalledWith('class-1');
      expect(api.deleteClass).toHaveBeenCalledWith('class-2');
    });
  });
});
