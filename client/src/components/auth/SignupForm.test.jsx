/* @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import SignupForm from './SignupForm';
const mocks = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.hoisted(() => { vi.stubEnv('VITE_SKIP_TURNSTILE', 'true'); });
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ signUp: mocks.signUp }) }));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('../../hooks/useHaptics', () => ({ default: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('./OAuthButtons', () => ({ default: () => null }));
it('asks for email confirmation without navigating into a signed-in account', async () => {
    mocks.signUp.mockResolvedValue({ requiresEmailConfirmation: true });
    const onSignupSuccess = vi.fn();
    render(<MemoryRouter><SignupForm onSwitchToLogin={vi.fn()} onSignupSuccess={onSignupSuccess} /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('e.g. scholar123'), { target: { value: 'atlas' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'atlas@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(onSignupSuccess).not.toHaveBeenCalled();
});
