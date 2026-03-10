import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Settings from './Settings.jsx';
import { ThemeContext } from '../ThemeContext';

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
    user: {
      subscription_tier: 'supporter',
      twoFAEnabled: false,
    },
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
  it('keeps connect CTA disabled until a Canvas feed URL is entered', async () => {
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
