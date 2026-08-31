/* @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeSettings from './ThemeSettings.jsx';

const {
  addThemeMock,
  applyDraftThemeMock,
  deleteThemeMock,
  mockThemes,
  mockUser,
  pricingModalMock,
  restoreActiveThemeMock,
  switchThemeMock,
  themeEffectOverlayMock,
  updateThemeMock,
} = vi.hoisted(() => ({
  addThemeMock: vi.fn(),
  applyDraftThemeMock: vi.fn(),
  deleteThemeMock: vi.fn(),
  mockThemes: [],
  mockUser: { subscription_tier: 'free' },
  pricingModalMock: vi.fn(),
  restoreActiveThemeMock: vi.fn(),
  switchThemeMock: vi.fn(),
  themeEffectOverlayMock: vi.fn(),
  updateThemeMock: vi.fn(),
}));

function stripMotionProps(props) {
  const {
    animate: _animate,
    exit: _exit,
    initial: _initial,
    layoutId: _layoutId,
    transition: _transition,
    variants: _variants,
    whileHover: _whileHover,
    whileTap: _whileTap,
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
    effect_preset: 'auto',
    effect_intensity: 'medium',
    background_style: 'solid',
    gradient_colors: [],
    gradient_angle: 135,
    gradient_intensity: 'medium',
    is_active: false,
    is_default: true,
    ...overrides,
  };
}

function getThemeSectionOrder() {
  const sectionNames = new Set(['Your Gallery', 'Foundation', 'Professional']);
  return [...document.querySelectorAll('h2')]
    .map((heading) => heading.textContent?.trim())
    .filter((name) => sectionNames.has(name));
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
    appliedTheme: mockThemes.find((theme) => theme.is_active) ?? null,
    switchTheme: switchThemeMock,
    addTheme: addThemeMock,
    updateTheme: updateThemeMock,
    deleteTheme: deleteThemeMock,
    applyDraftTheme: applyDraftThemeMock,
    restoreActiveTheme: restoreActiveThemeMock,
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

vi.mock('../components/themes/themeEffects.jsx', () => ({
  getThemeEffectLabel: (theme) => {
    if (!theme?.effect_preset || theme.effect_preset === 'none') return 'None';
    if (theme.effect_preset === 'auto') return 'Signature';
    return `${theme.effect_preset}${theme.effect_intensity ? ` · ${theme.effect_intensity}` : ''}`;
  },
  ThemeEffectOverlay: (props) => {
    themeEffectOverlayMock(props);
    return (
      <div
        data-testid="theme-effect-overlay"
        data-effect={props.theme?.effect_preset || 'none'}
        data-simplify-motion={String(Boolean(props.simplifyMotion))}
      />
    );
  },
}));

describe('ThemeSettings theme studio', () => {
  beforeEach(() => {
    mockThemes.length = 0;
    mockUser.subscription_tier = 'free';
    addThemeMock.mockReset();
    applyDraftThemeMock.mockReset();
    deleteThemeMock.mockReset();
    pricingModalMock.mockClear();
    restoreActiveThemeMock.mockReset();
    switchThemeMock.mockReset();
    themeEffectOverlayMock.mockClear();
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

  it('moves Your Gallery above default themes when custom themes exist', () => {
    mockUser.subscription_tier = 'supporter';
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
      }),
      seedTheme({
        id: 31,
        name: 'Custom Drift',
        is_default: false,
        bg_color: '#252136',
        surface_color: '#302a44',
        text_color: '#f6f1ff',
        secondary_text_color: '#b7accd',
        border_color: '#4c4466',
        accent_color: '#6195ff',
      })
    );

    render(<ThemeSettings />);

    expect(getThemeSectionOrder()).toEqual(['Your Gallery', 'Foundation', 'Professional']);
    expect(screen.getByRole('button', { name: /edit theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete theme/i })).toBeInTheDocument();
  });

  it('keeps the empty custom gallery below default themes', () => {
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

    expect(getThemeSectionOrder()).toEqual(['Foundation', 'Professional', 'Your Gallery']);
    expect(screen.getByText('Your gallery awaits.')).toBeInTheDocument();
  });

  it('opens the mobile Theme Mixer and keeps expert tokens collapsed until requested', async () => {
    mockUser.subscription_tier = 'supporter';

    render(<ThemeSettings />);
    const getDialog = () => screen.getByRole('dialog', { name: /theme mixer/i });

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));

    const dialog = getDialog();
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/pick a gradient direction/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/shape the atmosphere/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/live preview/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/canvas color/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /expert tokens/i })).toHaveAttribute('aria-expanded', 'false');

    applyDraftThemeMock.mockClear();

    fireEvent.click(within(dialog).getByRole('button', { name: /paper bloom/i }));
    await waitFor(() => {
      expect(applyDraftThemeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          background_style: 'gradient',
          gradient_colors: expect.arrayContaining(['#fff7ec', '#f3e6f6', '#d989a9']),
          gradient_intensity: 'soft',
        }),
        expect.objectContaining({ commit: false })
      );
    });

    fireEvent.click(within(getDialog()).getByRole('button', { name: /expert tokens/i }));
    expect(within(getDialog()).getByLabelText(/canvas color/i)).toBeInTheDocument();
    expect(within(getDialog()).getByRole('button', { name: /expert tokens/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Pricing modal open')).not.toBeInTheDocument();
  });

  it('renders the active hero content with a visible fallback state', () => {
    mockUser.subscription_tier = 'supporter';
    setViewport(1280);
    mockThemes.push(seedTheme({ id: 1, name: 'Moonlit Cove', is_active: true }));
    render(<ThemeSettings />);

    const activeSpecimen = screen.getByText(/active specimen/i);
    const scene = activeSpecimen.closest('.relative.z-10');
    expect(screen.getAllByRole('heading', { name: 'Moonlit Cove' }).length).toBeGreaterThan(0);
    expect(scene).toHaveStyle({ opacity: '1' });
  });

  it('creates a new gradient theme with recipe and effect fields', async () => {
    mockUser.subscription_tier = 'supporter';
    addThemeMock.mockResolvedValue({ id: 444, name: 'Focus Noir' });
    switchThemeMock.mockResolvedValue({ id: 444, name: 'Focus Noir', is_active: 1 });

    render(<ThemeSettings />);
    const getDialog = () => screen.getByRole('dialog', { name: /theme mixer/i });

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));
    const dialog = getDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /rain signal/i }));
    fireEvent.click(within(getDialog()).getByRole('button', { name: /signal accent/i }));
    fireEvent.click(within(getDialog()).getByRole('button', { name: /studio sans/i }));
    fireEvent.click(within(getDialog()).getByRole('button', { name: /dust/i }));
    await waitFor(() => {
      expect(
        within(getDialog()).getAllByTestId('theme-effect-overlay').some((overlay) => (
          overlay.getAttribute('data-effect') === 'dust'
          && overlay.getAttribute('data-simplify-motion') === 'true'
        ))
      ).toBe(true);
    });
    fireEvent.change(within(getDialog()).getByRole('slider', { name: /angle/i }), { target: { value: '210' } });
    await waitFor(() => {
      expect(within(getDialog()).getByPlaceholderText(/night lectures/i)).toBeInTheDocument();
    });
    fireEvent.change(within(getDialog()).getByPlaceholderText(/night lectures/i), { target: { value: 'Focus Noir' } });
    fireEvent.click(within(getDialog()).getAllByRole('button', { name: /^create$/i }).at(-1));

    await waitFor(() => {
      expect(addThemeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Focus Noir',
          background_style: 'gradient',
          gradient_colors: ['#071417', '#0d3340', '#52d1c6'],
          gradient_angle: 210,
          gradient_intensity: 'rich',
          accent_color: '#52d1c6',
          font_family_display: 'Space Grotesk',
          font_family_body: 'Space Grotesk',
          effect_preset: 'dust',
          bg_color: expect.stringMatching(/^#/),
          surface_color: expect.stringMatching(/^#/),
        })
      );
    });
    expect(switchThemeMock).toHaveBeenCalledWith(444);
  });

  it('coalesces rapid gradient inputs before applying the app-wide draft preview', async () => {
    mockUser.subscription_tier = 'supporter';
    mockThemes.push(seedTheme({ id: 1, name: 'Riven', is_active: true }));

    render(<ThemeSettings />);
    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));
    const dialog = screen.getByRole('dialog', { name: /theme mixer/i });

    await waitFor(() => {
      expect(applyDraftThemeMock).toHaveBeenCalled();
    });
    applyDraftThemeMock.mockClear();

    const slider = within(dialog).getByRole('slider', { name: /angle/i });
    const firstStop = within(dialog).getByLabelText(/^gradient color 1$/i);
    ['150', '175', '205', '230', '260'].forEach((value) => {
      fireEvent.change(slider, { target: { value } });
    });
    ['#203a63', '#7561c8', '#52d1c6'].forEach((value) => {
      fireEvent.change(firstStop, { target: { value } });
    });

    expect(applyDraftThemeMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(applyDraftThemeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          gradient_angle: 260,
          gradient_colors: expect.arrayContaining(['#52d1c6']),
        }),
        expect.objectContaining({ commit: false })
      );
    }, { timeout: 3000 });

    expect(applyDraftThemeMock.mock.calls.length).toBeLessThan(8);

    await waitFor(() => {
      expect(applyDraftThemeMock).toHaveBeenCalledWith(
        expect.objectContaining({ gradient_angle: 260 }),
        expect.objectContaining({ commit: true })
      );
    }, { timeout: 3000 });
  });

  it('opens editing and saves effect plus expert token overrides', async () => {
    mockUser.subscription_tier = 'supporter';
    setViewport(1280);
    updateThemeMock.mockResolvedValue({ id: 31, name: 'Custom Drift' });
    switchThemeMock.mockResolvedValue({ id: 31, name: 'Custom Drift', is_active: 1 });
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
        background_style: 'gradient',
        gradient_colors: ['#252136', '#302a44', '#6195ff'],
        gradient_angle: 120,
        gradient_intensity: 'medium',
        effect_preset: 'dust',
        effect_intensity: 'medium',
        is_default: false,
      })
    );

    render(<ThemeSettings />);

    fireEvent.click(screen.getByRole('button', { name: /edit theme/i }));

    expect(screen.getByRole('dialog', { name: /refine theme mixer/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Custom Drift')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /grid/i }));
    fireEvent.click(screen.getByRole('button', { name: /expert tokens/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/canvas color/i)).toBeInTheDocument();
    });
    const firstColorInput = screen.getByLabelText(/canvas color/i);
    expect(firstColorInput).not.toBeNull();
    fireEvent.change(firstColorInput, { target: { value: '#123456' } });

    fireEvent.click(screen.getByRole('button', { name: /save refinements/i }));

    await waitFor(() => {
      expect(updateThemeMock).toHaveBeenCalledWith(
        31,
        expect.objectContaining({
          name: 'Custom Drift',
          bg_color: '#123456',
          background_style: 'solid',
          gradient_colors: [],
          effect_preset: 'grid',
        })
      );
    });
    expect(switchThemeMock).toHaveBeenCalledWith(31);
  });

  it('restores the active theme when the editor closes without saving', async () => {
    mockUser.subscription_tier = 'supporter';
    mockThemes.push(seedTheme({ id: 1, name: 'Riven', is_active: true }));

    render(<ThemeSettings />);
    const getDialog = () => screen.getByRole('dialog', { name: /theme mixer/i });

    fireEvent.click(screen.getByRole('button', { name: /create custom/i }));
    applyDraftThemeMock.mockClear();

    fireEvent.click(within(getDialog()).getByRole('button', { name: /^light$/i }));

    await waitFor(() => {
      expect(applyDraftThemeMock).toHaveBeenCalled();
    });

    fireEvent.click(within(getDialog()).getByRole('button', { name: /close theme editor/i }));

    expect(restoreActiveThemeMock).toHaveBeenCalledTimes(1);
  });
});
