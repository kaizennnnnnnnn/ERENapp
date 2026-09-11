'use client'

/**
 * The last boundary. This catches a throw from the ROOT layout itself — the
 * one place `error.tsx` cannot reach, because it renders inside that layout.
 *
 * It REPLACES the root layout when it renders, which is why it has to supply
 * its own <html> and <body>. Next.js documents that; the consequence people
 * miss is that nothing the root layout set up is guaranteed here, globals.css
 * included. So every style below is inline, the font is named with a real
 * fallback rather than a Tailwind class, and there are no imports beyond
 * React.
 *
 * That import rule is the point of the file, not fussiness. If the root layout
 * threw because a shared module threw at import time, importing that module
 * again from the handler re-throws inside the handler, and React's fallback
 * for a failed fallback is a blank document. Everything this renders is
 * self-contained.
 *
 * There is deliberately no TRY AGAIN here. `reset()` re-renders the same root
 * layout that just failed, and at this level that has usually already failed
 * twice. A document load is the only move that rebuilds enough to matter.
 */

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const id = error?.digest ?? error?.message?.slice(0, 80) ?? 'unknown'

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0F0A1E' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: 'linear-gradient(180deg, #241243 0%, #140A26 55%, #0F0A1E 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 320,
              padding: '26px 20px 18px',
              background: 'linear-gradient(180deg, #2E1A52 0%, #1C1035 100%)',
              border: '3px solid #6D28D9',
              boxShadow: '4px 4px 0 #0B0715',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                margin: '0 0 14px',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 10,
                lineHeight: 1.6,
                letterSpacing: 1,
                color: '#FFD9E8',
              }}
            >
              EREN COULD NOT START
            </h1>

            <p style={{ margin: '0 0 20px', fontSize: 12, lineHeight: 1.7, color: '#C4B5FD' }}>
              Something failed before the app could load. Reopening usually
              fixes it — nothing you have saved is affected.
            </p>

            <button
              type="button"
              onClick={() => window.location.assign('/home')}
              style={{
                display: 'block',
                width: '100%',
                padding: '11px 0',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 8,
                letterSpacing: 1,
                color: '#1C1035',
                background: '#F5C542',
                border: '2px solid #0B0715',
                boxShadow: '3px 3px 0 #0B0715',
                cursor: 'pointer',
              }}
            >
              RELOAD
            </button>

            <p
              style={{
                margin: '18px 0 0',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 10,
                color: '#8B7BA8',
                wordBreak: 'break-all',
              }}
            >
              {id}
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
