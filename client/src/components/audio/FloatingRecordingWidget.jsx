import { AnimatePresence, motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import useRecordingSession from '../../hooks/useRecordingSession.js';
import { useMobileVisualBudget } from '../../hooks/useMobileVisualBudget.js';
import { formatRecordingDuration } from '../../utils/audioRecording.js';
import WaveformBars from './WaveformBars.jsx';

export default function FloatingRecordingWidget({ hideBottomNav = false }) {
    const location = useLocation();
    const isMobile = useMobileVisualBudget();
    const recorder = useRecordingSession();

    const shouldShow = recorder.state === 'recording'
        && Boolean(recorder.activeNoteId)
        && location.pathname !== `/note/${recorder.activeNoteId}`;

    const mobileOffsetClass = hideBottomNav
        ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]'
        : 'bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]';

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.button
                    key="floating-recording-widget"
                    type="button"
                    initial={{ opacity: 0, y: 18, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    onClick={recorder.goToActiveNote}
                    aria-label={`Return to ${recorder.activeNoteTitle || 'the active note'} while recording`}
                    data-testid="floating-recording-widget"
                    className={`fixed right-4 z-50 flex items-center gap-3 overflow-hidden border border-claude-accent/20 bg-[linear-gradient(180deg,rgba(24,40,47,0.96),rgba(17,28,33,0.94))] text-claude-text shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 ${isMobile
                        ? `${mobileOffsetClass} rounded-full px-3.5 py-2.5`
                        : 'bottom-6 rounded-2xl px-4 py-3'
                        }`}
                >
                    <div className="flex items-center gap-2.5">
                        <WaveformBars compact={isMobile} />
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-claude-accent">
                            {formatRecordingDuration(recorder.duration)}
                        </span>
                    </div>

                    {!isMobile && (
                        <div className="min-w-0 text-left">
                            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-claude-secondary">
                                Recording note
                            </p>
                            <p className="max-w-[12rem] truncate text-[13px] text-claude-text">
                                {recorder.activeNoteTitle || 'Untitled'}
                            </p>
                        </div>
                    )}
                </motion.button>
            )}
        </AnimatePresence>
    );
}
