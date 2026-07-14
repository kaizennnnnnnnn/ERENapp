// ═════════════════════════════════════════════════════════════════════════════
// COZY COUNTDOWN — window math + prompt catalog.
//
// An advent-style calendar of 12 doors covering the 12 days that END on the
// couple's anniversary (households.couple_anniversary — the stored YEAR is
// ignored, only MM-DD matters). One door per real local day in the household's
// tz; either partner opens today's door once for the household via the
// open_countdown_door() RPC, which replicates this exact window math in SQL —
// keep the two in lockstep.
//
// All stepping happens in Date.UTC epoch space of calendar KEYS (never
// wall-clock time), so DST transitions inside the window can't produce a
// duplicated or skipped day.
// ═════════════════════════════════════════════════════════════════════════════

export const DOOR_COUNT = 12

const DAY_MS = 86_400_000

export interface CountdownWindow {
  /** 12 'yyyy-MM-dd' keys; days[11] is the anniversary day itself. */
  days: string[]
  /** Index of today within days, or -1 never — callers get null instead. */
  todayIndex: number
  anniversaryKey: string
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** UTC epoch of the anniversary's MM-DD occurrence in year y.
 *  Feb-29 snaps to Feb-28 in non-leap years (mirrors notify-anniversary). */
function occurrenceUTC(y: number, m: number, d: number): number {
  const day = m === 2 && d === 29 && !isLeap(y) ? 28 : d
  return Date.UTC(y, m - 1, day)
}

function isoKey(utc: number): string {
  return new Date(utc).toISOString().slice(0, 10)
}

/**
 * The countdown window containing todayKey, or null when today is outside it.
 *
 * @param anniversary households.couple_anniversary ('yyyy-MM-dd'; year ignored)
 * @param todayKey    today as 'yyyy-MM-dd' in the HOUSEHOLD tz — produce it via
 *                    dateKey(new Date(), households.tz) from src/lib/wishes.ts,
 *                    NOT the device tz, so client and RPC agree on "today".
 */
export function countdownWindow(anniversary: string, todayKey: string): CountdownWindow | null {
  const ty = Number(todayKey.slice(0, 4))
  const tm = Number(todayKey.slice(5, 7))
  const td = Number(todayKey.slice(8, 10))
  const am = Number(anniversary.slice(5, 7))
  const ad = Number(anniversary.slice(8, 10))
  if (![ty, tm, td, am, ad].every(Number.isFinite)) return null

  const todayUTC = Date.UTC(ty, tm - 1, td)
  // Next occurrence: this year's, or next year's if already past.
  let occUTC = occurrenceUTC(ty, am, ad)
  if (occUTC < todayUTC) occUTC = occurrenceUTC(ty + 1, am, ad)

  const startUTC = occUTC - (DOOR_COUNT - 1) * DAY_MS
  if (todayUTC < startUTC || todayUTC > occUTC) return null

  const days: string[] = []
  for (let i = 0; i < DOOR_COUNT; i++) days.push(isoKey(startUTC + i * DAY_MS))
  return {
    days,
    todayIndex: Math.round((todayUTC - startUTC) / DAY_MS),
    anniversaryKey: days[DOOR_COUNT - 1],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Couple prompts. APPEND-ONLY and ids must stay in sync with the v_prompts
// array inside open_countdown_door() (migration_cozy_countdown.sql) — the RPC
// stores an id, this catalog turns it back into prose.
// ─────────────────────────────────────────────────────────────────────────────

export const COUNTDOWN_PROMPTS: Record<string, string> = {
  'cd-memory':     'tell each other your favourite memory from this year.',
  'cd-first':      'describe the moment you knew this was something special.',
  'cd-song':       'play the song that feels like us tonight.',
  'cd-photo':      'find the oldest photo of you two and send it to each other.',
  'cd-thanks':     'say one thing you never thanked each other for.',
  'cd-future':     "each of you: one tiny thing you're excited to do together next year.",
  'cd-laugh':      "retell the story of the hardest you've ever laughed together.",
  'cd-secret':     "share something small you've never mentioned. a tiny secret.",
  'cd-cook':       'plan one meal to make together before the big day.',
  'cd-walk':       'take a five-minute walk together tonight. a lap around the room counts.',
  'cd-compliment': "give each other a compliment you've been keeping in your pocket.",
  'cd-recreate':   'recreate your very first photo together.',
}

export function promptText(id: string | null | undefined): string | null {
  if (!id) return null
  return COUNTDOWN_PROMPTS[id] ?? null
}
