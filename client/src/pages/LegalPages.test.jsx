import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PrivacyPolicy from './PrivacyPolicy.jsx';
import TermsOfService from './TermsOfService.jsx';

const originalMatchMedia = window.matchMedia;
const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

function mockMatchMedia({ reducedMotion = false } = {}) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
}

function renderPrivacy() {
    return render(
        <MemoryRouter>
            <PrivacyPolicy />
        </MemoryRouter>
    );
}

function renderTerms() {
    return render(
        <MemoryRouter>
            <TermsOfService />
        </MemoryRouter>
    );
}

describe('legal pages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMatchMedia();
        Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
            writable: true,
            value: vi.fn(),
        });
        window.location.hash = '';
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
            writable: true,
            value: originalScrollIntoView,
        });
        window.location.hash = '';
    });

    it('renders updated privacy content, navigation, and related terms link', () => {
        renderPrivacy();

        expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
        expect(screen.getByLabelText('Privacy Policy sections')).toBeInTheDocument();
        expect(screen.getByLabelText('Privacy Policy table of contents')).toBeInTheDocument();
        expect(screen.getByText(/Supabase/i)).toBeInTheDocument();
        expect(screen.getByText(/RevenueCat/i)).toBeInTheDocument();
        expect(screen.getByText(/Google AdSense/i)).toBeInTheDocument();
        expect(screen.getByText(/Cloudflare Turnstile/i)).toBeInTheDocument();

        const relatedLink = screen.getByRole('link', { name: /terms of service/i });
        expect(relatedLink).toHaveAttribute('href', '/terms');
    });

    it('renders updated terms content and related privacy link', () => {
        renderTerms();

        expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
        expect(screen.getByText(/YouTube study tools/i)).toBeInTheDocument();
        expect(screen.getByText(/audio note enhancement/i)).toBeInTheDocument();
        expect(screen.getByText(/study groups/i)).toBeInTheDocument();
        expect(screen.getByText(/RevenueCat/i)).toBeInTheDocument();
        expect(screen.getByText(/Stripe/i)).toBeInTheDocument();

        const relatedLink = screen.getByRole('link', { name: /privacy policy/i });
        expect(relatedLink).toHaveAttribute('href', '/privacy');
    });

    it('uses smooth scrolling for section jumps when reduced motion is off', () => {
        renderPrivacy();

        const nav = screen.getByLabelText('Privacy Policy sections');
        fireEvent.click(within(nav).getByRole('button', { name: /sharing and service providers/i }));

        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: 'smooth', block: 'start' })
        );
    });

    it('uses instant scrolling for section jumps when reduced motion is on', () => {
        mockMatchMedia({ reducedMotion: true });
        renderTerms();

        const nav = screen.getByLabelText('Terms of Service sections');
        fireEvent.click(within(nav).getByRole('button', { name: /acceptable use/i }));

        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: 'auto', block: 'start' })
        );
    });
});
