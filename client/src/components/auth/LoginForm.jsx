import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import LoadingSpinner from '../LoadingSpinner';
import AlertModal from '../AlertModal';
import AuthLayout from './AuthLayout';

const LoginForm = ({ onSwitchToSignup, onLoginSuccess }) => {
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

            // Check if 2FA is required
            if (result?.require2FA) {
                // Pass the tempToken to the parent to handle 2FA view switch
                onLoginSuccess({ require2FA: true, tempToken: result.tempToken });
            } else {
                toast.success('Welcome back!');
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
            title="Login"
            subtitle="Enter your credentials to access the journal."
            showBackLink={true}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest ml-1">Email</label>
                    <input
                        type="email"
                        name="email"
                        id="email"
                        autoComplete="username"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-4 text-base text-claude-parchment placeholder:text-white/20 focus:border-claude-accent/60 focus:bg-black/30 outline-none transition-all duration-300"
                        placeholder="researcher@institute.edu"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest">Password</label>
                    </div>
                    <div className="relative group">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            id="password"
                            autoComplete="current-password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-4 text-base text-claude-parchment placeholder:text-white/20 focus:border-claude-accent/60 focus:bg-black/30 outline-none transition-all duration-300"
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-claude-accent transition-colors p-2"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-claude-accent text-botanical-ink font-semibold py-4 md:py-4 rounded-lg hover:bg-[#c9a24e] active:scale-[0.98] transition-all duration-200 mt-2 shadow-[0_4px_20px_rgba(222,185,106,0.15)] min-h-[56px] flex items-center justify-center font-display tracking-widest uppercase text-sm"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <LoadingSpinner size="sm" color="text-botanical-ink" />
                            <span>Validating...</span>
                        </span>
                    ) : (
                        'Login'
                    )}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-4">
                <p className="text-sm text-claude-secondary text-center">
                    No profile recorded?
                </p>
                <button
                    onClick={onSwitchToSignup}
                    className="w-full py-3 border border-claude-accent/30 rounded-lg text-claude-accent font-display tracking-wider text-xs uppercase hover:bg-claude-accent/5 transition-colors active:scale-[0.98]"
                >
                    Create account
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
