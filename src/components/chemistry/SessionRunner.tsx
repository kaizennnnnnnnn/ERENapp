'use client'

// SessionRunner — the shared body for Review and Learn (and anything else
// that needs "show a question, take an MC answer, feedback, advance").
// Builds questions from an Element[] passed in by the caller; on each
// answer it calls store.rateCard so SRS state updates. Ends with a
// retry/done summary card.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X, Flame, CheckCircle2, Target } from 'lucide-react'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { useChemistryTheme, CHEM_FONT, neoShadow, type Palette } from '@/lib/chemistry/theme'
import { useChemistryMissions } from '@/lib/chemistry/missions'
import { playSound } from '@/lib/sounds'
import { makeQuestion, type Question } from '@/lib/chemistry/questions'
import type { Element } from '@/lib/chemistry/elements'

interface Props {
  title: string
  subtitle: string
  /** Cards to study this session. */
  cards: Element[]
  /** "Symbol → Name" badge text shown next to the progress count. */
  typeLabel?: string
  /** "All caught up" empty-state title + body when cards is empty. */
  emptyTitle: string
  emptyBody: string
  /** Restart with a fresh queue (caller controls regeneration). */
  onRestart: () => void
  /** Return to the dashboard (Home tile / overlay). */
  onExit: () => void
}

interface ResultRow {
  q: Question
  given: string
  correct: boolean
}

export default function SessionRunner({
  title, subtitle, cards, typeLabel,
  emptyTitle, emptyBody,
  onRestart, onExit,
}: Props) {
  const { palette } = useChemistryTheme()
  const { rateCard, finishDeck } = useChemistryStore()

  // The active deck defaults to whatever queue the parent hands us, but
  // "Retry missed" swaps in just the wrong answers so they can be redone
  // without relying on the SRS due-queue (empty right after a session — the
  // cause of the "all caught up" screen on Retry).
  const [deck, setDeck] = useState<Element[]>(cards)
  useEffect(() => { setDeck(cards) }, [cards])

  // Lock the question list to the active deck so re-renders don't reshuffle.
  const questions = useMemo<Question[]>(
    () => deck.map(el => makeQuestion(el)),
    [deck],
  )

  const [idx, setIdx]         = useState(0)
  const [phase, setPhase]     = useState<'answering' | 'feedback' | 'done'>('answering')
  const [given, setGiven]     = useState<string | null>(null)
  const [results, setResults] = useState<ResultRow[]>([])
  const [streak, setStreak]   = useState(0)
  const bestStreakRef         = useRef(0)
  // 5-in-a-row mission signal — wired to the global task system.
  useChemistryMissions({ streak, done: phase === 'done' })

  // Reset all session state whenever the active deck changes — a new queue
  // from the parent (new dues) or a "Retry missed" swap both land here.
  useEffect(() => {
    setIdx(0)
    setPhase('answering')
    setGiven(null)
    setResults([])
    setStreak(0)
    bestStreakRef.current = 0
  }, [deck])

  function submit(option: string) {
    if (phase !== 'answering') return
    const q = questions[idx]
    const correct = option === q.answer
    setGiven(option)
    setPhase('feedback')
    setResults(rs => [...rs, { q, given: option, correct }])
    rateCard(elementCardId(q.el.atomicNumber), correct)
    if (correct) {
      playSound('ui_tap')
      const next = streak + 1
      setStreak(next)
      if (next > bestStreakRef.current) bestStreakRef.current = next
    } else {
      playSound('ui_tap')
      setStreak(0)
    }
  }

  function advance() {
    if (idx + 1 >= questions.length) {
      finishDeck(bestStreakRef.current)
      playSound('ui_tap')
      setPhase('done')
      return
    }
    setIdx(i => i + 1)
    setPhase('answering')
    setGiven(null)
  }

  // Keyboard 1-4 to answer, Enter / Space to advance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase === 'answering') {
        const n = parseInt(e.key, 10)
        const q = questions[idx]
        if (n >= 1 && q && n <= q.options.length) {
          e.preventDefault()
          submit(q.options[n - 1])
        }
      } else if (phase === 'feedback') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          advance()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, idx, questions]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cards.length === 0) {
    return (
      <Empty palette={palette}
        title={emptyTitle} body={emptyBody}
        onPrimary={onExit} primaryLabel="Back to home"
      />
    )
  }

  if (phase === 'done') {
    const correctCount = results.filter(r => r.correct).length
    const pct = Math.round((correctCount / results.length) * 100)
    const missed = results.filter(r => !r.correct)
    return (
      <DoneCard
        palette={palette}
        title={title}
        pct={pct} correctCount={correctCount} total={results.length}
        missed={missed}
        // Retry the missed cards directly (they live in `results`) instead of
        // asking the parent to rebuild its queue — after a session the SRS
        // due-queue is empty, which is what showed "all caught up" on Retry.
        onRetryMissed={missed.length > 0 ? () => setDeck(missed.map(m => m.q.el)) : undefined}
        onRestart={onRestart}
        onExit={onExit}
      />
    )
  }

  const q = questions[idx]
  const total = questions.length
  const progressPct = ((idx + (phase === 'feedback' ? 1 : 0)) / total) * 100

  return (
    <div style={{
      padding: '0 14px 18px',
      display: 'flex', flexDirection: 'column', gap: 14,
      fontFamily: CHEM_FONT, color: palette.fg,
    }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.fg }}>{title}</h2>
        <p style={{ fontSize: 12, color: palette.fgMuted, marginTop: 2 }}>{subtitle}</p>
      </div>

      {/* Progress row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {typeLabel && (
          <span style={{
            padding: '4px 10px', borderRadius: 999,
            background: palette.cardMuted, color: palette.fg,
            fontSize: 11, fontWeight: 700,
          }}>
            {typeLabel}
          </span>
        )}
        <div style={{
          flex: 1,
          height: 6, borderRadius: 999,
          background: palette.cardMuted, overflow: 'hidden',
        }}>
          <div style={{
            width: `${progressPct}%`, height: '100%',
            background: palette.grapeDark,
            transition: 'width 220ms ease',
          }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: palette.fg }}>
          {idx + 1} / {total}
        </span>
      </div>

      {/* Question card — bright lavender, ink text */}
      <div style={{
        borderRadius: 22, padding: 22,
        background: palette.grapeLight,
        color: palette.ink,
        border: `2px solid ${palette.ink}`,
        boxShadow: neoShadow(palette.ink, 'lg'),
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
          color: palette.grapeDark,
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          {streak >= 2 ? (
            <>
              <Flame size={13} strokeWidth={2.4} color={palette.sunDark} />
              {streak} in a row
            </>
          ) : 'QUESTION'}
        </div>
        <div style={{
          marginTop: 8, fontSize: 22, fontWeight: 900, lineHeight: 1.2,
        }}>
          {q.prompt}
        </div>
      </div>

      {/* Answer buttons */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr',
        gap: 10,
      }}>
        {q.options.map((opt, i) => {
          const isAnswer = i === q.correctIdx
          const isGiven  = phase === 'feedback' && opt === given
          const reveal   = phase === 'feedback'
          const bg = reveal
            ? isAnswer ? palette.greenLight
            : isGiven  ? palette.redLight
            :            palette.cardRaised
            : palette.cardRaised
          const fg = palette.ink
          const opacity = reveal && !isAnswer && !isGiven ? 0.55 : 1
          return (
            <button
              key={opt}
              type="button"
              disabled={phase === 'feedback'}
              onClick={() => submit(opt)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 14px',
                borderRadius: 16,
                border: `2px solid ${palette.ink}`,
                boxShadow: phase === 'feedback' ? 'none' : neoShadow(palette.ink, 'sm'),
                background: bg,
                color: reveal ? fg : palette.fg,
                textAlign: 'left',
                fontFamily: CHEM_FONT,
                fontSize: 16, fontWeight: 700,
                opacity,
                cursor: phase === 'feedback' ? 'default' : 'pointer',
                transition: 'background 140ms ease',
              }}
            >
              <span style={{
                flexShrink: 0,
                width: 26, height: 26, borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                background: palette.sun, color: palette.ink,
                border: `2px solid ${palette.ink}`,
                fontSize: 13, fontWeight: 900,
              }}>
                {i + 1}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
              {reveal && isAnswer && <Check size={20} strokeWidth={3} color={palette.greenLight === '#BBF7D0' ? '#15803D' : palette.green} />}
              {reveal && isGiven && !isAnswer && <X size={20} strokeWidth={3} color={palette.red} />}
            </button>
          )
        })}
      </div>

      {/* Feedback + advance */}
      {phase === 'feedback' && (() => {
        const last = results[results.length - 1]
        const correct = last?.correct ?? false
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              borderRadius: 14, padding: 12,
              background: correct ? palette.greenLight : palette.redLight,
              color: palette.ink,
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8,
              border: `2px solid ${palette.ink}`,
              boxShadow: neoShadow(palette.ink, 'sm'),
            }}>
              {correct ? (
                <>
                  <Check size={16} strokeWidth={3} />
                  Correct!
                </>
              ) : (
                <>
                  <X size={16} strokeWidth={3} />
                  Correct answer: {q.answer}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={advance}
              style={{
                padding: '12px 16px',
                borderRadius: 999,
                border: `2px solid ${palette.ink}`,
                boxShadow: neoShadow(palette.ink, 'md'),
                background: palette.sky,
                color: palette.ink,
                fontFamily: CHEM_FONT,
                fontSize: 15, fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {idx + 1 >= total ? 'See results' : 'Continue'}
            </button>
          </div>
        )
      })()}

      <div style={{
        textAlign: 'center', fontSize: 10, fontWeight: 600,
        color: palette.fgFaint, marginTop: 4,
      }}>
        1–4 to answer · Space / Enter to continue
      </div>
    </div>
  )
}

function Empty({ palette, title, body, onPrimary, primaryLabel }: {
  palette: Palette; title: string; body: string;
  onPrimary: () => void; primaryLabel: string
}) {
  return (
    <div style={{
      padding: '40px 22px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      textAlign: 'center', fontFamily: CHEM_FONT, color: palette.fg,
    }}>
      <CheckCircle2 size={56} strokeWidth={2.2} color={palette.green} />
      <h3 style={{ fontSize: 20, fontWeight: 900 }}>{title}</h3>
      <p style={{ fontSize: 13, color: palette.fgMuted, maxWidth: 320 }}>{body}</p>
      <button
        type="button"
        onClick={onPrimary}
        style={{
          marginTop: 6,
          padding: '10px 18px', borderRadius: 999,
          border: `2px solid ${palette.ink}`,
          boxShadow: neoShadow(palette.ink, 'md'),
          background: palette.sky, color: palette.ink,
          fontFamily: CHEM_FONT, fontSize: 14, fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {primaryLabel}
      </button>
    </div>
  )
}

function DoneCard({ palette, title, pct, correctCount, total, missed, onRetryMissed, onRestart, onExit }: {
  palette: Palette
  title: string
  pct: number
  correctCount: number
  total: number
  missed: ResultRow[]
  /** Set when there are wrong answers to redo; relabels the primary button. */
  onRetryMissed?: () => void
  onRestart: () => void
  onExit: () => void
}) {
  return (
    <div style={{
      padding: '14px 14px 22px',
      display: 'flex', flexDirection: 'column', gap: 14,
      fontFamily: CHEM_FONT,
    }}>
      <div style={{
        borderRadius: 24, padding: 22,
        background: palette.grapeLight, color: palette.ink,
        textAlign: 'center',
        border: `2px solid ${palette.ink}`,
        boxShadow: neoShadow(palette.ink, 'lg'),
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: palette.grapeDark }}>
          {title.toUpperCase()} COMPLETE
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, marginTop: 4 }}>{pct}%</div>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>
          {correctCount} of {total} correct
        </div>
        {pct === 100 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            marginTop: 8,
            padding: '4px 10px', borderRadius: 999,
            background: palette.green, color: palette.ink,
            fontSize: 11, fontWeight: 800,
          }}>
            <Target size={12} strokeWidth={2.6} />
            Perfect!
          </div>
        )}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onRetryMissed ?? onRestart} type="button" style={{
            padding: '10px 16px', borderRadius: 999,
            border: `2px solid ${palette.ink}`,
            boxShadow: neoShadow(palette.ink, 'md'),
            background: palette.sky, color: palette.ink,
            fontFamily: CHEM_FONT, fontSize: 14, fontWeight: 800,
            cursor: 'pointer',
          }}>
            {onRetryMissed ? `Retry missed (${missed.length})` : 'Retry'}
          </button>
          <button onClick={onExit} type="button" style={{
            padding: '10px 16px', borderRadius: 999,
            border: `2px solid ${palette.ink}`,
            boxShadow: neoShadow(palette.ink, 'md'),
            background: '#FFFFFF', color: palette.ink,
            fontFamily: CHEM_FONT, fontSize: 14, fontWeight: 800,
            cursor: 'pointer',
          }}>
            Done
          </button>
        </div>
      </div>

      {missed.length > 0 && (
        <div style={{
          borderRadius: 18, padding: 14,
          background: palette.card, color: palette.fg,
          border: `2px solid ${palette.ink}`,
          boxShadow: neoShadow(palette.ink, 'md'),
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            Missed
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', padding: 0 }}>
            {missed.map((m, i) => (
              <li key={i} style={{
                borderRadius: 10, padding: '8px 10px',
                background: palette.cardMuted, fontSize: 12,
              }}>
                <div style={{ fontWeight: 700, color: palette.fg }}>{m.q.prompt}</div>
                <div style={{ marginTop: 2, color: palette.fgMuted }}>
                  You said <span style={{ color: palette.red, fontWeight: 700 }}>{m.given}</span> · answer{' '}
                  <span style={{ color: palette.green, fontWeight: 700 }}>{m.q.answer}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
