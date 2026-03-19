import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileView from './ProfileView.jsx';

const {
    mockSignOut,
    mockGetFriends,
    mockGetUnreadCount,
    mockToast,
    mockHaptics,
    mockUser,
} = vi.hoisted(() => ({
    mockSignOut: vi.fn(),
    mockGetFriends: vi.fn(),
    mockGetUnreadCount: vi.fn(),
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
    mockUser: {
        username: 'aurora',
        displayName: 'Aurora Vale',
        bio: 'Growing calm systems.',
        avatar: '/avatar.png',
        banner: '/banner.png',
        subscription_tier: 'supporter',
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
    getManagementPortalUrl: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: mockUser,
        isOwner: false,
        isAdmin: false,
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

describe('ProfileView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetFriends.mockResolvedValue([
            { id: 1, status: 'accepted' },
            { id: 2, status: 'pending' },
        ]);
        mockGetUnreadCount.mockResolvedValue({ count: 3 });
    });

    it('renders the account profile actions with the local mobile glass treatment', async () => {
        const { container } = render(
            <MemoryRouter>
                <ProfileView />
            </MemoryRouter>
        );

        expect(screen.getByRole('heading', { name: 'Aurora Vale' })).toBeInTheDocument();
        expect(screen.getByText('@aurora')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /edit profile/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

        await waitFor(() => {
            expect(mockGetFriends).toHaveBeenCalledWith();
            expect(mockGetUnreadCount).toHaveBeenCalledWith(mockUser);
        });

        expect(container.querySelector('.profile-mobile-glass-shell')).not.toBeNull();
        expect(container.querySelector('.profile-mobile-glass-menu')).not.toBeNull();
        expect(screen.getByRole('link', { name: /friends/i }).className).toContain('profile-mobile-glass-card');
        expect(screen.getByRole('link', { name: /edit profile/i }).className).toContain('profile-mobile-glass-row');
        expect(screen.getByRole('button', { name: /sign out/i }).className).toContain('profile-mobile-glass-row');
    });
});
