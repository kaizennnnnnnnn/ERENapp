'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { useChemistryMissions } from '@/lib/chemistry/missions'
import { playSound } from '@/lib/sounds'
import { makeQuestion, type Question } from '@/lib/chemistry/questions'
import type { Element } from '@/lib/chemistry/elements'
import {
  Card, CheckDisc, M, MeadowIcon, Meter, PrimaryButton, SecondaryButton,
  SectionLabel, Tag, TextButton, TYPE,
} from '@/components/meadow'

interface Props {
  title: string
  cards: Element[]
  loading?: boolean
  typeLabel?: string
  emptyTitle: string
  emptyBody: string
  restartLabel?: string
  onRestart: () => void
  onExit: () => void
}

interface ResultRow {
  q: Question
  given: string
  correct: boolean
}

export default function SessionRunner({
  title, cards, loading = false, typeLabel,
  emptyTitle, emptyBody, restartLabel = 'Start again', onRestart, onExit,
}: Props) {
  const { rateCard, finishDeck } = useChemistryStore()
  // A missed-card retry uses the session's own deck, not the now-cleared due queue.
  const [deck, setDeck] = useState<Element[]>(cards)
  useEffect(() => { setDeck(cards) }, [cards])
  const questions = useMemo<Question[]>(() => deck.map(el => makeQuestion(el)), [deck])
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'answering' | 'feedback' | 'done'>('answering')
  const [given, setGiven] = useState<string | null>(null)
  const [results, setResults] = useState<ResultRow[]>([])
  const [streak, setStreak] = useState(0)
  const bestStreakRef = useRef(0)
  const answerLocked = useRef(false)
  const advanceLocked = useRef(false)
  useChemistryMissions({ streak, done: phase === 'done' })

  useEffect(() => {
    setIdx(0)
    setPhase('answering')
    setGiven(null)
    setResults([])
    setStreak(0)
    bestStreakRef.current = 0
  }, [deck])

  // Unlock only after the next question has committed, not between rapid events.
  useEffect(() => {
    if (phase === 'answering') {
      answerLocked.current = false
      advanceLocked.current = false
    }
  }, [phase, idx, deck])

  function submit(option: string) {
    const q = questions[idx]
    if (loading || phase !== 'answering' || answerLocked.current || !q) return
    answerLocked.current = true
    const correct = option === q.answer
    setGiven(option)
    setPhase('feedback')
    setResults(rs => [...rs, { q, given: option, correct }])
    rateCard(elementCardId(q.el.atomicNumber), correct)
    playSound('ui_tap')
    if (correct) {
      const next = streak + 1
      setStreak(next)
      if (next > bestStreakRef.current) bestStreakRef.current = next
    } else {
      setStreak(0)
    }
  }

  function advance() {
    if (loading || phase !== 'feedback' || advanceLocked.current) return
    advanceLocked.current = true
    playSound('ui_tap')
    if (idx + 1 >= questions.length) {
      finishDeck(bestStreakRef.current)
      setPhase('done')
      return
    }
    setIdx(i => i + 1)
    setPhase('answering')
    setGiven(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Leave focused controls their native Enter/Space behavior.
      const target = e.target instanceof HTMLElement ? e.target : null
      if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey ||
        target?.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"]')) return
      if (phase === 'answering') {
        const n = Number(e.key)
        const q = questions[idx]
        if (n >= 1 && n <= 4 && Number.isInteger(n) && q && n <= q.options.length) {
          e.preventDefault()
          submit(q.options[n - 1])
        }
      } else if (phase === 'feedback' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, idx, questions, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading />
  if (cards.length === 0) return <Empty title={emptyTitle} body={emptyBody} onExit={onExit} />
  if (phase === 'done') {
    const correctCount = results.filter(r => r.correct).length
    const missed = results.filter(r => !r.correct)
    return (
      <DoneCard
        title={title} correctCount={correctCount} total={results.length} missed={missed}
        restartLabel={restartLabel} onRestart={onRestart} onExit={onExit}
        onRetryMissed={missed.length > 0 ? () => setDeck(missed.map(m => m.q.el)) : undefined}
      />
    )
  }

  const q = questions[idx]
  // Hydration and a replacement deck take one effect to reach the session.
  if (!q) return <Loading />
  const total = questions.length
  const reveal = phase === 'feedback'
  const correct = given === q.answer

  return (
    <section className="meadow-root" aria-label={`${title} session`} style={{ padding: '0 16px 18px', color: M.text }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800 }}>{title}</h2>
        {streak >= 2 && <Tag tone="amber" icon={<MeadowIcon name="flame" size={16} />}>{streak} in a row</Tag>}
      </div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 14 }}>
        {typeLabel && <Tag tone="soft" size="sm" style={{ background: '#FFFFFF' }}>{typeLabel}</Tag>}
        <Meter value={(idx + (reveal ? 1 : 0)) / total} color={M.leaf} height={8}
          label="Session progress" style={{ flex: '1 1 0' }} />
        <span style={{ ...TYPE.number, fontSize: 13, whiteSpace: 'nowrap' }}>{idx + 1} / {total}</span>
      </div>

      <Card padding="18px 20px" style={{ marginBottom: 14 }}>
        <p style={{ ...TYPE.label, margin: 0, color: M.label }}>
          {q.type === 'name-from-symbol' ? 'Symbol to name' : 'Name to symbol'}
        </p>
        <h3 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
          {q.prompt}
        </h3>
      </Card>

      <div role="group" aria-label="Answers" style={{ display: 'grid', gap: 10 }}>
        {q.options.map((opt, i) => {
          const isAnswer = opt === q.answer
          const isGiven = opt === given
          const highlighted = reveal && (isAnswer || isGiven)
          return (
            <SecondaryButton key={opt} size="md" full disabled={reveal}
              onClick={() => submit(opt)} ariaLabel={`${i + 1}. ${opt}${reveal && isAnswer ? ', correct answer' : reveal && isGiven ? ', your answer, incorrect' : ''}`}
              style={{
                minHeight: 52, height: 'auto', padding: '10px 14px', gap: 12,
                background: highlighted ? isAnswer ? M.leafTint : M.dangerTint : '#FFFFFF',
                color: M.text, opacity: reveal && !highlighted ? 0.65 : 1,
                whiteSpace: 'normal', textAlign: 'left', justifyContent: 'flex-start',
              }}>
              <span aria-hidden style={{
                width: 28, height: 28, flexShrink: 0, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: highlighted ? isAnswer ? M.leaf : M.danger : M.soft,
                color: highlighted ? '#FFFFFF' : M.text2, fontSize: 13, fontWeight: 800,
              }}>{highlighted ? <MeadowIcon name={isAnswer ? 'check' : 'close'} size={18} color="#FFFFFF" /> : i + 1}</span>
              <span style={{ flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' }}>{opt}</span>
            </SecondaryButton>
          )
        })}
      </div>

      {reveal && (
        <div style={{ marginTop: 16 }}>
          <div role="status" className="flex items-start" style={{ gap: 8, marginBottom: 12, color: correct ? M.leafInk : M.danger }}>
            <MeadowIcon name={correct ? 'check' : 'close'} size={20} color={correct ? M.leaf : M.danger} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 15, lineHeight: 1.4, fontWeight: 700 }}>
              {correct ? 'Correct!' : `Correct answer: ${q.answer}`}
            </span>
          </div>
          <PrimaryButton size="md" full onClick={advance}>
            {idx + 1 >= total ? 'See results' : 'Continue'}
          </PrimaryButton>
        </div>
      )}
    </section>
  )
}

function Loading() {
  return <p className="meadow-root" role="status" style={{ margin: '24px 16px', color: M.text2, fontSize: 15, fontWeight: 700 }}>Getting your cards...</p>
}

function Empty({ title, body, onExit }: { title: string; body: string; onExit: () => void }) {
  return (
    <section className="meadow-root" style={{ padding: '32px 22px', textAlign: 'center', color: M.text }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><CheckDisc size={52} /></div>
      <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800 }}>{title}</h2>
      <p style={{ margin: '10px auto 20px', fontSize: 15, lineHeight: 1.5, fontWeight: 500, color: M.text2, maxWidth: 320 }}>{body}</p>
      <PrimaryButton size="md" full onClick={() => { playSound('ui_back'); onExit() }}>Back to home</PrimaryButton>
    </section>
  )
}

function DoneCard({ title, correctCount, total, missed, restartLabel, onRetryMissed, onRestart, onExit }: {
  title: string; correctCount: number; total: number; missed: ResultRow[]; restartLabel: string
  onRetryMissed?: () => void; onRestart: () => void; onExit: () => void
}) {
  const pct = total ? Math.round(correctCount / total * 100) : 0
  const tap = (action: () => void) => { playSound('ui_tap'); action() }
  return (
    <section className="meadow-root" aria-label={`${title} results`} style={{ padding: '0 16px 18px', color: M.text }}>
      <Card padding="22px 20px" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><CheckDisc size={44} /></div>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800 }}>{title} complete</h2>
        <p style={{ ...TYPE.number, fontSize: 38, margin: '8px 0 0' }}>{pct}%</p>
        <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: M.text2 }}>{correctCount} of {total} correct</p>
        {pct === 100 && <Tag tone="leaf" icon={<MeadowIcon name="star" size={16} />} style={{ marginTop: 12 }}>Perfect!</Tag>}
      </Card>
      <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
        <PrimaryButton size="md" full onClick={() => tap(onRetryMissed ?? onExit)}>
          {onRetryMissed ? `Retry missed (${missed.length})` : 'Done'}
        </PrimaryButton>
        {onRetryMissed
          ? <SecondaryButton size="md" full onClick={() => tap(onExit)}>Done</SecondaryButton>
          : <TextButton onClick={() => tap(onRestart)}>{restartLabel}</TextButton>}
      </div>
      {missed.length > 0 && <>
        <SectionLabel>To revisit</SectionLabel>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {missed.map((m, i) => (
            <li key={i} style={{ padding: '12px 0', borderBottom: `1px solid ${M.hairline}` }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4, fontWeight: 800 }}>{m.q.prompt}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
                You chose <span style={{ color: M.danger, fontWeight: 700 }}>{m.given}</span>
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.leafInk }}>Answer: {m.q.answer}</p>
            </li>
          ))}
        </ul>
      </>}
    </section>
  )
}
