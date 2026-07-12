import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import SetupNotice from './pages/SetupNotice'
import { AuthProvider } from './hooks/useAuth'
import { supabaseConfigured } from './lib/supabase'

const root = createRoot(document.getElementById('root')!)

// Auth + database both run on Supabase. If the client-side Supabase env vars
// aren't set (build-time VITE_), show the setup screen instead of a blank page.
if (!supabaseConfigured) {
  root.render(
    <StrictMode>
      <SetupNotice />
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </StrictMode>,
  )
}
