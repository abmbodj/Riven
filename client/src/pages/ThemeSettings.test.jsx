import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ThemeSettings from './ThemeSettings.jsx';

const { mockUser, pricingModalMock } = vi.hoisted(() => ({
  mockUser: { subscription_tier: 'free' },
  pricingModalMock: vi.fn(),
}));

vi.mock('motion/react', () => {
  const createMotionComponent = (tag) =>
    React.forwardRef(
      (
        {
          children,
          animate,
          exit,
          initial,
          transition,
          whileHover,
          whileTap,
          whileInView,
          viewport,
          ...props
        },
        ref
      ) => React.createElement(tag, { ...props, ref }, children)
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
    timeline: () => ({
      fromTo() {
        return this;
      },
      to() {
        return this;
      },
      set() {
        return this;
      },
      kill() {},
    }),
    set() {},
  },
}));

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    themes: [],
    activeTheme: null,
    switchTheme: vi.fn(),
    addTheme: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: vi.fn(),
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../hooks/useHaptics', () => ({
  default: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

vi.mock('../components/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: (props) => {
    pricingModalMock(props);
    return props.isOpen ? <div>Pricing modal open</div> : null;
  },
}));

describe('ThemeSettings premium theme creation gate', () => {
  it('opens pricing instead of the custom theme editor for free users', () => {
    mockUser.subscription_tier = 'free';

    render(<ThemeSettings />);

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));

    expect(screen.getByText('Pricing modal open')).toBeInTheDocument();
    expect(screen.queryByText(/new atmosphere/i)).not.toBeInTheDocument();
    expect(pricingModalMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isOpen: true,
        currentTier: 'free',
      })
    );
  });
});
