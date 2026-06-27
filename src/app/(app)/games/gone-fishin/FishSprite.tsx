'use client'

// ═══════════════════════════════════════════════════════════════════════════
// FishSprite — the pixel creatures for GONE FISHIN'.
// ────────────────────────────────────────────────────────────────────────
// One parametric renderer on a 24×24 grid. Every species shares a 3-tone
// shaded body (light top → mid colour → dark belly) so the silhouette reads
// at 24px and the detail rewards you at 72px. Per-id VIS specs add the bits
// that make a fish recognisable: a perch's spiny sail, a trout's spots, a
// catfish's barbels, a puffer's spikes, a koi's flowing tail.
//
// Faces LEFT by default (eye left, tail right). The reel flips it with
// scaleX(-1) so it swims into the column. `swim` adds a tail flick + body
// bob (keyframes gfFin / gfFishBob are defined once on the game page).
// ═══════════════════════════════════════════════════════════════════════════

export interface SpritePalette {
  id: string
  color: string
  dark: string
  light: string
  kind: 'fish' | 'junk'
}

type Arch = 'slim' | 'standard' | 'round' | 'fancy' | 'catfish'
type Tail = 'fork' | 'fan' | 'fancy' | 'round'

interface Vis {
  arch: Arch
  tail: Tail
  dorsal?: 'low' | 'spiky' | 'sail'
  spots?: 'dark' | 'light'
  stripes?: boolean
  barbel?: 'short' | 'long'
  spikes?: boolean
  bigMouth?: boolean
  adipose?: boolean
}

const VIS: Record<string, Vis> = {
  minnow:   { arch: 'slim',     tail: 'fork' },
  sardine:  { arch: 'slim',     tail: 'fork', stripes: true },
  perch:    { arch: 'standard', tail: 'fork', dorsal: 'spiky', stripes: true },
  bass:     { arch: 'standard', tail: 'fan',  dorsal: 'low', bigMouth: true },
  trout:    { arch: 'standard', tail: 'fan',  dorsal: 'low', spots: 'dark', adipose: true },
  puffer:   { arch: 'round',    tail: 'round', spikes: true },
  koi:      { arch: 'fancy',    tail: 'fancy', spots: 'light', barbel: 'short' },
  catfish:  { arch: 'catfish',  tail: 'fan',  barbel: 'long', spots: 'dark' },
  goldfish: { arch: 'fancy',    tail: 'fancy', dorsal: 'sail' },
}

// A rect tuple: x, y, w, h, fill, opacity?
type R = [number, number, number, number, string, number?]

// ─── Body archetypes (3-tone, top→bottom) ───────────────────────────────────
function bodyRects(arch: Arch, col: string, lt: string, dk: string): R[] {
  if (arch === 'slim') {
    return [
      [8, 9, 8, 1, lt], [6, 10, 11, 1, lt],
      [5, 11, 12, 1, col], [5, 12, 12, 1, col],
      [6, 13, 11, 1, dk], [8, 14, 8, 1, dk],
    ]
  }
  if (arch === 'round') {
    return [
      [10, 6, 5, 1, lt], [8, 7, 9, 1, lt], [7, 8, 11, 1, lt],
      [6, 9, 13, 1, col], [5, 10, 14, 1, col], [5, 11, 14, 1, col],
      [5, 12, 14, 1, col], [6, 13, 13, 1, col],
      [7, 14, 11, 1, dk], [8, 15, 9, 1, dk], [10, 16, 5, 1, dk],
    ]
  }
  if (arch === 'catfish') {
    // flatter, wider head; body sits low
    return [
      [6, 9, 11, 1, lt], [4, 10, 14, 1, lt],
      [4, 11, 15, 1, col], [4, 12, 15, 1, col], [5, 13, 14, 1, col],
      [6, 14, 12, 1, dk], [8, 15, 9, 1, dk],
    ]
  }
  // standard (and base for fancy)
  return [
    [9, 8, 7, 1, lt], [7, 9, 10, 1, lt],
    [6, 10, 12, 1, col], [5, 11, 13, 1, col], [5, 12, 13, 1, col], [6, 13, 12, 1, col],
    [7, 14, 10, 1, dk], [9, 15, 7, 1, dk],
  ]
}

function tailRects(tail: Tail, fin: string, lt: string): R[] {
  if (tail === 'round') {
    return [[17, 10, 2, 4, fin], [19, 9, 1, 2, fin], [19, 13, 1, 2, fin]]
  }
  if (tail === 'fan') {
    return [
      [16, 10, 2, 4, fin],
      [18, 8, 2, 8, fin],
      [20, 7, 1, 4, fin, 0.85], [20, 13, 1, 4, fin, 0.85],
      [19, 11, 2, 2, lt, 0.4],
    ]
  }
  if (tail === 'fancy') {
    // flowing double tail — drifts past the frame edge
    return [
      [16, 10, 2, 4, fin],
      [18, 7, 2, 3, fin], [18, 14, 2, 3, fin],
      [20, 5, 2, 4, fin, 0.9], [20, 13, 2, 5, fin, 0.9],
      [22, 4, 1, 3, fin, 0.7], [22, 14, 1, 3, fin, 0.7],
      [19, 9, 2, 5, lt, 0.35],
    ]
  }
  // fork (default)
  return [
    [16, 10, 3, 4, fin],
    [18, 7, 2, 4, fin], [18, 13, 2, 4, fin],
    [20, 6, 1, 3, fin, 0.85], [20, 15, 1, 3, fin, 0.85],
  ]
}

function dorsalRects(kind: NonNullable<Vis['dorsal']>, col: string, fin: string): R[] {
  if (kind === 'spiky') {
    return [
      [9, 6, 1, 2, fin], [11, 5, 1, 3, fin], [13, 6, 1, 2, fin], [15, 6, 1, 2, fin],
      [9, 7, 7, 1, col],
    ]
  }
  if (kind === 'sail') {
    return [
      [9, 4, 8, 1, fin, 0.85], [9, 5, 8, 2, col], [10, 3, 5, 1, fin, 0.7],
    ]
  }
  // low
  return [[10, 7, 6, 1, fin], [11, 6, 4, 1, fin, 0.8]]
}

// ─── Junk renderers ──────────────────────────────────────────────────────────
function junkRects(id: string, col: string, lt: string, dk: string): R[] {
  if (id === 'boot') {
    return [
      [8, 4, 6, 9, col], [8, 4, 6, 2, lt],          // shaft + cuff
      [8, 13, 11, 5, col],                          // foot
      [17, 14, 2, 4, col], [18, 15, 1, 3, dk],      // toe
      [7, 18, 13, 2, dk],                           // sole
      [9, 7, 4, 1, dk, 0.5], [9, 10, 4, 1, dk, 0.5],// laces
      [13, 13, 1, 5, dk, 0.4],
    ]
  }
  if (id === 'can') {
    return [
      [7, 6, 10, 12, col], [7, 5, 10, 2, lt],       // body + top rim
      [7, 16, 10, 2, dk],                           // base shade
      [7, 9, 10, 5, dk, 0.45],                       // label band
      [9, 4, 4, 1, lt], [11, 3, 1, 2, dk],          // pull tab
      [8, 7, 1, 10, lt, 0.4],                        // sheen
    ]
  }
  // weed
  return [
    [9, 5, 2, 15, col], [10, 4, 1, 3, lt],
    [13, 7, 2, 13, col], [13, 6, 1, 3, lt],
    [6, 9, 2, 11, lt], [11, 11, 2, 8, col],
    [7, 14, 2, 2, lt, 0.6], [14, 12, 2, 2, lt, 0.6],
  ]
}

// ─── Component ───────────────────────────────────────────────────────────────
export function FishSprite({ s, size, swim = false }: { s: SpritePalette; size: number; swim?: boolean }) {
  const svg = { width: size, height: size, viewBox: '0 0 24 24', shapeRendering: 'crispEdges' as const, style: { imageRendering: 'pixelated' as const, overflow: 'visible' as const } }
  const col = s.color, lt = s.light, dk = s.dark
  const fin = s.dark

  if (s.kind === 'junk') {
    const rects = junkRects(s.id, col, lt, dk)
    return <svg {...svg}>{rects.map((r, i) => <rect key={i} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill={r[4]} opacity={r[5]} />)}</svg>
  }

  const v = VIS[s.id] ?? { arch: 'standard', tail: 'fork' }
  const tail = tailRects(v.tail, fin, lt)
  const body = bodyRects(v.arch, col, lt, dk)

  // detail layers over the body
  const detail: R[] = []
  // gill arc
  const gx = v.arch === 'catfish' ? 9 : v.arch === 'slim' ? 9 : 10
  detail.push([gx, v.arch === 'round' ? 9 : 10, 1, v.arch === 'round' ? 5 : 4, dk, 0.45])
  // belly highlight (front underside)
  detail.push([6, v.arch === 'round' ? 13 : 13, 5, 1, lt, 0.45])
  // pectoral fin
  detail.push([10, v.arch === 'catfish' ? 13 : 13, 3, 2, fin, 0.8])
  // mouth
  if (v.bigMouth) detail.push([3, 12, 3, 2, dk], [4, 11, 1, 1, col])
  else detail.push([4, v.arch === 'slim' ? 11 : 12, 1, 1, dk])
  // eye
  const ey = v.arch === 'round' ? 10 : v.arch === 'slim' ? 10 : 10
  detail.push([6, ey, 3, 3, '#F8FAFC'], [7, ey + 1, 2, 2, '#0F172A'], [7, ey + 1, 1, 1, '#475569'])

  // stripes / spots
  const accents: R[] = []
  if (v.stripes) accents.push([10, 9, 1, 6, dk, 0.5], [12, 9, 1, 6, dk, 0.5], [14, 9, 1, 5, dk, 0.5])
  if (v.spots) {
    const c = v.spots === 'light' ? lt : dk
    accents.push([11, 10, 1, 1, c, 0.8], [13, 12, 1, 1, c, 0.8], [9, 12, 1, 1, c, 0.8], [14, 10, 1, 1, c, 0.8], [12, 13, 1, 1, c, 0.7])
  }
  if (v.adipose) accents.push([15, 9, 1, 1, fin, 0.7])

  // appendages
  const extra: R[] = []
  if (v.dorsal) extra.push(...dorsalRects(v.dorsal, col, fin))
  if (v.spikes) extra.push(
    [9, 5, 1, 1, dk], [12, 5, 1, 1, dk], [15, 5, 1, 1, dk],
    [9, 17, 1, 1, dk], [12, 17, 1, 1, dk], [15, 17, 1, 1, dk],
    [4, 9, 1, 1, dk], [4, 13, 1, 1, dk],
  )
  if (v.barbel === 'long') extra.push([1, 12, 4, 1, dk, 0.85], [1, 14, 4, 1, dk, 0.85], [2, 13, 1, 3, dk, 0.6])
  if (v.barbel === 'short') extra.push([3, 13, 3, 1, dk, 0.8])

  const render = (arr: R[], k: string) => arr.map((r, i) => <rect key={`${k}${i}`} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill={r[4]} opacity={r[5]} />)

  return (
    <svg {...svg}>
      <g style={swim ? { animation: 'gfFin 0.5s ease-in-out infinite', transformOrigin: '16px 12px' } : undefined}>
        {render(tail, 't')}
      </g>
      {render(body, 'b')}
      {render(detail, 'd')}
      {render(accents, 'a')}
      {render(extra, 'e')}
    </svg>
  )
}

export default FishSprite
