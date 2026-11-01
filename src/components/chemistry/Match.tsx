'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { elements, type Element } from '@/lib/chemistry/elements'
import { shuffle } from '@/lib/chemistry/questions'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { dueDate, isDue, isNew, MASTERED_BOX, type CardState } from '@/lib/chemistry/srs'
import { useChemistryMissions } from '@/lib/chemistry/missions'
import { playSound } from '@/lib/sounds'
import { Card, CheckDisc, Chip, M, MeadowIcon, Meter, PrimaryButton, Tag, TYPE } from '@/components/meadow'

const ROUND_SECONDS = 60
const PAIRS_PER_ROUND = 6
const MISMATCH_FLASH_MS = 650

interface Tile {
  id: number
  kind: 'symbol' | 'name'
  element: Element
}

export function pickPairs(cards: Record<string, CardState>, today: string): Element[] {
  const due: { el: Element; dueOn: string }[] = []
  const fresh: Element[] = []
  const learning: Element[] = []
  for (const el of elements) {
    const card = cards[elementCardId(el.atomicNumber)]
    if (isDue(card, today)) due.push({ el, dueOn: dueDate(card!) ?? today })
    else if (isNew(card)) fresh.push(el)
    else if (card && card.box < MASTERED_BOX) learning.push(el)
  }
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const out = due.slice(0, PAIRS_PER_ROUND).map(row => row.el)
  if (out.length < PAIRS_PER_ROUND) out.push(...shuffle(fresh).slice(0, PAIRS_PER_ROUND - out.length))
  if (out.length < PAIRS_PER_ROUND) out.push(...shuffle(learning).slice(0, PAIRS_PER_ROUND - out.length))
  if (out.length < PAIRS_PER_ROUND) out.push(...shuffle(elements.filter(el => !out.includes(el))).slice(0, PAIRS_PER_ROUND - out.length))
  return out
}

export function makeRound(els: Element[]): Tile[] {
  return shuffle(els.flatMap(el => [
    { id: el.atomicNumber * 2, kind: 'symbol' as const, element: el },
    { id: el.atomicNumber * 2 + 1, kind: 'name' as const, element: el },
  ]))
}

export default function Match() {
  const { hydrated, state, today, rateCard, finishDeck } = useChemistryStore()
  const [cards, setCards] = useState<Tile[] | null>(null)
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number[]>([])
  const [wrong, setWrong] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [pairs, setPairs] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready')
  const [notice, setNotice] = useState('')
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deadline = useRef(0)
  const running = useRef(false)
  const selectedNow = useRef<number[]>([])
  const resolving = useRef(false)
  const finishedRef = useRef(false)
  const study = useRef({ cards: state.cards, today })
  const gridRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusNext = useRef<'grid' | 'next' | 'summary' | null>(null)
  useChemistryMissions({ streak, done: phase === 'done' })

  useEffect(() => { study.current = { cards: state.cards, today } }, [state.cards, today])

  useEffect(() => {
    if (hydrated && cards === null) setCards(makeRound(pickPairs(state.cards, today)))
  }, [hydrated, state.cards, today, cards])

  const end = useCallback(() => {
    if (!running.current) return
    running.current = false
    resolving.current = true
    if (settleTimer.current !== null) clearTimeout(settleTimer.current)
    settleTimer.current = null
    selectedNow.current = []
    focusNext.current = 'summary'
    setTimeLeft(0)
    setSelected([])
    setWrong([])
    setPhase('done')
  }, [])

  // Elapsed time, not interval ticks, decides the end even after a background tab resumes.
  useEffect(() => {
    if (phase !== 'running') return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) end()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    const id = setInterval(tick, 250)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [phase, end])

  useEffect(() => {
    if (selected.length === 0 && wrong.length === 0) resolving.current = false
    const focus = focusNext.current
    if (!focus) return
    const target = focus === 'summary' ? headingRef.current
      : focus === 'next' ? gridRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? gridRef.current
      : gridRef.current
    target?.focus({ preventScroll: true })
    focusNext.current = null
  }, [cards, matched, selected, wrong, phase])

  useEffect(() => {
    if (phase !== 'done' || finishedRef.current) return
    finishedRef.current = true
    finishDeck(bestStreak)
  }, [phase, bestStreak, finishDeck])

  useEffect(() => () => {
    running.current = false
    if (settleTimer.current !== null) clearTimeout(settleTimer.current)
  }, [])

  function start() {
    if (!hydrated || !cards || running.current) return
    playSound('ui_tap')
    if (settleTimer.current !== null) clearTimeout(settleTimer.current)
    settleTimer.current = null
    if (phase === 'done') setCards(makeRound(pickPairs(state.cards, today)))
    selectedNow.current = []
    resolving.current = false
    finishedRef.current = false
    running.current = true
    deadline.current = Date.now() + ROUND_SECONDS * 1000
    focusNext.current = 'grid'
    setMatched(new Set())
    setSelected([])
    setWrong([])
    setTimeLeft(ROUND_SECONDS)
    setPairs(0)
    setStreak(0)
    setBestStreak(0)
    setNotice('')
    setPhase('running')
  }

  function tap(index: number) {
    if (!hydrated || !running.current || !cards || !Number.isInteger(index) || !cards[index]) return
    if (Date.now() >= deadline.current) { end(); return }
    if (resolving.current || matched.has(cards[index].id) || selectedNow.current.includes(index)) return
    playSound('ui_tap')
    const next = [...selectedNow.current, index]
    selectedNow.current = next
    setSelected(next)
    setNotice('')
    if (next.length < 2) return
    resolving.current = true
    const a = cards[next[0]], b = cards[index]
    if (a.element.atomicNumber === b.element.atomicNumber && a.kind !== b.kind) {
      const nextMatched = new Set(matched).add(a.id).add(b.id)
      setMatched(nextMatched)
      selectedNow.current = []
      setSelected([])
      rateCard(elementCardId(a.element.atomicNumber), true)
      setPairs(value => value + 1)
      const nextStreak = streak + 1
      setStreak(nextStreak)
      setBestStreak(best => Math.max(best, nextStreak))
      setNotice(`${a.element.symbol} + ${a.element.name}`)
      focusNext.current = 'next'
      if (nextMatched.size === cards.length) {
        settleTimer.current = setTimeout(() => {
          settleTimer.current = null
          if (!running.current) return
          if (Date.now() >= deadline.current) { end(); return }
          const latest = study.current
          setCards(makeRound(pickPairs(latest.cards, latest.today)))
          setMatched(new Set())
          setNotice('New board')
          focusNext.current = 'grid'
        }, 200)
      }
    } else {
      // A speculative mismatch never downgrades either study card.
      setWrong(next)
      setStreak(0)
      setNotice('Not a match')
      settleTimer.current = setTimeout(() => {
        settleTimer.current = null
        if (!running.current) return
        if (Date.now() >= deadline.current) { end(); return }
        selectedNow.current = []
        focusNext.current = 'next'
        setSelected([])
        setWrong([])
        setNotice('')
      }, MISMATCH_FLASH_MS)
    }
  }

  if (!hydrated || cards === null) return (
    <p className="meadow-root" role="status" style={{ margin: '24px 16px', fontSize: 15, fontWeight: 700, color: M.text2 }}>Getting your pairs...</p>
  )
  if (phase === 'done') return (
    <Summary pairs={pairs} bestStreak={bestStreak} dailyStreak={state.streak.current} onAgain={start} headingRef={headingRef} />
  )
  const lowTime = timeLeft <= 10
  return (
    <section className="meadow-root" aria-label="Match session" style={{ padding: '0 16px 18px', color: M.text }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800 }}>Match</h2>
        <span role="timer" aria-label="Time remaining" aria-live="off">
          <Tag tone="soft" icon={<MeadowIcon name="clock" size={16} color={lowTime ? M.danger : M.text2} />}
            style={{ background: lowTime ? M.dangerTint : '#FFFFFF', color: lowTime ? M.danger : M.text, fontVariantNumeric: 'tabular-nums', minWidth: 76, justifyContent: 'center' }}>{timeLeft}s</Tag>
        </span>
      </div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 16 }}>
        <Tag tone="soft" style={{ background: '#FFFFFF', minWidth: 66, justifyContent: 'center' }}>{pairs} {pairs === 1 ? 'pair' : 'pairs'}</Tag>
        <Meter value={timeLeft / ROUND_SECONDS} label="Match time" height={8} color={lowTime ? M.danger : M.leaf} style={{ flex: '1 1 0' }} />
        <Tag tone={streak >= 5 ? 'amber' : 'soft'}>{streak} in a row</Tag>
      </div>
      <div ref={gridRef} role="group" aria-label="Element pairs" tabIndex={-1} className="chem-match-tiles"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoRows: 78, gap: 10, outline: 'none' }}>
        {cards.map((tile, index) => {
          const isMatched = matched.has(tile.id), isSelected = selected.includes(index), isWrong = wrong.includes(index)
          const label = tile.kind === 'symbol' ? tile.element.symbol : tile.element.name
          return (
            <Chip key={tile.id} selected={isSelected} disabled={phase !== 'running' || isMatched || wrong.length > 0} onClick={() => tap(index)}
              ariaLabel={`${tile.kind === 'symbol' ? 'Symbol' : 'Name'}: ${label}${isMatched ? ', matched' : isWrong ? ', not a match' : ''}`}
              style={{ position: 'relative', height: '100%', width: '100%', minWidth: 0, padding: '8px 4px', borderRadius: 14,
                justifyContent: 'center', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'center',
                fontSize: tile.kind === 'symbol' ? 26 : label.length >= 11 ? 12 : 13, fontWeight: tile.kind === 'symbol' ? 800 : 700, lineHeight: 1.2,
                background: isWrong ? M.dangerTint : isSelected || isMatched ? M.leafTint : '#FFFFFF',
                borderColor: isWrong ? M.danger : isSelected ? M.leaf : 'transparent', color: isWrong ? M.danger : M.text,
                opacity: isMatched ? 0.3 : 1 }}>
              {label}
              {(isMatched || isWrong) && <MeadowIcon name={isWrong ? 'close' : 'check'} size={12} color={isWrong ? M.danger : M.leaf} style={{ position: 'absolute', right: 5, top: 5 }} />}
            </Chip>
          )
        })}
      </div>
      <style>{`
        .chem-match-tiles button { transition: opacity 180ms ease-out, transform 70ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .chem-match-tiles button { transition: none !important; } }
      `}</style>
      <div role="status" style={{ minHeight: 42, paddingTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 15, lineHeight: 1.4, fontWeight: 700, color: wrong.length ? M.danger : M.leafInk }}>
        {notice && <>
          <MeadowIcon name={wrong.length ? 'close' : 'check'} size={20} color={wrong.length ? M.danger : M.leaf} style={{ flexShrink: 0 }} />
          <span>{notice}</span>
        </>}
      </div>
      {phase === 'ready' && <PrimaryButton size="md" full onClick={start} icon={<MeadowIcon name="clock" size={20} color="#FFFFFF" />}>Start</PrimaryButton>}
    </section>
  )
}

function Summary({ pairs, bestStreak, dailyStreak, onAgain, headingRef }: {
  pairs: number; bestStreak: number; dailyStreak: number; onAgain: () => void; headingRef: RefObject<HTMLHeadingElement>
}) {
  return (
    <section className="meadow-root" aria-label="Match results" style={{ padding: '0 16px 18px', color: M.text }}>
      <Card padding="22px 20px" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><CheckDisc size={44} /></div>
        <h2 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800, outline: 'none' }}>Time's up</h2>
        <p style={{ ...TYPE.number, fontSize: 38, margin: '8px 0 0' }}>{pairs}</p>
        <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: M.text2 }}>{pairs === 1 ? 'pair matched' : 'pairs matched'}</p>
        {pairs >= 18 && <Tag tone="leaf" icon={<MeadowIcon name="star" size={16} />} style={{ marginTop: 12 }}>Great run</Tag>}
      </Card>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, margin: '20px 0' }}>
        <div><dt style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Best run</dt><dd style={{ ...TYPE.number, margin: '4px 0 0', fontSize: 17 }}>{bestStreak} in a row</dd></div>
        <div><dt style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Daily streak</dt><dd style={{ ...TYPE.number, margin: '4px 0 0', fontSize: 17 }}>{dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}</dd></div>
      </dl>
      <PrimaryButton size="md" full onClick={onAgain} icon={<MeadowIcon name="replay" size={20} color="#FFFFFF" />}>Play again</PrimaryButton>
    </section>
  )
}
