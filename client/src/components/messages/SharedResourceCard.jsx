import { Link } from 'react-router-dom';
import { Layers, BookOpen, FileText } from 'lucide-react';
import {
    getSharedResourceCta,
    getSharedResourceLabel,
    getSharedResourceOpenLabel,
    getSharedResourceRoute,
} from '../../utils/sharedResources';

function ResourceIcon({ kind }) {
    if (kind === 'note') return <FileText className="w-4 h-4 text-claude-accent" />;
    if (kind === 'guide') return <BookOpen className="w-4 h-4 text-claude-accent" />;
    return <Layers className="w-4 h-4 text-claude-accent" />;
}

export default function SharedResourceCard({
    message,
    chatUser,
    isMine,
    isAccepting,
    onAccept,
}) {
    const { sharedResource } = message;
    if (!sharedResource) return null;

    const { kind, sourceId, acceptedId, title, cardCount, previewText } = sharedResource;
    const sourceRoute = getSharedResourceRoute(kind, sourceId);
    const acceptedRoute = getSharedResourceRoute(kind, acceptedId);
    const summaryText = kind === 'deck'
        ? `${cardCount || 0} cards`
        : (previewText || 'Ready to import');

    return (
        <div
            className="dm-resource-card relative overflow-hidden min-w-[240px] max-w-[280px] rounded-2xl p-4"
            style={{
                background: 'oklch(27% 0.04 211)',
                border: '1px solid oklch(33% 0.04 211)',
            }}
        >
            {/* Type accent strip across top */}
            <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: 'oklch(77% 0.12 84 / 0.35)' }}
            />

            <div className="flex items-start gap-3 mb-3">
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'oklch(77% 0.12 84 / 0.12)' }}
                >
                    <ResourceIcon kind={kind} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/80 mb-0.5">
                        {isMine
                            ? `You shared a ${getSharedResourceLabel(kind)}`
                            : `${chatUser?.username || 'Friend'} shared a ${getSharedResourceLabel(kind)}`}
                    </p>
                    <span className="font-display font-semibold text-claude-text block truncate text-sm">
                        {title}
                    </span>
                </div>
            </div>

            <p className="text-xs text-claude-secondary font-mono mb-4 text-center">
                {summaryText}
            </p>

            {isMine ? (
                <Link
                    to={sourceRoute || '#'}
                    className="block w-full rounded-lg py-2 text-center text-xs font-mono font-medium transition-colors"
                    style={{ background: 'oklch(77% 0.12 84 / 0.12)', color: 'oklch(77% 0.12 84)' }}
                >
                    {getSharedResourceOpenLabel(kind)}
                </Link>
            ) : acceptedRoute ? (
                <Link
                    to={acceptedRoute}
                    className="block w-full rounded-lg py-2 text-center text-xs font-mono font-medium transition-colors"
                    style={{ background: 'oklch(77% 0.12 84 / 0.12)', color: 'oklch(77% 0.12 84)' }}
                >
                    {getSharedResourceOpenLabel(kind, true)}
                </Link>
            ) : (
                <button
                    onClick={() => onAccept(message.id)}
                    disabled={isAccepting}
                    className="w-full rounded-lg py-2 text-center text-xs font-mono font-medium text-white active:scale-95 transition-transform disabled:opacity-50"
                    style={{ background: 'oklch(55% 0.09 143)' }}
                >
                    {isAccepting ? 'Adding...' : getSharedResourceCta(kind)}
                </button>
            )}
        </div>
    );
}
