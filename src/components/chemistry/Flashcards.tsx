'use client'

// Flashcards — active-recall study loop. Pre-SRS variant for phase 3: a
// shuffled deck of N elements, two-button rate (WRONG / RIGHT), streak
// counter that the daily-mission system will hook into ("get 5 in a row
// correctly") once phase 6 lands. No persistence yet — every deck starts
// fresh; SRS state will park reviews in localStorage in phase 4.
//
// Card front : atomic number + symbol, prompt "what element?"
// Card back  : name + category label + state + fun fact
// Flip via tap; rate via the two bottom buttons (shown after flip).

import { useState } from 'react'
import { elements, CATEGORY_LABELS, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS, STATE_LABELS, readableText } from '@/lib/chemistry/colors'
import { playSound } from '@/lib/sounds'

const DECK_SIZE = 10

function shuffleDeck(): Element[] {
  // Plain Fisher–Yates on a copy of the catalogue, sliced to deck size.
  // We avoid Date.now() / Math.random in module scope, but inside an event
  // handler it's fine — this only runs when the user starts a new deck.
  const arr = [...elements]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, DECK_SIZE)
}

export default function Flashcards() {
  const [deck, setDeck] = useState<Element[]>(() => shuffleDeck())
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const done = index >= deck.length

  const current = deck[index] ?? null

  function rate(isRight: boolean) {
    if (!current || !flipped) return
    playSound('ui_tap')
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
    setDeck(shuffleDeck())
    setIndex(0)
    setFlipped(false)
    setStreak(0)
    setBestStreak(0)
    setCorrect(0)
  }

  if (done) return <DeckSummary total={deck.length} correct={correct} bestStreak={bestStreak} onAgain={reset} />

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <ProgressBar position={index} length={deck.length} streak={streak} />
      <FlipCard
        el={current!}
        flipped={flipped}
        onFlip={() => { playSound('ui_tap'); setFlipped(f => !f) }}
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

function FlipCard({ el, flipped, onFlip }: { el: Element; flipped: boolean; onFlip: () => void }) {
  const accent = CATEGORY_COLORS[el.category]
  const accentText = readableText(accent)

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
              {el.funFact.length > 130 ? el.funFact.slice(0, 127) + '…' : el.funFact}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

function DeckSummary({ total, correct, bestStreak, onAgain }: {
  total: number; correct: number; bestStreak: number; onAgain: () => void
}) {
  const pct = Math.round((correct / total) * 100)
  // celebrate gold colour only on near-perfect runs
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
      <div className="grid grid-cols-3 gap-2 w-full mb-6">
        <SummaryStat label="CORRECT" value={`${correct}/${total}`} />
        <SummaryStat label="SCORE"   value={`${pct}%`} highlight={goldRun} />
        <SummaryStat label="BEST"    value={`${bestStreak}×`} />
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

