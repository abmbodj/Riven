import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './Home.jsx';

const toastApi = {
  error: vi.fn(),
  success: vi.fn(),
  show: vi.fn(),
};

vi.mock('../api', () => ({
  api: {
    getAssignments: vi.fn(),
    getDecks: vi.fn(),
    getClasses: vi.fn(),
    getNotes: vi.fn(),
    getStudyGuides: vi.fn(),
    getStudyCoach: vi.fn(),
    getMockExams: vi.fn(),
    getWeeklySummary: vi.fn(),
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
  useToast: () => toastApi,
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

const { api } = await import('../api');
const { scheduleAssignmentNotifications } = await import('../utils/notifications');

const FIXED_NOW = new Date('2026-03-21T12:00:00.000Z');

const weeklySummary = {
  cards_studied: 47,
  accuracy: 0.82,
  total_minutes: 138,
  daily_breakdown: [
    { date: '2026-03-15', day: 'Sun', cards: 4, minutes: 10, studied: true, is_today: false },
    { date: '2026-03-16', day: 'Mon', cards: 6, minutes: 18, studied: true, is_today: false },
    { date: '2026-03-17', day: 'Tue', cards: 8, minutes: 20, studied: true, is_today: false },
    { date: '2026-03-18', day: 'Wed', cards: 10, minutes: 26, studied: true, is_today: false },
    { date: '2026-03-19', day: 'Thu', cards: 7, minutes: 21, studied: true, is_today: false },
    { date: '2026-03-20', day: 'Fri', cards: 5, minutes: 16, studied: true, is_today: false },
    { date: '2026-03-21', day: 'Sat', cards: 7, minutes: 27, studied: true, is_today: true },
  ],
};

let consoleErrorSpy;

function mockReducedMotion() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
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

describe('DashboardHome analytics repositioning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    vi.clearAllMocks();
    mockReducedMotion();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    api.getAssignments.mockResolvedValue([]);
    api.getDecks.mockResolvedValue([]);
    api.getClasses.mockResolvedValue([]);
    api.getNotes.mockResolvedValue([]);
    api.getStudyGuides.mockResolvedValue([]);
    api.getStudyCoach.mockResolvedValue({
      recommendation: null,
      weakTopics: [],
      upcomingExam: null,
      stats: { xpTotal: 0, level: 1 },
      suggestedGuide: null,
    });
    api.getMockExams.mockResolvedValue([]);
    api.getWeeklySummary.mockResolvedValue(weeklySummary);
    api.updateAssignment.mockResolvedValue({});
    toastApi.error.mockReset();
    toastApi.success.mockReset();
    toastApi.show.mockReset();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    vi.useRealTimers();
  });

  it('surfaces the new streak activity, weekly summary, and strict priority items on the dashboard', async () => {
    api.getAssignments.mockResolvedValue([
      {
        id: 1,
        title: 'Overdue assignment',
        class_id: 11,
        status: 'Todo',
        due_date: '2026-03-19T12:00:00.000Z',
      },
      {
        id: 2,
        title: 'Due today reading',
        class_id: 11,
        status: 'Doing',
        due_date: '2026-03-21T18:00:00.000Z',
      },
      {
        id: 3,
        title: 'Due tomorrow lab',
        class_id: 12,
        status: 'Todo',
        due_date: '2026-03-22T09:00:00.000Z',
      },
      {
        id: 4,
        title: 'Later this week',
        class_id: 12,
        status: 'Todo',
        due_date: '2026-03-24T09:00:00.000Z',
      },
    ]);

    api.getClasses.mockResolvedValue([
      { id: 11, name: 'Biology', color: '#7a9e72' },
      { id: 12, name: 'History', color: '#cf8f43' },
    ]);

    api.getDecks.mockResolvedValue([
      { id: 51, title: 'Cell Biology', created_at: '2026-03-10T12:00:00.000Z', last_studied: '2026-03-20T12:00:00.000Z', cardCount: 24 },
    ]);

    api.getNotes.mockResolvedValue([
      { id: 81, title: 'Lecture Notes', updated_at: '2026-03-20T10:00:00.000Z', class_id: 11 },
    ]);

    await renderDashboard();

    expect(screen.getByTestId('streak-activity-card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /how it's going/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /what needs you/i })).toBeInTheDocument();

    expect(screen.getByText('Overdue assignment')).toBeInTheDocument();
    expect(screen.getByText('Due today reading')).toBeInTheDocument();
    expect(screen.getByText('Due tomorrow lab')).toBeInTheDocument();
    expect(screen.queryByText('Later this week')).not.toBeInTheDocument();

    expect(within(screen.getByTestId('weekly-summary')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByTestId('weekly-summary')).getByText('Due This Week')).toBeInTheDocument();
    expect(api.getWeeklySummary).toHaveBeenCalledTimes(1);
  });

  it('shows the study coach module with cram urgency, xp, and one-tap guide suggestions', async () => {
    api.getStudyCoach.mockResolvedValue({
      recommendation: {
        label: 'Review Weak Topics',
        detail: '3 weak topics · ~12 min',
        guideTitle: 'Biology Recall Workbook',
      },
      weakTopics: [
        { id: 'osmosis', title: 'Osmosis' },
        { id: 'diffusion', title: 'Diffusion' },
        { id: 'transport', title: 'Active Transport' },
      ],
      upcomingExam: {
        title: 'Biology Midterm',
        dueAt: '2026-03-23T14:00:00.000Z',
        countdownLabel: 'in 2 days',
      },
      stats: { xpTotal: 240, level: 4 },
      suggestedGuide: {
        className: 'Biology',
        label: 'Generate study coach',
      },
    });

    await renderDashboard();

    const coachCard = screen.getByTestId('study-coach-card');
    expect(within(coachCard).getByText(/study coach/i)).toBeInTheDocument();
    expect(within(coachCard).getByText('Biology Midterm')).toBeInTheDocument();
    expect(within(coachCard).getByText('Review Weak Topics')).toBeInTheDocument();
    expect(within(coachCard).getAllByText(/240 xp/i).length).toBeGreaterThan(0);
    expect(within(coachCard).getByText(/generate study coach/i)).toBeInTheDocument();
  });

  it('renders XP and level progress even without an active recommendation', async () => {
    api.getStudyCoach.mockResolvedValue({
      recommendation: null,
      weakTopics: [],
      upcomingExam: null,
      stats: { xpTotal: 240, level: 3, sessionsCompleted: 2 },
      suggestedGuide: null,
    });

    await renderDashboard();

    const coachCard = screen.getByTestId('study-coach-card');
    expect(within(coachCard).getByText(/240 xp/i)).toBeInTheDocument();
    expect(within(coachCard).getByText(/level 3/i)).toBeInTheDocument();
    expect(within(coachCard).getByText(/xp to next level/i)).toBeInTheDocument();
  });

  it('expands the strict priority list inline and orders urgency correctly', async () => {
    api.getAssignments.mockResolvedValue([
      { id: 1, title: 'Essay draft', class_id: 11, status: 'Todo', due_date: '2026-03-18T12:00:00.000Z' },
      { id: 2, title: 'Lab correction', class_id: 11, status: 'Todo', due_date: '2026-03-20T12:00:00.000Z' },
      { id: 3, title: 'Quiz review', class_id: 11, status: 'Todo', due_date: '2026-03-21T09:00:00.000Z' },
      { id: 4, title: 'Reading notes', class_id: 11, status: 'Todo', due_date: '2026-03-21T18:00:00.000Z' },
      { id: 5, title: 'Practice sheet', class_id: 11, status: 'Todo', due_date: '2026-03-22T08:00:00.000Z' },
      { id: 6, title: 'Discussion prep', class_id: 11, status: 'Todo', due_date: '2026-03-22T19:00:00.000Z' },
      { id: 7, title: 'Future next week', class_id: 11, status: 'Todo', due_date: '2026-03-26T12:00:00.000Z' },
    ]);

    api.getClasses.mockResolvedValue([
      { id: 11, name: 'Biology', color: '#7a9e72' },
    ]);

    await renderDashboard();

    const priorityItems = screen.getByTestId('priority-items');

    expect(within(priorityItems).getByText('Essay draft')).toBeInTheDocument();
    expect(within(priorityItems).getByText('Practice sheet')).toBeInTheDocument();
    expect(within(priorityItems).queryByText('Discussion prep')).not.toBeInTheDocument();
    expect(within(priorityItems).queryByText('Future next week')).not.toBeInTheDocument();

    const overdueThree = within(priorityItems).getByText('Essay draft');
    const overdueOne = within(priorityItems).getByText('Lab correction');
    const dueTodayMorning = within(priorityItems).getByText('Quiz review');
    expect(
      overdueThree.compareDocumentPosition(overdueOne) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      overdueOne.compareDocumentPosition(dueTodayMorning) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(within(priorityItems).getByRole('button', { name: /show all \(6\)/i }));
    expect(within(priorityItems).getByText('Discussion prep')).toBeInTheDocument();
    expect(within(priorityItems).getByRole('button', { name: /show fewer/i })).toBeInTheDocument();
  });

  it('marks a priority assignment complete from the dashboard and refreshes derived state immediately', async () => {
    api.getAssignments.mockResolvedValue([
      { id: 1, title: 'Essay draft', class_id: 11, status: 'Todo', due_date: '2026-03-18T12:00:00.000Z' },
      { id: 2, title: 'Quiz review', class_id: 11, status: 'Todo', due_date: '2026-03-21T09:00:00.000Z' },
    ]);
    api.getClasses.mockResolvedValue([
      { id: 11, name: 'Biology', color: '#7a9e72' },
    ]);

    await renderDashboard();

    const priorityItems = screen.getByTestId('priority-items');
    await act(async () => {
      fireEvent.click(within(priorityItems).getByRole('button', { name: /mark essay draft complete/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateAssignment).toHaveBeenCalledWith(1, { status: 'Done' });
    expect(within(priorityItems).queryByText('Essay draft')).not.toBeInTheDocument();
    expect(within(priorityItems).getByText('Quiz review')).toBeInTheDocument();
    expect(screen.queryByText(/time to catch up/i)).not.toBeInTheDocument();
    expect(toastApi.success).toHaveBeenCalledWith('Assignment completed');
    expect(scheduleAssignmentNotifications).toHaveBeenCalled();
  });

  it('restores the priority item when completion fails', async () => {
    api.getAssignments.mockResolvedValue([
      { id: 1, title: 'Essay draft', class_id: 11, status: 'Todo', due_date: '2026-03-18T12:00:00.000Z' },
    ]);
    api.getClasses.mockResolvedValue([
      { id: 11, name: 'Biology', color: '#7a9e72' },
    ]);
    api.updateAssignment.mockRejectedValueOnce(new Error('boom'));

    await renderDashboard();

    const priorityItems = screen.getByTestId('priority-items');
    await act(async () => {
      fireEvent.click(within(priorityItems).getByRole('button', { name: /mark essay draft complete/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(within(priorityItems).getByText('Essay draft')).toBeInTheDocument();
    expect(toastApi.error).toHaveBeenCalledWith('Failed to mark assignment complete');
  });
});
