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
];
