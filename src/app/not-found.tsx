/**
 * 404. Until this existed, a mistyped or stale URL rendered Next's stock
 * black-on-white "This page could not be found" — which, in a TWA with no
 * address bar, is a dead end with no control on it at all. A push notification
 * that deep-links to a route that has since moved lands exactly here.
 *
 * A Server Component on purpose: there is nothing interactive on this screen
 * except one link, and shipping no JS for it means it still renders when the
 * client bundle is the thing that failed to load.
 *
 * The link is a plain <a>, not next/link, for the same reason GO HOME in
 * error.tsx is a hard assign — a document load rebuilds the tree rather than
 * soft-navigating within one that may be why the user is here.
 */

import PageReady from '@/components/PageReady'

export default function NotFound() {
  return (
    <div style={S.screen}>
      {/* The splash hides on `eren:app-ready`, which a 404 would otherwise
          never dispatch - leaving this screen under it for the full 8s. */}
      <PageReady />
      <div style={S.scanlines} aria-hidden />

      <div style={S.panel}>
        <span style={{ ...S.rivet, top: 5, left: 5 }} aria-hidden />
        <span style={{ ...S.rivet, top: 5, right: 5 }} aria-hidden />
        <span style={{ ...S.rivet, bottom: 5, left: 5 }} aria-hidden />
        <span style={{ ...S.rivet, bottom: 5, right: 5 }} aria-hidden />

        <p style={S.code}>404</p>
        <h1 style={S.title}>NOTHING HERE</h1>

        <p style={S.body}>
          This room does not exist. Your cat is somewhere in the house — go and look.
        </p>

        <a href="/home" style={S.primary}>GO HOME</a>
      </div>
    </div>
  )
}

const PIXEL = '"Press Start 2P", monospace'

const S: Record<string, React.CSSProperties> = {
  screen: {
    position: 'fixed',
    inset: 0,
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
    padding: '24px 20px 20px',
    background: 'linear-gradient(180deg, #2E1A52 0%, #1C1035 100%)',
    border: '3px solid #6D28D9',
    boxShadow: '4px 4px 0 #0B0715, 0 0 26px 2px rgba(167,139,250,0.28)',
    textAlign: 'center',
  },
  rivet: { position: 'absolute', width: 3, height: 3, background: '#F5C542' },
  code: {
    margin: '0 0 8px',
    fontFamily: PIXEL,
    fontSize: 22,
    letterSpacing: 2,
    color: '#F5C542',
  },
  title: {
    margin: '0 0 14px',
    fontFamily: PIXEL,
    fontSize: 10,
    lineHeight: 1.6,
    letterSpacing: 1,
    color: '#FFD9E8',
  },
  body: { margin: '0 0 20px', fontSize: 12, lineHeight: 1.7, color: '#C4B5FD' },
  primary: {
    display: 'block',
    width: '100%',
    padding: '11px 0',
    fontFamily: PIXEL,
    fontSize: 8,
    letterSpacing: 1,
    color: '#1C1035',
    background: '#F5C542',
    border: '2px solid #0B0715',
    boxShadow: '3px 3px 0 #0B0715',
    textDecoration: 'none',
  },
}
