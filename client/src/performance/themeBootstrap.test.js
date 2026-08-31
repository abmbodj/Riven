import { beforeEach, describe, expect, it } from 'vitest';
import { applyCachedThemeColors } from './themeBootstrap.js';

describe('theme bootstrap', () => {
    beforeEach(() => {
        sessionStorage.clear();
        document.documentElement.removeAttribute('style');
    });

    it('applies only color tokens from the existing user-scoped cache', () => {
        sessionStorage.setItem('riven_groups_cache_v1', JSON.stringify({
            _userId: 42,
            entries: {
                'theme:active': {
                    expiresAt: Date.now() + 60_000,
                    value: {
                        bg_color: '#101820',
                        surface_color: '#18232d',
                        text_color: '#f4efe5',
                        secondary_text_color: '#a7b0b8',
                        border_color: '#33404c',
                        accent_color: '#deb96a',
                        effect_preset: 'forest',
                        title: 'private title',
                    },
                },
            },
        }));

        expect(applyCachedThemeColors()).toBe(true);
        expect(document.documentElement.style.getPropertyValue('--bg-color')).toBe('#101820');
        expect(document.documentElement.style.getPropertyValue('--accent-color')).toBe('#deb96a');
        expect(document.documentElement.dataset.themeEffectsReady).toBeUndefined();
    });

    it('ignores expired or malformed cached themes', () => {
        sessionStorage.setItem('riven_groups_cache_v1', JSON.stringify({
            _userId: 42,
            entries: {
                'theme:active': {
                    expiresAt: Date.now() - 1,
                    value: { bg_color: '#ffffff' },
                },
            },
        }));

        expect(applyCachedThemeColors()).toBe(false);
        expect(document.documentElement.style.getPropertyValue('--bg-color')).toBe('');
    });
});
