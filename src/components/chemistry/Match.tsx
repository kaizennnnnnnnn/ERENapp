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
import { CATEGORY_COLORS } from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { dueDate, isDue, isNew, MASTERED_BOX, type CardState } from '@/lib/chemistry/srs'
import { useChemistryTheme, neoShadow, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import { useChemistryMissions } from '@/lib/chemistry/missions'
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
  const { palette } = useChemistryTheme()
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

  useChemistryMissions({ streak, done })

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
          fontFamily: CHEM_FONT,
          fontSize: 14, fontWeight: 600,
          color: palette.fgMuted, letterSpacing: 0.5,
        }}>Loading...</p>
      </div>
    )
  }

  if (done) {
    return (
      <Summary
        pairs={pairs}
        bestStreak={bestStreak}
        dailyStreak={state.streak.current}
        onAgain={reset}
        palette={palette}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <Header timeLeft={timeLeft} pairs={pairs} streak={streak} palette={palette} />
      <Grid
        cards={cards}
        matched={matched}
        selected={selected}
        wrong={wrong}
        onTap={tap}
        palette={palette}
      />
      {!running && (
        <button
          type="button"
          onClick={() => { playSound('ui_tap'); setRunning(true) }}
          className="neo-press w-full"
          style={{
            maxWidth: 340,
            minHeight: 48,
            padding: '12px 20px',
            background: palette.grape,
            color: palette.ink,
            border: `2px solid ${palette.ink}`,
            borderRadius: 999,
            boxShadow: neoShadow(palette.ink, 'md'),
            fontFamily: CHEM_FONT,
            fontSize: 16, fontWeight: 800, letterSpacing: 0.5,
            cursor: 'pointer',
            transition: 'transform 0.08s ease, box-shadow 0.08s ease',
          }}>
          START · {ROUND_SECONDS}s
        </button>
      )}
      <style jsx>{`
        .neo-press:hover {
          transform: translate(1px, 1px);
        }
        .neo-press:active {
          transform: translate(4px, 4px);
          box-shadow: 0 0 0 0 ${palette.ink} !important;
        }
      `}</style>
    </div>
  )
}

function Header({ timeLeft, pairs, streak, palette }: {
  timeLeft: number; pairs: number; streak: number; palette: Palette
}) {
  const danger = timeLeft <= 10
  const flame  = streak >= 5
  return (
    <div className="grid grid-cols-3 gap-2 w-full" style={{ maxWidth: 340 }}>
      <StatCard
        label="TIME"
        value={`${timeLeft}s`}
        palette={palette}
        accentFg={danger ? palette.red : palette.fg}
        accentBg={danger ? palette.redLight : palette.card}
        accentBorder={danger ? palette.red : palette.ink}
      />
      <StatCard
        label="PAIRS"
        value={String(pairs)}
        palette={palette}
        accentFg={palette.fg}
        accentBg={palette.card}
        accentBorder={palette.ink}
      />
      <StatCard
        label="STREAK"
        value={`${streak}×`}
        palette={palette}
        accentFg={flame ? palette.sunDark : palette.fg}
        accentBg={flame ? palette.sunLight : palette.card}
        accentBorder={flame ? palette.sunDark : palette.ink}
      />
    </div>
  )
}

function StatCard({ label, value, palette, accentFg, accentBg, accentBorder }: {
  label: string; value: string; palette: Palette
  accentFg: string; accentBg: string; accentBorder: string
}) {
  return (
    <div style={{
      background: accentBg,
      border: `2px solid ${accentBorder}`,
      borderRadius: 12,
      padding: '8px 6px',
      textAlign: 'center',
      boxShadow: neoShadow(palette.ink, 'sm'),
      fontFamily: CHEM_FONT,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1,
        color: palette.fgMuted,
        textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        marginTop: 2,
        fontSize: 18, fontWeight: 800,
        color: accentFg,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  )
}

function Grid({ cards, matched, selected, wrong, onTap, palette }: {
  cards: Card[]; matched: Set<number>; selected: number[]; wrong: number[]
  onTap: (i: number) => void; palette: Palette
}) {
  return (
    <div className="grid grid-cols-3 gap-2 w-full" style={{ maxWidth: 360 }}>
      {cards.map((c, idx) => {
        const isMatched  = matched.has(c.id)
        const isSelected = selected.includes(idx)
        const isWrong    = wrong.includes(idx)
        const accent = CATEGORY_COLORS[c.element.category]

        let bg     = palette.card
        let border = palette.ink
        let color  = palette.fg
        let shadow: string = neoShadow(palette.ink, 'sm')
        let opacity = 1

        if (isMatched) {
          bg = accent
          border = palette.ink
          color = palette.ink
          shadow = '0 0 0 0 transparent'
          opacity = 0.5
        } else if (isWrong) {
          bg = palette.red
          border = palette.red
          color = palette.ink
          shadow = neoShadow(palette.ink, 'sm')
        } else if (isSelected) {
          bg = palette.grape
          border = palette.ink
          color = palette.ink
          shadow = neoShadow(palette.ink, 'sm')
        }

        const isSymbol = c.kind === 'symbol'
        const label = isSymbol ? c.element.symbol : c.element.name

        return (
          <button
            key={c.id}
            type="button"
            disabled={isMatched}
            onClick={() => onTap(idx)}
            className="match-tile"
            style={{
              minHeight: 60,
              background: bg,
              border: `2px solid ${border}`,
              borderRadius: 12,
              boxShadow: shadow,
              fontFamily: CHEM_FONT,
              fontSize: isSymbol ? 18 : 12,
              fontWeight: isSymbol ? 800 : 700,
              color,
              letterSpacing: isSymbol ? 0.5 : 0.2,
              padding: '6px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              wordBreak: 'break-word',
              opacity,
              lineHeight: isSymbol ? 1 : 1.2,
              cursor: isMatched ? 'default' : 'pointer',
              transition: 'transform 0.08s ease, box-shadow 0.08s ease, opacity 0.3s ease',
            }}
          >
            {label}
          </button>
        )
      })}
      <style jsx>{`
        .match-tile:not(:disabled):hover {
          transform: translate(1px, 1px);
        }
        .match-tile:not(:disabled):active {
          transform: translate(4px, 4px);
          box-shadow: 0 0 0 0 transparent !important;
        }
      `}</style>
    </div>
  )
}

function Summary({ pairs, bestStreak, dailyStreak, onAgain, palette }: {
  pairs: number; bestStreak: number; dailyStreak: number; onAgain: () => void; palette: Palette
}) {
  const goldRun = pairs >= 18
  return (
    <div className="flex flex-col items-center px-4 py-8" style={{ maxWidth: 340, margin: '0 auto', width: '100%' }}>
      <p style={{
        fontFamily: CHEM_FONT,
        fontSize: 14, fontWeight: 700, letterSpacing: 2,
        color: palette.fgMuted,
        textTransform: 'uppercase',
        marginBottom: 12,
      }}>Time Up</p>

      {/* PAIRS hero */}
      <div style={{
        width: '100%',
        background: goldRun ? palette.sunLight : palette.card,
        border: `2px solid ${palette.ink}`,
        borderRadius: 16,
        boxShadow: neoShadow(palette.ink, 'lg'),
        padding: '20px 16px',
        textAlign: 'center',
        marginBottom: 16,
        fontFamily: CHEM_FONT,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
          color: palette.fgMuted,
          textTransform: 'uppercase',
        }}>Pairs</div>
        <div style={{
          marginTop: 6,
          fontSize: 56, fontWeight: 800,
          color: goldRun ? palette.sunDark : palette.fg,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>{pairs}</div>
      </div>

      {/* BEST streak */}
      <div style={{
        width: '100%',
        background: palette.card,
        border: `2px solid ${palette.ink}`,
        borderRadius: 12,
        boxShadow: neoShadow(palette.ink, 'md'),
        padding: '12px 14px',
        marginBottom: 12,
        fontFamily: CHEM_FONT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 1,
          color: palette.fgMuted,
          textTransform: 'uppercase',
        }}>Best Streak</div>
        <div style={{
          fontSize: 22, fontWeight: 800,
          color: palette.fg,
          fontVariantNumeric: 'tabular-nums',
        }}>{bestStreak}×</div>
      </div>

      {/* Daily streak callout */}
      <div style={{
        width: '100%',
        background: palette.sunLight,
        border: `2px solid ${palette.ink}`,
        borderRadius: 12,
        boxShadow: neoShadow(palette.ink, 'md'),
        padding: '12px 14px',
        marginBottom: 20,
        textAlign: 'center',
        fontFamily: CHEM_FONT,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
          color: palette.sunDark,
          textTransform: 'uppercase',
        }}>Daily Streak</div>
        <div style={{
          marginTop: 4,
          fontSize: 20, fontWeight: 800,
          color: palette.sunDark,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}
        </div>
      </div>

      <button
        type="button"
        onClick={onAgain}
        className="neo-press-summary w-full"
        style={{
          minHeight: 48,
          padding: '12px 20px',
          background: palette.grape,
          color: palette.ink,
          border: `2px solid ${palette.ink}`,
          borderRadius: 999,
          boxShadow: neoShadow(palette.ink, 'md'),
          fontFamily: CHEM_FONT,
          fontSize: 16, fontWeight: 800, letterSpacing: 0.5,
          cursor: 'pointer',
          transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        }}>
        Play Again
      </button>
      <style jsx>{`
        .neo-press-summary:hover {
          transform: translate(1px, 1px);
        }
        .neo-press-summary:active {
          transform: translate(4px, 4px);
          box-shadow: 0 0 0 0 ${palette.ink} !important;
        }
      `}</style>
    </div>
  )
}
