/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalThemeOverlay from './GlobalThemeOverlay.jsx';

const mocks = vi.hoisted(() => ({
    theme: null,
    lightAtmosphere: false,
}));

vi.mock('../hooks/useTheme', () => ({
    useTheme: () => ({
        activeTheme: mocks.theme,
        appliedTheme: null,
    }),
}));

vi.mock('../hooks/useMobileVisualBudget', () => ({
    useMobileVisualBudget: () => mocks.lightAtmosphere,
}));

vi.mock('../hooks/useGSAP', () => ({
    useGSAP: () => ({ container: null }),
}));

const professionalTheme = (name, accent = '#e9a7bb') => ({
    id: 1,
    name,
    bg_color: '#18151b',
    surface_color: '#241f28',
    text_color: '#fff7fb',
    secondary_text_color: '#d8c3ce',
    border_color: '#4f3a45',
    accent_color: accent,
    is_default: 1,
    effect_preset: 'auto',
});

describe('GlobalThemeOverlay', () => {
    beforeEach(() => {
        mocks.theme = null;
        mocks.lightAtmosphere = false;
    });

    it.each([
        ['Sage Temple', 'forest', '#8fbf8d'],
        ['Dawn Ember', 'ember', '#f2955e'],
        ['Misty Shore', 'mist', '#9fbfd2'],
        ['Amber Lantern', 'lantern', '#e5b75d'],
        ['Moonlit Cove', 'moon', '#aab6e8'],
        ['Rain Garden', 'rain', '#8fb8c9'],
        ['Cherry Blossom', 'sakura', '#e9a7bb'],
        ['Lavender Dusk', 'lavender', '#b896e9'],
    ])('renders the %s professional atmosphere', (name, overlay, accent) => {
        mocks.theme = professionalTheme(name, accent);

        const { container } = render(<GlobalThemeOverlay />);

        expect(container.querySelector(`[data-global-theme-overlay="${overlay}"]`)).toBeTruthy();
    });

    it('renders upgraded Cherry Blossom petals and branch-adjacent blossom motes', () => {
        mocks.theme = professionalTheme('Cherry Blossom');

        const { container } = render(<GlobalThemeOverlay />);

        expect(container.querySelector('[data-global-theme-overlay="sakura"]')).toBeTruthy();
        expect(container.querySelectorAll('.p-petal')).toHaveLength(34);
        expect(container.querySelectorAll('.p-blossom-mote')).toHaveLength(14);
    });

    it('uses a lighter Cherry Blossom mobile atmosphere', () => {
        mocks.theme = professionalTheme('Cherry Blossom');
        mocks.lightAtmosphere = true;

        const { container } = render(<GlobalThemeOverlay />);

        expect(container.querySelector('[data-global-theme-overlay="sakura"]')).toBeTruthy();
        expect(container.querySelectorAll('.mobile-particle').length).toBeLessThan(16);
        expect(container.querySelectorAll('.p-petal')).toHaveLength(0);
    });
});
