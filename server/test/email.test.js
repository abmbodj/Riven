import { describe, expect, it } from 'vitest';

describe('welcome email template', () => {
    it('renders the refreshed copy with safe username escaping and current entry points', async () => {
        const { WELCOME_EMAIL_SUBJECT, buildWelcomeEmailHtml } = await import('../utils/email.js');

        const html = buildWelcomeEmailHtml('<New User>', 'https://app.riven.rocks');

        expect(WELCOME_EMAIL_SUBJECT).toBe('Welcome to Riven');
        expect(html).toContain('Your account is ready, &lt;New User&gt;');
        expect(html).toContain('Riven helps you turn class material into focused study sessions');
        expect(html).toContain('The fastest way to get started is to add your material');
        expect(html).toContain('A simple first session');
        expect(html).toContain('https://app.riven.rocks/onboarding');
        expect(html).toContain('https://app.riven.rocks/create');
        expect(html).toContain('OPEN RIVEN');
        expect(html).toContain('CREATE A DECK');
    });
});
