import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Send, MessageSquare, Megaphone, Power } from 'lucide-react';

const MSG_TYPE_COLORS = {
    info: { bg: 'bg-botanical-sepia/15', text: 'text-botanical-sepia', dot: 'bg-botanical-sepia', border: 'border-botanical-sepia/25' },
    success: { bg: 'bg-botanical-forest/15', text: 'text-botanical-forest', dot: 'bg-botanical-forest', border: 'border-botanical-forest/25' },
    warning: { bg: 'bg-claude-accent/15', text: 'text-claude-accent', dot: 'bg-claude-accent', border: 'border-claude-accent/25' },
    error: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400', border: 'border-red-500/25' }
};

export default function BroadcastsTab({ messages, form, setForm, showForm, setShowForm, onSubmit, onToggle, onDelete, loading, haptics }) {
    return (
        <div className="space-y-5">
            {/* Create Button */}
            {!showForm && (
                <button
                    onClick={() => {
                        haptics.light();
                        setShowForm(true);
                    }}
                    className="group relative w-full py-5 rounded-2xl border border-dashed border-claude-border/60 text-claude-secondary hover:text-claude-accent hover:border-claude-accent/40 active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 flex items-center justify-center gap-2.5 touch-target tap-action overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-claude-bg/20 to-claude-bg/60 pointer-events-none" />
                    <div className="absolute -right-20 -top-20 w-40 h-40 bg-claude-accent/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-claude-accent/10 transition-colors duration-500" />
                    <div className="relative z-10 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-claude-accent/10 border border-claude-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Plus className="w-4 h-4 text-claude-accent" />
                        </div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest">New Broadcast</span>
                    </div>
                </button>
            )}

            {/* Create Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="rounded-2xl glass-panel border border-claude-border overflow-hidden"
                        onSubmit={onSubmit}
                    >
                        <div className="p-4 border-b border-claude-border/30 flex justify-between items-center">
                            <h3 className="text-sm font-serif italic text-claude-text">Compose Message</h3>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="p-2 rounded-lg text-claude-secondary hover:text-claude-text hover:bg-claude-surface/40 transition-colors touch-target tap-action"
                                aria-label="Close form"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-[9px] text-claude-secondary mb-2.5 block uppercase tracking-[0.25em] font-mono font-bold">Type</label>
                                <div className="flex gap-2">
                                    {['info', 'success', 'warning', 'error'].map(type => {
                                        const isSelected = form.type === type;
                                        const colors = MSG_TYPE_COLORS[type];
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setForm({ ...form, type })}
                                                className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-[transform,opacity,color,background-color,border-color,box-shadow] touch-target tap-action active:scale-[0.97] ${isSelected
                                                    ? `${colors.bg} ${colors.text} ${colors.border}`
                                                    : 'border-claude-border bg-claude-bg/40 text-claude-secondary hover:bg-claude-surface/40'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="broadcast-title" className="text-[9px] text-claude-secondary mb-2 block uppercase tracking-[0.25em] font-mono font-bold">Title</label>
                                <input
                                    id="broadcast-title"
                                    type="text"
                                    placeholder="Message Title"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-claude-bg/60 border border-claude-border text-sm text-claude-text placeholder-claude-secondary/40 focus:outline-none focus:border-claude-accent/50 focus-visible:ring-2 focus-visible:ring-claude-accent/60 transition-colors"
                                />
                            </div>
                            <div>
                                <label htmlFor="broadcast-content" className="text-[9px] text-claude-secondary mb-2 block uppercase tracking-[0.25em] font-mono font-bold">Content</label>
                                <textarea
                                    id="broadcast-content"
                                    placeholder="Message content..."
                                    rows={4}
                                    value={form.content}
                                    onChange={e => setForm({ ...form, content: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-claude-bg/60 border border-claude-border text-sm text-claude-text placeholder-claude-secondary/40 focus:outline-none focus:border-claude-accent/50 focus-visible:ring-2 focus-visible:ring-claude-accent/60 transition-colors resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl bg-claude-accent text-botanical-ink font-bold text-sm transition-[transform,opacity,color,background-color,border-color,box-shadow] flex items-center justify-center gap-2 touch-target tap-action active:scale-[0.98] shadow-botanical-glow disabled:opacity-50"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-botanical-ink/30 border-t-botanical-ink rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                Send Broadcast
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Message List */}
            <div className="space-y-3">
                {messages.length === 0 ? (
                    <div className="relative overflow-hidden text-center py-16 px-6 glass-panel border-dashed border-claude-border/60 rounded-2xl">
                        <div className="absolute inset-0 bg-gradient-to-b from-claude-bg/20 to-claude-bg/60 pointer-events-none" />
                        <div className="absolute -right-20 -top-20 w-40 h-40 bg-claude-accent/5 rounded-full blur-[40px] pointer-events-none" />
                        <div className="relative z-10">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.6, type: 'spring' }}
                                className="w-16 h-16 mx-auto mb-4 glass-panel rounded-2xl flex items-center justify-center border border-claude-border transform -rotate-3"
                            >
                                <Megaphone className="w-7 h-7 text-claude-border" />
                            </motion.div>
                            <p className="text-claude-secondary text-[11px] font-mono uppercase tracking-widest">
                                No active broadcasts
                            </p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const colors = MSG_TYPE_COLORS[msg.type] || MSG_TYPE_COLORS.info;
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                className={`p-4 rounded-2xl transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 relative overflow-hidden ${msg.isActive
                                    ? 'glass-panel border border-claude-border hover:border-claude-accent/20'
                                    : 'bg-claude-surface/15 border border-claude-border/20 opacity-50'
                                }`}
                            >
                                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />

                                <div className="flex justify-between items-start mb-2.5 relative z-10">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                                        <h4 className="text-sm font-serif italic text-claude-text">{msg.title}</h4>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${colors.bg} ${colors.text}`}>
                                            {msg.type}
                                        </span>
                                    </div>
                                    <span className="text-[9px] text-claude-secondary font-mono tracking-widest uppercase shrink-0">
                                        {new Date(msg.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-xs text-claude-secondary mb-4 line-clamp-2 relative z-10 leading-relaxed">{msg.content}</p>
                                <div className="flex gap-2 justify-end relative z-10">
                                    <button
                                        onClick={() => {
                                            haptics.light();
                                            onToggle(msg.id, msg.isActive);
                                        }}
                                        className="px-3 py-2 rounded-xl text-[10px] font-bold font-mono uppercase tracking-widest bg-claude-surface/40 hover:bg-claude-surface/60 text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] touch-target tap-action active:scale-[0.97] flex items-center gap-1.5"
                                    >
                                        <Power className="w-3 h-3" />
                                        {msg.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            haptics.medium();
                                            onDelete(msg.id);
                                        }}
                                        className="px-3 py-2 rounded-xl text-[10px] font-bold font-mono uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-[transform,opacity,color,background-color,border-color,box-shadow] touch-target tap-action active:scale-[0.97]"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
