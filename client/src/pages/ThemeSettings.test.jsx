import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeSettings from './ThemeSettings.jsx';

const {
  addThemeMock,
  deleteThemeMock,
  mockThemes,
  mockUser,
  pricingModalMock,
  switchThemeMock,
  updateThemeMock,
} = vi.hoisted(() => ({
  addThemeMock: vi.fn(),
  deleteThemeMock: vi.fn(),
  mockThemes: [],
  mockUser: { subscription_tier: 'free' },
  pricingModalMock: vi.fn(),
  switchThemeMock: vi.fn(),
  updateThemeMock: vi.fn(),
}));

function stripMotionProps(props) {
  const {
    animate,
    exit,
    initial,
    layoutId,
    transition,
    variants,
    whileHover,
    whileTap,
    ...domProps
  } = props;

  return domProps;
}

function createMatchMedia(width) {
  return (query) => {
    const parts = query.split(',').map((part) => part.trim());
    const matches = parts.some((part) => {
      if (part.includes('prefers-reduced-motion')) return false;

      const minWidth = part.match(/\(min-width:\s*(\d+)px\)/);
      if (minWidth) {
        return width >= Number(minWidth[1]);
      }

      const maxWidth = part.match(/\(max-width:\s*(\d+)px\)/);
      if (maxWidth) {
        return width <= Number(maxWidth[1]);
      }

      return false;
    });

    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  };
}

function setViewport(width) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });

  window.matchMedia = vi.fn().mockImplementation(createMatchMedia(width));
}

function seedTheme(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    name: 'Riven',
    bg_color: '#162a31',
    surface_color: '#1e3840',
    text_color: '#e4ddd0',
    secondary_text_color: '#8fa6a8',
    border_color: '#233e46',
    accent_color: '#deb96a',
    font_family_display: 'Cormorant Garamond',
    font_family_body: 'Lora',
    is_active: false,
    is_default: true,
    ...overrides,
  };
}

vi.mock('motion/react', () => {
  const createMotionComponent = (tag) =>
    React.forwardRef(({ children, ...props }, ref) => (
      React.createElement(tag, { ...stripMotionProps(props), ref }, children)
    ));

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
    addTheme: addThemeMock,
    updateTheme: updateThemeMock,
    deleteTheme: deleteThemeMock,
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

describe('ThemeSettings theme studio', () => {
  beforeEach(() => {
    mockThemes.length = 0;
    mockUser.subscription_tier = 'free';
    addThemeMock.mockReset();
    deleteThemeMock.mockReset();
    pricingModalMock.mockClear();
    switchThemeMock.mockReset();
    updateThemeMock.mockReset();
    setViewport(390);
  });

  it('opens pricing instead of the custom theme editor for free users', () => {
    render(<ThemeSettings />);

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));

    expect(screen.getByText('Pricing modal open')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /theme studio/i })).not.toBeInTheDocument();
    expect(pricingModalMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isOpen: true,
        currentTier: 'free',
      })
    );
  });

  it('shows professional themes to free users and opens pricing when selected', () => {
    mockThemes.push(
      seedTheme({ id: 1, name: 'Riven', is_active: true }),
      seedTheme({
        id: 2,
        name: 'Lavender Dusk',
        bg_color: '#171226',
        surface_color: '#221a34',
        text_color: '#efe7ff',
        secondary_text_color: '#b6a4e6',
        border_color: '#30244b',
        accent_color: '#b89bf3',
      })
    );

    render(<ThemeSettings />);

    fireEvent.click(screen.getByText('Lavender Dusk'));

    expect(screen.getByText('Pricing modal open')).toBeInTheDocument();
    expect(switchThemeMock).not.toHaveBeenCalled();
    expect(pricingModalMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isOpen: true,
        currentTier: 'free',
      })
    );
  });

  it('opens the step studio on mobile and reveals advanced token controls', () => {
    mockUser.subscription_tier = 'supporter';

    const { container } = render(<ThemeSettings />);

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));

    expect(screen.getByRole('dialog', { name: /theme studio/i })).toBeInTheDocument();
    expect(screen.getByText(/choose the starting atmosphere/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /phone preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /desktop preview/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    expect(screen.getByText(/shape the accent and typography/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    expect(screen.getByText(/fine-tune the color tokens/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /fine-tune colors/i }));

    expect(screen.getByText('Canvas')).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="color"]')).toHaveLength(6);
    expect(screen.queryByText('Pricing modal open')).not.toBeInTheDocument();
  });

  it('shows the desktop preview rail for premium users', () => {
    mockUser.subscription_tier = 'supporter';
    setViewport(1280);

    render(<ThemeSettings />);

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));

    expect(screen.getByRole('dialog', { name: /theme studio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /desktop preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /phone preview/i })).toBeInTheDocument();
    expect(screen.getByText(/choose the starting atmosphere/i)).toBeInTheDocument();
  });

  it('creates a new theme after guided curated changes', async () => {
    mockUser.subscription_tier = 'supporter';
    setViewport(1280);

    render(<ThemeSettings />);

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Rose' }));
    fireEvent.click(screen.getByRole('button', { name: /studio sans/i }));
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /skip to review/i }));

    fireEvent.change(screen.getByPlaceholderText(/night lectures/i), { target: { value: 'Focus Noir' } });
    fireEvent.click(screen.getByRole('button', { name: /create theme/i }));

    await waitFor(() => {
      expect(addThemeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Focus Noir',
          accent_color: '#d989a9',
          font_family_display: 'Space Grotesk',
          font_family_body: 'Space Grotesk',
        })
      );
    });
  });

  it('opens editing on review and saves advanced token overrides', async () => {
    mockUser.subscription_tier = 'supporter';
    setViewport(1280);
    mockThemes.push(
      seedTheme({ id: 1, name: 'Riven', is_active: true }),
      seedTheme({
        id: 31,
        name: 'Custom Drift',
        bg_color: '#252136',
        surface_color: '#302a44',
        text_color: '#f6f1ff',
        secondary_text_color: '#b7accd',
        border_color: '#4c4466',
        accent_color: '#6195ff',
        font_family_display: 'Space Grotesk',
        font_family_body: 'Space Grotesk',
        is_default: false,
      })
    );

    const { container } = render(<ThemeSettings />);

    fireEvent.click(screen.getByRole('button', { name: /edit theme/i }));

    expect(screen.getByRole('dialog', { name: /refine theme/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Custom Drift')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /advanced/i }));

    const firstColorInput = container.querySelector('input[type="color"]');
    expect(firstColorInput).not.toBeNull();
    fireEvent.change(firstColorInput, { target: { value: '#123456' } });

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /save refinements/i }));

    await waitFor(() => {
      expect(updateThemeMock).toHaveBeenCalledWith(
        31,
        expect.objectContaining({
          name: 'Custom Drift',
          bg_color: '#123456',
        })
      );
    });
  });
});
