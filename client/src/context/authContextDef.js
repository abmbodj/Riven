import { createContext } from 'react';

// State context - changes when auth state changes (triggers re-renders)
export const AuthContext = createContext(null);

// Actions context - stable callbacks that never change (no re-renders)
export const AuthActionsContext = createContext(null);
