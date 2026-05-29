import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import EditProfile from './EditProfile.jsx';

const {
    mockNavigate,
    mockUpdateProfile,
    mockToast,
    mockHaptics,
    mockUser,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockUpdateProfile: vi.fn(),
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
        username: 'atlas',
        displayName: 'Atlas',
        bio: 'Quietly building',
        avatar: '/avatar.png',
        banner: '/banner.png',
        email: 'atlas@riven.app',
    },
}));

vi.mock('motion/react', () => {
    const createMotionComponent = (tag) => React.forwardRef(
        ({ children, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)
    );

    return {
        AnimatePresence: ({ children }) => <>{children}</>,
        motion: new Proxy({}, {
            get: (_, tag) => createMotionComponent(tag),
        }),
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: mockUser,
        updateProfile: mockUpdateProfile,
    }),
}));

vi.mock('../hooks/useToast', () => ({
    useToast: () => mockToast,
}));

vi.mock('../hooks/useHaptics', () => ({
    default: () => mockHaptics,
}));

vi.mock('../hooks/useGSAP', () => ({
    useGSAP: () => ({}),
}));

vi.mock('../components/AvatarPicker', () => ({
    default: () => <div data-testid="avatar-picker">Avatar Picker Open</div>,
}));

vi.mock('../components/BannerPicker', () => ({
    default: () => <div data-testid="banner-picker">Banner Picker Open</div>,
}));

describe('EditProfile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdateProfile.mockResolvedValue({
            ...mockUser,
        });
    });

    const renderEditProfile = () => render(
        <MemoryRouter>
            <EditProfile />
        </MemoryRouter>
    );

    it('renders the refreshed profile studio sections', () => {
        renderEditProfile();

        expect(screen.getByRole('heading', { name: 'Edit Profile' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Core profile details' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Bio' })).toBeInTheDocument();
        expect(screen.getByText('Profile Studio')).toBeInTheDocument();
        expect(screen.queryByText('Live Card')).not.toBeInTheDocument();
        expect(screen.queryByText('Publishing Notes')).not.toBeInTheDocument();

        const avatarButton = screen.getAllByRole('button', { name: 'Change avatar' })[0];
        const bannerButton = screen.getAllByRole('button', { name: 'Change banner' })[0];

        expect(within(avatarButton).getByText('Avatar')).toBeInTheDocument();
        expect(within(bannerButton).getByText('Banner')).toBeInTheDocument();
    });

    it('renders a dedicated mobile save bar', () => {
        renderEditProfile();

        const mobileSaveBar = screen.getByTestId('edit-profile-mobile-save-bar');

        expect(within(mobileSaveBar).getByText('Publish State')).toBeInTheDocument();
        expect(within(mobileSaveBar).getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    });

    it('keeps the desktop publish card interactive inside the hero overlay', () => {
        renderEditProfile();

        const publishStateLabels = screen.getAllByText('Publish State');
        const desktopPublishCard = publishStateLabels[0].closest('div[class*="pointer-events-auto"]');

        expect(desktopPublishCard).not.toBeNull();
        expect(within(desktopPublishCard).getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    });

    it('opens the avatar picker from the media action button', () => {
        renderEditProfile();

        expect(screen.queryByTestId('avatar-picker')).not.toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'Change avatar' })[0]);

        expect(screen.getByTestId('avatar-picker')).toBeInTheDocument();
    });

    it('opens the banner picker from the media action button', () => {
        renderEditProfile();

        expect(screen.queryByTestId('banner-picker')).not.toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'Change banner' })[0]);

        expect(screen.getByTestId('banner-picker')).toBeInTheDocument();
    });

    it('saves normalized profile data and allows an empty bio', async () => {
        renderEditProfile();

        fireEvent.change(screen.getByLabelText('Display Name'), {
            target: { value: 'Atlas Prime' },
        });
        fireEvent.change(screen.getByPlaceholderText(/a line about what you are studying/i), {
            target: { value: '   ' },
        });

        const saveButton = screen
            .getAllByRole('button', { name: /^save$/i })
            .find((button) => !button.disabled);

        expect(saveButton).toBeDefined();
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(mockUpdateProfile).toHaveBeenCalledWith({
                username: 'atlas',
                displayName: 'Atlas Prime',
                bio: '',
                avatar: '/avatar.png',
                banner: '/banner.png',
            });
        });

        expect(mockToast.success).toHaveBeenCalledWith('Profile updated');
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
