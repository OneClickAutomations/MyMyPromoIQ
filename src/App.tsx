import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import LandingPage from './LandingPage'
import SignInPage from './pages/SignIn'
import SignUpPage from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import Studio from './pages/Studio'
import CommercialStudio from './pages/CommercialStudio'
import History from './pages/History'
import CreatorStudio from './pages/CreatorStudio'
import ProductStudio from './pages/ProductStudio'
import BrandKit from './pages/BrandKit'
import Discovery from './pages/Discovery'
import AdForge from './pages/AdForge'
import ReviewAndAdjust from './pages/ReviewAndAdjust'
import PrivacyPolicy from './pages/legal/Privacy'
import TermsOfService from './pages/legal/Terms'
import DataProcessingAgreement from './pages/legal/DPA'
import CookiePolicy from './pages/legal/Cookies'

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/studio"
        element={
          <Protected>
            <Studio />
          </Protected>
        }
      />
      <Route
        path="/studio/new"
        element={
          <Protected>
            <CommercialStudio />
          </Protected>
        }
      />
      <Route
        path="/history"
        element={
          <Protected>
            <History />
          </Protected>
        }
      />
      {/* Discovery Engine */}
      <Route
        path="/discover"
        element={
          <Protected>
            <Discovery />
          </Protected>
        }
      />
      {/* Creative Studio */}
      <Route
        path="/creators"
        element={
          <Protected>
            <CreatorStudio />
          </Protected>
        }
      />
      <Route
        path="/products"
        element={
          <Protected>
            <ProductStudio />
          </Protected>
        }
      />
      <Route
        path="/brand"
        element={
          <Protected>
            <BrandKit />
          </Protected>
        }
      />
      {/* Ad Forge */}
      <Route
        path="/forge"
        element={
          <Protected>
            <AdForge />
          </Protected>
        }
      />
      <Route
        path="/forge/review"
        element={
          <Protected>
            <ReviewAndAdjust />
          </Protected>
        }
      />
      {/* Legal pages */}
      <Route path="/legal/privacy" element={<PrivacyPolicy />} />
      <Route path="/legal/terms" element={<TermsOfService />} />
      <Route path="/legal/dpa" element={<DataProcessingAgreement />} />
      <Route path="/legal/cookies" element={<CookiePolicy />} />
      {/* Catch-all → landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
