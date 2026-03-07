import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './ThemeContext.jsx';
import { StreakProvider } from './context/StreakContext.jsx';
import { GardenProvider } from './context/GardenContext';
import { UIProvider } from './context/UIContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PLACEHOLDER_GOOGLE_CLIENT_ID';

export function AppProviders({ children }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ThemeProvider>
          <StreakProvider>
            <GardenProvider>
              <UIProvider>
                {children}
              </UIProvider>
            </GardenProvider>
          </StreakProvider>
        </ThemeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

