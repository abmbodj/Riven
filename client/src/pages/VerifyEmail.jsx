import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import * as authApi from '../api/authApi';
import { useToast } from '../hooks/useToast';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthLayout from '../components/auth/AuthLayout';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();

    const token = searchParams.get('token') || searchParams.get('token_hash');
    const [loading, setLoading] = useState(Boolean(token));
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(token ? '' : 'Invalid verification link.');

    useEffect(() => {
        if (!token) return;

        let active = true;

        const verifyEmail = async () => {
            try {
                await authApi.verifyEmail(token);
                if (!active) return;
                setSuccess(true);
                toast.success('Email verified!');
            } catch (err) {
                if (!active) return;
                setError(err?.message || 'Verification failed. The link may have expired.');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void verifyEmail();

        return () => {
            active = false;
        };
    }, [toast, token]);

    return (
        <AuthLayout
            title="Email Verification"
            subtitle=""
            showBackLink={false}
        >
            <div className="space-y-6 text-center">
                {loading ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <LoadingSpinner size="lg" />
                        <p className="text-claude-secondary text-sm">Verifying your email...</p>
                    </div>
                ) : success ? (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-botanical-forest/20 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-botanical-forest" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-display text-claude-parchment">Email Verified!</h3>
                            <p className="text-sm text-claude-secondary leading-relaxed max-w-xs mx-auto">
                                Your email has been verified. You're all set.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/account')}
                            className="w-full py-4 bg-claude-accent text-botanical-ink font-semibold rounded-lg hover:bg-[#c9a24e] active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow] font-display tracking-widest uppercase text-sm"
                        >
                            Continue
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                            <span className="text-2xl">⚠️</span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-display text-claude-parchment">Verification Failed</h3>
                            <p className="text-sm text-claude-secondary leading-relaxed max-w-xs mx-auto">
                                {error}
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/account')}
                            className="w-full py-3 border border-white/10 rounded-lg text-claude-secondary text-sm hover:bg-white/5 transition-colors"
                        >
                            Go to account
                        </button>
                    </>
                )}
            </div>
        </AuthLayout>
    );
}
