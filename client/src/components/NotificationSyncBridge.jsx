import { useNotificationSync } from '../hooks/useNotificationSync.js';

export default function NotificationSyncBridge() {
    useNotificationSync();
    return null;
}
