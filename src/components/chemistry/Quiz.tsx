'use client'

// Quiz — multiple-choice round, 10 questions, two question types alternated
// at random (symbol → name, name → symbol). Picks elements from the SRS
// store's due pool first, then new cards, then random. Every answer feeds
// the same store.rateCard the flashcards use, so a perfect quiz round
// advances the same Leitner boxes as a deck of flashcards. Auto-advances
// ~1 s after each tap so it stays fast on mobile.
//
// Visual layer: AminaChemistry neo-brutalism — cream paper bg, ink
// borders + hard offset shadows, rounded ui-rounded/Quicksand font, brand
// trio grape/sky/sun. The category accent shows up as a top stripe on
// the question card.

import { useEffect, useRef, useState } from 'react'
import { elements, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS } from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { dueDate, isDue, isNew, MASTERED_BOX, type CardState } from '@/lib/chemistry/srs'
import { useChemistryTheme, neoShadow, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import { playSound } from '@/lib/sounds'

const QUEUE_SIZE = 10
const FEEDBACK_MS = 1000

type QType = 'name-from-symbol' | 'symbol-from-name'

interface Question {
  el: Element
  type: QType
  options: string[]   // 4 options; one is the right answer
  correctIdx: number  // index of right answer in `options`
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickQueue(cards: Record<string, CardState>, today: string): Element[] {
  const due: { el: Element; dueOn: string }[] = []
  const fresh: Element[] = []
  const learning: { el: Element; dueOn: string }[] = []
  for (const el of elements) {
    const card = cards[elementCardId(el.atomicNumber)]
    if (isDue(card, today)) {
      due.push({ el, dueOn: dueDate(card!) ?? today })
    } else if (isNew(card)) {
      fresh.push(el)
    } else if (card && card.box < MASTERED_BOX) {
      learning.push({ el, dueOn: dueDate(card) ?? today })
    }
  }
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const queue: Element[] = []
  for (const d of due)      { if (queue.length >= QUEUE_SIZE) break; queue.push(d.el) }
  if (queue.length < QUEUE_SIZE) {
    for (const f of shuffle(fresh)) { if (queue.length >= QUEUE_SIZE) break; queue.push(f) }
  }
  if (queue.length < QUEUE_SIZE) {
    for (const l of learning) { if (queue.length >= QUEUE_SIZE) break; queue.push(l.el) }
  }
  return queue
}

function makeQuestion(el: Element): Question {
  const type: QType = Math.random() < 0.5 ? 'name-from-symbol' : 'symbol-from-name'
  // Pick 3 wrong options of the same "shape" (other elements, sliced from a
  // shuffled copy of the catalogue minus the answer). Sticking to other
  // real elements is more interesting than random strings.
  const pool = shuffle(elements.filter(e => e.atomicNumber !== el.atomicNumber)).slice(0, 3)
  const correct = type === 'name-from-symbol' ? el.name : el.symbol
  const wrong   = pool.map(e => type === 'name-from-symbol' ? e.name : e.symbol)
  const all     = shuffle([correct, ...wrong])
  return { el, type, options: all, correctIdx: all.indexOf(correct) }
}

export default function Quiz() {
  const { hydrated, state, today, rateCard, finishDeck } = useChemistryStore()
  const { palette } = useChemistryTheme()
  const [queue, setQueue] = useState<Element[]>([])
  const [index, setIndex] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (!hydrated) return
    if (queue.length > 0) return
    const q = pickQueue(state.cards, today)
    setQueue(q)
    setQuestions(q.map(makeQuestion))
    finishedRef.current = false
  }, [hydrated, today, state.cards, queue.length])

  const done = queue.length > 0 && index >= queue.length
  const current = !done && questions[index] ? questions[index] : null

  useEffect(() => {
    if (!done || finishedRef.current) return
    finishedRef.current = true
    finishDeck(bestStreak)
  }, [done, bestStreak, finishDeck])

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
  }, [])

  function pick(i: number) {
    if (!current || picked !== null) return
    playSound('ui_tap')
    setPicked(i)
    const isRight = i === current.correctIdx
    rateCard(elementCardId(current.el.atomicNumber), isRight)
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
    advanceTimer.current = setTimeout(() => {
      setPicked(null)
      setIndex(i => i + 1)
    }, FEEDBACK_MS)
  }

  function reset() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    playSound('ui_tap')
    const q = pickQueue(state.cards, today)
    setQueue(q)
    setQuestions(q.map(makeQuestion))
    setIndex(0)
    setPicked(null)
    setStreak(0)
    setBestStreak(0)
    setCorrect(0)
    finishedRef.current = false
  }

  if (!hydrated || queue.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <p style={{
          fontFamily: CHEM_FONT,
          fontSize: 13, fontWeight: 600, color: palette.fgMuted, letterSpacing: 0.5,
        }}>
          Loading…
        </p>
      </div>
    )
  }

  if (done) {
    return <Summary
      palette={palette}
      total={queue.length} correct={correct} bestStreak={bestStreak}
      dailyStreak={state.streak.current} onAgain={reset}
    />
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <Header palette={palette} position={index} length={queue.length} streak={streak} />
      <Prompt palette={palette} q={current!} picked={picked} />
      <Options palette={palette} q={current!} picked={picked} onPick={pick} />
    </div>
  )
}

function Header({ palette, position, length, streak }: {
  palette: Palette; position: number; length: number; streak: number
}) {
  const pct = (position / length) * 100
  const streakActive = streak > 0
  return (
    <div className="w-full flex items-center gap-3" style={{ maxWidth: 340 }}>
      {/* Progress bar — ink-bordered pill, grape fill */}
      <div
        className="flex-1"
        style={{
          height: 18,
          background: palette.cardMuted,
          border: `2px solid ${palette.ink}`,
          borderRadius: 999,
          boxShadow: neoShadow(palette.ink, 'sm'),
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: palette.grape,
          borderRight: pct > 0 && pct < 100 ? `2px solid ${palette.ink}` : 'none',
          transition: 'width 0.3s ease',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: CHEM_FONT,
          fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
          color: palette.ink,
        }}>
          {position + 1} / {length}
        </div>
      </div>

      {/* Streak pill */}
      <div style={{
        background: streakActive ? palette.sun : palette.card,
        border: `2px solid ${palette.ink}`,
        borderRadius: 999,
        boxShadow: neoShadow(palette.ink, 'sm'),
        padding: '4px 10px',
        fontFamily: CHEM_FONT,
        fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
        color: palette.ink,
        whiteSpace: 'nowrap',
      }}>
        {streak}× streak
      </div>
    </div>
  )
}

function Prompt({ palette, q, picked }: { palette: Palette; q: Question; picked: number | null }) {
  const display = q.type === 'name-from-symbol' ? q.el.symbol : q.el.name
  const ask     = q.type === 'name-from-symbol' ? 'Which element?' : 'Which symbol?'
  const accent  = CATEGORY_COLORS[q.el.category]
  const isBigSymbol = q.type === 'name-from-symbol'

  return (
    <div
      className="w-full flex flex-col items-center justify-center"
      style={{
        maxWidth: 340,
        background: palette.card,
        border: `2px solid ${palette.ink}`,
        borderTop: `8px solid ${palette.ink}`,
        borderRadius: 16,
        boxShadow: neoShadow(palette.ink, 'md'),
        padding: '20px 18px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Category accent stripe sitting just under the ink top border */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 6,
        background: accent,
      }} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 4, marginBottom: 12,
      }}>
        <span style={{
          fontFamily: CHEM_FONT,
          fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          color: palette.ink,
          background: palette.cardMuted,
          border: `2px solid ${palette.ink}`,
          borderRadius: 999,
          padding: '2px 10px',
        }}>
          #{q.el.atomicNumber}
        </span>
        <span style={{
          fontFamily: CHEM_FONT,
          fontSize: 13, fontWeight: 600, color: palette.fgMuted,
        }}>
          {ask}
        </span>
      </div>

      <div style={{
        fontFamily: CHEM_FONT,
        fontSize: isBigSymbol ? 64 : 28,
        lineHeight: 1.05,
        fontWeight: 800,
        color: picked !== null
          ? (picked === q.correctIdx ? palette.grapeDark : palette.red)
          : palette.fg,
        letterSpacing: isBigSymbol ? 1 : 0.3,
        textAlign: 'center',
        padding: isBigSymbol ? '12px 0 6px' : '4px 0 6px',
      }}>
        {display}
      </div>
    </div>
  )
}

function Options({ palette, q, picked, onPick }: {
  palette: Palette; q: Question; picked: number | null; onPick: (i: number) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 w-full" style={{ maxWidth: 340 }}>
      {q.options.map((opt, i) => {
        const settled = picked !== null
        const isCorrect = i === q.correctIdx
        const isPicked  = i === picked

        let bg     = palette.card
        let color  = palette.fg
        let prefixBg    = palette.cardMuted
        let prefixColor = palette.ink
        let opacity = 1

        if (settled) {
          if (isCorrect) {
            bg = palette.green
            color = palette.ink
            prefixBg = palette.ink
            prefixColor = palette.green
          } else if (isPicked) {
            bg = palette.red
            color = '#FFFFFF'
            prefixBg = palette.ink
            prefixColor = palette.red
          } else {
            opacity = 0.5
          }
        }

        return (
          <button
            key={i}
            type="button"
            disabled={settled}
            onClick={() => onPick(i)}
            className="active:translate-x-[4px] active:translate-y-[4px]"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              minHeight: 56,
              width: '100%',
              background: bg,
              border: `2px solid ${palette.ink}`,
              borderRadius: 12,
              boxShadow: settled && !isCorrect && !isPicked
                ? neoShadow(palette.ink, 'sm')
                : neoShadow(palette.ink, 'md'),
              fontFamily: CHEM_FONT,
              fontSize: 15,
              fontWeight: 700,
              color,
              textAlign: 'left',
              cursor: settled ? 'default' : 'pointer',
              opacity,
              transition: 'transform 0.08s ease, box-shadow 0.08s ease, opacity 0.2s ease',
            }}
            onMouseDown={e => {
              if (settled) return
              e.currentTarget.style.boxShadow = 'none'
            }}
            onMouseUp={e => {
              if (settled) return
              e.currentTarget.style.boxShadow = neoShadow(palette.ink, 'md')
            }}
            onMouseLeave={e => {
              if (settled) return
              e.currentTarget.style.boxShadow = neoShadow(palette.ink, 'md')
            }}
          >
            <span style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              background: prefixBg,
              color: prefixColor,
              border: `2px solid ${palette.ink}`,
              borderRadius: 8,
              fontFamily: CHEM_FONT,
              fontSize: 14,
              fontWeight: 800,
            }}>
              {String.fromCharCode(65 + i)}
            </span>
            <span style={{ flex: 1, lineHeight: 1.2 }}>{opt}</span>
          </button>
        )
      })}
    </div>
  )
}

function Summary({ palette, total, correct, bestStreak, dailyStreak, onAgain }: {
  palette: Palette
  total: number; correct: number; bestStreak: number; dailyStreak: number; onAgain: () => void
}) {
  const pct = Math.round((correct / total) * 100)
  const goldRun = pct >= 90
  return (
    <div className="flex flex-col items-center px-4 py-8" style={{ maxWidth: 340, margin: '0 auto' }}>
      <p style={{
        fontFamily: CHEM_FONT,
        fontSize: 26, fontWeight: 800, letterSpacing: 0.3, color: palette.fg,
        marginBottom: 6,
      }}>
        Quiz complete
      </p>
      <p style={{
        fontFamily: CHEM_FONT,
        fontSize: 14, fontWeight: 500, color: palette.fgMuted,
        marginBottom: 22,
      }}>
        Nice work — every answer fed your SRS deck.
      </p>

      <div className="grid grid-cols-3 gap-3 w-full" style={{ marginBottom: 16 }}>
        <Stat palette={palette} label="Correct" value={`${correct}/${total}`} />
        <Stat palette={palette} label="Score"   value={`${pct}%`} highlight={goldRun} />
        <Stat palette={palette} label="Best"    value={`${bestStreak}×`} />
      </div>

      <div className="w-full" style={{
        background: palette.sunLight,
        border: `2px solid ${palette.ink}`,
        borderRadius: 14,
        boxShadow: neoShadow(palette.ink, 'md'),
        padding: '12px 14px',
        textAlign: 'center',
        marginBottom: 24,
      }}>
        <div style={{
          fontFamily: CHEM_FONT,
          fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
          color: palette.fgMuted,
          textTransform: 'uppercase',
        }}>
          Daily streak
        </div>
        <div style={{
          marginTop: 4,
          fontFamily: CHEM_FONT,
          fontSize: 24, fontWeight: 800,
          color: palette.ink,
        }}>
          {dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}
        </div>
      </div>

      <button
        type="button"
        onClick={onAgain}
        className="w-full active:translate-x-[4px] active:translate-y-[4px]"
        style={{
          padding: '14px 18px',
          background: palette.grape,
          color: palette.ink,
          border: `2px solid ${palette.ink}`,
          borderRadius: 999,
          boxShadow: neoShadow(palette.ink, 'md'),
          fontFamily: CHEM_FONT,
          fontSize: 15, fontWeight: 800, letterSpacing: 0.4,
          cursor: 'pointer',
          transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        }}
        onMouseDown={e => { e.currentTarget.style.boxShadow = 'none' }}
        onMouseUp={e => { e.currentTarget.style.boxShadow = neoShadow(palette.ink, 'md') }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = neoShadow(palette.ink, 'md') }}
      >
        New quiz
      </button>
    </div>
  )
}

function Stat({ palette, label, value, highlight }: {
  palette: Palette; label: string; value: string; highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? palette.sun : palette.card,
      border: `2px solid ${palette.ink}`,
      borderRadius: 12,
      boxShadow: neoShadow(palette.ink, 'sm'),
      padding: '10px 6px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: CHEM_FONT,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        color: highlight ? palette.ink : palette.fgMuted,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 4,
        fontFamily: CHEM_FONT,
        fontSize: 18, fontWeight: 800,
        color: highlight ? palette.ink : palette.fg,
      }}>
        {value}
      </div>
    </div>
  )
}
