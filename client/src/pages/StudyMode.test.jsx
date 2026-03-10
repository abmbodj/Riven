import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudyMode from './StudyMode.jsx';

vi.mock('../api', () => ({
  api: {
    getDeck: vi.fn(),
    getHeartsStatus: vi.fn(),
    reviewCard: vi.fn(),
    saveStudySession: vi.fn(),
    decrementHeart: vi.fn(),
    practiceRefill: vi.fn(),
  },
}));

vi.mock('../hooks/useStreakContext', () => ({
  useStreakContext: () => ({
    incrementStreak: vi.fn(),
  }),
}));

vi.mock('../hooks/useHaptics', () => ({
  default: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    selection: vi.fn(),
  }),
}));

vi.mock('../hooks/useSwipeGesture', () => ({
  default: () => ({}),
}));

vi.mock('../components/ui/OutOfHeartsModal', () => ({
  default: () => null,
}));

vi.mock('../components/ui/StudyHeartsDisplay', () => ({
  default: () => <div data-testid="hearts-display" />,
}));

vi.mock('gsap', () => {
  const timeline = {
    to: vi.fn().mockReturnThis(),
    play: vi.fn(),
    reverse: vi.fn(),
    kill: vi.fn(),
  };

  return {
    default: {
      registerPlugin: vi.fn(),
      timeline: vi.fn(() => timeline),
      to: vi.fn(),
      set: vi.fn(),
    },
    gsap: {
      registerPlugin: vi.fn(),
      timeline: vi.fn(() => timeline),
      to: vi.fn(),
      set: vi.fn(),
    },
    ScrollTrigger: {},
  };
});

const { api } = await import('../api');

describe('StudyMode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.localStorage.clear();

    api.getDeck.mockResolvedValue({
      title: 'Biology Midterm',
      description: 'Memorize the pathways and energy exchange terms.',
      cards: [
        {
          id: 1,
          front: 'Front 1',
          back: 'Back 1',
          difficulty: 0,
          next_review: '2026-03-10T09:00:00.000Z',
        },
        {
          id: 2,
          front: 'Front 2',
          back: 'Back 2',
          difficulty: 0,
          next_review: '2026-03-11T09:00:00.000Z',
        },
      ],
    });
    api.getHeartsStatus.mockResolvedValue({
      hearts: 'Unlimited',
      max: 'Unlimited',
      isUnlimited: true,
    });
    api.reviewCard.mockResolvedValue({});
    api.saveStudySession.mockResolvedValue({});
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
  });

  it('lets users grade the last card before completing a spaced repetition session', async () => {
    render(
      <MemoryRouter initialEntries={['/study/42']}>
        <Routes>
          <Route path="/study/:id" element={<StudyMode />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('Front 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /spaced repetition off/i }));

    fireEvent.click(screen.getByText('Front 1'));
    expect(screen.getByRole('button', { name: /knew it/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /knew it/i }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(api.reviewCard).toHaveBeenCalledWith(1, true);

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    expect(screen.getByText('Front 2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Front 2'));

    expect(screen.getByRole('button', { name: /knew it/i })).toBeInTheDocument();
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /didn't know/i }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(api.reviewCard).toHaveBeenCalledWith(2, false);

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    expect(screen.getByText('Session complete')).toBeInTheDocument();
  });

  it('restores the last study session state for the same deck', async () => {
    window.localStorage.setItem('riven-study-session:42', JSON.stringify({
      currentIndex: 1,
      isShuffled: true,
      spacedRepetitionMode: true,
      cardsStudied: 3,
      cardsCorrect: 2,
      startedAt: new Date('2026-03-10T09:00:00.000Z').getTime(),
      cardOrder: ['2', '1'],
    }));

    render(
      <MemoryRouter initialEntries={['/study/42']}>
        <Routes>
          <Route path="/study/:id" element={<StudyMode />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Resumed session')).toBeInTheDocument();
    expect(screen.getByText('You are back where you left off.')).toBeInTheDocument();
    expect(screen.getByText('Study Focus')).toBeInTheDocument();
    expect(screen.getByText('Session Phase')).toBeInTheDocument();
    expect(screen.getAllByText('Biology Midterm').length).toBeGreaterThan(0);
    expect(screen.getByText('Front 1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spaced repetition on/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start fresh/i })).toBeInTheDocument();
  });
});
