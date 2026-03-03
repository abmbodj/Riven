import { useContext, useMemo } from 'react';
import { AuthContext, AuthActionsContext } from '../context/AuthContext';

export function useAuth() {
    const state = useContext(AuthContext);
    const actions = useContext(AuthActionsContext);
    if (!state) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    // Merge state + actions for backward compatibility
    return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

export default useAuth;
