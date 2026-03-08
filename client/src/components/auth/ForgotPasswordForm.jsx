import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import * as authApi from '../../api/authApi';
import { useToast } from '../../hooks/useToast';
import LoadingSpinner from '../LoadingSpinner';
import AlertModal from '../AlertModal';
import AuthLayout from './AuthLayout';

const ForgotPasswordForm = ({ onBackToLogin }) => {
    const toast = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) {
            setAlert({ show: true, title: 'Missing Email', message: 'Please enter your email address', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            await authApi.forgotPassword(email);
            setSent(true);
            toast.success('Reset link sent!');
        } catch (err) {
            const errorMessage = err?.message || 'An unexpected error occurred.';
            setAlert({ show: true, title: 'Error', message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Reset password"
            subtitle={sent ? '' : 'Enter your email to receive a reset link.'}
            showBackLink={false}
        >
            {sent ? (
                <div className="space-y-6 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-botanical-forest/20 flex items-center justify-center">
                        <span className="text-2xl">📧</span>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-display text-claude-parchment">Check your email</h3>
                        <p className="text-sm text-claude-secondary leading-relaxed max-w-xs mx-auto">
                            If an account exists for <span className="text-claude-accent">{email}</span>, we've sent a link to reset your password. It expires in 1 hour.
                        </p>
                    </div>
                    <div className="space-y-3 pt-4">
                        <button
                            onClick={() => { setSent(false); setEmail(''); }}
                            className="w-full py-3 border border-white/10 rounded-lg text-claude-secondary text-sm hover:bg-white/5 transition-colors"
                        >
                            Try a different email
                        </button>
                        <button
                            onClick={onBackToLogin}
                            className="w-full py-3 bg-claude-accent text-botanical-ink font-semibold rounded-lg hover:bg-[#c9a24e] active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow] font-display tracking-widest uppercase text-sm"
                        >
                            Back to login
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest ml-1">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                id="forgot-email"
                                autoComplete="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-4 text-base text-claude-parchment placeholder:text-white/20 focus:border-claude-accent/60 focus:bg-black/30 outline-none transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300"
                                placeholder="email@example.com"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-claude-accent text-botanical-ink font-semibold py-4 rounded-lg hover:bg-[#c9a24e] active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 mt-2 shadow-[0_4px_20px_rgba(222,185,106,0.15)] min-h-[56px] flex items-center justify-center font-display tracking-widest uppercase text-sm"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <LoadingSpinner size="sm" color="text-botanical-ink" />
                                    <span>Sending...</span>
                                </span>
                            ) : (
                                'Send reset link'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5">
                        <button
                            onClick={onBackToLogin}
                            className="w-full py-3 flex items-center justify-center gap-2 text-claude-secondary text-sm hover:text-claude-accent transition-colors"
                        >
                            <ArrowLeft className="w-3 h-3" />
                            Back to login
                        </button>
                    </div>
                </>
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
};

export default ForgotPasswordForm;
