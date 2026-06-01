import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, MessageSquare, MoreVertical, Edit2, Trash2, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import Avatar from '../Avatar';
import * as authApi from '../../api/authApi';

const RUN_GAP_MS = 5 * 60 * 1000; // 5 minutes

function formatDateDivider(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function buildItems(messages) {
    const items = [];
    let lastDateKey = null;
    let lastSenderId = null;
    let lastSentAt = null;

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const dateKey = new Date(msg.createdAt).toDateString();
        if (dateKey !== lastDateKey) {
            items.push({ type: 'divider', id: `divider-${dateKey}`, label: formatDateDivider(msg.createdAt) });
            lastDateKey = dateKey;
            lastSenderId = null;
            lastSentAt = null;
        }
        const gap = lastSentAt ? (new Date(msg.createdAt) - new Date(lastSentAt)) : Infinity;
        const isFirstInRun = msg.senderId !== lastSenderId || gap > RUN_GAP_MS;
        items.push({ type: 'message', id: msg.id, msg, isFirstInRun });
        lastSenderId = msg.senderId;
        lastSentAt = msg.createdAt;
    }
    return items;
}

export default function GroupChatPanel({ groupId, members, currentUserId }) {
    const toast = useToast();
    const haptics = useHaptics();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [contextMenuId, setContextMenuId] = useState(null);
    const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);

    const scrollParentRef = useRef(null);
    const isNearBottomRef = useRef(true);
    const loadedIdsRef = useRef(new Set());
    const inputRef = useRef(null);
    const editInputRef = useRef(null);
    const unsubRef = useRef(null);

    // Build sender lookup from members prop for realtime hydration
    const memberMap = useMemo(() => {
        const map = new Map();
        (members || []).forEach(m => map.set(Number(m.id), m));
        return map;
    }, [members]);

    const hydrateSender = useCallback((msg) => {
        if (msg.senderUsername) return msg;
        const member = memberMap.get(Number(msg.senderId));
        return {
            ...msg,
            senderUsername: member?.username || null,
            senderAvatar: member?.avatar || null,
        };
    }, [memberMap]);

    // Flat items array for virtualizer (dividers + messages)
    const items = useMemo(() => buildItems(messages), [messages]);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollParentRef.current,
        estimateSize: (i) => items[i]?.type === 'divider' ? 36 : 72,
        overscan: 10,
    });
    const virtualRows = virtualizer.getVirtualItems();

    const checkNearBottom = useCallback(() => {
        const el = scrollParentRef.current;
        if (!el) return;
        isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        if (isNearBottomRef.current) setShowNewMessagesPill(false);
    }, []);

    const scrollToBottom = useCallback((behavior = 'smooth') => {
        if (items.length > 0) {
            virtualizer.scrollToIndex(items.length - 1, { align: 'end', behavior });
        }
        setShowNewMessagesPill(false);
    }, [items.length, virtualizer]);

    // Auto-scroll on new messages
    const prevCountRef = useRef(0);
    useEffect(() => {
        if (items.length > prevCountRef.current) {
            if (isNearBottomRef.current) {
                requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom('auto')));
            } else {
                // Only show pill if there's a new message (not a divider)
                const lastItem = items[items.length - 1];
                if (lastItem?.type === 'message' && !lastItem.msg.isMine) {
                    setShowNewMessagesPill(true);
                }
            }
        }
        prevCountRef.current = items.length;
    }, [items.length, scrollToBottom, items]);

    // Scroll to bottom after initial load
    useEffect(() => {
        if (!loading && messages.length > 0) {
            requestAnimationFrame(() => scrollToBottom('auto'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    // Infinite scroll — load older when scrolled near top
    const loadOlder = useCallback(async () => {
        if (!hasMore || loadingMore || messages.length === 0) return;
        setLoadingMore(true);
        const oldest = messages[0];
        const prevHeight = scrollParentRef.current?.scrollHeight || 0;
        try {
            const older = await authApi.getGroupMessages(groupId, { before: oldest.id });
            if (older.length < 50) setHasMore(false);
            if (older.length > 0) {
                older.forEach(m => loadedIdsRef.current.add(m.id));
                setMessages(prev => [...older.map(hydrateSender), ...prev]);
                requestAnimationFrame(() => {
                    const el = scrollParentRef.current;
                    if (el) el.scrollTop += el.scrollHeight - prevHeight;
                });
            }
        } catch {
            toast.error('Failed to load older messages');
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, messages, groupId, toast, hydrateSender]);

    useEffect(() => {
        const el = scrollParentRef.current;
        if (!el) return;
        const onScroll = () => {
            checkNearBottom();
            if (el.scrollTop < 80 && !loadingMore && hasMore && messages.length > 0) {
                loadOlder();
            }
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [checkNearBottom, loadOlder, loadingMore, hasMore, messages.length]);

    // Initial load
    useEffect(() => {
        if (!groupId) return;
        let cancelled = false;
        setLoading(true);
        setMessages([]);
        setHasMore(true);
        loadedIdsRef.current.clear();

        authApi.getGroupMessages(groupId).then(data => {
            if (cancelled) return;
            if (data.length < 50) setHasMore(false);
            const hydrated = data.map(m => {
                loadedIdsRef.current.add(m.id);
                return hydrateSender(m);
            });
            setMessages(hydrated);
            setLoading(false);
        }).catch(() => {
            if (!cancelled) { toast.error('Failed to load messages'); setLoading(false); }
        });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    // Re-hydrate sender info when members list loads (can arrive after messages)
    useEffect(() => {
        if (memberMap.size === 0) return;
        setMessages(prev => prev.map(hydrateSender));
    }, [memberMap, hydrateSender]);

    // Realtime subscription
    useEffect(() => {
        if (!groupId || !currentUserId) return;
        unsubRef.current?.();
        unsubRef.current = authApi.subscribeToGroupMessages(groupId, currentUserId, {
            onInsert: (msg) => {
                const isNew = !loadedIdsRef.current.has(msg.id);
                loadedIdsRef.current.add(msg.id);
                if (!isNew) return;
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, hydrateSender(msg)];
                });
            },
            onUpdate: (msg) => {
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, isEdited: true } : m));
            },
            onDelete: (id) => {
                setMessages(prev => prev.filter(m => m.id !== id));
            },
        });
        return () => { unsubRef.current?.(); unsubRef.current = null; };
    }, [groupId, currentUserId, hydrateSender]);

    // Auto-grow textarea
    const handleInputChange = (e) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true);
        const optimisticId = `optimistic-${Date.now()}`;
        const optimistic = {
            id: optimisticId,
            groupId,
            senderId: currentUserId,
            senderUsername: memberMap.get(Number(currentUserId))?.username || null,
            senderAvatar: memberMap.get(Number(currentUserId))?.avatar || null,
            content: text,
            isEdited: false,
            createdAt: new Date().toISOString(),
            isMine: true,
        };
        loadedIdsRef.current.add(optimisticId);
        setMessages(prev => [...prev, optimistic]);
        setInput('');
        if (inputRef.current) { inputRef.current.style.height = 'auto'; }
        requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom('auto')));
        haptics?.light?.();
        try {
            const saved = await authApi.sendGroupMessage(groupId, text);
            loadedIdsRef.current.add(saved.id);
            setMessages(prev => prev.map(m => m.id === optimisticId ? hydrateSender(saved) : m));
        } catch {
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    }, [input, sending, groupId, currentUserId, memberMap, scrollToBottom, haptics, hydrateSender, toast]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startEdit = (msg) => {
        setEditingId(msg.id);
        setEditContent(msg.content);
        setContextMenuId(null);
        requestAnimationFrame(() => editInputRef.current?.focus());
    };

    const submitEdit = async (msgId) => {
        const text = editContent.trim();
        if (!text) return;
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text, isEdited: true } : m));
        setEditingId(null);
        try {
            await authApi.editGroupMessage(groupId, msgId, text);
        } catch {
            toast.error('Failed to edit message');
            authApi.getGroupMessages(groupId).then(data => setMessages(data.map(hydrateSender)));
        }
    };

    const handleDelete = async (msgId) => {
        setContextMenuId(null);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        haptics?.light?.();
        try {
            await authApi.deleteGroupMessage(groupId, msgId);
        } catch {
            toast.error('Failed to delete message');
            authApi.getGroupMessages(groupId).then(data => setMessages(data.map(hydrateSender)));
        }
    };

    // Close context menu on outside click
    useEffect(() => {
        if (!contextMenuId) return;
        const close = () => setContextMenuId(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [contextMenuId]);

    // ─── Render ──────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex-1 flex flex-col gap-4 px-4 pt-4 overflow-hidden">
                {[false, true, false].map((mine, i) => (
                    <div key={i} className={`flex items-end gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                        {!mine && <div className="w-7 h-7 rounded-full bg-claude-border/40 animate-pulse shrink-0" />}
                        <div className={`h-10 rounded-2xl bg-claude-border/30 animate-pulse ${mine ? 'w-48 ml-auto' : 'w-56'}`} />
                    </div>
                ))}
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-claude-surface/60 border border-claude-border/40 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-claude-secondary" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm text-claude-secondary">No messages yet</p>
                    <p className="text-xs text-claude-secondary/60">Start the conversation</p>
                </div>
                <ChatInput
                    inputRef={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onSend={handleSend}
                    sending={sending}
                />
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col relative">
            {/* Message list */}
            <div
                ref={scrollParentRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar"
            >
                {loadingMore && (
                    <div className="flex justify-center py-3">
                        <div className="w-4 h-4 rounded-full border-2 border-claude-accent/40 border-t-claude-accent animate-spin" />
                    </div>
                )}

                <div
                    style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
                    className="px-3 pb-2 pt-3"
                >
                    {virtualRows.map((vr) => {
                        const item = items[vr.index];
                        return (
                            <div
                                key={vr.key}
                                data-index={vr.index}
                                ref={virtualizer.measureElement}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${vr.start}px)` }}
                            >
                                {item.type === 'divider' ? (
                                    <DateDivider label={item.label} />
                                ) : (
                                    <MessageRow
                                        key={item.id}
                                        item={item}
                                        isNew={!loadedIdsRef.current.has(item.id) && !item.msg.isMine}
                                        editingId={editingId}
                                        editContent={editContent}
                                        editInputRef={editInputRef}
                                        onEditChange={(v) => setEditContent(v)}
                                        onEditSubmit={submitEdit}
                                        onEditCancel={() => setEditingId(null)}
                                        contextMenuId={contextMenuId}
                                        onContextMenu={(e, id) => { e.stopPropagation(); setContextMenuId(contextMenuId === id ? null : id); }}
                                        onStartEdit={startEdit}
                                        onDelete={handleDelete}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* New messages pill */}
            <AnimatePresence>
                {showNewMessagesPill && (
                    <motion.button
                        initial={{ opacity: 0, y: 8, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.92 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => scrollToBottom('smooth')}
                        className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-claude-surface border border-claude-border/60 shadow-lg text-xs font-medium text-claude-text hover:bg-claude-border/40 transition-colors z-10"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                        New messages
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Input */}
            <ChatInput
                inputRef={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                sending={sending}
            />
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DateDivider({ label }) {
    return (
        <div className="flex items-center gap-3 py-2 px-2">
            <div className="flex-1 h-px bg-claude-border/30" />
            <span className="text-xs text-claude-secondary/60 font-medium shrink-0">{label}</span>
            <div className="flex-1 h-px bg-claude-border/30" />
        </div>
    );
}

function MessageRow({ item, isNew, editingId, editContent, editInputRef, onEditChange, onEditSubmit, onEditCancel, contextMenuId, onContextMenu, onStartEdit, onDelete }) {
    const { msg, isFirstInRun } = item;
    const isMine = msg.isMine;
    const isEditing = editingId === msg.id;
    const showMenu = contextMenuId === msg.id;

    return (
        <motion.div
            initial={isNew ? { opacity: 0, x: isMine ? 12 : -12 } : false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-end gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''} ${isFirstInRun ? 'mt-3' : 'mt-0.5'}`}
        >
            {/* Avatar column (others only) */}
            <div className="w-7 shrink-0 self-end mb-0.5">
                {!isMine && isFirstInRun ? (
                    <Avatar src={msg.senderAvatar} size="xs" />
                ) : null}
            </div>

            {/* Bubble + context menu wrapper */}
            <div className={`relative flex flex-col gap-0.5 max-w-[min(82%,28rem)] ${isMine ? 'items-end' : 'items-start'}`}>
                {/* Sender name — first in run, others only */}
                {!isMine && isFirstInRun && msg.senderUsername && (
                    <span className="text-xs font-semibold text-claude-secondary/80 px-1 mb-0.5">
                        {msg.senderUsername}
                    </span>
                )}

                <div className="relative group">
                    {isEditing ? (
                        <EditBubble
                            value={editContent}
                            inputRef={editInputRef}
                            onChange={onEditChange}
                            onSubmit={() => onEditSubmit(msg.id)}
                            onCancel={onEditCancel}
                        />
                    ) : (
                        <div
                            className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap select-text ${
                                isMine
                                    ? 'rounded-br-[6px]'
                                    : 'rounded-bl-[6px]'
                            }`}
                            style={isMine ? {
                                background: 'oklch(62% 0.08 130 / 0.22)',
                                border: '1px solid oklch(62% 0.08 130 / 0.35)',
                                color: 'oklch(93% 0.03 80)',
                            } : {
                                background: 'oklch(28% 0.025 200 / 0.85)',
                                border: '1px solid oklch(100% 0 0 / 0.08)',
                                color: 'var(--text-color, oklch(88% 0.02 80))',
                                backdropFilter: 'blur(12px)',
                            }}
                        >
                            {msg.content}
                            {msg.isEdited && (
                                <span className="ml-1.5 text-[10px] opacity-50 font-normal not-italic">· edited</span>
                            )}
                        </div>
                    )}

                    {/* 3-dot menu trigger (own messages only) */}
                    {isMine && !isEditing && (
                        <button
                            onClick={(e) => onContextMenu(e, msg.id)}
                            className="absolute -left-7 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-claude-border/40 transition-opacity text-claude-secondary"
                        >
                            <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Context menu */}
                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                                transition={{ duration: 0.1 }}
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute bottom-full mb-1.5 z-20 min-w-[130px] rounded-xl bg-claude-surface border border-claude-border/60 shadow-xl overflow-hidden ${isMine ? 'right-0' : 'left-0'}`}
                            >
                                <button
                                    onClick={() => onStartEdit(msg)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-claude-text hover:bg-claude-border/30 transition-colors"
                                >
                                    <Edit2 className="w-3.5 h-3.5 text-claude-secondary" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => onDelete(msg.id)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Timestamp — only on last message or first in run */}
                {isFirstInRun && (
                    <span className="text-[10px] text-claude-secondary/50 px-1">
                        {formatTime(msg.createdAt)}
                    </span>
                )}
            </div>
        </motion.div>
    );
}

function EditBubble({ value, inputRef, onChange, onSubmit, onCancel }) {
    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
        if (e.key === 'Escape') onCancel();
    };
    return (
        <div className="flex items-end gap-1.5 min-w-[180px] max-w-[28rem]">
            <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => { onChange(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                onKeyDown={handleKey}
                rows={1}
                className="flex-1 resize-none rounded-xl bg-claude-bg border border-claude-accent/40 px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent/70 transition-colors leading-relaxed"
                style={{ minHeight: 38 }}
            />
            <button onClick={onSubmit} className="p-1.5 rounded-lg bg-claude-accent/20 text-claude-accent hover:bg-claude-accent/30 transition-colors">
                <Send className="w-3.5 h-3.5" />
            </button>
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-claude-border/40 text-claude-secondary transition-colors">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

function ChatInput({ inputRef, value, onChange, onKeyDown, onSend, sending }) {
    return (
        <div className="shrink-0 px-3 py-3 border-t border-claude-border/30">
            <div className="flex items-end gap-2 rounded-2xl bg-claude-surface/50 border border-claude-border/50 px-3 py-2 focus-within:border-claude-accent/40 transition-colors">
                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    placeholder="Message the group…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-sm text-claude-text placeholder:text-claude-secondary/50 outline-none leading-relaxed"
                    style={{ minHeight: 24, maxHeight: 120, overflowY: 'auto' }}
                />
                <button
                    onClick={onSend}
                    disabled={!value.trim() || sending}
                    className="shrink-0 p-2 rounded-xl bg-claude-accent/20 text-claude-accent hover:bg-claude-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
