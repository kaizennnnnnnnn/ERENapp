/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are deliberately NOT pinned
  // here. An `env` block is inlined at build time and overrides the real
  // environment, so hardcoding them meant Vercel env vars were dead config:
  // rotating the anon key had no effect and no build could be pointed at a
  // staging project without editing committed source. They now resolve from
  // the environment like every other NEXT_PUBLIC_ var.
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
