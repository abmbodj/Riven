import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './ThemeContext.jsx';
import { UIProvider } from './context/UIContext';
import { VisualBudgetRuntime } from './hooks/useVisualBudget';

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <VisualBudgetRuntime />
        <UIProvider>
          {children}
        </UIProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
