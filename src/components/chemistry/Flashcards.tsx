'use client'

// Flashcards — active-recall study loop, now backed by the Leitner SRS
// store from src/lib/chemistry/store.tsx. Each WRONG/RIGHT rating moves
// the card between Leitner boxes; reviews persist to localStorage, so a
// returning session finds its due cards already queued up.
//
// Deck-build strategy (DECK_SIZE = 10):
//   1. take every card that's due today (started + interval elapsed),
//      oldest-due first
//   2. fill the remainder with new (never-reviewed) cards in random order
//   3. if still short (nothing left), pad with the next-soonest-due
//
// Daily streak: a deck finish calls store.finishDeck(bestSessionStreak),
// which bumps the streak only on the first deck of a calendar day.

import { useEffect, useRef, useState } from 'react'
import { elements, CATEGORY_LABELS, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS, STATE_LABELS, readableText } from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { dueDate, isDue, isNew, MASTERED_BOX, type CardState } from '@/lib/chemistry/srs'
import { playSound } from '@/lib/sounds'
import { useChemistryTheme, neoShadow, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import { useChemistryMissions } from '@/lib/chemistry/missions'

const DECK_SIZE = 10

function shuffle<T>(arr: T[]): T[] {
  // Plain Fisher–Yates. Random in an event-driven path is fine; the
  // workflow harness restriction is on script-scope Math.random only.
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildDeck(cards: Record<string, CardState>, today: string): Element[] {
  const dueList: { el: Element; dueOn: string }[] = []
  const newList: Element[] = []
  const futureList: { el: Element; dueOn: string }[] = []

  for (const el of elements) {
    const cardId = elementCardId(el.atomicNumber)
    const card = cards[cardId]
    if (isDue(card, today)) {
      const dueOn = card?.lastReviewed ? (dueDate(card) ?? today) : today
      dueList.push({ el, dueOn })
    } else if (isNew(card)) {
      newList.push(el)
    } else if (card && card.box < MASTERED_BOX) {
      // Started but not due yet — keep around as a fallback in case the
      // due + new pools combined don't fill DECK_SIZE (rare once the user
      // has a few mastered).
      const dueOn = dueDate(card) ?? today
      futureList.push({ el, dueOn })
    }
  }

  dueList.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  futureList.sort((a, b) => a.dueOn.localeCompare(b.dueOn))

  const deck: Element[] = []
  for (const d of dueList) {
    if (deck.length >= DECK_SIZE) break
    deck.push(d.el)
  }
  if (deck.length < DECK_SIZE) {
    const shuffled = shuffle(newList)
    for (const e of shuffled) {
      if (deck.length >= DECK_SIZE) break
      deck.push(e)
    }
  }
  if (deck.length < DECK_SIZE) {
    for (const f of futureList) {
      if (deck.length >= DECK_SIZE) break
      deck.push(f.el)
    }
  }
  return deck
}

export default function Flashcards() {
  const { hydrated, state, today, rateCard, finishDeck, dueCount, newCount } = useChemistryStore()
  const { palette } = useChemistryTheme()

  const [deck, setDeck] = useState<Element[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const finishedRef = useRef(false)

  const done = deck.length > 0 && index >= deck.length
  useChemistryMissions({ streak, done })

  // Build the first deck once the store is hydrated. We deliberately do
  // NOT rebuild on every state.cards change — that would shift the
  // remaining deck mid-session when a card is rated and graduates.
  useEffect(() => {
    if (!hydrated) return
    if (deck.length > 0) return
    setDeck(buildDeck(state.cards, today))
    finishedRef.current = false
  }, [hydrated, today, state.cards, deck.length])

  // Record the deck completion exactly once when we cross the boundary.
  useEffect(() => {
    if (!done || finishedRef.current) return
    finishedRef.current = true
    finishDeck(bestStreak)
  }, [done, bestStreak, finishDeck])

  function rate(isRight: boolean) {
    const current = deck[index]
    if (!current || !flipped) return
    playSound('ui_tap')
    rateCard(elementCardId(current.atomicNumber), isRight)
    if (isRight) {
      setCorrect(c => c + 1)
      setStreak(s => {
        const next = s + 1
        setBestStreak(b => Math.max(b, next))
        return next
      })
    } else {
      setStreak(0)
    }
    setFlipped(false)
    setIndex(i => i + 1)
  }

  function reset() {
    playSound('ui_tap')
    setDeck(buildDeck(state.cards, today))
    setIndex(0)
    setFlipped(false)
    setStreak(0)
    setBestStreak(0)
    setCorrect(0)
    finishedRef.current = false
  }

  if (!hydrated || deck.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <p style={{
          fontFamily: CHEM_FONT,
          fontSize: 14, color: palette.fgMuted, fontWeight: 600,
        }}>
          Loading…
        </p>
      </div>
    )
  }

  if (done) {
    return <DeckSummary
      palette={palette}
      total={deck.length}
      correct={correct}
      bestStreak={bestStreak}
      dailyStreak={state.streak.current}
      onAgain={reset}
    />
  }

  const current = deck[index]

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <DueBadge palette={palette} due={dueCount} unseen={newCount} dailyStreak={state.streak.current} />
      <ProgressBar palette={palette} position={index} length={deck.length} streak={streak} />
      <FlipCard
        palette={palette}
        el={current}
        flipped={flipped}
        onFlip={() => { playSound('ui_tap'); setFlipped(f => !f) }}
        box={state.cards[elementCardId(current.atomicNumber)]?.box ?? 0}
      />
      {flipped ? (
        <div className="grid grid-cols-2 gap-3 w-full" style={{ maxWidth: 340 }}>
          <NeoButton
            palette={palette}
            onClick={() => rate(false)}
            bg={palette.red}
            color={palette.ink}
            label="Wrong"
          />
          <NeoButton
            palette={palette}
            onClick={() => rate(true)}
            bg={palette.green}
            color={palette.ink}
            label="Right"
          />
        </div>
      ) : (
        <NeoButton
          palette={palette}
          onClick={() => { playSound('ui_tap'); setFlipped(true) }}
          bg={palette.grape}
          color={palette.ink}
          label="Flip"
          fullWidth
        />
      )}
      <p style={{
        fontFamily: CHEM_FONT,
        fontSize: 12, color: palette.fgMuted, fontWeight: 600,
      }}>
        {index + 1} / {deck.length}
      </p>
    </div>
  )
}

function NeoButton({ palette, onClick, bg, color, label, fullWidth }: {
  palette: Palette
  onClick: () => void
  bg: string
  color: string
  label: string
  fullWidth?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="neo-press"
      style={{
        width: fullWidth ? '100%' : undefined,
        maxWidth: fullWidth ? 340 : undefined,
        padding: '14px 20px',
        background: bg,
        color,
        border: `2px solid ${palette.ink}`,
        borderRadius: 999,
        boxShadow: neoShadow(palette.ink, 'md'),
        fontFamily: CHEM_FONT,
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: 0.3,
        cursor: 'pointer',
        minHeight: 48,
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
      }}>
      {label}
      <style jsx>{`
        button.neo-press:hover {
          transform: translate(1px, 1px);
          box-shadow: 3px 3px 0 0 ${palette.ink};
        }
        button.neo-press:active {
          transform: translate(4px, 4px);
          box-shadow: 0 0 0 0 ${palette.ink};
        }
      `}</style>
    </button>
  )
}

function DueBadge({ palette, due, unseen, dailyStreak }: {
  palette: Palette; due: number; unseen: number; dailyStreak: number
}) {
  return (
    <div className="grid grid-cols-3 gap-2 w-full" style={{ maxWidth: 340 }}>
      <Pill palette={palette} label="Due"    value={due} />
      <Pill palette={palette} label="New"    value={unseen} />
      <Pill palette={palette} label="Streak" value={dailyStreak} warm={dailyStreak > 0} />
    </div>
  )
}

function Pill({ palette, label, value, warm }: {
  palette: Palette; label: string; value: number; warm?: boolean
}) {
  return (
    <div style={{
      background: warm ? palette.sunLight : palette.card,
      border: `2px solid ${palette.ink}`,
      borderRadius: 14,
      padding: '8px 10px',
      textAlign: 'center',
      boxShadow: neoShadow(palette.ink, 'sm'),
    }}>
      <div style={{
        fontFamily: CHEM_FONT,
        fontSize: 11, color: palette.fgMuted, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 2,
        fontFamily: CHEM_FONT,
        fontSize: 20,
        fontWeight: 800,
        color: warm ? palette.sunDark : palette.fg,
      }}>
        {value}
      </div>
    </div>
  )
}

function ProgressBar({ palette, position, length, streak }: {
  palette: Palette; position: number; length: number; streak: number
}) {
  const pct = (position / length) * 100
  const streakHot = streak >= 5
  return (
    <div className="w-full flex items-center gap-2" style={{ maxWidth: 340 }}>
      {/* Pill progress bar */}
      <div style={{
        flex: 1,
        height: 28,
        background: palette.card,
        border: `2px solid ${palette.ink}`,
        borderRadius: 999,
        boxShadow: neoShadow(palette.ink, 'sm'),
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          width: `${pct}%`,
          background: palette.grape,
          transition: 'width 0.3s ease',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: CHEM_FONT,
          fontSize: 12,
          fontWeight: 700,
          // Sits over both the grape fill AND the dark cardMuted unfilled
          // section — fg reads on both, ink only on the bright fill.
          color: palette.fg,
        }}>
          {position} / {length}
        </div>
      </div>

      {/* Streak pill. Active (sun bg) keeps ink text; inactive (card bg)
          switches to fg because card is dark in dark mode. */}
      <div style={{
        padding: '6px 12px',
        background: streakHot ? palette.sun : palette.card,
        border: `2px solid ${palette.ink}`,
        borderRadius: 999,
        boxShadow: neoShadow(palette.ink, 'sm'),
        fontFamily: CHEM_FONT,
        fontSize: 12,
        fontWeight: 800,
        color: streakHot ? palette.ink : palette.fg,
        whiteSpace: 'nowrap',
        minHeight: 28,
        display: 'flex',
        alignItems: 'center',
      }}>
        {streak}× streak
      </div>
    </div>
  )
}

function FlipCard({ palette, el, flipped, onFlip, box }: {
  palette: Palette; el: Element; flipped: boolean; onFlip: () => void; box: number
}) {
  const accent = CATEGORY_COLORS[el.category]
  const accentText = readableText(accent)
  const masteryPct = (Math.min(box, MASTERED_BOX) / MASTERED_BOX) * 100

  return (
    <button
      type="button"
      onClick={onFlip}
      aria-label="Flip card"
      className="relative block w-full"
      style={{
        maxWidth: 340,
        height: 300,
        perspective: 1200,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front — symbol */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            background: palette.card,
            border: `2px solid ${palette.ink}`,
            borderTop: `6px solid ${accent}`,
            borderRadius: 16,
            boxShadow: neoShadow(palette.ink, 'lg'),
            padding: '20px 16px',
          }}
        >
          <div style={{
            fontFamily: CHEM_FONT,
            fontSize: 14,
            color: palette.fgMuted,
            fontWeight: 600,
            marginBottom: 10,
          }}>
            #{el.atomicNumber}
          </div>
          <div style={{
            fontFamily: CHEM_FONT,
            fontSize: 64,
            color: palette.fg,
            fontWeight: 800,
            lineHeight: 1,
          }}>
            {el.symbol}
          </div>
          <div style={{
            fontFamily: CHEM_FONT,
            fontSize: 14,
            color: palette.fgMuted,
            fontWeight: 500,
            marginTop: 18,
          }}>
            What element is this?
          </div>
        </div>

        {/* Back — answer */}
        <div
          className="absolute inset-0 flex flex-col px-5 py-5"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: palette.card,
            border: `2px solid ${palette.ink}`,
            borderTop: `6px solid ${accent}`,
            borderRadius: 16,
            boxShadow: neoShadow(palette.ink, 'lg'),
          }}
        >
          <div className="flex items-baseline gap-2">
            <span style={{
              fontFamily: CHEM_FONT,
              fontSize: 28,
              color: palette.fg,
              fontWeight: 800,
              lineHeight: 1,
            }}>
              {el.symbol}
            </span>
            <span style={{
              fontFamily: CHEM_FONT,
              fontSize: 13,
              color: palette.fgMuted,
              fontWeight: 600,
            }}>
              #{el.atomicNumber}
            </span>
          </div>
          <div style={{
            fontFamily: CHEM_FONT,
            fontSize: 22,
            color: palette.fg,
            fontWeight: 800,
            marginTop: 4,
          }}>
            {el.name}
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span style={{
              padding: '4px 10px',
              background: accent,
              color: accentText,
              border: `2px solid ${palette.ink}`,
              borderRadius: 999,
              boxShadow: neoShadow(palette.ink, 'sm'),
              fontFamily: CHEM_FONT,
              fontSize: 11,
              fontWeight: 700,
            }}>
              {CATEGORY_LABELS[el.category]}
            </span>
            <span style={{
              padding: '4px 10px',
              background: palette.skyLight,
              color: palette.fg,
              border: `2px solid ${palette.ink}`,
              borderRadius: 999,
              boxShadow: neoShadow(palette.ink, 'sm'),
              fontFamily: CHEM_FONT,
              fontSize: 11,
              fontWeight: 700,
            }}>
              {STATE_LABELS[el.state]}
            </span>
          </div>
          {el.funFact && (
            <p style={{
              marginTop: 10,
              fontFamily: CHEM_FONT,
              fontSize: 12,
              lineHeight: 1.5,
              color: palette.fgMuted,
              fontWeight: 500,
              overflow: 'hidden',
            }}>
              {el.funFact.length > 130 ? el.funFact.slice(0, 127) + '…' : el.funFact}
            </p>
          )}
          {/* Mastery bar — silent for new cards (box=0). */}
          {box > 0 && (
            <div className="mt-auto pt-3">
              <div style={{
                fontFamily: CHEM_FONT,
                fontSize: 10,
                fontWeight: 700,
                color: palette.fgMuted,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 5,
              }}>
                Mastery · Box {box}/{MASTERED_BOX}
              </div>
              <div style={{
                height: 14,
                background: palette.cardMuted,
                border: `2px solid ${palette.ink}`,
                borderRadius: 999,
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${masteryPct}%`,
                  background: palette.green,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function DeckSummary({ palette, total, correct, bestStreak, dailyStreak, onAgain }: {
  palette: Palette
  total: number; correct: number; bestStreak: number; dailyStreak: number; onAgain: () => void
}) {
  const pct = Math.round((correct / total) * 100)
  const goldRun = pct >= 90
  return (
    <div className="flex flex-col items-center px-4 py-8" style={{ maxWidth: 340, margin: '0 auto' }}>
      <p style={{
        fontFamily: CHEM_FONT,
        fontSize: 26,
        fontWeight: 800,
        color: palette.fg,
        marginBottom: 6,
        letterSpacing: -0.5,
      }}>
        Deck complete
      </p>
      <p style={{
        fontFamily: CHEM_FONT,
        fontSize: 14,
        fontWeight: 500,
        color: palette.fgMuted,
        marginBottom: 20,
      }}>
        Nice work — here&apos;s how it went.
      </p>
      <div className="grid grid-cols-3 gap-2 w-full mb-4">
        <SummaryStat palette={palette} label="Correct" value={`${correct}/${total}`} />
        <SummaryStat palette={palette} label="Score"   value={`${pct}%`} highlight={goldRun} />
        <SummaryStat palette={palette} label="Best"    value={`${bestStreak}×`} />
      </div>
      <div className="w-full mb-6" style={{
        background: palette.sunLight,
        border: `2px solid ${palette.ink}`,
        borderRadius: 14,
        padding: '12px 14px',
        textAlign: 'center',
        boxShadow: neoShadow(palette.ink, 'md'),
      }}>
        <div style={{
          fontFamily: CHEM_FONT,
          fontSize: 11,
          fontWeight: 700,
          color: palette.fgMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>
          Daily streak
        </div>
        <div style={{
          marginTop: 4,
          fontFamily: CHEM_FONT,
          fontSize: 22,
          fontWeight: 800,
          color: palette.sunDark,
        }}>
          {dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}
        </div>
      </div>
      <NeoButton
        palette={palette}
        onClick={onAgain}
        bg={palette.grape}
        color={palette.ink}
        label="New deck"
        fullWidth
      />
    </div>
  )
}

function SummaryStat({ palette, label, value, highlight }: {
  palette: Palette; label: string; value: string; highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? palette.sunLight : palette.card,
      border: `2px solid ${palette.ink}`,
      borderRadius: 14,
      padding: '10px 8px',
      textAlign: 'center',
      boxShadow: neoShadow(palette.ink, 'sm'),
    }}>
      <div style={{
        fontFamily: CHEM_FONT,
        fontSize: 10,
        fontWeight: 700,
        color: palette.fgMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 4,
        fontFamily: CHEM_FONT,
        fontSize: 16,
        fontWeight: 800,
        color: highlight ? palette.sunDark : palette.fg,
      }}>
        {value}
      </div>
    </div>
  )
}
