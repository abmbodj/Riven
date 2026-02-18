import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import LoginForm from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';
import ProfileView from '../components/auth/ProfileView';

// Simple orchestrator component
// No complex logic, just state switching
export default function Account() {
    const { isLoggedIn, loading } = useAuth();
    const [authView, setAuthView] = useState('login'); // 'login' or 'signup'

    // Reset view when auth state changes
    useEffect(() => {
        if (isLoggedIn) {
            setAuthView('profile'); // Not strictly needed but keeps state clean
        } else {
            setAuthView('login');
        }
    }, [isLoggedIn]);

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
                // If 2FA needed, we could handle it here, 
                // but for now let's assume AuthContext updates user or we handle 2FA in LoginForm
                // (The provided LoginForm communicates success via prop, we just need to wait for context update)
            }}
        />
    );
}
