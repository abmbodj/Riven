export function getDevE2EFixtures() {
    const enabled = import.meta.env.DEV || import.meta.env.VITE_E2E_FIXTURES === 'true';
    if (!enabled || typeof window === 'undefined') return null;
    const fixtures = window.__RIVEN_E2E_FIXTURES__;
    return fixtures && typeof fixtures === 'object' ? fixtures : null;
}
