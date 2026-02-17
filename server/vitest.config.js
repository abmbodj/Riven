import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
        env: {
            DATABASE_URL: 'postgres://test',
            JWT_SECRET: 'test-secret'
        },
        server: {
            deps: {
                inline: ['pg']
            }
        }
    },
});
