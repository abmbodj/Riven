import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Layers from 'lucide-react/dist/esm/icons/layers';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Play from 'lucide-react/dist/esm/icons/play';

const CREATE_ITEMS = [
    {
        id: 'deck',
        icon: Layers,
        label: 'New Deck',
        description: 'Build flashcards manually',
        route: '/create',
        accent: false,
    },
    {
        id: 'ai',
        icon: Sparkles,
        label: 'Generate from Notes',
        description: 'AI-powered deck creation',
        route: '/create?mode=ai',
        accent: true,
    },
    {
        id: 'youtube',
        icon: Play,
        label: 'Import YouTube',
        description: 'Turn a video into flashcards',
        route: '/youtube',
        accent: false,
    },
];

export default function CreateSheet({ open, onClose }) {
    const navigate = useNavigate();

    const handleSelect = (route) => {
        onClose();
        navigate(route);
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    {/* Sheet */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Create options"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[2rem] bg-claude-surface border-t border-claude-border/30 p-4 pb-safe"
                    >
                        {/* Drag handle */}
                        <div className="w-10 h-1 bg-claude-border/40 rounded-full mx-auto mb-4" />

                        {/* Title */}
                        <p className="font-display text-base text-center text-claude-text mb-3">Create</p>

                        {/* Items */}
                        <div className="space-y-2">
                            {CREATE_ITEMS.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelect(item.route)}
                                        className={`flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl transition-colors duration-200 cursor-pointer text-left ${
                                            item.accent
                                                ? 'bg-claude-accent/10 border border-claude-accent/25 hover:bg-claude-accent/15 active:bg-claude-accent/20'
                                                : 'bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] active:bg-white/[0.12]'
                                        }`}
                                    >
                                        <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                                            item.accent
                                                ? 'bg-claude-accent/15 text-claude-accent'
                                                : 'bg-white/[0.07] text-claude-secondary'
                                        }`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${
                                                item.accent ? 'text-claude-text' : 'text-claude-text'
                                            }`}>
                                                {item.label}
                                            </p>
                                            <p className="text-[11px] text-claude-secondary/70 mt-0.5 font-sans">
                                                {item.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Bottom spacer for extra safe-area breathing room */}
                        <div className="h-2" />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
