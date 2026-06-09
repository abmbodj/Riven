/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GardenGallery from './GardenGallery.jsx';
import { UIContext } from '../context/UIContext';

vi.mock('motion/react', () => {
    const stripMotionProps = (props) => {
        const {
            animate: _animate,
            drag: _drag,
            dragConstraints: _dragConstraints,
            dragElastic: _dragElastic,
            exit: _exit,
            initial: _initial,
            onDragEnd: _onDragEnd,
            transition: _transition,
            ...domProps
        } = props;
        return domProps;
    };

    const createMotionComponent = (tag) =>
        React.forwardRef(({ children, ...props }, ref) => React.createElement(tag, { ...stripMotionProps(props), ref }, children));

    return {
        AnimatePresence: ({ children }) => <>{children}</>,
        motion: new Proxy(
            {},
            {
                get: (_, tag) => createMotionComponent(tag),
            }
        ),
    };
});

const renderGallery = (props = {}) => {
    const uiValue = {
        hideNav: vi.fn(),
        showBottomNav: vi.fn(),
    };

    const result = render(
        <UIContext.Provider value={uiValue}>
            <GardenGallery
                currentStreak={4}
                longestStreak={14}
                pastStreaks={[]}
                onClose={vi.fn()}
                {...props}
            />
        </UIContext.Provider>
    );

    return { ...result, uiValue };
};

describe('GardenGallery', () => {
    it('renders the premium empty state when there are no memories', () => {
        renderGallery();

        expect(screen.getByRole('heading', { name: 'Garden Memories' })).toBeInTheDocument();
        expect(screen.getByText('No garden memories yet')).toBeInTheDocument();
        expect(screen.getByText('Captured streak memories')).toBeInTheDocument();
    });

    it('renders summary metrics and sorts memories by streak strength first', () => {
        renderGallery({
            currentStreak: 7,
            longestStreak: 30,
            pastStreaks: [
                { streak: 3, startDate: '2026-04-15T12:00:00.000Z', endDate: '2026-04-18T12:00:00.000Z' },
                { streak: 30, startDate: '2026-05-01T12:00:00.000Z', endDate: '2026-05-31T12:00:00.000Z' },
                { streak: 14, startDate: '2026-03-01T12:00:00.000Z', endDate: '2026-03-15T12:00:00.000Z' },
            ],
        });

        expect(screen.getByText('Day rhythm in progress')).toBeInTheDocument();
        expect(screen.getByText('Personal garden record')).toBeInTheDocument();

        const memoryButtons = screen.getAllByRole('button', { expanded: false });
        expect(memoryButtons[0]).toHaveTextContent('30 days');
        expect(memoryButtons[1]).toHaveTextContent('14 days');
        expect(memoryButtons[2]).toHaveTextContent('3 days');
        expect(memoryButtons[0]).toHaveTextContent('Best');
    });

    it('expands and collapses a selected memory card', () => {
        renderGallery({
            pastStreaks: [
                { streak: 7, startDate: '2026-04-01T12:00:00.000Z', endDate: '2026-04-08T12:00:00.000Z' },
            ],
        });

        const memoryButton = screen.getByRole('button', { expanded: false });
        fireEvent.click(memoryButton);

        expect(screen.getByText('Season note')).toBeInTheDocument();
        expect(screen.getByText('Dates')).toBeInTheDocument();
        expect(screen.getByText('Week Gardener')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { expanded: true }));
        expect(screen.queryByText('Season note')).not.toBeInTheDocument();
    });

    it('uses the close affordances and UI nav lifecycle hooks', () => {
        const onClose = vi.fn();
        const { uiValue } = renderGallery({ onClose });

        expect(uiValue.hideNav).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Close Garden Memories' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
