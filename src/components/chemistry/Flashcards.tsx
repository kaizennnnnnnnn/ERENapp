'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { elements, CATEGORY_LABELS, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS, STATE_LABELS } from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { dueDate, isDue, isNew, MASTERED_BOX, type CardState } from '@/lib/chemistry/srs'
import { shuffle } from '@/lib/chemistry/questions'
import { useChemistryMissions } from '@/lib/chemistry/missions'
import { playSound } from '@/lib/sounds'
import { Card, CheckDisc, M, MeadowIcon, Meter, PrimaryButton, SecondaryButton, Tag, TYPE } from '@/components/meadow'

const DECK_SIZE = 10

/** Oldest due first, then new cards, then the next-due learning cards. */
export function buildDeck(cards: Record<string, CardState>, today: string): Element[] {
  const due: { el: Element; dueOn: string }[] = []
  const fresh: Element[] = []
  const future: { el: Element; dueOn: string }[] = []
  for (const el of elements) {
    const card = cards[elementCardId(el.atomicNumber)]
    if (isDue(card, today)) due.push({ el, dueOn: dueDate(card!) ?? today })
    else if (isNew(card)) fresh.push(el)
    else if (card && card.box < MASTERED_BOX) future.push({ el, dueOn: dueDate(card) ?? today })
  }
  due.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  future.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  if (due.length >= DECK_SIZE) return due.slice(0, DECK_SIZE).map(row => row.el)
  return [...due.map(row => row.el), ...shuffle(fresh), ...future.map(row => row.el)].slice(0, DECK_SIZE)
}

export default function Flashcards() {
  const { hydrated, state, today, rateCard, finishDeck, dueCount, newCount } = useChemistryStore()
  const [deck, setDeck] = useState<Element[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const finishedRef = useRef(false)
  const ratedRef = useRef(false)
  const focusNext = useRef(false)
  const cardRef = useRef<HTMLButtonElement>(null)
  const summaryRef = useRef<HTMLHeadingElement>(null)
  const done = deck !== null && deck.length > 0 && index >= deck.length
  useChemistryMissions({ streak, done })

  // Build once; rating a card must not reshuffle the active deck.
  useEffect(() => {
    if (!hydrated || deck !== null) return
    setDeck(buildDeck(state.cards, today))
  }, [hydrated, today, state.cards, deck])

  useEffect(() => {
    ratedRef.current = false
    if (focusNext.current) {
      const target = cardRef.current ?? summaryRef.current
      target?.focus({ preventScroll: true })
      focusNext.current = false
    }
  }, [index, deck])

  useEffect(() => {
    if (!done || finishedRef.current) return
    finishedRef.current = true
    finishDeck(bestStreak)
  }, [done, bestStreak, finishDeck])

  function flip() {
    if (!hydrated || !deck?.[index] || ratedRef.current) return
    playSound('ui_tap')
    setFlipped(value => !value)
  }

  function rate(isRight: boolean) {
    const current = deck?.[index]
    if (!hydrated || !current || !flipped || ratedRef.current) return
    ratedRef.current = true
    focusNext.current = true
    playSound('ui_tap')
    rateCard(elementCardId(current.atomicNumber), isRight)
    const nextStreak = isRight ? streak + 1 : 0
    setStreak(nextStreak)
    setBestStreak(best => Math.max(best, nextStreak))
    if (isRight) setCorrect(value => value + 1)
    setFlipped(false)
    setIndex(value => value + 1)
  }

  function reset() {
    if (!hydrated) return
    playSound('ui_tap')
    ratedRef.current = true
    focusNext.current = true
    setDeck(buildDeck(state.cards, today))
    setIndex(0)
    setFlipped(false)
    setStreak(0)
    setBestStreak(0)
    setCorrect(0)
    finishedRef.current = false
  }

  if (!hydrated || deck === null) return (
    <p className="meadow-root" role="status" style={{ margin: '24px 16px', fontSize: 15, fontWeight: 700, color: M.text2 }}>Getting your cards...</p>
  )
  if (deck.length === 0) return (
    <section className="meadow-root" aria-label="Flashcards" style={{ padding: '32px 22px', textAlign: 'center', color: M.text }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><CheckDisc size={52} /></div>
      <h2 ref={summaryRef} tabIndex={-1} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800 }}>All caught up</h2>
      <p style={{ margin: '10px 0 20px', fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: M.text2 }}>Your next cards will appear when they are due.</p>
      <SecondaryButton size="md" full onClick={reset}>Check again</SecondaryButton>
    </section>
  )
  if (done) return (
    <DeckSummary total={deck.length} correct={correct} bestStreak={bestStreak}
      dailyStreak={state.streak.current} onAgain={reset} headingRef={summaryRef} />
  )

  const current = deck[index]
  return (
    <section className="meadow-root" aria-label="Flashcard session" style={{ padding: '0 16px 18px', color: M.text }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800 }}>Flashcards</h2>
        <Tag tone="soft" style={{ background: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>{index + 1} / {deck.length}</Tag>
      </div>
      <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
        <Tag tone="soft" style={{ background: '#FFFFFF' }}>{dueCount} due</Tag>
        <Tag tone="soft" style={{ background: '#FFFFFF' }}>{newCount} new</Tag>
        <Tag tone="soft" icon={<MeadowIcon name="flame" size={16} />} style={{ background: '#FFFFFF' }}>{state.streak.current} day streak</Tag>
      </div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 16 }}>
        <Meter value={index / deck.length} label="Deck progress" height={8} color={M.leaf} style={{ flex: '1 1 0' }} />
        <Tag tone={streak >= 5 ? 'amber' : 'soft'}>{streak} in a row</Tag>
      </div>
      <FlipCard key={current.atomicNumber} el={current} flipped={flipped} onFlip={flip} buttonRef={cardRef}
        box={state.cards[elementCardId(current.atomicNumber)]?.box ?? 0} />
      <div style={{ marginTop: 16, minHeight: 50 }}>
        {flipped ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <SecondaryButton size="md" full onClick={() => rate(false)} icon={<MeadowIcon name="replay" size={20} />}>Again</SecondaryButton>
            <PrimaryButton size="md" full onClick={() => rate(true)} icon={<MeadowIcon name="check" size={20} color="#FFFFFF" />}>Got it</PrimaryButton>
          </div>
        ) : (
          <PrimaryButton size="md" full onClick={flip} icon={<MeadowIcon name="replay" size={20} color="#FFFFFF" />}>Reveal answer</PrimaryButton>
        )}
      </div>
    </section>
  )
}

function FlipCard({ el, flipped, onFlip, box, buttonRef }: {
  el: Element; flipped: boolean; onFlip: () => void; box: number; buttonRef: RefObject<HTMLButtonElement>
}) {
  const accent = CATEGORY_COLORS[el.category]
  const face = {
    position: 'absolute' as const, inset: 0, height: '100%', borderTop: `4px solid ${accent}`,
    backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const,
    display: 'flex', flexDirection: 'column' as const, textAlign: 'left' as const,
  }
  return (
    <button type="button" ref={buttonRef} onClick={onFlip} className="m-focus"
      aria-label={flipped ? `${el.name}, ${el.symbol}. Hide answer` : `${el.symbol}, atomic number ${el.atomicNumber}. Reveal answer`}
      aria-pressed={flipped} title={flipped ? 'Hide answer' : 'Reveal answer'}
      style={{ position: 'relative', display: 'block', width: '100%', height: 300, perspective: 1200, background: 'transparent', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
      <div className="flashcard-turn" style={{
        position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
        transition: 'transform 400ms cubic-bezier(.4,0,.2,1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        <Card padding="20px" style={{ ...face, alignItems: 'center', justifyContent: 'center' }}>
          <div aria-hidden={flipped}>
            <p style={{ margin: 0, textAlign: 'center', fontSize: 14, fontWeight: 700, color: M.text2 }}>#{el.atomicNumber}</p>
            <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 64, fontWeight: 800, lineHeight: 1, color: M.text }}>{el.symbol}</p>
            <p style={{ margin: '18px 0 0', fontSize: 15, fontWeight: 500, color: M.text2 }}>What element is this?</p>
          </div>
        </Card>
        <Card padding="18px 20px" style={{ ...face, transform: 'rotateY(180deg)' }}>
          <div aria-hidden={!flipped} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="flex items-baseline" style={{ gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: M.text }}>{el.symbol}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>#{el.atomicNumber}</span>
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, lineHeight: 1.25, color: M.text, overflowWrap: 'anywhere' }}>{el.name}</h3>
            <div className="flex flex-wrap" style={{ gap: 6, marginTop: 10 }}>
              <Tag tone="soft">{CATEGORY_LABELS[el.category]}</Tag>
              <Tag tone="soft">{STATE_LABELS[el.state]}</Tag>
            </div>
            {el.funFact && <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
              {el.funFact.length > 130 ? el.funFact.slice(0, 127) + '...' : el.funFact}
            </p>}
            {box > 0 && <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: M.text2 }}>Mastery: {box}/{MASTERED_BOX}</p>
              <Meter value={Math.min(box, MASTERED_BOX) / MASTERED_BOX} color={M.leaf} height={8} label="Element mastery" />
            </div>}
          </div>
        </Card>
      </div>
      <style>{`@media (prefers-reduced-motion: reduce) { .flashcard-turn { transition: none !important; } }`}</style>
    </button>
  )
}

function DeckSummary({ total, correct, bestStreak, dailyStreak, onAgain, headingRef }: {
  total: number; correct: number; bestStreak: number; dailyStreak: number; onAgain: () => void; headingRef: RefObject<HTMLHeadingElement>
}) {
  const pct = Math.round(correct / total * 100)
  return (
    <section className="meadow-root" aria-label="Flashcard results" style={{ padding: '0 16px 18px', color: M.text }}>
      <Card padding="22px 20px" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><CheckDisc size={44} /></div>
        <h2 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800 }}>Deck complete</h2>
        <p style={{ ...TYPE.number, fontSize: 38, margin: '8px 0 0' }}>{pct}%</p>
        <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: M.text2 }}>{correct} of {total} correct</p>
        {pct >= 90 && <Tag tone="leaf" icon={<MeadowIcon name="star" size={16} />} style={{ marginTop: 12 }}>{pct === 100 ? 'Perfect!' : 'Great run'}</Tag>}
      </Card>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, margin: '20px 0' }}>
        <SummaryStat label="Best run" value={`${bestStreak} in a row`} />
        <SummaryStat label="Daily streak" value={`${dailyStreak} ${dailyStreak === 1 ? 'day' : 'days'}`} />
      </dl>
      <PrimaryButton size="md" full onClick={onAgain} icon={<MeadowIcon name="replay" size={20} color="#FFFFFF" />}>New deck</PrimaryButton>
    </section>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return <div>
    <dt style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>{label}</dt>
    <dd style={{ ...TYPE.number, margin: '4px 0 0', fontSize: 17 }}>{value}</dd>
  </div>
}
