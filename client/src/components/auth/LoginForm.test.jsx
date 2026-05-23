/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm';

const mocks = vi.hoisted(() => ({
    signIn: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => false,
    },
}));

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        signIn: mocks.signIn,
    }),
}));

vi.mock('../../hooks/useToast', () => ({
    useToast: () => ({
        success: vi.fn(),
    }),
}));

vi.mock('../../hooks/useHaptics', () => ({
    default: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('./OAuthButtons', () => ({
    default: ({ keepSignedIn }) => (
        <div data-testid="oauth-buttons" data-keep-signed-in={String(keepSignedIn)} />
    ),
}));

const setMobileMatchMedia = (isMobile) => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: isMobile && (
            query.includes('max-width: 1023px')
            || query.includes('any-pointer: coarse')
        ),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
};

const renderLoginForm = () => render(
    <MemoryRouter>
        <LoginForm onSwitchToSignup={vi.fn()} onLoginSuccess={vi.fn()} />
    </MemoryRouter>
);

describe('LoginForm keep signed in', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.signIn.mockResolvedValue({ id: 7 });
        Object.defineProperty(navigator, 'maxTouchPoints', {
            configurable: true,
            value: 1,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows a mobile-only keep signed in checkbox that defaults on', () => {
        setMobileMatchMedia(true);

        renderLoginForm();

        const checkbox = screen.getByRole('checkbox', { name: /keep me signed in/i });
        expect(checkbox).toBeChecked();
        expect(screen.getByTestId('oauth-buttons')).toHaveAttribute('data-keep-signed-in', 'true');
    });

    it('hides the keep signed in checkbox on desktop-class clients', () => {
        setMobileMatchMedia(false);
        Object.defineProperty(navigator, 'maxTouchPoints', {
            configurable: true,
            value: 0,
        });

        renderLoginForm();

        expect(screen.queryByRole('checkbox', { name: /keep me signed in/i })).not.toBeInTheDocument();
    });

    it('passes the unchecked keep signed in state to email and OAuth sign-in paths', async () => {
        setMobileMatchMedia(true);

        renderLoginForm();

        fireEvent.click(screen.getByRole('checkbox', { name: /keep me signed in/i }));
        expect(screen.getByTestId('oauth-buttons')).toHaveAttribute('data-keep-signed-in', 'false');

        fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
            target: { value: 'atlas@example.com' },
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'password123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^enter$/i }));

        await waitFor(() => {
            expect(mocks.signIn).toHaveBeenCalledWith('atlas@example.com', 'password123', {
                keepSignedIn: false,
            });
        });
    });
});
