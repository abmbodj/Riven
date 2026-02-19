import React, { useState } from 'react';
import { X, Trash2, AlertOctagon, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';

export default function DeleteAccountModal({ isOpen, onClose }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { deleteAccount } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    if (!isOpen) return null;

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#e4ddd0] rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-red-500/20"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E")`,
                }}
            >
                {/* Header */}
                <div className="relative p-6 border-b border-red-500/10 bg-red-500/5">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 text-red-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-500/10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-full text-red-600">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-display text-red-900">Delete Account</h2>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleDelete} className="p-6 space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
                        <AlertOctagon className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h3 className="font-bold text-red-900 text-sm">This action is permanent</h3>
                            <p className="text-red-700 text-xs leading-relaxed">
                                All your decks, progress, streak data, and settings will be permanently erased. There is no way to recover your account.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-mono uppercase tracking-wider text-[#6b7d7f] pl-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-transparent border-b border-red-500/20 py-2 px-1 text-[#1e3840] placeholder-[#8fa6a8] focus:outline-none focus:border-red-500 transition-colors font-mono"
                            placeholder="Enter your password to confirm"
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-[#233e46]/20 text-[#6b7d7f] rounded-lg hover:bg-[#233e46]/5 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-red-500/20"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete Forever'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
