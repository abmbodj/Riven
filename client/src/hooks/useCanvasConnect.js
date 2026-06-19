import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api.js';
import { isNative, openInBrowser, onBrowserFinished, readCanvasUrlFromClipboard } from '../utils/canvasBrowserCapture.js';
import { canvasIcalUrlSchema } from '../schemas/forms.js';

/**
 * Stage machine for the "OAuth-feeling" Canvas connect flow.
 *
 * Stages:
 *   idle            — not started
 *   schoolSearch    — user is searching for their school
 *   preflight       — school selected, showing instructions before opening browser
 *   awaitingReturn  — in-app browser is open (native only)
 *   captured        — clipboard had a valid URL; showing auto-filled confirmation
 *   fallback        — returned without valid URL; showing paste/guide
 *   connecting      — API call in flight
 *   connected       — success
 *   feedsDisabled   — user indicated their school disabled the feed; showing demand capture
 */
export function useCanvasConnect({ onConnected, userEmail } = {}) {
    const [stage, setStage] = useState('idle');
    const [searchQuery, setSearchQueryRaw] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedSchool, setSelectedSchool] = useState(null); // { name, domain }
    const [capturedUrl, setCapturedUrl] = useState('');
    const [manualUrl, setManualUrl] = useState('');
    const [error, setError] = useState(null);
    const [schoolRequestSent, setSchoolRequestSent] = useState(false);

    const searchTimerRef = useRef(null);
    const browserCleanupRef = useRef(null);

    // Derive a suggested domain from the user's email (e.g. student@university.edu → university)
    const emailDomainHint = userEmail
        ? userEmail.split('@')[1]?.split('.').slice(-2, -1)[0] ?? ''
        : '';

    // ── School search (debounced 350ms) ─────────────────────────────────────
    const setSearchQuery = useCallback((q) => {
        setSearchQueryRaw(q);
        clearTimeout(searchTimerRef.current);
        if (!q.trim()) { setSearchResults([]); return; }
        setSearchLoading(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const res = await api.searchCanvasSchools(q.trim());
                setSearchResults(res?.schools ?? []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 350);
    }, []);

    // ── Actions ──────────────────────────────────────────────────────────────
    const startFlow = useCallback(() => {
        // Web/desktop: jump straight to manual-paste (desktop users can find the feed easily).
        const initialStage = isNative() ? 'schoolSearch' : 'fallback';
        setStage(initialStage);
        setSearchQueryRaw('');
        setSearchResults([]);
        setSelectedSchool(null);
        setCapturedUrl('');
        setManualUrl('');
        setError(null);
        setSchoolRequestSent(false);
        // Pre-warm search with email domain hint on native only.
        if (isNative() && emailDomainHint) setSearchQuery(emailDomainHint);
    }, [emailDomainHint, setSearchQuery]);

    const selectSchool = useCallback((school) => {
        setSelectedSchool(school);
        setStage('preflight');
        setError(null);
    }, []);

    const applyManualHost = useCallback((domain) => {
        const host = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        setSelectedSchool({ name: host, domain: host });
        setStage('preflight');
        setError(null);
    }, []);

    const _handleBrowserReturn = useCallback(async () => {
        if (browserCleanupRef.current) {
            browserCleanupRef.current();
            browserCleanupRef.current = null;
        }
        const url = await readCanvasUrlFromClipboard();
        if (url) {
            setCapturedUrl(url);
            setManualUrl(url);
            setStage('captured');
        } else {
            setStage('fallback');
        }
    }, []);

    const openBrowser = useCallback(() => {
        if (!selectedSchool?.domain) return;
        const url = `https://${selectedSchool.domain}/calendar`;
        setStage('awaitingReturn');

        if (isNative()) {
            // Listen for the system browser to close.
            browserCleanupRef.current = onBrowserFinished(_handleBrowserReturn);
            openInBrowser(url);
        } else {
            // Web: just open a new tab; no capture possible.
            openInBrowser(url);
            setStage('fallback');
        }
    }, [selectedSchool, _handleBrowserReturn]);

    const submitUrl = useCallback(async (url) => {
        const trimmed = (url ?? manualUrl).trim();
        const validation = canvasIcalUrlSchema.safeParse(trimmed);
        if (!validation.success) {
            setError(validation.error.errors[0]?.message ?? 'Invalid Canvas feed URL');
            return;
        }
        setError(null);
        setStage('connecting');
        try {
            await api.connectCanvas(trimmed);
            setStage('connected');
            onConnected?.();
        } catch (err) {
            setError(err?.message ?? 'Failed to connect. Try again.');
            setStage('fallback');
        }
    }, [manualUrl, onConnected]);

    const reportFeedsDisabled = useCallback(() => {
        setStage('feedsDisabled');
    }, []);

    const sendSchoolRequest = useCallback(async () => {
        try {
            await api.requestSchoolSupport({
                school: selectedSchool?.name ?? searchQuery,
                domain: selectedSchool?.domain,
            });
            setSchoolRequestSent(true);
        } catch {
            // Non-critical; don't surface error.
        }
    }, [selectedSchool, searchQuery]);

    const reset = useCallback(() => {
        if (browserCleanupRef.current) {
            browserCleanupRef.current();
            browserCleanupRef.current = null;
        }
        setStage('idle');
        setSearchQueryRaw('');
        setSearchResults([]);
        setSelectedSchool(null);
        setCapturedUrl('');
        setManualUrl('');
        setError(null);
        setSchoolRequestSent(false);
    }, []);

    // App foreground resume also triggers capture (backup for browserFinished).
    useEffect(() => {
        if (stage !== 'awaitingReturn' || !isNative()) return;
        let { App } = { App: null };
        let listener;
        import('@capacitor/app').then(({ App: AppPlugin }) => {
            App = AppPlugin;
            App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) _handleBrowserReturn();
            }).then((l) => { listener = l; });
        });
        return () => listener?.remove();
    }, [stage, _handleBrowserReturn]);

    // Cleanup debounce on unmount.
    useEffect(() => () => clearTimeout(searchTimerRef.current), []);

    return {
        stage,
        isNative: isNative(),
        searchQuery,
        searchResults,
        searchLoading,
        selectedSchool,
        capturedUrl,
        manualUrl,
        setManualUrl,
        error,
        schoolRequestSent,
        emailDomainHint,
        // Actions
        startFlow,
        setSearchQuery,
        selectSchool,
        applyManualHost,
        openBrowser,
        submitUrl,
        reportFeedsDisabled,
        sendSchoolRequest,
        reset,
        goToFallback: () => setStage('fallback'),
    };
}
