import { useState, useRef, useCallback } from 'react';
import { MoreVertical, Edit2, Trash2, ShieldAlert, CornerUpLeft } from 'lucide-react';
import { isSharedMessageType } from '../../utils/sharedResources';
import SharedResourceCard from './SharedResourceCard';
import Avatar from '../Avatar';

// Resolve border-radius classes for grouped bubbles
function bubbleRadius(isMine, isFirst, isLast) {
    // Rounding: 2xl on outer corners, sm on grouped inner corners
    if (isFirst && isLast) {
        return isMine ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm';
    }
    if (isFirst) {
        return isMine
            ? 'rounded-t-2xl rounded-bl-2xl rounded-br-2xl rounded-tr-2xl'
            : 'rounded-2xl';
    }
    if (isLast) {
        return isMine
            ? 'rounded-2xl rounded-br-sm rounded-tr-md'
            : 'rounded-2xl rounded-bl-sm rounded-tl-md';
    }
    // Middle
    return isMine
        ? 'rounded-l-2xl rounded-r-md'
        : 'rounded-r-2xl rounded-l-md';
}

function formatTimestamp(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { weekday: 'short' });
}

// Swipe gesture constants
const SWIPE_THRESHOLD = 48;
const SWIPE_MAX = 64;

export default function MessageBubble({
    message: msg,
    isFirst,
    isLast,
    showAvatar,
    chatUser,
    isAnimatingIn,
    isDeleting,
    activeMenuId,
    setActiveMenuId,
    isLastSentMessage,
    isAcceptingSharedResource,
    onAcceptSharedResource,
    onStartEdit,
    onDelete,
    onStartReply,
    onReport,
    onViewFile,
    scrollToMessage,
}) {
    const [swipeDelta, setSwipeDelta] = useState(0);
    const swipeStartX = useRef(null);
    const swipeTriggered = useRef(false);
    const bubbleRef = useRef(null);

    const radius = bubbleRadius(msg.isMine, isFirst, isLast);
    const isShared = isSharedMessageType(msg.messageType) && msg.sharedResource;

    // Swipe-to-reply gesture
    const onPointerDown = useCallback((e) => {
        if (isShared || msg.isMine) return; // only swipe received messages
        swipeStartX.current = e.clientX;
        swipeTriggered.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
    }, [isShared, msg.isMine]);

    const onPointerMove = useCallback((e) => {
        if (swipeStartX.current === null) return;
        const dx = e.clientX - swipeStartX.current;
        if (dx < 0) return; // only swipe right for received messages
        const clamped = Math.min(dx, SWIPE_MAX);
        setSwipeDelta(clamped);
        if (clamped >= SWIPE_THRESHOLD && !swipeTriggered.current) {
            swipeTriggered.current = true;
        }
    }, []);

    const onPointerUp = useCallback(() => {
        if (swipeTriggered.current) {
            onStartReply(msg);
        }
        swipeStartX.current = null;
        swipeTriggered.current = false;
        setSwipeDelta(0);
    }, [msg, onStartReply]);

    const onPointerCancel = useCallback(() => {
        swipeStartX.current = null;
        swipeTriggered.current = false;
        setSwipeDelta(0);
    }, []);

    const swipeStyle = swipeDelta > 0
        ? { transform: `translateX(${swipeDelta}px)`, transition: 'none' }
        : { transform: 'translateX(0)', transition: 'transform 200ms cubic-bezier(0.25, 0, 0.1, 1)' };

    const replyIconOpacity = Math.min(swipeDelta / SWIPE_THRESHOLD, 1);

    return (
        <div
            className={`message-row pb-1 ${isDeleting ? 'animate-msg-out' : isAnimatingIn ? (msg.isMine ? 'animate-msg-in-sent' : 'animate-msg-in-received') : ''}`}
        >
            {/* Outer alignment row */}
            <div className={`flex ${msg.isMine ? 'justify-end pl-10' : 'justify-start pr-10'} relative`}>
                {/* Reply icon (appears on swipe, received only) */}
                {!msg.isMine && (
                    <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8"
                        style={{ opacity: replyIconOpacity, transition: 'opacity 80ms' }}
                        aria-hidden="true"
                    >
                        <CornerUpLeft className="w-4 h-4 text-claude-accent" />
                    </div>
                )}

                <div
                    className={`flex items-end gap-2 max-w-[min(80%,26rem)] ${msg.isMine ? 'flex-row-reverse' : ''}`}
                >
                    {/* Avatar (received only, first in group) */}
                    {!msg.isMine && (
                        <div className="w-7 shrink-0 mb-0.5">
                            {(isFirst || isLast) && showAvatar ? (
                                <Avatar src={msg.senderAvatar} size="xs" />
                            ) : null}
                        </div>
                    )}

                    {/* Shared resource or text/image bubble */}
                    {isShared ? (
                        <SharedResourceCard
                            message={msg}
                            chatUser={chatUser}
                            isMine={msg.isMine}
                            isAccepting={isAcceptingSharedResource === msg.id}
                            onAccept={onAcceptSharedResource}
                        />
                    ) : (
                        <div
                            ref={bubbleRef}
                            className={`relative group ${radius} px-4 py-2.5 cursor-default select-text touch-pan-y`}
                            style={msg.isMine
                                ? {
                                    background: 'oklch(51% 0.10 143)',
                                    color: 'oklch(97% 0.007 100)',
                                    ...swipeStyle,
                                }
                                : {
                                    background: 'oklch(27% 0.04 211)',
                                    border: '1px solid oklch(33% 0.04 211)',
                                    color: 'var(--text-color)',
                                    ...swipeStyle,
                                }
                            }
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerCancel}
                        >
                            {/* Context menu trigger */}
                            <div
                                data-msg-menu
                                className={`absolute ${msg.isMine ? '-left-9' : '-right-9'} top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity`}
                            >
                                <div className="relative">
                                    <button
                                        onClick={() => setActiveMenuId(activeMenuId === msg.id ? null : msg.id)}
                                        className="p-1.5 text-claude-secondary hover:text-claude-text rounded-lg transition-colors"
                                        aria-label="Message options"
                                        aria-expanded={activeMenuId === msg.id}
                                    >
                                        <MoreVertical className="w-3.5 h-3.5" />
                                    </button>

                                    {activeMenuId === msg.id && (
                                        <div
                                            className={`absolute ${msg.isMine ? 'right-full mr-1.5' : 'left-full ml-1.5'} top-0 z-50 min-w-[130px] overflow-hidden rounded-xl py-1`}
                                            style={{
                                                background: 'oklch(24% 0.038 211)',
                                                border: '1px solid oklch(32% 0.04 211)',
                                                boxShadow: '0 8px 32px oklch(10% 0.03 211 / 0.7)',
                                            }}
                                        >
                                            {msg.isMine ? (
                                                <>
                                                    <button
                                                        onClick={() => { onStartReply(msg); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-left flex items-center gap-2 hover:bg-white/5 text-claude-secondary hover:text-claude-text transition-colors"
                                                    >
                                                        <CornerUpLeft className="w-3.5 h-3.5" /> Reply
                                                    </button>
                                                    <button
                                                        onClick={() => { onStartEdit(msg); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-left flex items-center gap-2 hover:bg-white/5 text-claude-secondary hover:text-claude-text transition-colors"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => { onDelete(msg.id); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-left flex items-center gap-2 hover:bg-white/5 text-red-500/80 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => { onStartReply(msg); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-left flex items-center gap-2 hover:bg-white/5 text-claude-secondary hover:text-claude-text transition-colors"
                                                    >
                                                        <CornerUpLeft className="w-3.5 h-3.5" /> Reply
                                                    </button>
                                                    <button
                                                        onClick={() => { onReport(msg.id); setActiveMenuId(null); }}
                                                        className="w-full px-4 py-2.5 text-[11px] font-mono uppercase tracking-widest text-left flex items-center gap-2 hover:bg-white/5 text-red-400/80 hover:text-red-400 transition-colors"
                                                    >
                                                        <ShieldAlert className="w-3.5 h-3.5" /> Report
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quoted reply snippet */}
                            {msg.replyTo && (
                                <button
                                    onClick={() => scrollToMessage?.(msg.replyTo.id)}
                                    className="mb-2 w-full rounded-lg px-3 py-2 text-left cursor-pointer hover:brightness-110 transition-all"
                                    style={{
                                        background: msg.isMine ? 'oklch(45% 0.09 143 / 0.5)' : 'oklch(22% 0.035 211 / 0.7)',
                                    }}
                                    aria-label="Go to original message"
                                >
                                    <p className="text-[10px] font-mono mb-0.5" style={{ color: 'oklch(77% 0.12 84)' }}>
                                        {msg.replyTo.isMine ? 'You' : chatUser?.username}
                                    </p>
                                    <p className="text-xs line-clamp-2 opacity-75">
                                        {msg.replyTo.content || (msg.replyTo.imageUrl ? '[Image]' : '[Message]')}
                                    </p>
                                </button>
                            )}

                            {/* Attached image */}
                            {msg.imageUrl && (
                                <button
                                    type="button"
                                    className="block mb-2 cursor-pointer"
                                    onClick={() => onViewFile(msg.imageUrl, 'Attached Image')}
                                    aria-label="View attached image"
                                >
                                    <img
                                        src={msg.imageUrl}
                                        alt="Attached"
                                        className="rounded-lg max-h-[240px] object-cover hover:opacity-90 transition-opacity"
                                        loading="lazy"
                                    />
                                </button>
                            )}

                            {/* Message text */}
                            {msg.content && (
                                <p className="break-words font-sans text-[15px] leading-relaxed">
                                    {msg.content}
                                </p>
                            )}

                            {/* Footer: edited + timestamp */}
                            <p className={`text-[10px] tabular-nums mt-1.5 select-none ${msg.isMine ? 'text-right opacity-70' : 'text-left text-claude-secondary'}`}>
                                {msg.isEdited && <span className="italic mr-1.5">(edited)</span>}
                                {formatTimestamp(msg.createdAt)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Read receipt — only under the last sent message */}
            {msg.isMine && isLastSentMessage && !isShared && (
                <div className="flex justify-end pr-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] font-mono text-claude-secondary/50">
                        {msg.isRead ? (
                            <>
                                <span className="text-claude-accent/70">✓✓</span>
                                Read
                            </>
                        ) : (
                            <>
                                <span>✓</span>
                                Sent
                            </>
                        )}
                    </span>
                </div>
            )}
        </div>
    );
}
