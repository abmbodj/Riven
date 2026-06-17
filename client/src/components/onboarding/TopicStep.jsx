import React, { useRef } from 'react';
import { Sparkles } from 'lucide-react';

const EXAMPLE_CHIPS = [
    'AP Bio: cellular respiration',
    'Spanish verb conjugation',
    'Intro Psych — chapter 4',
    'The French Revolution',
    'SAT vocabulary',
];

const inputClass =
    'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-[17px] text-botanical-parchment placeholder:text-claude-secondary/45 outline-none transition-[border-color,background-color,box-shadow] duration-200 focus:border-claude-accent/60 focus:bg-black/30 focus:ring-1 focus:ring-claude-accent/20';

export default function TopicStep({ value, onChange, onSubmit, disabled = false, compactHeight = false }) {
    const inputRef = useRef(null);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && value.trim() && !disabled) {
            e.preventDefault();
            onSubmit?.();
        }
    };

    return (
        <div className={`flex flex-col ${compactHeight ? 'gap-3' : 'gap-4'}`}>
            <input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="on"
                enterKeyHint="go"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                maxLength={200}
                aria-label="What are you studying?"
                placeholder="e.g. AP Bio: cellular respiration"
                className={inputClass}
            />

            <div className="flex flex-wrap gap-2">
                {EXAMPLE_CHIPS.map((chip) => (
                    <button
                        key={chip}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(chip)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] text-claude-secondary transition-colors hover:border-claude-accent/40 hover:text-botanical-parchment disabled:opacity-50"
                    >
                        <Sparkles className="h-3 w-3 text-claude-accent/70" />
                        {chip}
                    </button>
                ))}
            </div>
        </div>
    );
}
