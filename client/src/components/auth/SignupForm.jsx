import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import useHaptics from '../../hooks/useHaptics';
import LoadingSpinner from '../LoadingSpinner';
import AlertModal from '../AlertModal';
import PasswordStrengthMeter from './PasswordStrengthMeter';
import AuthLayout from './AuthLayout';
import OAuthButtons from './OAuthButtons';

const SignupForm = ({ onSwitchToLogin, onSignupSuccess }) => {
    const { signUp } = useAuth();
    const haptics = useHaptics();
    const toast = useToast();

    const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'info' });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.username || !form.email || !form.password) {
            setAlert({ show: true, title: 'Missing Fields', message: 'Please fill in all fields', type: 'warning' });
            return;
        }
        if (form.username.length < 2) {
            setAlert({ show: true, title: 'Invalid Username', message: 'Username must be at least 2 characters', type: 'warning' });
            return;
        }
        if (form.password !== form.confirmPassword) {
            setAlert({ show: true, title: 'Password Mismatch', message: 'Passwords do not match', type: 'error' });
            return;
        }
        if (form.password.length < 6) {
            setAlert({ show: true, title: 'Weak Password', message: 'Password must be at least 6 characters', type: 'warning' });
            return;
        }
        if (!agreedToTerms) {
            setAlert({ show: true, title: 'Agreement Required', message: 'You must agree to the Terms of Service and Privacy Policy to create an account. We have no tolerance for objectionable content or abusive users.', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            await signUp(form.username, form.email, form.password);
            haptics.success();
            toast.success('Account created!');
            onSignupSuccess();
        } catch (err) {
            console.error('[SignupForm] Error:', err);
            haptics.error();
            const errorMessage = err?.message || 'An unexpected error occurred. Please try again.';
            setAlert({ show: true, title: 'Signup Failed', message: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Create account"
            subtitle="Create your account to get started."
            showBackLink={true}
            backLinkText="RETURN TO LOGIN"
            backLinkTo="#" // Handled by state switch in Account.jsx, but visual link style
        >
            {/* Override the link behavior for "RETURN TO LOGIN" to use the prop */}
            <div className="absolute top-6 left-6 md:hidden">
                {/* This absolute positioning mimics the mobile layout in original Account.jsx */}
            </div>

            <div className="w-full">
                <OAuthButtons
                    onSuccess={onSignupSuccess}
                    onError={(err) => setAlert({ show: true, title: 'OAuth Failed', message: err.message || 'Third-party sign-in failed.', type: 'error' })}
                />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 -mt-2">
                <div className="space-y-2">
                    <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest ml-1">Username</label>
                    <input
                        type="text"
                        name="username"
                        id="username"
                        autoComplete="username"
                        value={form.username}
                        onChange={e => setForm({ ...form, username: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-4 text-base text-claude-parchment placeholder:text-white/20 focus:border-claude-accent/60 focus:bg-black/30 outline-none transition-all duration-300"
                        placeholder="your_username"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest ml-1">Email</label>
                    <input
                        type="email"
                        name="email"
                        id="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-4 text-base text-claude-parchment placeholder:text-white/20 focus:border-claude-accent/60 focus:bg-black/30 outline-none transition-all duration-300"
                        placeholder="you@example.com"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest ml-1">Password</label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            id="password"
                            autoComplete="new-password"
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
                    <PasswordStrengthMeter password={form.password} />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-mono text-claude-accent/80 uppercase tracking-widest ml-1">Confirm Password</label>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        id="confirmPassword"
                        autoComplete="new-password"
                        value={form.confirmPassword}
                        onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-4 text-base text-claude-parchment placeholder:text-white/20 focus:border-claude-accent/60 focus:bg-black/30 outline-none transition-all duration-300"
                        placeholder="••••••••"
                    />
                </div>

                <div className="flex items-start gap-3 mt-4">
                    <input
                        type="checkbox"
                        id="terms"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-white/20 bg-black/20 text-botanical-forest focus:ring-botanical-forest focus:ring-offset-black transition-colors cursor-pointer"
                    />
                    <label htmlFor="terms" className="text-[11px] text-claude-secondary leading-relaxed cursor-pointer">
                        I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-claude-accent hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-claude-accent hover:underline">Privacy Policy</a>. By creating an account, I acknowledge that Riven has zero tolerance for objectionable content or abusive users.
                    </label>
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
