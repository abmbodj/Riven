import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import OAuthButtons from './OAuthButtons.jsx';

const startGoogleOAuth = vi.fn();
const signInWithGoogle = vi.fn();
const signInWithNativeGoogle = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('../../lib/googleSignInNative', () => ({
  signInWithNativeGoogle: (...args) => signInWithNativeGoogle(...args),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    startGoogleOAuth,
    signInWithGoogle,
  }),
}));

describe('OAuthButtons', () => {
  beforeEach(() => {
    startGoogleOAuth.mockReset();
    signInWithGoogle.mockReset();
    signInWithNativeGoogle.mockReset();
    Capacitor.isNativePlatform.mockReturnValue(false);
  });

  it('starts Google OAuth from the custom button on web clients', async () => {
    startGoogleOAuth.mockResolvedValue(undefined);

    render(<OAuthButtons />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    expect(googleButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(googleButton);
    });

    await vi.waitFor(() => {
      expect(startGoogleOAuth).toHaveBeenCalledTimes(1);
    });
    expect(signInWithNativeGoogle).not.toHaveBeenCalled();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it('uses native Google Sign-In and Supabase id-token login on Capacitor', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    signInWithNativeGoogle.mockResolvedValue('mock-id-token');
    signInWithGoogle.mockResolvedValue({ id: 1 });

    render(<OAuthButtons />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    expect(googleButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(googleButton);
    });

    await vi.waitFor(() => {
      expect(signInWithNativeGoogle).toHaveBeenCalledTimes(1);
    });
    expect(signInWithGoogle).toHaveBeenCalledWith('mock-id-token');
    expect(startGoogleOAuth).not.toHaveBeenCalled();
  });
});
