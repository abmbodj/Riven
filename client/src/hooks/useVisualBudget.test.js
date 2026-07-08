import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
    vi.resetModules();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
    }));
});

afterEach(() => {
    vi.restoreAllMocks();
});

function sample(fps) {
    window.dispatchEvent(new CustomEvent('riven:fps-sample', { detail: { fps } }));
}

describe('useVisualBudget FPS hysteresis', () => {
    it('trips to constrained only after sustained low fps', async () => {
        const { useVisualBudget, VISUAL_BUDGET_CONSTRAINED, VISUAL_BUDGET_NORMAL } = await import('./useVisualBudget.js');
        const { result } = renderHook(() => useVisualBudget());
        expect(result.current).toBe(VISUAL_BUDGET_NORMAL);

        act(() => { sample(30); sample(30); sample(30); });
        expect(result.current).toBe(VISUAL_BUDGET_NORMAL);

        act(() => sample(30));
        expect(result.current).toBe(VISUAL_BUDGET_CONSTRAINED);
    });

    it('does not recover on a single borderline sample (the flicker bug)', async () => {
        const { useVisualBudget, VISUAL_BUDGET_CONSTRAINED } = await import('./useVisualBudget.js');
        const { result } = renderHook(() => useVisualBudget());

        act(() => { sample(30); sample(30); sample(30); sample(30); });
        expect(result.current).toBe(VISUAL_BUDGET_CONSTRAINED);

        // A single sample just above the trip threshold (in the 50-55 dead
        // zone) used to flip a shared up/down counter straight back to
        // normal every ~500ms — this is the regression being fixed.
        act(() => sample(52));
        expect(result.current).toBe(VISUAL_BUDGET_CONSTRAINED);
    });

    it('recovers only after sustained good fps', async () => {
        const { useVisualBudget, VISUAL_BUDGET_CONSTRAINED, VISUAL_BUDGET_NORMAL } = await import('./useVisualBudget.js');
        const { result } = renderHook(() => useVisualBudget());

        act(() => { sample(30); sample(30); sample(30); sample(30); });
        expect(result.current).toBe(VISUAL_BUDGET_CONSTRAINED);

        act(() => { for (let i = 0; i < 5; i += 1) sample(60); });
        expect(result.current).toBe(VISUAL_BUDGET_CONSTRAINED);

        act(() => sample(60));
        expect(result.current).toBe(VISUAL_BUDGET_NORMAL);
    });

    it('never flips on every sample while oscillating near the old boundary', async () => {
        const { useVisualBudget, VISUAL_BUDGET_CONSTRAINED } = await import('./useVisualBudget.js');
        const { result } = renderHook(() => useVisualBudget());

        let transitions = 0;
        let previous = result.current;
        act(() => {
            for (let i = 0; i < 20; i += 1) {
                sample(i % 2 === 0 ? 48 : 52);
            }
        });
        if (result.current !== previous) transitions += 1;

        // Settles into constrained (genuinely borderline performance) instead
        // of flapping back and forth on each alternating sample.
        expect(transitions).toBeLessThanOrEqual(1);
        expect(result.current).toBe(VISUAL_BUDGET_CONSTRAINED);
    });
});
