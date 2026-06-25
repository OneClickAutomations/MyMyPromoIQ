/**
 * LandingPage.tsx — composes every section in order.
 * One component per section (see ./components). All copy lives in ./copy.ts.
 */
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import SocialProof from './components/SocialProof'
import Problem from './components/Problem'
import VideoSection from './components/VideoSection'
import HowItWorks from './components/HowItWorks'
import Generator from './components/Generator'
import Testimonials from './components/Testimonials'
import Pricing from './components/Pricing'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-void text-ink">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Problem />
        <VideoSection />
        <HowItWorks />
        <Generator />
        <Testimonials />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
