import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';

const {
    restoreSessionUserMock,
    getThemesMock,
    useGSAPMock,
} = vi.hoisted(() => ({
    restoreSessionUserMock: vi.fn(),
    getThemesMock: vi.fn(),
    useGSAPMock: vi.fn(),
}));

const activeTheme = {
    id: 1,
    name: 'Sage Temple',
    bg_color: '#0f1b17',
    surface_color: '#16261f',
    text_color: '#edf4ee',
    secondary_text_color: '#93aa9e',
    border_color: '#2a3b33',
    accent_color: '#7dde82',
    font_family_display: 'Cormorant Garamond',
    font_family_body: 'Lora',
    is_active: true,
};

vi.mock('./api/authApi', () => ({
    AUTH_SESSION_EXPIRED_CODE: 'AUTH_SESSION_EXPIRED',
    AUTH_SESSION_EXPIRED_EVENT: 'riven-auth-session-expired',
    restoreSessionUser: restoreSessionUserMock,
    hydrateUserIfOnboardingMissing: vi.fn(async (user) => user),
    setToken: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./api', () => ({
    api: {
        getThemes: getThemesMock,
        getDecks: vi.fn().mockResolvedValue([]),
        getClasses: vi.fn().mockResolvedValue([]),
        getFriends: vi.fn().mockResolvedValue([]),
        getGroups: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('./lib/supabaseClient', () => ({
    supabase: {
        auth: {
            onAuthStateChange: vi.fn(() => ({
                data: {
                    subscription: {
                        unsubscribe: vi.fn(),
                    },
                },
            })),
        },
    },
}));

vi.mock('./hooks/useGSAP', () => ({
    useGSAP: (...args) => useGSAPMock(...args),
}));

function renderAppAt(pathname) {
    window.history.pushState({}, '', pathname);
    return render(
        <ToastProvider>
            <App />
        </ToastProvider>
    );
}

describe('App bootstrap smoke tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        restoreSessionUserMock.mockResolvedValue(null);
        getThemesMock.mockResolvedValue([activeTheme]);
        useGSAPMock.mockImplementation(() => ({ container: { current: null } }));
        delete window.__RIVEN_LAST_APP_ERROR;
    });

    afterEach(() => {
        window.history.pushState({}, '', '/');
        delete window.__RIVEN_LAST_APP_ERROR;
    });

    it('mounts the landing route without showing the error boundary', async () => {
        const { container } = renderAppAt('/');

        await screen.findByText('Cultivated by Riven');

        await waitFor(() => {
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        });

        expect(container.querySelectorAll('.p-mote').length).toBeGreaterThan(0);
        expect(window.__RIVEN_LAST_APP_ERROR).toBeUndefined();
    });

    it('mounts the account route without showing the error boundary', async () => {
        const { container } = renderAppAt('/account');

        await screen.findByRole('heading', { name: 'Log in' });

        await waitFor(() => {
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        });

        expect(container.querySelectorAll('.p-mote').length).toBeGreaterThan(0);
        expect(window.__RIVEN_LAST_APP_ERROR).toBeUndefined();
    });
});
