import { createBrowserClient } from '@supabase/ssr'

// Single shared browser client. Every hook/component calls createClient(),
// and a fresh instance per call spins up its own GoTrueClient — they then
// fight over the same auth-token Web Lock, producing "lock not released" +
// "lock broken by steal" console errors. Memoizing one instance per tab
// removes the contention while keeping identical behaviour (they all share
// the same cookie/localStorage auth storage anyway).
let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
  )
  return browserClient
}
