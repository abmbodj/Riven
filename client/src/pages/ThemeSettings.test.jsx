import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeSettings from './ThemeSettings.jsx';

const { mockThemes, mockUser, pricingModalMock, switchThemeMock } = vi.hoisted(() => ({
  mockThemes: [],
  mockUser: { subscription_tier: 'free' },
  pricingModalMock: vi.fn(),
  switchThemeMock: vi.fn(),
}));

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
    killTweensOf() {},
  },
}));

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    themes: mockThemes,
    activeTheme: mockThemes.find((theme) => theme.is_active) ?? null,
    switchTheme: switchThemeMock,
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
  beforeEach(() => {
    mockThemes.length = 0;
    mockUser.subscription_tier = 'free';
    pricingModalMock.mockClear();
    switchThemeMock.mockClear();
  });

  it('opens pricing instead of the custom theme editor for free users', () => {
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

  it('shows professional themes to free users and opens pricing when selected', () => {
    mockThemes.push(
      {
        id: 1,
        name: 'Riven',
        bg_color: '#162a31',
        surface_color: '#1e3840',
        text_color: '#e4ddd0',
        secondary_text_color: '#8fa6a8',
        border_color: '#233e46',
        accent_color: '#deb96a',
        font_family_display: 'Cormorant Garamond',
        font_family_body: 'Lora',
        is_active: true,
        is_default: true,
      },
      {
        id: 2,
        name: 'Rose',
        bg_color: '#1a0020',
        surface_color: '#280030',
        text_color: '#ffe0f5',
        secondary_text_color: '#ff80c8',
        border_color: '#3d0050',
        accent_color: '#ff4da6',
        font_family_display: 'Inter',
        font_family_body: 'Inter',
        is_active: false,
        is_default: true,
      }
    );

    render(<ThemeSettings />);

    fireEvent.click(screen.getByText('Rose'));

    expect(screen.getByText('Pricing modal open')).toBeInTheDocument();
    expect(switchThemeMock).not.toHaveBeenCalled();
    expect(pricingModalMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isOpen: true,
        currentTier: 'free',
      })
    );
  });

  it('opens the redesigned theme studio for premium users', () => {
    mockUser.subscription_tier = 'supporter';

    render(<ThemeSettings />);

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));

    expect(screen.getByRole('dialog', { name: /theme studio/i })).toBeInTheDocument();
    expect(screen.getByText(/one continuous flow/i)).toBeInTheDocument();
    expect(screen.getByText(/start on phone, keep scrolling/i)).toBeInTheDocument();
    expect(screen.queryByText('Pricing modal open')).not.toBeInTheDocument();
  });
});
