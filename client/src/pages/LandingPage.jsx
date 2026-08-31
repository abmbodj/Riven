import { Navigate } from 'react-router-dom';
import GardenLanding from '../components/ui/GardenLanding.jsx';
import { PageLoader } from '../components/ui/PageLoader.jsx';
import { useAuth } from '../hooks/useAuth.js';

export default function LandingPage() {
    const { isLoggedIn, loading } = useAuth();

    if (loading) return <PageLoader />;
    if (isLoggedIn) return <Navigate to="/dashboard" replace />;
    return <GardenLanding />;
}
