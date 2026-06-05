'use client'

// Match — 60-second symbol ↔ name pairing game. 6 elements on the board
// at a time (12 cards: each element appears twice, once as symbol, once
// as name). Tap two cards to check. Match → both fade out and the element
// is credited as a RIGHT review against the SRS store. Mismatch → brief
// red flash, both deselect. Burn through all 6 pairs and a new round
// auto-loads while the timer keeps running.
//
// SRS policy: only matches feed rateCard. Mismatches don't punish either
// card — the user might have tapped one of them speculatively, so
// downgrading both for one mistake would be unfair.

import { useCallback, useEffect, useRef, useState } from 'react'
import { elements, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS, readableText } from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { dueDate, isDue, isNew, MASTERED_BOX, type CardState } from '@/lib/chemistry/srs'
import { playSound } from '@/lib/sounds'

const ROUND_SECONDS  = 60
const PAIRS_PER_ROUND = 6
const MISMATCH_FLASH_MS = 650

type Kind = 'symbol' | 'name'
interface Card {
  id: number      // unique within the run
  kind: Kind
  element: Element
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickPairs(cards: Record<string, CardState>, today: string): Element[] {
  // Prefer due / new for the round, fall back to random — same priority
  // as the flashcards and quiz so the boards stay coherent across modes.
  const due: { el: Element; dueOn: string }[] = []
  const fresh: Element[] = []
  const learning: Element[] = []
  for (const el of elements) {
    const card = cards[elementCardId(el.atomicNumber)]
    if (isDue(card, today)) {
      due.push({ el, dueOn: dueDate(card!) ?? today })
    } else if (isNew(card)) {
      fresh.push(el)
    } else if (card && card.box < MASTERED_BOX) {
      learning.push(el)
    }
  }
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const out: Element[] = []
  for (const d of due)     { if (out.length >= PAIRS_PER_ROUND) break; out.push(d.el) }
  if (out.length < PAIRS_PER_ROUND) {
    for (const e of shuffle(fresh))    { if (out.length >= PAIRS_PER_ROUND) break; out.push(e) }
  }
  if (out.length < PAIRS_PER_ROUND) {
    for (const e of shuffle(learning)) { if (out.length >= PAIRS_PER_ROUND) break; out.push(e) }
  }
  // Final safety net: pad with random elements if everything was mastered.
  if (out.length < PAIRS_PER_ROUND) {
    const pad = shuffle(elements.filter(e => !out.includes(e))).slice(0, PAIRS_PER_ROUND - out.length)
    out.push(...pad)
  }
  return out
}

let _idCounter = 0
function makeRound(els: Element[]): Card[] {
  const round: Card[] = []
  for (const el of els) {
    round.push({ id: ++_idCounter, kind: 'symbol', element: el })
    round.push({ id: ++_idCounter, kind: 'name',   element: el })
  }
  return shuffle(round)
}

export default function Match() {
  const { hydrated, state, today, rateCard, finishDeck } = useChemistryStore()
  const [cards, setCards] = useState<Card[]>([])
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number[]>([])
  const [wrong, setWrong] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [pairs, setPairs] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [done, setDone] = useState(false)
  const [running, setRunning] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishedRef = useRef(false)

  const reset = useCallback(() => {
    if (!hydrated) return
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    const els = pickPairs(state.cards, today)
    setCards(makeRound(els))
    setMatched(new Set())
    setSelected([])
    setWrong([])
    setTimeLeft(ROUND_SECONDS)
    setPairs(0)
    setStreak(0)
    setBestStreak(0)
    setDone(false)
    setRunning(true)
    finishedRef.current = false
  }, [hydrated, state.cards, today])

  // First-time setup — don't auto-start the clock; show a START button
  // so the user isn't ambushed by the countdown the moment they tap
  // the MATCH tab.
  useEffect(() => {
    if (!hydrated) return
    if (cards.length > 0) return
    const els = pickPairs(state.cards, today)
    setCards(makeRound(els))
  }, [hydrated, state.cards, today, cards.length])

  // Countdown
  useEffect(() => {
    if (!running || done) return
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          setDone(true)
          setRunning(false)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, done])

  // Record finish exactly once
  useEffect(() => {
    if (!done || finishedRef.current) return
    finishedRef.current = true
    finishDeck(bestStreak)
  }, [done, bestStreak, finishDeck])

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
  }, [])

  function tap(idx: number) {
    if (!running || done) return
    if (selected.length >= 2) return
    if (matched.has(cards[idx].id)) return
    if (selected.includes(idx)) return
    playSound('ui_tap')

    const next = [...selected, idx]
    setSelected(next)
    if (next.length < 2) return

    const a = cards[next[0]]
    const b = cards[idx]
    if (a.element.atomicNumber === b.element.atomicNumber && a.kind !== b.kind) {
      // Match.
      setMatched(prev => {
        const ns = new Set(prev)
        ns.add(a.id); ns.add(b.id)
        return ns
      })
      setSelected([])
      rateCard(elementCardId(a.element.atomicNumber), true)
      setPairs(p => p + 1)
      setStreak(s => {
        const nxt = s + 1
        setBestStreak(bv => Math.max(bv, nxt))
        return nxt
      })
      // Reload the board once the current round is cleared.
      // After this setState batch resolves, check if all are matched.
      setTimeout(() => {
        setMatched(curr => {
          if (curr.size >= cards.length) {
            const els = pickPairs(state.cards, today)
            setCards(makeRound(els))
            return new Set()
          }
          return curr
        })
      }, 200)
    } else {
      // Wrong.
      setWrong([next[0], idx])
      setStreak(0)
      flashTimerRef.current = setTimeout(() => {
        setSelected([])
        setWrong([])
      }, MISMATCH_FLASH_MS)
    }
  }

  if (!hydrated || cards.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <p style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 7, color: '#84CC16', letterSpacing: 1, opacity: 0.7,
        }}>LOADING...</p>
      </div>
    )
  }

  if (done) {
    return <Summary pairs={pairs} bestStreak={bestStreak} dailyStreak={state.streak.current} onAgain={reset} />
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <Header timeLeft={timeLeft} pairs={pairs} streak={streak} />
      <Grid
        cards={cards}
        matched={matched}
        selected={selected}
        wrong={wrong}
        onTap={tap}
      />
      {!running && (
        <button
          type="button"
          onClick={() => { playSound('ui_tap'); setRunning(true) }}
          className="w-full py-3 text-white active:translate-y-[2px] transition-transform"
          style={{
            maxWidth: 320,
            background: 'linear-gradient(135deg, #84CC16, #65A30D)',
            border: '2px solid #3F6212',
            borderRadius: 3,
            boxShadow: '0 3px 0 #1A2E05',
            fontFamily: '"Press Start 2P"',
            fontSize: 8, letterSpacing: 1.5,
          }}>
          START · {ROUND_SECONDS}s
        </button>
      )}
    </div>
  )
}

function Header({ timeLeft, pairs, streak }: { timeLeft: number; pairs: number; streak: number }) {
  const danger = timeLeft <= 10
  return (
    <div className="grid grid-cols-3 gap-2 w-full" style={{ maxWidth: 320 }}>
      <Pill label="TIME"    value={`${timeLeft}s`} highlight={danger} />
      <Pill label="PAIRS"   value={String(pairs)} />
      <Pill label="STREAK"  value={`${streak}×`} flame={streak >= 5} />
    </div>
  )
}

function Pill({ label, value, highlight, flame }: {
  label: string; value: string; highlight?: boolean; flame?: boolean
}) {
  return (
    <div style={{
      background: '#1A2E05',
      border: `1px solid ${highlight ? '#EF4444' : '#3F6212'}`,
      borderRadius: 3,
      padding: '5px 6px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 5, letterSpacing: 1,
        color: highlight ? '#FCA5A5' : (flame ? '#FBBF24' : '#84CC16'),
        opacity: 0.85,
      }}>{label}</div>
      <div style={{
        marginTop: 3,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 9,
        color: highlight ? '#FCA5A5' : (flame ? '#FBBF24' : '#E8FAD0'),
        textShadow: highlight ? '0 0 6px rgba(239,68,68,0.65)'
                  : (flame ? '0 0 5px rgba(251,191,36,0.55)' : undefined),
      }}>{value}</div>
    </div>
  )
}

function Grid({ cards, matched, selected, wrong, onTap }: {
  cards: Card[]; matched: Set<number>; selected: number[]; wrong: number[]; onTap: (i: number) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 w-full" style={{ maxWidth: 320 }}>
      {cards.map((c, idx) => {
        const isMatched  = matched.has(c.id)
        const isSelected = selected.includes(idx)
        const isWrong    = wrong.includes(idx)
        const accent = CATEGORY_COLORS[c.element.category]
        const textColor = readableText(accent)
        let bg = '#1A2E05'
        let border = '#3F6212'
        let color = '#E8FAD0'
        let shadow = '2px 2px 0 #050a02'
        let opacity = 1
        if (isMatched) {
          bg = accent
          border = 'rgba(0,0,0,0.5)'
          color = textColor
          shadow = '0 0 8px rgba(132,204,22,0.4)'
          opacity = 0.45
        } else if (isWrong) {
          bg = '#7F1D1D'
          border = '#EF4444'
          color = '#FECACA'
          shadow = '2px 2px 0 #450A0A'
        } else if (isSelected) {
          bg = '#365314'
          border = '#BEF264'
          color = '#FFFFFF'
          shadow = '0 0 8px rgba(190,242,100,0.55)'
        }
        const label = c.kind === 'symbol' ? c.element.symbol : c.element.name
        const fontSize = c.kind === 'symbol' ? 14 : 6.5
        return (
          <button
            key={c.id}
            type="button"
            disabled={isMatched}
            onClick={() => onTap(idx)}
            className="active:translate-y-[1px] transition-transform"
            style={{
              height: 56,
              background: bg,
              border: `2px solid ${border}`,
              borderRadius: 3,
              boxShadow: shadow,
              fontFamily: '"Press Start 2P", monospace',
              fontSize,
              color,
              letterSpacing: c.kind === 'symbol' ? 1 : 0.5,
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              wordBreak: 'break-word',
              opacity,
              lineHeight: c.kind === 'symbol' ? 1 : 1.2,
              transition: 'opacity 0.3s ease, box-shadow 0.2s ease',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Summary({ pairs, bestStreak, dailyStreak, onAgain }: {
  pairs: number; bestStreak: number; dailyStreak: number; onAgain: () => void
}) {
  const goldRun = pairs >= 18
  return (
    <div className="flex flex-col items-center px-4 py-8" style={{ maxWidth: 320, margin: '0 auto' }}>
      <p style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 10, letterSpacing: 2, color: '#BEF264',
        textShadow: '0 0 8px rgba(132,204,22,0.5)',
        marginBottom: 24,
      }}>TIME UP</p>
      <div className="grid grid-cols-2 gap-2 w-full mb-4">
        <Stat label="PAIRS" value={String(pairs)} highlight={goldRun} />
        <Stat label="BEST"  value={`${bestStreak}×`} />
      </div>
      <div className="w-full mb-6" style={{
        background: '#10200F',
        border: '1px solid #3F6212',
        borderRadius: 3,
        padding: '8px 10px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 5.5, letterSpacing: 1, color: '#FBBF24',
        }}>DAILY STREAK</div>
        <div style={{
          marginTop: 4,
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 11, color: '#FBBF24',
          textShadow: dailyStreak >= 3 ? '0 0 6px rgba(251,191,36,0.6)' : undefined,
        }}>
          {dailyStreak} {dailyStreak === 1 ? 'DAY' : 'DAYS'}
        </div>
      </div>
      <button
        type="button"
        onClick={onAgain}
        className="w-full py-3 text-white active:translate-y-[2px] transition-transform"
        style={{
          background: 'linear-gradient(135deg, #84CC16, #65A30D)',
          border: '2px solid #3F6212',
          borderRadius: 3,
          boxShadow: '0 3px 0 #1A2E05',
          fontFamily: '"Press Start 2P"',
          fontSize: 8, letterSpacing: 1.5,
        }}>
        PLAY AGAIN
      </button>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: '#1A2E05',
      border: '1px solid #3F6212',
      borderRadius: 3,
      padding: '8px 6px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 5, letterSpacing: 1,
        color: highlight ? '#FBBF24' : '#84CC16', opacity: 0.85,
      }}>{label}</div>
      <div style={{
        marginTop: 4,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 11,
        color: highlight ? '#FBBF24' : '#E8FAD0',
        textShadow: highlight ? '0 0 6px rgba(251,191,36,0.6)' : undefined,
      }}>{value}</div>
    </div>
  )
}
