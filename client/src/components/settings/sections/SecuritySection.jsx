import React from 'react';
import { Lock, Shield } from 'lucide-react';
import SectionHeader from '../SectionHeader';
import SectionCard from '../SectionCard';
import SettingItem from '../SettingItem';

export default function SecuritySection({ user, openModal }) {
    return (
        <div>
            <SectionHeader
                eyebrow="Account"
                title="Security"
                description="Protect your login and recovery options."
            />
            <SectionCard className="overflow-hidden">
                <SettingItem icon={Lock} title="Change Password" description="Update your credentials" badge="Access" onClick={() => openModal('password')} />
                <SettingItem icon={Shield} title="Two-Factor Auth" description={user?.twoFAEnabled ? 'Enabled — manage 2FA' : 'Add extra security'} badge={user?.twoFAEnabled ? 'Enabled' : 'Recommended'} onClick={() => openModal('twoFactor')} noBorder />
            </SectionCard>
        </div>
    );
}
