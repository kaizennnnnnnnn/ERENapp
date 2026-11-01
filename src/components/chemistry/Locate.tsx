'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { elements, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS } from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { playSound } from '@/lib/sounds'
import { shuffle } from '@/lib/chemistry/questions'
import { tableNeighbor } from './PeriodicTable'
import { Card, CheckDisc, M, MeadowIcon, Meter, PrimaryButton, Tag, TextButton, TYPE } from '@/components/meadow'

const ROUNDS = 10
const TILE = 30
const GAP = 4
const BEST_KEY = 'eren_chem_locate_best'
type Overlay = Record<number, 'correct' | 'wrong' | 'target'>

export default function Locate({ onExit }: { onExit: () => void }) {
  const { hydrated, rateCard } = useChemistryStore()
  const [status, setStatus] = useState<'idle' | 'playing' | 'done'>('idle')
  const [targets, setTargets] = useState<Element[]>([])
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [overlay, setOverlay] = useState<Overlay>({})
  const [best, setBest] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [active, setActive] = useState(1)
  const locked = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bestNow = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const buttons = useRef(new Map<number, HTMLButtonElement>())
  const focusNext = useRef(false)

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY))
      if (Number.isInteger(saved) && saved >= 0 && saved <= ROUNDS) { bestNow.current = saved; setBest(saved) }
    } catch { /* Private browsing can disable storage. */ }
    setLoaded(true)
  }, [])
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])
  useEffect(() => {
    locked.current = false
    if (focusNext.current) { heading.current?.focus({ preventScroll: true }); focusNext.current = false }
  }, [round, targets, status])

  function start() {
    if (!hydrated || !loaded || status === 'playing' || locked.current) return
    locked.current = true
    playSound('ui_tap')
    setTargets(shuffle(elements).slice(0, ROUNDS))
    setRound(0); setScore(0); setOverlay({}); setActive(1)
    focusNext.current = true
    setStatus('playing')
  }

  function choose(el: Element) {
    const target = targets[round]
    if (!hydrated || status !== 'playing' || locked.current || !target) return
    locked.current = true
    const correct = el.atomicNumber === target.atomicNumber
    const nextScore = score + (correct ? 1 : 0)
    setScore(nextScore)
    setOverlay(correct ? { [el.atomicNumber]: 'correct' } : { [el.atomicNumber]: 'wrong', [target.atomicNumber]: 'target' })
    rateCard(elementCardId(target.atomicNumber), correct)
    playSound('ui_tap')
    timer.current = setTimeout(() => {
      timer.current = null
      focusNext.current = true
      if (round + 1 >= targets.length) {
        if (nextScore > bestNow.current) {
          bestNow.current = nextScore
          setBest(nextScore)
          try { localStorage.setItem(BEST_KEY, String(nextScore)) } catch { /* Keep the in-memory result. */ }
        }
        setStatus('done')
      } else {
        setOverlay({})
        setRound(value => value + 1)
      }
    }, 950)
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, el: Element) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = tableNeighbor(el, event.key)
    if (next) buttons.current.get(next.atomicNumber)?.focus()
  }

  const back = () => { playSound('ui_back'); onExit() }
  if (!hydrated || !loaded) return <p className="meadow-root" role="status" style={{ margin: '24px 16px', fontSize: 15, fontWeight: 700, color: M.text2 }}>Getting your table...</p>
  if (status !== 'playing') return (
    <section className="meadow-root" aria-label={status === 'done' ? 'Locate results' : 'Locate round'} style={{ padding: '0 16px 18px', color: M.text }}>
      <Card padding="24px 20px" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>{status === 'done' ? <CheckDisc size={44} /> : <MeadowIcon name="pin" size={44} color={M.leaf} />}</div>
        <h2 ref={heading} tabIndex={-1} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800, outline: 'none' }}>{status === 'done' ? 'Round complete' : 'Locate'}</h2>
        {status === 'done' ? <>
          <p style={{ ...TYPE.number, fontSize: 38, margin: '8px 0 0' }}>{score} / {targets.length}</p>
          {score === targets.length && <Tag tone="leaf" icon={<MeadowIcon name="star" size={16} />} style={{ marginTop: 12 }}>Perfect!</Tag>}
        </> : <Tag tone="soft" style={{ marginTop: 14 }}>10 rounds</Tag>}
        <dl style={{ margin: '20px 0 0' }}><dt style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Personal best</dt><dd style={{ ...TYPE.number, fontSize: 22, margin: '4px 0 0' }}>{best} / {ROUNDS}</dd></dl>
      </Card>
      <PrimaryButton size="md" full onClick={start} style={{ marginTop: 20 }} icon={<MeadowIcon name={status === 'done' ? 'replay' : 'pin'} size={20} color="#FFFFFF" />}>{status === 'done' ? 'Play again' : 'Start'}</PrimaryButton>
      <TextButton onClick={back} style={{ marginTop: 8, width: '100%' }}>Back to lab</TextButton>
    </section>
  )
  const target = targets[round]
  const reveal = Object.keys(overlay).length > 0
  const correct = overlay[target.atomicNumber] === 'correct'
  return (
    <section className="meadow-root" aria-label="Locate session" style={{ padding: '0 16px 18px', color: M.text }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800 }}>Locate</h2>
        <Tag tone="soft" style={{ background: '#FFFFFF' }}>Score {score}</Tag>
      </div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 14 }}>
        <Meter value={(round + (reveal ? 1 : 0)) / targets.length} label="Locate progress" height={8} color={M.leaf} style={{ flex: '1 1 0' }} />
        <Tag tone="soft" style={{ background: '#FFFFFF' }}>{round + 1} / {targets.length}</Tag>
      </div>
      <Card padding="14px 18px" style={{ textAlign: 'center', minHeight: 96, marginBottom: 8 }}>
        <h3 ref={heading} tabIndex={-1} style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800, overflowWrap: 'anywhere', outline: 'none' }}>{target.name}</h3>
        <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 700, color: M.text2 }}>{target.symbol}</p>
      </Card>
      <div role="group" aria-label="Blank periodic table" style={{ overflowX: 'auto', padding: '4px 0 8px', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(18, ${TILE}px)`, gridTemplateRows: `repeat(7, ${TILE}px) 8px repeat(2, ${TILE}px)`, gap: GAP, padding: 4, width: 'max-content' }}>
          {elements.map(el => {
            const mark = overlay[el.atomicNumber]
            return <button key={el.atomicNumber} type="button" className="m-focus" disabled={reveal}
              ref={node => { if (node) buttons.current.set(el.atomicNumber, node); else buttons.current.delete(el.atomicNumber) }}
              tabIndex={el.atomicNumber === active ? 0 : -1} onFocus={() => setActive(el.atomicNumber)} onKeyDown={event => navigate(event, el)} onClick={() => choose(el)}
              aria-label={`Row ${el.ypos}, column ${el.xpos}${mark ? `, ${mark === 'wrong' ? 'incorrect choice' : mark === 'target' ? 'correct location' : 'correct choice'}` : ''}`}
              style={{ gridColumn: el.xpos, gridRow: el.ypos, width: TILE, height: TILE, padding: 0, borderRadius: 6, position: 'relative',
                background: CATEGORY_COLORS[el.category], border: `${mark ? 3 : 1}px solid ${mark === 'wrong' ? M.danger : mark ? M.leafInk : 'rgba(47,43,40,.14)'}`, cursor: reveal ? 'default' : 'pointer', opacity: mark === 'wrong' ? 0.7 : 1 }}>
              {mark && <MeadowIcon name={mark === 'wrong' ? 'close' : 'check'} size={16} color={mark === 'wrong' ? M.danger : M.leafInk} style={{ margin: 'auto' }} />}
            </button>
          })}
        </div>
      </div>
      <div role="status" style={{ minHeight: 40, paddingTop: 8, fontSize: 15, fontWeight: 700, color: correct ? M.leafInk : M.danger }}>{reveal ? correct ? 'Correct!' : `Correct location: row ${target.ypos}, column ${target.xpos}` : ''}</div>
    </section>
  )
}
