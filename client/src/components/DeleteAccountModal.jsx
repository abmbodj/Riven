import React, { useState } from 'react';
import { Trash2, AlertOctagon, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import ModalSurface from './ui/ModalSurface';

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
        <ModalSurface
            isOpen={isOpen}
            onClose={onClose}
            title="Delete Account"
            eyebrow="Security Check"
            description="This permanently removes your decks, progress, streaks, and settings from Riven."
            tone="danger"
            size="sm"
            scrollClassName="space-y-6"
        >
            <form onSubmit={handleDelete} className="space-y-5">
                <div className="rounded-[1.5rem] border border-red-500/22 bg-red-500/10 p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/12 text-red-200">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-red-100">
                                Permanent deletion
                            </h3>
                            <p className="text-sm leading-relaxed text-red-50/80">
                                All your decks, progress, streak data, and settings will be permanently erased. There is no way to recover your account.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-[1.5rem] border border-red-500/18 bg-black/15 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                        <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                        <div className="min-w-0 flex-1">
                            <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-red-100/70">
                                Confirm Identity
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-3 w-full rounded-[1rem] border border-red-500/18 bg-black/20 px-4 py-3 text-sm text-red-50 placeholder:text-red-100/25 focus:border-red-400/45 focus:outline-none"
                                placeholder="Enter password..."
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={onClose}
                        className="tap-action inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[1.15rem] border border-red-500/18 bg-red-500/8 px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-red-100/75 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-red-400/32 hover:text-red-50 active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="tap-action inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[1.15rem] bg-red-500 px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-red-400 active:scale-[0.98] disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Delete Forever'}
                    </button>
                </div>
            </form>
        </ModalSurface>
    );
}
