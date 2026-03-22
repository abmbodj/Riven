import React, { useState } from 'react';
import { Lock, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { changePasswordSchema } from '../schemas/auth';
import ModalSurface from './ui/ModalSurface';

export default function ChangePasswordModal({ isOpen, onClose }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { changePassword } = useAuth();
    const toast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = changePasswordSchema.safeParse({ currentPassword, newPassword });
        if (!result.success) {
            toast.error(result.error.errors[0]?.message || 'Please check your input');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            toast.success('Password updated successfully');
            onClose();
            // Reset form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalSurface
            isOpen={isOpen}
            onClose={onClose}
            title="Change Password"
            eyebrow="Security"
            description="Confirm your current password, then choose a new one for your account."
            size="sm"
            scrollClassName="space-y-6"
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-[1.5rem] border border-claude-border/70 bg-claude-surface p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-claude-accent/20 bg-claude-accent/10 text-claude-accent">
                            <Lock className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                Password update
                            </p>
                            <p className="text-sm text-claude-secondary">
                                New passwords must be at least 8 characters long.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="mt-2 w-full rounded-[1rem] border border-claude-border/70 bg-claude-bg px-4 py-3 text-sm text-claude-text placeholder:text-claude-secondary/45 focus:border-claude-accent/35 focus:outline-none"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-2 w-full rounded-[1rem] border border-claude-border/70 bg-claude-bg px-4 py-3 text-sm text-claude-text placeholder:text-claude-secondary/45 focus:border-claude-accent/35 focus:outline-none"
                                placeholder="••••••••"
                                required
                                minLength={8}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-2 w-full rounded-[1rem] border border-claude-border/70 bg-claude-bg px-4 py-3 text-sm text-claude-text placeholder:text-claude-secondary/45 focus:border-claude-accent/35 focus:outline-none"
                                placeholder="••••••••"
                                required
                                minLength={8}
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="tap-action inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[1.15rem] bg-claude-text px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-claude-accent active:scale-[0.98] disabled:opacity-60"
                >
                    {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            <span>Update Password</span>
                        </>
                    )}
                </button>
            </form>
        </ModalSurface>
    );
}
