'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { elements, type Element } from '@/lib/chemistry/elements'
import { symbolDistractors, nameDistractors, shuffle } from '@/lib/chemistry/questions'
import { CATEGORY_COLORS } from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { dueDate, isDue, isNew, MASTERED_BOX, type CardState } from '@/lib/chemistry/srs'
import { useChemistryMissions } from '@/lib/chemistry/missions'
import { playSound } from '@/lib/sounds'
import { Card, CheckDisc, M, MeadowIcon, Meter, PrimaryButton, SecondaryButton, Tag, TYPE } from '@/components/meadow'

const QUEUE_SIZE = 10
const FEEDBACK_MS = 1000

interface Question {
  el: Element
  type: 'name-from-symbol' | 'symbol-from-name'
  options: string[]
  correctIdx: number
}

export function pickQueue(cards: Record<string, CardState>, today: string): Element[] {
  const due: { el: Element; dueOn: string }[] = []
  const fresh: Element[] = []
  const learning: { el: Element; dueOn: string }[] = []
  for (const el of elements) {
    const card = cards[elementCardId(el.atomicNumber)]
    if (isDue(card, today)) due.push({ el, dueOn: dueDate(card!) ?? today })
    else if (isNew(card)) fresh.push(el)
    else if (card && card.box < MASTERED_BOX) learning.push({ el, dueOn: dueDate(card) ?? today })
  }
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  learning.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  if (due.length >= QUEUE_SIZE) return due.slice(0, QUEUE_SIZE).map(row => row.el)
  return [...due.map(row => row.el), ...shuffle(fresh), ...learning.map(row => row.el)].slice(0, QUEUE_SIZE)
}

export function makeQuestion(el: Element): Question {
  const type = Math.random() < 0.5 ? 'name-from-symbol' : 'symbol-from-name'
  const correct = type === 'name-from-symbol' ? el.name : el.symbol
  const wrong = type === 'name-from-symbol' ? nameDistractors(el) : symbolDistractors(el)
  const options = shuffle([correct, ...wrong])
  return { el, type, options, correctIdx: options.indexOf(correct) }
}

export default function Quiz() {
  const { hydrated, state, today, rateCard, finishDeck } = useChemistryStore()
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishedRef = useRef(false)
  const answerLocked = useRef(false)
  const focusNext = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const done = questions !== null && questions.length > 0 && index >= questions.length
  const current = questions?.[index]
  useChemistryMissions({ streak, done })

  // Keep this round's questions fixed while each answer updates the study store.
  useEffect(() => {
    if (!hydrated || questions !== null) return
    setQuestions(pickQueue(state.cards, today).map(makeQuestion))
  }, [hydrated, today, state.cards, questions])

  useEffect(() => {
    answerLocked.current = false
    if (focusNext.current) {
      headingRef.current?.focus({ preventScroll: true })
      focusNext.current = false
    }
  }, [index, questions])

  useEffect(() => {
    if (!done || finishedRef.current) return
    finishedRef.current = true
    finishDeck(bestStreak)
  }, [done, bestStreak, finishDeck])

  useEffect(() => () => {
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current)
  }, [])

  function pick(option: number) {
    if (!hydrated || !current || picked !== null || answerLocked.current || !Number.isInteger(option) || option < 0 || option >= current.options.length) return
    answerLocked.current = true
    playSound('ui_tap')
    setPicked(option)
    const isRight = option === current.correctIdx
    rateCard(elementCardId(current.el.atomicNumber), isRight)
    const nextStreak = isRight ? streak + 1 : 0
    setStreak(nextStreak)
    setBestStreak(best => Math.max(best, nextStreak))
    if (isRight) setCorrect(value => value + 1)
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null
      focusNext.current = true
      setPicked(null)
      setIndex(value => value + 1)
    }, FEEDBACK_MS)
  }

  function reset() {
    if (!hydrated) return
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current)
    advanceTimer.current = null
    answerLocked.current = true
    focusNext.current = true
    playSound('ui_tap')
    setQuestions(pickQueue(state.cards, today).map(makeQuestion))
    setIndex(0)
    setPicked(null)
    setStreak(0)
    setBestStreak(0)
    setCorrect(0)
    finishedRef.current = false
  }

  if (!hydrated || questions === null) return (
    <p className="meadow-root" role="status" style={{ margin: '24px 16px', fontSize: 15, fontWeight: 700, color: M.text2 }}>Getting your quiz...</p>
  )
  if (questions.length === 0) return (
    <section className="meadow-root" aria-label="Quiz" style={{ padding: '32px 22px', textAlign: 'center', color: M.text }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><CheckDisc size={52} /></div>
      <h2 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800, outline: 'none' }}>All caught up</h2>
      <p style={{ margin: '10px 0 20px', fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: M.text2 }}>Your next questions will appear when cards are due.</p>
      <SecondaryButton size="md" full onClick={reset}>Check again</SecondaryButton>
    </section>
  )
  if (done) return (
    <Summary total={questions.length} correct={correct} bestStreak={bestStreak}
      dailyStreak={state.streak.current} onAgain={reset} headingRef={headingRef} />
  )

  const q = current!
  const reveal = picked !== null
  const isRight = picked === q.correctIdx
  return (
    <section className="meadow-root" aria-label="Quiz session" style={{ padding: '0 16px 18px', color: M.text }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800 }}>Quiz</h2>
        <Tag tone="soft" style={{ background: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>{index + 1} / {questions.length}</Tag>
      </div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 16 }}>
        <Meter value={(index + (reveal ? 1 : 0)) / questions.length} label="Quiz progress" height={8} color={M.leaf} style={{ flex: '1 1 0' }} />
        <Tag tone={streak >= 5 ? 'amber' : 'soft'}>{streak} in a row</Tag>
      </div>
      <Card padding="20px" style={{ height: 180, borderTop: `4px solid ${CATEGORY_COLORS[q.el.category]}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: M.text2 }}>#{q.el.atomicNumber}</p>
        <h3 ref={headingRef} tabIndex={-1} aria-label={`${q.type === 'name-from-symbol' ? 'Which element' : 'Which symbol'}: ${q.type === 'name-from-symbol' ? q.el.symbol : q.el.name}`}
          style={{ margin: '8px 0', fontSize: q.type === 'name-from-symbol' ? 64 : 26, fontWeight: 800, lineHeight: 1.1, textAlign: 'center', overflowWrap: 'anywhere', width: '100%', outline: 'none' }}>
          {q.type === 'name-from-symbol' ? q.el.symbol : q.el.name}
        </h3>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: M.text2 }}>{q.type === 'name-from-symbol' ? 'Which element?' : 'Which symbol?'}</p>
      </Card>
      <div role="group" aria-label="Answers" style={{ display: 'grid', gap: 10 }}>
        {q.options.map((option, i) => {
          const isAnswer = i === q.correctIdx
          const isPicked = i === picked
          const highlighted = reveal && (isAnswer || isPicked)
          return (
            <SecondaryButton key={`${index}-${i}`} size="md" full disabled={reveal} onClick={() => pick(i)}
              ariaLabel={`${String.fromCharCode(65 + i)}. ${option}${reveal && isAnswer ? ', correct answer' : reveal && isPicked ? ', your answer, incorrect' : ''}`}
              style={{ minHeight: 52, height: 'auto', padding: '10px 14px', gap: 12, whiteSpace: 'normal', textAlign: 'left', justifyContent: 'flex-start',
                background: highlighted ? isAnswer ? M.leafTint : M.dangerTint : '#FFFFFF', color: M.text, opacity: reveal && !highlighted ? 0.65 : 1 }}>
              <span aria-hidden style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: highlighted ? isAnswer ? M.leaf : M.danger : M.soft, color: highlighted ? '#FFFFFF' : M.text2, fontSize: 13, fontWeight: 800 }}>
                {highlighted ? <MeadowIcon name={isAnswer ? 'check' : 'close'} size={18} color="#FFFFFF" /> : String.fromCharCode(65 + i)}
              </span>
              <span style={{ flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' }}>{option}</span>
            </SecondaryButton>
          )
        })}
      </div>
      <div role="status" style={{ minHeight: 44, paddingTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 15, lineHeight: 1.4, fontWeight: 700, color: isRight ? M.leafInk : M.danger }}>
        {reveal && <>
          <MeadowIcon name={isRight ? 'check' : 'close'} size={20} color={isRight ? M.leaf : M.danger} style={{ flexShrink: 0 }} />
          <span>{isRight ? 'Correct!' : `Answer: ${q.options[q.correctIdx]}`}</span>
        </>}
      </div>
    </section>
  )
}

function Summary({ total, correct, bestStreak, dailyStreak, onAgain, headingRef }: {
  total: number; correct: number; bestStreak: number; dailyStreak: number; onAgain: () => void; headingRef: RefObject<HTMLHeadingElement>
}) {
  const pct = Math.round(correct / total * 100)
  return (
    <section className="meadow-root" aria-label="Quiz results" style={{ padding: '0 16px 18px', color: M.text }}>
      <Card padding="22px 20px" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><CheckDisc size={44} /></div>
        <h2 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800, outline: 'none' }}>Quiz complete</h2>
        <p style={{ ...TYPE.number, fontSize: 38, margin: '8px 0 0' }}>{pct}%</p>
        <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: M.text2 }}>{correct} of {total} correct</p>
        {pct >= 90 && <Tag tone="leaf" icon={<MeadowIcon name="star" size={16} />} style={{ marginTop: 12 }}>{pct === 100 ? 'Perfect!' : 'Great run'}</Tag>}
      </Card>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, margin: '20px 0' }}>
        <div><dt style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Best run</dt><dd style={{ ...TYPE.number, margin: '4px 0 0', fontSize: 17 }}>{bestStreak} in a row</dd></div>
        <div><dt style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Daily streak</dt><dd style={{ ...TYPE.number, margin: '4px 0 0', fontSize: 17 }}>{dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}</dd></div>
      </dl>
      <PrimaryButton size="md" full onClick={onAgain} icon={<MeadowIcon name="replay" size={20} color="#FFFFFF" />}>New quiz</PrimaryButton>
    </section>
  )
}
