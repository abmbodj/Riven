import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionExpiredModal from './SubscriptionExpiredModal.jsx';

const {
    authState,
    getUserNotifications,
    dismissUserNotification,
    navigateMock,
} = vi.hoisted(() => ({
    authState: {
        isLoggedIn: true,
    },
    getUserNotifications: vi.fn(),
    dismissUserNotification: vi.fn(),
    navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        ...authState,
        getUserNotifications,
        dismissUserNotification,
    }),
}));

vi.mock('./ui/ModalSurface', () => ({
    default: ({ isOpen, title, description, footer, children, onClose }) => (
        isOpen ? (
            <div role="dialog" aria-label={title}>
                <button type="button" onClick={onClose}>Close dialog</button>
                <h2>{title}</h2>
                <p>{description}</p>
                <div>{children}</div>
                <div>{footer}</div>
            </div>
        ) : null
    ),
}));

const renderModal = () => render(
    <MemoryRouter>
        <SubscriptionExpiredModal />
    </MemoryRouter>
);

describe('SubscriptionExpiredModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authState.isLoggedIn = true;
        getUserNotifications.mockResolvedValue([
            {
                id: 41,
                kind: 'subscription_expired',
                title: 'Your Pro access has ended',
                content: 'Your billing period has ended, so paid Pro features are no longer active on this account.',
            },
        ]);
        dismissUserNotification.mockResolvedValue({ message: 'Notification dismissed' });
    });

    it('opens for unread subscription-expired notifications and dismisses them once', async () => {
        renderModal();

        expect(await screen.findByRole('dialog', { name: /your pro access has ended/i })).toBeInTheDocument();
        expect(screen.getByText(/free plan active/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /keep studying/i }));

        await waitFor(() => {
            expect(dismissUserNotification).toHaveBeenCalledWith(41);
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: /your pro access has ended/i })).not.toBeInTheDocument();
        });
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it('routes to settings after dismissing from the view-plans action', async () => {
        renderModal();

        expect(await screen.findByRole('dialog', { name: /your pro access has ended/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /view plans/i }));

        await waitFor(() => {
            expect(dismissUserNotification).toHaveBeenCalledWith(41);
        });
        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/settings');
        });
    });

    it('stays hidden when there is no matching unread notification', async () => {
        getUserNotifications.mockResolvedValue([
            {
                id: 9,
                kind: 'feedback_considering',
                title: 'Feedback update',
                content: 'Thanks for the note.',
            },
        ]);

        renderModal();

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });
});
