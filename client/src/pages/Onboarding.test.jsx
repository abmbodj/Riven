import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UIContext } from '../context/UIContext';
import Onboarding from './Onboarding.jsx';

const mockNavigate = vi.fn();
const mockSaveOnboardingProgress = vi.fn();
const mockSignUp = vi.fn();
const mockToastError = vi.fn();
const trackOnboarding = vi.fn();
const generateDeckPreview = vi.fn();
const savePreviewDeck = vi.fn();
const setOnboardingMaterial = vi.fn();

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
        loading: false,
        signUp: mockSignUp,
        saveOnboardingProgress: mockSaveOnboardingProgress,
    }),
}));

vi.mock('../hooks/useToast', () => ({
    useToast: () => ({ error: mockToastError, success: vi.fn(), show: vi.fn() }),
}));

vi.mock('../hooks/useHaptics', () => ({
    default: () => ({ light: vi.fn(), medium: vi.fn(), heavy: vi.fn(), success: vi.fn(), error: vi.fn(), selection: vi.fn() }),
}));

vi.mock('../utils/onboardingGate', () => ({
    isMobileOnboardingEligible: vi.fn(() => true),
    userNeedsOnboarding: vi.fn(() => true),
    canUseOnboardingFunnel: vi.fn(() => true),
    setOnboardingMaterial: (...args) => setOnboardingMaterial(...args),
}));

vi.mock('../api/onboardingApi', () => ({
    generateDeckPreview: (...args) => generateDeckPreview(...args),
    savePreviewDeck: (...args) => savePreviewDeck(...args),
}));

vi.mock('../utils/onboardingAnalytics', () => ({
    trackOnboarding: (...args) => trackOnboarding(...args),
}));

vi.mock('../utils/matchMediaSubscribe', () => ({
    subscribeMediaQueryList: vi.fn(() => () => {}),
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

describe('Onboarding (activation flow)', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockSaveOnboardingProgress.mockReset().mockResolvedValue({});
        mockSignUp.mockReset();
        mockToastError.mockReset();
        trackOnboarding.mockReset();
        generateDeckPreview.mockReset();
        savePreviewDeck.mockReset().mockResolvedValue({ id: 10 });
        setOnboardingMaterial.mockReset();
        mockUser = { id: 1, onboardingStep: 0, onboardingCompletedAt: null };

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

    it('opens on the promise screen with the magic-moment CTA', () => {
        renderOnboarding();
        expect(screen.getByText(/walk out ready/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    });

    it('runs the full magic loop: topic → generate → taste → save → reveal → dashboard', async () => {
        generateDeckPreview.mockResolvedValue({
            topic: 'Photosynthesis',
            deckName: 'Photosynthesis',
            cards: [
                { front: 'Q1', back: 'A1', position: 0 },
                { front: 'Q2', back: 'A2', position: 1 },
                { front: 'Q3', back: 'A3', position: 2 },
            ],
        });

        renderOnboarding();

        // S1 promise → S2 topic
        fireEvent.click(screen.getByRole('button', { name: /get started/i }));
        const input = await screen.findByLabelText(/what are you studying/i);
        fireEvent.change(input, { target: { value: 'Photosynthesis' } });

        // S2 → S3 generate (kicks off the anonymous preview)
        fireEvent.click(screen.getByRole('button', { name: /make my set/i }));
        await waitFor(() => expect(generateDeckPreview).toHaveBeenCalledWith('Photosynthesis'));

        // Reveal → S4 taste
        fireEvent.click(await screen.findByRole('button', { name: /see my cards/i }));

        // Answer 3 cards (reveal then "Got it")
        for (let i = 0; i < 3; i += 1) {
            fireEvent.click(await screen.findByText(`Q${i + 1}`));
            fireEvent.click(await screen.findByRole('button', { name: /got it/i }));
        }

        // Save (signed-in path): persists the previewed deck + marks complete, then reveals
        const saveBtn = await screen.findByRole('button', { name: /save & keep going/i });
        await waitFor(() => expect(saveBtn).not.toBeDisabled());
        fireEvent.click(saveBtn);

        await waitFor(() => expect(savePreviewDeck).toHaveBeenCalledWith('Photosynthesis', expect.any(Array)));
        await waitFor(() => expect(mockSaveOnboardingProgress).toHaveBeenCalledWith({ markComplete: true }));

        // S5 canvas (optional, non-premium path shows upsell — skip it)
        fireEvent.click(await screen.findByRole('button', { name: /skip for now/i }));

        // S6 capabilities reveal (material question doubles as the hero tile)
        const audioTile = await screen.findByRole('button', { name: /record a lecture/i });
        fireEvent.click(audioTile);
        expect(setOnboardingMaterial).toHaveBeenCalledWith('audio');

        // Finish → dashboard
        fireEvent.click(screen.getByRole('button', { name: /start studying/i }));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
    });
});
