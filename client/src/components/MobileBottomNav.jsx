import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { prefetchRoute } from '../routes/config.jsx';

const routeMatches = (pathname, matchers = []) =>
    matchers.some((m) => pathname === m || pathname.startsWith(`${m}/`));

export default function MobileBottomNav({ primaryNavItems, onFabPress }) {
    const location = useLocation();

    return (
        <nav
            aria-label="Main navigation"
            className="fixed bottom-0 left-0 right-0 z-40 pb-safe md:hidden"
        >
            <div className="mx-3 mb-2">
                <div className="mobile-bottom-nav-shell rounded-[1.75rem]">
                    <div className="mobile-bottom-nav-shell__clip rounded-[inherit]">
                        <div className="flex items-stretch h-[68px]">
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
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
