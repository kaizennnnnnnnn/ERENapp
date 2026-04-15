import { createClient } from '@supabase/supabase-js'

/**
 * Admin Supabase client with service_role key — bypasses RLS.
 * ONLY use in server-side code (API routes, cron jobs).
 * Never import this in client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local and Vercel env vars')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
