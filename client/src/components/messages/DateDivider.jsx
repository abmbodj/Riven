export default function DateDivider({ date }) {
    const label = (() => {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const isSameDay = (a, b) =>
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();

        if (isSameDay(d, today)) return 'Today';
        if (isSameDay(d, yesterday)) return 'Yesterday';
        if (today.getFullYear() === d.getFullYear()) {
            return d.toLocaleDateString([], { month: 'long', day: 'numeric' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    })();

    return (
        <div className="flex items-center gap-3 py-4 px-4" aria-label={`Messages from ${label}`}>
            <div className="flex-1 h-px bg-claude-border/40" />
            <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-secondary/60 select-none">
                {label}
            </span>
            <div className="flex-1 h-px bg-claude-border/40" />
        </div>
    );
}
