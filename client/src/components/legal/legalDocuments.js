export const privacyPolicyDocument = {
    title: 'Privacy Policy',
    lastUpdated: 'May 29, 2026',
    overview: 'This Privacy Policy explains what information Riven collects, how we use it, when we share it, and the choices you have when using the web app, mobile app, and related services.',
    contactEmail: 'support@riven.app',
    sibling: {
        href: '/terms',
        label: 'Terms of Service',
        description: 'Review the usage rules, billing terms, and account obligations that govern Riven.',
        cta: 'Open Terms',
    },
    sections: [
        {
            id: 'information-we-collect',
            title: '1. Information We Collect',
            blocks: [
                {
                    type: 'subsections',
                    items: [
                        {
                            title: 'Account and profile information',
                            text: 'When you create or manage a Riven account, we may collect your email address, username, display name, avatar, authentication identifiers, subscription tier, and security settings such as password changes or two-factor authentication status.',
                        },
                        {
                            title: 'Study and class information',
                            text: 'We collect the content and metadata you create in Riven, including classes, assignments, calendar-related information, notes, decks, flashcards, guides, mock exams, study progress, streaks, theme settings, and other learning preferences.',
                        },
                        {
                            title: 'Social and collaboration data',
                            text: 'If you use messages, study groups, referrals, shared decks, or shared resources, we collect the information needed to support those features, including usernames, group membership, message content, and the study materials you choose to share.',
                        },
                        {
                            title: 'AI and media inputs',
                            text: 'If you use AI-powered features, we collect the material you provide for processing, such as typed notes, uploaded text, class context, audio recordings or transcripts, and YouTube links or related source data used to generate notes, decks, guides, or exams.',
                        },
                        {
                            title: 'Billing and purchase status',
                            text: 'We do not store full payment card details on our own servers. We do receive billing and subscription information needed to confirm plan status, purchase state, renewals, restorations, cancellations, and customer identifiers from our payment providers.',
                        },
                        {
                            title: 'Usage, device, and technical information',
                            text: 'We may collect log data, approximate device and browser information, app version, crash data, feature usage, page views, request metadata, notification token state, and related diagnostics to keep Riven secure and reliable.',
                        },
                        {
                            title: 'Local and browser-stored information',
                            text: 'Riven may store information locally on your device or browser, including IndexedDB or similar offline cache data, session information, preferences, and web cookies that support authentication, security protections, and app functionality.',
                        },
                    ],
                },
            ],
        },
        {
            id: 'how-we-use-information',
            title: '2. How We Use Information',
            blocks: [
                {
                    type: 'list',
                    items: [
                        'Provide, maintain, personalize, and improve Riven and its study workflows.',
                        'Create and sync notes, decks, tutor sessions, mock exams, calendars, assignments, and other study surfaces across supported devices.',
                        'Process AI generation, transcription, YouTube import, and note-enhancement requests that you initiate.',
                        'Support account security, login flows, fraud prevention, abuse monitoring, and customer support.',
                        'Manage subscription access, purchases, renewals, restorations, and plan-related limits.',
                        'Send service messages, verification emails, password-reset flows, and user-enabled notification reminders.',
                        'Measure product usage, debug issues, monitor performance, and protect the service from misuse.',
                    ],
                },
            ],
        },
        {
            id: 'sharing-and-service-providers',
            title: '3. Sharing and Service Providers',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'We do not sell your personal information. We share data only as needed to run Riven, comply with law, protect users, or complete actions that you request.',
                },
                {
                    type: 'subsections',
                    items: [
                        {
                            title: 'Infrastructure and auth',
                            text: 'We use Supabase and related infrastructure services to support authentication, data storage, file storage, and backend workflows.',
                        },
                        {
                            title: 'Payments and subscriptions',
                            text: 'We use Stripe for web billing flows and RevenueCat for subscription state management, including native mobile purchase flows where applicable.',
                        },
                        {
                            title: 'AI and transcription processing',
                            text: 'We use Google Gemini and related processing services for AI generation and certain transcription or content-processing features that you trigger.',
                        },
                        {
                            title: 'Email, analytics, and monitoring',
                            text: 'We use Resend for transactional email, PostHog for product analytics, and Sentry for crash and error monitoring.',
                        },
                        {
                            title: 'Ads, bot protection, and integrations',
                            text: 'On supported web surfaces, we may use Google AdSense for advertising. We may use Cloudflare Turnstile when enabled to reduce abusive signups. If you connect Canvas, Apple Sign In, or Google Sign In, we exchange the information required to complete those integrations.',
                        },
                    ],
                },
            ],
        },
        {
            id: 'web-and-native-experiences',
            title: '4. Web and Native Experiences',
            blocks: [
                {
                    type: 'subsections',
                    items: [
                        {
                            title: 'Web app behavior',
                            text: 'On the web, Riven may use cookies, browser storage, analytics tooling, and web-based billing flows. Web users may also encounter advertising-supported surfaces where enabled.',
                        },
                        {
                            title: 'Native mobile behavior',
                            text: 'In native mobile builds, Riven may use platform-specific capabilities such as push notifications, local notifications, native purchases, microphone access for audio note features, and device-level storage needed to provide the app experience.',
                        },
                        {
                            title: 'Notifications',
                            text: 'If you opt in, we may store the information needed to send assignment reminders, streak reminders, message notifications, or re-engagement notifications. You can manage notification permissions in your device or browser settings.',
                        },
                    ],
                },
            ],
        },
        {
            id: 'storage-security-retention',
            title: '5. Storage, Security, and Retention',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'We use reasonable administrative, technical, and organizational safeguards to protect Riven data, including encrypted transport, access controls, authentication safeguards, and monitoring. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.',
                },
                {
                    type: 'paragraph',
                    text: 'We keep information for as long as reasonably necessary to provide the service, comply with legal obligations, resolve disputes, enforce agreements, and maintain legitimate business records. Some local or cached data may remain on your device until you clear the app or browser storage.',
                },
            ],
        },
        {
            id: 'choices-and-rights',
            title: '6. Your Choices and Rights',
            blocks: [
                {
                    type: 'list',
                    items: [
                        'Access, update, or correct account information through Riven settings where available.',
                        'Delete your account or request deletion of certain information, subject to legal or operational retention needs.',
                        'Export or retain copies of study materials you created where export features are available.',
                        'Manage push permissions, local notification permissions, and certain email or support communications.',
                        'Disconnect integrations such as Canvas or third-party sign-in methods where supported.',
                    ],
                },
                {
                    type: 'paragraph',
                    text: 'Depending on where you live, you may have additional privacy rights under applicable law. Contact us if you want to make a rights request.',
                },
            ],
        },
        {
            id: 'children-and-education-context',
            title: '7. Children and Education Context',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'Riven is designed for students and learners, but it is not directed to children under 13. If you believe a child under 13 has provided personal information to us without appropriate authorization, contact us so we can investigate and take appropriate action.',
                },
            ],
        },
        {
            id: 'changes-and-contact',
            title: '8. Changes and Contact',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'We may update this Privacy Policy from time to time to reflect product changes, legal requirements, or operational updates. When changes are material, we may provide notice in the app, by email, or by updating the effective date above.',
                },
                {
                    type: 'paragraph',
                    text: 'If you have questions about this Privacy Policy or want to contact us about your information, email support@riven.app.',
                },
            ],
        },
    ],
};

export const termsOfServiceDocument = {
    title: 'Terms of Service',
    lastUpdated: 'May 29, 2026',
    overview: 'These Terms of Service govern your use of Riven, including accounts, subscriptions, study features, AI tools, and the shared spaces available across the service.',
    contactEmail: 'support@riven.app',
    sibling: {
        href: '/privacy',
        label: 'Privacy Policy',
        description: 'See how Riven collects, uses, stores, and shares account and study-related information.',
        cta: 'Open Privacy Policy',
    },
    sections: [
        {
            id: 'service-overview',
            title: '1. Service Overview',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'Riven is a study and productivity platform for learners. Depending on the surface you use, Riven may include notes, decks, flashcards, tutor sessions, mock exams, YouTube study tools, audio note enhancement, classes, assignments, calendar features, study groups, messaging, sharing tools, and personalization features.',
                },
            ],
        },
        {
            id: 'accounts-eligibility-and-security',
            title: '2. Accounts, Eligibility, and Security',
            blocks: [
                {
                    type: 'list',
                    items: [
                        'You must provide accurate information when creating an account or using protected features.',
                        'You are responsible for maintaining the confidentiality of your login credentials and any activity that occurs under your account.',
                        'You must notify us promptly if you believe your account has been accessed without authorization.',
                        'We may suspend, restrict, or terminate accounts that create security risk, violate these Terms, or misuse the platform.',
                    ],
                },
            ],
        },
        {
            id: 'subscriptions-and-payments',
            title: '3. Subscriptions and Payments',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'Riven may offer free and paid plans. On the web, paid purchases may be processed through Stripe. On native mobile platforms, purchases may be processed through Apple in-app purchase flows with RevenueCat used to help manage subscription state.',
                },
                {
                    type: 'list',
                    items: [
                        'Paid plans may renew automatically until cancelled through the applicable billing platform.',
                        'Refunds, billing disputes, and cancellation timing may be governed by the payment platform that processed the purchase.',
                        'We may change pricing, plan structure, or included features with reasonable notice.',
                        'Abuse of trials, referrals, discounts, purchase restoration flows, or free-tier limits is prohibited.',
                    ],
                },
            ],
        },
        {
            id: 'user-content-and-sharing',
            title: '4. User Content and Sharing',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'You retain ownership of the content you create or upload to Riven, including notes, decks, study materials, recordings, messages, and shared resources. You grant us a limited, non-exclusive license to host, store, process, reproduce, and display that content only as needed to operate and improve the service for you.',
                },
                {
                    type: 'paragraph',
                    text: 'If you share content with other users, groups, or collaborative surfaces, you are responsible for what you share and understand that it may become visible to the recipients you selected.',
                },
            ],
        },
        {
            id: 'ai-features-and-generated-output',
            title: '5. AI Features and Generated Output',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'Riven includes AI-assisted features such as note enhancement, tutor sessions, mock exams, flashcard generation, audio transcription, and YouTube-derived study outputs. By using those features, you authorize us to process the source material you provide through third-party AI or processing services required to generate the result.',
                },
                {
                    type: 'list',
                    items: [
                        'AI-generated output is assistive and may be incomplete, misleading, or inaccurate.',
                        'You are responsible for reviewing generated content before relying on it for learning, assignments, testing, or sharing.',
                        'You may not use AI features to upload or process material that you do not have the right to use.',
                    ],
                },
            ],
        },
        {
            id: 'acceptable-use',
            title: '6. Acceptable Use',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'You agree not to misuse Riven. Prohibited conduct includes, without limitation:',
                },
                {
                    type: 'list',
                    items: [
                        'Using the service for unlawful, fraudulent, abusive, or harmful purposes.',
                        'Harassing, threatening, impersonating, or bullying other users through messages, groups, or shared content.',
                        'Uploading infringing, malicious, deceptive, or clearly harmful material.',
                        'Attempting unauthorized access, probing, scraping, reverse engineering, or interfering with the platform or its users.',
                        'Using bots, scripts, or automation in ways that overload, extract from, or unfairly exploit the service.',
                        'Abusing AI tools, free-tier quotas, referral systems, or subscription flows.',
                        'Using the service in ways intended to evade academic rules, institutional policies, or lawful restrictions imposed on you.',
                    ],
                },
            ],
        },
        {
            id: 'educational-use-and-academic-responsibility',
            title: '7. Educational Use and Academic Responsibility',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'Riven is designed to support studying and learning, but we do not guarantee academic outcomes, grades, or institution compliance. You are responsible for deciding how to use Riven within the policies that apply to your school, class, workplace, or testing environment.',
                },
            ],
        },
        {
            id: 'intellectual-property',
            title: '8. Intellectual Property',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'Except for your content and other third-party materials, Riven and its related software, branding, interfaces, design, and service content are owned by us or our licensors and are protected by law. You may not copy, sell, sublicense, distribute, or reverse engineer the service except as permitted by applicable law or our written permission.',
                },
            ],
        },
        {
            id: 'availability-changes-and-termination',
            title: '9. Availability, Changes, and Termination',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'We may modify, suspend, or discontinue features, integrations, pricing, or parts of the service at any time. We may also suspend or terminate your access if we believe you violated these Terms, created risk for users or the platform, or used the service in a way that exposes us or others to harm.',
                },
                {
                    type: 'paragraph',
                    text: 'You may stop using Riven at any time and may delete your account through available account controls, subject to any remaining billing obligations with the platform that processed your purchase.',
                },
            ],
        },
        {
            id: 'disclaimers-and-limitation-of-liability',
            title: '10. Disclaimers and Limitation of Liability',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'Riven is provided on an "as is" and "as available" basis to the fullest extent permitted by law. We do not guarantee uninterrupted availability, perfect accuracy, or that every feature will always work on every device, browser, or platform.',
                },
                {
                    type: 'list',
                    items: [
                        'We are not responsible for decisions you make based on AI-generated or user-generated content.',
                        'We are not liable for indirect, incidental, special, consequential, or punitive damages to the fullest extent permitted by law.',
                        'To the fullest extent permitted by law, our total liability for claims arising out of or relating to Riven will not exceed the amount you paid us for the applicable paid service during the 12 months before the claim arose.',
                    ],
                },
            ],
        },
        {
            id: 'governing-law-and-changes',
            title: '11. Governing Law and Changes to These Terms',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'These Terms are governed by applicable law in the United States, without regard to conflict-of-law principles, unless local law requires otherwise. We may update these Terms from time to time, and your continued use of Riven after an updated version becomes effective means the updated Terms apply to your continued use.',
                },
            ],
        },
        {
            id: 'contact',
            title: '12. Contact',
            blocks: [
                {
                    type: 'paragraph',
                    text: 'If you have questions about these Terms, contact us at support@riven.app.',
                },
            ],
        },
    ],
};
