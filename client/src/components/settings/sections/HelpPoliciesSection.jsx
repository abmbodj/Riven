import React from 'react';
import { MessageSquare, Mail, Shield, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SectionHeader from '../SectionHeader';
import SectionCard from '../SectionCard';
import SettingItem from '../SettingItem';

export default function HelpPoliciesSection({ openModal }) {
    const navigate = useNavigate();

    return (
        <div>
            <SectionHeader
                eyebrow="Support"
                title="Help & policies"
                description="Reach support and review the documents that govern your account."
            />
            <SectionCard className="overflow-hidden">
                <SettingItem
                    icon={MessageSquare}
                    title="Send feedback"
                    description="Share a suggestion with the owner"
                    badge="Inbox"
                    onClick={() => openModal('feedback')}
                />
                <SettingItem
                    icon={Mail}
                    title="Contact Support"
                    description="Email the developer"
                    badge="Direct"
                    onClick={() => window.open('mailto:support@Riven.app')}
                />
                <SettingItem
                    icon={Shield}
                    title="Privacy Policy"
                    description="How we protect your data"
                    badge="Policy"
                    onClick={() => navigate('/privacy')}
                />
                <SettingItem
                    icon={BookOpen}
                    title="Terms of Service"
                    description="EULA and usage rules"
                    badge="Legal"
                    onClick={() => navigate('/terms')}
                    noBorder
                />
            </SectionCard>
        </div>
    );
}
