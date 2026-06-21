import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import { useConversations } from '../hooks/useConversations';
import { useThread } from '../hooks/useThread';
import { isSharedMessageType } from '../utils/sharedResources';
import * as authApi from '../api/authApi';

import ConversationList from '../components/messages/ConversationList';
import ChatThread from '../components/messages/ChatThread';
import ThreadHeader from '../components/messages/ThreadHeader';
import MessageComposer from '../components/messages/MessageComposer';
import MobileChatShell from '../components/messages/MobileChatShell';
import { SelectConversationState } from '../components/messages/MessagesEmptyState';
import ReportModal from '../components/ui/ReportModal';
import FileViewer from '../components/FileViewer';

export default function Messages() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const haptics = useHaptics();
    const { isLoggedIn, user } = useAuth();

    // Conversation list filter state
    const [query, setQuery] = useState('');
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    // Composer text state
    const [composerText, setComposerText] = useState('');

    // Context menu + reporting + file viewer
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportingId, setReportingId] = useState(null);
    const [isReporting, setIsReporting] = useState(false);
    const [fileViewerOpen, setFileViewerOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [acceptingSharedResource, setAcceptingSharedResource] = useState(null);

    const inputRef = useRef(null);

    // Shared ref bus: useConversations dispatches realtime events to useThread
    const threadHandlerRef = useRef({});

    // Auth redirect
    useEffect(() => {
        if (!isLoggedIn) navigate('/account');
    }, [isLoggedIn, navigate]);

    // ── Data hooks (always called, never conditional) ─────────────────────
    const {
        conversations,
        markThreadRead,
        invalidate: invalidateConversations,
    } = useConversations(user, threadHandlerRef);

    const {
        messages,
        chatUser,
        loading: threadLoading,
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
        sendMessage,
        editMessage,
        deleteMessage,
        markSharedResourceAccepted,
        loadOlderMessages,
        startEditing,
        cancelEditing,
        startReply,
        cancelReply,
    } = useThread(userId, user, conversations, threadHandlerRef);

    // Mark thread as read when navigating into it
    useEffect(() => {
        if (userId) markThreadRead(userId);
    }, [userId, markThreadRead]);

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (e) => {
        e?.preventDefault();
        if (!userId) return;

        if (editingMessageId) {
            if (!composerText.trim() || sending) return;
            try {
                await editMessage(editingMessageId, composerText.trim());
                setComposerText('');
                invalidateConversations();
            } catch {
                toast.error('Failed to edit message');
            }
            return;
        }

        if (!composerText.trim() && !imageFile) return;
        if (sending) return;

        haptics.light();
        try {
            await sendMessage({
                content: composerText,
                onScrollToBottom: () => {},
            });
            setComposerText('');
            invalidateConversations();
            inputRef.current?.focus();
        } catch (err) {
            haptics.error();
            toast.error(err?.message || 'Failed to send message');
        }
    }, [userId, editingMessageId, composerText, sending, imageFile, editMessage, sendMessage, invalidateConversations, haptics, toast]);

    const handleComposerChange = useCallback((text, img, file) => {
        if (text !== undefined) setComposerText(text);
        if (img !== undefined) setImageAttachment(file || null, img);
    }, [setImageAttachment]);

    const handleDelete = useCallback(async (id) => {
        if (!window.confirm('Delete this message?')) return;
        try {
            await deleteMessage(id);
            toast.success('Message deleted');
            haptics.medium();
            invalidateConversations();
        } catch {
            toast.error('Failed to delete message');
            haptics.error();
        }
    }, [deleteMessage, toast, haptics, invalidateConversations]);

    const handleStartEdit = useCallback((msg) => {
        startEditing(msg);
        setComposerText(msg.content || '');
        inputRef.current?.focus();
    }, [startEditing]);

    const handleCancelEdit = useCallback(() => {
        cancelEditing();
        setComposerText('');
    }, [cancelEditing]);

    const handleStartReply = useCallback((msg) => {
        startReply(msg);
        inputRef.current?.focus();
    }, [startReply]);

    const handleReport = useCallback((id) => {
        setReportingId(id);
        setReportModalOpen(true);
    }, []);

    const handleReportSubmit = useCallback(async (reason, details) => {
        setIsReporting(true);
        try {
            await authApi.reportContent({
                reportedUserId: chatUser?.id,
                contentType: 'message',
                contentId: reportingId,
                reason,
                details,
            });
            toast.success('Message reported. Thank you.');
            setReportModalOpen(false);
            setReportingId(null);
        } catch (err) {
            toast.error(err.message || 'Failed to submit report');
        } finally {
            setIsReporting(false);
        }
    }, [chatUser, reportingId, toast]);

    const handleAcceptSharedResource = useCallback(async (messageId) => {
        setAcceptingSharedResource(messageId);
        try {
            const result = await authApi.acceptSharedResource(messageId);
            const imported = result.resource || result.newDeck || result.newNote || result.newGuide;
            if (imported?.id) {
                markSharedResourceAccepted(messageId, imported.id);
            }
            toast.success(`"${imported?.title || 'Item'}" added to your library!`);
            haptics.light();
        } catch (err) {
            toast.error(err.message || 'Failed to import');
            haptics.error();
        } finally {
            setAcceptingSharedResource(null);
        }
    }, [markSharedResourceAccepted, toast, haptics]);

    const handleViewFile = useCallback((url, name) => {
        const ext = url.split('?')[0].split('.').pop().toLowerCase();
        setSelectedFile({ name: name || 'Attached Image', url, extension: ext });
        setFileViewerOpen(true);
    }, []);

    const sharedItemCount = useMemo(
        () => messages.filter((m) => isSharedMessageType(m.messageType) && m.sharedResource).length,
        [messages]
    );

    // ── Composed panes ────────────────────────────────────────────────────
    const listPane = (
        <ConversationList
            conversations={conversations}
            isBanned={user?.is_banned}
            query={query}
            setQuery={setQuery}
            showUnreadOnly={showUnreadOnly}
            setShowUnreadOnly={setShowUnreadOnly}
            activeUserId={userId}
        />
    );

    const threadPane = userId ? (
        <div
            data-testid="messages-thread-shell"
            className="messages-thread-shell relative flex flex-col h-full overflow-hidden"
            style={{
                background: 'var(--bg-color)',
                backgroundImage:
                    'radial-gradient(ellipse at 15% 88%, oklch(77% 0.12 84 / 0.03) 0%, transparent 50%), radial-gradient(ellipse at 85% 18%, oklch(51% 0.10 143 / 0.04) 0%, transparent 40%)',
            }}
        >
            <ThreadHeader
                chatUser={chatUser}
                messageCount={messages.length}
                sharedItemCount={sharedItemCount}
            />

            <ChatThread
                key={userId}
                messages={messages}
                chatUser={chatUser}
                loading={threadLoading}
                loadingMore={loadingMore}
                isTyping={isTyping}
                hasMore={hasMore}
                loadedIdsRef={loadedIdsRef}
                deletingIdsRef={deletingIdsRef}
                animateSentRef={animateSentRef}
                activeMenuId={activeMenuId}
                setActiveMenuId={setActiveMenuId}
                isAcceptingSharedResource={acceptingSharedResource}
                onAcceptSharedResource={handleAcceptSharedResource}
                onStartEdit={handleStartEdit}
                onDelete={handleDelete}
                onStartReply={handleStartReply}
                onReport={handleReport}
                onViewFile={handleViewFile}
                onLoadOlderMessages={loadOlderMessages}
            />

            <MessageComposer
                ref={inputRef}
                value={composerText}
                onChange={handleComposerChange}
                onSubmit={handleSubmit}
                onTyping={handleTyping}
                sending={sending}
                editingMessageId={editingMessageId}
                onCancelEdit={handleCancelEdit}
                replyTarget={replyTarget}
                onCancelReply={cancelReply}
                imagePreview={imagePreview}
                onClearImage={clearImageAttachment}
                chatUser={chatUser}
            />
        </div>
    ) : null;

    return (
        <>
            {/* Mobile: push/pop shell */}
            <MobileChatShell
                hasThread={Boolean(userId)}
                listPane={listPane}
                threadPane={threadPane}
            />

            {/* Desktop: two-column grid */}
            <div
                className="hidden lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5 lg:min-h-[calc(100dvh-6rem)] lg:items-start"
            >
                <aside
                    className="lg:sticky lg:top-6 lg:self-start lg:h-[calc(100dvh-8rem)] lg:overflow-hidden lg:rounded-[24px] lg:p-5"
                    style={{ border: '1px solid oklch(33% 0.04 211)', background: 'oklch(24% 0.038 211 / 0.7)' }}
                >
                    {listPane}
                </aside>

                <div
                    className="lg:h-[calc(100dvh-8rem)] lg:rounded-[28px] lg:overflow-hidden lg:flex lg:flex-col"
                    style={{ border: '1px solid oklch(33% 0.04 211)' }}
                >
                    {userId && threadPane ? threadPane : <SelectConversationState />}
                </div>
            </div>

            {/* Modals */}
            <ReportModal
                isOpen={reportModalOpen}
                onClose={() => { setReportModalOpen(false); setReportingId(null); }}
                onSubmit={handleReportSubmit}
                isSubmitting={isReporting}
            />
            <FileViewer
                file={selectedFile}
                isOpen={fileViewerOpen}
                onClose={() => setFileViewerOpen(false)}
            />
        </>
    );
}
