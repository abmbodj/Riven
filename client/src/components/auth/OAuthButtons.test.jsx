import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import OAuthButtons from './OAuthButtons.jsx';

const startGoogleOAuth = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    startGoogleOAuth,
  }),
}));

describe('OAuthButtons', () => {
  beforeEach(() => {
    startGoogleOAuth.mockReset();
    Capacitor.isNativePlatform.mockReturnValue(false);
  });

  it('starts Google OAuth from the custom button on web clients', () => {
    render(<OAuthButtons />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    expect(googleButton).not.toBeDisabled();

    fireEvent.click(googleButton);

    expect(startGoogleOAuth).toHaveBeenCalledTimes(1);
  });

  it('keeps Google OAuth disabled on native clients with staged-support copy', () => {
    Capacitor.isNativePlatform.mockReturnValue(true);

    render(<OAuthButtons />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    expect(googleButton).toBeDisabled();
    expect(screen.getByText(/available on web and pwa/i)).toBeInTheDocument();
  });
});
