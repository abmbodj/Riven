import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import * as authApi from '../api/authApi';
import { useToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';
import AlertModal from '../components/AlertModal';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import AuthLayout from '../components/auth/AuthLayout';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();

    const token = searchParams.get('token');
    const [form, setForm] = useState({ password: '', confirmPassword: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });

    useEffect(() => {
        if (!token) {
            setAlert({ show: true, title: 'Invalid Link', message: 'This reset link is invalid. Please request a new one.', type: 'error' });
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.password || !form.confirmPassword) {
            setAlert({ show: true, title: 'Missing Fields', message: 'Please fill in both fields', type: 'warning' });
            return;
        }
        if (form.password !== form.confirmPassword) {
            setAlert({ show: true, title: 'Mismatch', message: 'Passwords do not match', type: 'error' });
            return;
        }
        if (form.password.length < 6) {
            setAlert({ show: true, title: 'Weak Password', message: 'Password must be at least 6 characters', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            await authApi.resetPassword(token, form.password);
            setSuccess(true);
            toast.success('Password reset!');
        } catch (err) {
            const errorMessage = err?.message || 'Failed to reset password.';
            setAlert({ show: true, title: 'Reset Failed', message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title={success ? 'Password Reset' : 'Choose new password'}
            subtitle={success ? '' : 'Enter your new password below.'}
            showBackLink={false}
        >
            {success ? (
                <div className="space-y-6 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-botanical-forest/20 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-botanical-forest" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-display text-claude-parchment">All set!</h3>
                        <p className="text-sm text-claude-secondary leading-relaxed max-w-xs mx-auto">
                            Your password has been reset successfully. You can now log in with your new password.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/account')}
                        className="w-full py-4 bg-claude-accent text-botanical-ink font-semibold rounded-lg hover:bg-[#c9a24e] active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow] font-display tracking-widest uppercase text-sm"
                    >
                        Go to login
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest ml-1">New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                id="new-password"
                                autoComplete="new-password"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-4 text-base text-claude-parchment placeholder:text-white/20 focus:border-claude-accent/60 focus:bg-black/30 outline-none transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300"
                                placeholder="••••••••"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-claude-accent transition-colors p-2"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <PasswordStrengthMeter password={form.password} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest ml-1">Confirm Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="confirmPassword"
                            id="confirm-new-password"
                            autoComplete="new-password"
                            value={form.confirmPassword}
                            onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-4 text-base text-claude-parchment placeholder:text-white/20 focus:border-claude-accent/60 focus:bg-black/30 outline-none transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !token}
                        className="w-full bg-claude-accent text-botanical-ink font-semibold py-4 rounded-lg hover:bg-[#c9a24e] active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 mt-4 shadow-[0_4px_20px_rgba(222,185,106,0.15)] min-h-[56px] flex items-center justify-center font-display tracking-widest uppercase text-sm disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <LoadingSpinner size="sm" color="text-botanical-ink" />
                                <span>Resetting...</span>
                            </span>
                        ) : (
                            'Reset password'
                        )}
                    </button>
                </form>
            )}

            <AlertModal
                isOpen={alert.show}
                onClose={() => setAlert({ ...alert, show: false })}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />
        </AuthLayout>
    );
}
