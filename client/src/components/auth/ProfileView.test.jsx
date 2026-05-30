import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileView from './ProfileView.jsx';

const {
    mockSignOut,
    mockGetFriends,
    mockGetUnreadCount,
    mockToast,
    mockHaptics,
    mockGetManagementPortalUrl,
    authState,
} = vi.hoisted(() => ({
    mockSignOut: vi.fn(),
    mockGetFriends: vi.fn(),
    mockGetUnreadCount: vi.fn(),
    mockGetManagementPortalUrl: vi.fn(),
    mockToast: {
        success: vi.fn(),
        error: vi.fn(),
    },
    mockHaptics: {
        light: vi.fn(),
        medium: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    },
    authState: {
        isOwner: false,
        isAdmin: false,
        user: {
            username: 'aurora',
            displayName: 'Aurora Vale',
            bio: 'Growing calm systems.',
            avatar: '/avatar.png',
            banner: '/banner.png',
            subscription_tier: 'supporter',
            base_subscription_tier: 'supporter',
            premium_access_source: 'subscription',
            has_manageable_subscription: true,
            stripe_customer_id: 'cus_123',
            stripe_subscription_id: 'sub_123',
        },
    },
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => false,
    },
}));

vi.mock('motion/react', () => {
    const createMotionComponent = (tag) => React.forwardRef(
        ({ children, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)
    );

    return {
        motion: new Proxy({}, {
            get: (_, tag) => createMotionComponent(tag),
        }),
    };
});

vi.mock('../../api/stripe', () => ({
    getManagementPortalUrl: mockGetManagementPortalUrl,
}));

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        ...authState,
        signOut: mockSignOut,
    }),
}));

vi.mock('../../hooks/useToast', () => ({
    useToast: () => mockToast,
}));

vi.mock('../../hooks/useHaptics', () => ({
    default: () => mockHaptics,
}));

vi.mock('../Avatar', () => ({
    default: ({ className }) => <div data-testid="avatar" className={className} />,
}));

vi.mock('../../api/authApi', () => ({
    getFriends: mockGetFriends,
    getUnreadCount: mockGetUnreadCount,
}));

const renderProfile = () => render(
    <MemoryRouter>
        <ProfileView />
    </MemoryRouter>
);

describe('ProfileView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authState.isOwner = false;
        authState.isAdmin = false;
        authState.user = {
            username: 'aurora',
            displayName: 'Aurora Vale',
            bio: 'Growing calm systems.',
            avatar: '/avatar.png',
            banner: '/banner.png',
            subscription_tier: 'supporter',
            base_subscription_tier: 'supporter',
            premium_access_source: 'subscription',
            has_manageable_subscription: true,
            stripe_customer_id: 'cus_123',
            stripe_subscription_id: 'sub_123',
        };
        mockGetManagementPortalUrl.mockResolvedValue(null);
        mockGetFriends.mockResolvedValue([
            { id: 1, status: 'accepted' },
            { id: 2, status: 'pending' },
        ]);
        mockGetUnreadCount.mockResolvedValue({ count: 3 });
    });

    it('renders the account profile actions with the local mobile glass treatment', async () => {
        const { container } = renderProfile();

        expect(screen.getByRole('heading', { name: 'Aurora Vale' })).toBeInTheDocument();
        expect(screen.getByText('@aurora')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /edit profile/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

        await waitFor(() => {
            expect(mockGetFriends).toHaveBeenCalledWith();
            expect(mockGetUnreadCount).toHaveBeenCalledWith(authState.user);
        });

        expect(container.querySelector('.profile-mobile-glass-shell')).not.toBeNull();
        expect(container.querySelector('.profile-mobile-glass-menu')).not.toBeNull();
        expect(screen.getByRole('link', { name: /friends/i }).className).toContain('profile-mobile-glass-card');
        expect(screen.getByRole('link', { name: /edit profile/i }).className).toContain('profile-mobile-glass-row');
        expect(screen.getByRole('button', { name: /sign out/i }).className).toContain('profile-mobile-glass-row');
    });

    it('shows manage subscription only for users with a billable recurring plan', async () => {
        renderProfile();

        const manageButton = screen.getByRole('button', { name: /manage subscription/i });
        expect(manageButton).toBeInTheDocument();
        expect(screen.queryByText(/premium access included/i)).not.toBeInTheDocument();

        fireEvent.click(manageButton);

        await waitFor(() => {
            expect(mockGetManagementPortalUrl).toHaveBeenCalledWith();
        });
    });

    it('shows an informational premium row instead of manage subscription for admin-included access', async () => {
        authState.isOwner = true;
        authState.isAdmin = true;
        authState.user = {
            ...authState.user,
            subscription_tier: 'lifetime',
            base_subscription_tier: 'free',
            premium_access_source: 'owner_included',
            has_manageable_subscription: false,
            stripe_customer_id: null,
            stripe_subscription_id: null,
        };

        renderProfile();

        await waitFor(() => {
            expect(mockGetFriends).toHaveBeenCalledWith();
        });

        expect(screen.queryByRole('button', { name: /manage subscription/i })).not.toBeInTheDocument();
        expect(screen.getByText(/premium access included/i)).toBeInTheDocument();
        expect(screen.getByText(/included with your owner role/i)).toBeInTheDocument();
    });

    it('shows lifetime access copy for non-recurring premium users', async () => {
        authState.user = {
            ...authState.user,
            subscription_tier: 'lifetime',
            base_subscription_tier: 'lifetime',
            premium_access_source: 'lifetime',
            has_manageable_subscription: false,
            stripe_customer_id: null,
            stripe_subscription_id: null,
        };

        renderProfile();

        await waitFor(() => {
            expect(mockGetFriends).toHaveBeenCalledWith();
        });

        expect(screen.queryByRole('button', { name: /manage subscription/i })).not.toBeInTheDocument();
        expect(screen.getByText(/lifetime access active/i)).toBeInTheDocument();
        expect(screen.getByText(/no recurring subscription to manage/i)).toBeInTheDocument();
    });
});
