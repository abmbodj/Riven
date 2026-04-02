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

const {
  mockSignOut,
  mockRefreshUser,
  mockGetPushPreferences,
  mockUpdatePushPreferences,
} = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  mockRefreshUser: vi.fn(),
  mockGetPushPreferences: vi.fn(),
  mockUpdatePushPreferences: vi.fn(),
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
    signOut: mockSignOut,
    refreshUser: mockRefreshUser,
    getPushPreferences: mockGetPushPreferences,
    updatePushPreferences: mockUpdatePushPreferences,
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

vi.mock('../utils/pushNotifications.js', () => ({
  isNativeIos: vi.fn().mockReturnValue(true),
  checkPushPermissions: vi.fn().mockResolvedValue(false),
  requestPushPermissions: vi.fn().mockResolvedValue(true),
  registerPushNotifications: vi.fn().mockResolvedValue(true),
}));

const { api } = await import('../api');
const pushNotifications = await import('../utils/pushNotifications.js');

const renderSettings = () => render(
  <MemoryRouter>
    <Settings />
  </MemoryRouter>
);

/** Click the first tab matching the given section name. */
const navigateToSection = (name) => {
  const tabs = screen.getAllByRole('tab', { name: new RegExp(name, 'i') });
  fireEvent.click(tabs[0]);
};

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
  // Reset location hash so default section is 'security'
  window.location.hash = '';
  mockUser.subscription_tier = 'supporter';
  mockUser.twoFAEnabled = false;
  mockSignOut.mockResolvedValue(undefined);
  mockRefreshUser.mockResolvedValue(mockUser);
  mockGetPushPreferences.mockResolvedValue({
    messagesEnabled: true,
    streakEnabled: true,
    reengagementEnabled: true,
  });
  mockUpdatePushPreferences.mockImplementation(async (preferences) => preferences);
  pushNotifications.isNativeIos.mockReturnValue(true);
  pushNotifications.checkPushPermissions.mockResolvedValue(false);
  pushNotifications.requestPushPermissions.mockResolvedValue(true);
  pushNotifications.registerPushNotifications.mockResolvedValue(true);
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

describe('Settings navigation', () => {
  it('renders tab navigation and defaults to Security section', async () => {
    renderSettings();
    await waitFor(() => {
      expect(api.getCanvasSettings).toHaveBeenCalled();
      expect(api.getAILimits).toHaveBeenCalled();
      expect(mockGetPushPreferences).toHaveBeenCalled();
    });

    // Security is the default active section
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();

    // Tab navigation is present with all 8 sections
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(8);
  });

  it('navigates between sections via tabs', async () => {
    renderSettings();
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    // Default: Security
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();

    // Navigate to Riven AI
    navigateToSection('Riven AI');
    expect(await screen.findByRole('heading', { name: 'Riven AI' })).toBeInTheDocument();

    // Navigate to Help & policies
    navigateToSection('Help & policies');
    expect(await screen.findByRole('heading', { name: 'Help & policies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeInTheDocument();
  });
});

describe('Settings LMS sync', () => {
  it('renders the streamlined settings hierarchy for premium users', async () => {
    renderSettings();
    await waitFor(() => {
      expect(api.getCanvasSettings).toHaveBeenCalled();
      expect(api.getAILimits).toHaveBeenCalled();
      expect(mockGetPushPreferences).toHaveBeenCalled();
    });

    // Security is default
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();

    // Navigate to Plan & access
    navigateToSection('Plan & access');
    expect(await screen.findByRole('heading', { name: 'Plan & access' })).toBeInTheDocument();

    // Navigate to Integrations
    navigateToSection('Integrations');
    expect(await screen.findByRole('heading', { name: 'Integrations' })).toBeInTheDocument();

    // Navigate to Riven AI
    navigateToSection('Riven AI');
    expect(await screen.findByRole('heading', { name: 'Riven AI' })).toBeInTheDocument();

    // Navigate to Notifications
    navigateToSection('Notifications');
    await waitFor(() => {
      expect(screen.getByText(/assignment reminders at 24h, 12h, 3h, 1h & 30m/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Garden streak rescue')).toBeInTheDocument();
    expect(screen.getByText('Come back nudges')).toBeInTheDocument();

    // Navigate to Help & policies
    navigateToSection('Help & policies');
    expect(await screen.findByRole('heading', { name: 'Help & policies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeInTheDocument();

    // Verify removed sections don't exist
    expect(screen.queryByRole('heading', { name: 'Workspace snapshot' })).not.toBeInTheDocument();
    expect(screen.queryByText('Control center')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Theme & atmosphere' })).not.toBeInTheDocument();
    expect(screen.queryByText('Settings atlas')).not.toBeInTheDocument();
  });

  it('opens and closes the feedback modal from help and policies', async () => {
    renderSettings();
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Help & policies');
    fireEvent.click(await screen.findByRole('button', { name: /send feedback/i }));

    expect(screen.getByRole('heading', { name: /shape what comes next/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /shape what comes next/i })).not.toBeInTheDocument();
    });
  });

  it('blocks empty feedback submissions in the composer modal', async () => {
    renderSettings();
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Help & policies');
    fireEvent.click(await screen.findByRole('button', { name: /send feedback/i }));

    expect(screen.getByRole('button', { name: /^send feedback$/i })).toBeDisabled();
    expect(api.submitFeedback).not.toHaveBeenCalled();
  });

  it('submits feedback suggestions from the settings modal', async () => {
    renderSettings();
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Help & policies');
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
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Integrations');

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
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Integrations');

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
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Integrations');

    expect(await screen.findByText(/canvas feed timed out during the last auto-sync/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /auto-sync every 12 hours/i }));

    await waitFor(() => {
      expect(api.setCanvasAutoSync).toHaveBeenCalledWith(false);
    });

    expect(await screen.findByText(/canvas will stay connected, but new imports will wait for a manual sync/i)).toBeInTheDocument();
  });

  it('requests iPhone push permission before enabling message pushes', async () => {
    mockGetPushPreferences.mockResolvedValue({
      messagesEnabled: false,
      streakEnabled: true,
      reengagementEnabled: true,
    });

    renderSettings();
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Notifications');

    const messagesToggle = await screen.findByText('Messages');
    fireEvent.click(messagesToggle.closest('button'));

    await waitFor(() => {
      expect(pushNotifications.requestPushPermissions).toHaveBeenCalled();
      expect(pushNotifications.registerPushNotifications).toHaveBeenCalled();
      expect(mockUpdatePushPreferences).toHaveBeenCalledWith({
        messagesEnabled: true,
        streakEnabled: true,
        reengagementEnabled: true,
      });
    });
  });

  it('shows the current plan without the extra lifetime membership card', async () => {
    mockUser.subscription_tier = 'lifetime';

    renderSettings();
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Plan & access');

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
    await waitFor(() => expect(api.getAILimits).toHaveBeenCalled());

    navigateToSection('Riven AI');

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
    await waitFor(() => expect(api.getCanvasSettings).toHaveBeenCalled());

    navigateToSection('Plan & access');

    const copyButton = await screen.findByRole('button', { name: /copy code/i });
    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('RIVEN123');
    expect(await screen.findByText(/code copied/i)).toBeInTheDocument();
    expect(screen.getByText(/share it with a friend/i)).toBeInTheDocument();
  });
});
