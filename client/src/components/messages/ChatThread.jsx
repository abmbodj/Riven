import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Leaf } from 'lucide-react';
import { isSharedMessageType } from '../../utils/sharedResources';
import MessageBubble from './MessageBubble';
import DateDivider from './DateDivider';
import { EmptyThreadState } from './MessagesEmptyState';
import Avatar from '../Avatar';

function isSameDay(a, b) {
    const da = new Date(a);
    const db = new Date(b);
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
    );
}

// Build a flat list of virtual items — either date-dividers or message indices.
// Also computes grouping metadata (isFirst/isLast within same-sender runs).
function buildVirtualItems(messages) {
    const items = [];
    const GROUP_GAP_MS = 5 * 60 * 1000; // 5 min gap breaks grouping

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const prev = messages[i - 1];

        // Insert date divider when day changes
        if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
            items.push({ type: 'divider', date: msg.createdAt });
        }

        const nextMsg = messages[i + 1];

        // Grouping: same sender + within GROUP_GAP_MS = grouped run
        const sameSenderAsPrev =
            prev &&
            prev.isMine === msg.isMine &&
            !isSameDay(prev.createdAt, msg.createdAt) === false &&
            new Date(msg.createdAt) - new Date(prev.createdAt) < GROUP_GAP_MS;

        const sameSenderAsNext =
            nextMsg &&
            nextMsg.isMine === msg.isMine &&
            new Date(nextMsg.createdAt) - new Date(msg.createdAt) < GROUP_GAP_MS;

        // If message has a reply target, always treat as first (breaks run visually)
        const hasReply = Boolean(msg.replyTo);

        const isFirst = !sameSenderAsPrev || hasReply;
        const isLast = !sameSenderAsNext;

        items.push({ type: 'message', index: i, isFirst, isLast });
    }

    return items;
}

export default function ChatThread({
    messages,
    chatUser,
    loading,
    loadingMore,
    isTyping,
    hasMore,
    loadedIdsRef,
    deletingIdsRef,
    animateSentRef,
    activeMenuId,
    setActiveMenuId,
    isAcceptingSharedResource,
    onAcceptSharedResource,
    onStartEdit,
    onDelete,
    onStartReply,
    onReport,
    onViewFile,
    onLoadOlderMessages,
    composerHeight,
}) {
    const scrollParentRef = useRef(null);
    const isNearBottomRef = useRef(true);
    const [showNewPill, setShowNewPill] = useState(false);
    const prevMsgCountRef = useRef(messages.length);

    const items = useMemo(() => buildVirtualItems(messages), [messages]);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollParentRef.current,
        estimateSize: (i) => items[i]?.type === 'divider' ? 52 : 72,
        overscan: 12,
        initialRect: { width: 0, height: 720 },
    });

    const checkNearBottom = useCallback(() => {
        const el = scrollParentRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        isNearBottomRef.current = nearBottom;
        if (nearBottom) setShowNewPill(false);
    }, []);

    const scrollToBottom = useCallback((behavior = 'auto') => {
        if (items.length > 0) {
            virtualizer.scrollToIndex(items.length - 1, { align: 'end', behavior });
        }
        setShowNewPill(false);
    }, [items.length, virtualizer]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (messages.length > prevMsgCountRef.current) {
            if (isNearBottomRef.current) {
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => scrollToBottom('auto'))
                );
            } else {
                setShowNewPill(true);
            }
        }
        prevMsgCountRef.current = messages.length;
    }, [messages.length, scrollToBottom]);

    // Scroll to bottom on initial load
    useEffect(() => {
        if (!loading && messages.length > 0) {
            requestAnimationFrame(() => scrollToBottom('auto'));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    // Scroll to bottom when typing indicator appears
    useEffect(() => {
        if (isTyping && isNearBottomRef.current) {
            requestAnimationFrame(() => scrollToBottom('smooth'));
        }
    }, [isTyping, scrollToBottom]);

    // Infinite scroll trigger
    useEffect(() => {
        const el = scrollParentRef.current;
        if (!el) return;
        const handleScroll = () => {
            checkNearBottom();
            if (el.scrollTop < 100 && hasMore) {
                onLoadOlderMessages();
            }
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [checkNearBottom, onLoadOlderMessages, hasMore]);

    // Dismiss menu on outside click
    useEffect(() => {
        if (!activeMenuId) return;
        const handler = (e) => {
            if (!e.target.closest('[data-msg-menu]')) setActiveMenuId(null);
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, [activeMenuId, setActiveMenuId]);

    const scrollToMessage = useCallback((id) => {
        const msgIdx = messages.findIndex((m) => m.id === id);
        if (msgIdx === -1) return;
        // Find the virtual item index for this message index
        const itemIdx = items.findIndex((it) => it.type === 'message' && it.index === msgIdx);
        if (itemIdx === -1) return;
        virtualizer.scrollToIndex(itemIdx, { align: 'center', behavior: 'smooth' });
    }, [messages, items, virtualizer]);

    // Find the last sent (mine + not shared) message for read receipt
    const lastSentMessageId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.isMine && !isSharedMessageType(m.messageType)) return m.id;
        }
        return null;
    }, [messages]);

    const paddingBottom = Math.max(composerHeight + 12, 120);

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="relative w-10 h-10">
                    <div className="absolute inset-0 border-2 border-claude-accent/20 border-t-claude-accent rounded-full animate-spin" />
                    <Leaf className="absolute inset-0 m-auto w-4 h-4 text-claude-accent/60" />
                </div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <EmptyThreadState username={chatUser?.username} />
            </div>
        );
    }

    const virtualItems = virtualizer.getVirtualItems();
    const totalSize = virtualizer.getTotalSize();

    return (
        <div className="relative flex-1 overflow-hidden">
            <div
                ref={scrollParentRef}
                className="h-full overflow-y-auto scroll-container"
                style={{ paddingBottom }}
                data-testid="messages-scroll-container"
            >
                <div style={{ height: totalSize + (isTyping ? 54 : 0), position: 'relative' }} className="px-2 pt-2 sm:px-3">
                    {/* Loading older indicator */}
                    {loadingMore && (
                        <div className="absolute top-2 left-0 right-0 flex justify-center z-10 py-2">
                            <div className="w-6 h-6 border-2 border-claude-accent/20 border-t-claude-accent rounded-full animate-spin" />
                        </div>
                    )}

                    {virtualItems.map((vRow) => {
                        const item = items[vRow.index];

                        return (
                            <div
                                key={vRow.index}
                                ref={virtualizer.measureElement}
                                data-index={vRow.index}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${vRow.start}px)`,
                                    zIndex: item.type === 'message' && activeMenuId === messages[item.index]?.id ? 20 : 'auto',
                                }}
                            >
                                {item.type === 'divider' ? (
                                    <DateDivider date={item.date} />
                                ) : (
                                    (() => {
                                        const msg = messages[item.index];
                                        const isNew = !loadedIdsRef.current.has(msg.id);
                                        const isAnimatingIn = isNew || animateSentRef.current.has(msg.id);
                                        const isDeleting = deletingIdsRef.current.has(msg.id);
                                        const showAvatar = item.isFirst && !msg.isMine;

                                        return (
                                            <MessageBubble
                                                message={msg}
                                                isFirst={item.isFirst}
                                                isLast={item.isLast}
                                                showAvatar={showAvatar}
                                                chatUser={chatUser}
                                                isAnimatingIn={isAnimatingIn}
                                                isDeleting={isDeleting}
                                                activeMenuId={activeMenuId}
                                                setActiveMenuId={setActiveMenuId}
                                                isLastSentMessage={msg.id === lastSentMessageId}
                                                isAcceptingSharedResource={isAcceptingSharedResource}
                                                onAcceptSharedResource={onAcceptSharedResource}
                                                onStartEdit={onStartEdit}
                                                onDelete={onDelete}
                                                onStartReply={onStartReply}
                                                onReport={onReport}
                                                onViewFile={onViewFile}
                                                scrollToMessage={scrollToMessage}
                                            />
                                        );
                                    })()
                                )}
                            </div>
                        );
                    })}

                    {/* Typing indicator */}
                    <AnimatePresence>
                        {isTyping && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${totalSize}px)`,
                                }}
                                className="px-2 pb-4 sm:px-3"
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    transition={{ duration: 0.18, ease: [0.25, 0, 0.1, 1] }}
                                    className="flex justify-start pl-0"
                                >
                                    <div className="flex items-end gap-2">
                                        <div className="w-7 shrink-0 mb-0.5">
                                            <Avatar src={chatUser?.avatar} size="xs" />
                                        </div>
                                        <div
                                            className="rounded-2xl rounded-bl-sm px-3.5 py-3 flex gap-1.5 items-center"
                                            style={{ background: 'oklch(27% 0.04 211)', border: '1px solid oklch(33% 0.04 211)' }}
                                        >
                                            {[0, 0.2, 0.4].map((delay) => (
                                                <motion.div
                                                    key={delay}
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ background: 'oklch(60% 0.04 211)' }}
                                                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                                                    transition={{ duration: 0.9, repeat: Infinity, delay, ease: 'easeInOut' }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* New messages pill */}
            <AnimatePresence>
                {showNewPill && (
                    <motion.button
                        initial={{ opacity: 0, y: 8, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.92 }}
                        transition={{ duration: 0.18, ease: [0.25, 0, 0.1, 1] }}
                        onClick={() => scrollToBottom('smooth')}
                        className="absolute left-1/2 z-30 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-mono text-white shadow-lg active:scale-95 transition-transform"
                        style={{
                            bottom: `${paddingBottom + 16}px`,
                            background: 'oklch(51% 0.10 143)',
                        }}
                    >
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        New messages
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
