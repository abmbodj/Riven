import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ResetPassword from './ResetPassword.jsx';
import VerifyEmail from './VerifyEmail.jsx';

const resetPassword = vi.fn();
const verifyEmail = vi.fn();

vi.mock('../api/authApi', () => ({
  resetPassword: (...args) => resetPassword(...args),
  verifyEmail: (...args) => verifyEmail(...args),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    show: vi.fn(),
  }),
}));

vi.mock('../components/AlertModal', () => ({
  default: () => null,
}));

vi.mock('../components/LoadingSpinner', () => ({
  default: () => <div>loading</div>,
}));

vi.mock('../components/auth/PasswordStrengthMeter', () => ({
  default: () => null,
}));

describe('Supabase auth token hash pages', () => {
  beforeEach(() => {
    resetPassword.mockReset();
    verifyEmail.mockReset();
  });

  it('submits the Supabase token hash from the reset-password URL', async () => {
    resetPassword.mockResolvedValue({});

    const { container } = render(
      <MemoryRouter initialEntries={['/reset-password?token_hash=supabase-hash']}>
        <ResetPassword />
      </MemoryRouter>
    );

    fireEvent.change(container.querySelector('#new-password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(container.querySelector('#confirm-new-password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith('supabase-hash', 'newpassword123');
    });
  });

  it('verifies the Supabase token hash from the verify-email URL', async () => {
    verifyEmail.mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={['/verify-email?token_hash=signup-hash']}>
        <VerifyEmail />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(verifyEmail).toHaveBeenCalledWith('signup-hash');
    });
  });
});
