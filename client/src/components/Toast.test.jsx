import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast.jsx';
import { useToast } from '../hooks/useToast';

vi.mock('motion/react', async () => {
    const React = await import('react');

    const MockMotionDiv = React.forwardRef(({ layout: _layout, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }, ref) => (
        <div ref={ref} {...props} />
    ));

    MockMotionDiv.displayName = 'MockMotionDiv';

    return {
        AnimatePresence: ({ children }) => <>{children}</>,
        motion: {
            div: MockMotionDiv,
        },
        useReducedMotion: () => false,
    };
});

function ToastHarness() {
    const toast = useToast();

    return (
        <div>
            <button type="button" onClick={() => toast.success('Saved successfully')}>
                Show success
            </button>
            <button type="button" onClick={() => toast.error('Something went wrong')}>
                Show error
            </button>
        </div>
    );
}

describe('ToastProvider', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        act(() => {
            vi.runOnlyPendingTimers();
        });
        vi.useRealTimers();
    });

    it('renders children and shows success and error toasts with the shared API', () => {
        render(
            <ToastProvider>
                <ToastHarness />
            </ToastProvider>
        );

        expect(screen.getByRole('button', { name: 'Show success' })).toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
            fireEvent.click(screen.getByRole('button', { name: 'Show error' }));
        });

        expect(screen.getByText('Saved successfully')).toBeInTheDocument();
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByTestId('toast-success')).toBeInTheDocument();
        expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    });

    it('dismisses a toast when the close button is pressed', () => {
        render(
            <ToastProvider>
                <ToastHarness />
            </ToastProvider>
        );

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
        });
        expect(screen.getByText('Saved successfully')).toBeInTheDocument();

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
        });

        expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
    });

    it('auto-dismisses toasts after the timeout', () => {
        render(
            <ToastProvider>
                <ToastHarness />
            </ToastProvider>
        );

        act(() => {
            fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
        });
        expect(screen.getByText('Saved successfully')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(3500);
        });

        expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
    });

    it('uses responsive viewport classes for mobile top layout and md corner stacking', () => {
        render(
            <ToastProvider>
                <ToastHarness />
            </ToastProvider>
        );

        const viewport = screen.getByTestId('toast-viewport');

        expect(viewport.className).toContain('inset-x-4');
        expect(viewport.className).toContain('items-center');
        expect(viewport.className).toContain('md:right-5');
        expect(viewport.className).toContain('md:w-[min(24rem,calc(100vw-2rem))]');
        expect(viewport.className).toContain('md:items-stretch');
    });
});
