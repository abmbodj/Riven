import { Link } from 'react-router-dom';
import Avatar from '../Avatar';
import { isSharedMessageType } from '../../utils/sharedResources';

function formatTime(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function resourceLabel(type) {
    if (type === 'note') return 'Shared a note';
    if (type === 'guide') return 'Shared a guide';
    return 'Shared a deck';
}

export default function ConversationRow({ conv, isActive }) {
    const hasUnread = conv.unreadCount > 0;
    const lastText = isSharedMessageType(conv.lastMessageType)
        ? resourceLabel(conv.lastMessageType)
        : conv.lastMessage;

    return (
        <Link
            to={`/messages/${conv.userId}`}
            className="flex items-center gap-3 px-3 py-3.5 rounded-xl active:scale-[0.98] transition-[transform,background-color]"
            style={
                isActive
                    ? { background: 'oklch(77% 0.12 84 / 0.08)' }
                    : undefined
            }
            aria-current={isActive ? 'page' : undefined}
        >
            {/* Avatar + unread dot */}
            <div className="relative shrink-0">
                <Avatar src={conv.avatar} size="md" />
                {hasUnread && (
                    <span
                        className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: 'oklch(77% 0.12 84)' }}
                        aria-label={`${conv.unreadCount} unread`}
                    >
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                )}
            </div>

            {/* Name + preview */}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span
                        className={`font-display truncate text-sm ${hasUnread || isActive ? 'text-claude-text font-semibold' : 'text-claude-text'}`}
                    >
                        {conv.username}
                    </span>
                    <span className="shrink-0 text-[11px] font-mono text-claude-secondary/60">
                        {formatTime(conv.lastMessageAt)}
                    </span>
                </div>
                <p className={`text-[13px] truncate font-mono ${hasUnread ? 'text-claude-text/80' : 'text-claude-secondary/70'}`}>
                    {conv.isOwnMessage && <span className="text-claude-secondary/50">You: </span>}
                    {lastText}
                </p>
            </div>
        </Link>
    );
}
