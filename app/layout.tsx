import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'
import { ThemeProvider } from '@/components/theme-provider'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'NexusVPN — Private by Default',
  description: 'Encrypted tunnels, zero activity logs, and a kill switch that never sleeps. NexusVPN keeps your connection private whether you\'re at home, at work, or on the road.',
  keywords: ['VPN', 'privacy', 'encryption', 'security', 'anonymous browsing'],
  authors: [{ name: 'NexusVPN' }],
  openGraph: {
    title: 'NexusVPN — Private by Default',
    description: 'Encrypted tunnels, zero activity logs, and a kill switch that never sleeps.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
