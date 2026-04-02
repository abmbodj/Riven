import React from 'react';

const SectionHeader = ({ eyebrow, title, description, tone = 'default' }) => {
    const eyebrowTone = tone === 'accent'
        ? 'text-claude-accent'
        : tone === 'info'
            ? 'text-blue-400'
            : tone === 'success'
                ? 'text-claude-accent'
                : tone === 'warning'
                    ? 'text-amber-500'
                    : tone === 'danger'
                        ? 'text-red-400'
                        : tone === 'pink'
                            ? 'text-pink-400'
                            : 'text-claude-secondary';

    return (
        <div className="mb-3 px-0.5 sm:mb-4 sm:px-1 xl:mb-3 xl:px-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
                <p className={`text-[9px] font-mono uppercase tracking-[0.22em] sm:text-[10px] sm:tracking-[0.24em] ${eyebrowTone}`}>
                    {eyebrow}
                </p>
                <div className="h-px flex-1 bg-claude-border/60" />
            </div>
            <div className="mt-2.5 sm:mt-3 xl:mt-2">
                <h2 className="font-serif text-[1.55rem] font-semibold italic leading-none tracking-[-0.03em] text-claude-text sm:text-[1.9rem]">
                    {title}
                </h2>
                {description && (
                    <p className="mt-2 max-w-xl text-[10px] font-mono uppercase leading-relaxed tracking-[0.11em] text-claude-secondary/78 sm:max-w-2xl sm:text-[11px] sm:tracking-[0.12em] xl:mt-1.5 xl:max-w-[28rem]">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
};

export default SectionHeader;
