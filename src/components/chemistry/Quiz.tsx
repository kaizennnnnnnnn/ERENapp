'use client'

// Quiz — multiple-choice round, 10 questions, two question types alternated
// at random (symbol → name, name → symbol). Picks elements from the SRS
// store's due pool first, then new cards, then random. Every answer feeds
// the same store.rateCard the flashcards use, so a perfect quiz round
// advances the same Leitner boxes as a deck of flashcards. Auto-advances
// ~1 s after each tap so it stays fast on mobile.

import { useEffect, useRef, useState } from 'react'
import { elements, type Element } from '@/lib/chemistry/elements'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { dueDate, isDue, isNew, MASTERED_BOX, type CardState } from '@/lib/chemistry/srs'
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
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 7, color: '#84CC16', letterSpacing: 1, opacity: 0.7,
        }}>LOADING...</p>
      </div>
    )
  }

  if (done) {
    return <Summary
      total={queue.length} correct={correct} bestStreak={bestStreak}
      dailyStreak={state.streak.current} onAgain={reset}
    />
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <Header position={index} length={queue.length} streak={streak} />
      <Prompt q={current!} picked={picked} />
      <Options q={current!} picked={picked} onPick={pick} />
    </div>
  )
}

function Header({ position, length, streak }: { position: number; length: number; streak: number }) {
  const pct = (position / length) * 100
  return (
    <div className="w-full" style={{ maxWidth: 320 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
        <span style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 6, letterSpacing: 1, color: '#BEF264',
        }}>
          {position + 1} / {length}
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
        height: 6,
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

function Prompt({ q, picked }: { q: Question; picked: number | null }) {
  const display = q.type === 'name-from-symbol' ? q.el.symbol : q.el.name
  const ask     = q.type === 'name-from-symbol' ? 'WHICH ELEMENT?' : 'WHICH SYMBOL?'
  return (
    <div
      className="w-full flex flex-col items-center justify-center"
      style={{
        maxWidth: 320,
        background: '#10200F',
        border: '2px solid #84CC16',
        borderRadius: 4,
        boxShadow: '4px 4px 0 #050a02',
        padding: '24px 16px',
      }}
    >
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 6.5, letterSpacing: 1, color: '#84CC16', opacity: 0.7,
        marginBottom: 10,
      }}>
        #{q.el.atomicNumber} · {ask}
      </div>
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: q.type === 'name-from-symbol' ? 36 : 18,
        color: picked !== null
          ? (picked === q.correctIdx ? '#BEF264' : '#FCA5A5')
          : '#BEF264',
        textShadow: '0 0 10px rgba(132,204,22,0.5)',
        letterSpacing: q.type === 'name-from-symbol' ? 2 : 1,
        textAlign: 'center',
      }}>
        {display}
      </div>
    </div>
  )
}

function Options({ q, picked, onPick }: {
  q: Question; picked: number | null; onPick: (i: number) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2 w-full" style={{ maxWidth: 320 }}>
      {q.options.map((opt, i) => {
        let bg = '#1A2E05'
        let border = '#84CC16'
        let color = '#E8FAD0'
        let shadow = '0 3px 0 #050a02'
        if (picked !== null) {
          if (i === q.correctIdx) {
            bg = 'linear-gradient(135deg, #84CC16, #65A30D)'
            border = '#3F6212'
            color = '#FFFFFF'
            shadow = '0 3px 0 #1A2E05'
          } else if (i === picked) {
            bg = 'linear-gradient(135deg, #EF4444, #B91C1C)'
            border = '#7F1D1D'
            color = '#FFFFFF'
            shadow = '0 3px 0 #450A0A'
          } else {
            color = 'rgba(232,250,208,0.4)'
          }
        }
        return (
          <button
            key={i}
            type="button"
            disabled={picked !== null}
            onClick={() => onPick(i)}
            className="py-3 px-4 active:translate-y-[1px] transition-transform"
            style={{
              background: bg,
              border: `2px solid ${border}`,
              borderRadius: 3,
              boxShadow: shadow,
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 8,
              letterSpacing: 1,
              color,
              textAlign: 'left',
            }}
          >
            {String.fromCharCode(65 + i)} · {opt}
          </button>
        )
      })}
    </div>
  )
}

function Summary({ total, correct, bestStreak, dailyStreak, onAgain }: {
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
      }}>QUIZ COMPLETE</p>
      <div className="grid grid-cols-3 gap-2 w-full mb-4">
        <Stat label="CORRECT" value={`${correct}/${total}`} />
        <Stat label="SCORE"   value={`${pct}%`} highlight={goldRun} />
        <Stat label="BEST"    value={`${bestStreak}×`} />
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
        NEW QUIZ
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
        fontSize: 9,
        color: highlight ? '#FBBF24' : '#E8FAD0',
        textShadow: highlight ? '0 0 6px rgba(251,191,36,0.6)' : undefined,
      }}>{value}</div>
    </div>
  )
}

