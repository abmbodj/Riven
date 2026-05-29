import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PricingModal from './PricingModal.jsx';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../../hooks/useRevenueCat', () => ({
  default: () => ({
    isNative: false,
    offerings: null,
    error: null,
  }),
}));

vi.mock('../../hooks/useBodyScrollLock', () => ({
  default: () => undefined,
}));

vi.mock('../../api/stripe', () => ({
  createCheckoutSessionUrl: vi.fn(),
}));

vi.mock('../../api', () => ({
  api: {
    syncRevenueCat: vi.fn(),
  },
}));

describe('PricingModal AI messaging', () => {
  it('describes current premium study capabilities instead of the old unlimited-generations copy', () => {
    render(<PricingModal isOpen={true} onClose={vi.fn()} currentTier="free" />);

    expect(screen.getByText(/premium themes plus guided tools for decks, classes, guides, mock exams, youtube tools, and note enhancement/i)).toBeInTheDocument();
    expect(screen.getByText(/guided tools across decks, classes, guides, mock exams, youtube study tools, and audio note enhancement/i)).toBeInTheDocument();
    expect(screen.getByText(/decks, classes, guides, exams, youtube, and note enhancement/i)).toBeInTheDocument();
    expect(screen.getAllByText(/guided study tools for decks, classes, guides, exams, youtube, and notes/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/unlimited ai generations/i)).not.toBeInTheDocument();
  });
});
