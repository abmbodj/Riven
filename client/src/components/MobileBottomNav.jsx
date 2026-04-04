import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import { prefetchRoute } from '../routes/config.jsx';

const routeMatches = (pathname, matchers = []) =>
    matchers.some((m) => pathname === m || pathname.startsWith(`${m}/`));

const SPRING = { type: 'spring', stiffness: 400, damping: 30 };

export default function MobileBottomNav({ primaryNavItems, onFabPress, studyMode = null }) {
    const location = useLocation();

    return (
        <nav
            aria-label="Main navigation"
            className="fixed bottom-0 left-0 right-0 z-40 pb-safe md:hidden"
        >
            <div className="mx-3 mb-2">
                <motion.div
                    animate={studyMode ? {
                        backgroundColor: 'rgba(20,40,20,0.75)',
                        borderColor: 'rgba(34,197,94,0.2)',
                    } : {
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                    }}
                    transition={SPRING}
                    className="mobile-bottom-nav-shell rounded-[1.75rem] border"
                >
                    <div className="mobile-bottom-nav-shell__clip rounded-[inherit]">
                        <AnimatePresence mode="wait" initial={false}>
                            {studyMode ? (
                                <motion.div
                                    key="study"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={SPRING}
                                    className="flex flex-col px-4 pt-2 pb-1"
                                >
                                    {/* Study tabs row */}
                                    <div className="flex gap-2 mb-2">
                                        {[
                                            { label: 'Sections', handler: studyMode.onSections },
                                            { label: 'Details', handler: studyMode.onDetails },
                                            { label: 'Note', handler: studyMode.onNote },
                                        ].map(({ label, handler }) => (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={handler}
                                                className="flex-1 rounded-[0.85rem] py-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.1em] text-[#86efac]/60 transition-colors tap-action first:bg-[rgba(34,197,94,0.15)] first:text-[#86efac]"
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Prev / count / Next row */}
                                    <div className="flex items-center justify-between px-1 pb-1">
                                        <button
                                            type="button"
                                            aria-label="Previous section"
                                            disabled={!studyMode.canPrev}
                                            onClick={studyMode.onPrev}
                                            className="tap-action flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-30"
                                        >
                                            <ChevronLeft className="h-5 w-5 text-[#86efac]/70" />
                                        </button>
                                        <span className="text-[12px] font-bold text-[#86efac]">
                                            {studyMode.currentIndex + 1} / {studyMode.totalSections}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label="Next section"
                                            disabled={!studyMode.canNext}
                                            onClick={studyMode.onNext}
                                            className="tap-action flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-30"
                                        >
                                            <ChevronRight className="h-5 w-5 text-[#86efac]" />
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="default"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={SPRING}
                                    className="flex items-stretch h-[68px]"
                                >
                                    {primaryNavItems.map((item) => {
                                        if (item.isFab) {
                                            return (
                                                <button
                                                    key="fab"
                                                    type="button"
                                                    onClick={onFabPress}
                                                    aria-label="Create"
                                                    className="flex-1 flex items-center justify-center tap-action relative cursor-pointer"
                                                >
                                                    <div className="mobile-fab-button w-[52px] h-[52px] -mt-3 rounded-full flex items-center justify-center overflow-visible">
                                                        <motion.div
                                                            whileTap={{ scale: 0.88 }}
                                                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                                            className="mobile-fab-icon h-full w-full"
                                                        >
                                                            <Plus className="w-6 h-6 text-claude-accent" strokeWidth={2.5} />
                                                        </motion.div>
                                                    </div>
                                                </button>
                                            );
                                        }

                                        const isActive = routeMatches(location.pathname, item.matchers);
                                        const Icon = item.icon;

                                        return (
                                            <Link
                                                key={item.to}
                                                to={item.to}
                                                onTouchStart={() => prefetchRoute(item.to)}
                                                onMouseEnter={() => prefetchRoute(item.to)}
                                                className="flex-1 flex flex-col items-center justify-center gap-1 tap-action cursor-pointer group"
                                            >
                                                <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl transition-colors duration-200">
                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="mobile-nav-pill"
                                                            className="absolute inset-0 rounded-2xl bg-claude-accent/12 border border-claude-accent/15"
                                                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                                        />
                                                    )}
                                                    <Icon
                                                        className={`w-[20px] h-[20px] relative z-[1] transition-colors duration-200 ${
                                                            isActive
                                                                ? 'text-claude-accent'
                                                                : 'text-claude-secondary group-hover:text-claude-text'
                                                        }`}
                                                        strokeWidth={isActive ? 2.2 : 1.8}
                                                    />
                                                </div>
                                                <span
                                                    className={`text-[9px] font-mono font-semibold uppercase tracking-[0.1em] transition-colors duration-200 ${
                                                        isActive
                                                            ? 'text-claude-accent'
                                                            : 'text-claude-secondary/70 group-hover:text-claude-secondary'
                                                    }`}
                                                >
                                                    {item.label}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </nav>
    );
}
