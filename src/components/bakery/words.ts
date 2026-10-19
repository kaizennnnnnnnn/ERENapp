// The bakery's catalogue was written for the pixel font, in capitals: cake
// names ("STRAWBERRY SHORTCAKE") and donut perks ("HUNGER +12", "-0.15 KG").
// Meadow sets them in its rounded type, where capitals shout, so they're
// title-cased for display here. The data stays as it is.

/** "STRAWBERRY SHORTCAKE" -> "Strawberry Shortcake", "-0.15 KG" -> "-0.15 kg". */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s+])([a-z])/g, (_, before: string, c: string) => before + c.toUpperCase())
    .replace(/\bKg\b/g, 'kg')
}
