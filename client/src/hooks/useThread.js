import { useState, useEffect, useCallback, useRef } from 'react';
import { dmCache } from '../utils/dmCache';
import * as authApi from '../api/authApi';

function hydrateWithProfile(messages, profile) {
    return (messages || []).map((m) => {
        if (m.isMine) return m;
        return {
            ...m,
            senderAvatar: m.senderAvatar ?? profile?.avatar ?? null,
            senderUsername: m.senderUsername ?? profile?.username ?? null,
        };
    });
}

/**
 * Manages messages for a single DM thread.
 *
 * threadHandlerRef: shared with useConversations — this hook registers its
 * INSERT/UPDATE/DELETE callbacks so the realtime subscription (owned by
 * useConversations) can dispatch events here.
 */
export function useThread(partnerId, currentUser, conversations, threadHandlerRef) {
    const userId = currentUser?.id;

    const [messages, setMessages] = useState(() =>
        partnerId ? dmCache.getThread(partnerId) : []
    );
    const [chatUser, setChatUser] = useState(() =>
        partnerId ? dmCache.getUser(partnerId) : null
    );
    const [loading, setLoading] = useState(Boolean(partnerId));
    const [sending, setSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Reply state
    const [replyTarget, setReplyTarget] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);

    const loadedIdsRef = useRef(new Set());
    const deletingIdsRef = useRef(new Set());
    const animateSentRef = useRef(new Set());
    const typingPresenceRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const imagePreviewRef = useRef(null);

    const clearImageAttachment = useCallback(() => {
        if (imagePreviewRef.current?.startsWith?.('blob:')) {
            URL.revokeObjectURL(imagePreviewRef.current);
        }
        imagePreviewRef.current = null;
        setImagePreview(null);
        setImageFile(null);
    }, []);

    const setImageAttachment = useCallback((file, previewUrl) => {
        if (imagePreviewRef.current?.startsWith?.('blob:') && imagePreviewRef.current !== previewUrl) {
            URL.revokeObjectURL(imagePreviewRef.current);
        }
        imagePreviewRef.current = previewUrl || null;
        setImagePreview(previewUrl || null);
        setImageFile(file || null);
    }, []);

    // Reset + load on partnerId change
    useEffect(() => {
        if (!partnerId || !userId) {
            setMessages([]);
            setChatUser(null);
            setLoading(false);
            return;
        }

        setHasMore(true);
        setEditingMessageId(null);
        setReplyTarget(null);
        clearImageAttachment();

        const cached = dmCache.getThread(partnerId);
        const cachedUser = dmCache.getUser(partnerId);

        if (cached.length > 0 && cachedUser) {
            setMessages(cached);
            setChatUser(cachedUser);
            loadedIdsRef.current = new Set(cached.map((m) => m.id));
            setLoading(false);
        } else {
            setLoading(true);
        }

        let cancelled = false;

        const conversationFallback = conversations.find(
            (c) => String(c.userId) === String(partnerId)
        );
        const fallbackUser = cachedUser
            || (conversationFallback
                ? { id: conversationFallback.userId, username: conversationFallback.username, avatar: conversationFallback.avatar ?? null }
                : null);

        Promise.allSettled([
            authApi.getMessages(partnerId, 50, undefined, currentUser),
            authApi.getUserProfile(partnerId),
        ]).then(([msgsResult, userResult]) => {
            if (cancelled) return;

            const resolvedUser = userResult.status === 'fulfilled'
                ? userResult.value
                : (fallbackUser || { id: Number(partnerId), username: 'Unknown', avatar: null });

            // Always set chatUser — even if messages failed
            setChatUser(resolvedUser);
            dmCache.setUser(userId, partnerId, resolvedUser);

            if (msgsResult.status === 'fulfilled') {
                const hydrated = hydrateWithProfile(msgsResult.value, resolvedUser);
                loadedIdsRef.current = new Set(hydrated.map((m) => m.id));
                dmCache.setThread(userId, partnerId, hydrated);
                setMessages(hydrated);
            }

            setLoading(false);
        });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partnerId, userId, clearImageAttachment]);

    useEffect(() => {
        if (!partnerId || !userId || !Array.isArray(conversations) || conversations.length === 0) return;

        const conversationFallback = conversations.find(
            (c) => String(c.userId) === String(partnerId)
        );
        if (!conversationFallback) return;

        const fallbackUser = {
            id: conversationFallback.userId,
            username: conversationFallback.username,
            avatar: conversationFallback.avatar ?? null,
        };

        setChatUser((prev) => {
            if (prev?.username && prev.username !== 'Unknown') return prev;
            dmCache.setUser(userId, partnerId, fallbackUser);
            return fallbackUser;
        });

        setMessages((prev) => {
            const hydrated = hydrateWithProfile(prev, fallbackUser);
            if (hydrated === prev) return prev;
            dmCache.setThread(userId, partnerId, hydrated);
            return hydrated;
        });
    }, [partnerId, userId, conversations]);

    // Register realtime handlers with the shared ref
    useEffect(() => {
        if (!threadHandlerRef) return;

        threadHandlerRef.current = {
            activePartnerId: partnerId,

            onInsert(msg) {
                if (!partnerId) return;
                const pid = String(partnerId);
                const isForThisThread =
                    String(msg.senderId) === pid || String(msg.receiverId) === pid;
                if (!isForThisThread) return;

                setMessages((prev) => {
                    if (prev.find((m) => m.id === msg.id)) return prev;
                    const hydrated = msg.isMine ? msg : {
                        ...msg,
                        senderAvatar: msg.senderAvatar ?? dmCache.getUser(pid)?.avatar ?? null,
                        senderUsername: msg.senderUsername ?? dmCache.getUser(pid)?.username ?? null,
                    };
                    const updated = [...prev, hydrated];
                    dmCache.setThread(userId, pid, updated);
                    return updated;
                });

                if (String(msg.senderId) === pid) setIsTyping(false);
            },

            onUpdate(msg) {
                if (!partnerId) return;
                const pid = String(partnerId);
                const isForThisThread =
                    String(msg.senderId) === pid || String(msg.receiverId) === pid;
                if (!isForThisThread) return;

                setMessages((prev) => {
                    const updated = prev.map((m) => m.id === msg.id ? { ...m, ...msg } : m);
                    dmCache.setThread(userId, pid, updated);
                    return updated;
                });
            },

            onDelete(msg) {
                if (!partnerId) return;
                const pid = String(partnerId);
                setMessages((prev) => {
                    const updated = prev.filter((m) => m.id !== msg.id);
                    dmCache.setThread(userId, pid, updated);
                    return updated;
                });
            },
        };
    }, [partnerId, userId, threadHandlerRef]);

    // Typing presence
    useEffect(() => {
        if (!partnerId || !userId) {
            setIsTyping(false);
            return;
        }

        const presence = authApi.subscribeToTypingPresence(userId, partnerId, {
            onTypingChange: setIsTyping,
        });
        typingPresenceRef.current = presence;

        return () => {
            presence.stopTyping?.();
            presence.unsubscribe?.();
            typingPresenceRef.current = null;
        };
    }, [userId, partnerId]);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (imagePreviewRef.current?.startsWith?.('blob:')) {
                URL.revokeObjectURL(imagePreviewRef.current);
            }
        };
    }, []);

    // ── Actions ────────────────────────────────────────────────────────────

    const handleTyping = useCallback(() => {
        if (!partnerId) return;
        typingPresenceRef.current?.startTyping?.();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            typingPresenceRef.current?.stopTyping?.();
        }, 2500);
    }, [partnerId]);

    const stopTyping = useCallback(() => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingPresenceRef.current?.stopTyping?.();
    }, []);

    const sendMessage = useCallback(async ({ content, onScrollToBottom }) => {
        if (!partnerId || sending) return;
        setSending(true);

        stopTyping();

        try {
            const uploadedImage = imageFile
                ? await authApi.uploadMessageImage(partnerId, imageFile, currentUser)
                : null;

            const msg = await authApi.sendMessage(
                partnerId,
                content?.trim() || '',
                'text',
                null,
                null,
                currentUser,
                replyTarget?.id || null,
                uploadedImage?.path || null
            );

            loadedIdsRef.current.add(msg.id);
            setMessages((prev) => {
                const updated = [...prev, msg];
                dmCache.setThread(userId, partnerId, updated);
                return updated;
            });
            setReplyTarget(null);
            clearImageAttachment();

            // Scroll + animate sent bubble
            onScrollToBottom?.();
            requestAnimationFrame(() => {
                animateSentRef.current.add(msg.id);
                setMessages((prev) => [...prev]);
                setTimeout(() => animateSentRef.current.delete(msg.id), 250);
            });
        } finally {
            setSending(false);
        }
    }, [partnerId, sending, stopTyping, imageFile, currentUser, replyTarget, userId, clearImageAttachment]);

    const editMessage = useCallback(async (id, content) => {
        setSending(true);
        try {
            const updated = await authApi.editMessage(id, content, currentUser);
            setMessages((prev) => {
                const next = prev.map((m) => m.id === id ? updated : m);
                dmCache.setThread(userId, partnerId, next);
                return next;
            });
            setEditingMessageId(null);
        } finally {
            setSending(false);
        }
    }, [currentUser, userId, partnerId]);

    const deleteMessage = useCallback(async (id) => {
        await authApi.deleteMessage(id);
        deletingIdsRef.current.add(id);
        setMessages((prev) => [...prev]); // trigger animate-msg-out

        setTimeout(() => {
            deletingIdsRef.current.delete(id);
            setMessages((prev) => {
                const updated = prev.filter((m) => m.id !== id);
                dmCache.setThread(userId, partnerId, updated);
                return updated;
            });
        }, 200);
    }, [userId, partnerId]);

    const markSharedResourceAccepted = useCallback((messageId, acceptedId) => {
        if (!messageId || acceptedId === null || acceptedId === undefined) return;

        setMessages((prev) => {
            const updated = prev.map((m) => {
                if (m.id !== messageId || !m.sharedResource) return m;

                const sharedResource = {
                    ...m.sharedResource,
                    acceptedId,
                };

                return {
                    ...m,
                    sharedResource,
                    deckData: m.deckData ? { ...m.deckData, acceptedId } : m.deckData,
                };
            });
            dmCache.setThread(userId, partnerId, updated);
            return updated;
        });
    }, [userId, partnerId]);

    const loadOlderMessages = useCallback(async () => {
        if (!hasMore || loadingMore || messages.length === 0 || !partnerId) return;
        setLoadingMore(true);
        const oldest = messages[0];
        try {
            const older = await authApi.getMessages(partnerId, 50, oldest.createdAt, currentUser);
            if (older.length < 50) setHasMore(false);
            if (older.length > 0) {
                older.forEach((m) => loadedIdsRef.current.add(m.id));
                setMessages((prev) => {
                    const combined = [...older, ...prev];
                    dmCache.setThread(userId, partnerId, combined);
                    return combined;
                });
            }
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, messages, partnerId, currentUser, userId]);

    const startEditing = useCallback((msg) => {
        setEditingMessageId(msg.id);
        setReplyTarget(null);
    }, []);

    const cancelEditing = useCallback(() => {
        setEditingMessageId(null);
    }, []);

    const startReply = useCallback((msg) => {
        setReplyTarget(msg);
        setEditingMessageId(null);
    }, []);

    const cancelReply = useCallback(() => {
        setReplyTarget(null);
    }, []);

    return {
        messages,
        chatUser,
        loading,
        sending,
        isTyping,
        hasMore,
        loadingMore,
        replyTarget,
        editingMessageId,
        imagePreview,
        imageFile,
        setImageAttachment,
        clearImageAttachment,
        loadedIdsRef,
        deletingIdsRef,
        animateSentRef,
        handleTyping,
        stopTyping,
        sendMessage,
        editMessage,
        deleteMessage,
        markSharedResourceAccepted,
        loadOlderMessages,
        startEditing,
        cancelEditing,
        startReply,
        cancelReply,
    };
}
