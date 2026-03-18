import React, { useState, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import LoadingSpinner from '../LoadingSpinner';
import AlertModal from '../AlertModal';
import AuthLayout from './AuthLayout';
import OAuthButtons from './OAuthButtons';
import { registerSchema } from '../../schemas/auth';

const SignupForm = ({ onSwitchToLogin, onSignupSuccess }) => {
    const { signUp } = useAuth();
    const haptics = useHaptics();
    const toast = useToast();

    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });
    const [captchaToken, setCaptchaToken] = useState(null);
    const turnstileRef = useRef(null);
    const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

    const handleSubmit = async (e) => {
        e.preventDefault();

        const result = registerSchema.safeParse(form);
        if (!result.success) {
            const first = result.error.errors[0];
            setAlert({ show: true, title: 'Validation Error', message: first?.message || 'Please check your input', type: 'warning' });
            return;
        }

        if (turnstileSiteKey && !captchaToken) {
            setAlert({ show: true, title: 'Verification Required', message: 'Please complete the CAPTCHA verification.', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            await signUp(form.username, form.email, form.password, captchaToken);
            toast.success('Your sanctuary awaits.');
            haptics.success();
            if (navigator.vibrate) navigator.vibrate(50);
            onSignupSuccess();
        } catch (err) {
            console.error('[SignupForm] Signup Error:', err);
            haptics.error();

            let errorMessage = 'An unexpected error occurred. Please try again.';
            if (err.message) errorMessage = err.message;
            if (err.error) errorMessage = err.error;

            setAlert({ show: true, title: 'Registration Failed', message: errorMessage, type: 'error' });
            setCaptchaToken(null);
            turnstileRef.current?.reset();
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Sign up"
            subtitle="Create your account."
            showBackLink={true}
        >
            <div className="w-full">
                <OAuthButtons
                    onSuccess={onSignupSuccess}
                    onError={(err) => setAlert({ show: true, title: 'OAuth Failed', message: err.message || 'Third-party sign-up failed.', type: 'error' })}
                />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-[#8fa6a8] uppercase tracking-widest pl-1">Username</label>
                    <input
                        type="text"
                        name="username"
                        id="username"
                        autoComplete="username"
                        value={form.username}
                        onChange={e => setForm({ ...form, username: e.target.value })}
                        className="w-full bg-[#0d141e]/50 border border-[#2a3d46]/50 rounded-xl px-4 py-3 text-[#e4ddd0] placeholder:text-[#8fa6a8]/50 focus:border-[#deb96a]/70 focus:bg-[#131d26] focus:ring-1 focus:ring-[#deb96a]/20 outline-none transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300"
                        placeholder="e.g. scholar123"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-[#8fa6a8] uppercase tracking-widest pl-1">Email</label>
                    <input
                        type="email"
                        name="email"
                        id="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-[#0d141e]/50 border border-[#2a3d46]/50 rounded-xl px-4 py-3 text-[#e4ddd0] placeholder:text-[#8fa6a8]/50 focus:border-[#deb96a]/70 focus:bg-[#131d26] focus:ring-1 focus:ring-[#deb96a]/20 outline-none transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300"
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
                            autoComplete="new-password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            className="w-full bg-[#0d141e]/50 border border-[#2a3d46]/50 rounded-xl px-4 py-3 text-[#e4ddd0] placeholder:text-[#8fa6a8]/50 focus:border-[#deb96a]/70 focus:bg-[#131d26] focus:ring-1 focus:ring-[#deb96a]/20 outline-none transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300"
                            placeholder="At least 6 characters"
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

                {turnstileSiteKey && (
                    <div className="flex justify-center mt-2">
                        <Turnstile
                            ref={turnstileRef}
                            siteKey={turnstileSiteKey}
                            onSuccess={setCaptchaToken}
                            onExpire={() => setCaptchaToken(null)}
                            onError={() => setCaptchaToken(null)}
                            options={{ theme: 'dark', size: 'flexible' }}
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || (turnstileSiteKey && !captchaToken)}
                    className="w-full bg-[#e4ddd0] text-[#0d141e] font-serif font-bold text-lg py-3 rounded-xl hover:bg-white active:scale-[0.98] transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 mt-4 shadow-[0_0_20px_rgba(228,221,208,0.1)] min-h-[48px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <LoadingSpinner size="sm" color="text-white" />
                            <span>Creating...</span>
                        </span>
                    ) : (
                        'Create account'
                    )}
                </button>
            </form>

            <div className="mt-4 pt-4 border-t border-[#1e3840]/60 flex flex-col items-center gap-3">
                <button
                    onClick={onSwitchToLogin}
                    className="w-full py-3 border border-[#deb96a]/30 rounded-xl text-[#deb96a] font-sans font-medium hover:bg-[#deb96a]/5 transition-colors active:scale-[0.98]"
                >
                    Already have an account? Log in
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

export default SignupForm;
