import { useState, useEffect, useCallback } from 'react';
import { dmCache } from '../utils/dmCache';
import * as authApi from '../api/authApi';

/**
 * Manages the conversation list with instant-paint from dmCache + SWR network + realtime.
 *
 * threadHandlerRef: a mutable ref object shared with useThread so the realtime
 * subscription can dispatch INSERT/UPDATE/DELETE events to the active thread
 * without coupling the two hooks directly.
 *
 * Shape: threadHandlerRef.current = { onInsert, onUpdate, onDelete }
 */
export function useConversations(currentUser, threadHandlerRef) {
    const userId = currentUser?.id;

    const [conversations, setConversations] = useState(() => dmCache.getConversations() || []);
    const [loading, setLoading] = useState(true);

    // Seed from cache before anything else
    useEffect(() => {
        if (!userId) return;
        const cached = dmCache.getConversations();
        if (cached) {
            setConversations(cached);
            setLoading(false);
        }
    }, [userId]);

    // Hydrate persistent IndexedDB cache once on mount
    useEffect(() => {
        if (!userId) return;
        dmCache.hydrate(userId).then(() => {
            const idbConvs = dmCache.getConversations();
            if (idbConvs) {
                setConversations(idbConvs);
                setLoading(false);
            }
        });
    }, [userId]);

    const loadConversations = useCallback(async () => {
        if (!currentUser) return;
        try {
            const data = await authApi.getConversations(currentUser);
            dmCache.setConversations(userId, data);
            setConversations(data);
        } catch { /* silent — cached data remains visible */ } finally {
            setLoading(false);
        }
    }, [currentUser, userId]);

    // Realtime — single subscription for all DM events
    useEffect(() => {
        if (!userId) return;

        const handleInsert = (msg) => {
            const otherUserId = msg.isMine ? msg.receiverId : msg.senderId;

            // Forward to active thread handler if registered
            threadHandlerRef?.current?.onInsert?.(msg);

            setConversations((prev) => {
                const existing = prev.find((c) => String(c.userId) === String(otherUserId));
                if (existing) {
                    const updated = prev
                        .map((c) =>
                            String(c.userId) === String(otherUserId)
                                ? {
                                    ...c,
                                    lastMessage: msg.content,
                                    lastMessageType: msg.messageType,
                                    lastMessageAt: msg.createdAt,
                                    isOwnMessage: msg.isMine,
                                    unreadCount:
                                        !msg.isMine && String(otherUserId) !== String(threadHandlerRef?.current?.activePartnerId)
                                            ? c.unreadCount + 1
                                            : c.unreadCount,
                                }
                                : c
                        )
                        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
                    dmCache.setConversations(userId, updated);
                    return updated;
                }

                // New conversation partner — fetch profile async
                authApi.getUserProfile(otherUserId).then((profile) => {
                    setConversations((prev2) => {
                        if (prev2.find((c) => String(c.userId) === String(otherUserId))) return prev2;
                        const newConv = {
                            userId: otherUserId,
                            username: profile?.username ?? 'Unknown',
                            avatar: profile?.avatar ?? null,
                            lastMessage: msg.content,
                            lastMessageType: msg.messageType,
                            lastMessageAt: msg.createdAt,
                            isOwnMessage: msg.isMine,
                            unreadCount: msg.isMine ? 0 : 1,
                        };
                        const result = [newConv, ...prev2].sort(
                            (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
                        );
                        dmCache.setConversations(userId, result);
                        return result;
                    });
                });
                return prev;
            });
        };

        const handleUpdate = (msg) => {
            threadHandlerRef?.current?.onUpdate?.(msg);

            const otherUserId = msg.isMine ? msg.receiverId : msg.senderId;
            setConversations((prev) =>
                prev.map((c) =>
                    String(c.userId) === String(otherUserId) && c.lastMessageAt === msg.createdAt
                        ? {
                            ...c,
                            lastMessage: msg.content,
                            unreadCount: String(otherUserId) === String(threadHandlerRef?.current?.activePartnerId)
                                ? 0
                                : c.unreadCount,
                        }
                        : c
                )
            );
        };

        const handleDelete = (msg) => {
            threadHandlerRef?.current?.onDelete?.(msg);
            // Re-fetch to surface the new last message
            loadConversations();
        };

        const unsubscribe = authApi.subscribeToMessages(userId, {
            onSubscribed: loadConversations,
            onInsert: handleInsert,
            onUpdate: handleUpdate,
            onDelete: handleDelete,
        });

        return unsubscribe;
    }, [userId, loadConversations, threadHandlerRef]);

    // Mark conversations as read when entering a thread
    const markThreadRead = useCallback((partnerId) => {
        authApi.markMessagesRead(partnerId).catch(() => {});
        setConversations((prev) => {
            const updated = prev.map((c) =>
                String(c.userId) === String(partnerId) ? { ...c, unreadCount: 0 } : c
            );
            dmCache.setConversations(userId, updated);
            return updated;
        });
    }, [userId]);

    const invalidate = useCallback(() => {
        dmCache.invalidateConversations();
        loadConversations();
    }, [loadConversations]);

    return { conversations, setConversations, loading, loadConversations, markThreadRead, invalidate };
}
