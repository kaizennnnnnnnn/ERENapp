/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://bjnnqqxjjihmsbljeayf.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbm5xcXhqamlobXNibGplYXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzU3NTEsImV4cCI6MjA5MDQ1MTc1MX0.ExFtVhRZ6_1QbfHkXXk3e2KwDy6ZQAF2rTEJvvf6sOY',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // The service worker MUST never be served from any cache layer —
        // otherwise icon/payload changes can sit on the user's phone for
        // days. Pair with updateViaCache:'none' on the registration.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
