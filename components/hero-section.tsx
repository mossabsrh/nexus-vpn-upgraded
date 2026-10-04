"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"

const statusItems = [
  { label: "Tunnel", value: "WireGuard®", color: "text-emerald-400" },
  { label: "DNS", value: "Protected", color: "text-emerald-400" },
  { label: "IP", value: "Masked", color: "text-emerald-400" },
  { label: "Kill switch", value: "Active", color: "text-emerald-400" },
]

function VPNDashboard() {
  const [dataIn, setDataIn] = useState("0.0")
  const [dataOut, setDataOut] = useState("0.0")
  const [sessionTime, setSessionTime] = useState(0)
  const [dots, setDots] = useState(["●", "○", "○"])

  useEffect(() => {
    // Simulate realistic-looking incoming/outgoing data
    const interval = setInterval(() => {
      setDataIn(prev => {
        const n = parseFloat(prev) + Math.random() * 0.4 + 0.1
        return n.toFixed(1)
      })
      setDataOut(prev => {
        const n = parseFloat(prev) + Math.random() * 0.15 + 0.02
        return n.toFixed(2)
      })
      setSessionTime(t => t + 1)
    }, 1000)

    const dotInterval = setInterval(() => {
      setDots(d => {
        const idx = d.indexOf("●")
        const next = (idx + 1) % 3
        return d.map((_, i) => (i === next ? "●" : "○"))
      })
    }, 800)

    return () => { clearInterval(interval); clearInterval(dotInterval) }
  }, [])

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  }

  return (
    <div className="relative animate-float">
      {/* Main card */}
      <div className="glass-card rounded-2xl overflow-hidden glow-cyan">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 text-xs text-muted-foreground font-mono">nexus-vpn — connected</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Connection status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping-slow opacity-60" />
              </div>
              <span className="text-sm font-medium text-emerald-400">Secured</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">{formatTime(sessionTime)}</span>
          </div>

          {/* Shield visual */}
          <div className="flex items-center justify-center py-4">
            <div className="relative">
              {/* Outer ring */}
              <div className="w-28 h-28 rounded-full border border-primary/20 flex items-center justify-center">
                {/* Inner ring */}
                <div className="w-20 h-20 rounded-full border border-primary/30 bg-primary/5 flex items-center justify-center">
                  <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
                    <path
                      d="M24 4L8 12v12c0 10.77 6.88 20.85 16 23.5C33.12 44.85 40 34.77 40 24V12L24 4z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-primary"
                    />
                    <path
                      d="M17 24l5 5 9-10"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary"
                    />
                  </svg>
                </div>
              </div>
              {/* Orbiting dot */}
              <div className="absolute inset-0 flex items-center justify-center animate-orbit" style={{ animationDuration: "10s" }}>
                <div className="w-2 h-2 bg-primary rounded-full -translate-x-14 opacity-70" />
              </div>
              {/* Scan line */}
              <div className="absolute inset-0 rounded-full overflow-hidden opacity-30">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
              </div>
            </div>
          </div>

          {/* Status grid */}
          <div className="grid grid-cols-2 gap-2">
            {statusItems.map((item) => (
              <div key={item.label} className="rounded-xl bg-muted/40 p-3 border border-border/50">
                <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                <p className={`text-xs font-mono font-medium ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Traffic */}
          <div className="rounded-xl bg-muted/40 p-3 border border-border/50">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Traffic this session</span>
              <span className="font-mono text-primary animate-data-blink">{dots.join(" ")}</span>
            </div>
            <div className="flex justify-between">
              <div>
                <p className="text-xs text-muted-foreground">↓ Received</p>
                <p className="text-sm font-mono text-foreground">{dataIn} MB</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">↑ Sent</p>
                <p className="text-sm font-mono text-foreground">{dataOut} MB</p>
              </div>
            </div>
          </div>

          {/* Server row */}
          <div className="flex items-center justify-between rounded-xl bg-primary/8 border border-primary/15 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-xs">🇯🇵</div>
              <div>
                <p className="text-xs font-medium text-foreground">Tokyo · JP‑01</p>
                <p className="text-xs text-muted-foreground">12 ms</p>
              </div>
            </div>
            <button className="text-xs text-primary hover:text-primary/80 transition-colors">Switch</button>
          </div>
        </div>
      </div>

      {/* Floating badge — encryption */}
      <motion.div
        className="absolute -top-3 -right-3 glass rounded-xl px-3 py-2 glow-cyan"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-mono text-foreground">ChaCha20</span>
        </div>
      </motion.div>

      {/* Floating badge — dns */}
      <motion.div
        className="absolute -bottom-3 -left-3 glass rounded-xl px-3 py-2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, delay: 1, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-xs font-mono text-foreground">DNS encrypted</span>
        </div>
      </motion.div>
    </div>
  )
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left"
          >
            {/* Eyebrow */}
            <motion.div variants={itemVariants} className="mb-6 flex justify-center lg:justify-start">
              <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Open audit · no logs · WireGuard®
                </span>
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="mb-5 text-4xl font-bold leading-[0.98] tracking-[-0.04em] text-foreground md:text-5xl lg:text-6xl xl:text-7xl"
            >
              <span className="block">Simple privacy.</span>
              <span className="text-gradient block">Fast connections.</span>
              <span className="block text-foreground/90">No compromise.</span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              variants={itemVariants}
              className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-muted-foreground lg:mx-0 lg:text-lg"
            >
              NexusVPN keeps your traffic encrypted, hides your real IP, and routes you through a reliable global network built for speed and privacy.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={itemVariants} className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <a
                href="#pricing"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 glow-cyan"
              >
                Start free trial
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-border/80 hover:text-foreground"
              >
                See how it works
              </a>
            </motion.div>

            {/* Trust signals */}
            <motion.div
              variants={itemVariants}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 lg:justify-start"
            >
              {[
                "Zero activity logs",
                "30-day money back",
                "Independent audit",
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-primary flex-shrink-0">
                    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {item}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right — Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-sm mx-auto lg:max-w-none"
          >
            <VPNDashboard />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
