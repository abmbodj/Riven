import { Capacitor } from '@capacitor/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAdsForWeb } from './loadAdsForWeb.js';

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => false),
    },
}));

describe('loadAdsForWeb', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.head.querySelectorAll('meta[name="google-adsense-account"]').forEach((el) => el.remove());
        document.head.querySelectorAll('script[src*="adsbygoogle"]').forEach((el) => el.remove());
        delete window.adsbygoogle;
        delete window.adBreak;
        delete window.adConfig;
    });

    afterEach(() => {
        document.head.querySelectorAll('meta[name="google-adsense-account"]').forEach((el) => el.remove());
        document.head.querySelectorAll('script[src*="adsbygoogle"]').forEach((el) => el.remove());
    });

    it('injects AdSense meta and script on web', () => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        loadAdsForWeb();
        expect(document.querySelector('meta[name="google-adsense-account"]')).toBeTruthy();
        expect(document.querySelector('script[src*="pagead2.googlesyndication.com"]')).toBeTruthy();
        expect(Array.isArray(window.adsbygoogle)).toBe(true);
    });

    it('does nothing on native Capacitor', () => {
        Capacitor.isNativePlatform.mockReturnValue(true);
        loadAdsForWeb();
        expect(document.querySelector('meta[name="google-adsense-account"]')).toBeNull();
        expect(document.querySelector('script[src*="pagead2.googlesyndication.com"]')).toBeNull();
    });

    it('is idempotent on web', () => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        loadAdsForWeb();
        loadAdsForWeb();
        expect(document.querySelectorAll('meta[name="google-adsense-account"]').length).toBe(1);
    });
});
