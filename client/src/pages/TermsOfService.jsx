import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ScrollText } from 'lucide-react';

export default function TermsOfService() {
    const navigate = useNavigate();

    return (
        <div className="min-h-dvh bg-claude-bg text-claude-text">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-claude-bg/80 md:backdrop-blur-xl border-b border-botanical-sepia/5 safe-area-top">
                <div className="flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2.5 rounded-full glass-panel border border-botanical-sepia/5 tap-action active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow]"
                    >
                        <ArrowLeft className="w-5 h-5 text-claude-text" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-display font-bold truncate">Terms of Service</h1>
                        <p className="text-[10px] font-mono text-claude-secondary tracking-wider uppercase">Last updated: March 4, 2026</p>
                    </div>
                    <ScrollText className="w-5 h-5 text-accent-gold shrink-0" />
                </div>
            </div>

            {/* Content */}
            <div className="px-4 pt-4 pb-12 space-y-4 max-w-lg mx-auto">
                {/* Intro */}
                <div className="glass-panel rounded-2xl p-4">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        By accessing or using Riven ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. These terms constitute a legally binding agreement between you and Riven.
                    </p>
                </div>

                {/* Description of Service */}
                <Section title="1. Description of Service">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        Riven is a student productivity application that provides flashcard creation and study tools, spaced repetition, class and assignment management, study groups, and related educational features. The Service is available as a web application and mobile app.
                    </p>
                </Section>

                {/* Accounts */}
                <Section title="2. User Accounts">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-3">
                        To use certain features, you must create an account. You are responsible for:
                    </p>
                    <ul className="text-[13px] text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                        <li>Providing accurate and complete registration information</li>
                        <li>Maintaining the security of your account credentials</li>
                        <li>All activity that occurs under your account</li>
                        <li>Notifying us immediately of any unauthorized use</li>
                    </ul>
                    <p className="text-[13px] text-claude-secondary leading-relaxed mt-3">
                        We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive behavior.
                    </p>
                </Section>

                {/* Acceptable Use */}
                <Section title="3. Acceptable Use">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-3">
                        You agree not to:
                    </p>
                    <ul className="text-[13px] text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                        <li>Use the Service for any illegal purpose</li>
                        <li>Upload offensive, harmful, or infringing content</li>
                        <li>Attempt unauthorized access to the Service</li>
                        <li>Interfere with or disrupt the Service</li>
                        <li>Use automated tools to scrape or extract data</li>
                        <li>Harass, bully, or threaten other users</li>
                        <li>Create multiple accounts to abuse free-tier limits or referrals</li>
                        <li>Share content that violates academic integrity policies</li>
                    </ul>
                </Section>

                {/* User Content */}
                <Section title="4. User Content">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-3">
                        You retain ownership of all content you create within Riven, including flashcard decks, cards, notes, and study materials. By using the Service, you grant us a limited, non-exclusive license to store, process, and display your content solely to provide the Service to you.
                    </p>
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        When you share decks or participate in study groups, your content becomes visible to other members. You are responsible for the content you share.
                    </p>
                </Section>

                {/* Subscriptions & Payments */}
                <Section title="5. Subscriptions & Payments">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-3">
                        Riven offers free and premium subscription tiers. By purchasing a subscription:
                    </p>
                    <ul className="text-[13px] text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                        <li>You authorize charges through Stripe or Apple App Store</li>
                        <li>Monthly and annual subscriptions renew automatically unless cancelled</li>
                        <li>Some users may receive complimentary or promotional lifetime access outside of standard paid plans</li>
                        <li>Refunds follow the applicable platform's refund policy</li>
                    </ul>
                    <p className="text-[13px] text-claude-secondary leading-relaxed mt-3">
                        We reserve the right to modify pricing with reasonable notice. Existing subscriptions honor their original price until the next renewal.
                    </p>
                </Section>

                {/* AI Features */}
                <Section title="6. AI-Generated Content">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        Riven offers AI-powered flashcard generation. When using this feature, your notes are sent to a third-party AI service for processing. AI-generated flashcards are provided as-is and may contain inaccuracies. You are responsible for reviewing and verifying AI-generated content.
                    </p>
                </Section>

                {/* Intellectual Property */}
                <Section title="7. Intellectual Property">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        The Service, including its design, code, graphics, logos, and features, is owned by Riven and protected by intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the Service without our written permission.
                    </p>
                </Section>

                {/* Limitation of Liability */}
                <Section title="8. Limitation of Liability">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-3">
                        The Service is provided "as is" without warranties of any kind. To the fullest extent permitted by law:
                    </p>
                    <ul className="text-[13px] text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                        <li>We are not liable for indirect, incidental, or consequential damages</li>
                        <li>We do not guarantee uninterrupted or error-free operation</li>
                        <li>We are not responsible for academic outcomes</li>
                        <li>Total liability shall not exceed the amount paid in the preceding 12 months</li>
                    </ul>
                </Section>

                {/* Termination */}
                <Section title="9. Termination">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        You may delete your account at any time through the Settings page. We may suspend or terminate your account if you violate these terms. Upon termination, your right to use the Service ceases immediately, and your data will be deleted per our Privacy Policy.
                    </p>
                </Section>

                {/* Governing Law */}
                <Section title="10. Governing Law">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes shall be resolved through binding arbitration, except where prohibited by law.
                    </p>
                </Section>

                {/* Changes */}
                <Section title="11. Changes to These Terms">
                    <p className="text-[13px] text-claude-secondary leading-relaxed">
                        We may revise these Terms at any time. Material changes will be communicated through the app or via email. Your continued use after changes take effect constitutes acceptance.
                    </p>
                </Section>

                {/* Contact */}
                <Section title="12. Contact Us">
                    <p className="text-[13px] text-claude-secondary leading-relaxed mb-2">
                        If you have questions about these Terms, please contact us at:
                    </p>
                    <p className="text-[13px] font-medium text-accent-gold">support@riven.app</p>
                </Section>

                {/* Cross-link */}
                <Link
                    to="/privacy"
                    className="block glass-panel rounded-2xl p-4 tap-action active:scale-[0.98] transition-transform"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] text-claude-secondary">See also:</span>
                        <span className="text-[13px] font-medium text-accent-gold">Privacy Policy →</span>
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
