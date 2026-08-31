import { useEffect, useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as authApi from '../api/authApi';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthLayout from '../components/auth/AuthLayout';
import { useToast } from '../hooks/useToast';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();
    const successToastRef = useRef(toast.success);
    const token = searchParams.get('token_hash') || searchParams.get('token');
    const [state, setState] = useState(() => token
        ? { loading: true, success: false, error: '' }
        : { loading: false, success: false, error: 'Invalid verification link.' });

    useEffect(() => {
        let active = true;

        if (!token) {
            return () => { active = false; };
        }

        authApi.verifyEmail(token)
            .then(() => {
                if (!active) return;
                setState({ loading: false, success: true, error: '' });
                successToastRef.current('Email verified!');
            })
            .catch((error) => {
                if (!active) return;
                setState({
                    loading: false,
                    success: false,
                    error: error?.message || 'Verification failed. The link may have expired.',
                });
            });

        return () => { active = false; };
    }, [token]);

    return (
        <AuthLayout title="Email Verification" subtitle="" showBackLink={false}>
            <div className="space-y-6 text-center">
                {state.loading ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <LoadingSpinner size="lg" />
                        <p className="text-claude-secondary text-sm">Verifying your email...</p>
                    </div>
                ) : state.success ? (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-botanical-forest/20 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-botanical-forest" />
                        </div>
                        <h3 className="text-lg font-display text-claude-parchment">Email Verified!</h3>
                        <p className="text-sm text-claude-secondary">Your email has been verified. You're all set.</p>
                        <button type="button" onClick={() => navigate('/account')} className="w-full py-4 bg-claude-accent text-botanical-ink font-semibold rounded-lg">
                            Continue
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center" aria-hidden="true">⚠️</div>
                        <h3 className="text-lg font-display text-claude-parchment">Verification Failed</h3>
                        <p className="text-sm text-claude-secondary">{state.error}</p>
                        <button type="button" onClick={() => navigate('/account')} className="w-full py-3 border border-white/10 rounded-lg text-claude-secondary">
                            Go to account
                        </button>
                    </>
                )}
            </div>
        </AuthLayout>
    );
}
