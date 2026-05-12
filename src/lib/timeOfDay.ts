// Sun-position math for the "is it dark outside" room-background swap.
// Coords are derived from the browser's IANA timezone (see tzCoords) —
// accurate to ~30 min, no permission prompt. Falls back to a northern-
// hemisphere monthly table only if Intl is unavailable.

const RAD = Math.PI / 180

function toJulian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}
function fromJulian(j: number): Date {
  return new Date((j - 2440587.5) * 86400000)
}

// Standard "sunrise equation". Returns local-clock decimal hours for
// sunrise and sunset at the given date/coords. 'polar-night' = sun never
// rises that day, 'polar-day' = sun never sets.
function sunTimes(
  date: Date,
  lat: number,
  lon: number,
): { sunrise: number; sunset: number } | 'polar-night' | 'polar-day' {
  const J      = toJulian(date) - 2451545
  const n      = Math.round(J - 0.0009 - lon / 360)
  const Jstar  = 2451545 + 0.0009 + lon / 360 + n
  const M      = (357.5291 + 0.98560028 * (Jstar - 2451545)) % 360
  const Mrad   = M * RAD
  const C      = 1.9148 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 0.0003 * Math.sin(3 * Mrad)
  const lambda = ((M + 102.9372 + C + 180) % 360) * RAD
  const Jtran  = Jstar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambda)
  const delta  = Math.asin(Math.sin(lambda) * Math.sin(23.44 * RAD))
  const latRad = lat * RAD
  const cosO   = (Math.sin(-0.83 * RAD) - Math.sin(latRad) * Math.sin(delta)) / (Math.cos(latRad) * Math.cos(delta))
  if (cosO > 1)  return 'polar-night'
  if (cosO < -1) return 'polar-day'
  const omega   = Math.acos(cosO) / RAD
  const sunrise = fromJulian(Jtran - omega / 360)
  const sunset  = fromJulian(Jtran + omega / 360)
  return {
    sunrise: sunrise.getHours() + sunrise.getMinutes() / 60,
    sunset:  sunset.getHours()  + sunset.getMinutes()  / 60,
  }
}

export type Coords = { lat: number; lon: number }

export function isDarkOutside(coords?: Coords | null, date: Date = new Date()): boolean {
  if (coords) {
    const t = sunTimes(date, coords.lat, coords.lon)
    if (t === 'polar-night') return true
    if (t === 'polar-day')   return false
    const hour = date.getHours() + date.getMinutes() / 60
    return hour >= t.sunset || hour < t.sunrise
  }
  // Last-resort fallback: northern-hemisphere monthly average.
  const DUSK  = [17, 17.5, 18.5, 20, 20.5, 21, 21, 20.5, 19.5, 18.5, 17, 16.5]
  const DAWN  = [ 8,  7.5,  6.5,  6,  5.5,  5,  5.5,  6,    6.5,  7,    7.5, 8]
  const month = date.getMonth()
  const hour  = date.getHours() + date.getMinutes() / 60
  return hour >= DUSK[month] || hour < DAWN[month]
}

// Representative coordinates per IANA timezone, used when the user
// denies the geolocation prompt. ~50 common zones cover most populations;
// anything else falls back to a continent-level default so we still get
// the right hemisphere and roughly the right longitude.
const TZ_COORDS: Record<string, [number, number]> = {
  'Europe/Belgrade':      [ 44.79,   20.45],
  'Europe/London':        [ 51.51,   -0.13],
  'Europe/Paris':         [ 48.86,    2.35],
  'Europe/Berlin':        [ 52.52,   13.40],
  'Europe/Madrid':        [ 40.42,   -3.70],
  'Europe/Rome':          [ 41.90,   12.49],
  'Europe/Moscow':        [ 55.75,   37.62],
  'Europe/Istanbul':      [ 41.01,   28.98],
  'Europe/Amsterdam':     [ 52.37,    4.90],
  'Europe/Athens':        [ 37.98,   23.73],
  'Europe/Vienna':        [ 48.21,   16.37],
  'Europe/Warsaw':        [ 52.23,   21.01],
  'Europe/Stockholm':     [ 59.33,   18.07],
  'Europe/Helsinki':      [ 60.17,   24.94],
  'Europe/Dublin':        [ 53.35,   -6.27],
  'Europe/Lisbon':        [ 38.72,   -9.14],
  'Europe/Budapest':      [ 47.50,   19.04],
  'Europe/Bucharest':     [ 44.43,   26.10],
  'Europe/Zagreb':        [ 45.81,   15.98],
  'Europe/Sarajevo':      [ 43.86,   18.41],
  'Europe/Sofia':         [ 42.70,   23.32],
  'Europe/Prague':        [ 50.08,   14.44],
  'America/New_York':     [ 40.71,  -74.01],
  'America/Chicago':      [ 41.88,  -87.63],
  'America/Denver':       [ 39.74, -104.99],
  'America/Los_Angeles':  [ 34.05, -118.24],
  'America/Phoenix':      [ 33.45, -112.07],
  'America/Toronto':      [ 43.65,  -79.38],
  'America/Vancouver':    [ 49.28, -123.12],
  'America/Mexico_City':  [ 19.43,  -99.13],
  'America/Sao_Paulo':    [-23.55,  -46.63],
  'America/Buenos_Aires': [-34.60,  -58.38],
  'America/Lima':         [-12.05,  -77.04],
  'America/Bogota':       [  4.71,  -74.07],
  'America/Santiago':     [-33.45,  -70.67],
  'Asia/Tokyo':           [ 35.68,  139.76],
  'Asia/Seoul':           [ 37.57,  126.98],
  'Asia/Shanghai':        [ 31.23,  121.47],
  'Asia/Hong_Kong':       [ 22.32,  114.17],
  'Asia/Singapore':       [  1.35,  103.82],
  'Asia/Bangkok':         [ 13.76,  100.50],
  'Asia/Jakarta':         [ -6.21,  106.85],
  'Asia/Manila':          [ 14.60,  120.98],
  'Asia/Kolkata':         [ 22.57,   88.36],
  'Asia/Dubai':           [ 25.20,   55.27],
  'Asia/Tehran':          [ 35.69,   51.39],
  'Asia/Jerusalem':       [ 31.78,   35.22],
  'Asia/Karachi':         [ 24.86,   67.01],
  'Asia/Riyadh':          [ 24.71,   46.68],
  'Australia/Sydney':     [-33.87,  151.21],
  'Australia/Melbourne':  [-37.81,  144.96],
  'Australia/Perth':      [-31.95,  115.86],
  'Pacific/Auckland':     [-36.85,  174.76],
  'Africa/Cairo':         [ 30.04,   31.24],
  'Africa/Johannesburg':  [-26.20,   28.04],
  'Africa/Lagos':         [  6.52,    3.38],
  'Africa/Nairobi':       [ -1.29,   36.82],
  'Africa/Casablanca':    [ 33.57,   -7.59],
}

const CONTINENT_DEFAULTS: Record<string, [number, number]> = {
  Europe:     [ 50,    10],
  America:    [ 40,  -100],
  Asia:       [ 25,    90],
  Africa:     [  0,    20],
  Australia:  [-25,   135],
  Pacific:    [-20,   170],
  Atlantic:   [ 30,   -30],
  Indian:     [-20,    70],
  Antarctica: [-75,     0],
}

export function tzCoords(): Coords | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const exact = TZ_COORDS[tz]
    if (exact) return { lat: exact[0], lon: exact[1] }
    const def = CONTINENT_DEFAULTS[tz.split('/')[0]]
    if (def) return { lat: def[0], lon: def[1] }
  } catch { /* SSR or no Intl support */ }
  return null
}
