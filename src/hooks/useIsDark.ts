'use client'

import { useEffect, useState } from 'react'
import { isDarkOutside, tzCoords } from '@/lib/timeOfDay'

// Returns true when it's "dark outside" by the user's local sunset and
// sunrise. Coords are derived from the browser's IANA timezone (no
// permission prompt) — accurate to ~30 min anywhere in the world, which
// is well below the threshold where a room-background swap is noticeable.
// Re-evaluates every minute and on visibilitychange so the swap happens
// live without a reload.
export function useIsDark(): boolean {
  // Starts light, ALWAYS, and resolves on the first effect tick.
  //
  // This used to be `useState(() => isDarkOutside(tzCoords()))`. A useState
  // initializer also runs during SSR, and tzCoords() reads the RUNTIME's IANA
  // timezone — on Vercel that is UTC, where it matches no entry and returns
  // null, so isDarkOutside fell back to a UTC hour table. The server was
  // deciding whether it is dark at a place the user does not live.
  //
  // Two consequences, and the second is the expensive one:
  //   1. The server's answer and the browser's disagree for most of the
  //      world, which is a hydration mismatch — the React #418/#423 pair
  //      logged on /home.
  //   2. These pages PRERENDER. The value was not merely computed on the
  //      wrong clock, it was frozen into static HTML at BUILD time and
  //      served from the edge cache to everyone. That is why /bakery shipped
  //      CakeShopNight.png to daytime visitors: the build happened to run at
  //      night in UTC. `export const dynamic = 'force-dynamic'` does not
  //      help — it is inert in a client component, which `next build` still
  //      reports as ○ (Static).
  //
  // A deterministic first render is the fix for both: server and first client
  // render agree, and the effect below corrects it immediately. At night that
  // costs one frame of the light background — usually behind the splash — and
  // it is the project's existing rule that clock-derived styles must resolve
  // after mount, which this hook simply predates.
  const [dark, setDark] = useState<boolean>(false)

  useEffect(() => {
    const tick = () => setDark(isDarkOutside(tzCoords()))
    tick()
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  return dark
}
