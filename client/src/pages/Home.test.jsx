import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './Home.jsx';

vi.mock('../api', () => ({
  api: {
    getAssignments: vi.fn(),
    getDecks: vi.fn(),
    getClasses: vi.fn(),
    getNotes: vi.fn(),
    getStudyGuides: vi.fn(),
    getMockExams: vi.fn(),
    updateAssignment: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: true,
    loading: false,
    user: { username: 'Avery', subscription_tier: 'free' },
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

vi.mock('../components/ui/GardenLanding', () => ({
  default: () => <div data-testid="garden-preview" />,
}));

vi.mock('../components/ui/AIGenDisplay', () => ({
  default: () => <div data-testid="ai-gen-display" />,
}));

vi.mock('../components/ui/HeartsDisplay', () => ({
  default: () => <button type="button">Hearts</button>,
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

vi.mock('../utils/notifications', () => ({
  scheduleAssignmentNotifications: vi.fn(),
}));

vi.mock('motion/react', () => ({
  motion: {
    article: ({ children, layout, initial, animate, exit, whileTap, ...props }) => (
      <article {...props}>{children}</article>
    ),
    button: ({ children, layout, initial, animate, exit, whileTap, ...props }) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

const { api } = await import('../api');

const FIXED_NOW = new Date('2026-03-21T12:00:00.000Z');

function getSectionPanel(name) {
  const heading = screen.getByRole('heading', { name });
  const panel = heading.parentElement?.nextElementSibling;
  expect(panel).not.toBeNull();
  return within(panel);
}

async function renderDashboard() {
  render(
    <MemoryRouter>
      <Home mode="dashboard" />
    </MemoryRouter>
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('DashboardHome', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    vi.clearAllMocks();

    api.getAssignments.mockResolvedValue([]);
    api.getDecks.mockResolvedValue([]);
    api.getClasses.mockResolvedValue([]);
    api.getNotes.mockResolvedValue([]);
    api.getStudyGuides.mockResolvedValue([]);
    api.getMockExams.mockResolvedValue([]);
    api.updateAssignment.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a 5-item Up Next preview with a show more toggle', async () => {
    api.getAssignments.mockResolvedValue([
      {
        id: 1,
        title: 'Overdue assignment',
        class_id: 11,
        status: 'Todo',
        due_date: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 2,
        title: 'Future assignment 1',
        class_id: 11,
        status: 'Todo',
        due_date: '2026-03-22T12:00:00.000Z',
      },
      {
        id: 3,
        title: 'Future assignment 2',
        class_id: 12,
        status: 'Doing',
        due_date: '2026-03-23T12:00:00.000Z',
      },
      {
        id: 4,
        title: 'Future assignment 3',
        class_id: 11,
        status: 'Todo',
        due_date: '2026-03-24T12:00:00.000Z',
      },
      {
        id: 5,
        title: 'Future assignment 4',
        class_id: 12,
        status: 'Todo',
        due_date: '2026-03-25T12:00:00.000Z',
      },
      {
        id: 6,
        title: 'Future assignment 5',
        class_id: 11,
        status: 'Todo',
        due_date: '2026-03-26T12:00:00.000Z',
      },
      {
        id: 7,
        title: 'Future assignment 6',
        class_id: 12,
        status: 'Todo',
        due_date: '2026-03-31T12:00:00.000Z',
      },
      {
        id: 8,
        title: 'Archived assignment',
        class_id: 11,
        status: 'Archived',
        due_date: '2026-03-23T12:00:00.000Z',
      },
      {
        id: 9,
        title: 'Undated assignment',
        class_id: 12,
        status: 'Todo',
        due_date: null,
      },
    ]);

    api.getClasses.mockResolvedValue([
      {
        id: 11,
        name: 'Biology',
        color: '#7a9e72',
      },
      {
        id: 12,
        name: 'History',
        color: '#cf8f43',
      },
    ]);

    await renderDashboard();

    const upNextPanel = getSectionPanel(/up next/i);
    expect(upNextPanel.getByText('Future assignment 1')).toBeInTheDocument();
    expect(upNextPanel.getByText('Future assignment 5')).toBeInTheDocument();
    expect(upNextPanel.queryByText('Future assignment 6')).not.toBeInTheDocument();
    expect(upNextPanel.queryByText('Overdue assignment')).not.toBeInTheDocument();
    expect(upNextPanel.queryByText('Archived assignment')).not.toBeInTheDocument();
    expect(upNextPanel.queryByText('Undated assignment')).not.toBeInTheDocument();
    expect(upNextPanel.getByRole('button', { name: /\+1 more upcoming/i })).toBeInTheDocument();

    const pastDuePanel = getSectionPanel(/past due/i);
    expect(pastDuePanel.getByText('Overdue assignment')).toBeInTheDocument();
    expect(pastDuePanel.queryByText('Future assignment 1')).not.toBeInTheDocument();

    const firstFutureAssignment = upNextPanel.getByText('Future assignment 1');
    const fifthFutureAssignment = upNextPanel.getByText('Future assignment 5');
    expect(
      firstFutureAssignment.compareDocumentPosition(fifthFutureAssignment) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(upNextPanel.getByRole('button', { name: /\+1 more upcoming/i }));
    expect(upNextPanel.getByText('Future assignment 6')).toBeInTheDocument();
    expect(upNextPanel.getByRole('button', { name: /show less/i })).toBeInTheDocument();

    const expandedFifthAssignment = upNextPanel.getByText('Future assignment 5');
    const sixthFutureAssignment = upNextPanel.getByText('Future assignment 6');
    expect(
      expandedFifthAssignment.compareDocumentPosition(sixthFutureAssignment) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(upNextPanel.getByRole('button', { name: /show less/i }));
    expect(upNextPanel.queryByText('Future assignment 6')).not.toBeInTheDocument();
    expect(upNextPanel.getByRole('button', { name: /\+1 more upcoming/i })).toBeInTheDocument();

    expect(screen.getAllByText('Up Next').length).toBeGreaterThan(1);
  });

  it('shows the new empty-state copy when there are no upcoming assignments', async () => {
    api.getAssignments.mockResolvedValue([
      {
        id: 1,
        title: 'Overdue assignment',
        class_id: 11,
        status: 'Todo',
        due_date: '2026-03-20T12:00:00.000Z',
      },
    ]);

    api.getClasses.mockResolvedValue([
      {
        id: 11,
        name: 'Biology',
        color: '#7a9e72',
      },
    ]);

    await renderDashboard();

    const upNextPanel = getSectionPanel(/up next/i);
    expect(upNextPanel.getByText('Nothing coming up.')).toBeInTheDocument();
    expect(upNextPanel.getByText('No upcoming assignments.')).toBeInTheDocument();
  });
});
