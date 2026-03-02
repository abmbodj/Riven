import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { X, ThumbsUp, ThumbsDown, Users, CheckCircle2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import useHaptics from '../hooks/useHaptics';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import OutOfHeartsModal from '../components/ui/OutOfHeartsModal';
import StudyHeartsDisplay from '../components/ui/StudyHeartsDisplay';

export default function GroupCram() {
    const { groupId, sessionId } = useParams();
    const navigate = useNavigate();
    const haptics = useHaptics();
    const toast = useToast();
    const { socket } = useAuth();

    // Session Data
    const [session, setSession] = useState(null);
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);

    // Live State
    const [isEnded, setIsEnded] = useState(false);
    const [results, setResults] = useState(null); // { weakSpots: [], personalStats: {} }

    // User Study State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    // Hearts State
    const [heartsStatus, setHeartsStatus] = useState(null);
    const [showOutOfHearts, setShowOutOfHearts] = useState(false);

    const fetchResults = useCallback(async () => {
        try {
            const resData = await api.getSessionResults(sessionId);
            setResults(resData);
        } catch (e) {
            console.error(e);
        }
    }, [sessionId]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Fetch session meta
                const sessionRes = await api.joinGroupSession(sessionId);
                setSession(sessionRes.session);

                // If the session is effectively ended
                if (sessionRes.session.status === 'ended') {
                    setIsEnded(true);
                    fetchResults();
                    return;
                }

                // Fetch deck cards and hearts status concurrently
                const [deckData, heartsData] = await Promise.all([
                    api.getDeck(sessionRes.session.deck_id),
                    api.getHeartsStatus()
                ]);

                setCards(deckData.cards || []);
                setHeartsStatus(heartsData);

                if (!heartsData.isUnlimited && heartsData.hearts <= 0) {
                    setShowOutOfHearts(true);
                }

            } catch (err) {
                console.error(err);
                toast.error('Failed to load session');
                navigate(`/groups/${groupId}`);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [groupId, sessionId, navigate, toast, fetchResults]);

    // Socket Setup
    useEffect(() => {
        if (!session || isEnded || !socket) return;

        // Note: Basic socket.io rooms setup for multiplayer presence
        // Riven's backend already has socket running globally

        socket.emit('register', sessionId); // Rough trick to connect
        socket.emit('join-room', `session-${sessionId}`); // If the server supported custom room joins natively. For now server broadcasts to session-ID

        const onProgress = () => {
            // In a full implementation, we'd track an array of IDs
            // Since we only get pinged on progress, let's pulse the UI
            haptics.light();
        };

        const onEnded = () => {
            setIsEnded(true);
            fetchResults();
        };

        socket.on('session-progress', onProgress);
        socket.on('session-ended', onEnded);

        return () => {
            socket.off('session-progress', onProgress);
            socket.off('session-ended', onEnded);
        };
    }, [session, isEnded, sessionId, haptics, socket, fetchResults]);

    const handleAnswer = async (knewIt) => {
        if (!isFlipped) return;
        const currentCard = cards[currentIndex];

        // Fire off network quietly
        api.respondToSessionCard(sessionId, currentCard.id, knewIt).catch(console.error);
        haptics.selection();

        if (!knewIt && heartsStatus && !heartsStatus.isUnlimited) {
            try {
                const newStatus = await api.decrementHeart();
                setHeartsStatus(newStatus);
                if (newStatus.hearts <= 0) {
                    setTimeout(() => setShowOutOfHearts(true), 150);
                }
            } catch (err) {
                console.error("Failed to decrement heart", err);
            }
        }

        if (currentIndex < cards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(c => c + 1), 150);
        } else {
            setIsFlipped(false);
            setIsFinished(true);

            // If I was the session starter, technically they could end it here,
            // but let's let standard users just wait on this screen or hit "End Session for Everyone"
            if (session?.started_by === (api.getCurrentUser?.()?.id || 1)) {
                // Keep it active until they hit the manual button below
            }
        }
    };

    const handleFlip = useCallback(() => {
        haptics.selection();
        setIsFlipped(f => !f);
    }, [haptics]);

    const handleEndSessionGlobally = async () => {
        try {
            await api.endGroupSession(sessionId);
            // The socket 'session-ended' will fire and transition everyone
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return (
        <div className="fullscreen-page items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Zap className="w-10 h-10 text-amber-400 animate-pulse" />
                <div className="animate-pulse text-claude-secondary font-mono text-sm tracking-widest uppercase">Connecting to Session...</div>
            </div>
        </div>
    );

    // ==========================================
    // ENDED / RESULTS VIEW
    // ==========================================
    if (isEnded && results) {
        return (
            <div className="min-h-screen bg-claude-bg pb-24 px-4 pt-12 relative overflow-hidden">
                {/* Subtle background glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-claude-accent/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-xl mx-auto space-y-8 relative z-10">
                    <div className="text-center">
                        <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 15 }} className="w-24 h-24 bg-botanical-forest/10 text-botanical-forest rounded-full flex items-center justify-center mx-auto mb-6 border border-botanical-forest/20 shadow-[0_0_30px_rgba(45,90,62,0.15)] relative backdrop-blur-sm">
                            <CheckCircle2 className="w-12 h-12 relative z-10" />
                            <div className="absolute inset-0 bg-botanical-forest/5 rounded-full blur-md animate-pulse" />
                        </motion.div>
                        <h2 className="text-4xl font-serif italic font-bold text-botanical-parchment mb-3">Session Complete</h2>
                        <div className="inline-flex items-center gap-3 px-6 py-2 glass-panel rounded-full">
                            <p className="text-claude-secondary font-mono uppercase tracking-widest text-[10px] font-bold">
                                Your Score: <span className="text-claude-accent text-sm ml-1">{results.personalStats?.total_correct || 0}/{results.personalStats?.total_answered || 0}</span>
                            </p>
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-panel rounded-[2rem] p-8 overflow-hidden relative shadow-sm"
                    >
                        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

                        <div className="flex flex-col items-center mb-8">
                            <h3 className="font-serif italic font-bold text-2xl text-botanical-parchment mb-2 text-center">Group Weak Spots</h3>
                            <p className="text-[10px] text-claude-secondary font-mono tracking-widest uppercase text-center max-w-[80%] leading-relaxed">
                                Review these concepts carefully.
                            </p>
                        </div>

                        {results.weakSpots && results.weakSpots.length > 0 ? (
                            <div className="space-y-4">
                                {results.weakSpots.map((card, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + (i * 0.1) }}
                                        key={card.id}
                                        className="p-5 glass-panel border border-red-500/10 rounded-[1.5rem] relative overflow-hidden group hover:border-red-500/20 transition-colors"
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500/50 to-orange-500/50 opacity-50" />
                                        <div className="flex justify-between items-start gap-4 mb-3">
                                            <p className="text-sm font-serif font-bold text-botanical-parchment flex-1 leading-snug">{card.front}</p>
                                            <span className="shrink-0 text-[9px] font-mono font-bold bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
                                                {card.incorrect_count}/{card.total_responses} Missed
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-claude-secondary font-mono border-t border-claude-border/30 pt-3 mt-1 leading-relaxed">{card.back}</p>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 glass-panel border-dashed border-claude-border/50 rounded-[1.5rem]">
                                <span className="text-5xl mb-4 block animate-bounce" style={{ animationDuration: '3s' }}>🎯</span>
                                <h4 className="font-serif italic text-xl text-botanical-parchment mb-2">Flawless Victory</h4>
                                <p className="text-claude-secondary font-mono tracking-widest uppercase text-[9px]">The group mastered everything.</p>
                            </div>
                        )}

                        <button
                            onClick={() => navigate(`/groups/${groupId}`)}
                            className="w-full mt-10 py-4 bg-claude-accent text-botanical-ink rounded-2xl font-mono text-[11px] tracking-widest font-bold uppercase transition-all hover:opacity-90 active:scale-[0.98] tap-action shadow-lg shadow-claude-accent/20"
                        >
                            Return to Group Vault
                        </button>
                    </motion.div>
                </div>
            </div>
        );
    }

    // ==========================================
    // WAIT STATE (FINISHED BUT OTHERS STILL GOING)
    // ==========================================
    if (isFinished) {
        return (
            <div className="min-h-screen bg-claude-bg pb-24 px-4 pt-12 relative overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-claude-accent/5 rounded-full blur-[120px] pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full text-center relative z-10 p-10 glass-panel rounded-[2.5rem] shadow-sm flex flex-col items-center"
                >
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

                    <span className="text-6xl mb-8 block animate-bounce" style={{ animationDuration: '2.5s' }}>☕️</span>
                    <h2 className="text-3xl font-serif italic font-bold text-botanical-parchment mb-4">You finished!</h2>
                    <p className="text-claude-secondary text-xs max-w-xs mb-10 leading-relaxed font-mono tracking-widest uppercase opacity-80">
                        Waiting for the rest of the group to complete their cards before calculating weak spots...
                    </p>

                    <div className="flex items-center gap-2 mb-8 glass-panel px-4 py-2 rounded-full border border-claude-border">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary">Syncing Live</span>
                    </div>

                    {/* Show end button if admin/creator */}
                    <button
                        onClick={handleEndSessionGlobally}
                        className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-red-500 hover:text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all tap-action"
                    >
                        End Session for Everyone
                    </button>
                </motion.div>
            </div>
        );
    }

    // ==========================================
    // ACTIVE CRAM STUDYING
    // ==========================================
    const currentCard = cards[currentIndex];
    const progress = ((currentIndex) / cards.length) * 100;

    return (
        <div className="min-h-screen bg-claude-bg relative overflow-hidden flex flex-col">
            {/* Immersive Dark Background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-claude-bg via-[#161a1d] to-[#0f1113] pointer-events-none z-0" />
            <div className="absolute top-0 right-0 w-full h-[50vh] bg-claude-accent/5 blur-[120px] pointer-events-none z-0" />

            {/* Elevated Top Bar */}
            <div className="relative z-20 flex items-center justify-between px-6 h-20 shrink-0 bg-gradient-to-b from-claude-bg/80 to-transparent backdrop-blur-md">
                <Link to={`/groups/${groupId}`} className="w-10 h-10 flex items-center justify-center rounded-2xl glass-panel text-claude-secondary hover:text-white hover:border-claude-border/80 transition-all tap-action">
                    <X className="w-5 h-5" />
                </Link>

                <div className="flex flex-col items-center">
                    <span className="font-serif italic text-claude-accent font-bold tracking-wide flex items-center gap-2 text-xl filter drop-shadow-[0_0_8px_rgba(222,185,106,0.5)]">
                        <Zap className="w-4 h-4 fill-claude-accent" /> Group Cram
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="text-[8px] font-mono text-red-300 tracking-[0.25em] uppercase font-bold">Live Focus</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <StudyHeartsDisplay heartsStatus={heartsStatus} />
                    <div className="h-8 flex items-center justify-center rounded-2xl glass-panel/50 px-3">
                        <span className="font-mono text-[9px] font-bold text-claude-secondary">{currentIndex + 1}/{cards.length}</span>
                    </div>
                </div>
            </div>

            {/* Premium Progress Bar */}
            <div className="relative z-20 h-1.5 w-full bg-claude-surface/30 px-6 mt-2">
                <div className="h-full w-full glass-panel/20 rounded-full overflow-hidden relative">
                    <motion.div
                        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-claude-accent to-amber-300 rounded-full shadow-[0_0_15px_rgba(222,185,106,0.6)]"
                        animate={{ width: `${progress}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">

                {/* Subdued sync indicator replacing the previous bright box */}
                <div className="absolute top-6 inset-x-0 flex justify-center pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md opacity-60"
                    >
                        <span className="w-1 h-1 rounded-full bg-amber-400/50 animate-pulse" />
                        <span className="text-[8px] font-mono text-claude-secondary tracking-[0.2em] uppercase">Group syncing...</span>
                    </motion.div>
                </div>

                {/* Flashcard — matches StudyMode style */}
                <div
                    className="w-full max-w-sm aspect-[3/4] cursor-pointer touch-none mt-4"
                    style={{ perspective: '1200px', transform: 'translateZ(0)', willChange: 'transform' }}
                    onClick={handleFlip}
                >
                    <motion.div
                        className="relative w-full h-full"
                        style={{ transformStyle: 'preserve-3d' }}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                        {/* Front — warm surface with paper grain */}
                        <div
                            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-8 overflow-hidden"
                            style={{
                                backfaceVisibility: 'hidden',
                                background: 'linear-gradient(165deg, var(--surface-color) 0%, #152d34 100%)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
                            }}
                        >
                            {/* Paper grain overlay */}
                            <div
                                className="absolute inset-0 pointer-events-none opacity-[0.015]"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
                                    backgroundSize: '128px 128px',
                                }}
                            />
                            {/* Decorative corner marks */}
                            <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-claude-border/50" />
                            <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-claude-border/50" />
                            <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-claude-border/50" />
                            <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-claude-border/50" />

                            {/* Rotated label */}
                            <span
                                className="font-mono text-[9px] uppercase tracking-[0.25em] text-botanical-sepia mb-5"
                                style={{ transform: 'rotate(-2deg)' }}
                            >
                                Question
                            </span>
                            {currentCard?.front_image && (
                                <img
                                    src={currentCard.front_image}
                                    alt="Card front"
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-[35%] max-w-full object-contain rounded-lg mb-3"
                                />
                            )}
                            <p className={`font-display font-semibold text-center leading-snug ${currentCard?.front_image ? 'text-lg' : 'text-xl'}`}>{currentCard?.front}</p>
                            {currentCard?.difficulty > 0 && (
                                <span className={`absolute top-4 right-4 text-[9px] font-mono px-2 py-0.5 rounded-full ${currentCard.difficulty >= 4 ? 'bg-red-500/15 text-red-400' :
                                    currentCard.difficulty >= 2 ? 'bg-yellow-500/15 text-yellow-400' :
                                        'bg-green-500/15 text-green-400'
                                    }`}>
                                    {currentCard.difficulty >= 4 ? 'Hard' : currentCard.difficulty >= 2 ? 'Medium' : 'Easy'}
                                </span>
                            )}
                            <span className="absolute bottom-5 text-[10px] font-mono text-claude-secondary/50 tracking-wide">tap to reveal</span>
                        </div>

                        {/* Back — forest green with dramatic shadow */}
                        <div
                            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-8 overflow-hidden"
                            style={{
                                backfaceVisibility: 'hidden',
                                transform: 'rotateY(180deg)',
                                background: 'linear-gradient(165deg, var(--botanical-forest) 0%, #2d5a3e 100%)',
                                border: '1px solid rgba(122,158,114,0.25)',
                                boxShadow: '0 8px 32px rgba(34,83,96,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                            }}
                        >
                            {/* Paper grain overlay */}
                            <div
                                className="absolute inset-0 pointer-events-none opacity-[0.02]"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
                                    backgroundSize: '128px 128px',
                                }}
                            />
                            {/* Decorative corner marks */}
                            <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white/10" />
                            <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white/10" />
                            <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white/10" />
                            <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white/10" />

                            <span
                                className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40 mb-5"
                                style={{ transform: 'rotate(-2deg)' }}
                            >
                                Answer
                            </span>
                            {currentCard?.back_image && (
                                <img
                                    src={currentCard.back_image}
                                    alt="Card back"
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-[35%] max-w-full object-contain rounded-lg mb-3"
                                />
                            )}
                            <p className={`font-display font-semibold text-white text-center leading-snug ${currentCard?.back_image ? 'text-lg' : 'text-xl'}`}>{currentCard?.back}</p>
                            <span className="absolute bottom-5 text-[10px] font-mono text-white/30 tracking-wide">tap to flip back</span>
                        </div>
                    </motion.div>
                </div>

                {/* Response Controls (Glassmorphism) */}
                <div className="w-full max-w-sm mt-12 h-20">
                    <AnimatePresence>
                        {isFlipped && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                                className="flex items-center gap-4"
                            >
                                <button
                                    onClick={() => handleAnswer(false)}
                                    className="flex-1 h-14 rounded-[1.25rem] glass-panel border border-red-500/20 text-red-400 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-widest font-bold active:scale-[0.98] transition-all hover:bg-red-500/10 tap-action backdrop-blur-md"
                                >
                                    <ThumbsDown className="w-4 h-4 mb-0.5" /> Forgot
                                </button>
                                <button
                                    onClick={() => handleAnswer(true)}
                                    className="flex-1 h-14 rounded-[1.25rem] bg-claude-accent text-botanical-ink flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-widest font-bold active:scale-[0.98] transition-all hover:bg-opacity-90 shadow-[0_0_20px_rgba(222,185,106,0.3)] tap-action"
                                >
                                    <ThumbsUp className="w-4 h-4 mb-0.5" /> Got It
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>

            <OutOfHeartsModal isOpen={showOutOfHearts} onClose={() => setShowOutOfHearts(false)} onPractice={async () => {
                try {
                    const result = await api.practiceRefill();
                    setHeartsStatus(result);
                    setShowOutOfHearts(false);
                } catch {
                    setShowOutOfHearts(false);
                    navigate(`/groups/${groupId}`);
                }
            }} onEnd={() => {
                setShowOutOfHearts(false);
                navigate(`/groups/${groupId}`);
            }} />
        </div>
    );
}
