import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RiverMascot from './RiverMascot.jsx';

const mobileBudgetMock = vi.fn(() => false);

vi.mock('../../hooks/useMobileVisualBudget', () => ({
    useMobileVisualBudget: () => mobileBudgetMock(),
}));

const mockMatchMedia = ({
    reducedMotion = false,
    hoverFine = true,
} = {}) => {
    window.matchMedia = vi.fn((query) => ({
        matches: (
            (query === '(prefers-reduced-motion: reduce)' && reducedMotion)
            || (query === '(hover: hover) and (pointer: fine)' && hoverFine)
        ),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
};

describe('RiverMascot', () => {
    beforeEach(() => {
        mobileBudgetMock.mockReturnValue(false);
        mockMatchMedia();
    });

    it('renders the frog-defining features while keeping the subtle hat signature', () => {
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);

        const mascot = screen.getByTestId('river-mascot');
        expect(mascot).toHaveAttribute('data-river-state', 'idle');
        expect(mascot).toHaveAttribute('role', 'img');
        expect(screen.getByText('Ready for the lesson.')).toBeInTheDocument();
        expect(container.querySelector('[data-river-feature="eye-left"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="eye-right"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="mouth"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="belly"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="forelimb-left"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="forelimb-right"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="hindleg-left"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="hindleg-right"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="hat"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="ear-left"]')).toBeNull();
        expect(container.querySelector('[data-river-feature="tail"]')).toBeNull();
    });

    it('preserves legacy state aliases and explicit tutor-session states', () => {
        const { rerender } = render(<RiverMascot state="focus" caption="Thinking..." />);

        expect(screen.getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'thinking');

        rerender(<RiverMascot state="misconception" caption="Careful there." />);
        expect(screen.getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'gentle-correct');

        rerender(<RiverMascot state="celebrate" caption="You nailed it." />);
        expect(screen.getByTestId('river-mascot')).toHaveAttribute('data-river-state', 'celebrate');
        expect(screen.getByText('You nailed it.')).toBeInTheDocument();
    });

    it('renders the hat in front of the head with a visible front band', () => {
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);
        const head = container.querySelector('[data-river-feature="head"]');
        const hat = container.querySelector('[data-river-feature="hat"]');
        const hatBand = container.querySelector('[data-river-feature="hat-band"]');

        expect(head).toBeTruthy();
        expect(hat).toBeTruthy();
        expect(hatBand).toBeTruthy();
        expect(head.compareDocumentPosition(hat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(head.compareDocumentPosition(hatBand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('keeps the knit hat compact and centered over River’s crown', () => {
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);
        const hat = container.querySelector('[data-river-feature="hat"]');
        const hatBand = container.querySelector('[data-river-feature="hat-band"]');

        expect(hat.getAttribute('d')).toContain('132 91');
        expect(hatBand.getAttribute('d')).toContain('130 95');
    });

    it('keeps the pupils static when the pointer moves on desktop', async () => {
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);
        const mascot = screen.getByTestId('river-mascot');
        const leftPupil = container.querySelector('[data-river-feature="pupil-left"]');

        expect(leftPupil).toBeTruthy();

        mascot.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            width: 320,
            height: 420,
            right: 320,
            bottom: 420,
            toJSON: () => ({}),
        });

        const initialCx = leftPupil.getAttribute('cx');
        const initialCy = leftPupil.getAttribute('cy');

        fireEvent.pointerMove(mascot, { clientX: 260, clientY: 110, pointerType: 'mouse' });
        fireEvent.pointerLeave(mascot, { pointerType: 'mouse' });

        await waitFor(() => {
            expect(leftPupil.getAttribute('cx')).toBe(initialCx);
            expect(leftPupil.getAttribute('cy')).toBe(initialCy);
        });
    });

    it('keeps the pupils static on mobile visual budget devices', async () => {
        mobileBudgetMock.mockReturnValue(true);
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);
        const mascot = screen.getByTestId('river-mascot');
        const leftPupil = container.querySelector('[data-river-feature="pupil-left"]');

        mascot.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            width: 320,
            height: 420,
            right: 320,
            bottom: 420,
            toJSON: () => ({}),
        });

        const initialCx = leftPupil.getAttribute('cx');
        const initialCy = leftPupil.getAttribute('cy');

        fireEvent.pointerMove(mascot, { clientX: 260, clientY: 110, pointerType: 'mouse' });

        await waitFor(() => {
            expect(leftPupil.getAttribute('cx')).toBe(initialCx);
            expect(leftPupil.getAttribute('cy')).toBe(initialCy);
        });
    });

    it('keeps the pupils static when reduced motion is preferred', async () => {
        mockMatchMedia({ reducedMotion: true, hoverFine: true });
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);
        const mascot = screen.getByTestId('river-mascot');
        const leftPupil = container.querySelector('[data-river-feature="pupil-left"]');

        mascot.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            width: 320,
            height: 420,
            right: 320,
            bottom: 420,
            toJSON: () => ({}),
        });

        const initialCx = leftPupil.getAttribute('cx');
        const initialCy = leftPupil.getAttribute('cy');

        fireEvent.pointerMove(mascot, { clientX: 260, clientY: 110, pointerType: 'mouse' });

        await waitFor(() => {
            expect(leftPupil.getAttribute('cx')).toBe(initialCx);
            expect(leftPupil.getAttribute('cy')).toBe(initialCy);
        });
    });
});
