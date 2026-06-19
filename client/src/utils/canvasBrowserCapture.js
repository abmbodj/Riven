import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';

// Matches a valid Canvas iCal feed URL.
const CANVAS_FEED_RE = /^https:\/\/.+\/feeds\/calendars\/.+\.ics/i;

export const isCanvasFeedUrl = (url) => CANVAS_FEED_RE.test(url?.trim() ?? '');

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Open a URL in the system browser (SFSafariViewController on iOS).
 * On web, falls back to window.open so the function is safe to call unconditionally.
 */
export const openInBrowser = (url) => {
    if (isNative()) {
        return Browser.open({ url, presentationStyle: 'popover' });
    }
    window.open(url, '_blank', 'noopener');
    return Promise.resolve();
};

/**
 * Close the in-app browser programmatically.
 * No-op on web.
 */
export const closeBrowser = () => {
    if (isNative()) return Browser.close();
    return Promise.resolve();
};

/**
 * Read the clipboard and return the text if it looks like a Canvas feed URL.
 * Returns null if permission is denied, clipboard is empty, or URL doesn't match.
 */
export const readCanvasUrlFromClipboard = async () => {
    if (!isNative()) return null;
    try {
        const { type, value } = await Clipboard.read();
        if (type === 'text/plain' && isCanvasFeedUrl(value)) {
            return value.trim();
        }
    } catch {
        // Clipboard permission denied or unavailable — fall through to manual paste.
    }
    return null;
};

/**
 * Register a one-shot listener that fires when the in-app browser closes.
 * Returns a cleanup function to remove the listener.
 */
export const onBrowserFinished = (callback) => {
    if (!isNative()) return () => {};
    let handle;
    Browser.addListener('browserFinished', () => {
        callback();
    }).then((h) => { handle = h; });
    return () => handle?.remove();
};
