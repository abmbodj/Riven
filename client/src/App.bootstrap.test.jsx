import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';

vi.mock('@capacitor/core', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        Capacitor: {
            ...actual.Capacitor,
            isNativePlatform: () => false,
            getPlatform: () => 'web',
        },
        registerPlugin: vi.fn(() => ({})),
    };
});

const {
    restoreSessionUserMock,
    getThemesMock,
    useGSAPMock,
    updateServiceWorkerMock,
    pwaState,
} = vi.hoisted(() => ({
    restoreSessionUserMock: vi.fn(),
    getThemesMock: vi.fn(),
    useGSAPMock: vi.fn(),
    updateServiceWorkerMock: vi.fn().mockResolvedValue(true),
    pwaState: {
        needRefresh: false,
    },
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

vi.mock('./api/themeApi.js', () => ({
    themeApi: {
        getThemes: getThemesMock,
        activateTheme: vi.fn(),
        createTheme: vi.fn(),
        updateTheme: vi.fn(),
        deleteTheme: vi.fn(),
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

vi.mock('./lib/pwaRegister.js', () => ({
    useRegisterSW: () => ({
        needRefresh: [pwaState.needRefresh, vi.fn()],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: updateServiceWorkerMock,
    }),
}));

function renderAppAt(pathname) {
    window.history.pushState({}, '', pathname);
    return render(
        <ToastProvider>
            <App />
        </ToastProvider>
    );
}

function findLandingReady() {
    return screen.findByRole('heading', { name: 'Riven', level: 1 }, { timeout: 3000 });
}

describe('App bootstrap smoke tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        restoreSessionUserMock.mockResolvedValue(null);
        getThemesMock.mockResolvedValue([activeTheme]);
        useGSAPMock.mockImplementation(() => ({ container: { current: null } }));
        updateServiceWorkerMock.mockResolvedValue(true);
        pwaState.needRefresh = false;
        window.scrollTo = vi.fn();
        delete window.__RIVEN_LAST_APP_ERROR;
    });

    afterEach(() => {
        window.history.pushState({}, '', '/');
        delete window.__RIVEN_LAST_APP_ERROR;
    });

    it('mounts the landing route without showing the error boundary', async () => {
        renderAppAt('/');

        await findLandingReady();

        await waitFor(() => {
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        });

        expect(window.__RIVEN_LAST_APP_ERROR).toBeUndefined();
    });

    it('mounts the account route without showing the error boundary', async () => {
        renderAppAt('/account');

        await screen.findByRole('heading', { name: 'Log in' });

        await waitFor(() => {
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        });

        expect(window.__RIVEN_LAST_APP_ERROR).toBeUndefined();
    });

    it('does not show the update banner when no new web build is waiting', async () => {
        renderAppAt('/');

        await findLandingReady();

        expect(screen.queryByText('Refresh now')).not.toBeInTheDocument();
    });

    it('shows the update banner and refreshes the service worker when a new web build is ready', async () => {
        pwaState.needRefresh = true;
        renderAppAt('/');

        await findLandingReady();

        const refreshButton = await screen.findByRole('button', { name: 'Refresh now' });
        fireEvent.click(refreshButton);

        await waitFor(() => {
            expect(updateServiceWorkerMock).toHaveBeenCalledTimes(1);
        });
    });

    it('hides the update banner after Later is clicked while the same build is still waiting', async () => {
        pwaState.needRefresh = true;
        renderAppAt('/');

        await findLandingReady();

        fireEvent.click(await screen.findByRole('button', { name: 'Later' }));

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Refresh now' })).not.toBeInTheDocument();
        });
    });
});
