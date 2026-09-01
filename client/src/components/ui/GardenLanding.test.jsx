import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GardenLanding from './GardenLanding.jsx';

const useGSAPMock = vi.fn();
const useMobileVisualBudgetMock = vi.fn();

vi.mock('../../hooks/useGSAP', () => ({
    useGSAP: (...args) => useGSAPMock(...args),
}));

vi.mock('../../hooks/useMobileVisualBudget', () => ({
    useMobileVisualBudget: () => useMobileVisualBudgetMock(),
}));

vi.mock('../../utils/onboardingGate', () => ({
    isMobileOnboardingEligible: () => false,
}));

describe('GardenLanding', () => {
    beforeEach(() => {
        useGSAPMock.mockReset();
        useMobileVisualBudgetMock.mockReset();
        useGSAPMock.mockImplementation(() => ({ container: { current: null } }));
        useMobileVisualBudgetMock.mockReturnValue(false);
    });

    it('passes the visual budget into useGSAP dependencies', () => {
        render(
            <MemoryRouter>
                <GardenLanding />
            </MemoryRouter>
        );

        expect(useGSAPMock).toHaveBeenCalledTimes(1);
        expect(useGSAPMock.mock.calls[0][1]).toEqual([false]);
    });

    it('renders the screenshot placeholders and redesigned pricing below the hero', () => {
        const { getAllByRole, getAllByText, getByRole, getByText } = render(
            <MemoryRouter>
                <GardenLanding />
            </MemoryRouter>
        );

        expect(getByText('After the garden opens')).toBeInTheDocument();
        expect(getByText('Four surfaces, one connected system.')).toBeInTheDocument();
        expect(getByText('From raw material to the next session in three moves.')).toBeInTheDocument();
        expect(getByText('Start free, then stay when the rhythm clicks.')).toBeInTheDocument();

        expect(getAllByRole('img')).toHaveLength(4);
        expect(getByRole('img', {
            name: 'Notes screenshot placeholder — add /landing/riven-notes.png',
        })).toBeInTheDocument();
        expect(getAllByText('Screenshot coming')).toHaveLength(4);
        expect(getByText('/landing/riven-notes.png')).toBeInTheDocument();

        expect(getByText('Seedling')).toBeInTheDocument();
        expect(getByText('Supporter')).toBeInTheDocument();
        expect(getByText('Annual')).toBeInTheDocument();
        expect(getByRole('link', { name: /Begin Journey/i })).toHaveAttribute('href', '/account?mode=signup');
    });
});
