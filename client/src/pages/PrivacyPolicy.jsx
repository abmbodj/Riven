import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <div className="fullscreen-page p-6 pb-32">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <Link to="/" className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center tap-action">
                        <ArrowLeft className="w-5 h-5 text-claude-secondary" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-display font-bold">Privacy Policy</h1>
                        <p className="text-sm text-claude-secondary">Last updated: March 4, 2026</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Intro */}
                    <div className="glass-panel rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <Shield className="w-5 h-5 text-accent-gold" />
                            <h2 className="text-lg font-display font-semibold">Your Privacy Matters</h2>
                        </div>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Riven ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and web service (collectively, the "Service").
                        </p>
                    </div>

                    {/* Information We Collect */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">1. Information We Collect</h2>

                        <div>
                            <h3 className="text-sm font-semibold text-accent-gold mb-1">Account Information</h3>
                            <p className="text-sm text-claude-secondary leading-relaxed">
                                When you create an account, we collect your email address, username, and a securely hashed password. You may optionally provide a display name and avatar.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-accent-gold mb-1">Study Data</h3>
                            <p className="text-sm text-claude-secondary leading-relaxed">
                                We store the flashcard decks, cards, study progress, streak data, class information, assignments, and group activity you create within the Service. This data is essential to providing the core functionality of Riven.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-accent-gold mb-1">Usage Data</h3>
                            <p className="text-sm text-claude-secondary leading-relaxed">
                                We may collect information about how you interact with the Service, including pages visited, features used, and timestamps. This helps us improve the app experience.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-accent-gold mb-1">Payment Information</h3>
                            <p className="text-sm text-claude-secondary leading-relaxed">
                                Payment processing is handled by Stripe and RevenueCat. We do not store your credit card number or full payment details on our servers. We only receive confirmation of your subscription status.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-accent-gold mb-1">LMS Integration Data</h3>
                            <p className="text-sm text-claude-secondary leading-relaxed">
                                If you connect a Learning Management System (e.g., Canvas), we access your course names and assignment information to sync them into Riven. We store your LMS access token securely and only access the minimum data required.
                            </p>
                        </div>
                    </section>

                    {/* How We Use Information */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">2. How We Use Your Information</h2>
                        <ul className="text-sm text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                            <li>To provide, operate, and maintain the Service</li>
                            <li>To manage your account and subscription</li>
                            <li>To sync your study data across devices</li>
                            <li>To send you important account notifications (e.g., email verification, password resets)</li>
                            <li>To generate AI-powered flashcards from your notes (when you use this feature)</li>
                            <li>To display relevant advertisements to free-tier users</li>
                            <li>To improve and optimize the Service</li>
                            <li>To detect and prevent fraud or abuse</li>
                        </ul>
                    </section>

                    {/* Data Sharing */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">3. Data Sharing & Third Parties</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            We do not sell your personal data. We share information only with the following third-party services, solely to operate the Service:
                        </p>
                        <ul className="text-sm text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                            <li><span className="text-claude-primary font-medium">Stripe & RevenueCat</span> — payment and subscription processing</li>
                            <li><span className="text-claude-primary font-medium">Google AdSense</span> — displaying ads to free-tier users</li>
                            <li><span className="text-claude-primary font-medium">Google Gemini AI</span> — generating flashcards from notes (your notes are sent to the AI API and are not retained by the AI provider beyond processing)</li>
                            <li><span className="text-claude-primary font-medium">Resend</span> — transactional emails (verification, password reset)</li>
                        </ul>
                    </section>

                    {/* Data Storage & Security */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">4. Data Storage & Security</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Your data is stored on secure PostgreSQL databases. Passwords are hashed using bcrypt. All communication between the app and our servers uses HTTPS encryption. We implement rate limiting, input sanitization, and security headers to protect against common attacks.
                        </p>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Riven also stores data locally on your device using IndexedDB for offline access. This local data remains on your device and is not accessible to us.
                        </p>
                    </section>

                    {/* Data Retention */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">5. Data Retention & Deletion</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            We retain your data for as long as your account is active. You can delete your account at any time from the Settings page, which will permanently remove all of your data from our servers within 30 days.
                        </p>
                    </section>

                    {/* Children's Privacy */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">6. Children's Privacy</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Riven is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will delete it promptly.
                        </p>
                    </section>

                    {/* Your Rights */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">7. Your Rights</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            Depending on your jurisdiction, you may have the right to:
                        </p>
                        <ul className="text-sm text-claude-secondary space-y-2 list-disc list-inside leading-relaxed">
                            <li>Access the personal data we hold about you</li>
                            <li>Request correction of inaccurate data</li>
                            <li>Request deletion of your data</li>
                            <li>Export your data (available via the Export feature in the app)</li>
                            <li>Opt out of non-essential communications</li>
                        </ul>
                    </section>

                    {/* Changes */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">8. Changes to This Policy</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy within the app. Your continued use of the Service after changes are posted constitutes acceptance of the updated policy.
                        </p>
                    </section>

                    {/* Contact */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h2 className="text-lg font-display font-semibold">9. Contact Us</h2>
                        <p className="text-sm text-claude-secondary leading-relaxed">
                            If you have questions about this Privacy Policy or your data, please contact us at:
                        </p>
                        <p className="text-sm font-medium text-accent-gold">support@riven.app</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
