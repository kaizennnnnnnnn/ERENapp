// Leitner spaced-repetition engine for the periodic-table flashcards.
//
// Ported (and simplified) from AminaChemistry/lib/srs.ts. Amina exposes a
// 3-grade self-rating (again / good / easy); we use a 2-grade WRONG / RIGHT
// because the in-app flashcard UI never had room for a third button and a
// shorter scale is easier to internalize.
//
// Boxes
//   0 = new (never reviewed)
//   1-5 = learning boxes
//   6 = mastered
// Review intervals (days): box1=1, box2=2, box3=4, box4=8, box5=16,
// mastered=45.
// A started card is due when lastReviewed + interval(box) <= today.
// RIGHT -> box +1 (correct at box 5 -> mastered).
// WRONG -> back to box 1 (lapse counter ticks once).

export const MASTERED_BOX = 6

export interface CardState {
  box: number              // 0 new, 1-5 learning, 6 mastered
  lastReviewed: string | null // YYYY-MM-DD local, or null when never reviewed
  reviews: number
  correct: number
  lapses: number
}

export const NEW_CARD_STATE: CardState = {
  box: 0,
  lastReviewed: null,
  reviews: 0,
  correct: 0,
  lapses: 0,
}

export const BOX_INTERVALS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
  6: 45,
}

/** Local YYYY-MM-DD for a given date (defaults to now). The SRS lives on
 *  the device so we use the device's local calendar day, not a household TZ. */
export function dateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return dateStr(d)
}

/** The date a card becomes due, or null for new (never-reviewed) cards. */
export function dueDate(card: CardState): string | null {
  if (card.box === 0 || card.lastReviewed === null) return null
  return addDays(card.lastReviewed, BOX_INTERVALS[card.box] ?? 1)
}

export function isNew(card: CardState | undefined): boolean {
  return !card || (card.box === 0 && card.lastReviewed === null)
}

export function isMastered(card: CardState | undefined): boolean {
  return !!card && card.box >= MASTERED_BOX
}

/** Started AND due today (or earlier). New cards are not "due". */
export function isDue(card: CardState | undefined, today: string = dateStr()): boolean {
  if (!card || isNew(card)) return false
  const due = dueDate(card)
  return due !== null && due <= today
}

/** Apply a WRONG / RIGHT result, returning the next card state. */
export function grade(
  card: CardState | undefined,
  correct: boolean,
  today: string = dateStr(),
): CardState {
  const base = card ?? { ...NEW_CARD_STATE }
  const reviews = base.reviews + 1
  if (correct) {
    return {
      box: Math.min(base.box + 1, MASTERED_BOX),
      lastReviewed: today,
      reviews,
      correct: base.correct + 1,
      lapses: base.lapses,
    }
  }
  return {
    box: 1,
    lastReviewed: today,
    reviews,
    correct: base.correct,
    lapses: base.lapses + (base.box > 1 ? 1 : 0),
  }
}
