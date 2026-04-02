import React from 'react';
import { ChevronRight } from 'lucide-react';

const SettingItem = ({ icon: IconComponent, title, description, onClick, destructive = false, toggle = null, toggleValue = false, noBorder = false, badge = null, disabled = false }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        aria-pressed={toggle !== null ? toggleValue : undefined}
        className={`tap-action group relative flex min-h-[72px] w-full items-center gap-3 overflow-hidden px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[76px] sm:gap-4 sm:px-5 xl:min-h-[68px] xl:px-4 xl:py-3.5 ${destructive ? 'hover:bg-red-500/[0.04] active:bg-red-500/[0.06]' : 'hover:bg-claude-bg/35 active:bg-claude-bg/45'}`}
    >
        {!noBorder && (
            <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-claude-border/60 sm:inset-x-5" />
        )}
        <div className={`relative z-10 rounded-[1.1rem] border p-2.5 shadow-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 group-hover:-translate-y-0.5 ${destructive ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-claude-border/70 bg-claude-bg/75 text-claude-text/70'}`}>
            {IconComponent && <IconComponent className="w-5 h-5" />}
        </div>
        <div className="relative z-10 min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={`font-display text-[15px] font-medium tracking-[0.01em] sm:text-[16px] ${destructive ? 'text-red-400' : 'text-claude-text transition-colors group-hover:text-claude-accent'}`}>{title}</p>
                    {description && <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.14em] text-claude-secondary/85 sm:text-[10px]">{description}</p>}
                </div>
                {badge && (
                    <span className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.18em] ${destructive ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-claude-border/70 bg-claude-bg/70 text-claude-secondary'}`}>
                        {badge}
                    </span>
                )}
            </div>
        </div>

        {toggle !== null ? (
            <span className="switch-track shrink-0" data-checked={toggleValue ? 'true' : 'false'}>
                <span className="switch-thumb" />
            </span>
        ) : (
            <ChevronRight className={`relative z-10 w-5 h-5 shrink-0 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 ${destructive ? 'text-red-500/55 group-hover:text-red-400' : 'text-claude-secondary/40 group-hover:translate-x-1 group-hover:text-claude-accent'}`} />
        )}
    </button>
);

export default SettingItem;
