/**
 * Overlapping avatars + count for a session's attendees. Lifted out of the old
 * GroupScheduleHub so it can be reused by the Upcoming sessions list.
 */
export default function AvatarStack({ attendees = [], count = 0, dense = false }) {
    const displayCount = count || attendees.length;

    if (!displayCount) {
        return (
            <div className={`inline-flex items-center rounded-full border border-white/10 bg-white/5 font-mono font-semibold uppercase tracking-[0.14em] text-claude-secondary ${dense ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-1 text-[10px]'}`}>
                Nobody yet
            </div>
        );
    }

    return (
        <div className={`flex items-center ${dense ? 'gap-1.5' : 'gap-2'}`}>
            <div className="flex -space-x-2">
                {attendees.slice(0, 4).map((attendee) => (
                    <img
                        key={attendee.id}
                        src={attendee.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${attendee.username || attendee.id}`}
                        alt=""
                        loading="lazy"
                        className={`rounded-full border border-[rgba(24,42,49,0.92)] bg-white/90 p-0.5 ${dense ? 'h-6 w-6' : 'h-7 w-7'}`}
                    />
                ))}
            </div>
            <span className={`font-medium text-claude-secondary ${dense ? 'text-[10px]' : 'text-[11px]'}`}>
                {displayCount}
            </span>
        </div>
    );
}
