import React from 'react';

const StatusNotice = ({ tone = 'info', title, detail }) => {
    const toneClasses = tone === 'success'
        ? 'border-claude-accent/20 bg-claude-accent/5 text-claude-accent'
        : tone === 'error'
            ? 'border-red-500/20 bg-red-500/5 text-red-400'
            : 'border-blue-400/15 bg-blue-400/5 text-blue-400';

    return (
        <div className={`rounded-2xl border px-4 py-3 ${toneClasses}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold">{title}</p>
            {detail && (
                <p className="mt-1 text-[11px] font-mono text-claude-secondary/80">
                    {detail}
                </p>
            )}
        </div>
    );
};

export default StatusNotice;
