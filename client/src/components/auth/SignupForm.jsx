import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import LoadingSpinner from '../LoadingSpinner';
import AlertModal from '../AlertModal';
import AuthLayout from './AuthLayout';
import OAuthButtons from './OAuthButtons';

const SignupForm = ({ onSwitchToLogin, onSignupSuccess }) => {
    const { signUp } = useAuth();
    const haptics = useHaptics();
    const toast = useToast();

    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.username || !form.email || !form.password) {
            setAlert({ show: true, title: 'Missing Fields', message: 'All fields are required', type: 'warning' });
            return;
        }

        if (form.password.length < 6) {
            setAlert({ show: true, title: 'Weak Password', message: 'Password must be at least 6 characters long', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            await signUp(form.username, form.email, form.password);
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
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Sign up"
            subtitle="Begin your cultivation."
            showBackLink={true}
        >
            <div className="w-full">
                <OAuthButtons
                    onSuccess={onSignupSuccess}
                    onError={(err) => setAlert({ show: true, title: 'OAuth Failed', message: err.message || 'Third-party sign-up failed.', type: 'error' })}
                />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-mono text-[#8fa6a8] uppercase tracking-widest pl-1">Username</label>
                    <input
                        type="text"
                        name="username"
                        id="username"
                        autoComplete="username"
                        value={form.username}
                        onChange={e => setForm({ ...form, username: e.target.value })}
                        className="w-full bg-[#0d141e]/50 border border-[#2a3d46]/50 rounded-xl px-5 py-4 text-[#e4ddd0] placeholder:text-[#8fa6a8]/50 focus:border-[#deb96a]/70 focus:bg-[#131d26] focus:ring-1 focus:ring-[#deb96a]/20 outline-none transition-all duration-300"
                        placeholder="e.g. scholar123"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-mono text-[#8fa6a8] uppercase tracking-widest pl-1">Email</label>
                    <input
                        type="email"
                        name="email"
                        id="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-[#0d141e]/50 border border-[#2a3d46]/50 rounded-xl px-5 py-4 text-[#e4ddd0] placeholder:text-[#8fa6a8]/50 focus:border-[#deb96a]/70 focus:bg-[#131d26] focus:ring-1 focus:ring-[#deb96a]/20 outline-none transition-all duration-300"
                        placeholder="you@example.com"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-mono text-[#8fa6a8] uppercase tracking-widest pl-1">Password</label>
                    <div className="relative group">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            id="password"
                            autoComplete="new-password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            className="w-full bg-[#0d141e]/50 border border-[#2a3d46]/50 rounded-xl px-5 py-4 text-[#e4ddd0] placeholder:text-[#8fa6a8]/50 focus:border-[#deb96a]/70 focus:bg-[#131d26] focus:ring-1 focus:ring-[#deb96a]/20 outline-none transition-all duration-300"
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

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-botanical-forest text-white font-semibold py-4 rounded-lg hover:bg-opacity-90 active:scale-[0.98] transition-all duration-200 mt-6 shadow-[0_4px_20px_rgba(122,158,114,0.2)] min-h-[56px] flex items-center justify-center"
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

            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-4">
                <p className="text-sm text-claude-secondary text-center">
                    Already have an account?
                </p>
                <button
                    onClick={onSwitchToLogin}
                    className="w-full py-3 border border-claude-accent/30 rounded-lg text-claude-accent font-display tracking-wider text-xs uppercase hover:bg-claude-accent/5 transition-colors active:scale-[0.98]"
                >
                    Login
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
