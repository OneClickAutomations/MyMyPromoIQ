import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import SetupNotice from './pages/SetupNotice'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

// A real, configured key looks like `pk_test_…` / `pk_live_…` and isn't the
// placeholder shipped in .env.example. If it's missing or unconfigured, show a
// friendly setup screen instead of crashing to a blank page.
const isConfigured =
  !!PUBLISHABLE_KEY &&
  /^pk_(test|live)_/.test(PUBLISHABLE_KEY) &&
  !PUBLISHABLE_KEY.includes('REPLACE_ME')

const root = createRoot(document.getElementById('root')!)

if (!isConfigured) {
  root.render(
    <StrictMode>
      <SetupNotice />
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY!}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </StrictMode>,
  )
}
