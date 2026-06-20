import { Check, CheckCheck } from 'lucide-react';

export default function ReadReceipt({ isRead }) {
    return (
        <div className="flex items-center justify-end gap-1 mt-0.5 pr-1" aria-label={isRead ? 'Read' : 'Sent'}>
            {isRead ? (
                <CheckCheck className="w-3 h-3 text-claude-accent/80" aria-hidden="true" />
            ) : (
                <Check className="w-3 h-3 text-claude-secondary/50" aria-hidden="true" />
            )}
            <span className="text-[10px] font-mono text-claude-secondary/50 select-none">
                {isRead ? 'Read' : 'Sent'}
            </span>
        </div>
    );
}
