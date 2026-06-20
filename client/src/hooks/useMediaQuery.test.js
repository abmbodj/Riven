import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useMediaQuery from './useMediaQuery';

let listeners;
let currentMatches;

beforeEach(() => {
    listeners = new Set();
    currentMatches = false;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: currentMatches,
        media: query,
        addEventListener: (_event, cb) => listeners.add(cb),
        removeEventListener: (_event, cb) => listeners.delete(cb),
        addListener: (cb) => listeners.add(cb),
        removeListener: (cb) => listeners.delete(cb),
    }));
});

afterEach(() => {
    vi.restoreAllMocks();
});

function emitChange(matches) {
    currentMatches = matches;
    listeners.forEach((cb) => cb({ matches }));
}

describe('useMediaQuery', () => {
    it('returns the current match value', () => {
        currentMatches = true;
        const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
        expect(result.current).toBe(true);
    });

    it('updates when the media query changes', () => {
        const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
        expect(result.current).toBe(false);
        act(() => emitChange(true));
        expect(result.current).toBe(true);
        act(() => emitChange(false));
        expect(result.current).toBe(false);
    });

    it('returns false when matchMedia is unavailable', () => {
        delete window.matchMedia;
        const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
        expect(result.current).toBe(false);
    });
});
