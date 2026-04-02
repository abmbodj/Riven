import React from 'react';
import { SURFACE_TEXTURE } from './settingsConstants';

const SectionCard = ({ children, tone = 'default', className = '' }) => {
    const toneClasses = tone === 'accent'
        ? 'border-claude-accent/20 bg-claude-surface/95'
        : tone === 'info'
            ? 'border-blue-400/20 bg-claude-surface/95'
            : tone === 'warning'
                ? 'border-amber-500/20 bg-claude-surface/95'
                : tone === 'danger'
                    ? 'border-red-500/15 bg-red-500/[0.03]'
                    : tone === 'pink'
                        ? 'border-pink-500/20 bg-claude-surface/95'
                        : 'border-claude-border/70 bg-claude-surface/95';

    return (
        <div className={`relative isolate overflow-hidden rounded-[1.5rem] border shadow-[0_18px_42px_rgba(0,0,0,0.16)] backdrop-blur sm:rounded-[1.9rem] ${toneClasses} ${className}`}>
            <div className="pointer-events-none absolute inset-0 opacity-[0.09]" style={SURFACE_TEXTURE} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};

export default SectionCard;
