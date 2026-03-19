import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestMode from './TestMode.jsx';

vi.mock('../api', () => ({
  api: {
    getDeck: vi.fn(),
    getHeartsStatus: vi.fn(),
    decrementHeart: vi.fn(),
    practiceRefill: vi.fn(),
    reviewCard: vi.fn(),
    saveStudySession: vi.fn(),
  },
}));

vi.mock('../hooks/useStreakContext', () => ({
  useStreakContext: () => ({
    incrementStreak: vi.fn(),
  }),
}));

vi.mock('../hooks/useHaptics', () => ({
  default: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../components/ui/OutOfHeartsModal', () => ({
  default: () => null,
}));

vi.mock('../components/ui/StudyHeartsDisplay', () => ({
  default: () => <div data-testid="hearts-display" />,
}));

const { api } = await import('../api');

describe('TestMode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    api.getDeck.mockResolvedValue({
      title: 'Biology Midterm',
      description: 'Memorize the pathways and energy exchange terms.',
      cards: [
        { id: 1, front: 'ATP', back: 'Energy currency' },
        { id: 2, front: 'Mitochondria', back: 'Powerhouse' },
        { id: 3, front: 'Glycolysis', back: 'First stage' },
        { id: 4, front: 'Pyruvate', back: 'End product' },
      ],
    });
    api.getHeartsStatus.mockResolvedValue({
      hearts: 'Unlimited',
      max: 'Unlimited',
      isUnlimited: true,
    });
    api.decrementHeart.mockResolvedValue({
      hearts: 'Unlimited',
      max: 'Unlimited',
      isUnlimited: true,
    });
    api.practiceRefill.mockResolvedValue({
      hearts: 'Unlimited',
      max: 'Unlimited',
      isUnlimited: true,
    });
    api.reviewCard.mockResolvedValue({});
    api.saveStudySession.mockResolvedValue({});
  });

  it('shows the assessment workbench before a test starts', async () => {
    render(
      <MemoryRouter initialEntries={['/deck/42/test']}>
        <Routes>
          <Route path="/deck/:id/test" element={<TestMode />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Assessment Workbench')).toBeInTheDocument();
    expect(screen.getByText('Biology Midterm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /multiple choice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /type answer/i })).toBeInTheDocument();
  });

  it('shows the typed recall workspace and completion summary', async () => {
    api.getDeck.mockResolvedValueOnce({
      title: 'Biology Midterm',
      description: 'Memorize the pathways and energy exchange terms.',
      cards: [
        { id: 1, front: 'ATP', back: 'Energy currency' },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/deck/42/test']}>
        <Routes>
          <Route path="/deck/:id/test" element={<TestMode />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /type answer/i }));

    expect(screen.getByText('Test Focus')).toBeInTheDocument();
    expect(screen.getAllByText('Biology Midterm').length).toBeGreaterThan(0);
    const answerInput = screen.getByPlaceholderText('Type your answer...');
    expect(answerInput).toBeInTheDocument();

    fireEvent.change(answerInput, {
      target: { value: 'Energy currency' },
    });
    fireEvent.submit(answerInput.closest('form'));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(screen.getByText('Assessment complete')).toBeInTheDocument();
    expect(screen.getByText('Complete!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
