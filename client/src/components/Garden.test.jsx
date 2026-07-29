import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Garden from './Garden.jsx';

vi.mock('../hooks/useGSAP', () => ({
    useGSAP: () => ({ container: { current: null } }),
}));

describe('Garden', () => {
    it('keeps the pre-rebuild stage art when a stale new-garden flag is enabled', () => {
        vi.stubEnv('VITE_NEW_GARDEN', '1');

        try {
            render(<Garden streak={500} status="active" size="md" showInfo={true} />);

            expect(screen.getByRole('img', { name: /Cosmic Nexus garden/i })).toBeInTheDocument();
            expect(screen.queryByRole('img', { name: /Blossom Crown garden/i })).not.toBeInTheDocument();
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it('renders the correct accessible stage art and visible label for the streak tier', () => {
        render(<Garden streak={500} status="active" size="md" showInfo={true} />);

        expect(screen.getByRole('img', { name: /Cosmic Nexus garden/i })).toBeInTheDocument();
        expect(screen.getByText('Cosmic Nexus')).toBeInTheDocument();
        expect(screen.getByText('500 day streak')).toBeInTheDocument();
    });

    it('keeps the SVG accessible even when stage info is hidden', () => {
        render(<Garden streak={1} status="active" size="sm" showInfo={false} />);

        expect(screen.getByRole('img', { name: /Sprouting Seeds garden/i })).toBeInTheDocument();
        expect(screen.queryByText('1 day streak', { selector: 'span' })).not.toBeInTheDocument();
    });

    it('includes the flowering stem groups in the reveal animation set', () => {
        const { container } = render(<Garden streak={500} status="active" size="md" showInfo={true} />);

        expect(container.querySelectorAll('.garden-sway.garden-reveal').length).toBeGreaterThan(0);
    });
});
