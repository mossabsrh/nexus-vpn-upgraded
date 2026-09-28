"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"

import { AuthDialog } from "./auth-dialog"
import { AccountMenu } from "./account-menu"
import { ThemeToggle } from "./theme-toggle"
import { useAuth } from "./auth-provider"

const navLinks = [
  { name: "Features", href: "#features" },
  { name: "Network", href: "#map" },
  { name: "Pricing", href: "#pricing" },
]

export function Navbar() {
  const auth = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileAuthOpen, setIsMobileAuthOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("")

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40)
      const sections = ["features", "map", "pricing"]
      for (const id of sections) {
        const el = document.getElementById(id)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 120 && rect.bottom >= 120) {
            setActiveSection(id)
            break
          }
        }
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-50 flex justify-center transition-all duration-500 ${
        isScrolled ? "px-3 py-3" : "px-3 py-5"
      }`}
    >
      <div
        className={`w-full max-w-6xl px-4 md:px-6 transition-all duration-500 ${
          isScrolled
            ? "glass rounded-2xl"
            : ""
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group" aria-label="NexusVPN home">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
                <path
                  d="M16 2L4 8v8c0 7.18 5.16 13.9 12 15.5C22.84 29.9 28 23.18 28 16V8L16 2z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-primary"
                />
                <path
                  d="M11 16l3.5 3.5L21 11"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                />
              </svg>
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-md group-hover:bg-primary/20 transition-all duration-300" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              <span className="text-foreground">Nexus</span>
              <span className="text-primary">VPN</span>
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const id = link.href.replace("#", "")
              const isActive = activeSection === id
              return (
                <a
                  key={link.name}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute inset-0 rounded-lg bg-muted"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <span className="relative">{link.name}</span>
                </a>
              )
            })}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {auth.isAuthenticated ? (
              <AccountMenu />
            ) : (
              <AuthDialog triggerText="Sign in" triggerClassName="px-3 py-2" />
            )}
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 glow-cyan"
            >
              Get started
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-foreground hover:bg-muted transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="md:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain"
            >
              <div className="pt-4 pb-2 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-sm font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ))}
                <div className="pt-3 border-t border-border mt-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <ThemeToggle />
                  </div>
                  {auth.isAuthenticated ? (
                    <div className="px-3 py-2.5">
                      <AccountMenu mobile />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        setIsMobileAuthOpen(true)
                      }}
                      className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground text-left"
                    >
                      Sign in
                    </button>
                  )}
                  <a href="#pricing" className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium text-center" onClick={() => setIsMobileMenuOpen(false)}>
                    Get started
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AuthDialog
        open={isMobileAuthOpen}
        onOpenChange={setIsMobileAuthOpen}
        hideTrigger
      />
    </motion.header>
  )
}
