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
}

export default nextConfig
