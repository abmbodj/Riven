import React, { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExamView from './ExamView.jsx';

vi.mock('motion/react', () => {
  const createMotionComponent = (tag) =>
    React.forwardRef(
      ({ children, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)
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

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(),
    fromTo: vi.fn(),
  },
  ScrollTrigger: {},
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {},
}));

vi.mock('../api', () => ({
  api: {
    getMockExam: vi.fn(),
    createExamAttempt: vi.fn(),
    upsertTopicMastery: vi.fn(),
    gradeShortAnswer: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

const { api } = await import('../api');

describe('ExamView results layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.getMockExam.mockResolvedValue({
      id: 'exam-7',
      title: 'Cell Biology Final',
      class_id: 'class-22',
      questions: [
        {
          question: 'Which organelle produces ATP?',
          type: 'mcq',
          topic: 'Cell Organelles',
          difficulty: 'easy',
          options: ['Mitochondria', 'Nucleus', 'Golgi apparatus', 'Ribosome'],
          correct_answer: 'Mitochondria',
          explanation: 'ATP production primarily occurs in the mitochondria.',
        },
        {
          question: 'Which phase comes right after metaphase?',
          type: 'mcq',
          topic: 'Cell Cycle',
          difficulty: 'medium',
          options: ['Prophase', 'Anaphase', 'Telophase', 'Interphase'],
          correct_answer: 'Anaphase',
          explanation: 'Anaphase begins once sister chromatids separate.',
        },
      ],
    });
  });

  it('keeps results content internally scrollable and uses the desktop grid breakdown layout', async () => {
    render(
      <MemoryRouter initialEntries={['/exams/exam-7']}>
        <Routes>
          <Route path="/exams/:id" element={<ExamView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Which organelle produces ATP?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mitochondria/i }));
    expect(await screen.findByText('Which phase comes right after metaphase?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /anaphase/i }));

    expect(await screen.findByText('Topic Breakdown')).toBeInTheDocument();

    expect(screen.getByTestId('exam-results-scroll')).toHaveClass('overflow-y-auto');
    expect(screen.getByTestId('exam-results-layout')).toHaveClass('xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]');
    expect(screen.getByTestId('topic-breakdown-grid')).toHaveClass('lg:grid-cols-2');
    expect(screen.getByText('2 topics')).toBeInTheDocument();
  });

  it('saves exactly one attempt when results mount in StrictMode', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/exams/exam-7']}>
          <Routes>
            <Route path="/exams/:id" element={<ExamView />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    );

    expect(await screen.findByText('Which organelle produces ATP?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mitochondria/i }));
    expect(await screen.findByText('Which phase comes right after metaphase?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /anaphase/i }));

    await waitFor(() => {
      expect(api.createExamAttempt).toHaveBeenCalledTimes(1);
    });
  });
});
