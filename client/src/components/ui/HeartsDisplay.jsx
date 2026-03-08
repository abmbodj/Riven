import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../api';

export default function HeartsDisplay({ onClick }) {
    const [status, setStatus] = useState(null);
    const [timeInSeconds, setTimeInSeconds] = useState(0);

    const fetchHearts = async () => {
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
    };

    useEffect(() => {
        fetchHearts();
        const id = setInterval(fetchHearts, 60000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const handleFocus = () => fetchHearts();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    useEffect(() => {
        if (!status?.nextRefill || status.isUnlimited || status.hearts >= status.max) return;

        const timer = setInterval(() => {
            setTimeInSeconds(prev => {
                if (prev <= 1) {
                    fetchHearts();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [status?.nextRefill, status?.isUnlimited, status?.hearts, status?.max]);

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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-claude-bg/80 backdrop-blur-md border border-red-500/20 rounded-full shadow-sm hover:bg-red-500/5 active:scale-95 transition-[transform,opacity,color,background-color,border-color,box-shadow] tap-action relative z-10"
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
