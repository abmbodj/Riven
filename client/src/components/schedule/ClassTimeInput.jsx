import React, { useMemo } from 'react';
import { Clock3 } from 'lucide-react';

import {
    CLASS_TIME_HOUR_OPTIONS,
    CLASS_TIME_MINUTE_OPTIONS,
    CLASS_TIME_MERIDIEM_OPTIONS,
    toTwelveHourParts,
    toTwentyFourHourTime,
} from '../../utils/classTime';

export default function ClassTimeInput({ label, value, onChange, idPrefix }) {
    const parts = useMemo(() => toTwelveHourParts(value), [value]);

    const updatePart = (nextKey, nextValue) => {
        onChange(toTwentyFourHourTime({
            ...parts,
            [nextKey]: nextValue,
        }));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary">
                <Clock3 className="w-3.5 h-3.5 opacity-70" />
                <span>{label}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px] gap-2">
                <select
                    id={`${idPrefix}-hour`}
                    value={parts.hour}
                    onChange={(event) => updatePart('hour', event.target.value)}
                    className="glass-panel rounded-xl px-3 py-3 font-mono text-sm text-claude-text focus:border-claude-accent outline-none transition-colors"
                    aria-label={`${label} hour`}
                >
                    {CLASS_TIME_HOUR_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <select
                    id={`${idPrefix}-minute`}
                    value={parts.minute}
                    onChange={(event) => updatePart('minute', event.target.value)}
                    className="glass-panel rounded-xl px-3 py-3 font-mono text-sm text-claude-text focus:border-claude-accent outline-none transition-colors"
                    aria-label={`${label} minute`}
                >
                    {CLASS_TIME_MINUTE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <select
                    id={`${idPrefix}-meridiem`}
                    value={parts.meridiem}
                    onChange={(event) => updatePart('meridiem', event.target.value)}
                    className="glass-panel rounded-xl px-3 py-3 font-mono text-sm text-claude-text focus:border-claude-accent outline-none transition-colors"
                    aria-label={`${label} meridiem`}
                >
                    {CLASS_TIME_MERIDIEM_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
