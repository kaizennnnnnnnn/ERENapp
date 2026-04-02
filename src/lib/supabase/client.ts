import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  console.log('[supabase] URL:', JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL))
  console.log('[supabase] KEY:', JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20)))
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
