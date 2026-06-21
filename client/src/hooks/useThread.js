import { useState, useEffect, useCallback, useRef } from 'react';
import { dmCache } from '../utils/dmCache';
import { buildOptimisticMessage, createClientMessageId, reduceDmMessages } from '../utils/dmMessageEngine';
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
    const pendingSendPayloadsRef = useRef(new Map());

    const applyMessageAction = useCallback((action, targetPartnerId = partnerId) => {
        setMessages((prev) => {
            const updated = reduceDmMessages(prev, action);
            if (userId && targetPartnerId) {
                dmCache.setThread(userId, targetPartnerId, updated);
            }
            return updated;
        });
    }, [partnerId, userId]);

    const clearImageAttachment = useCallback((options = {}) => {
        const shouldRevoke = options.revoke !== false;
        if (shouldRevoke && imagePreviewRef.current?.startsWith?.('blob:')) {
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
            const hydratedCache = reduceDmMessages([], { type: 'hydrate', messages: cached });
            setMessages(hydratedCache);
            setChatUser(cachedUser);
            loadedIdsRef.current = new Set(hydratedCache.map((m) => m.id).filter(Boolean));
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
                const reduced = reduceDmMessages([], { type: 'hydrate', messages: hydrated });
                loadedIdsRef.current = new Set(reduced.map((m) => m.id).filter(Boolean));
                dmCache.setThread(userId, partnerId, reduced);
                setMessages(reduced);
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
            const reduced = reduceDmMessages([], { type: 'hydrate', messages: hydrated });
            dmCache.setThread(userId, partnerId, reduced);
            return reduced;
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

                const hydrated = msg.isMine ? msg : {
                    ...msg,
                    senderAvatar: msg.senderAvatar ?? dmCache.getUser(pid)?.avatar ?? null,
                    senderUsername: msg.senderUsername ?? dmCache.getUser(pid)?.username ?? null,
                };
                if (hydrated.id) loadedIdsRef.current.add(hydrated.id);
                applyMessageAction({ type: 'realtime_insert', message: hydrated }, pid);

                if (String(msg.senderId) === pid) {
                    setIsTyping(false);
                    authApi.markMessagesRead(pid).catch(() => {});
                }
            },

            onUpdate(msg) {
                if (!partnerId) return;
                const pid = String(partnerId);
                const isForThisThread =
                    String(msg.senderId) === pid || String(msg.receiverId) === pid;
                if (!isForThisThread) return;

                applyMessageAction({ type: 'realtime_update', message: msg }, pid);
            },

            onDelete(msg) {
                if (!partnerId) return;
                const pid = String(partnerId);
                applyMessageAction({ type: 'delete', message: msg }, pid);
            },
        };
    }, [partnerId, threadHandlerRef, applyMessageAction]);

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
        const pendingSendPayloads = pendingSendPayloadsRef.current;
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (imagePreviewRef.current?.startsWith?.('blob:')) {
                URL.revokeObjectURL(imagePreviewRef.current);
            }
            pendingSendPayloads.forEach((payload) => {
                if (payload?.imagePreview?.startsWith?.('blob:')) {
                    URL.revokeObjectURL(payload.imagePreview);
                }
            });
            pendingSendPayloads.clear();
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

    const deliverPendingMessage = useCallback(async (payload) => {
        const uploadedImage = payload.imageFile
            ? await authApi.uploadMessageImage(partnerId, payload.imageFile, currentUser)
            : null;

        const msg = await authApi.sendMessage(
            partnerId,
            payload.content?.trim() || '',
            'text',
            null,
            null,
            currentUser,
            payload.replyTarget?.id || null,
            uploadedImage?.path || payload.imagePath || null,
            { clientMessageId: payload.clientMessageId }
        );

        const acknowledged = {
            ...msg,
            clientMessageId: msg.clientMessageId || payload.clientMessageId,
        };
        if (acknowledged.id) loadedIdsRef.current.add(acknowledged.id);
        applyMessageAction({ type: 'server_ack', message: acknowledged });
        pendingSendPayloadsRef.current.delete(payload.clientMessageId);

        if (payload.imagePreview?.startsWith?.('blob:')) {
            URL.revokeObjectURL(payload.imagePreview);
        }

        requestAnimationFrame(() => {
            animateSentRef.current.add(acknowledged.id || acknowledged.clientMessageId);
            setMessages((prev) => [...prev]);
            setTimeout(() => animateSentRef.current.delete(acknowledged.id || acknowledged.clientMessageId), 250);
        });

        return acknowledged;
    }, [partnerId, currentUser, applyMessageAction]);

    const sendMessage = useCallback(async ({ content, onScrollToBottom }) => {
        if (!partnerId) return;
        const clientMessageId = createClientMessageId();
        const payload = {
            clientMessageId,
            content: content?.trim() || '',
            imageFile,
            imagePreview,
            imagePath: null,
            replyTarget,
        };
        const optimistic = buildOptimisticMessage({
            clientMessageId,
            currentUser,
            partnerId,
            content: payload.content,
            imagePreview: payload.imagePreview,
            replyTarget: payload.replyTarget,
        });

        pendingSendPayloadsRef.current.set(clientMessageId, payload);
        applyMessageAction({ type: 'optimistic_send', message: optimistic });
        setReplyTarget(null);
        clearImageAttachment({ revoke: false });
        onScrollToBottom?.();
        stopTyping();

        try {
            return await deliverPendingMessage(payload);
        } catch (err) {
            applyMessageAction({ type: 'send_failed', clientMessageId, error: err });
            throw err;
        }
    }, [partnerId, imageFile, imagePreview, replyTarget, currentUser, applyMessageAction, clearImageAttachment, stopTyping, deliverPendingMessage]);

    const retryMessage = useCallback(async (msg) => {
        const clientMessageId = msg?.clientMessageId;
        if (!clientMessageId) return;
        const payload = pendingSendPayloadsRef.current.get(clientMessageId);
        if (!payload) return;

        applyMessageAction({ type: 'retry', clientMessageId });
        try {
            await deliverPendingMessage(payload);
        } catch (err) {
            applyMessageAction({ type: 'send_failed', clientMessageId, error: err });
        }
    }, [applyMessageAction, deliverPendingMessage]);

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

    const refreshMessageImageUrl = useCallback(async (msg) => {
        if (!msg?.imagePath) return msg?.imageUrl || null;
        const imageUrl = await authApi.refreshMessageImageUrl(msg.imagePath);
        applyMessageAction({
            type: 'realtime_update',
            message: {
                ...msg,
                imageUrl,
                imageLoadError: !imageUrl,
            },
        });
        return imageUrl;
    }, [applyMessageAction]);

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
                    const combined = reduceDmMessages([], { type: 'hydrate', messages: [...older, ...prev] });
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
        retryMessage,
        refreshMessageImageUrl,
        markSharedResourceAccepted,
        loadOlderMessages,
        startEditing,
        cancelEditing,
        startReply,
        cancelReply,
    };
}
