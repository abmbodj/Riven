import { useContext, useMemo } from 'react';
import { AuthContext, AuthActionsContext, AuthStatusContext } from '../context/AuthContext';

export function useAuth() {
    const state = useContext(AuthContext);
    const actions = useContext(AuthActionsContext);
    if (!state) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    // Merge state + actions for backward compatibility
    return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

/** Lightweight hook for components that only need isLoggedIn/loading.
 *  Only re-renders on actual login/logout — not on profile updates. */
export function useAuthStatus() {
    const status = useContext(AuthStatusContext);
    if (!status) {
        throw new Error('useAuthStatus must be used within an AuthProvider');
    }
    return status;
}

export default useAuth;
