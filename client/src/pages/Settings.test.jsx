import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './Settings.jsx';

const { mockUser, mockToast } = vi.hoisted(() => ({
  mockUser: {
    subscription_tier: 'supporter',
    twoFAEnabled: false,
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    show: vi.fn(),
  },
}));

vi.mock('../api', () => ({
  api: {
    getCanvasSettings: vi.fn(),
    getAILimits: vi.fn(),
    connectCanvas: vi.fn(),
    disconnectCanvas: vi.fn(),
    setCanvasAutoSync: vi.fn(),
    syncCanvas: vi.fn(),
    getReferralInfo: vi.fn(),
    applyReferralCode: vi.fn(),
    submitFeedback: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    refreshUser: vi.fn(),
    user: mockUser,
  }),
}));

vi.mock('../hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    isNative: false,
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => mockToast,
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

vi.mock('../utils/notifications', () => ({
  checkNotificationPermissions: vi.fn().mockResolvedValue(true),
  requestNotificationPermissions: vi.fn().mockResolvedValue(true),
  scheduleAssignmentNotifications: vi.fn().mockResolvedValue(undefined),
}));

const { api } = await import('../api');

const renderSettings = () => render(
  <MemoryRouter>
    <Settings />
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
  mockUser.subscription_tier = 'supporter';
  mockUser.twoFAEnabled = false;
  api.getCanvasSettings.mockResolvedValue({
    isConnected: false,
    canvasUrl: '',
    autoSyncEnabled: false,
    lastSyncAt: null,
    lastAutoSyncError: '',
  });
  api.getAILimits.mockResolvedValue({
    remaining: 10,
    max: 10,
    isPremium: true,
    characterLimit: 50000,
    flashcardRange: [5, 40],
  });
  api.getReferralInfo.mockResolvedValue({
    referralCode: 'RIVEN123',
    qualifiedCount: 0,
    targetCount: 3,
    rewardEarned: false,
  });
  api.submitFeedback.mockResolvedValue({
    id: 1,
    content: 'Test feedback',
    createdAt: '2026-03-21T00:00:00.000Z',
  });
});

describe('Settings LMS sync', () => {
  it('renders the streamlined settings hierarchy for premium users', async () => {
    renderSettings();
    await waitFor(() => {
      expect(api.getCanvasSettings).toHaveBeenCalled();
      expect(api.getAILimits).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plan & access' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Integrations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Riven AI' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Help & policies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /riven ai/i })).toBeInTheDocument();
    expect(screen.getByText(/assignment reminders at 24h, 12h, 3h, 1h & 30m/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Workspace snapshot' })).not.toBeInTheDocument();
    expect(screen.queryByText('Control center')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Theme & atmosphere' })).not.toBeInTheDocument();
    expect(screen.queryByText('Settings atlas')).not.toBeInTheDocument();
  });

  it('opens and closes the feedback modal from help and policies', async () => {
    renderSettings();

    fireEvent.click(await screen.findByRole('button', { name: /send feedback/i }));

    expect(screen.getByRole('heading', { name: /shape what comes next/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /shape what comes next/i })).not.toBeInTheDocument();
    });
  });

  it('blocks empty feedback submissions in the composer modal', async () => {
    renderSettings();

    fireEvent.click(await screen.findByRole('button', { name: /send feedback/i }));

    expect(screen.getByRole('button', { name: /^send feedback$/i })).toBeDisabled();
    expect(api.submitFeedback).not.toHaveBeenCalled();
  });

  it('submits feedback suggestions from the settings modal', async () => {
    renderSettings();

    fireEvent.click(await screen.findByRole('button', { name: /send feedback/i }));
    fireEvent.change(screen.getByLabelText(/your suggestion/i), {
      target: { value: 'Add a feedback inbox for theme ideas.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send feedback$/i }));

    await waitFor(() => {
      expect(api.submitFeedback).toHaveBeenCalledWith('Add a feedback inbox for theme ideas.');
    });
    expect(mockToast.success).toHaveBeenCalledWith('Thanks for the suggestion. It is now in the owner inbox.');
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /shape what comes next/i })).not.toBeInTheDocument();
    });
  });

  it('keeps connect CTA disabled until a Canvas feed URL is entered', async () => {
    renderSettings();

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
      canvasUrl: 'https://canvas.example.edu/feeds/calendars/user_1.ics',
      autoSyncEnabled: true,
      lastSyncAt: '2026-03-20T12:00:00.000Z',
      lastAutoSyncError: '',
    });
    api.syncCanvas.mockResolvedValue({
      classesAdded: 2,
      assignmentsAdded: 5,
    });

    renderSettings();

    const syncButton = await screen.findByRole('button', { name: /sync canvas now/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(api.syncCanvas).toHaveBeenCalledWith(false);
    });

    expect(await screen.findByText(/imported 2 classes and 5 assignments just now/i)).toBeInTheDocument();
  });

  it('toggles Canvas auto-sync for connected users and shows sync metadata', async () => {
    api.getCanvasSettings.mockResolvedValue({
      isConnected: true,
      canvasUrl: 'https://canvas.example.edu/feeds/calendars/user_1.ics',
      autoSyncEnabled: true,
      lastSyncAt: '2026-03-20T12:00:00.000Z',
      lastAutoSyncError: 'Canvas feed timed out during the last auto-sync.',
    });
    api.setCanvasAutoSync.mockResolvedValue({
      autoSyncEnabled: false,
    });

    renderSettings();

    expect(await screen.findByText(/canvas feed timed out during the last auto-sync/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /auto-sync every 12 hours/i }));

    await waitFor(() => {
      expect(api.setCanvasAutoSync).toHaveBeenCalledWith(false);
    });

    expect(await screen.findByText(/canvas will stay connected, but new imports will wait for a manual sync/i)).toBeInTheDocument();
  });

  it('shows the current plan without the extra lifetime membership card', async () => {
    mockUser.subscription_tier = 'lifetime';

    renderSettings();

    expect(await screen.findByRole('heading', { name: 'Plan & access' })).toBeInTheDocument();
    expect(screen.getAllByText(/^lifetime$/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Lifetime Member')).not.toBeInTheDocument();
  });

  it('renders tier-aware AI details and capability labels from the limits payload', async () => {
    api.getAILimits.mockResolvedValue({
      remaining: 42,
      max: 50,
      isPremium: true,
      characterLimit: 50000,
      flashcardRange: [5, 40],
    });

    renderSettings();

    expect(await screen.findByRole('heading', { name: 'Riven AI' })).toBeInTheDocument();
    expect(screen.getByText('Every 12 hours')).toBeInTheDocument();
    expect(screen.getByText('~10,000 words')).toBeInTheDocument();
    expect(screen.getByText('50,000 chars max')).toBeInTheDocument();
    expect(screen.getByText('5-40 cards')).toBeInTheDocument();
    expect(screen.getByText('Flashcard decks')).toBeInTheDocument();
    expect(screen.getByText('Class setup')).toBeInTheDocument();
    expect(screen.getByText('Study guides')).toBeInTheDocument();
    expect(screen.getByText('Mock exams')).toBeInTheDocument();
    expect(screen.getByText('YouTube study imports')).toBeInTheDocument();
    expect(screen.getByText('Audio note enhancement')).toBeInTheDocument();
  });
});

describe('Settings referral flow', () => {
  it('shows persistent inline feedback when a free user copies their referral code', async () => {
    mockUser.subscription_tier = 'free';
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

    renderSettings();

    const copyButton = await screen.findByRole('button', { name: /copy code/i });
    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('RIVEN123');
    expect(await screen.findByText(/code copied/i)).toBeInTheDocument();
    expect(screen.getByText(/share it with a friend/i)).toBeInTheDocument();
  });
});
