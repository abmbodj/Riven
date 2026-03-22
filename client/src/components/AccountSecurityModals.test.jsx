import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import TwoFactorAuthModal from './TwoFactorAuthModal.jsx';
import DeleteAccountModal from './DeleteAccountModal.jsx';

const {
    mockNavigate,
    mockToast,
    mockAuthState,
    mockAuthApi,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockToast: {
        success: vi.fn(),
        error: vi.fn(),
    },
    mockAuthState: {
        user: { twoFAEnabled: false },
        changePassword: vi.fn(),
        deleteAccount: vi.fn(),
        refreshUser: vi.fn(),
    },
    mockAuthApi: {
        getActiveTwoFactorProvider: vi.fn(),
        setup2FA: vi.fn(),
        verify2FA: vi.fn(),
        disable2FA: vi.fn(),
    },
}));

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => mockAuthState,
}));

vi.mock('../hooks/useToast', () => ({
    useToast: () => mockToast,
}));

vi.mock('../api/authApi', () => mockAuthApi);

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const renderWithRouter = (ui) => render(
    <MemoryRouter>
        {ui}
    </MemoryRouter>
);

describe('account security modals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState.user = { twoFAEnabled: false };
        mockAuthState.changePassword.mockResolvedValue(undefined);
        mockAuthState.deleteAccount.mockResolvedValue(undefined);
        mockAuthState.refreshUser.mockResolvedValue(undefined);
        mockAuthApi.getActiveTwoFactorProvider.mockResolvedValue('legacy');
        mockAuthApi.setup2FA.mockResolvedValue({
            secret: 'ABC123SECRET',
            qrCode: 'https://example.com/qr.png',
        });
        mockAuthApi.verify2FA.mockResolvedValue(undefined);
        mockAuthApi.disable2FA.mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn(),
            },
        });
    });

    it('renders the change password modal with the updated security fields', () => {
        renderWithRouter(<ChangePasswordModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
        expect(screen.getByText('Current Password')).toBeInTheDocument();
        expect(screen.getByText('New Password')).toBeInTheDocument();
        expect(screen.getByText('Confirm New Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
    });

    it('moves the two-factor modal from intro into the setup state', async () => {
        renderWithRouter(<TwoFactorAuthModal isOpen={true} onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /enable 2fa/i }));

        await waitFor(() => {
            expect(mockAuthApi.setup2FA).toHaveBeenCalled();
        });

        expect(await screen.findByAltText('QR Code')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /verify & enable/i })).toBeInTheDocument();
    });

    it('shows the disable confirmation view for users who already have two-factor enabled', async () => {
        mockAuthState.user = { twoFAEnabled: true };

        renderWithRouter(<TwoFactorAuthModal isOpen={true} onClose={vi.fn()} />);

        expect(await screen.findByRole('button', { name: /disable 2fa/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));

        expect(await screen.findByText(/disabling 2fa makes your account less secure/i)).toBeInTheDocument();
        expect(screen.getByText('Confirm Password')).toBeInTheDocument();
    });

    it('renders the delete account modal and gates deletion until a password is entered', () => {
        renderWithRouter(<DeleteAccountModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument();
        expect(screen.getByText(/permanent deletion/i)).toBeInTheDocument();

        const deleteButton = screen.getByRole('button', { name: /delete forever/i });
        expect(deleteButton).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText('Enter password...'), {
            target: { value: 'hunter2-password' },
        });

        expect(deleteButton).not.toBeDisabled();
    });
});
