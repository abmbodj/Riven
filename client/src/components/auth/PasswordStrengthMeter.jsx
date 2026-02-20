import React, { useEffect, useMemo, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';

const PasswordStrengthMeter = ({ password }) => {
    const [zxcvbnFn, setZxcvbnFn] = useState(null);

    useEffect(() => {
        if (!password || zxcvbnFn) return;
        let cancelled = false;

        import('zxcvbn')
            .then((mod) => {
                const fn = mod?.default || mod;
                if (!cancelled) setZxcvbnFn(() => fn);
            })
            .catch(() => {
                if (!cancelled) setZxcvbnFn(() => null);
            });

        return () => {
            cancelled = true;
        };
    }, [password, zxcvbnFn]);

    const result = useMemo(() => {
        if (!zxcvbnFn) return { score: 0, feedback: {} };
        return zxcvbnFn(password || '');
    }, [password, zxcvbnFn]);

    const score = result.score; // 0-4

    const getColor = () => {
        switch (score) {
            case 0: return '#ef4444'; // red
            case 1: return '#ef4444'; // red
            case 2: return '#f59e0b'; // orange
            case 3: return '#7a9e72'; // botanical forest
            case 4: return '#deb96a'; // accent gold
            default: return '#e4e4e7';
        }
    };

    const getLabel = () => {
        switch (score) {
            case 0: return 'Weak';
            case 1: return 'Weak';
            case 2: return 'Fair';
            case 3: return 'Good';
            case 4: return 'Strong';
            default: return '';
        }
    };

    const width = Math.min(100, Math.max(5, (score + 1) * 20));

    return (
        <div className="mt-2">
            <div className="h-1 w-full bg-claude-border rounded-full overflow-hidden">
                <motion.div
                    className="h-full rounded-full transition-colors duration-300"
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%`, backgroundColor: getColor() }}
                />
            </div>
            {password && (
                <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-claude-secondary font-mono">
                        {getLabel()}
                    </span>
                    {!!result.feedback?.warning && (
                        <span className="text-[10px] text-red-400">
                            {result.feedback.warning}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default PasswordStrengthMeter;
