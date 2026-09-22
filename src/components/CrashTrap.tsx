'use client'

// ─── CrashTrap ──────────────────────────────────────────────────────────────
// The errors no error boundary can see.
//
// be5433b added error.tsx / global-error.tsx, and they catch a throw during
// React's render or commit. They cannot catch anything that happens on a
// callback the browser owns — and that is where this app does its heaviest
// work: eight minigames plus the two jelly games run their whole simulation
// inside requestAnimationFrame. A throw there unwinds into the browser, the
// frame chain stops because the line that would have queued the next frame
// never ran, and the canvas simply freezes. React is not involved, renders
// nothing new, and no boundary fires. The HUD keeps sitting there over a dead
// game. Same for a setTimeout callback and for an await that rejects with
// nobody catching it.
//
// In a display:standalone TWA that is unrecoverable from inside: no address
// bar, no reload gesture, no console. The user's only move is to kill the app
// from the switcher. So this does what error.tsx does for the render path —
// says something broke and offers a hard document reload — for the path
// error.tsx cannot reach.
//
// It does NOT try to keep a broken loop running. A game that throws once
// throws every frame, and a try/catch inside the loop would turn one dead
// canvas into a console filling at 60Hz. Report once, offer the way out.
//
// ORDER MATTERS: this mounts AFTER TransientErrorSilencer in the root layout.
// That component preventDefault()s the burst of benign rejections Supabase's
// auth client emits on a dropped connection, and listeners fire in
// registration order — so by the time this one runs, `defaultPrevented` is
// already set on everything it claimed, and offering the user a RELOAD button
// because their wifi blinked would be worse than saying nothing.
//
// In development React re-throws boundary-caught errors so devtools can see
// them, so a render crash shows this bar AND the Next overlay. In production
// React keeps them, and the two paths stay separate.

import { useEffect, useState } from 'react'

const KEEP = 5
const STORE_KEY = 'eren_crash_log'

/** Noise that is not a crash. */
function isIgnorable(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    // Fired by any layout that dirties the observed box; benign, and browsers
    // report it as an uncaught error purely because the spec says to.
    m.includes('resizeobserver loop')
    // A cross-origin script with no CORS headers gives literally this and
    // nothing else — no file, no line, nothing to act on.
    || m === 'script error.'
    || m === ''
  )
}

function record(msg: string) {
  try {
    const prev: string[] = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? '[]')
    prev.push(`${new Date().toISOString()} ${msg}`)
    sessionStorage.setItem(STORE_KEY, JSON.stringify(prev.slice(-KEEP)))
  } catch { /* private mode, quota — the console line below still stands */ }
}

export default function CrashTrap() {
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    // Once per document load. A loop that throws does it on every frame it
    // would have run, and the second report tells the user nothing the first
    // one did not.
    let fired = false

    const surface = (what: string, detail: unknown) => {
      if (fired || isIgnorable(what)) return
      fired = true
      // The only record this app keeps of a crash — there is no telemetry.
      // Same reasoning as error.tsx: on a device it goes nowhere, but it is
      // what makes the bug reproducible on a machine with devtools open.
      console.error('[eren] uncaught (no boundary can see this):', detail)
      record(what)
      setMsg(what.slice(0, 120))
    }

    const onError = (e: ErrorEvent) => {
      // A failed <img>/<script> load fires an `error` event on the ELEMENT
      // that bubbles to window with no `error` property. A 404 on a room
      // background is not a crash and must not offer a reload.
      if (e.target && e.target !== window) return
      if (e.defaultPrevented) return
      surface(e.message ?? '', e.error ?? e.message)
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      if (e.defaultPrevented) return
      const r = e.reason as { message?: string } | undefined
      surface(String(r?.message ?? e.reason ?? ''), e.reason)
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (!msg) return null

  return (
    <div
      role="alert"
      className="fixed left-0 right-0 flex items-center gap-2 px-3 py-2.5"
      style={{
        // Under the splash (9999) so a crash during boot does not cover it,
        // over everything else.
        zIndex: 9990,
        bottom: 0,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        background: '#2A0E18',
        borderTop: '2px solid #FF4D6D',
        boxShadow: '0 -3px 0 rgba(0,0,0,0.35)',
        color: '#FFD9E1',
      }}
    >
      <span className="font-pixel flex-1" style={{ fontSize: 7, lineHeight: 1.7, letterSpacing: 0.5 }}>
        SOMETHING BROKE
        <span className="block" style={{ fontSize: 6, color: '#E39AAC', marginTop: 3 }}>{msg}</span>
      </span>
      <button
        onClick={() => window.location.reload()}
        className="font-pixel flex-shrink-0 px-2.5 py-2 active:translate-y-[1px] transition-transform"
        style={{
          fontSize: 7, letterSpacing: 1, color: '#2A0E18',
          background: '#FF8DA1', border: '2px solid #FFD9E1',
          boxShadow: '2px 2px 0 rgba(0,0,0,0.4)',
        }}
      >
        RELOAD
      </button>
      <button
        onClick={() => setMsg(null)}
        aria-label="Dismiss"
        className="font-pixel flex-shrink-0 px-2 py-2 active:translate-y-[1px] transition-transform"
        style={{ fontSize: 8, color: '#E39AAC' }}
      >
        X
      </button>
    </div>
  )
}
