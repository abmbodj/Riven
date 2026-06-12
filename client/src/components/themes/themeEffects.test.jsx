/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getThemeEffectLabel, ThemeEffectOverlay } from './themeEffects.jsx';

vi.mock('motion/react', () => ({
    motion: new Proxy({}, {
        get: (_target, tag) => {
            const Component = ({ children, ...props }) => {
                const Tag = tag;
                const domProps = { ...props };
                delete domProps.animate;
                delete domProps.transition;
                delete domProps.variants;
                delete domProps.whileHover;
                delete domProps.whileTap;
                return <Tag {...domProps}>{children}</Tag>;
            };
            Component.displayName = `MockMotion.${String(tag)}`;
            return Component;
        },
    }),
}));

const baseTheme = {
    id: 1,
    name: 'Riven',
    bg_color: '#162a31',
    surface_color: '#223b43',
    text_color: '#f5f0e8',
    secondary_text_color: '#b6c5c4',
    border_color: '#3f5f65',
    accent_color: '#deb96a',
    is_default: 1,
    effect_preset: 'auto',
    effect_intensity: 'soft',
};

function renderOverlay(theme, props = {}) {
    return render(<ThemeEffectOverlay theme={theme} {...props} />);
}

describe('ThemeEffectOverlay', () => {
    it('renders Foundation auto signatures', () => {
        const foundationThemes = [
            ['Riven', 'riven'],
            ['Riven Light', 'riven-light'],
            ['Manuscript', 'manuscript'],
            ['Deep Current', 'depths'],
            ['Signal Glass', 'signal'],
        ];

        foundationThemes.forEach(([name, overlay]) => {
            const { container, unmount } = renderOverlay({ ...baseTheme, name });
            expect(container.querySelector(`[data-particle-overlay="${overlay}"]`)).toBeTruthy();
            unmount();
        });
    });

    it('renders custom presets by saved effect_preset id', () => {
        const { container } = renderOverlay({
            ...baseTheme,
            id: 99,
            name: 'Custom Signal',
            is_default: 0,
            effect_preset: 'grid',
            effect_intensity: 'rich',
        });

        expect(container.querySelector('[data-particle-overlay="grid"]')).toBeTruthy();
    });

    it('uses a static reduced-motion fallback', () => {
        const { container } = renderOverlay({ ...baseTheme, name: 'Cherry Draft', is_default: 0, effect_preset: 'stars' }, { simplifyMotion: true });

        expect(container.querySelector('[data-particle-overlay="static"]')).toBeTruthy();
    });

    it('keeps effect labels backward compatible', () => {
        expect(getThemeEffectLabel(baseTheme)).toBe('Signature');
        expect(getThemeEffectLabel({ ...baseTheme, is_default: 0, effect_preset: 'dust', effect_intensity: 'medium' })).toBe('Dust · Medium');
        expect(getThemeEffectLabel({ ...baseTheme, is_default: 0, effect_preset: 'none' })).toBe('None');
    });
});
