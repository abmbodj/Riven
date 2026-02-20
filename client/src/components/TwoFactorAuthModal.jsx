import React, { useState, useEffect } from 'react';
import { X, Shield, QrCode, Check, Copy, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import * as authApi from '../api/authApi';
import { useToast } from '../hooks/useToast';

export default function TwoFactorAuthModal({ isOpen, onClose }) {
    const { user, updateProfile } = useAuth();
    const toast = useToast();

    // Modes: 'intro', 'setup', 'verify', 'disable'
    const [mode, setMode] = useState('intro');
    const [loading, setLoading] = useState(false);

    // Setup data
    const [secret, setSecret] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [verifyCode, setVerifyCode] = useState('');

    // Disable data
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMode(user?.twoFAEnabled ? 'intro' : 'intro');
            setVerifyCode('');
            setPassword('');
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const startSetup = async () => {
        setLoading(true);
        try {
            const data = await authApi.setup2FA();
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
        setLoading(true);
        try {
            await authApi.verify2FA(verifyCode);
            await updateProfile({}); // Refresh user state
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
            await authApi.disable2FA(password);
            await updateProfile({}); // Refresh user state
            toast.success('2FA disabled');
            onClose();
        } catch {
            toast.error('Incorrect password');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(secret);
        toast.success('Secret copied to clipboard');
    };

    const Header = () => (
        <div className="relative p-6 border-b border-[#233e46]/10">
            <button
                onClick={onClose}
                className="absolute right-4 top-4 p-2 text-[#6b7d7f] hover:text-[#1e3840] transition-colors rounded-full hover:bg-[#233e46]/5"
            >
                <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
                <div className="p-2 bg-[#233e46]/5 rounded-full text-[#233e46]">
                    <Shield className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-display text-[#1e3840]">Two-Factor Auth</h2>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#e4ddd0] rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#8fa6a8]/20"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E")`,
                }}
            >
                <Header />

                <div className="p-6">
                    {/* Intro View */}
                    {mode === 'intro' && (
                        <div className="space-y-6 text-center">
                            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${user?.twoFAEnabled ? 'bg-green-100/50 text-green-700' : 'bg-[#233e46]/10 text-[#233e46]'}`}>
                                {user?.twoFAEnabled ? <Check className="w-8 h-8" /> : <Shield className="w-8 h-8" />}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-[#1e3840]">
                                    {user?.twoFAEnabled ? '2FA is Enabled' : 'Secure Your Account'}
                                </h3>
                                <p className="text-[#6b7d7f] text-sm leading-relaxed max-w-xs mx-auto">
                                    {user?.twoFAEnabled
                                        ? 'Your account is protected with two-factor authentication. You will need a code from your authenticator app to log in.'
                                        : 'Add an extra layer of security. We support Google Authenticator, Authy, and other TOTP apps.'}
                                </p>
                            </div>

                            {user?.twoFAEnabled ? (
                                <button
                                    onClick={() => setMode('disable')}
                                    className="w-full py-3 border border-red-500/30 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
                                >
                                    Disable 2FA
                                </button>
                            ) : (
                                <button
                                    onClick={startSetup}
                                    disabled={loading}
                                    className="w-full py-3 bg-[#1e3840] text-[#e4ddd0] rounded-lg font-display tracking-wide text-lg hover:bg-[#233e46] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enable 2FA'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Setup View */}
                    {mode === 'setup' && (
                        <div className="space-y-6">
                            <div className="space-y-4 text-center">
                                <p className="text-sm text-[#6b7d7f]">Scan this QR code with your authenticator app</p>
                                <div className="bg-white p-4 rounded-xl shadow-inner inline-block relative group">
                                    <img src={qrCode} alt="QR Code" className="w-48 h-48 mix-blend-multiply" />
                                    {loading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-[#233e46]" /></div>}
                                </div>

                                <button
                                    onClick={copyToClipboard}
                                    className="text-xs text-[#8fa6a8] hover:text-[#233e46] flex items-center justify-center gap-1 mx-auto transition-colors"
                                >
                                    <Copy className="w-3 h-3" />
                                    {secret}
                                </button>
                            </div>

                            <form onSubmit={handleVerify} className="space-y-4 pt-4 border-t border-[#233e46]/10">
                                <div className="space-y-1">
                                    <label className="text-xs font-mono uppercase tracking-wider text-[#6b7d7f] pl-1">
                                        Verify Code
                                    </label>
                                    <input
                                        type="text"
                                        value={verifyCode}
                                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full bg-transparent border-b border-[#233e46]/20 py-2 px-1 text-[#1e3840] placeholder-[#8fa6a8] focus:outline-none focus:border-[#deb96a] transition-colors font-mono text-center text-xl tracking-[0.5em]"
                                        placeholder="000000"
                                        required
                                        maxLength={6}
                                        autoFocus
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || verifyCode.length !== 6}
                                    className="w-full py-3 bg-[#1e3840] text-[#e4ddd0] rounded-lg font-display tracking-wide hover:bg-[#233e46] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Verify & Enable'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Disable View */}
                    {mode === 'disable' && (
                        <div className="space-y-6">
                            <div className="flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <p>Disabling 2FA makes your account less secure. Are you sure you want to continue?</p>
                            </div>

                            <form onSubmit={handleDisable} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-mono uppercase tracking-wider text-[#6b7d7f] pl-1">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-transparent border-b border-[#233e46]/20 py-2 px-1 text-[#1e3840] placeholder-[#8fa6a8] focus:outline-none focus:border-[#deb96a] transition-colors font-mono"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setMode('intro')}
                                        className="flex-1 py-3 border border-[#233e46]/20 text-[#6b7d7f] rounded-lg hover:bg-[#233e46]/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || !password}
                                        className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Disable 2FA'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
