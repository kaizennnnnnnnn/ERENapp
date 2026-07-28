// Picks a label colour that is actually readable on a given background.
//
// The kitchen paints its BUY buttons and qty badges in each food's own colour,
// and most of that catalogue is a pale tint — white on Egg cream (#F5E6C8) is
// 1.2:1, i.e. invisible. 35 of the 42 shop colours failed WCAG AA against
// white.
//
// Keep white where it already clears AA; otherwise darken the background's own
// colour until it does, so the label still belongs to the same palette rather
// than dropping a foreign black onto a pastel card. Multiplying RGB by a scalar
// holds hue and saturation exactly, so the ink reads as a deep shade of the
// food itself.
//
// The rule always terminates, and the floor is guaranteed: white failing 4.5:1
// means the background's luminance is above 0.183, and black against 0.183 is
// already 4.66:1 — so a passing shade always exists before the loop bottoms out
// at black. That is why AIM can exceed the AA minimum safely: a colour that
// cannot reach 6:1 darkens as far as it can and still clears AA. Across the
// kitchen's 42 foods the worst case lands at 5.1:1.

const AA_MIN = 4.5  // the bar white has to clear to be kept
const AIM = 6       // what a derived ink reaches for, when the colour allows

// Colours come from a small fixed palette, so memoising costs nothing and
// keeps this off the render path.
const inkCache = new Map<string, string>()

function relLuminance([r, g, b]: number[]): number {
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE = [255, 255, 255]

const toRgb = (hex: string): number[] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb: number[]): string =>
  '#' + rgb.map(c => Math.round(Math.max(0, c)).toString(16).padStart(2, '0')).join('')

/** Darkens `rgb` until it clears AIM against `on`, or bottoms out at black. */
const darkenUntilReadable = (rgb: number[], on: number[]): number[] => {
  let k = 1
  while (k > 0 && contrast(rgb.map(c => c * k), on) < AIM) k -= 0.02
  return rgb.map(c => c * k)
}

/** Readable ink for text drawn directly on `hex` (`#rrggbb`). */
export function inkOn(hex: string): string {
  const cached = inkCache.get(hex)
  if (cached) return cached

  const bg = toRgb(hex)
  const ink = contrast(WHITE, bg) >= AA_MIN ? '#ffffff' : toHex(darkenUntilReadable(bg, bg))

  inkCache.set(hex, ink)
  return ink
}

const deepCache = new Map<string, string>()

/**
 * Deepens `color` until it reads on the light background `on`, keeping its hue.
 *
 * For a coloured label sitting on a pale wash of its own colour — the kitchen's
 * category rows print each category's name in its own colour on a ~15% tint of
 * it, which leaves tan on cream at about 2:1. inkOn() is the wrong tool there:
 * it would answer with a desaturated shade of the *background*, throwing away
 * the colour coding the row exists to carry.
 */
export function deepenOn(color: string, on: string): string {
  const key = `${color}|${on}`
  const cached = deepCache.get(key)
  if (cached) return cached

  const out = toHex(darkenUntilReadable(toRgb(color), toRgb(on)))
  deepCache.set(key, out)
  return out
}
