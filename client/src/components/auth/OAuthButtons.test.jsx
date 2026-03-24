import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import OAuthButtons from './OAuthButtons.jsx';

const startGoogleOAuth = vi.fn();
const signInWithGoogle = vi.fn();
const signInWithApple = vi.fn();
const signInWithNativeGoogle = vi.fn();
const signInWithNativeApple = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

vi.mock('../../lib/googleSignInNative', () => ({
  signInWithNativeGoogle: (...args) => signInWithNativeGoogle(...args),
}));

vi.mock('../../lib/appleSignInNative', () => ({
  signInWithNativeApple: (...args) => signInWithNativeApple(...args),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    startGoogleOAuth,
    signInWithGoogle,
    signInWithApple,
  }),
}));

describe('OAuthButtons', () => {
  beforeEach(() => {
    startGoogleOAuth.mockReset();
    signInWithGoogle.mockReset();
    signInWithApple.mockReset();
    signInWithNativeGoogle.mockReset();
    signInWithNativeApple.mockReset();
    Capacitor.isNativePlatform.mockReturnValue(false);
    Capacitor.getPlatform.mockReturnValue('web');
  });

  it('starts Google OAuth from the custom button on web clients', async () => {
    startGoogleOAuth.mockResolvedValue(undefined);

    render(<OAuthButtons />);

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    expect(googleButton).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: /continue with apple/i })).toBeNull();

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
    Capacitor.getPlatform.mockReturnValue('android');
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
    expect(screen.queryByRole('button', { name: /continue with apple/i })).toBeNull();
  });

  it('shows Apple Sign-In only on native iOS and forwards nonce-backed credentials', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    Capacitor.getPlatform.mockReturnValue('ios');
    signInWithNativeApple.mockResolvedValue({
      identityToken: 'apple-id-token',
      rawNonce: 'raw-nonce',
      user: {
        givenName: 'Avery',
        familyName: 'Stone',
        name: { firstName: 'Avery', lastName: 'Stone' },
      },
    });
    signInWithApple.mockResolvedValue({ id: 1 });

    render(<OAuthButtons />);

    const appleButton = screen.getByRole('button', { name: /continue with apple/i });
    expect(appleButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(appleButton);
    });

    await vi.waitFor(() => {
      expect(signInWithNativeApple).toHaveBeenCalledTimes(1);
    });
    expect(signInWithApple).toHaveBeenCalledWith(
      'apple-id-token',
      'raw-nonce',
      expect.objectContaining({
        givenName: 'Avery',
        familyName: 'Stone',
      }),
    );
  });

  it('surfaces Apple Sign-In errors through the shared OAuth error handler', async () => {
    const onError = vi.fn();

    Capacitor.isNativePlatform.mockReturnValue(true);
    Capacitor.getPlatform.mockReturnValue('ios');
    signInWithNativeApple.mockRejectedValue(new Error('Apple sign-in failed'));

    render(<OAuthButtons onError={onError} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue with apple/i }));
    });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Apple sign-in failed',
      }));
    });
    expect(signInWithApple).not.toHaveBeenCalled();
  });
});
