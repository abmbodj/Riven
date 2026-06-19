import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Globe, ArrowRight, ClipboardPaste, Smartphone, CheckCircle2,
    AlertTriangle, Bell, Lock, Loader2, ChevronLeft,
} from 'lucide-react';
import { useCanvasConnect } from '../../hooks/useCanvasConnect.js';
import CanvasSchoolSearch from './CanvasSchoolSearch.jsx';
import CanvasIcalGuide from './CanvasIcalGuide.jsx';
import useHaptics from '../../hooks/useHaptics.js';
import { getCanvasIcalValidationHint } from '../../schemas/forms.js';

const slideIn = { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 } };

/**
 * Orchestrates the full "OAuth-feeling" Canvas connect flow.
 *
 * On native (iOS): school search → in-app browser → auto clipboard capture.
 * On web: shows the existing manual-paste + guide experience.
 *
 * Props:
 *   onConnected  — callback when connect succeeds
 *   userEmail    — used to pre-suggest school from email domain
 *   compact      — when true, uses smaller spacing (for Classes.jsx)
 */
export default function CanvasConnectFlow({ onConnected, userEmail, compact = false }) {
    const haptics = useHaptics();
    const [manualHostInput, setManualHostInput] = useState('');

    const {
        stage,
        isNative,
        searchQuery,
        searchResults,
        searchLoading,
        selectedSchool,
        manualUrl,
        setManualUrl,
        error,
        schoolRequestSent,
        emailDomainHint,
        startFlow,
        setSearchQuery,
        selectSchool,
        applyManualHost,
        openBrowser,
        submitUrl,
        reportFeedsDisabled,
        sendSchoolRequest,
        reset,
        goToFallback,
    } = useCanvasConnect({ onConnected, userEmail });

    const validationHint = (stage === 'captured' || stage === 'fallback')
        ? getCanvasIcalValidationHint(manualUrl)
        : null;

    const gap = compact ? 'space-y-3' : 'space-y-4';

    // ── Idle: entry button ───────────────────────────────────────────────────
    if (stage === 'idle') {
        return (
            <div className={gap}>
                {isNative ? (
                    <button
                        type="button"
                        onClick={() => { haptics.medium(); startFlow(); }}
                        className="tap-action w-full h-11 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] shadow-md shadow-blue-500/20"
                    >
                        <Globe className="w-4 h-4" />
                        Connect Canvas
                    </button>
                ) : (
                    // Web: jump straight to manual paste guide
                    <button
                        type="button"
                        onClick={() => { haptics.medium(); startFlow(); }}
                        className="tap-action w-full h-11 flex items-center justify-center gap-2 bg-claude-text hover:bg-claude-accent text-claude-bg rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] shadow-md"
                    >
                        <Lock className="w-4 h-4" />
                        Connect Calendar Feed
                    </button>
                )}
            </div>
        );
    }

    return (
        <AnimatePresence mode="wait">
            {/* ── School search ─────────────────────────────────────────── */}
            {stage === 'schoolSearch' && isNative && (
                <motion.div key="schoolSearch" {...slideIn} className={gap}>
                    <div className="flex items-center gap-2 mb-1">
                        <button type="button" onClick={() => { haptics.light(); reset(); }} className="text-claude-secondary/60 hover:text-claude-secondary transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <p className="font-mono text-xs text-claude-secondary font-semibold uppercase tracking-widest">Find your school</p>
                    </div>
                    <CanvasSchoolSearch
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        results={searchResults}
                        loading={searchLoading}
                        emailDomainHint={emailDomainHint}
                        onSelectSchool={(school) => { haptics.light(); selectSchool(school); }}
                        onManualEntry={() => { haptics.light(); goToFallback(); }}
                    />
                </motion.div>
            )}

            {/* ── Manual host entry (school not listed) ─────────────────── */}
            {stage === 'schoolNotFound' && (
                <motion.div key="schoolNotFound" {...slideIn} className={gap}>
                    <div className="flex items-center gap-2 mb-1">
                        <button type="button" onClick={() => { haptics.light(); /* go back to search */ startFlow(); }} className="text-claude-secondary/60 hover:text-claude-secondary transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <p className="font-mono text-xs text-claude-secondary font-semibold uppercase tracking-widest">Enter your Canvas URL</p>
                    </div>
                    <p className="font-mono text-[11px] text-claude-secondary/70 leading-relaxed">
                        Enter your school&rsquo;s Canvas web address (e.g.&nbsp;
                        <span className="text-blue-400/90">canvas.university.edu</span>
                        &nbsp;or&nbsp;
                        <span className="text-blue-400/90">university.instructure.com</span>).
                    </p>
                    <input
                        type="url"
                        placeholder="canvas.yourschool.edu"
                        value={manualHostInput}
                        onChange={(e) => setManualHostInput(e.target.value)}
                        className="w-full rounded-xl border border-claude-secondary/20 bg-claude-bg px-4 py-3 font-mono text-sm text-claude-text placeholder-claude-secondary/40 shadow-inner focus:border-blue-400/50 focus:outline-none transition-colors"
                    />
                    <button
                        type="button"
                        disabled={!manualHostInput.trim()}
                        onClick={() => { haptics.medium(); applyManualHost(manualHostInput); }}
                        className="tap-action w-full h-11 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] shadow-md shadow-blue-500/20"
                    >
                        Continue
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </motion.div>
            )}

            {/* ── Preflight (instructions before browser) ───────────────── */}
            {stage === 'preflight' && (
                <motion.div key="preflight" {...slideIn} className={gap}>
                    <div className="flex items-center gap-2 mb-1">
                        <button type="button" onClick={() => { haptics.light(); reset(); }} className="text-claude-secondary/60 hover:text-claude-secondary transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <p className="font-mono text-xs text-claude-secondary/80">
                            {selectedSchool?.name}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-blue-400/80">3 quick steps</p>
                        <ol className="space-y-2">
                            {[
                                'Log into Canvas when it opens.',
                                'In the browser, tap ⋯ → "Request Desktop Website."',
                                'Tap Calendar → Calendar Feed (bottom-right) → Copy the link.',
                            ].map((step, i) => (
                                <li key={i} className="flex gap-3 items-start">
                                    <span className="flex-none font-mono text-[11px] font-bold text-blue-400/60 w-4">{i + 1}.</span>
                                    <span className="font-mono text-[11px] text-claude-secondary/80 leading-relaxed">{step}</span>
                                </li>
                            ))}
                        </ol>
                        <p className="font-mono text-[10px] text-claude-secondary/50 leading-relaxed">
                            Come back to Riven after copying — we&rsquo;ll detect it automatically.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { haptics.medium(); openBrowser(); }}
                        className="tap-action w-full h-11 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] shadow-md shadow-blue-500/20"
                    >
                        <Globe className="w-4 h-4" />
                        Open Canvas
                    </button>
                </motion.div>
            )}

            {/* ── Awaiting return (spinner) ──────────────────────────────── */}
            {stage === 'awaitingReturn' && (
                <motion.div key="awaiting" {...slideIn} className="flex flex-col items-center gap-3 py-4">
                    <Smartphone className="w-8 h-8 text-blue-400/60" />
                    <p className="font-mono text-xs text-claude-secondary text-center leading-relaxed">
                        Canvas is open. Copy your Calendar Feed link,<br />then return here.
                    </p>
                    <button
                        type="button"
                        onClick={() => { haptics.light(); goToFallback(); }}
                        className="font-mono text-[11px] text-claude-secondary/50 underline underline-offset-2 hover:text-claude-secondary transition-colors"
                    >
                        I&rsquo;m back — enter link manually
                    </button>
                </motion.div>
            )}

            {/* ── Captured URL (auto-fill confirmation) ─────────────────── */}
            {stage === 'captured' && (
                <motion.div key="captured" {...slideIn} className={gap}>
                    <div className="flex items-center gap-2 text-green-400/80">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <p className="font-mono text-xs font-semibold">Link detected from clipboard</p>
                    </div>
                    <input
                        type="url"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        className="w-full rounded-xl border border-green-400/30 bg-green-400/5 px-4 py-3 font-mono text-xs text-claude-text shadow-inner focus:border-blue-400/50 focus:outline-none transition-colors"
                    />
                    {error && <p className="font-mono text-xs text-red-400">{error}</p>}
                    <button
                        type="button"
                        onClick={() => { haptics.medium(); submitUrl(manualUrl); }}
                        className="tap-action w-full h-11 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] shadow-md shadow-blue-500/20"
                    >
                        <Lock className="w-4 h-4" />
                        Connect Canvas
                    </button>
                    <button
                        type="button"
                        onClick={() => { haptics.light(); reportFeedsDisabled(); }}
                        className="w-full font-mono text-[11px] text-claude-secondary/50 underline underline-offset-2 hover:text-claude-secondary transition-colors"
                    >
                        My school doesn&rsquo;t have this link
                    </button>
                </motion.div>
            )}

            {/* ── Fallback (paste + guide) ───────────────────────────────── */}
            {stage === 'fallback' && (
                <motion.div key="fallback" {...slideIn} className={gap}>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { haptics.light(); reset(); }} className="text-claude-secondary/60 hover:text-claude-secondary transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <p className="font-mono text-[11px] text-claude-secondary/70">
                            Paste your Canvas Calendar Feed link below.
                        </p>
                    </div>
                    <WebManualEntry
                        manualUrl={manualUrl}
                        setManualUrl={setManualUrl}
                        validationHint={validationHint}
                        error={error}
                        onSubmit={() => { haptics.medium(); submitUrl(manualUrl); }}
                    />
                    <button
                        type="button"
                        onClick={() => { haptics.light(); reportFeedsDisabled(); }}
                        className="w-full font-mono text-[11px] text-claude-secondary/50 underline underline-offset-2 hover:text-claude-secondary transition-colors"
                    >
                        My school doesn&rsquo;t have a Calendar Feed link
                    </button>
                </motion.div>
            )}

            {/* ── Connecting ────────────────────────────────────────────── */}
            {stage === 'connecting' && (
                <motion.div key="connecting" {...slideIn} className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <p className="font-mono text-xs text-claude-secondary">Connecting…</p>
                </motion.div>
            )}

            {/* ── Feeds disabled (demand capture) ───────────────────────── */}
            {stage === 'feedsDisabled' && (
                <motion.div key="feedsDisabled" {...slideIn} className={gap}>
                    <div className="flex items-center gap-2 text-amber-400/80">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <p className="font-mono text-xs font-semibold">Calendar Feed not available</p>
                    </div>
                    <p className="font-mono text-[11px] text-claude-secondary/70 leading-relaxed">
                        Some schools disable the read-only Calendar Feed. We can&rsquo;t connect without it — but you can let us know so we can track demand for alternative solutions.
                    </p>
                    {!schoolRequestSent ? (
                        <button
                            type="button"
                            onClick={() => { haptics.medium(); sendSchoolRequest(); }}
                            className="tap-action w-full h-11 flex items-center justify-center gap-2 border border-amber-500/20 bg-amber-500/10 text-amber-300 rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98]"
                        >
                            <Bell className="w-4 h-4" />
                            Notify me when supported
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 text-green-400/80">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <p className="font-mono text-xs">Got it — we&rsquo;ll let you know.</p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => { haptics.light(); reset(); }}
                        className="w-full font-mono text-[11px] text-claude-secondary/50 underline underline-offset-2 hover:text-claude-secondary transition-colors"
                    >
                        Go back
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ── Shared sub-component: manual paste entry ─────────────────────────────────
function WebManualEntry({ manualUrl, setManualUrl, validationHint, error, onSubmit }) {
    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <input
                    type="url"
                    placeholder="Canvas Calendar Link (Ends in .ics)"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className={`w-full rounded-xl border ${error ? 'border-red-400 bg-red-500/5' : 'border-claude-secondary/20'} bg-claude-bg px-4 py-3.5 font-mono text-sm text-claude-text placeholder-claude-secondary/40 shadow-inner focus:border-blue-400/50 focus:outline-none transition-colors`}
                />
                <CanvasIcalGuide compact validationHint={validationHint} />
            </div>
            <p className="text-[10px] font-mono text-claude-secondary/60 leading-relaxed text-center px-2">
                Riven only needs the read-only calendar feed.
            </p>
            {error && <p className="font-mono text-xs text-red-400">{error}</p>}
            <button
                type="button"
                disabled={!manualUrl.trim()}
                onClick={onSubmit}
                className="tap-action w-full h-11 flex items-center justify-center gap-2 bg-claude-text hover:bg-claude-accent disabled:opacity-50 text-claude-bg rounded-xl font-mono text-xs uppercase tracking-widest font-bold transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] shadow-md"
            >
                <ClipboardPaste className="w-4 h-4" />
                Connect Calendar Feed
            </button>
        </div>
    );
}
