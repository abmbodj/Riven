import React, { useState } from 'react';
import { X, Trash2, AlertOctagon, Loader2 } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';

export default function DeleteAccountModal({ isOpen, onClose }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { deleteAccount } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const handleDelete = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await deleteAccount(password);
            toast.success('Account deleted successfully');
            onClose();
            navigate('/');
        } catch (error) {
            toast.error(error.message || 'Failed to delete account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full sm:max-w-md bg-[#e4ddd0] rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden border-t sm:border border-red-500/20 touch-pan-y"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E")`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle for mobile */}
                        <div className="sm:hidden w-12 h-1.5 bg-red-500/10 rounded-full mx-auto mt-3 mb-1" />

                        {/* Header */}
                        <div className="relative p-6 pt-4 sm:pt-6 border-b border-red-500/10 bg-red-500/5">
                            <button
                                onClick={onClose}
                                className="absolute right-6 top-6 p-2 text-red-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-500/10 tap-action"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-100 rounded-2xl text-red-600 shadow-sm">
                                    <Trash2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-display font-bold text-red-900">Delete Account</h2>
                                    <p className="text-xs font-mono uppercase tracking-wider text-red-600/60 font-bold">Security Check</p>
                                </div>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleDelete} className="p-6 space-y-8">
                            <div className="flex items-start gap-4 p-5 bg-red-50/50 rounded-2xl border border-red-100/50 shadow-inner">
                                <AlertOctagon className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <h3 className="font-bold text-red-900 text-sm">This action is permanent</h3>
                                    <p className="text-red-700/80 text-xs leading-relaxed">
                                        All your decks, progress, streak data, and settings will be permanently erased. There is no way to recover your account.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-mono uppercase tracking-widest text-red-500/60 pl-1 font-bold">
                                    Confirm Identity
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-transparent border-b-2 border-red-500/10 py-3 px-1 text-red-950 placeholder-red-900/20 focus:outline-none focus:border-red-500 transition-all font-mono text-lg"
                                    placeholder="Enter password..."
                                    required
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading || !password}
                                    className="w-full sm:order-2 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 tap-action touch-target"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Delete Forever'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full sm:order-1 py-4 bg-white/50 border border-red-200 text-red-900/60 rounded-2xl font-bold hover:bg-white transition-colors tap-action touch-target"
                                >
                                    Cancel
                                </button>
                            </div>

                            {/* Safe area padding */}
                            <div className="h-safe-bottom sm:hidden" />
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
