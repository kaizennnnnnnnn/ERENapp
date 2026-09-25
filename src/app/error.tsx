'use client'

/**
 * The root-segment error boundary. Until this file existed there was none
 * anywhere in the app.
 *
 * Why the ROOT segment and not `(app)/error.tsx`: in the App Router a
 * segment's error.tsx renders INSIDE that segment's own layout, so an
 * `(app)/error.tsx` cannot catch a throw from `(app)/layout.tsx` — and that
 * layout nests ten providers, which is exactly where a bad cached response or
 * a malformed row takes the whole tree down. This file sits above it and
 * catches those. It does not catch a throw from the ROOT layout itself; that
 * is what global-error.tsx is for.
 *
 * What this replaces: nothing. A deterministic throw in a display:standalone
 * TWA is a white screen with no address bar, no reload gesture, no console and
 * no way back. The user's only move is to kill the app from the switcher, and
 * if the throw is deterministic it happens again on the next launch.
 *
 * So GO HOME is a hard `location.assign`, not `router.push`. The router lives
 * in the React tree that just failed, and a soft navigation would re-mount the
 * same broken subtree; a document load rebuilds everything.
 */

import { useEffect, useState } from 'react'
import { usePageReady } from '@/hooks/usePageReady'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)

  // Lift the splash. It mounts in the root layout and hides on
  // `eren:app-ready` or an 8s timer, and a crashed page never dispatches it —
  // so without this the screen explaining the crash spends eight seconds
  // hidden behind a loading animation.
  usePageReady(true)

  useEffect(() => {
    // The only record this app keeps of a crash. There is no telemetry yet, so
    // on a device this goes nowhere — but it is what makes a bug reproducible
    // when it happens on a machine with devtools open.
    console.error('[eren] root boundary caught:', error)
  }, [error])

  // `digest` is the only identifier Next exposes for a Server Component throw;
  // the message itself is stripped in production. For a client throw there is
  // no digest, so fall back to the message, which IS present there.
  const id = error.digest ?? error.message?.slice(0, 80) ?? 'unknown'

  async function copy() {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard is permission-gated and throws on older WebViews. The id is
      // on screen regardless, which is the part that matters.
    }
  }

  return (
    <div style={S.screen}>
      <div style={S.scanlines} aria-hidden />

      <div style={S.panel}>
        <span style={{ ...S.rivet, top: 5, left: 5 }} aria-hidden />
        <span style={{ ...S.rivet, top: 5, right: 5 }} aria-hidden />
        <span style={{ ...S.rivet, bottom: 5, left: 5 }} aria-hidden />
        <span style={{ ...S.rivet, bottom: 5, right: 5 }} aria-hidden />

        <h1 style={S.title}>SOMETHING BROKE</h1>

        <p style={S.body}>
          Your cat is fine. This screen is not. Try again — and if it keeps
          happening, going home usually clears it.
        </p>

        <button type="button" onClick={reset} style={S.primary}>
          TRY AGAIN
        </button>

        <button
          type="button"
          onClick={() => window.location.assign('/home')}
          style={S.secondary}
        >
          GO HOME
        </button>

        <button type="button" onClick={copy} style={S.idRow} title="Copy this code">
          <span style={S.idLabel}>{copied ? 'COPIED' : 'CODE'}</span>
          <span style={S.idValue}>{id}</span>
        </button>
      </div>
    </div>
  )
}

const PIXEL = '"Press Start 2P", monospace'

const S: Record<string, React.CSSProperties> = {
  screen: {
    position: 'fixed',
    inset: 0,
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background: 'linear-gradient(180deg, #241243 0%, #140A26 55%, #0F0A1E 100%)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,0.22) 2px 3px)',
  },
  panel: {
    position: 'relative',
    width: '100%',
    maxWidth: 320,
    padding: '26px 20px 18px',
    background: 'linear-gradient(180deg, #2E1A52 0%, #1C1035 100%)',
    border: '3px solid #6D28D9',
    boxShadow: '4px 4px 0 #0B0715, 0 0 26px 2px rgba(167,139,250,0.28)',
    textAlign: 'center',
  },
  rivet: {
    position: 'absolute',
    width: 3,
    height: 3,
    background: '#F5C542',
  },
  title: {
    margin: '0 0 14px',
    fontFamily: PIXEL,
    fontSize: 10,
    lineHeight: 1.6,
    letterSpacing: 1,
    color: '#FFD9E8',
  },
  body: {
    margin: '0 0 20px',
    fontSize: 12,
    lineHeight: 1.7,
    color: '#C4B5FD',
  },
  primary: {
    display: 'block',
    width: '100%',
    padding: '11px 0',
    marginBottom: 9,
    fontFamily: PIXEL,
    fontSize: 8,
    letterSpacing: 1,
    color: '#1C1035',
    background: '#F5C542',
    border: '2px solid #0B0715',
    boxShadow: '3px 3px 0 #0B0715',
    cursor: 'pointer',
  },
  secondary: {
    display: 'block',
    width: '100%',
    padding: '11px 0',
    fontFamily: PIXEL,
    fontSize: 8,
    letterSpacing: 1,
    color: '#E9D5FF',
    background: 'transparent',
    border: '2px solid #6D28D9',
    boxShadow: '3px 3px 0 #0B0715',
    cursor: 'pointer',
  },
  idRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    width: '100%',
    marginTop: 18,
    padding: 0,
    background: 'none',
    border: 0,
    cursor: 'pointer',
  },
  idLabel: {
    fontFamily: PIXEL,
    fontSize: 5,
    letterSpacing: 1,
    color: '#F5C542',
  },
  idValue: {
    fontFamily: 'ui-monospace, Menlo, monospace',
    fontSize: 10,
    color: '#8B7BA8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 210,
  },
}
