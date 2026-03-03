import { createContext } from 'react';

// State context - changes when user/loading/socket change (triggers re-renders)
export const AuthContext = createContext(null);

// Actions context - stable callbacks that never change (no re-renders)
export const AuthActionsContext = createContext(null);
