import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RiverMascot from './RiverMascot.jsx';

vi.mock('../../hooks/useMobileVisualBudget', () => ({
    useMobileVisualBudget: () => false,
}));

describe('RiverMascot', () => {
    it('renders the cat-defining features while keeping the beanie signature', () => {
        const { container } = render(<RiverMascot state="idle" caption="Ready for the lesson." />);

        const mascot = screen.getByTestId('river-mascot');
        expect(mascot).toHaveAttribute('data-river-state', 'idle');
        expect(mascot).toHaveAttribute('role', 'img');
        expect(screen.getByText('Ready for the lesson.')).toBeInTheDocument();
        expect(container.querySelector('[data-river-feature="ear-left"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="ear-right"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="muzzle"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="tail"]')).toBeTruthy();
        expect(container.querySelector('[data-river-feature="beanie"]')).toBeTruthy();
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
});
