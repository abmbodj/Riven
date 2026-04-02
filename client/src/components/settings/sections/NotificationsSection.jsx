import React from 'react';
import { Bell, Leaf, MessageSquare, RefreshCw } from 'lucide-react';
import SectionHeader from '../SectionHeader';
import SectionCard from '../SectionCard';
import StatusNotice from '../StatusNotice';
import SettingItem from '../SettingItem';

export default function NotificationsSection({
    notificationsEnabled,
    onToggleNotifications,
    remotePushStatus,
    remotePushAvailable,
    pushPermissionGranted,
    remotePushPreferences,
    pushPreferencesLoading,
    savingPushPreference,
    onToggleRemotePushPreference,
}) {
    return (
        <div>
            <SectionHeader
                eyebrow="Preferences"
                title="Notifications"
                description="Control assignment reminders and remote iPhone pushes."
            />
            <SectionCard className="overflow-hidden">
                <div className="px-4 py-4 sm:px-5">
                    <StatusNotice
                        tone={remotePushStatus.tone}
                        title={remotePushStatus.title}
                        detail={remotePushStatus.detail}
                    />
                </div>
                <SettingItem
                    icon={Bell}
                    title="Assignment reminders"
                    description="Assignment reminders at 24h, 12h, 3h, 1h & 30m"
                    badge={notificationsEnabled ? "On" : "Off"}
                    toggle={true}
                    toggleValue={notificationsEnabled}
                    onClick={onToggleNotifications}
                />
                <SettingItem
                    icon={MessageSquare}
                    title="Messages"
                    description="Preview new direct messages on your lock screen"
                    badge={savingPushPreference === 'messagesEnabled' ? 'Saving' : (pushPermissionGranted && remotePushPreferences.messagesEnabled ? 'On' : 'Off')}
                    toggle={true}
                    toggleValue={pushPermissionGranted && remotePushPreferences.messagesEnabled}
                    onClick={() => onToggleRemotePushPreference('messagesEnabled', {
                        enabledToast: 'Message push alerts enabled',
                        disabledToast: 'Message push alerts paused',
                    })}
                    disabled={!remotePushAvailable || pushPreferencesLoading || Boolean(savingPushPreference)}
                />
                <SettingItem
                    icon={Leaf}
                    title="Garden streak rescue"
                    description="Get one nudge before a live streak slips past the 48-hour window"
                    badge={savingPushPreference === 'streakEnabled' ? 'Saving' : (pushPermissionGranted && remotePushPreferences.streakEnabled ? 'On' : 'Off')}
                    toggle={true}
                    toggleValue={pushPermissionGranted && remotePushPreferences.streakEnabled}
                    onClick={() => onToggleRemotePushPreference('streakEnabled', {
                        enabledToast: 'Garden streak rescue enabled',
                        disabledToast: 'Garden streak rescue paused',
                    })}
                    disabled={!remotePushAvailable || pushPreferencesLoading || Boolean(savingPushPreference)}
                />
                <SettingItem
                    icon={RefreshCw}
                    title="Come back nudges"
                    description="Gentle re-engagement reminders after 3, 7, and 14 inactive days"
                    badge={savingPushPreference === 'reengagementEnabled' ? 'Saving' : (pushPermissionGranted && remotePushPreferences.reengagementEnabled ? 'On' : 'Off')}
                    toggle={true}
                    toggleValue={pushPermissionGranted && remotePushPreferences.reengagementEnabled}
                    onClick={() => onToggleRemotePushPreference('reengagementEnabled', {
                        enabledToast: 'Come back nudges enabled',
                        disabledToast: 'Come back nudges paused',
                    })}
                    disabled={!remotePushAvailable || pushPreferencesLoading || Boolean(savingPushPreference)}
                    noBorder={true}
                />
            </SectionCard>
        </div>
    );
}
