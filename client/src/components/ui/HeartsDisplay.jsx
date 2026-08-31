import React, { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { api } from '../../api';
import { getDevE2EFixtures } from '../../testing/e2eFixtures.js';

export default function HeartsDisplay({ onClick }) {
    const fixtureStatus = getDevE2EFixtures()?.hearts;
    const [status, setStatus] = useState(fixtureStatus || null);
    const [timeInSeconds, setTimeInSeconds] = useState(0);

    const fetchHearts = useCallback(async () => {
        try {
            const data = await api.getHeartsStatus();
            setStatus(data);
            if (data.nextRefill && !data.isUnlimited) {
                const diff = new Date(data.nextRefill) - new Date();
                setTimeInSeconds(Math.max(0, Math.floor(diff / 1000)));
            }
        } catch (err) {
            console.error("Failed to fetch hearts", err);
        }
    }, []);

    useEffect(() => {
        if (fixtureStatus) return undefined;
        const initialLoadId = window.setTimeout(() => {
            void fetchHearts();
        }, 0);
        const intervalId = window.setInterval(() => {
            void fetchHearts();
        }, 60000);

        return () => {
            window.clearTimeout(initialLoadId);
            window.clearInterval(intervalId);
        };
    }, [fetchHearts, fixtureStatus]);

    useEffect(() => {
        if (fixtureStatus) return undefined;
        const handleFocus = () => {
            void fetchHearts();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchHearts, fixtureStatus]);

    useEffect(() => {
        if (!status?.nextRefill || status.isUnlimited || status.hearts >= status.max) return;

        const timer = setInterval(() => {
            setTimeInSeconds(prev => {
                if (prev <= 1) {
                    void fetchHearts();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [fetchHearts, status?.nextRefill, status?.isUnlimited, status?.hearts, status?.max]);

    if (!status) return (
        <div className="w-16 h-8 bg-black/5 rounded-full animate-pulse" />
    );

    const formatTime = (totalSeconds) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-claude-bg/80 border border-red-500/20 rounded-full shadow-sm hover:bg-red-500/5 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action relative z-10"
        >
            <Heart className={`w-4 h-4 ${status.isUnlimited ? 'text-indigo-500 fill-indigo-500' : 'text-red-500 fill-red-500'}`} />
            <span className={`font-mono font-bold text-sm ${status.isUnlimited ? 'text-indigo-500' : 'text-red-500'}`}>
                {status.isUnlimited ? '∞' : status.hearts}
            </span>
            {!status.isUnlimited && status.hearts < status.max && timeInSeconds > 0 && (
                <span className="text-[10px] font-mono text-claude-secondary ml-1">
                    {formatTime(timeInSeconds)}
                </span>
            )}
        </button>
    );
}
