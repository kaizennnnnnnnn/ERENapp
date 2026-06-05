'use client'

import { useEffect } from 'react'

// ─── TransientErrorSilencer ────────────────────────────────────────────────
// A dropped/changed network connection makes Supabase's auth client emit a
// burst of UNHANDLED promise rejections that are alarming but harmless:
//
//   • "AbortError: Lock broken by another request with the 'steal' option"
//     — auth-js uses a Navigator Lock around the session; when a request
//       hangs (offline) a later one steals the lock to avoid a deadlock, and
//       the stolen one rejects. By design; the new request proceeds fine.
//   • "TypeError: Failed to fetch" from the background token auto-refresh and
//       onAuthStateChange — fired on the library's own timers, so the app
//       can't await/catch them. They retry automatically on reconnect.
//
// The app already handles being offline functionally (useAuth try/catches its
// own calls, data reads return {error}, everything refetches on reconnect).
// This just stops the transient rejections from surfacing as red "Uncaught"
// console errors / tripping a Next error overlay. We match ONLY the specific
// benign signatures and re-log via console.debug, so genuine, non-network
// failures still bubble up normally.
//
// Note: the browser's own "GET … net::ERR_INTERNET_DISCONNECTED" request logs
// are emitted by the network stack, not by a rejection — those are not
// suppressible from JS and are expected while offline.

const NETWORK_SIGNATURES = [
  'failed to fetch',
  'networkerror',
  'load failed',           // Safari's wording for a failed fetch
  'network changed',
  'err_network',
  'err_internet_disconnected',
]

function isBenignTransient(reason: unknown): boolean {
  if (!reason) return false
  const name = (reason as { name?: string }).name ?? ''
  const msg = String((reason as { message?: string }).message ?? reason).toLowerCase()

  // Supabase auth Navigator-Lock contention (steal / acquire timeout).
  if (name === 'AbortError' && (msg.includes('lock') || msg.includes('steal'))) return true
  if (msg.includes('navigator lockmanager') || msg.includes('acquiring an exclusive navigator')) return true

  // Transient network failures (offline / connection change).
  return NETWORK_SIGNATURES.some(sig => msg.includes(sig))
}

export default function TransientErrorSilencer() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isBenignTransient(e.reason)) {
        e.preventDefault()
        const msg = (e.reason as { message?: string })?.message ?? String(e.reason)
        console.debug('[transient]', msg)
      }
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])
  return null
}
