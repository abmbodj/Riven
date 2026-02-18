import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './ThemeContext.jsx';
import { StreakProvider } from './context/StreakContext.jsx';
import { GardenProvider } from './context/GardenContext';
import { UIProvider } from './context/UIContext';

export function AppProviders({ children }) {
  return (
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
  );
}

