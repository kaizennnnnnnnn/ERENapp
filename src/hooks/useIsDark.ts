'use client'

import { useEffect, useState } from 'react'
import { isDarkOutside, tzCoords, type Coords } from '@/lib/timeOfDay'

const COORDS_KEY        = 'eren_coords'
const COORDS_DENIED_KEY = 'eren_coords_denied'

function readCached(): Coords | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed?.lat === 'number' && typeof parsed?.lon === 'number') {
        return { lat: parsed.lat, lon: parsed.lon }
      }
    }
  } catch { /* ignore */ }
  return null
}

// Module-level singleton so multiple hook instances mounted in the same
// tab share a single getCurrentPosition() call (and therefore a single
// permission prompt) instead of racing.
let coordsPromise: Promise<Coords | null> | null = null

function requestGeolocation(): Promise<Coords | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  if (localStorage.getItem(COORDS_DENIED_KEY) === '1')             return Promise.resolve(null)
  if (coordsPromise) return coordsPromise
  coordsPromise = new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c: Coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        try { localStorage.setItem(COORDS_KEY, JSON.stringify(c)) } catch { /* ignore */ }
        resolve(c)
      },
      () => {
        // User denied or the request timed out. Remember the denial so we
        // don't re-prompt on every page load, and fall through to the
        // timezone-based estimate.
        try { localStorage.setItem(COORDS_DENIED_KEY, '1') } catch { /* ignore */ }
        resolve(null)
      },
      { timeout: 8000, maximumAge: 24 * 3600 * 1000 },
    )
  })
  return coordsPromise
}

// Returns true when it's "dark outside" by local sunset/sunrise, with
// re-evaluation every minute and on visibilitychange. Coords come from
// (in order) localStorage → fresh geolocation prompt → IANA timezone.
export function useIsDark(): boolean {
  const [coords, setCoords] = useState<Coords | null>(() => readCached() ?? tzCoords())
  const [dark,   setDark]   = useState<boolean>(() => isDarkOutside(readCached() ?? tzCoords()))

  // Ask for geolocation once per browser (cached + denial cached).
  useEffect(() => {
    if (readCached()) return
    let cancelled = false
    requestGeolocation().then(c => {
      if (!cancelled && c) setCoords(c)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const tick = () => setDark(isDarkOutside(coords))
    tick()
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [coords])

  return dark
}
