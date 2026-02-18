import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageLoader } from '../ui/PageLoader';

/**
 * Protects routes from unauthorized access.
 * Redirects to /account (login page) if not authenticated.
 * Renders a loading spinner while checking auth status.
 */
export const ProtectedRoute = () => {
    const { isLoggedIn, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <PageLoader />;
    }

    if (!isLoggedIn) {
        // Redirect to login page, but save the current location they were trying to go to
        return <Navigate to="/account" state={{ from: location }} replace />;
    }

    return <Outlet />;
};
