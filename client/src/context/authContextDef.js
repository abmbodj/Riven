import { createContext } from 'react';

// Status context - only changes on login/logout, NOT on profile updates
// Subscribe here when you only need isLoggedIn / loading (e.g. route guards)
export const AuthStatusContext = createContext(null);

// State context - changes when auth state changes (triggers re-renders)
export const AuthContext = createContext(null);

// Actions context - stable callbacks that never change (no re-renders)
export const AuthActionsContext = createContext(null);
