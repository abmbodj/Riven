import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-dvh bg-claude-bg text-claude-text">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-claude-bg/80 backdrop-blur-xl border-b border-botanical-sepia/5 safe-area-top">
                <div className="flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2.5 rounded-full glass-panel border border-botanical-sepia/5 tap-action active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow]"
                    >
                        <ArrowLeft className="w-5 h-5 text-claude-text" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-display font-bold truncate">Privacy Policy</h1>
                        <p className="text-[10px] font-mono text-claude-secondary tracking-wider uppercase">Last updated: March 4, 2026</p>
                    </div>
                    <Shield className="w-5 h-5 text-accent-gold shrink-0" />
                </div>
            </div>

            {/* Content */}
            <div className="px-4 pt-4 pb-12 space-y-4 max-w-lg mx-auto">
                {/* Intro */}
                <div className="glass-panel rounded-2xl p-4">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        Riven ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and web service (collectively, the "Service").
                    </p>
                </div>

                {/* Information We Collect */}
                <Section title="1. Information We Collect">
                    <SubSection title="Account Information">
                        When you create an account, we collect your email address, username, and a securely hashed password. You may optionally provide a display name and avatar.
                    </SubSection>
                    <SubSection title="Study Data">
                        We store the flashcard decks, cards, study progress, streak data, class information, assignments, and group activity you create within the Service. This data is essential to providing the core functionality of Riven.
                    </SubSection>
                    <SubSection title="Usage Data">
                        We may collect information about how you interact with the Service, including pages visited, features used, and timestamps. This helps us improve the app experience.
                    </SubSection>
                    <SubSection title="Payment Information">
                        Payment processing is handled by Stripe and RevenueCat. We do not store your credit card number or full payment details on our servers. We only receive confirmation of your subscription status.
                    </SubSection>
                    <SubSection title="LMS Integration Data">
                        If you connect a Learning Management System (e.g., Canvas), we access your course names and assignment information to sync them into Riven. We store your LMS access token securely and only access the minimum data required.
                    </SubSection>
                </Section>

                {/* How We Use Information */}
                <Section title="2. How We Use Your Information">
                    <ul className="text-[13px] text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                        <li>To provide, operate, and maintain the Service</li>
                        <li>To manage your account and subscription</li>
                        <li>To sync your study data across devices</li>
                        <li>To send you important account notifications</li>
                        <li>To generate AI-powered flashcards from your notes</li>
                        <li>To improve and optimize the Service</li>
                        <li>To detect and prevent fraud or abuse</li>
                    </ul>
                </Section>

                {/* Data Sharing */}
                <Section title="3. Data Sharing & Third Parties">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-3">
                        We do not sell your personal data. We share information only with the following third-party services, solely to operate the Service:
                    </p>
                    <ul className="text-[13px] text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                        <li><span className="text-claude-text font-medium">Stripe & RevenueCat</span> — payment processing</li>
                        <li><span className="text-claude-text font-medium">Google Gemini AI</span> — flashcard generation</li>
                        <li><span className="text-claude-text font-medium">Resend</span> — transactional emails</li>
                    </ul>
                </Section>

                {/* Data Storage & Security */}
                <Section title="4. Data Storage & Security">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-3">
                        Your data is stored on secure PostgreSQL databases. Passwords are hashed using bcrypt. All communication uses HTTPS encryption. We implement rate limiting, input sanitization, and security headers.
                    </p>
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        Riven also stores data locally on your device using IndexedDB for offline access. This local data remains on your device and is not accessible to us.
                    </p>
                </Section>

                {/* Data Retention */}
                <Section title="5. Data Retention & Deletion">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        We retain your data for as long as your account is active. You can delete your account at any time from the Settings page, which will permanently remove all of your data from our servers within 30 days.
                    </p>
                </Section>

                {/* Children's Privacy */}
                <Section title="6. Children's Privacy">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        Riven is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will delete it promptly.
                    </p>
                </Section>

                {/* Your Rights */}
                <Section title="7. Your Rights">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-3">
                        Depending on your jurisdiction, you may have the right to:
                    </p>
                    <ul className="text-[13px] text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                        <li>Access the personal data we hold about you</li>
                        <li>Request correction of inaccurate data</li>
                        <li>Request deletion of your data</li>
                        <li>Export your data (available via the Export feature)</li>
                        <li>Opt out of non-essential communications</li>
                    </ul>
                </Section>

                {/* Changes */}
                <Section title="8. Changes to This Policy">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy within the app. Your continued use of the Service after changes are posted constitutes acceptance of the updated policy.
                    </p>
                </Section>

                {/* Contact */}
                <Section title="9. Contact Us">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-2">
                        If you have questions about this Privacy Policy or your data, please contact us at:
                    </p>
                    <p className="text-[13px] font-medium text-accent-gold">support@riven.app</p>
                </Section>

                {/* Cross-link */}
                <Link
                    to="/terms"
                    className="block glass-panel rounded-2xl p-4 tap-action active:scale-[0.98] transition-transform"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] text-claude-secondary">See also:</span>
                        <span className="text-[13px] font-medium text-accent-gold">Terms of Service →</span>
                    </div>
                </Link>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <section className="glass-panel rounded-2xl p-4 space-y-3">
            <h2 className="text-[15px] font-display font-semibold text-claude-text">{title}</h2>
            {children}
        </section>
    );
}

function SubSection({ title, children }) {
    return (
        <div>
            <h3 className="text-[12px] font-semibold text-accent-gold mb-1 font-mono uppercase tracking-wider">{title}</h3>
            <p className="text-[13px] text-claude-secondary leading-relaxed">{children}</p>
        </div>
    );
}
