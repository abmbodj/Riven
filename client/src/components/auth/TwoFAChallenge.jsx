import React, { useState } from 'react';
import { Shield, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import AuthLayout from './AuthLayout';
import AlertModal from '../AlertModal';

const TwoFAChallenge = ({ tempToken, onBack, onLoginSuccess }) => {
    const { signInWith2FA } = useAuth();
    const haptics = useHaptics();
    const toast = useToast();

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (code.length !== 6) return;

        setLoading(true);
        try {
            await signInWith2FA(tempToken, code);
            toast.success('Welcome back!');
            haptics.success();
            onLoginSuccess({ require2FA: false });
        } catch (err) {
            console.error('[TwoFAChallenge] Verification Error:', err);
            haptics.error();
            setAlert({
                show: true,
                title: 'Verification Failed',
                message: err?.message || 'Invalid 2FA code. Please try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Two-Factor Auth"
            subtitle="Enter the 6-digit code from your authenticator app."
            showBackLink={false}
        >
            <div className="flex flex-col items-center gap-6">
                <div className="p-4 bg-claude-accent/10 rounded-full text-claude-accent border border-claude-accent/20">
                    <Shield className="w-8 h-8" />
                </div>

                <form onSubmit={handleSubmit} className="w-full space-y-8">
                    <div className="space-y-2">
                        <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest text-center block">Verification Code</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full bg-black/20 border-b-2 border-white/10 py-4 text-3xl text-claude-parchment text-center tracking-[0.5em] focus:border-claude-accent/60 outline-none transition-all duration-300 font-mono"
                            placeholder="000000"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="space-y-4">
                        <button
                            type="submit"
                            disabled={loading || code.length !== 6}
                            className="w-full bg-claude-accent text-botanical-ink font-semibold py-4 rounded-lg hover:bg-[#c9a24e] active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(222,185,106,0.15)] flex items-center justify-center font-display tracking-widest uppercase text-sm disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Sign In'}
                        </button>

                        <button
                            type="button"
                            onClick={onBack}
                            className="w-full py-3 text-claude-secondary hover:text-claude-accent transition-colors flex items-center justify-center gap-2 text-sm font-mono tracking-wider"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to login
                        </button>
                    </div>
                </form>
            </div>

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

export default TwoFAChallenge;
