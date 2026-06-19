import React from 'react';
import { Archive, Network, RefreshCw, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CanvasConnectFlow from '../../canvas/CanvasConnectFlow';
import SectionHeader from '../SectionHeader';
import SectionCard from '../SectionCard';
import StatusNotice from '../StatusNotice';
import SettingItem from '../SettingItem';

const getCanvasFeedLabel = (canvasUrl) => {
    if (!canvasUrl || canvasUrl === 'Canvas Feed Active') {
        return 'Calendar Feed Connected';
    }
    try {
        const parsed = new URL(canvasUrl);
        return `${parsed.hostname}${parsed.pathname.endsWith('.ics') ? ' (.ics)' : parsed.pathname}`;
    } catch {
        return canvasUrl;
    }
};

const formatCanvasSyncTimestamp = (timestamp) => {
    if (!timestamp) {
        return 'No successful sync yet. Run a manual sync or leave auto-sync on for the next scheduled refresh.';
    }
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
        return 'Canvas sync completed recently.';
    }
    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

export default function IntegrationsSection({
    isPremium,
    lmsStatus,
    canvasNotice,
    onConnected,
    userEmail,
    onDisconnectCanvas,
    onSyncCanvas,
    onToggleAutoSync,
    onOpenSemesterCleanup,
    openModal,
    haptics,
}) {
    const canvasCardState = !isPremium
        ? 'locked'
        : lmsStatus.loading
            ? 'loading'
            : lmsStatus.isConnected
                ? 'connected'
                : 'ready';

    return (
        <div>
            <SectionHeader
                eyebrow="Workspace"
                title="Integrations"
                description="Connect external systems that keep your classes and assignments in sync."
                tone="info"
            />
            <SectionCard tone="info" className="flex flex-col space-y-5 p-5 sm:p-6 xl:p-5">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="p-3 rounded-2xl bg-blue-400/10 border border-blue-400/20 shadow-inner">
                        <Network className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg tracking-wide text-claude-text font-semibold">Canvas Sync</h3>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest font-bold border ${
                                canvasCardState === 'locked'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : canvasCardState === 'connected'
                                        ? 'bg-claude-accent/10 text-claude-accent border-claude-accent/20'
                                        : canvasCardState === 'loading'
                                            ? 'bg-claude-bg/20 text-claude-secondary border-claude-border'
                                            : 'bg-blue-400/10 text-blue-400 border-blue-400/20'
                            }`}>
                                {canvasCardState === 'locked'
                                    ? 'PRO'
                                    : canvasCardState === 'connected'
                                        ? 'CONNECTED'
                                        : canvasCardState === 'loading'
                                            ? 'LOADING'
                                            : 'READY'}
                            </span>
                        </div>
                        <p className="text-[11px] font-mono text-claude-secondary mt-0.5">
                            {canvasCardState === 'locked'
                                ? 'Premium automation for courses and assignments'
                                : canvasCardState === 'loading'
                                    ? 'Checking your Canvas connection'
                                    : canvasCardState === 'connected'
                                        ? 'Connected via Calendar Feed with optional 12-hour auto-sync'
                                        : 'Paste your Canvas feed to import courses and assignments'}
                        </p>
                    </div>
                </div>

                {canvasCardState === 'locked' ? (
                    <div className="pt-2">
                        <p className="text-[11px] font-mono text-claude-secondary/70 leading-relaxed mb-4">
                            Automatically import your courses and assignments from Canvas. Upgrade to unlock this integration.
                        </p>
                        <button
                            onClick={() => { haptics.medium(); openModal('pricing'); }}
                            className="tap-action w-full rounded-[1.1rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-amber-300 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-amber-500/15 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Crown className="w-4 h-4" />
                            Upgrade to Connect Canvas
                        </button>
                    </div>
                ) : canvasCardState === 'loading' ? (
                    <div className="pt-2 space-y-3" aria-label="Canvas status loading">
                        <div className="h-12 rounded-xl bg-claude-bg/20 border border-claude-border animate-pulse" />
                        <div className="h-24 rounded-2xl bg-claude-bg/15 border border-claude-border animate-pulse" />
                    </div>
                ) : (
                    <div>
                        <AnimatePresence mode="wait">
                            {canvasCardState === 'ready' ? (
                                <motion.div
                                    key="connect"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-4 pt-2"
                                >
                                    <CanvasConnectFlow
                                        onConnected={onConnected}
                                        userEmail={userEmail}
                                    />
                                    {canvasNotice && (
                                        <StatusNotice
                                            tone={canvasNotice.tone}
                                            title={canvasNotice.title}
                                            detail={canvasNotice.detail}
                                        />
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="connected"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="pt-4 flex flex-col gap-3"
                                >
                                    <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-3">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent">Canvas feed active</p>
                                        <p className="mt-1 text-[11px] font-mono text-claude-secondary/80">
                                            {getCanvasFeedLabel(lmsStatus.canvasUrl)}
                                        </p>
                                    </div>
                                    <StatusNotice
                                        title="Sync cadence"
                                        detail={lmsStatus.autoSyncEnabled
                                            ? 'Riven checks your connected Canvas feed about every 12 hours. Manual sync is still available any time.'
                                            : 'Auto-sync is currently off. Use manual sync whenever you want to pull Canvas changes in.'}
                                    />
                                    <div className="overflow-hidden rounded-[1.2rem] border border-claude-border/70 bg-claude-bg/35">
                                        <SettingItem
                                            icon={RefreshCw}
                                            title="Auto-sync every 12 hours"
                                            description={lmsStatus.savingAutoSync
                                                ? 'Saving Canvas preference'
                                                : (lmsStatus.autoSyncEnabled
                                                    ? 'Background refresh is active for this Canvas feed'
                                                    : 'Manual sync only until you turn auto-sync back on')}
                                            badge={lmsStatus.autoSyncEnabled ? 'On' : 'Off'}
                                            toggle={true}
                                            toggleValue={lmsStatus.autoSyncEnabled}
                                            onClick={onToggleAutoSync}
                                            disabled={lmsStatus.savingAutoSync}
                                            noBorder={true}
                                        />
                                    </div>
                                    <StatusNotice
                                        title={lmsStatus.lastSyncAt ? 'Last successful sync' : 'Sync status'}
                                        detail={formatCanvasSyncTimestamp(lmsStatus.lastSyncAt)}
                                    />
                                    {lmsStatus.lastAutoSyncError && (
                                        <StatusNotice
                                            tone="error"
                                            title="Last auto-sync issue"
                                            detail={lmsStatus.lastAutoSyncError}
                                        />
                                    )}
                                    {canvasNotice && (
                                        <StatusNotice
                                            tone={canvasNotice.tone}
                                            title={canvasNotice.title}
                                            detail={canvasNotice.detail}
                                        />
                                    )}
                                    <button
                                        onClick={onSyncCanvas}
                                        disabled={lmsStatus.syncing}
                                        className="tap-action w-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-70 font-mono text-[10px] uppercase tracking-[0.2em] py-3.5 rounded-[1.1rem] transition-[transform,opacity,color,background-color,border-color,box-shadow] font-bold flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-blue-500/20"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${lmsStatus.syncing ? 'animate-spin' : ''}`} />
                                        {lmsStatus.syncing ? 'Syncing Courses...' : 'Sync Canvas Now'}
                                    </button>

                                    <button
                                        onClick={onOpenSemesterCleanup}
                                        className="tap-action w-full border border-claude-accent/25 bg-claude-accent/10 text-claude-accent font-mono text-[10px] uppercase tracking-[0.2em] py-3 rounded-[1.1rem] transition-[transform,opacity,color,background-color,border-color,box-shadow] font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
                                    >
                                        <Archive className="w-4 h-4" />
                                        End Semester
                                    </button>

                                    <button
                                        onClick={onDisconnectCanvas}
                                        className="tap-action w-full bg-claude-bg border border-claude-secondary/10 text-claude-secondary/80 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 font-mono text-[10px] uppercase tracking-[0.2em] py-3 rounded-[1.1rem] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98]"
                                    >
                                        Disconnect Integration
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
