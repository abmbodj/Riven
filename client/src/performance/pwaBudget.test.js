import { describe, expect, it } from 'vitest';
import { pwaOptions } from '../../pwa.config.js';

describe('production PWA budget', () => {
    it('precache only includes the shell and required icons', () => {
        expect(pwaOptions.includeAssets).toEqual(expect.arrayContaining(['logo.png', 'mask-icon.svg']));
        expect(pwaOptions.workbox.globPatterns).toEqual([
            'index.html',
            'manifest.webmanifest',
            'assets/index-*.js',
            'assets/index-*.css',
        ]);
        expect(pwaOptions.workbox.runtimeCaching).toEqual(expect.arrayContaining([
            expect.objectContaining({
                handler: 'StaleWhileRevalidate',
                options: expect.objectContaining({ cacheName: 'riven-route-assets-v1' }),
            }),
        ]));
    });
});
