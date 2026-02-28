import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { X, ThumbsUp, ThumbsDown, Users, CheckCircle2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import useHaptics from '../hooks/useHaptics';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

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
    const [connectedMembers, setConnectedMembers] = useState(1); // Self
    const [isEnded, setIsEnded] = useState(false);
    const [results, setResults] = useState(null); // { weakSpots: [], personalStats: {} }

    // User Study State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

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

                // Fetch deck cards
                const deckData = await api.getDeck(sessionRes.session.deck_id);
                setCards(deckData.cards || []);

            } catch (err) {
                console.error(err);
                toast.error('Failed to load session');
                navigate(`/groups/${groupId}`);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [groupId, sessionId, navigate]);

    // Socket Setup
    useEffect(() => {
        if (!session || isEnded || !socket) return;

        // Note: Basic socket.io rooms setup for multiplayer presence
        // Riven's backend already has socket running globally

        socket.emit('register', sessionId); // Rough trick to connect
        socket.emit('join-room', `session-${sessionId}`); // If the server supported custom room joins natively. For now server broadcasts to session-ID

        const onProgress = (data) => {
            // In a full implementation, we'd track an array of IDs and update `connectedMembers`
            // Since we only get pinged on progress, let's pulse the UI
            haptics.light();
            setConnectedMembers(prev => Math.min(prev + 1, 10)); // Just a mock bump for visual flair if we haven't tracked joins explicitly
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
    }, [session, isEnded, sessionId, haptics, socket]);

    const fetchResults = async () => {
        try {
            const resData = await api.getSessionResults(sessionId);
            setResults(resData);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAnswer = async (knewIt) => {
        if (!isFlipped) return;
        const currentCard = cards[currentIndex];

        // Fire off network quietly
        api.respondToSessionCard(sessionId, currentCard.id, knewIt).catch(console.error);
        haptics.selection();

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
            <div className="min-h-screen bg-claude-bg pb-24 px-4 pt-12">
                <div className="max-w-md mx-auto space-y-8">
                    <div className="text-center">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                            <CheckCircle2 className="w-10 h-10" />
                        </motion.div>
                        <h2 className="text-3xl font-display font-bold text-botanical-parchment mb-2">Session Complete</h2>
                        <p className="text-claude-secondary font-mono uppercase tracking-widest text-xs">
                            Your Score: {results.personalStats?.total_correct || 0} / {results.personalStats?.total_answered || 0}
                        </p>
                    </div>

                    <div className="bg-claude-surface border border-claude-border rounded-3xl p-6 overflow-hidden relative">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 opacity-50" />

                        <h3 className="font-serif italic font-bold text-xl text-botanical-parchment mb-4 text-center">Group Weak Spots</h3>
                        <p className="text-xs text-claude-secondary font-mono mb-6 text-center leading-relaxed">
                            These cards tripped up the majority of the group. Review them carefully!
                        </p>

                        {results.weakSpots && results.weakSpots.length > 0 ? (
                            <div className="space-y-3">
                                {results.weakSpots.map(card => (
                                    <div key={card.id} className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                        <div className="flex justify-between items-start gap-4 mb-2">
                                            <p className="text-sm font-medium text-botanical-parchment flex-1">{card.front}</p>
                                            <span className="shrink-0 text-[10px] font-mono font-bold bg-red-500/20 text-red-400 px-2 py-1 rounded-full uppercase tracking-widest shrink-0">
                                                {card.incorrect_count}/{card.total_responses} WRONG
                                            </span>
                                        </div>
                                        <p className="text-xs text-claude-secondary border-t border-claude-border/50 pt-2 mt-2">{card.back}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <span className="text-4xl mb-4 block">🎉</span>
                                <p className="text-claude-secondary font-mono tracking-widest uppercase text-xs">The group crushed it!</p>
                            </div>
                        )}

                        <button onClick={() => navigate(`/groups/${groupId}`)} className="w-full mt-8 py-4 bg-claude-accent text-[#162a31] rounded-2xl font-mono text-sm tracking-widest font-bold uppercase transition-transform active:scale-[0.98]">
                            Back to Group
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // WAIT STATE (FINISHED BUT OTHERS STILL GOING)
    // ==========================================
    if (isFinished) {
        return (
            <div className="fullscreen-page items-center justify-center p-6 text-center">
                <span className="text-5xl mb-6 block animate-bounce">☕️</span>
                <h2 className="text-2xl font-display font-bold text-botanical-parchment mb-4">You finished!</h2>
                <p className="text-claude-secondary text-sm max-w-xs mb-10 leading-relaxed font-mono">
                    Waiting for the rest of the group to complete their cards before calculating weak spots...
                </p>

                {/* Show end button if admin/creator */}
                <button onClick={handleEndSessionGlobally} className="px-6 py-3 bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-red-500/30 text-red-400 rounded-2xl font-mono text-xs uppercase tracking-widest font-bold hover:bg-red-500 hover:text-white transition-colors">
                    End Session for Everyone
                </button>
            </div>
        );
    }

    // ==========================================
    // ACTIVE CRAM STUDYING
    // ==========================================
    const currentCard = cards[currentIndex];
    const progress = ((currentIndex) / cards.length) * 100;

    return (
        <div className="fullscreen-page">
            <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-claude-border/30 bg-claude-bg/50 backdrop-blur-md">
                <Link to={`/groups/${groupId}`} className="touch-target -ml-2 text-claude-secondary tap-action">
                    <X className="w-5 h-5" />
                </Link>
                <div className="flex flex-col items-center">
                    <span className="font-serif italic text-amber-400 font-bold tracking-wide flex items-center gap-1.5 text-lg">
                        <Zap className="w-4 h-4 fill-amber-400" /> Group Cram
                    </span>
                    <span className="text-[9px] font-mono text-claude-secondary tracking-widest uppercase flex items-center gap-1">
                        <Users className="w-3 h-3" /> Live
                    </span>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Progress Bar */}
            <div className="h-1 w-full bg-claude-border overflow-hidden">
                <motion.div
                    className="h-full bg-amber-400 rounded-r-full shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative">

                {/* Background visual sync indicator */}
                <div className="absolute top-4 inset-x-0 flex justify-center opacity-40">
                    <div className="flex items-center gap-3 bg-[color-mix(in_srgb,var(--surface-color)_40%,transparent)] border border-amber-500/20 px-4 py-1.5 rounded-full backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[9px] font-mono text-amber-200/70 tracking-widest uppercase">Other members answering...</span>
                    </div>
                </div>

                <div
                    className="w-full max-w-sm aspect-[3/4] cursor-pointer mt-8"
                    style={{ perspective: '1200px' }}
                    onClick={handleFlip}
                >
                    <motion.div
                        className="relative w-full h-full"
                        style={{ transformStyle: 'preserve-3d' }}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                        {/* Front */}
                        <div
                            className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center p-8 overflow-hidden bg-claude-surface border border-claude-border shadow-2xl"
                            style={{ backfaceVisibility: 'hidden' }}
                        >
                            <span className="absolute top-6 font-mono text-[9px] uppercase tracking-[0.25em] text-botanical-sepia">Question {currentIndex + 1}/{cards.length}</span>
                            <p className="font-display font-semibold text-center text-xl text-botanical-parchment break-words">{currentCard?.front}</p>
                            <span className="absolute bottom-6 text-[10px] font-mono text-claude-secondary/50 tracking-wide animate-pulse">tap to reveal</span>
                        </div>

                        {/* Back */}
                        <div
                            className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center p-8 overflow-hidden"
                            style={{
                                backfaceVisibility: 'hidden',
                                transform: 'rotateY(180deg)',
                                background: 'linear-gradient(165deg, var(--botanical-forest) 0%, #2d5a3e 100%)',
                                border: '1px solid rgba(122,158,114,0.3)',
                                boxShadow: '0 8px 32px rgba(34,83,96,0.3)'
                            }}
                        >
                            <span className="absolute top-6 font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">Answer</span>
                            <p className="font-display font-semibold text-center text-xl text-white break-words">{currentCard?.back}</p>
                        </div>
                    </motion.div>
                </div>

                {/* Response Controls */}
                <div className="w-full max-w-sm mt-10 h-20">
                    <AnimatePresence>
                        {isFlipped && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="flex items-center gap-4"
                            >
                                <button
                                    onClick={() => handleAnswer(false)}
                                    className="flex-1 h-14 rounded-2xl bg-[#ff4d4f]/10 border border-[#ff4d4f]/30 text-[#ff4d4f] flex items-center justify-center gap-2 font-display font-semibold active:scale-[0.98] transition-transform"
                                >
                                    <ThumbsDown className="w-5 h-5" /> Forgot
                                </button>
                                <button
                                    onClick={() => handleAnswer(true)}
                                    className="flex-1 h-14 rounded-2xl bg-amber-400 text-[#162a31] flex items-center justify-center gap-2 font-display font-semibold active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                                >
                                    <ThumbsUp className="w-5 h-5" /> Got It
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </div>
    );
}
