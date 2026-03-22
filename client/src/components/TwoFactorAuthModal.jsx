import React, { useState, useEffect } from 'react';
import { Shield, Check, Copy, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import * as authApi from '../api/authApi';
import { useToast } from '../hooks/useToast';
import { twoFactorVerifySchema } from '../schemas/auth';
import ModalSurface from './ui/ModalSurface';

export default function TwoFactorAuthModal({ isOpen, onClose }) {
    const { user, refreshUser } = useAuth();
    const toast = useToast();

    // Modes: 'intro', 'setup', 'verify', 'disable'
    const [mode, setMode] = useState('intro');
    const [loading, setLoading] = useState(false);

    // Setup data
    const [secret, setSecret] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [setupData, setSetupData] = useState(null);
    const [verifyCode, setVerifyCode] = useState('');

    // Disable data
    const [password, setPassword] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [disableProvider, setDisableProvider] = useState('legacy');

    useEffect(() => {
        if (isOpen) {
            setMode(user?.twoFAEnabled ? 'intro' : 'intro');
            setVerifyCode('');
            setPassword('');
            setDisableCode('');
            setSetupData(null);

            if (user?.twoFAEnabled) {
                authApi.getActiveTwoFactorProvider()
                    .then(setDisableProvider)
                    .catch(() => setDisableProvider('legacy'));
            } else {
                setDisableProvider('supabase');
            }
        }
    }, [isOpen, user]);

    const startSetup = async () => {
        setLoading(true);
        try {
            const data = await authApi.setup2FA();
            setSetupData(data);
            setSecret(data.secret);
            setQrCode(data.qrCode);
            setMode('setup');
        } catch {
            toast.error('Failed to start 2FA setup');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const result = twoFactorVerifySchema.safeParse({ token: verifyCode });
        if (!result.success) {
            toast.error(result.error.errors[0]?.message || 'Invalid code');
            return;
        }
        setLoading(true);
        try {
            await authApi.verify2FA(setupData, verifyCode);
            await refreshUser();
            toast.success('2FA enabled successfully');
            onClose();
        } catch {
            toast.error('Invalid code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDisable = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (disableProvider === 'supabase') {
                await authApi.disable2FA({ provider: 'supabase', code: disableCode });
            } else {
                await authApi.disable2FA({ provider: 'legacy', password });
            }
            await refreshUser();
            toast.success('2FA disabled');
            onClose();
        } catch {
            toast.error(disableProvider === 'supabase' ? 'Invalid code. Please try again.' : 'Incorrect password');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(secret);
        toast.success('Secret copied to clipboard');
    };

    const modalDescription = mode === 'setup'
        ? 'Scan the QR code with your authenticator app, then verify the 6-digit code below.'
        : mode === 'disable'
            ? 'Disabling two-factor authentication lowers account security. Confirm before continuing.'
            : user?.twoFAEnabled
                ? 'Your account is already protected with a second verification step at login.'
                : 'Add an extra layer of protection with any TOTP app, including Google Authenticator or Authy.';

    return (
        <ModalSurface
            isOpen={isOpen}
            onClose={onClose}
            title="Two-Factor Auth"
            eyebrow="Security"
            description={modalDescription}
            size="sm"
            scrollClassName="space-y-6"
        >
            {mode === 'intro' ? (
                <div className="space-y-6 text-center">
                    <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] border ${user?.twoFAEnabled ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-claude-accent/20 bg-claude-accent/10 text-claude-accent'}`}>
                        {user?.twoFAEnabled ? <Check className="h-9 w-9" /> : <Shield className="h-9 w-9" />}
                    </div>

                    <div className="rounded-[1.5rem] border border-claude-border/70 bg-claude-surface px-5 py-6">
                        <h3 className="text-xl font-display font-semibold text-claude-text">
                            {user?.twoFAEnabled ? '2FA is Enabled' : 'Secure Your Account'}
                        </h3>
                        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-claude-secondary">
                            {user?.twoFAEnabled
                                ? 'Your account is protected with two-factor authentication. You will need a code from your authenticator app to log in.'
                                : 'Add an extra layer of security. We support Google Authenticator, Authy, and other TOTP apps.'}
                        </p>
                    </div>

                    {user?.twoFAEnabled ? (
                        <button
                            type="button"
                            onClick={() => setMode('disable')}
                            className="tap-action inline-flex min-h-[48px] w-full items-center justify-center rounded-[1.15rem] border border-red-500/30 bg-red-500/10 px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-red-300 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-red-500/15 active:scale-[0.98]"
                        >
                            Disable 2FA
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={startSetup}
                            disabled={loading}
                            className="tap-action inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[1.15rem] bg-claude-text px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-claude-accent active:scale-[0.98] disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enable 2FA'}
                        </button>
                    )}
                </div>
            ) : null}

            {mode === 'setup' ? (
                <div className="space-y-6">
                    <div className="space-y-4 text-center">
                        <div className="mx-auto inline-flex max-w-full flex-col items-center rounded-[1.75rem] border border-claude-border/70 bg-claude-surface px-5 py-5">
                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                Scan with your authenticator
                            </p>
                            <div className="relative mt-4 overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                                <img src={qrCode} alt="QR Code" className="h-48 w-48 md:mix-blend-multiply" />
                                {loading ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                                        <Loader2 className="h-6 w-6 animate-spin text-[#233e46]" />
                                    </div>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={copyToClipboard}
                                className="mt-4 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-claude-border/70 bg-claude-bg px-4 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary transition-colors hover:border-claude-accent/30 hover:text-claude-text"
                            >
                                <Copy className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{secret}</span>
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-4 rounded-[1.5rem] border border-claude-border/70 bg-claude-surface p-4 sm:p-5">
                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                Verify Code
                            </label>
                            <input
                                type="text"
                                value={verifyCode}
                                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="mt-2 w-full rounded-[1rem] border border-claude-border/70 bg-claude-bg px-4 py-3 text-center font-mono text-lg tracking-[0.45em] text-claude-text placeholder:text-claude-secondary/45 focus:border-claude-accent/35 focus:outline-none"
                                placeholder="000000"
                                required
                                maxLength={6}
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || verifyCode.length !== 6}
                            className="tap-action inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[1.15rem] bg-claude-text px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-claude-accent active:scale-[0.98] disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify & Enable'}
                        </button>
                    </form>
                </div>
            ) : null}

            {mode === 'disable' ? (
                <div className="space-y-5">
                    <div className="flex items-start gap-3 rounded-[1.5rem] border border-red-500/25 bg-red-500/10 px-4 py-4 text-sm text-red-100">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                        <p>Disabling 2FA makes your account less secure. Are you sure you want to continue?</p>
                    </div>

                    <form onSubmit={handleDisable} className="space-y-4 rounded-[1.5rem] border border-claude-border/70 bg-claude-surface p-4 sm:p-5">
                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                {disableProvider === 'supabase' ? 'Authenticator Code' : 'Confirm Password'}
                            </label>
                            <input
                                type={disableProvider === 'supabase' ? 'text' : 'password'}
                                inputMode={disableProvider === 'supabase' ? 'numeric' : undefined}
                                autoComplete={disableProvider === 'supabase' ? 'one-time-code' : 'current-password'}
                                value={disableProvider === 'supabase' ? disableCode : password}
                                onChange={(e) => {
                                    if (disableProvider === 'supabase') {
                                        setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                    } else {
                                        setPassword(e.target.value);
                                    }
                                }}
                                className="mt-2 w-full rounded-[1rem] border border-claude-border/70 bg-claude-bg px-4 py-3 text-sm text-claude-text placeholder:text-claude-secondary/45 focus:border-claude-accent/35 focus:outline-none"
                                placeholder={disableProvider === 'supabase' ? '000000' : '••••••••'}
                                required
                            />
                        </div>

                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => setMode('intro')}
                                className="tap-action inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[1.15rem] border border-claude-border/70 bg-claude-bg px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:text-claude-text active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || (disableProvider === 'supabase' ? disableCode.length !== 6 : !password)}
                                className="tap-action inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[1.15rem] bg-red-500 px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-red-400 active:scale-[0.98] disabled:opacity-60"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Disable 2FA'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </ModalSurface>
    );
}
