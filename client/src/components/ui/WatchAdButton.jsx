import { Play, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function WatchAdButton({ onWatch, loading, label = 'Watch Ad for Reward', className = '' }) {
    return (
        <motion.button
            onClick={onWatch}
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className={`w-full py-4 rounded-xl border border-amber-500/30 bg-amber-500/5
                        font-semibold text-claude-text hover:bg-amber-500/10 transition-colors
                        flex items-center justify-center gap-2 tap-action disabled:opacity-50 ${className}`}
        >
            {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            ) : (
                <Play className="w-5 h-5 text-amber-400" />
            )}
            {loading ? 'Watching Ad...' : label}
        </motion.button>
    );
}
