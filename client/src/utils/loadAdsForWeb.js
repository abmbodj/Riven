import { Capacitor } from '@capacitor/core';

const ADSENSE_CLIENT = 'ca-pub-8038960722918669';

/**
 * Loads Google AdSense / Ad Placement API only in the browser (not Capacitor iOS/Android).
 * Keeps the native shell free of third-party ad scripts for review and WebView stability.
 */
export function loadAdsForWeb() {
    if (typeof document === 'undefined' || Capacitor.isNativePlatform()) return;

    if (document.querySelector('meta[name="google-adsense-account"]')) return;

    const meta = document.createElement('meta');
    meta.name = 'google-adsense-account';
    meta.content = ADSENSE_CLIENT;
    document.head.appendChild(meta);

    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function adConfig(o) {
        window.adsbygoogle.push(o);
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
}
