import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserNotificationsRail from './UserNotificationsRail.jsx';

const {
  authState,
  getUserNotifications,
  dismissUserNotification,
} = vi.hoisted(() => ({
  authState: {
    isLoggedIn: true,
  },
  getUserNotifications: vi.fn(),
  dismissUserNotification: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    ...authState,
    getUserNotifications,
    dismissUserNotification,
  }),
}));

const renderRail = () => render(
  <MemoryRouter>
    <UserNotificationsRail />
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  authState.isLoggedIn = true;
  getUserNotifications.mockResolvedValue([
    {
      id: 9,
      kind: 'feedback_considering',
      title: 'Your feedback is being considered',
      content: 'Thanks for helping shape Riven. The owner is reviewing your suggestion now.',
      createdAt: '2026-03-21T16:30:00.000Z',
    },
  ]);
  dismissUserNotification.mockResolvedValue({ message: 'Notification dismissed' });
});

describe('UserNotificationsRail', () => {
  it('renders active targeted notifications and dismisses them', async () => {
    renderRail();

    expect(await screen.findByText(/your feedback is being considered/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /user notifications/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss your feedback is being considered/i }));

    await waitFor(() => {
      expect(dismissUserNotification).toHaveBeenCalledWith(9);
    });
    await waitFor(() => {
      expect(screen.queryByText(/your feedback is being considered/i)).not.toBeInTheDocument();
    });
  });

  it('stays hidden for logged-out users', async () => {
    authState.isLoggedIn = false;

    renderRail();

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /user notifications/i })).not.toBeInTheDocument();
    });
  });
});
