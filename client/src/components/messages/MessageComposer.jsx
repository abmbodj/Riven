import { useRef, forwardRef } from 'react';
import { Send, Image, X, Edit2, CornerUpLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MessageComposer = forwardRef(function MessageComposer(
    {
        value,
        onChange,
        onSubmit,
        onTyping,
        sending,
        editingMessageId,
        onCancelEdit,
        replyTarget,
        onCancelReply,
        imagePreview,
        onClearImage,
        chatUser,
    },
    inputRef
) {
    const fileInputRef = useRef(null);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            onChange(undefined, reader.result); // pass imagePreview via second arg
            inputRef.current?.focus();
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const canSend = (value.trim() || imagePreview) && !sending;

    return (
        <div
            className="messages-composer-dock mobile-bottom-nav-shell sticky bottom-0 left-0 right-0 z-20 shrink-0 lg:absolute lg:bottom-0 lg:left-0 lg:right-0"
            style={{
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
                paddingTop: '8px',
            }}
        >
            <form onSubmit={onSubmit} className="px-3 flex flex-col gap-2">
                {/* Edit banner */}
                {editingMessageId && (
                    <div
                        className="flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-mono"
                        style={{
                            background: 'oklch(77% 0.12 84 / 0.08)',
                            border: '1px solid oklch(77% 0.12 84 / 0.15)',
                            color: 'oklch(77% 0.12 84)',
                        }}
                    >
                        <span className="flex items-center gap-1.5">
                            <Edit2 className="w-3 h-3" aria-hidden="true" />
                            Editing message
                        </span>
                        <button
                            type="button"
                            onClick={onCancelEdit}
                            className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                            aria-label="Cancel editing"
                        >
                            <X className="w-3 h-3" /> Cancel
                        </button>
                    </div>
                )}

                {/* Reply banner */}
                {replyTarget && !editingMessageId && (
                    <div
                        className="flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-mono"
                        style={{
                            background: 'oklch(27% 0.04 211)',
                            border: '1px solid oklch(33% 0.04 211)',
                        }}
                    >
                        <span className="flex items-center gap-1.5 text-claude-secondary min-w-0">
                            <CornerUpLeft className="w-3 h-3 shrink-0 text-claude-accent" aria-hidden="true" />
                            <span className="truncate">
                                Replying to{' '}
                                <span className="text-claude-text">
                                    {replyTarget.isMine ? 'yourself' : chatUser?.username}
                                </span>
                                {replyTarget.content && (
                                    <span className="text-claude-secondary/70"> — {replyTarget.content.slice(0, 40)}{replyTarget.content.length > 40 ? '…' : ''}</span>
                                )}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={onCancelReply}
                            className="ml-2 shrink-0 text-claude-secondary hover:text-claude-text transition-colors"
                            aria-label="Cancel reply"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Image preview */}
                {imagePreview && !editingMessageId && (
                    <div
                        className="relative self-start rounded-2xl p-2"
                        style={{
                            background: 'oklch(27% 0.04 211)',
                            border: '1px solid oklch(33% 0.04 211)',
                        }}
                    >
                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary mb-2">
                            Attachment
                        </p>
                        <img
                            src={imagePreview}
                            alt="Attachment preview"
                            className="h-20 rounded-xl object-cover border border-claude-border"
                        />
                        <button
                            type="button"
                            onClick={onClearImage}
                            className="absolute -top-2 -right-2 rounded-full p-1 text-white"
                            style={{ background: 'oklch(45% 0.18 25)' }}
                            aria-label="Remove attachment"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* Input row */}
                <div className="flex items-end gap-2">
                    {/* Attach button (hidden when editing) */}
                    {!editingMessageId && (
                        <>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleImageChange}
                                className="hidden"
                                aria-hidden="true"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending}
                                aria-label="Attach image"
                                className="mb-[2px] flex shrink-0 items-center gap-2 rounded-full border border-claude-border px-3 py-2 text-claude-secondary transition-colors hover:text-claude-accent hover:border-claude-accent/30 active:scale-95 disabled:opacity-40"
                            >
                                <Image className="w-5 h-5" aria-hidden="true" />
                                <span className="hidden lg:inline text-[11px] font-mono uppercase tracking-[0.18em]">
                                    Attach
                                </span>
                            </button>
                        </>
                    )}

                    {/* Text input + send */}
                    <div
                        className="flex flex-1 items-end min-h-[52px] rounded-[22px] pl-4 pr-1.5 py-1 mb-1"
                        style={{
                            background: 'oklch(27% 0.04 211)',
                            border: '1px solid oklch(35% 0.04 211)',
                        }}
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onSubmit(e);
                                }
                                onTyping();
                            }}
                            placeholder={editingMessageId ? 'Refine your message...' : 'Write a message...'}
                            disabled={sending}
                            className="flex-1 w-full bg-transparent border-none outline-none text-claude-text placeholder:text-claude-secondary/50 font-sans text-[15px]"
                            aria-label="Message input"
                        />

                        <motion.button
                            type="submit"
                            disabled={!canSend}
                            whileTap={{ scale: 0.88 }}
                            className="ml-2 h-9 w-9 shrink-0 flex items-center justify-center rounded-full text-white shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent"
                            style={{ background: 'oklch(51% 0.10 143)' }}
                            aria-label={sending ? 'Sending' : editingMessageId ? 'Save edit' : 'Send message'}
                        >
                            <AnimatePresence mode="wait">
                                {sending ? (
                                    <motion.div
                                        key="spinner"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                    >
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key={editingMessageId ? 'check' : 'send'}
                                        initial={{ scale: 0, rotate: -90 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        exit={{ scale: 0, rotate: 90 }}
                                        transition={{ duration: 0.15 }}
                                        className="ml-[1px]"
                                    >
                                        {editingMessageId
                                            ? <Check className="w-4 h-4" />
                                            : <Send className="w-4 h-4" />
                                        }
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    </div>
                </div>
            </form>
        </div>
    );
});

export default MessageComposer;
