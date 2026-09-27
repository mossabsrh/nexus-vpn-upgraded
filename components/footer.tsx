"use client"

const footerLinks = {
  Product: [
    { name: "Features", href: "#features" },
    { name: "Network", href: "#map" },
    { name: "Pricing", href: "#pricing" },
    { name: "Download", href: "#" },
    { name: "Changelog", href: "#" },
  ],
  Company: [
    { name: "About", href: "#" },
    { name: "Blog", href: "#" },
    { name: "Careers", href: "#" },
    { name: "Press kit", href: "#" },
  ],
  Support: [
    { name: "Help center", href: "#" },
    { name: "Contact", href: "#" },
    { name: "System status", href: "#" },
    { name: "Security audit", href: "#" },
  ],
  Legal: [
    { name: "Privacy policy", href: "#" },
    { name: "Terms of service", href: "#" },
    { name: "No-log policy", href: "#" },
    { name: "Cookie settings", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/80">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
                  <path d="M16 2L4 8v8c0 7.18 5.16 13.9 12 15.5C22.84 29.9 28 23.18 28 16V8L16 2z" stroke="currentColor" strokeWidth="1.5" className="text-primary"/>
                  <path d="M11 16l3.5 3.5L21 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary"/>
                </svg>
              </div>
              <span className="font-semibold tracking-tight">
                <span className="text-foreground">Nexus</span>
                <span className="text-primary">VPN</span>
              </span>
            </a>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-5">
              Encrypted tunnels, zero activity logs, and a kill switch that never sleeps.
            </p>
            {/* Social */}
            <div className="flex gap-3">
              {[
                { label: "Twitter / X", path: "M4 4l16 16M4 20L20 4" },
                { label: "GitHub", path: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" },
                { label: "LinkedIn", path: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z" },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-primary hover:glow-cyan transition-all duration-200"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                    <path d={s.path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-foreground mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.name}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-border gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} NexusVPN. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>WireGuard® is a registered trademark of Jason A. Donenfeld.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
