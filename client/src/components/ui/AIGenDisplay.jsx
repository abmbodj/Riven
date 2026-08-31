import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../api';
import { getDevE2EFixtures } from '../../testing/e2eFixtures.js';

export default function AIGenDisplay({ onClick }) {
    const fixtureStatus = getDevE2EFixtures()?.aiLimits;
    const [status, setStatus] = useState(fixtureStatus || null);

    const fetchLimits = useCallback(async () => {
        try {
            const data = await api.getAILimits();
            setStatus(data);
        } catch (err) {
            console.error("Failed to fetch AI limits", err);
        }
    }, []);

    useEffect(() => {
        if (fixtureStatus) return undefined;
        const initialLoadId = window.setTimeout(() => {
            void fetchLimits();
        }, 0);
        const intervalId = window.setInterval(() => {
            void fetchLimits();
        }, 60000);

        return () => {
            window.clearTimeout(initialLoadId);
            window.clearInterval(intervalId);
        };
    }, [fetchLimits, fixtureStatus]);

    useEffect(() => {
        if (fixtureStatus) return undefined;
        const handleFocus = () => {
            void fetchLimits();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchLimits, fixtureStatus]);

    if (!status) return (
        <div className="w-16 h-8 bg-black/5 rounded-full animate-pulse" />
    );

    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-claude-bg/80 border border-violet-500/20 rounded-full shadow-sm hover:bg-violet-500/5 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action relative z-10"
        >
            <Sparkles className={`w-4 h-4 ${status.isPremium ? 'text-indigo-500 fill-indigo-500' : 'text-violet-500 fill-violet-500'}`} />
            <span className={`font-mono font-bold text-sm ${status.isPremium ? 'text-indigo-500' : 'text-violet-500'}`}>
                {status.remaining}
            </span>
        </button>
    );
}
