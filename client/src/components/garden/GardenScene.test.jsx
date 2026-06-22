import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GardenScene from './GardenScene';

// Render pure SVG without the GSAP runtime (mirrors Garden.test.jsx) — keeps the
// smoke test fast/deterministic and exercises the same "static frame" path GSAP
// falls back to under prefers-reduced-motion.
vi.mock('../../hooks/useGSAP', () => ({
    useGSAP: () => ({ container: { current: null } }),
}));

afterEach(cleanup);

describe('GardenScene', () => {
    it('renders an accessible svg at every size without crashing', () => {
        for (const size of ['sm', 'md', 'lg', 'xl']) {
            const { unmount } = render(<GardenScene streak={120} status="active" size={size} showInfo={false} />);
            const img = screen.getByRole('img');
            expect(img.tagName.toLowerCase()).toBe('svg');
            expect(img).toHaveAttribute('aria-labelledby');
            unmount();
        }
    });

    it('reflects the chapter and streak in the accessible name and footer', () => {
        render(<GardenScene streak={365} status="active" size="xl" showInfo />);
        // Day 365 is the Blossom Crown chapter.
        expect(screen.getByRole('img', { name: /Blossom Crown garden/i })).toBeInTheDocument();
        expect(screen.getByText('365 day streak')).toBeInTheDocument();
    });

    it('renders across streak/status combinations (seed -> sapling -> grand, active/at-risk/broken)', () => {
        for (const streak of [0, 7, 30, 90, 180, 365, 730]) {
            for (const status of ['active', 'at-risk', 'broken']) {
                const { unmount } = render(<GardenScene streak={streak} status={status} size="xl" showInfo={false} />);
                expect(screen.getByRole('img')).toBeInTheDocument();
                unmount();
            }
        }
    });

    it('still renders a static frame under prefers-reduced-motion', () => {
        const original = window.matchMedia;
        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: query.includes('reduce'),
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        render(<GardenScene streak={200} status="active" size="xl" showInfo={false} />);
        expect(screen.getByRole('img')).toBeInTheDocument();

        window.matchMedia = original;
    });
});
