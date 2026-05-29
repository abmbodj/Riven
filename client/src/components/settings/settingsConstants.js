import { Shield, CreditCard, Network, Sparkles, Bell, UserMinus, Mail, Trash2 } from 'lucide-react';

export const SURFACE_TEXTURE = {
    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
    backgroundSize: '10px 10px'
};

export const AI_CAPABILITIES = [
    'Flashcard decks',
    'Class setup',
    'Study guides',
    'Mock exams',
    'YouTube study imports',
    'Audio note enhancement',
];

export const DEFAULT_REMOTE_PUSH_PREFERENCES = Object.freeze({
    messagesEnabled: true,
    streakEnabled: true,
    reengagementEnabled: true,
});

export const SETTINGS_SECTIONS = [
    { id: 'security', label: 'Security', icon: Shield, tone: 'default' },
    { id: 'plan', label: 'Plan & access', icon: CreditCard, tone: 'accent' },
    { id: 'integrations', label: 'Integrations', icon: Network, tone: 'info' },
    { id: 'ai', label: 'Study Tools', icon: Sparkles, tone: 'warning' },
    { id: 'notifications', label: 'Notifications', icon: Bell, tone: 'default' },
    { id: 'safety', label: 'Safety controls', icon: UserMinus, tone: 'default' },
    { id: 'help', label: 'Help & policies', icon: Mail, tone: 'default' },
    { id: 'danger', label: 'Danger zone', icon: Trash2, tone: 'danger' },
];

export const SIDEBAR_STORAGE_KEY = 'riven:settings-sidebar-expanded';

export const sectionTransition = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
};
