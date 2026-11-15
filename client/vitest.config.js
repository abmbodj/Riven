import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        // Tests must not depend on the developer's shell or .env files. These match CI
        // and point at nothing real.
        env: {
            VITE_SUPABASE_URL: 'https://example.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'ci-test-anon-key',
            VITE_ENABLE_LEGACY_AUTH_BRIDGE: 'false',
        },
        // Bound jsdom concurrency so animation/lazy-route tests are not starved
        // by dozens of simultaneous workers on developer and CI hosts.
        maxWorkers: 4,
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
