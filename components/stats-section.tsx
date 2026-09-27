"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView } from "framer-motion"

const stats = [
  {
    value: 87,
    suffix: "+",
    unit: "countries",
    label: "Server locations",
    description: "Spread across six continents — not artificially inflated.",
  },
  {
    value: 10,
    suffix: "Gbps",
    unit: "",
    label: "Uplink per node",
    description: "Dedicated fiber, not shared hosting.",
  },
  {
    value: 99.98,
    suffix: "%",
    unit: "",
    label: "Network uptime",
    description: "Averaged over the last 12 months.",
  },
  {
    value: 0,
    suffix: "",
    unit: "logs",
    label: "Activity records",
    description: "Confirmed by third-party audit.",
    isZero: true,
  },
]

function Counter({ value, suffix, unit, isZero }: { value: number; suffix: string; unit: string; isZero?: boolean }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  useEffect(() => {
    if (!inView || isZero) return
    const duration = 1600
    const steps = 50
    const increment = value / steps
    let current = 0
    let step = 0
    const timer = setInterval(() => {
      step++
      current += increment
      if (step >= steps) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current * 100) / 100)
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [inView, value, isZero])

  const display = isZero ? "0" : value === 99.98 ? count.toFixed(2) : Math.floor(count)

  return (
    <span ref={ref} className="text-3xl md:text-4xl font-bold text-foreground tabular-nums">
      {display}
      {suffix && <span className="text-primary">{suffix}</span>}
      {unit && <span className="text-muted-foreground text-xl ml-1">{unit}</span>}
    </span>
  )
}

export function StatsSection() {
  return (
    <section className="relative py-16 md:py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent pointer-events-none" />
      <div className="container mx-auto px-4 md:px-6 max-w-6xl relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="glass-card rounded-2xl p-5 md:p-6 h-full hover:glow-cyan transition-all duration-400 group">
                <Counter
                  value={stat.value}
                  suffix={stat.suffix}
                  unit={stat.unit}
                  isZero={stat.isZero}
                />
                <p className="text-sm font-medium text-foreground mt-2 mb-1">{stat.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{stat.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
