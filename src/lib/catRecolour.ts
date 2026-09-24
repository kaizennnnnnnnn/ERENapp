// ─── Cat recolour ────────────────────────────────────────────────────────────
// Every household can have its own cat: any colour per part, a pattern, eyes
// and a nose. Seven parts times eighteen furs is more cats than could ever be
// pre-rendered, so we ship Eren's MATERIAL MAPS (public/cat/, exported by
// scripts/export_cat_material.py) and repaint them in the browser. Per pixel:
//   R = which part (index into meta.parts)   G = where the pixel sits on that
//   part's dark->light ramp (0..255)          B = pattern bits (1 tabby stripe,
//   2 tail ring, 4 tortoiseshell patch)       A = the sprite's own alpha
// so a recolour is one lerp per pixel and nothing else (precomputed into a
// table per look, see Palette). The decoder below is a port of paint() in the
// maker bench, which the export script asserts reproduces its own renderer;
// keep the two in step.
//
// There are two maps because home draws Eren as TWO layers (erenGood_notail
// over a swaying erenGood_tail), and a recoloured cat has to sway the same way.
// Both are 848x1264, the exact canvas of those two PNGs, so BlinkingEren's eye
// and tail geometry holds for a recoloured cat unchanged.
//
// Browser only: nothing here touches window/document until it is called.

import { onForeground } from '@/lib/onForeground'
import type { LidTone } from '@/types'
// The ramps ship inside the bundle rather than as a fetch: 4.7KB, and the
// service worker only caches images, so as a request it went to the network
// on every cold start and could hold Home's loader on a stalled connection.
import materialJson from '../../public/cat/eren_material.json'

// Bump when public/cat/* is re-exported. The service worker serves images
// stale-while-revalidate, so a map re-exported in place would otherwise be
// decoded against the NEW json (bundled above) for one visit — part ids that
// no longer mean the same part.
const MATERIAL_VERSION = '1'
const BODY_URL = `/cat/eren_notail_mat.png?v=${MATERIAL_VERSION}`
const TAIL_URL = `/cat/eren_tail_mat.png?v=${MATERIAL_VERSION}`

// A map that hasn't arrived in this long counts as failed. Without a limit a
// phone between networks held the request (and Home's "LOADING EREN", which
// waits on the household's cat) open until the TCP timeout. 317KB over a slow
// 3G link is ~6s, so a working connection doesn't meet it.
const FETCH_TIMEOUT_MS = 10_000

/** The full sprite canvas, identical to /erenGood_notail.png and /erenGood_tail.png. */
export const CAT_CANVAS = { w: 848, h: 1264 } as const

/**
 * The cat's own box inside that canvas: the framing the Meadow boards used for
 * every cat (380x512 with a 4px margin, so W = H x 0.742, head centre at 43% of
 * the width, feet on the bottom edge). Measured from the maps' alpha: the cat
 * spans x 120..827, y 174..1135, and the boards' crop keeps 4/380 of air around
 * that. Anything that shows "the cat on a stage" draws this rect.
 */
export const CAT_CROP = { x: 112, y: 166, w: 725, h: 977 } as const

/** Width / height of CAT_CROP, for sizing a portrait box. */
export const CAT_ASPECT = CAT_CROP.w / CAT_CROP.h

// ─── The look ────────────────────────────────────────────────────────────────
// Structural on purpose: catIdentity's CatLook satisfies it, and so does a raw
// preset out of the material json. The decoder treats every field as untrusted
// (cat_look is a jsonb the partner's phone writes), see resolveSpec.
export interface RecolourSpec {
  parts: Record<string, string>
  pattern: string | null
  eyes: string
  nose: string
}

interface RampDef { fur?: boolean; fixed?: [string, string]; table?: Record<string, [string, string]> }

export interface MaterialMeta {
  parts: string[]
  colourable: string[]
  fur: Record<string, [string, string]>
  ramps: Record<string, RampDef>
  stripeDepth: number
  tabbyGamma: number
  tortieSecond: string
  presets: Array<RecolourSpec & { key: string; label: string }>
}

// One layer's opaque pixels, packed. Only ~45% of the body canvas and ~4% of
// the tail canvas is opaque, so looping the packed list instead of the canvas
// halves the work, and the Uint8 t with a 256-entry lookup keeps the whole
// thing to 8 bytes a pixel.
interface LayerMap {
  w: number
  h: number
  n: number
  px: Uint32Array  // pixel index (y * w + x) in a w x h canvas
  id: Uint8Array   // part index
  tb: Uint8Array   // ramp position, 0..255
  bits: Uint8Array // pattern bits
  a: Uint8Array    // alpha
}

export interface CatMaterial {
  meta: MaterialMeta
  body: LayerMap   // erenGood_notail's pixels
  tail: LayerMap   // erenGood_tail's pixels
  whole: LayerMap  // tail with the body over it: the standing cat, for previews
  half: LayerMap   // `whole` at half size, for small thumbnails
  lidSample: Uint32Array // indices into `body` of the fur just above both eyes
  tLut: Float32Array
  tgLut: Float32Array
}

// ─── Loading ─────────────────────────────────────────────────────────────────

// JSON imports type arrays as string[], not the [dark, light] pairs; the
// export script writes exactly this shape.
const MATERIAL_META = materialJson as unknown as MaterialMeta

let materialPromise: Promise<CatMaterial> | null = null

/**
 * Load both maps and the ramps, once per session. A failure clears the memo so
 * the next caller retries instead of inheriting a dead promise for good.
 */
export function loadCatMaterial(): Promise<CatMaterial> {
  if (!materialPromise) {
    materialPromise = buildMaterial().catch((err: unknown) => {
      materialPromise = null
      throw err
    })
  }
  return materialPromise
}

async function buildMaterial(): Promise<CatMaterial> {
  const meta = MATERIAL_META
  const [body, tail] = await Promise.all([readPixels(BODY_URL), readPixels(TAIL_URL)])
  if (body.width !== CAT_CANVAS.w || body.height !== CAT_CANVAS.h || tail.width !== CAT_CANVAS.w || tail.height !== CAT_CANVAS.h) {
    throw new Error('cat material: maps are not 848x1264')
  }
  // The CPU half (four passes over ~1M pixels) runs one pass per idle moment
  // so none of it lands in the frame of the page's first paint.
  await idle()
  const wholeMap = packLayer(body.data, tail.data, 1)
  await idle()
  const halfMap = packLayer(body.data, tail.data, 2)
  await idle()
  const bodyMap = packLayer(body.data, null, 1)
  const tailMap = packLayer(tail.data, null, 1)
  const tLut = new Float32Array(256)
  const tgLut = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    tLut[i] = i / 255
    tgLut[i] = Math.pow(i / 255, meta.tabbyGamma)
  }
  return {
    meta, body: bodyMap, tail: tailMap, whole: wholeMap, half: halfMap,
    lidSample: lidSampleOf(bodyMap, meta), tLut, tgLut,
  }
}

// Exact bytes matter here: R and B are ENUMS, and a colour-managed or
// interpolated part id is simply a different part. So no colour-space
// conversion on decode, and no smoothing (the draw is 1:1 anyway). The 2D
// canvas still stores premultiplied alpha, which could round R/B under partial
// alpha; the maps were exported with hard edges (63 partial pixels out of
// ~480k) so that costs nothing visible.
async function readPixels(url: string): Promise<ImageData> {
  // The abort covers the body too, not just the headers. It rejects the
  // load, which clears the material memo, so a retry makes a fresh request
  // instead of waiting on the stalled one.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  let blob: Blob
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`cat material ${url}: HTTP ${res.status}`)
    blob = await res.blob()
  } finally {
    clearTimeout(timer)
  }
  let source: CanvasImageSource & { width: number; height: number }
  try {
    source = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  } catch {
    source = await imageFromBlob(blob)
  }
  const c = document.createElement('canvas')
  c.width = source.width
  c.height = source.height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('cat material: no 2d context')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0)
  if ('close' in source && typeof source.close === 'function') source.close()
  return ctx.getImageData(0, 0, c.width, c.height)
}

function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  const im = new Image()
  im.src = url
  return im.decode().then(
    () => { URL.revokeObjectURL(url); return im },
    (err: unknown) => { URL.revokeObjectURL(url); throw err },
  )
}

// `over` = the layer drawn underneath (the tail under the body). With it, a
// pixel takes the body where the body is opaque and the tail elsewhere — the
// composed sprite, which the export measured to be exactly that. `step` 2 is a
// NEAREST half-size sample: never interpolate an enum.
function packLayer(top: Uint8ClampedArray, under: Uint8ClampedArray | null, step: 1 | 2): LayerMap {
  const W = CAT_CANVAS.w, H = CAT_CANVAS.h
  const w = Math.floor(W / step), h = Math.floor(H / step)
  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y * step) * W + x * step) * 4
      if (top[s + 3] > 0 || (under && under[s + 3] > 0)) n++
    }
  }
  const map: LayerMap = {
    w, h, n,
    px: new Uint32Array(n), id: new Uint8Array(n), tb: new Uint8Array(n),
    bits: new Uint8Array(n), a: new Uint8Array(n),
  }
  let i = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y * step) * W + x * step) * 4
      const ta = top[s + 3]
      const ua = under ? under[s + 3] : 0
      if (ta === 0 && ua === 0) continue
      const src = ta > 0 || !under ? top : under
      map.px[i] = y * w + x
      map.id[i] = src[s]
      map.tb[i] = src[s + 1]
      map.bits[i] = src[s + 2]
      // A body pixel over a tail pixel: plain "over" for the alpha. Only the
      // handful of antialiased body-edge pixels ever sit between 0 and 255.
      map.a[i] = ta > 0 && ua > 0 ? Math.min(255, ta + Math.round(ua * (1 - ta / 255))) : Math.max(ta, ua)
      i++
    }
  }
  return map
}

// ─── The lid ─────────────────────────────────────────────────────────────────
// BlinkingEren's lid is FUR: it has to be the colour of the fur around the eye
// it closes over. On these maps that fur is the BODY part (the dark colourpoint
// mask), not the white face blaze, measured in the band just above each socket.
// Rects are in canvas px, from BlinkingEren's DEFAULT_EYES mask (box % mapped
// through the contain-letterbox) with the band running half a socket up.
const LID_BANDS: ReadonlyArray<readonly [number, number, number, number]> = [
  [282, 380, 366, 424], // left eye  x0, y0, x1, y1
  [465, 380, 549, 424], // right eye
]

function lidSampleOf(map: LayerMap, meta: MaterialMeta): Uint32Array {
  const fur = new Set(meta.colourable.map(p => meta.parts.indexOf(p)))
  const out: number[] = []
  for (let i = 0; i < map.n; i++) {
    if (!fur.has(map.id[i])) continue
    const p = map.px[i]
    const x = p % map.w, y = (p - x) / map.w
    for (const [x0, y0, x1, y1] of LID_BANDS) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) { out.push(i); break }
    }
  }
  return Uint32Array.from(out)
}

// ─── Painting ────────────────────────────────────────────────────────────────

type RGB = [number, number, number]

function hex(s: string): RGB {
  const n = parseInt(s.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// One look, flattened into a lookup table. Every pixel's colour depends only
// on (part, t, whether its part's pattern bit is set), and t has 256 values,
// so the whole recolour is precomputed into (parts x 2 x 256) packed colours
// and the pixel loop is one table read and one 32-bit write. Measured on a 4x
// throttled CPU, a full-size preview repaint went from ~280ms (a lerp per
// pixel, as the bench does it) to ~40ms, most of which is now the canvas
// upload. The table is built with the bench's lerp, and the output was
// checked bit-exact against the export script's own decoder (plain, tabby
// and tortie presets).
interface Palette {
  /** ((part << 1 | patterned) << 8 | t) -> 0x00BBGGRR (little-endian RGBA). */
  lut: Uint32Array
  /** Per part: the pattern bit that selects its patterned colour, 0 for none. */
  mask: Uint8Array
}

/**
 * The look with every field checked against the material: unknown fur, eyes or
 * nose fall back to classic Eren's, an unknown pattern to none. cat_look is
 * written by the other phone, so nothing in it is trusted.
 */
export function resolveSpec(meta: MaterialMeta, look: RecolourSpec | null | undefined): RecolourSpec {
  const base = meta.presets.find(p => p.key === 'eren') ?? meta.presets[0]
  const parts: Record<string, string> = {}
  for (const p of meta.colourable) {
    const want = look?.parts?.[p]
    parts[p] = typeof want === 'string' && meta.fur[want] ? want : base.parts[p]
  }
  const eyes = look && meta.ramps.eyes?.table?.[look.eyes] ? look.eyes : base.eyes
  const nose = look && meta.ramps.nose?.table?.[look.nose] ? look.nose : base.nose
  const pattern = look?.pattern === 'tabby' || look?.pattern === 'tortie' ? look.pattern : null
  return { parts, pattern, eyes, nose }
}

function paletteFor(mat: CatMaterial, spec: RecolourSpec): Palette {
  const { meta, tLut, tgLut } = mat
  const n = meta.parts.length
  const lut = new Uint32Array(n * 2 * 256)
  const mask = new Uint8Array(n)
  const keep = 1 - meta.stripeDepth
  const second = meta.fur[meta.tortieSecond]
  const s2 = hex(second[0]), l2 = hex(second[1])
  const pack = (d: RGB, l: RGB, t: number) =>
    Math.round(d[0] + (l[0] - d[0]) * t)
    | Math.round(d[1] + (l[1] - d[1]) * t) << 8
    | Math.round(d[2] + (l[2] - d[2]) * t) << 16
  for (let i = 0; i < n; i++) {
    const p = meta.parts[i]
    const r = meta.ramps[p]
    let pair: [string, string]
    if (r?.fixed) pair = r.fixed
    else if (p === 'eyes') pair = r.table![spec.eyes]
    else if (p === 'nose') pair = r.table![spec.nose]
    else pair = meta.fur[spec.parts[p]]
    const d = hex(pair[0]), l = hex(pair[1])
    // White never carries a pattern: a stripe is denser pigment and white is
    // the absence of pigment, so there is nothing there to be denser.
    const patterned = meta.colourable.includes(p) && spec.parts[p] !== 'white'
    const tabby = patterned && spec.pattern === 'tabby'
    const tortie = patterned && spec.pattern === 'tortie'
    // A tabby lifts the coat's own shading first (a gamma, so the folds
    // survive) and a stripe is the same pigment, denser: t pulled down its own
    // ramp. The tail's stripes are its rings (bit 2), everyone else's bit 1.
    // A tortoiseshell patch is the same shading on the second colour.
    if (tabby) mask[i] = p === 'tail' ? 2 : 1
    else if (tortie) mask[i] = 4
    const base = (i << 1) << 8, alt = ((i << 1) | 1) << 8
    for (let tb = 0; tb < 256; tb++) {
      if (tabby) {
        lut[base | tb] = pack(d, l, tgLut[tb])
        lut[alt | tb] = pack(d, l, tgLut[tb] * keep)
      } else {
        lut[base | tb] = pack(d, l, tLut[tb])
        lut[alt | tb] = tortie ? pack(s2, l2, tLut[tb]) : lut[base | tb]
      }
    }
  }
  return { lut, mask }
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

// The whole recolour. `out` is an RGBA buffer of map.w x map.h; only the
// map's own pixels are written, and every paint writes the same set, so a
// reused buffer never needs clearing.
function paintMap(map: LayerMap, pal: Palette, out: Uint8ClampedArray): void {
  const { n, px, id, tb, bits, a } = map
  const { lut, mask } = pal
  if (LITTLE_ENDIAN) {
    const out32 = new Uint32Array(out.buffer, out.byteOffset, out.length >> 2)
    for (let i = 0; i < n; i++) {
      const p = id[i]
      const v = bits[i] & mask[p] ? 1 : 0
      out32[px[i]] = lut[((p << 1) | v) << 8 | tb[i]] | (a[i] << 24)
    }
    return
  }
  // Every phone and desktop is little-endian; this is only here so a
  // big-endian engine draws a correct cat rather than a blue one.
  for (let i = 0; i < n; i++) {
    const p = id[i]
    const c = lut[((p << 1) | (bits[i] & mask[p] ? 1 : 0)) << 8 | tb[i]]
    const o = px[i] << 2
    out[o] = c & 255
    out[o + 1] = (c >> 8) & 255
    out[o + 2] = (c >> 16) & 255
    out[o + 3] = a[i]
  }
}

// ─── Lid tone ────────────────────────────────────────────────────────────────

const LID_SHEEN = 'linear-gradient(180deg, rgba(255,250,245,0.18), rgba(255,250,245,0))'

function css(c: RGB): string {
  return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]

/**
 * The blink lid for a look, in BlinkingEren's LidTone shape. The top of the
 * lid is the fur actually painted above the eyes; the lid then falls into
 * shadow the way DEFAULT_LID_TONE does (its stops are 0.8 and 0.62 of its own
 * top, which is what these factors reproduce on classic Eren).
 *
 * The fur is taken at the 30th percentile of brightness, not the mean: a
 * tortoiseshell's face is split down the middle, one colour per eye, and
 * BlinkingEren has one tone for both lids. A dark lid over the light side
 * reads as the eye closing into shadow; a light lid over the dark side reads
 * as a slab, so the pick leans dark.
 */
export function lidToneFor(mat: CatMaterial, look: RecolourSpec | null | undefined): LidTone {
  const spec = resolveSpec(mat.meta, look)
  const { lut, mask } = paletteFor(mat, spec)
  const { body, lidSample } = mat
  const cols: RGB[] = []
  for (let j = 0; j < lidSample.length; j++) {
    const i = lidSample[j]
    const p = body.id[i]
    const c = lut[((p << 1) | (body.bits[i] & mask[p] ? 1 : 0)) << 8 | body.tb[i]]
    cols.push([c & 255, (c >> 8) & 255, (c >> 16) & 255])
  }
  const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  cols.sort((x, y) => lum(x) - lum(y))
  const top: RGB = cols.length ? cols[Math.floor(cols.length * 0.3)] : hex(mat.meta.fur[spec.parts.body][0])
  return {
    base: `linear-gradient(180deg, ${css(top)} 0%, ${css(shade(top, 0.8))} 60%, ${css(shade(top, 0.62))} 100%)`,
    sheen: LID_SHEEN,
    seam: css(shade(top, 0.26)),
    flat: css(shade(top, 0.9)),
  }
}

// ─── Drawing a look onto a canvas (previews, thumbnails) ─────────────────────

// One full-size and one half-size scratch, shared: a paint writes the buffer,
// puts it into the scratch canvas and draws it out in the same synchronous
// turn, so nothing can interleave between two callers.
interface Scratch { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData }
const scratches: Partial<Record<'whole' | 'half', Scratch>> = {}

function scratchFor(kind: 'whole' | 'half', map: LayerMap): Scratch {
  const hit = scratches[kind]
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = map.w
  canvas.height = map.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('cat recolour: no 2d context')
  const s = { canvas, ctx, img: ctx.createImageData(map.w, map.h) }
  scratches[kind] = s
  return s
}

/**
 * Paint `look` and draw the cat's box (CAT_CROP) into `ctx` at (0, 0, dw, dh),
 * both layers composed, smoothly scaled (never pixelated: this is hi-res art
 * shrunk several times). `quality` 'thumb' paints the half-size map — a
 * quarter of the work, and invisible below ~120px wide.
 */
export function drawLook(
  mat: CatMaterial,
  look: RecolourSpec | null | undefined,
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  quality: 'full' | 'thumb' = 'full',
): void {
  const kind = quality === 'thumb' ? 'half' : 'whole'
  const map = kind === 'half' ? mat.half : mat.whole
  const s = scratchFor(kind, map)
  paintMap(map, paletteFor(mat, resolveSpec(mat.meta, look)), s.img.data)
  s.ctx.putImageData(s.img, 0, 0)
  const k = map.w / CAT_CANVAS.w
  ctx.clearRect(0, 0, dw, dh)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(s.canvas, CAT_CROP.x * k, CAT_CROP.y * k, CAT_CROP.w * k, CAT_CROP.h * k, 0, 0, dw, dh)
}

// ─── The two home layers as image URLs ───────────────────────────────────────

export interface CatSprite {
  /** Body without the tail, 848x1264 — drop-in for /erenGood_notail.png. */
  src: string
  /** The tail alone, 848x1264 — drop-in for /erenGood_tail.png. */
  tailSrc: string
  lidTone: LidTone
}

async function layerUrl(map: LayerMap, pal: Palette): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = map.w
  canvas.height = map.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('cat recolour: no 2d context')
  const img = ctx.createImageData(map.w, map.h)
  paintMap(map, pal, img.data)
  ctx.putImageData(img, 0, 0)
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('cat recolour: toBlob returned null')
  return URL.createObjectURL(blob)
}

async function decodeSprite(look: RecolourSpec): Promise<CatSprite> {
  const mat = await loadCatMaterial()
  const pal = paletteFor(mat, resolveSpec(mat.meta, look))
  await idle()
  const src = await layerUrl(mat.body, pal)
  await idle()
  let tailSrc: string
  try {
    tailSrc = await layerUrl(mat.tail, pal)
  } catch (err) {
    URL.revokeObjectURL(src)
    throw err
  }
  return { src, tailSrc, lidTone: lidToneFor(mat, look) }
}

// ─── Sprite cache ────────────────────────────────────────────────────────────
// One entry per look (keyed on its colours, not its preset label), shared by
// every component showing that look. Entries are reference-counted: a look
// nobody shows any more stays warm for a little while (flipping through looks
// in the builder and back is instant) and is then evicted, which is when its
// object URLs are revoked. A URL is never revoked while something shows it.

interface Entry {
  refs: number
  look: RecolourSpec
  value: CatSprite | null
  failed: boolean
  /** A decode is in flight. */
  busy: boolean
  idleAt: number
}

const IDLE_KEEP = 3
const cache = new Map<string, Entry>()
const listeners = new Set<() => void>()

/**
 * Stable key for a look: just its colours, in a fixed order. Two looks that
 * paint the same pixels share one decode, whatever their preset label says.
 */
export function lookKey(look: RecolourSpec): string {
  const parts = Object.keys(look.parts ?? {}).sort().map(k => `${k}:${look.parts[k]}`).join(',')
  return `${parts}|${look.pattern ?? 'none'}|${look.eyes}|${look.nose}`
}

/** The decoded sprite for `key` if it is already in memory, else null. */
export function peekCatSprite(key: string): CatSprite | null {
  return cache.get(key)?.value ?? null
}

/** Whether the decode for `key` failed (the caller should fall back). */
export function catSpriteFailed(key: string): boolean {
  return cache.get(key)?.failed ?? false
}

// Decode the entry's look into it. A retry reuses the entry, so whoever holds
// it keeps their hold; and a failed entry STAYS failed while its retry runs,
// so a room already showing the fallback cat keeps it rather than dropping
// back to its loader, and swaps once if the retry lands.
function decodeInto(key: string, entry: Entry): void {
  entry.busy = true
  decodeSprite(entry.look).then(
    v => {
      entry.busy = false
      // Evicted while decoding (nobody wanted it any more): don't leak.
      if (cache.get(key) !== entry) { URL.revokeObjectURL(v.src); URL.revokeObjectURL(v.tailSrc); return }
      entry.value = v
      entry.failed = false
      notify()
    },
    (err: unknown) => {
      entry.busy = false
      console.error('[catRecolour] decode failed', err)
      entry.failed = true
      notify()
    },
  )
}

// A failed look that is still held (its fallback on screen) is retried when
// the app returns to the foreground or the connection comes back. Home stays
// mounted for the life of the PWA, so waiting for a new holder left classic
// Eren standing in for the household's own cat until a reload.
let retryArmed = false
function armRetry(): void {
  if (retryArmed) return
  retryArmed = true
  const retry = () => cache.forEach((e, key) => {
    if (e.failed && !e.busy && e.refs > 0) decodeInto(key, e)
  })
  onForeground(retry)
  window.addEventListener('online', retry)
}

/** Hold `look`'s sprite (decoding it if needed). Pair with releaseCatSprite. */
export function retainCatSprite(key: string, look: RecolourSpec): void {
  armRetry()
  let e = cache.get(key)
  if (!e) {
    e = { refs: 0, look, value: null, failed: false, busy: false, idleAt: 0 }
    cache.set(key, e)
    decodeInto(key, e)
  } else if (e.failed && !e.busy) {
    // A new holder is another go at a look that failed. Nobody showing its
    // fallback: start over as a first decode, pending again, so the room
    // waits rather than flashing the wrong cat. Otherwise retry behind the
    // fallback that is already up.
    if (e.refs === 0) { e.failed = false; notify() }
    decodeInto(key, e)
  }
  e.refs++
}

/**
 * Take one more hold on a sprite that is already decoded (a component keeping
 * its last cat on screen while the next one decodes). False, and no hold, when
 * there is nothing to hold.
 */
export function holdCatSprite(key: string): boolean {
  const e = cache.get(key)
  if (!e?.value) return false
  e.refs++
  return true
}

export function releaseCatSprite(key: string): void {
  const e = cache.get(key)
  if (!e) return
  e.refs = Math.max(0, e.refs - 1)
  if (e.refs === 0) {
    e.idleAt = Date.now()
    evict()
  }
}

function evict(): void {
  const idle = Array.from(cache.entries()).filter(([, e]) => e.refs === 0).sort((x, y) => x[1].idleAt - y[1].idleAt)
  while (idle.length > IDLE_KEEP) {
    const [key, e] = idle.shift()!
    cache.delete(key)
    if (e.value) {
      URL.revokeObjectURL(e.value.src)
      URL.revokeObjectURL(e.value.tailSrc)
    }
  }
}

export function subscribeCatSprites(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notify(): void {
  listeners.forEach(fn => fn())
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

/** Resolve on the next idle moment (or soon, where requestIdleCallback is missing). */
export function idle(timeout = 200): Promise<void> {
  return new Promise(res => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => res(), { timeout })
    } else {
      setTimeout(res, 16)
    }
  })
}
