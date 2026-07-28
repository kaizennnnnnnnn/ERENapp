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

/** Readable ink for text drawn directly on `hex` (`#rrggbb`). */
export function inkOn(hex: string): string {
  const cached = inkCache.get(hex)
  if (cached) return cached

  const n = parseInt(hex.slice(1), 16)
  const bg = [(n >> 16) & 255, (n >> 8) & 255, n & 255]

  let ink = '#ffffff'
  if (contrast(WHITE, bg) < AA_MIN) {
    let k = 1
    while (k > 0 && contrast(bg.map(c => c * k), bg) < AIM) k -= 0.02
    ink = '#' + bg.map(c => Math.round(Math.max(0, c * k)).toString(16).padStart(2, '0')).join('')
  }

  inkCache.set(hex, ink)
  return ink
}
