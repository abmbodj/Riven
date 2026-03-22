import React from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

import Avatar from './Avatar';
import ModalSurface from './ui/ModalSurface';

export default function ShareToFriendModal({
    isOpen,
    onClose,
    friends = [],
    loading = false,
    sendingTo = null,
    onSend,
    resourceLabel = 'Item',
    resourceTitle = 'Untitled',
}) {
    return (
        <ModalSurface
            isOpen={isOpen}
            onClose={onClose}
            title={`Share ${resourceLabel}`}
            eyebrow="Direct share"
            description={`Select a friend to send "${resourceTitle}" to directly.`}
            size="sm"
            scrollClassName="space-y-3"
        >
            {loading ? (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-[1.5rem] border border-claude-border/70 bg-claude-bg/45 px-6 py-10 text-center text-claude-secondary">
                    <Loader2 className="mb-3 h-5 w-5 animate-spin text-claude-accent" />
                    <p className="font-mono text-sm uppercase tracking-[0.14em]">Loading friends...</p>
                </div>
            ) : friends.length === 0 ? (
                <div className="rounded-[1.5rem] border border-claude-border/70 bg-claude-bg/45 px-6 py-10 text-center">
                    <p className="font-mono text-sm uppercase tracking-[0.14em] text-claude-secondary">
                        You have no friends yet.
                    </p>
                    <Link
                        to="/friends"
                        className="mt-4 inline-flex rounded-full border border-claude-accent/25 bg-claude-accent/10 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/40"
                    >
                        Find Friends
                    </Link>
                </div>
            ) : (
                friends.map((friend) => {
                    const isSending = sendingTo === friend.id;

                    return (
                        <div
                            key={friend.id}
                            className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-claude-border/70 bg-claude-bg/45 px-4 py-3.5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <Avatar
                                    src={friend.avatar || null}
                                    size="sm"
                                    className="border border-white/10 bg-claude-bg/70"
                                />
                                <div className="min-w-0">
                                    <p className="truncate font-display text-lg font-semibold text-claude-text">
                                        {friend.username}
                                    </p>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                        Ready to receive
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onSend?.(friend.id)}
                                disabled={isSending}
                                className="tap-action inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[1.05rem] bg-claude-text px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-claude-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                                {isSending ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    );
                })
            )}
        </ModalSurface>
    );
}
