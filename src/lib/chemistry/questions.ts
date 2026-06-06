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

export function makeQuestion(el: Element, forceType?: QType): Question {
  const type: QType = forceType ?? (Math.random() < 0.5 ? 'name-from-symbol' : 'symbol-from-name')
  const pool = shuffle(elements.filter(e => e.atomicNumber !== el.atomicNumber)).slice(0, 3)
  const answer = type === 'name-from-symbol' ? el.name : el.symbol
  const wrong  = pool.map(e => type === 'name-from-symbol' ? e.name : e.symbol)
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
