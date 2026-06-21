import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExamsLibrary from './ExamsLibrary.jsx';

vi.mock('motion/react', () => {
  const createMotionComponent = (tag) =>
    React.forwardRef(
      ({
        children,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        whileInView: _whileInView,
        whileHover: _whileHover,
        viewport: _viewport,
        ...props
      }, ref) => React.createElement(tag, { ...props, ref }, children)
    );

  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: new Proxy(
      {},
      {
        get: (_, tag) => createMotionComponent(tag),
      }
    ),
  };
});

vi.mock('../api', () => ({
  api: {
    getMockExams: vi.fn(),
    getNotes: vi.fn(),
    getStudyGuides: vi.fn(),
    getClasses: vi.fn(),
    getExamInsights: vi.fn(),
    bulkDeleteMockExams: vi.fn(),
    deleteMockExam: vi.fn(),
    generateAiExam: vi.fn(),
    getExamBlueprints: vi.fn(),
    extractExamBlueprint: vi.fn(),
    deleteExamBlueprint: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../hooks/useSelection', () => ({
  useSelection: () => ({
    isSelectMode: false,
    selectedIds: new Set(),
    selectedCount: 0,
    isAllSelected: false,
    enterSelectMode: vi.fn(),
    exitSelectMode: vi.fn(),
    toggleSelect: vi.fn(),
    toggleSelectAll: vi.fn(),
  }),
}));

vi.mock('../components/ConfirmModal', () => ({
  default: ({ isOpen, title, message }) => (isOpen ? (
    <div>
      <div>{title}</div>
      <div>{message}</div>
    </div>
  ) : null),
}));

vi.mock('../components/BulkActionBar', () => ({
  default: () => null,
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

const baseInsights = {
  hubReady: true,
  minAttemptsRequired: 3,
  summary: {
    totalAttempts: 6,
    averageScore: 72,
    bestScore: 91,
    averagePaceSeconds: 78,
    trendDelta: 6,
  },
  persona: {
    key: 'deliberate-builder',
    label: 'Deliberate Builder',
    description: 'Your results are stable enough to sharpen with targeted practice.',
    evidence: ['72% average score', '+6 pt trend'],
    improvements: [
      'Add one fresh mock exam to pressure-test your next study block.',
      'Keep one full-length exam each week.',
    ],
  },
  habits: {
    retryRate: 0.33,
    strongestStudyDay: {
      day: 'Saturday',
      averageScore: 84,
      attempts: 2,
    },
    averageDurationMinutes: 24,
  },
  recentAttempts: [
    {
      id: 'attempt-1',
      examId: 'exam-1',
      completedAt: '2026-03-22T16:00:00.000Z',
      durationSeconds: 900,
      score: 8,
      total: 10,
      percentage: 80,
      title: 'Biology Practice Mock',
      classId: 'class-bio',
      examMode: 'standard',
    },
  ],
  recommendedActions: [
    {
      id: 'standard-action',
      kind: 'generate_standard',
      label: 'Build another Biology exam',
      description: 'Keep your signal clean with a new mock exam.',
      payload: {
        classId: 'class-bio',
        title: 'Biology Mock Exam',
      },
    },
  ],
  classOptions: [
    { id: 'class-bio', name: 'Biology', color: '#7a9e72', attemptCount: 4 },
    { id: 'class-chem', name: 'Chemistry', color: '#cf8f43', attemptCount: 2 },
  ],
};

const emptyInsights = {
  hubReady: false,
  minAttemptsRequired: 3,
  summary: {
    totalAttempts: 0,
    averageScore: null,
    bestScore: null,
    averagePaceSeconds: null,
    trendDelta: null,
  },
  persona: {
    key: 'getting-started',
    label: 'Getting Started',
    description: 'Start with one exam so the hub can learn your pattern.',
    evidence: [],
    improvements: [],
  },
  habits: {
    retryRate: 0,
    strongestStudyDay: null,
    averageDurationMinutes: null,
  },
  recentAttempts: [],
  recommendedActions: [
    {
      id: 'first-exam',
      kind: 'generate_standard',
      label: 'Generate your first mock exam',
      description: 'Start here.',
    },
  ],
  classOptions: [],
};

const renderLibrary = () =>
  render(
    <MemoryRouter>
      <ExamsLibrary />
    </MemoryRouter>
  );

describe('ExamsLibrary insights hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.getMockExams.mockResolvedValue([
      {
        id: 'exam-1',
        title: 'Biology Practice Mock',
        class_id: 'class-bio',
        created_at: '2026-03-20T12:00:00.000Z',
        questions: Array.from({ length: 10 }, (_, index) => ({ id: index, type: 'mcq' })),
        source_type: 'notes',
        exam_mode: 'standard',
      },
    ]);
    api.getNotes.mockResolvedValue([
      { id: 'note-1', title: 'Lecture Notes', class_id: 'class-bio', content: { content: [] } },
    ]);
    api.getStudyGuides.mockResolvedValue([
      { id: 'guide-1', title: 'Biology Review', class_id: 'class-bio', content: { content: [] } },
    ]);
    api.getClasses.mockResolvedValue([
      { id: 'class-bio', name: 'Biology', color: '#7a9e72', subject: 'Biology' },
      { id: 'class-chem', name: 'Chemistry', color: '#cf8f43', subject: 'Chemistry' },
    ]);
    api.getExamInsights.mockResolvedValue(baseInsights);
    api.getExamBlueprints.mockResolvedValue([]);
  });

  it('defaults to the Insights tab on /exams', async () => {
    renderLibrary();

    expect(await screen.findByTestId('exam-insights-hub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /insights/i })).toBeInTheDocument();
  });

  it('switches between Insights and Exams tabs', async () => {
    renderLibrary();

    expect(await screen.findByText('Deliberate Builder')).toBeInTheDocument();
    expect(screen.queryByLabelText(/enter selection mode/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /exams \(1\)/i }));
    expect(await screen.findByLabelText(/enter selection mode/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /insights/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/enter selection mode/i)).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Deliberate Builder')).toBeInTheDocument();
  });

  it('opens the generate modal from the empty-state CTA', async () => {
    api.getMockExams.mockResolvedValue([]);
    api.getExamInsights.mockResolvedValue(emptyInsights);

    renderLibrary();

    expect(await screen.findByText(/learn your exam pattern/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate your first mock exam/i }));
    });

    expect(screen.getByText('Generate Mock Exam')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /note/i }).length).toBeGreaterThan(0);
  });

  it('does not render class filter chips on the insights hub', async () => {
    renderLibrary();

    expect(await screen.findByTestId('exam-insights-hub')).toBeInTheDocument();
    expect(screen.queryByTestId('exam-class-filters')).not.toBeInTheDocument();
    expect(api.getExamInsights).toHaveBeenCalledWith();
  });

  it('shows collecting progress when the hub is not ready yet', async () => {
    api.getExamInsights.mockResolvedValue({
      ...emptyInsights,
      summary: { ...emptyInsights.summary, totalAttempts: 2 },
      persona: {
        ...emptyInsights.persona,
        description: 'Complete 1 more mock exam to unlock persona, pace, and trend insights.',
      },
      recentAttempts: [
        {
          id: 'attempt-1',
          examId: 'exam-1',
          completedAt: '2026-03-22T16:00:00.000Z',
          score: 7,
          total: 10,
          percentage: 70,
          title: 'Biology Practice Mock',
        },
      ],
      recommendedActions: [
        {
          id: 'next-mock',
          kind: 'generate_standard',
          label: 'Take another timed mock',
          description: 'One more exam unlocks your full profile.',
        },
      ],
    });

    renderLibrary();

    expect(await screen.findByText(/building your exam profile/i)).toBeInTheDocument();
    expect(screen.getByTestId('hub-collecting-progress')).toHaveTextContent('2 of 3 mock exams completed');
    expect(screen.queryByText('Deliberate Builder')).not.toBeInTheDocument();
  });

  it('renders persona copy and summary cards from mocked insight data', async () => {
    renderLibrary();

    const hub = await screen.findByTestId('exam-insights-hub');
    const nextSteps = within(hub).getByTestId('exam-next-steps');

    expect(within(hub).getByText('Deliberate Builder')).toBeInTheDocument();
    expect(within(hub).getByText('6')).toBeInTheDocument();
    expect(within(hub).getByText('72%')).toBeInTheDocument();
    expect(within(hub).getByText('91%')).toBeInTheDocument();
    expect(within(nextSteps).getByText('Use Biology Practice Mock as a checkpoint')).toBeInTheDocument();
    expect(within(nextSteps).getByText('Keep the streak measured')).toBeInTheDocument();
    expect(within(hub).getByText('Build another Biology exam')).toBeInTheDocument();
    expect(within(hub).queryByText(/cell signaling/i)).not.toBeInTheDocument();
  });

  it('explains that deleting an exam keeps completed attempts in insights', async () => {
    renderLibrary();

    expect(await screen.findByText('Biology Practice Mock')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /exams \(1\)/i }));
    expect(await screen.findByLabelText(/enter selection mode/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button').find((button) =>
      button.querySelector('.lucide-trash2')));

    expect(await screen.findByText('Delete exam?')).toBeInTheDocument();
    expect(screen.getByText('This removes the mock exam from your library. Completed attempts stay in Insights Hub.')).toBeInTheDocument();
  });
});
