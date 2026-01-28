import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { ThemeProvider } from './ThemeContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { StreakProvider } from './context/StreakContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <StreakProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StreakProvider>
    </ThemeProvider>
  </StrictMode>,
)
