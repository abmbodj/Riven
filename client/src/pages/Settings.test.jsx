import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Settings from './Settings.jsx';
import { ThemeContext } from '../context/themeContext';

const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    subscription_tier: 'supporter',
    twoFAEnabled: false,
  },
}));

vi.mock('../api', () => ({
  api: {
    getCanvasSettings: vi.fn(),
    getAILimits: vi.fn(),
    connectCanvas: vi.fn(),
    disconnectCanvas: vi.fn(),
    syncCanvas: vi.fn(),
    getReferralInfo: vi.fn(),
    applyReferralCode: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    refreshUser: vi.fn(),
    user: mockUser,
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    show: vi.fn(),
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

vi.mock('../components/ChangePasswordModal', () => ({
  default: () => null,
}));

vi.mock('../components/TwoFactorAuthModal', () => ({
  default: () => null,
}));

vi.mock('../components/DeleteAccountModal', () => ({
  default: () => null,
}));

vi.mock('../components/ui/PricingModal', () => ({
  default: () => null,
}));

const { api } = await import('../api');

describe('Settings LMS sync', () => {
  it('renders the unified settings section hierarchy for premium users', async () => {
    mockUser.subscription_tier = 'supporter';
    mockUser.twoFAEnabled = false;
    api.getCanvasSettings.mockResolvedValue({
      isConnected: false,
      canvasUrl: '',
    });
    api.getAILimits.mockResolvedValue({
      remaining: 10,
      max: 10,
    });
    api.getReferralInfo.mockResolvedValue({
      referralCode: 'RIVEN123',
      qualifiedCount: 0,
      targetCount: 3,
      rewardEarned: false,
    });

    render(
      <ThemeContext.Provider value={{ activeTheme: { name: 'Riven Dark' } }}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeContext.Provider>
    );

    expect(await screen.findByRole('heading', { name: 'Workspace snapshot' })).toBeInTheDocument();
    expect(screen.getByText('Control center')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plan & access' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Integrations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Theme & atmosphere' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Help & policies' })).toBeInTheDocument();
  });

  it('keeps connect CTA disabled until a Canvas feed URL is entered', async () => {
    mockUser.subscription_tier = 'supporter';
    mockUser.twoFAEnabled = false;
    api.getCanvasSettings.mockResolvedValue({
      isConnected: false,
      canvasUrl: '',
    });
    api.getAILimits.mockResolvedValue({
      remaining: 10,
      max: 10,
    });
    api.getReferralInfo.mockResolvedValue({
      referralCode: 'RIVEN123',
      qualifiedCount: 0,
      targetCount: 3,
      rewardEarned: false,
    });

    render(
      <ThemeContext.Provider value={{ activeTheme: { name: 'Riven Dark' } }}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeContext.Provider>
    );

    const connectButton = await screen.findByRole('button', { name: /connect calendar feed/i });
    expect(connectButton).toBeDisabled();
    expect(screen.getByText(/copy your canvas calendar feed/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/canvas calendar link/i), {
      target: { value: 'https://canvas.example.edu/feed.ics' },
    });

    expect(screen.getByRole('button', { name: /connect calendar feed/i })).not.toBeDisabled();
  });

  it('syncs Canvas without relying on undefined local state', async () => {
    mockUser.subscription_tier = 'supporter';
    mockUser.twoFAEnabled = false;
    api.getCanvasSettings.mockResolvedValue({
      isConnected: true,
      canvasUrl: 'Canvas Feed Active',
    });
    api.getAILimits.mockResolvedValue({
      remaining: 10,
      max: 10,
    });
    api.getReferralInfo.mockResolvedValue({
      referralCode: 'RIVEN123',
      qualifiedCount: 0,
      targetCount: 3,
      rewardEarned: false,
    });
    api.syncCanvas.mockResolvedValue({
      classesAdded: 2,
      assignmentsAdded: 5,
    });

    render(
      <ThemeContext.Provider value={{ activeTheme: { name: 'Riven Dark' } }}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeContext.Provider>
    );

    const syncButton = await screen.findByRole('button', { name: /sync canvas now/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(api.syncCanvas).toHaveBeenCalledWith(false);
    });

    expect(await screen.findByText(/imported 2 classes and 5 assignments just now/i)).toBeInTheDocument();
  });
});

describe('Settings referral flow', () => {
  it('shows persistent inline feedback when a free user copies their referral code', async () => {
    mockUser.subscription_tier = 'free';
    mockUser.twoFAEnabled = false;
    api.getCanvasSettings.mockResolvedValue({
      isConnected: false,
      canvasUrl: '',
    });
    api.getAILimits.mockResolvedValue({
      remaining: 10,
      max: 10,
    });
    api.getReferralInfo.mockResolvedValue({
      referralCode: 'RIVEN123',
      qualifiedCount: 2,
      targetCount: 5,
      rewardEarned: false,
    });

    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <ThemeContext.Provider value={{ activeTheme: { name: 'Riven Dark' } }}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeContext.Provider>
    );

    const copyButton = await screen.findByRole('button', { name: /copy code/i });
    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('RIVEN123');
    expect(await screen.findByText(/code copied/i)).toBeInTheDocument();
    expect(screen.getByText(/share it with a friend/i)).toBeInTheDocument();
  });
});
