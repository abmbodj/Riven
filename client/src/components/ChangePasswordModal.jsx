import React, { useState } from 'react';
import { X, Lock, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

export default function ChangePasswordModal({ isOpen, onClose }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { changePassword } = useAuth();
    const toast = useToast();

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#e4ddd0] rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#8fa6a8]/20"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E")`,
                }}
            >
                {/* Header */}
                <div className="relative p-6 border-b border-[#233e46]/10">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 text-[#6b7d7f] hover:text-[#1e3840] transition-colors rounded-full hover:bg-[#233e46]/5"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#233e46]/5 rounded-full text-[#233e46]">
                            <Lock className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-display text-[#1e3840]">Change Password</h2>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-mono uppercase tracking-wider text-[#6b7d7f] pl-1">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full bg-transparent border-b border-[#233e46]/20 py-2 px-1 text-[#1e3840] placeholder-[#8fa6a8] focus:outline-none focus:border-[#deb96a] transition-colors font-mono"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-mono uppercase tracking-wider text-[#6b7d7f] pl-1">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-transparent border-b border-[#233e46]/20 py-2 px-1 text-[#1e3840] placeholder-[#8fa6a8] focus:outline-none focus:border-[#deb96a] transition-colors font-mono"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-mono uppercase tracking-wider text-[#6b7d7f] pl-1">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-transparent border-b border-[#233e46]/20 py-2 px-1 text-[#1e3840] placeholder-[#8fa6a8] focus:outline-none focus:border-[#deb96a] transition-colors font-mono"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-[#1e3840] text-[#e4ddd0] rounded-lg font-display tracking-wide text-lg hover:bg-[#233e46] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    <span>Update Password</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
