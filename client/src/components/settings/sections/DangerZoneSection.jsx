import React from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import SectionHeader from '../SectionHeader';
import SectionCard from '../SectionCard';
import SettingItem from '../SettingItem';

export default function DangerZoneSection({ onSignOut, openModal }) {
    return (
        <div>
            <SectionHeader
                eyebrow="Danger"
                title="Danger zone"
                description="Actions here affect access to the account itself."
                tone="danger"
            />
            <SectionCard tone="danger" className="overflow-hidden">
                <SettingItem icon={LogOut} title="Sign Out" description="End this session on this device" badge="Session" onClick={onSignOut} destructive />
                <SettingItem icon={Trash2} title="Delete Account" description="Permanently erase all data" badge="Permanent" onClick={() => openModal('delete')} destructive noBorder />
            </SectionCard>
        </div>
    );
}
