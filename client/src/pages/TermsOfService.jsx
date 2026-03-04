import { Link } from 'react-router-dom';
import { ArrowLeft, ScrollText } from 'lucide-react';

export default function TermsOfService() {
    return (
        <div className="fullscreen-page p-6 pb-32">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <Link to="/" className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center tap-action">
                        <ArrowLeft className="w-5 h-5 text-claude-secondary" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-bold">Terms of Service</h1>
                        <p className="text-sm text-claude-secondary">Last updated: March 4, 2026</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Intro */}
                    <div className="glass-panel rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <ScrollText className="w-5 h-5 text-accent-gold" />
                            <h2 className="text-lg font-display font-semibold">Agreement to Terms</h2>
                        </div>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            By accessing or using Riven ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. These terms constitute a legally binding agreement between you and Riven.
                        </p>
                    </div>

                    {/* Description of Service */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">1. Description of Service</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Riven is a student productivity application that provides flashcard creation and study tools, spaced repetition, class and assignment management, study groups, and related educational features. The Service is available as a web application and mobile app.
                        </p>
                    </section>

                    {/* Accounts */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">2. User Accounts</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            To use certain features, you must create an account. You are responsible for:
                        </p>
                        <ul className="text-sm text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                            <li>Providing accurate and complete registration information</li>
                            <li>Maintaining the security of your account credentials</li>
                            <li>All activity that occurs under your account</li>
                            <li>Notifying us immediately of any unauthorized use</li>
                        </ul>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive behavior.
                        </p>
                    </section>

                    {/* Acceptable Use */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">3. Acceptable Use</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            You agree not to:
                        </p>
                        <ul className="text-sm text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                            <li>Use the Service for any illegal purpose</li>
                            <li>Upload content that is offensive, harmful, or infringes on others' rights</li>
                            <li>Attempt to gain unauthorized access to any part of the Service</li>
                            <li>Interfere with or disrupt the Service or its servers</li>
                            <li>Use automated tools to scrape, crawl, or extract data from the Service</li>
                            <li>Harass, bully, or threaten other users through messaging or study groups</li>
                            <li>Create multiple accounts to abuse free-tier limitations or referral programs</li>
                            <li>Share content that violates academic integrity policies</li>
                        </ul>
                    </section>

                    {/* User Content */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">4. User Content</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            You retain ownership of all content you create within Riven, including flashcard decks, cards, notes, and study materials. By using the Service, you grant us a limited, non-exclusive license to store, process, and display your content solely to provide the Service to you.
                        </p>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            When you share decks or participate in study groups, your content becomes visible to other members of those groups. You are responsible for the content you share.
                        </p>
                    </section>

                    {/* Subscriptions & Payments */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">5. Subscriptions & Payments</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Riven offers free and premium subscription tiers. By purchasing a subscription:
                        </p>
                        <ul className="text-sm text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                            <li>You authorize us to charge the payment method on file through our payment processors (Stripe, Apple App Store)</li>
                            <li>Monthly subscriptions renew automatically unless cancelled before the renewal date</li>
                            <li>Lifetime subscriptions provide permanent access to premium features with a one-time payment</li>
                            <li>Refunds are handled according to the refund policies of the applicable payment platform (App Store, Stripe)</li>
                        </ul>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            We reserve the right to modify pricing with reasonable notice. Existing subscriptions will honor their original price until the next renewal cycle.
                        </p>
                    </section>

                    {/* Ads */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">6. Advertisements</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Free-tier users may be shown advertisements through Google AdSense. Rewarded ads are optional — watching them provides in-app rewards such as heart refills. Ads are served by third-party networks and are subject to their own privacy policies.
                        </p>
                    </section>

                    {/* AI Features */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">7. AI-Generated Content</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Riven offers AI-powered flashcard generation. When using this feature, your notes are sent to a third-party AI service for processing. AI-generated flashcards are provided as-is and may contain inaccuracies. You are responsible for reviewing and verifying AI-generated content before using it for study purposes.
                        </p>
                    </section>

                    {/* Intellectual Property */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">8. Intellectual Property</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            The Service, including its design, code, graphics, logos, and features, is owned by Riven and protected by intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the Service without our written permission.
                        </p>
                    </section>

                    {/* Limitation of Liability */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">9. Limitation of Liability</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            The Service is provided "as is" without warranties of any kind, express or implied. To the fullest extent permitted by law:
                        </p>
                        <ul className="text-sm text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                            <li>We are not liable for any indirect, incidental, or consequential damages</li>
                            <li>We do not guarantee uninterrupted or error-free operation of the Service</li>
                            <li>We are not responsible for academic outcomes based on use of the Service</li>
                            <li>Our total liability shall not exceed the amount you paid for the Service in the 12 months preceding the claim</li>
                        </ul>
                    </section>

                    {/* Termination */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">10. Termination</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            You may delete your account at any time through the Settings page. We may suspend or terminate your account if you violate these terms. Upon termination, your right to use the Service ceases immediately, and your data will be deleted in accordance with our Privacy Policy.
                        </p>
                    </section>

                    {/* Governing Law */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">11. Governing Law</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes arising from these terms shall be resolved through binding arbitration, except where prohibited by law.
                        </p>
                    </section>

                    {/* Changes */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">12. Changes to These Terms</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            We may revise these Terms at any time. Material changes will be communicated through the app or via email. Your continued use of the Service after changes take effect constitutes acceptance of the revised terms.
                        </p>
                    </section>

                    {/* Contact */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">13. Contact Us</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            If you have questions about these Terms of Service, please contact us at:
                        </p>
                        <p className="text-sm font-medium text-accent-gold">support@riven.app</p>
                    </section>

                    {/* Links */}
                    <div className="glass-panel rounded-2xl p-5 flex items-center justify-between">
                        <span className="text-sm text-claude-secondary">See also:</span>
                        <Link to="/privacy" className="text-sm font-medium text-accent-gold tap-action hover:underline">
                            Privacy Policy →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
