'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { playSound } from '@/lib/sounds'
import { speedPool, makeQuestion, type Question } from '@/lib/chemistry/questions'
import { Card, CheckDisc, M, MeadowIcon, Meter, PrimaryButton, SecondaryButton, Tag, TextButton, TYPE } from '@/components/meadow'

const DURATION = 60
const BEST_KEY = 'eren_chem_speed_best'

interface Props { onExit: () => void }

export default function Speed({ onExit }: Props) {
  const { hydrated, rateCard } = useChemistryStore()
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [score, setScore] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string } | null>(null)
  const [best, setBest] = useState(0)
  const [bestLoaded, setBestLoaded] = useState(false)
  const [newBest, setNewBest] = useState(false)
  const deck = useRef<ReturnType<typeof speedPool>>([])
  const ptr = useRef(0)
  const deadline = useRef(0)
  const running = useRef(false)
  const answerLocked = useRef(false)
  const scoreNow = useRef(0)
  const bestNow = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusNext = useRef(false)

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY))
      if (Number.isSafeInteger(saved) && saved >= 0) {
        bestNow.current = saved
        setBest(saved)
      }
    } catch { /* Storage can be unavailable in privacy mode. */ }
    setBestLoaded(true)
  }, [])

  const nextQuestion = useCallback(() => {
    if (ptr.current >= deck.current.length) {
      deck.current = speedPool()
      ptr.current = 0
    }
    setQuestion(makeQuestion(deck.current[ptr.current++]))
  }, [])

  const end = useCallback(() => {
    if (!running.current) return
    running.current = false
    answerLocked.current = true
    const improved = scoreNow.current > bestNow.current
    setNewBest(improved)
    if (improved) {
      bestNow.current = scoreNow.current
      setBest(scoreNow.current)
      try { localStorage.setItem(BEST_KEY, String(scoreNow.current)) }
      catch { /* The result still remains available for this visit. */ }
    }
    focusNext.current = true
    setTimeLeft(0)
    setStatus('done')
  }, [])

  // Answering must not restart the countdown; a fixed deadline owns the round.
  useEffect(() => {
    if (status !== 'running') return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) end()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    const id = setInterval(tick, 250)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [status, end])

  useEffect(() => {
    if (status === 'running') answerLocked.current = false
    if (focusNext.current) {
      headingRef.current?.focus({ preventScroll: true })
      focusNext.current = false
    }
  }, [status, question])

  useEffect(() => () => { running.current = false; answerLocked.current = true }, [])

  function start() {
    if (!hydrated || !bestLoaded || running.current) return
    playSound('ui_tap')
    running.current = true
    answerLocked.current = true
    scoreNow.current = 0
    deadline.current = Date.now() + DURATION * 1000
    deck.current = speedPool()
    ptr.current = 0
    focusNext.current = true
    setScore(0)
    setTimeLeft(DURATION)
    setFeedback(null)
    setNewBest(false)
    setStatus('running')
    nextQuestion()
  }

  const answer = useCallback((option: string) => {
    if (!hydrated || !question || !running.current || answerLocked.current || !question.options.includes(option)) return
    if (Date.now() >= deadline.current) { end(); return }
    answerLocked.current = true
    const correct = option === question.answer
    rateCard(elementCardId(question.el.atomicNumber), correct)
    if (correct) {
      scoreNow.current += 1
      setScore(scoreNow.current)
    }
    setFeedback({ correct, answer: question.answer })
    playSound('ui_tap')
    focusNext.current = true
    nextQuestion()
  }, [hydrated, question, rateCard, end, nextQuestion])

  useEffect(() => {
    if (status !== 'running') return
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
        target?.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"]')) return
      if (!running.current || !question || !/^[1-4]$/.test(event.key)) return
      const option = question.options[Number(event.key) - 1]
      if (option === undefined) return
      event.preventDefault()
      answer(option)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, question, answer])

  const back = () => { playSound('ui_back'); onExit() }
  if (!hydrated || !bestLoaded) return (
    <p className="meadow-root" role="status" style={{ margin: '24px 16px', fontSize: 15, fontWeight: 700, color: M.text2 }}>Getting your sprint...</p>
  )
  if (status !== 'running') return (
    <section className="meadow-root" aria-label={status === 'done' ? 'Speed results' : 'Speed round'} style={{ padding: '0 16px 18px', color: M.text }}>
      <Card padding="24px 20px" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          {status === 'done' ? <CheckDisc size={44} /> : <MeadowIcon name="bolt" size={44} color={M.energy} />}
        </div>
        <h2 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800, outline: 'none' }}>{status === 'done' ? "Time's up" : 'Speed round'}</h2>
        {status === 'done' ? <>
          <p style={{ ...TYPE.number, fontSize: 38, margin: '8px 0 0' }}>{score}</p>
          <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: M.text2 }}>{score === 1 ? 'correct answer' : 'correct answers'}</p>
          {newBest && <Tag tone="amber" icon={<MeadowIcon name="star" size={16} />} style={{ marginTop: 12 }}>New personal best!</Tag>}
        </> : <Tag tone="soft" icon={<MeadowIcon name="clock" size={16} />} style={{ marginTop: 14 }}>60 seconds</Tag>}
        <dl style={{ margin: '20px 0 0' }}>
          <dt style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Personal best</dt>
          <dd style={{ ...TYPE.number, margin: '4px 0 0', fontSize: 22 }}>{best}</dd>
        </dl>
      </Card>
      <PrimaryButton size="md" full onClick={start} style={{ marginTop: 20 }} icon={<MeadowIcon name={status === 'done' ? 'replay' : 'bolt'} size={20} color="#FFFFFF" />}>{status === 'done' ? 'Play again' : 'Start'}</PrimaryButton>
      <TextButton onClick={back} style={{ marginTop: 8, width: '100%' }}>Back to lab</TextButton>
    </section>
  )

  const lowTime = timeLeft <= 10
  return (
    <section className="meadow-root" aria-label="Speed session" style={{ padding: '0 16px 18px', color: M.text }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800 }}>Speed</h2>
        <span role="timer" aria-label="Time remaining" aria-live="off">
          <Tag tone="soft" icon={<MeadowIcon name="clock" size={16} color={lowTime ? M.danger : M.text2} />}
            style={{ background: lowTime ? M.dangerTint : '#FFFFFF', color: lowTime ? M.danger : M.text, fontVariantNumeric: 'tabular-nums', minWidth: 76, justifyContent: 'center' }}>{timeLeft}s</Tag>
        </span>
      </div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 16 }}>
        <Tag tone="soft" style={{ background: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>Best {best}</Tag>
        <Meter value={timeLeft / DURATION} label="Speed time" height={8} color={lowTime ? M.danger : M.leaf} style={{ flex: '1 1 0' }} />
        <Tag tone="soft" style={{ background: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>Score {score}</Tag>
      </div>
      <Card padding="18px 20px" style={{ height: 168, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginBottom: 16 }}>
        <p style={{ ...TYPE.label, margin: 0, color: M.label }}>{question?.type === 'name-from-symbol' ? 'Symbol to name' : 'Name to symbol'}</p>
        <h3 ref={headingRef} tabIndex={-1} style={{ margin: '8px 0 0', fontSize: 22, lineHeight: 1.3, fontWeight: 800, overflowWrap: 'anywhere', outline: 'none' }}>{question?.prompt}</h3>
      </Card>
      <div role="group" aria-label="Answers" style={{ display: 'grid', gap: 10 }}>
        {question?.options.map((option, index) => (
          <SecondaryButton key={`${question.el.atomicNumber}-${index}`} size="md" full onClick={() => answer(option)} ariaLabel={`${index + 1}. ${option}`}
            style={{ minHeight: 52, height: 'auto', padding: '10px 14px', gap: 12, whiteSpace: 'normal', textAlign: 'left', justifyContent: 'flex-start', background: '#FFFFFF', color: M.text }}>
            <span aria-hidden style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: M.soft, color: M.text2, fontSize: 13, fontWeight: 800 }}>{index + 1}</span>
            <span style={{ flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' }}>{option}</span>
          </SecondaryButton>
        ))}
      </div>
      <div role="status" style={{ minHeight: 44, paddingTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 15, lineHeight: 1.4, fontWeight: 700, color: feedback?.correct ? M.leafInk : M.danger }}>
        {feedback && <>
          <MeadowIcon name={feedback.correct ? 'check' : 'close'} size={20} color={feedback.correct ? M.leaf : M.danger} style={{ flexShrink: 0 }} />
          <span>{feedback.correct ? 'Correct' : 'Answer'}: {feedback.answer}</span>
        </>}
      </div>
    </section>
  )
}
