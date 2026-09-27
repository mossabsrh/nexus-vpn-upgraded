import dynamic from "next/dynamic"
import { Navbar } from "@/components/navbar"

const HeroSection = dynamic(
  () => import("@/components/hero-section").then((mod) => mod.HeroSection),
  { loading: () => <div className="h-[520px] bg-muted/20" /> },
)
const StatsSection = dynamic(
  () => import("@/components/stats-section").then((mod) => mod.StatsSection),
  { loading: () => <div className="h-[420px] bg-muted/20" /> },
)
const FeaturesSection = dynamic(
  () => import("@/components/features-section").then((mod) => mod.FeaturesSection),
  { loading: () => <div className="h-[420px] bg-muted/20" /> },
)
const MapSection = dynamic(
  () => import("@/components/map-section").then((mod) => mod.MapSection),
  { loading: () => <div className="h-[520px] bg-muted/20" /> },
)
const TestimonialsSection = dynamic(
  () => import("@/components/testimonials-section").then((mod) => mod.TestimonialsSection),
  { loading: () => <div className="h-[420px] bg-muted/20" /> },
)
const PricingSection = dynamic(
  () => import("@/components/pricing-section").then((mod) => mod.PricingSection),
  { loading: () => <div className="h-[520px] bg-muted/20" /> },
)
const Footer = dynamic(
  () => import("@/components/footer").then((mod) => mod.Footer),
  { loading: () => <div className="h-[280px] bg-muted/20" /> },
)

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background layers */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="bg-dot absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />
        {/* Ambient orbs — very subtle */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/4 blur-[140px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-secondary/5 blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Navbar />
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <MapSection />
        <TestimonialsSection />
        <PricingSection />
        <Footer />
      </div>
    </main>
  )
}
