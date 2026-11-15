const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    { ignores: ['node_modules/**', 'coverage/**'] },
    {
        files: ['**/*.js'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
        },
    },
    {
        files: ['vitest.config.js'],
        languageOptions: { sourceType: 'module' },
    },
    {
        files: ['test/**/*.js'],
        languageOptions: { sourceType: 'module', globals: { ...globals.node, ...globals.vitest } },
    },
    {
        // Pre-existing findings in auth/billing code, downgraded until the owner approves
        // touching these files (CLAUDE.md / docs/health-audit.md). New code here still gets
        // warnings; remove this block once the findings are fixed.
        files: ['routes/auth.js', 'routes/stripe.js', 'routes/webhooks.js', 'schemas/auth.js', 'utils/email.js'],
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
            'no-empty': 'warn',
            'no-extra-boolean-cast': 'warn',
        },
    },
];
