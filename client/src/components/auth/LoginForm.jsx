import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import LoadingSpinner from '../LoadingSpinner';
import AlertModal from '../AlertModal';
import AuthLayout from './AuthLayout';
import OAuthButtons from './OAuthButtons';

const LoginForm = ({ onSwitchToSignup, onLoginSuccess, onForgotPassword }) => {
    const { signIn } = useAuth();
    const haptics = useHaptics();
    const toast = useToast();

    const [form, setForm] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.email || !form.password) {
            setAlert({ show: true, title: 'Missing Fields', message: 'Please fill in all fields', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const result = await signIn(form.email, form.password);

            if (result?.require2FA) {
                onLoginSuccess({ require2FA: true, tempToken: result.tempToken });
            } else {
                toast.success('Welcome back.');
                haptics.success();
                if (navigator.vibrate) navigator.vibrate(50);
                onLoginSuccess({ require2FA: false });
            }
        } catch (err) {
            console.error('[LoginForm] Login Error:', err);
            haptics.error();
            const errorMessage = err?.message || 'An unexpected error occurred. Please try again.';
            setAlert({ show: true, title: 'Login Failed', message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Log in"
            subtitle="Access your knowledge sanctuary."
            showBackLink={true}
        >
            <div className="w-full">
                <OAuthButtons
                    onSuccess={onLoginSuccess}
                    onError={(err) => setAlert({ show: true, title: 'OAuth Failed', message: err.message || 'Third-party sign-in failed.', type: 'error' })}
                />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-[#8fa6a8] uppercase tracking-widest pl-1">Email or Username</label>
                    <input
                        type="text"
                        name="email"
                        id="email"
                        autoComplete="username"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-[#0d141e]/50 border border-[#2a3d46]/50 rounded-xl px-4 py-3 text-[#e4ddd0] placeholder:text-[#8fa6a8]/50 focus:border-[#deb96a]/70 focus:bg-[#131d26] focus:ring-1 focus:ring-[#deb96a]/20 outline-none transition-all duration-300"
                        placeholder="you@example.com"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-[#8fa6a8] uppercase tracking-widest pl-1">Password</label>
                    <div className="relative group">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            id="password"
                            autoComplete="current-password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            className="w-full bg-[#0d141e]/50 border border-[#2a3d46]/50 rounded-xl px-4 py-3 text-[#e4ddd0] placeholder:text-[#8fa6a8]/50 focus:border-[#deb96a]/70 focus:bg-[#131d26] focus:ring-1 focus:ring-[#deb96a]/20 outline-none transition-all duration-300"
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8fa6a8]/50 hover:text-[#deb96a] transition-colors p-2"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {onForgotPassword && (
                    <div className="flex justify-end -mt-2">
                        <button
                            type="button"
                            onClick={onForgotPassword}
                            className="text-xs font-sans text-[#8fa6a8] hover:text-[#deb96a] transition-colors"
                        >
                            Forgot password?
                        </button>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#e4ddd0] text-[#0d141e] font-serif font-bold text-lg py-3 rounded-xl hover:bg-white active:scale-[0.98] transition-all duration-200 mt-2 shadow-[0_0_20px_rgba(228,221,208,0.1)] min-h-[48px] flex items-center justify-center"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-3">
                            <LoadingSpinner size="sm" color="text-[#0d141e]" />
                            <span>Validating...</span>
                        </span>
                    ) : (
                        'Enter'
                    )}
                </button>
            </form>

            <div className="mt-4 pt-4 border-t border-[#1e3840]/60 flex flex-col items-center gap-3">
                <p className="text-sm font-sans text-[#8fa6a8] text-center">
                    A novel approach to retention.
                </p>
                <button
                    onClick={onSwitchToSignup}
                    className="w-full py-3 border border-[#deb96a]/30 rounded-xl text-[#deb96a] font-sans font-medium hover:bg-[#deb96a]/5 transition-colors active:scale-[0.98]"
                >
                    Establish an account
                </button>
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

export default LoginForm;
