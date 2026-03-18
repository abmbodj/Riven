import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Search from 'lucide-react/dist/esm/icons/search';
import Home from 'lucide-react/dist/esm/icons/home';
import Layers from 'lucide-react/dist/esm/icons/layers';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Users from 'lucide-react/dist/esm/icons/users';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Sprout from 'lucide-react/dist/esm/icons/sprout';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Settings from 'lucide-react/dist/esm/icons/settings';
import User from 'lucide-react/dist/esm/icons/user';
import X from 'lucide-react/dist/esm/icons/x';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Command from 'lucide-react/dist/esm/icons/command';
import { AnimatePresence, motion as Motion } from 'motion/react';
import { api } from '../api';

const normalize = (value) => String(value || '').trim().toLowerCase();

const getBaseActions = (isLoggedIn) => [
    {
        id: 'today',
        label: 'Today',
        description: 'Open your dashboard',
        to: isLoggedIn ? '/dashboard' : '/',
        icon: Home,
        category: 'Action',
        keywords: 'dashboard today home'
    },
    {
        id: 'study',
        label: 'Study',
        description: 'Browse decks and study sessions',
        to: '/decks',
        icon: Layers,
        category: 'Action',
        keywords: 'decks flashcards review learn'
    },
    {
        id: 'create-deck',
        label: 'Create Deck',
        description: 'Capture a new study set',
        to: '/create',
        icon: Plus,
        category: 'Action',
        keywords: 'new deck create add'
    },
    {
        id: 'youtube-import',
        label: 'YouTube Import',
        description: 'Generate study materials from a YouTube video',
        to: '/youtube',
        icon: Layers,
        category: 'Action',
        keywords: 'youtube video import generate ai study notes flashcards'
    },
    {
        id: 'classes',
        label: 'Classes',
        description: 'Manage classes and assignments',
        to: '/classes',
        icon: Calendar,
        category: 'Action',
        keywords: 'classes assignments calendar schedule'
    },
    {
        id: 'social',
        label: 'Social',
        description: 'Open messages and study circle',
        to: '/messages',
        icon: Users,
        category: 'Action',
        keywords: 'messages friends groups social'
    },
    {
        id: 'garden',
        label: 'Garden',
        description: 'Check streak and growth',
        to: '/garden',
        icon: Sprout,
        category: 'Action',
        keywords: 'garden streak plant'
    },
    {
        id: 'themes',
        label: 'Themes',
        description: 'Tune your workspace mood',
        to: '/themes',
        icon: Palette,
        category: 'Action',
        keywords: 'themes appearance'
    },
    {
        id: 'settings',
        label: 'Settings',
        description: 'Adjust account and LMS controls',
        to: '/settings',
        icon: Settings,
        category: 'Action',
        keywords: 'settings account config preferences'
    },
    {
        id: 'profile',
        label: 'Profile',
        description: 'View your account',
        to: '/account',
        icon: User,
        category: 'Action',
        keywords: 'profile account me'
    }
];

function resultMatches(item, query) {
    if (!query) return true;
    const haystack = [
        item.label,
        item.description,
        item.keywords,
        item.meta
    ].filter(Boolean).join(' ');
    return normalize(haystack).includes(query);
}

export default function GlobalCommandPalette({ isOpen, isLoggedIn, onClose }) {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [resources, setResources] = useState({
        decks: [],
        classes: [],
        friends: [],
        groups: []
    });

    useEffect(() => {
        if (!isOpen) return undefined;

        const frame = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setSelectedIndex(0);
            return;
        }

        if (!isLoggedIn) return;

        let cancelled = false;

        const loadResources = async () => {
            setLoading(true);
            try {
                const [decks, classes, friends, groups] = await Promise.all([
                    api.getDecks().catch(() => []),
                    api.getClasses().catch(() => []),
                    api.getFriends().catch(() => []),
                    api.getGroups().catch(() => [])
                ]);

                if (cancelled) return;

                setResources({
                    decks: decks || [],
                    classes: classes || [],
                    friends: friends || [],
                    groups: groups || []
                });
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadResources();

        return () => {
            cancelled = true;
        };
    }, [isLoggedIn, isOpen]);

    const allResults = useMemo(() => {
        const baseActions = getBaseActions(isLoggedIn);
        const deckResults = resources.decks.map((deck) => ({
            id: `deck-${deck.id}`,
            label: deck.title || 'Untitled Deck',
            description: 'Open deck',
            to: `/deck/${deck.id}`,
            icon: Layers,
            category: 'Deck',
            meta: deck.description,
            keywords: 'study deck flashcards'
        }));
        const classResults = resources.classes.map((classItem) => ({
            id: `class-${classItem.id}`,
            label: classItem.name || 'Untitled Class',
            description: 'Open class',
            to: `/class/${classItem.id}`,
            icon: Calendar,
            category: 'Class',
            meta: classItem.professor,
            keywords: 'class plan assignment course'
        }));
        const friendResults = resources.friends
            .filter((friend) => friend.status === 'accepted' || friend.status == null)
            .map((friend) => ({
                id: `friend-${friend.id}`,
                label: friend.username || 'Unknown Friend',
                description: 'Open conversation',
                to: `/messages/${friend.id}`,
                icon: Users,
                category: 'Friend',
                meta: friend.bio,
                keywords: 'friend message social'
            }));
        const groupResults = resources.groups.map((group) => ({
            id: `group-${group.id}`,
            label: group.name || 'Untitled Group',
            description: 'Open study group',
            to: `/groups/${group.id}`,
            icon: Users,
            category: 'Group',
            meta: group.join_code,
            keywords: 'group social cram'
        }));

        return [...baseActions, ...deckResults, ...classResults, ...friendResults, ...groupResults];
    }, [isLoggedIn, resources]);

    const filteredResults = useMemo(() => {
        const normalizedQuery = normalize(query);
        const matches = allResults.filter((item) => resultMatches(item, normalizedQuery));

        if (!normalizedQuery) {
            return matches.slice(0, 12);
        }

        return matches.slice(0, 16);
    }, [allResults, query]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        if (selectedIndex >= filteredResults.length) {
            setSelectedIndex(0);
        }
    }, [filteredResults.length, selectedIndex]);

    const handleSelect = (item) => {
        navigate(item.to);
        onClose();
    };

    const handleInputKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((current) => (
                filteredResults.length === 0 ? 0 : (current + 1) % filteredResults.length
            ));
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((current) => (
                filteredResults.length === 0 ? 0 : (current - 1 + filteredResults.length) % filteredResults.length
            ));
        }

        if (event.key === 'Enter' && filteredResults[selectedIndex]) {
            event.preventDefault();
            handleSelect(filteredResults[selectedIndex]);
        }
    };

    return (
        <AnimatePresence>
            {isOpen ? (
                <>
                    <Motion.button
                        type="button"
                        aria-label="Close command palette"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                    />
                    <Motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Global command palette"
                        className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-h-[82vh] w-auto max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#101314]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:bottom-auto sm:top-[10vh]"
                    >
                        <div className="border-b border-white/8 px-4 py-4 sm:px-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-claude-accent">
                                    <Search className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={inputRef}
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            onKeyDown={handleInputKeyDown}
                                            placeholder="Search current Riven..."
                                            className="w-full bg-transparent text-base text-white outline-none placeholder:text-claude-secondary"
                                        />
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="touch-target rounded-xl p-2 text-claude-secondary transition-colors hover:text-white"
                                            aria-label="Close command palette"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="mt-1 text-xs text-claude-secondary">
                                        Jump across actions, decks, classes, friends, and groups from one surface.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="min-h-[280px] overflow-y-auto px-3 py-3 sm:px-4">
                            {loading ? (
                                <div className="flex min-h-[220px] items-center justify-center text-sm text-claude-secondary">
                                    Loading workspace results...
                                </div>
                            ) : filteredResults.length > 0 ? (
                                <div className="space-y-2">
                                    {filteredResults.map((item, index) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleSelect(item)}
                                            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] ${selectedIndex === index
                                                ? 'border-claude-accent/40 bg-claude-accent/10 text-white'
                                                : 'border-white/8 bg-white/[0.02] text-claude-text hover:border-white/15 hover:bg-white/[0.04]'
                                                }`}
                                        >
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${selectedIndex === index ? 'bg-claude-accent/15 text-claude-accent' : 'bg-white/[0.04] text-claude-secondary'}`}>
                                                <item.icon className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate font-medium">{item.label}</span>
                                                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                                        {item.category}
                                                    </span>
                                                </div>
                                                <p className="truncate text-sm text-claude-secondary">{item.description}</p>
                                            </div>
                                            <ArrowRight className="h-4 w-4 shrink-0 text-claude-secondary" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] text-claude-accent">
                                        <Search className="h-6 w-6" />
                                    </div>
                                    <p className="font-serif text-lg text-white">No matching results</p>
                                    <p className="mt-2 max-w-sm text-sm text-claude-secondary">
                                        Try a deck title, class name, friend, or product action like &ldquo;Create Deck&rdquo;.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3 text-[11px] text-claude-secondary">
                            <span className="inline-flex items-center gap-2">
                                <Command className="h-3.5 w-3.5" />
                                Use arrows to move and Enter to jump.
                            </span>
                            <span className="rounded-full border border-white/10 px-2 py-1 font-mono uppercase tracking-[0.18em]">
                                {navigator.platform?.toLowerCase().includes('mac') ? 'Cmd K' : 'Ctrl K'}
                            </span>
                        </div>
                    </Motion.div>
                </>
            ) : null}
        </AnimatePresence>
    );
}
