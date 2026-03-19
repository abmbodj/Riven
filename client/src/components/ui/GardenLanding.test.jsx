import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GardenLanding from './GardenLanding.jsx';

const useGSAPMock = vi.fn();

vi.mock('../../hooks/useGSAP', () => ({
    useGSAP: (...args) => useGSAPMock(...args),
}));

describe('GardenLanding', () => {
    beforeEach(() => {
        useGSAPMock.mockReset();
        useGSAPMock.mockImplementation(() => ({ container: { current: null } }));
    });

    it('passes an array dependency list to useGSAP', () => {
        render(
            <MemoryRouter>
                <GardenLanding />
            </MemoryRouter>
        );

        expect(useGSAPMock).toHaveBeenCalledTimes(1);
        expect(useGSAPMock.mock.calls[0][1]).toEqual([]);
    });
});
