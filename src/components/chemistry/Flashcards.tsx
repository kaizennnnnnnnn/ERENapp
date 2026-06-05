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

  const [deck, setDeck] = useState<Element[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const finishedRef = useRef(false)

  // Build the first deck once the store is hydrated. We deliberately do
  // NOT rebuild on every state.cards change — that would shift the
  // remaining deck mid-session when a card is rated and graduates.
  useEffect(() => {
    if (!hydrated) return
    if (deck.length > 0) return
    setDeck(buildDeck(state.cards, today))
    finishedRef.current = false
  }, [hydrated, today, state.cards, deck.length])

  const done = deck.length > 0 && index >= deck.length

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
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 7, color: '#84CC16', letterSpacing: 1, opacity: 0.7,
        }}>
          LOADING...
        </p>
      </div>
    )
  }

  if (done) {
    return <DeckSummary
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
      <DueBadge due={dueCount} unseen={newCount} dailyStreak={state.streak.current} />
      <ProgressBar position={index} length={deck.length} streak={streak} />
      <FlipCard
        el={current}
        flipped={flipped}
        onFlip={() => { playSound('ui_tap'); setFlipped(f => !f) }}
        box={state.cards[elementCardId(current.atomicNumber)]?.box ?? 0}
      />
      {flipped ? (
        <div className="grid grid-cols-2 gap-3 w-full" style={{ maxWidth: 320 }}>
          <button
            type="button"
            onClick={() => rate(false)}
            className="py-3 text-white active:translate-y-[2px] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
              border: '2px solid #7F1D1D',
              borderRadius: 3,
              boxShadow: '0 3px 0 #450A0A',
              fontFamily: '"Press Start 2P"',
              fontSize: 8, letterSpacing: 1.5,
            }}>
            WRONG
          </button>
          <button
            type="button"
            onClick={() => rate(true)}
            className="py-3 text-white active:translate-y-[2px] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #84CC16, #65A30D)',
              border: '2px solid #3F6212',
              borderRadius: 3,
              boxShadow: '0 3px 0 #1A2E05',
              fontFamily: '"Press Start 2P"',
              fontSize: 8, letterSpacing: 1.5,
            }}>
            RIGHT
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { playSound('ui_tap'); setFlipped(true) }}
          className="w-full py-3 text-white active:translate-y-[2px] transition-transform"
          style={{
            maxWidth: 320,
            background: '#1A2E05',
            border: '2px solid #84CC16',
            borderRadius: 3,
            boxShadow: '0 3px 0 #050a02',
            fontFamily: '"Press Start 2P"',
            fontSize: 8, letterSpacing: 1.5,
            color: '#BEF264',
          }}>
          FLIP
        </button>
      )}
      <p style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 6, letterSpacing: 1, color: '#84CC16', opacity: 0.7,
      }}>
        {index + 1} / {deck.length}
      </p>
    </div>
  )
}

function DueBadge({ due, unseen, dailyStreak }: { due: number; unseen: number; dailyStreak: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 w-full" style={{ maxWidth: 320 }}>
      <Pill label="DUE"      value={due} />
      <Pill label="NEW"      value={unseen} />
      <Pill label="STREAK"   value={dailyStreak} flame />
    </div>
  )
}

function Pill({ label, value, flame }: { label: string; value: number; flame?: boolean }) {
  return (
    <div style={{
      background: '#1A2E05',
      border: '1px solid #3F6212',
      borderRadius: 3,
      padding: '5px 6px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 5, letterSpacing: 1,
        color: flame ? '#FBBF24' : '#84CC16', opacity: 0.85,
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 3,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 9,
        color: flame ? '#FBBF24' : '#E8FAD0',
        textShadow: flame && value > 0 ? '0 0 5px rgba(251,191,36,0.55)' : undefined,
      }}>
        {value}
      </div>
    </div>
  )
}

function ProgressBar({ position, length, streak }: { position: number; length: number; streak: number }) {
  const pct = (position / length) * 100
  return (
    <div className="w-full" style={{ maxWidth: 320 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
        <span style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 5.5, letterSpacing: 1, color: '#BEF264',
        }}>
          PROGRESS
        </span>
        <span style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 6, letterSpacing: 1, color: streak > 0 ? '#FBBF24' : '#84CC16',
          textShadow: streak >= 5 ? '0 0 6px rgba(251,191,36,0.8)' : undefined,
        }}>
          {streak}× STREAK
        </span>
      </div>
      <div style={{
        height: 8,
        background: '#1A2E05',
        border: '1px solid #3F6212',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #84CC16, #BEF264)',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

function FlipCard({ el, flipped, onFlip, box }: {
  el: Element; flipped: boolean; onFlip: () => void; box: number
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
        maxWidth: 320,
        height: 260,
        perspective: 1200,
        background: 'transparent',
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
            background: '#10200F',
            border: '2px solid #84CC16',
            borderTop: `6px solid ${accent}`,
            borderRadius: 4,
            boxShadow: '4px 4px 0 #050a02',
          }}
        >
          <div style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 7, color: '#84CC16', opacity: 0.7,
            letterSpacing: 1, marginBottom: 14,
          }}>
            #{el.atomicNumber}
          </div>
          <div style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 48,
            color: accent,
            textShadow: `0 0 14px ${accent}66`,
            letterSpacing: 2,
            fontWeight: 700,
          }}>
            {el.symbol}
          </div>
          <div style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 6.5, color: '#E8FAD0', opacity: 0.7,
            letterSpacing: 1, marginTop: 18,
          }}>
            WHAT ELEMENT?
          </div>
        </div>

        {/* Back — answer */}
        <div
          className="absolute inset-0 flex flex-col px-4 py-4"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: '#10200F',
            border: '2px solid #84CC16',
            borderTop: `6px solid ${accent}`,
            borderRadius: 4,
            boxShadow: '4px 4px 0 #050a02',
          }}
        >
          <div className="flex items-baseline gap-2">
            <span style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 18, color: '#BEF264', letterSpacing: 1, fontWeight: 700,
            }}>
              {el.symbol}
            </span>
            <span style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 6, color: '#84CC16', opacity: 0.65,
            }}>
              #{el.atomicNumber}
            </span>
          </div>
          <div style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 11, color: '#E8FAD0', marginTop: 6, letterSpacing: 0.5,
          }}>
            {el.name}
          </div>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            <span style={{
              padding: '3px 6px',
              background: accent, color: accentText,
              border: '1px solid rgba(0,0,0,0.4)', borderRadius: 2,
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 5, letterSpacing: 0.5,
            }}>
              {CATEGORY_LABELS[el.category]}
            </span>
            <span style={{
              padding: '3px 6px',
              background: '#1A2E05', color: '#BEF264',
              border: '1px solid #3F6212', borderRadius: 2,
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 5, letterSpacing: 0.5,
            }}>
              {STATE_LABELS[el.state]}
            </span>
          </div>
          {el.funFact && (
            <p style={{
              marginTop: 10, fontFamily: '"Press Start 2P", monospace',
              fontSize: 6, lineHeight: 1.7, color: '#E8FAD0', opacity: 0.85,
              letterSpacing: 0.3, overflow: 'hidden',
            }}>
              {el.funFact.length > 110 ? el.funFact.slice(0, 107) + '…' : el.funFact}
            </p>
          )}
          {/* Mastery bar — silent for new cards (box=0). */}
          {box > 0 && (
            <div className="mt-auto pt-2">
              <div style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 4.5, letterSpacing: 1, color: '#84CC16', opacity: 0.75,
                marginBottom: 3,
              }}>
                MASTERY · BOX {box}/{MASTERED_BOX}
              </div>
              <div style={{
                height: 5,
                background: '#1A2E05',
                border: '1px solid #3F6212',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${masteryPct}%`,
                  background: box >= MASTERED_BOX ? '#4ade80' : 'linear-gradient(90deg, #1f9462, #22c55e)',
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

function DeckSummary({ total, correct, bestStreak, dailyStreak, onAgain }: {
  total: number; correct: number; bestStreak: number; dailyStreak: number; onAgain: () => void
}) {
  const pct = Math.round((correct / total) * 100)
  const goldRun = pct >= 90
  return (
    <div className="flex flex-col items-center px-4 py-8" style={{ maxWidth: 320, margin: '0 auto' }}>
      <p style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 10, letterSpacing: 2, color: '#BEF264',
        textShadow: '0 0 8px rgba(132,204,22,0.5)',
        marginBottom: 24,
      }}>
        DECK COMPLETE
      </p>
      <div className="grid grid-cols-3 gap-2 w-full mb-4">
        <SummaryStat label="CORRECT" value={`${correct}/${total}`} />
        <SummaryStat label="SCORE"   value={`${pct}%`} highlight={goldRun} />
        <SummaryStat label="BEST"    value={`${bestStreak}×`} />
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
        }}>
          DAILY STREAK
        </div>
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
        NEW DECK
      </button>
    </div>
  )
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
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
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 4,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 9,
        color: highlight ? '#FBBF24' : '#E8FAD0',
        textShadow: highlight ? '0 0 6px rgba(251,191,36,0.6)' : undefined,
      }}>
        {value}
      </div>
    </div>
  )
}

