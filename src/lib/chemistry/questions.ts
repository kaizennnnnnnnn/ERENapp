// Shared multiple-choice question generator for Review, Learn, Speed, and Quiz.
// Two question types are used today (symbol↔name); the type is part of the
// returned Question so the UI can label the round (e.g. "Symbol → Name").

import { elements, type Element } from './elements'
import { isDue, isNew, dueDate, MASTERED_BOX, type CardState } from './srs'
import { elementCardId } from './store'

export type QType = 'name-from-symbol' | 'symbol-from-name'

export interface Question {
  el: Element
  type: QType
  prompt: string
  answer: string
  options: string[]     // 4 options including the answer
  correctIdx: number
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Three plausible WRONG symbols for "What is the symbol for {name}?" so the
 * answer can't be guessed by first letter (the old version lined up random
 * elements, so Magnesium's "Mg" was the only M and a giveaway). Every distractor
 * shares a first letter with the symbol OR the name, blending, in order:
 *   1. a "name guess" a learner makes from the English name (Magnesium → M, Ma),
 *   2. real element symbols sharing the correct symbol's first letter (Mg → Mn, Mo),
 *   3. real symbols sharing the NAME's first letter — covers Latin symbols where
 *      the two differ (Sodium → S, Si, Se),
 *   4. one-letter edits of the symbol (Mg → Ma…Mz) as a guaranteed filler.
 */
export function symbolDistractors(target: Element): string[] {
  const S = target.symbol
  const N = target.name
  // Normalise any candidate to symbol case: first letter upper, second lower.
  const toSym = (s: string) => (s ? s[0].toUpperCase() + s.slice(1, 2).toLowerCase() : '')
  // Keep only things that read as a real candidate for THIS element.
  const plausible = (d: string) => d.length >= 1 && d.length <= 2 && (d[0] === S[0] || d[0] === N[0])

  const used = new Set<string>([S])
  const out: string[] = []
  const take = (pool: string[], n: number) => {
    for (const c of pool) {
      if (out.length >= 3 || n <= 0) break
      const sym = toSym(c)
      if (!sym || used.has(sym) || !plausible(sym)) continue
      used.add(sym); out.push(sym); n--
    }
  }

  const alpha = 'abcdefghijklmnopqrstuvwxyz'.split('')
  const realSymFirst  = shuffle(elements.filter(e => e.symbol !== S && e.symbol[0] === S[0]).map(e => e.symbol))
  const realNameFirst = shuffle(elements.filter(e => e.symbol !== S && e.symbol[0] === N[0]).map(e => e.symbol))
  const nameGuesses   = shuffle([N[0], ...Array.from({ length: N.length - 1 }, (_, i) => N[0] + N[i + 1])])
  const edits         = shuffle(alpha.map(c => S[0] + c))

  // At least one distractor shares the SYMBOL's first letter, so the answer's
  // letter is never unique (otherwise Latin symbols like Tungsten=W would be a
  // giveaway: 3 T-options + the lone W). Real same-letter symbols first, else a
  // symbol edit (W → Wa…Wz).
  take([...realSymFirst, ...edits], 1)
  take(nameGuesses, 1)    // a "looks like the name" trap (M, Ma, …)
  take(realSymFirst, 3)   // more real elements sharing the symbol's first letter
  take(realNameFirst, 3)  // real symbols sharing the name's first letter
  take(nameGuesses, 3)
  take(edits, 3)          // guaranteed fill so we always return exactly 3
  return out
}

/** Three wrong element NAMES for "Which element has the symbol {symbol}?",
 *  preferring elements whose symbol shares the queried symbol's first letter so
 *  the choices stay thematically close (Mg → Manganese, Molybdenum, …) rather
 *  than obviously-unrelated random elements. */
export function nameDistractors(target: Element): string[] {
  const S = target.symbol
  const same = shuffle(elements.filter(e => e.atomicNumber !== target.atomicNumber && e.symbol[0] === S[0]))
  const rest = shuffle(elements.filter(e => e.atomicNumber !== target.atomicNumber && e.symbol[0] !== S[0]))
  return [...same, ...rest].slice(0, 3).map(e => e.name)
}

export function makeQuestion(el: Element, forceType?: QType): Question {
  const type: QType = forceType ?? (Math.random() < 0.5 ? 'name-from-symbol' : 'symbol-from-name')
  const answer = type === 'name-from-symbol' ? el.name : el.symbol
  const wrong  = type === 'name-from-symbol' ? nameDistractors(el) : symbolDistractors(el)
  const opts   = shuffle([answer, ...wrong])
  const prompt = type === 'name-from-symbol'
    ? `Which element has the symbol ${el.symbol}?`
    : `What is the symbol for ${el.name}?`
  return { el, type, prompt, answer, options: opts, correctIdx: opts.indexOf(answer) }
}

// ── Queue builders ──

/** Just the due cards, ordered by overdue-first. Empty if none due. */
export function dueQueue(cards: Record<string, CardState>, today: string): Element[] {
  const due: { el: Element; dueOn: string }[] = []
  for (const el of elements) {
    const c = cards[elementCardId(el.atomicNumber)]
    if (isDue(c, today)) due.push({ el, dueOn: dueDate(c!) ?? today })
  }
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  return due.map(d => d.el)
}

/**
 * Learn batch — `batchSize` brand-new elements (lowest atomic number first)
 * plus ~half as many due cards interleaved. Returns the merged + shuffled list.
 */
export function learnBatch(
  cards: Record<string, CardState>,
  today: string,
  batchSize: number,
): Element[] {
  const fresh: Element[] = []
  for (const el of elements) {
    if (fresh.length >= batchSize) break
    if (isNew(cards[elementCardId(el.atomicNumber)])) fresh.push(el)
  }
  const reviewers = shuffle(dueQueue(cards, today)).slice(0, Math.ceil(batchSize / 2))
  return shuffle([...fresh, ...reviewers])
}

/** Full pool for Speed — every element, shuffled. Falls back to the catalogue
 *  even if no card has been started yet so the round always has questions. */
export function speedPool(): Element[] {
  return shuffle(elements)
}

/** Generic mixed queue for Quiz — due > new > learning > mastered, capped. */
export function mixedQueue(
  cards: Record<string, CardState>,
  today: string,
  size: number,
): Element[] {
  const due: { el: Element; dueOn: string }[] = []
  const fresh: Element[] = []
  const learning: Element[] = []
  for (const el of elements) {
    const c = cards[elementCardId(el.atomicNumber)]
    if (isDue(c, today))              due.push({ el, dueOn: dueDate(c!) ?? today })
    else if (isNew(c))                fresh.push(el)
    else if (c && c.box < MASTERED_BOX) learning.push(el)
  }
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const q: Element[] = []
  for (const d of due)             { if (q.length >= size) break; q.push(d.el) }
  for (const f of shuffle(fresh))  { if (q.length >= size) break; q.push(f) }
  for (const l of learning)        { if (q.length >= size) break; q.push(l) }
  return q
}
