import React from 'react';
import zxcvbn from 'zxcvbn';
import { motion } from 'motion/react';

const PasswordStrengthMeter = ({ password }) => {
    const result = zxcvbn(password || '');
    const score = result.score; // 0-4

    const getColor = () => {
        switch (score) {
            case 0: return '#ef4444'; // red
            case 1: return '#ef4444'; // red
            case 2: return '#f59e0b'; // orange
            case 3: return '#84cc16'; // lime
            case 4: return '#22c55e'; // green
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
                    {result.feedback.warning && (
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
