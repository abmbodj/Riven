import React from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner({ isOffline }) {
    if (!isOffline) return null;

    return (
        <div role="alert" aria-live="polite" className="bg-orange-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            <span>You're offline</span>
        </div>
    );
}
