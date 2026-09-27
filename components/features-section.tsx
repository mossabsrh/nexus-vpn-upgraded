"use client"

import { motion } from "framer-motion"

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M12 2L4 6v6c0 5.4 3.44 10.42 8 11.93C16.56 22.42 20 17.4 20 12V6L12 2z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Your activity stays yours",
    badge: "Zero-log",
    description: "We keep no connection timestamps, no IP addresses, no traffic data. Our infrastructure is architected so that we couldn't provide logs even if compelled to.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
      </svg>
    ),
    title: "End-to-end encryption",
    badge: "ChaCha20 · AES-256",
    description: "Traffic is encrypted before it leaves your device. We support WireGuard® and OpenVPN, with forward secrecy on every session.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M18.36 6.64a9 9 0 010 10.72M15.54 9.46a5 5 0 010 5.08M12 12h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M5.64 6.64a9 9 0 000 10.72M8.46 9.46a5 5 0 000 5.08" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: "Kill switch, always on",
    badge: "Network guard",
    description: "If the tunnel drops unexpectedly, network access is cut immediately — before your real IP is exposed. Works at the OS level, not app level.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 12h20" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    title: "Access without borders",
    badge: "87 countries",
    description: "Reach content that's geo-restricted where you are. Servers placed for speed, not just flag count — every node is on high-bandwidth fiber.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M3 12h1m16 0h1M12 3v1m0 16v1M5.6 5.6l.7.7m11.4-.7l-.7.7M5.6 18.4l.7-.7m11.4.7l-.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    title: "Split tunneling",
    badge: "Per-app routing",
    description: "Route your bank app through the VPN while your video calls go direct. Full control over which traffic gets encrypted — without losing either.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: "DNS leak prevention",
    badge: "Private resolver",
    description: "DNS queries are resolved inside the encrypted tunnel using our own resolver — not your ISP's. Your browsing lookups stay invisible.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/40 mb-5">
            <span className="text-xs text-primary font-medium tracking-wider uppercase">How it works</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight max-w-2xl">
            Built for privacy,{" "}
            <span className="text-gradient">not just marketed for it</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl text-lg leading-relaxed">
            Every feature exists to close a specific gap in your privacy posture. Nothing here is decorative.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="glass-card rounded-2xl p-6 h-full group hover:glow-cyan transition-all duration-400 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/15 transition-colors duration-300">
                      {feature.icon}
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground font-mono">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-foreground mb-2.5 leading-snug">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
