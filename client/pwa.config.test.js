import { describe, expect, it } from 'vitest';
import { pwaOptions } from './pwa.config.js';

describe('pwaOptions', () => {
  it('keeps prompt-mode updates while claiming already-open tabs', () => {
    expect(pwaOptions.injectRegister).toBe(false);
    expect(pwaOptions.registerType).toBe('prompt');
    expect(pwaOptions.workbox.clientsClaim).toBe(true);
    expect(pwaOptions.workbox.skipWaiting).not.toBe(true);
  });
});
