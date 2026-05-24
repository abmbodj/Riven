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

    it('renders the frog-defining features without the old hat silhouette', () => {
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);

        const mascot = screen.getByTestId('river-mascot');
        const speechBubble = container.querySelector('[data-river-feature="speech-bubble"]');
        const speechTail = container.querySelector('[data-river-feature="speech-tail"]');
        expect(mascot).toHaveAttribute('data-river-state', 'idle');
        expect(mascot).toHaveAttribute('role', 'img');
        expect(screen.getByText('Ready for the lesson.')).toBeInTheDocument();
        expect(speechBubble).toBeTruthy();
        expect(speechTail).toBeTruthy();
        expect(speechBubble).toHaveTextContent('Ready for the lesson.');
        expect(container.querySelector('[data-river-feature="eye-left"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="eye-right"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="mouth"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="belly"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="forelimb-left"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="forelimb-right"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="hindleg-left"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="hindleg-right"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="hat"]')).toBeNull();
        expect(container.querySelector('[data-river-feature="hat-band"]')).toBeNull();
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

    it('renders a frameless board teacher variant with a pointing frog pose', () => {
        const { container } = render(<RiverMascot state="teach" compact variant="board-teacher" />);
        const mascot = screen.getByTestId('river-mascot');

        expect(mascot).toHaveAttribute('data-river-state', 'point');
        expect(mascot).toHaveAttribute('data-river-variant', 'board-teacher');
        expect(mascot).toHaveAttribute('role', 'img');
        expect(mascot).toHaveAttribute('aria-label', 'River is pointing something out');
        expect(container.querySelector('img[src="/river-background.svg"]')).toBeNull();
        expect(container.querySelector('[data-river-feature="speech-bubble"]')).toBeNull();
        expect(container.querySelector('[data-river-feature="belly"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="forelimb-right"]')).toBeTruthy();
    });

    it('keeps the head clean by removing the old hat layers entirely', () => {
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);
        const head = container.querySelector('[data-river-feature="head"]');
        const hat = container.querySelector('[data-river-feature="hat"]');
        const hatBand = container.querySelector('[data-river-feature="hat-band"]');

        expect(head).toBeTruthy();
        expect(hat).toBeNull();
        expect(hatBand).toBeNull();
    });

    it('keeps the lower embedded eyes after removing the hat', () => {
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);
        const leftEye = container.querySelector('[data-river-feature="eye-left"]');
        const rightEye = container.querySelector('[data-river-feature="eye-right"]');
        const mouth = container.querySelector('[data-river-feature="mouth"]');

        expect(leftEye).toHaveAttribute('cx', '126');
        expect(leftEye).toHaveAttribute('cy', '104');
        expect(rightEye).toHaveAttribute('cx', '194');
        expect(rightEye).toHaveAttribute('cy', '104');
        expect(mouth.getAttribute('d')).toContain('M118 163');
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
