import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Avatar from '../Avatar';

export default function ThreadHeader({ chatUser, messageCount, sharedItemCount }) {
    const navigate = useNavigate();

    return (
        <div className="relative z-20 flex shrink-0 items-center gap-2 border-b border-claude-border/40 px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:gap-3 sm:px-4 sm:pb-4 sm:pt-[calc(env(safe-area-inset-top,0px)+1rem)] lg:p-4">
            {/* Back button — mobile only */}
            <button
                type="button"
                onClick={() => navigate('/messages')}
                className="touch-target shrink-0 flex h-10 w-10 items-center justify-center -ml-1 rounded-xl hover:bg-white/5 transition-colors focus-ring lg:hidden"
                aria-label="Back to conversations"
            >
                <ArrowLeft className="w-5 h-5 text-claude-text" aria-hidden="true" />
            </button>

            {chatUser ? (
                <Link
                    to={`/profile/${chatUser.id}`}
                    className="flex min-h-10 flex-1 min-w-0 items-center gap-3 py-1 pr-1 rounded-xl hover:bg-white/5 active:scale-[0.98] transition-[transform,background-color]"
                >
                    <div className="relative shrink-0">
                        <Avatar src={chatUser.avatar} size="md" />
                        <div
                            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-claude-bg"
                            style={{ background: 'oklch(65% 0.18 145)' }}
                            aria-hidden="true"
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-claude-text truncate">
                            {chatUser.username}
                        </p>
                        <p className="text-xs text-claude-secondary/80 font-sans leading-tight">
                            <span className="lg:hidden">Tap to view profile</span>
                            <span className="hidden lg:inline">Click to view profile</span>
                        </p>
                    </div>
                </Link>
            ) : (
                <div className="flex-1 h-9 rounded-lg animate-pulse" style={{ background: 'oklch(27% 0.04 211)' }} />
            )}

            {/* Desktop stats */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
                <span
                    className="rounded-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary"
                    style={{ border: '1px solid oklch(33% 0.04 211)', background: 'oklch(22% 0.03 211 / 0.5)' }}
                >
                    {messageCount} message{messageCount === 1 ? '' : 's'}
                </span>
                <span
                    className="rounded-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary"
                    style={{ border: '1px solid oklch(33% 0.04 211)', background: 'oklch(22% 0.03 211 / 0.5)' }}
                >
                    {sharedItemCount} shared
                </span>
            </div>
        </div>
    );
}
