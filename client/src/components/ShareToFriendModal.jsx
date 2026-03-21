import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import Avatar from './Avatar';

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
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-claude-bg/60 md:backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative glass-panel paper-texture text-claude-text w-full sm:max-w-md max-h-[85dvh] overflow-hidden flex flex-col rounded-t-[2.5rem] sm:rounded-3xl shadow-md md:shadow-2xl touch-pan-y"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="p-6 pb-2 shrink-0">
                            <div className="sm:hidden w-12 h-1.5 bg-claude-accent/30 rounded-full mx-auto -mt-2 mb-4" />
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-2xl font-display font-bold">Share {resourceLabel}</h3>
                                <button onClick={onClose} className="p-2 -mr-2 active:bg-claude-accent/10 rounded-full" aria-label="Close share modal">
                                    <X className="w-6 h-6 text-claude-text/60" />
                                </button>
                            </div>
                            <p className="text-claude-secondary font-mono text-sm leading-relaxed mb-4">
                                Select a friend to send "{resourceTitle}" to directly.
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-8 text-claude-secondary">
                                    <Loader2 className="w-5 h-5 animate-spin mb-3" />
                                    <p className="font-mono text-sm">Loading friends...</p>
                                </div>
                            ) : friends.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-claude-secondary font-mono text-sm">You have no friends yet.</p>
                                    <Link to="/friends" className="text-claude-accent hover:underline font-mono text-xs mt-2 inline-block">
                                        Find Friends
                                    </Link>
                                </div>
                            ) : (
                                friends.map((friend) => (
                                    <div key={friend.id} className="flex items-center justify-between gap-3 p-3 bg-claude-accent/5 rounded-xl border border-claude-accent/10">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar src={friend.avatar || null} size="sm" />
                                            <span className="font-display font-semibold truncate">{friend.username}</span>
                                        </div>
                                        <button
                                            onClick={() => onSend?.(friend.id)}
                                            disabled={sendingTo === friend.id}
                                            className="px-4 py-2 bg-claude-accent text-white rounded-lg font-mono text-xs font-medium disabled:opacity-50 shrink-0"
                                        >
                                            {sendingTo === friend.id ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
