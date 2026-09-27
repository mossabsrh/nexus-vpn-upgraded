/** @type {import('next').NextConfig} */
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')

if (process.env.VERCEL && !configuredApiUrl) {
  throw new Error('Set NEXT_PUBLIC_API_URL to the deployed Laravel service URL in Vercel.')
}

const backendUrl = configuredApiUrl || 'http://127.0.0.1:8000'

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },

}

export default nextConfig
