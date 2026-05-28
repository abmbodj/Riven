import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UIContext } from '../context/UIContext';
import Onboarding from './Onboarding.jsx';

const mockNavigate = vi.fn();
const mockSaveOnboardingProgress = vi.fn();
const mockToastError = vi.fn();
const trackOnboarding = vi.fn();

let mockUser = {
    id: 1,
    onboardingStep: 0,
    onboardingCompletedAt: null,
};

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
        saveOnboardingProgress: mockSaveOnboardingProgress,
    }),
}));

vi.mock('../hooks/useToast', () => ({
    useToast: () => ({
        error: mockToastError,
        success: vi.fn(),
        show: vi.fn(),
    }),
}));

vi.mock('../utils/onboardingGate', () => ({
    isMobileOnboardingEligible: vi.fn(() => true),
    userNeedsOnboarding: vi.fn(() => true),
}));

vi.mock('../utils/onboardingAnalytics', () => ({
    trackOnboarding: (...args) => trackOnboarding(...args),
}));

vi.mock('../utils/matchMediaSubscribe', () => ({
    subscribeMediaQueryList: vi.fn(() => () => {}),
}));

vi.mock('../components/OnboardingArt', () => ({
    default: () => <div data-testid="onboarding-art" />,
}));

function renderOnboarding() {
    return render(
        <MemoryRouter>
            <UIContext.Provider value={{ hideNav: vi.fn(), showBottomNav: vi.fn() }}>
                <Onboarding />
            </UIContext.Provider>
        </MemoryRouter>,
    );
}

describe('Onboarding', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockSaveOnboardingProgress.mockReset();
        mockToastError.mockReset();
        trackOnboarding.mockReset();
        mockUser = {
            id: 1,
            onboardingStep: 0,
            onboardingCompletedAt: null,
        };

        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query) => ({
                matches: false,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
            })),
        });
    });

    it('lets the user choose an answer and advance to the next screen', async () => {
        mockSaveOnboardingProgress.mockResolvedValue({
            ...mockUser,
            onboardingStep: 1,
        });

        renderOnboarding();
        const layout = screen.getByTestId('onboarding-main-layout');

        expect(layout.className).not.toContain('justify-between');
        expect(layout.className).not.toContain('overflow-y-auto');
        expect(screen.queryByText(/riven mobile setup/i)).not.toBeInTheDocument();

        const examOption = screen.getByRole('button', { name: /get exam-ready faster/i });
        fireEvent.click(examOption);

        expect(examOption).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: /continue/i }));

        await waitFor(() => {
            expect(mockSaveOnboardingProgress).toHaveBeenCalledWith({ nextStep: 1 });
        });

        expect(trackOnboarding).toHaveBeenCalledWith('onboarding_continue', { fromStep: 0 });
        expect(await screen.findByText(/what do you usually/i)).toBeInTheDocument();
    });

    it('completes onboarding from the final screen and routes to Today', async () => {
        mockUser = {
            id: 1,
            onboardingStep: 2,
            onboardingCompletedAt: null,
        };
        mockSaveOnboardingProgress.mockResolvedValue({
            ...mockUser,
            onboardingCompletedAt: '2026-03-19T12:00:00.000Z',
        });

        renderOnboarding();

        fireEvent.click(screen.getByRole('button', { name: /go to today/i }));

        await waitFor(() => {
            expect(mockSaveOnboardingProgress).toHaveBeenCalledWith({ markComplete: true });
        });

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
        });
    });
});
