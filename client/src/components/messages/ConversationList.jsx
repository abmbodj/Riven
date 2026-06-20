import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConversationRow from './ConversationRow';
import { NoConversationsState } from './MessagesEmptyState';
import { BannedState } from './MessagesEmptyState';

export default function ConversationList({
    conversations,
    isBanned,
    query,
    setQuery,
    showUnreadOnly,
    setShowUnreadOnly,
    activeUserId,
}) {
    const unreadCount = useMemo(
        () => conversations.filter((c) => c.unreadCount > 0).length,
        [conversations]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return conversations.filter((c) => {
            if (showUnreadOnly && c.unreadCount <= 0 && String(c.userId) !== String(activeUserId)) {
                return false;
            }
            if (!q) return true;
            const hay = [c.username, c.lastMessage].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [conversations, query, showUnreadOnly, activeUserId]);

    if (isBanned) return <BannedState />;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-5 px-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-claude-secondary mb-2">
                    Social
                </p>
                <h2 className="text-2xl font-display font-bold text-claude-text leading-tight mb-1">
                    Conversations
                </h2>
                <p className="text-[13px] font-mono text-claude-secondary/80">
                    Keep your study circle in view
                </p>
            </div>

            {/* Controls */}
            {conversations.length > 0 && (
                <div className="mb-3 space-y-3 flex-shrink-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-secondary/60">
                            {filtered.length} shown · {unreadCount} unread
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowUnreadOnly((v) => !v)}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors ${showUnreadOnly
                                ? 'text-claude-accent'
                                : 'text-claude-secondary hover:text-claude-text'
                            }`}
                            style={showUnreadOnly
                                ? { background: 'oklch(77% 0.12 84 / 0.1)', border: '1px solid oklch(77% 0.12 84 / 0.25)' }
                                : { border: '1px solid oklch(33% 0.04 211)' }
                            }
                        >
                            {showUnreadOnly ? 'Unread only' : 'Show unread'}
                        </button>
                    </div>

                    {/* Search */}
                    <label
                        className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
                        style={{ background: 'oklch(27% 0.04 211)', border: '1px solid oklch(33% 0.04 211)' }}
                    >
                        <Search className="h-4 w-4 text-claude-secondary/60 shrink-0" aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search people or messages"
                            className="w-full bg-transparent text-sm text-claude-text placeholder:text-claude-secondary/50 focus:outline-none font-mono"
                            aria-label="Search conversations"
                        />
                    </label>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto -mx-1">
                {conversations.length === 0 ? (
                    <NoConversationsState />
                ) : filtered.length === 0 ? (
                    <div className="py-10 text-center px-4">
                        <Search className="mx-auto mb-3 h-5 w-5 text-claude-secondary/40" aria-hidden="true" />
                        <p className="font-display text-claude-text text-sm">No conversations match</p>
                        <p className="mt-1 text-[11px] font-mono text-claude-secondary/60">
                            Clear the search or widen the filter.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-0.5 px-1">
                        <AnimatePresence mode="popLayout">
                            {filtered.map((conv) => (
                                <motion.div
                                    key={conv.userId}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 8 }}
                                    transition={{ duration: 0.18, ease: [0.25, 0, 0.1, 1] }}
                                >
                                    {/* Hairline divider */}
                                    <div
                                        className="h-px mx-3"
                                        style={{ background: 'oklch(33% 0.04 211 / 0.5)' }}
                                        aria-hidden="true"
                                    />
                                    <ConversationRow
                                        conv={conv}
                                        isActive={String(conv.userId) === String(activeUserId)}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
