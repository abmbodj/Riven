import { Link } from 'react-router-dom';

// River as a simple text/emoji placeholder until a real SVG asset is added
function RiverPlaceholder() {
    return (
        <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full text-4xl select-none"
            style={{ background: 'oklch(27% 0.038 211)', border: '1px solid oklch(33% 0.04 211)' }}
            aria-hidden="true"
        >
            🐱
        </div>
    );
}

export function NoConversationsState() {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <RiverPlaceholder />
            <h2 className="font-display text-xl font-bold text-claude-text mb-2">
                Your study circle lives here
            </h2>
            <p className="text-sm text-claude-secondary font-mono mb-8 max-w-xs leading-relaxed">
                Connect with classmates, share study resources, and keep your circle close.
            </p>
            <Link
                to="/friends"
                className="inline-flex items-center gap-2 rounded-full bg-claude-accent px-6 py-3 text-sm font-medium text-white active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent"
            >
                Find people
            </Link>
        </div>
    );
}

export function SelectConversationState() {
    return (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <RiverPlaceholder />
            <h2 className="font-display text-xl font-bold text-claude-text mb-2">
                Select a conversation
            </h2>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-claude-secondary/70">
                Choose someone to message
            </p>
        </div>
    );
}

export function EmptyThreadState({ username }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-3xl select-none"
                style={{ background: 'oklch(27% 0.038 211)' }}
                aria-hidden="true"
            >
                💬
            </div>
            <p className="text-claude-secondary font-mono text-sm">No messages yet</p>
            <p className="text-sm text-claude-secondary/70 mt-1 font-mono">
                Say hi to {username}!
            </p>
        </div>
    );
}

export function BannedState() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center sm:max-w-md sm:mx-auto">
            <div
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: 'oklch(30% 0.08 25)' }}
            >
                <span className="text-3xl" aria-hidden="true">🚫</span>
            </div>
            <h2 className="text-2xl font-display font-bold text-claude-text mb-3">Messaging disabled</h2>
            <p className="text-sm text-claude-secondary leading-relaxed max-w-xs font-mono">
                Your account has been restricted from social features due to a community guidelines violation.
            </p>
        </div>
    );
}
