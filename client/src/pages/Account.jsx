import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import LoginForm from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';
import ProfileView from '../components/auth/ProfileView';
import TwoFAChallenge from '../components/auth/TwoFAChallenge';

// Simple orchestrator component
// No complex logic, just state switching
export default function Account() {
    const { isLoggedIn, loading } = useAuth();
    const [authView, setAuthView] = useState('login'); // 'login', 'signup', or '2fa'
    const [tempToken, setTempToken] = useState(null);

    // Reset view when auth state changes
    useEffect(() => {
        if (isLoggedIn) {
            setTimeout(() => {
                setAuthView('profile'); // Not strictly needed but keeps state clean
                setTempToken(null);
            }, 0);
        } else if (!tempToken) {
            setTimeout(() => setAuthView('login'), 0);
        }
    }, [isLoggedIn, tempToken]);

    // Show loading spinner while checking session
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // If logged in, show profile
    if (isLoggedIn) {
        return <ProfileView />;
    }

    // Handle 2FA View
    if (tempToken) {
        return (
            <TwoFAChallenge
                tempToken={tempToken}
                onBack={() => setTempToken(null)}
                onLoginSuccess={() => setTempToken(null)}
            />
        );
    }

    // If logged out, show Login or Signup
    if (authView === 'signup') {
        return (
            <SignupForm
                onSwitchToLogin={() => setAuthView('login')}
                onSignupSuccess={() => {
                    // AuthContext will update isLoggedIn, triggering re-render to ProfileView
                }}
            />
        );
    }

    // Default to Login
    return (
        <LoginForm
            onSwitchToSignup={() => setAuthView('signup')}
            onLoginSuccess={(result) => {
                if (result?.require2FA) {
                    setTempToken(result.tempToken);
                }
            }}
        />
    );
}
