'use client'

// Locate — 10-round "find this element" game on a blank periodic table.
// Tiles show only category color (no symbols, no atomic numbers) so the
// player has to recall where each element sits on the grid. Correct tap
// flashes green; wrong tap flashes red AND outlines the target. 950ms
// delay between rounds so feedback is readable.

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Target, Trophy } from 'lucide-react'
import { elements, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS } from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { useChemistryTheme, CHEM_FONT, neoShadow, type Palette } from '@/lib/chemistry/theme'
import { playSound } from '@/lib/sounds'
import { shuffle } from '@/lib/chemistry/questions'

const ROUNDS = 10
const TILE = 26
const GAP  = 3
const SPACER_PX = 6
const MAIN_ROWS = 7
const F_ROWS = 2
const BEST_KEY = 'eren_chem_locate_best'

type Status = 'idle' | 'playing' | 'done'
type Overlay = Record<number, 'correct' | 'wrong' | 'target'>

interface Props { onExit: () => void }

export default function Locate({ onExit }: Props) {
  const { palette } = useChemistryTheme()
  const { rateCard } = useChemistryStore()
  const [status, setStatus] = useState<Status>('idle')
  const [targets, setTargets] = useState<Element[]>([])
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [overlay, setOverlay] = useState<Overlay>({})
  const lockedRef = useRef(false)
  const [best, setBest] = useState(0)

  useEffect(() => {
    try {
      const v = localStorage.getItem(BEST_KEY)
      if (v) setBest(parseInt(v, 10) || 0)
    } catch { /* ignore */ }
  }, [])

  function start() {
    setTargets(shuffle(elements).slice(0, ROUNDS))
    setRound(0)
    setScore(0)
    setOverlay({})
    lockedRef.current = false
    setStatus('playing')
  }

  function handleClick(el: Element) {
    if (lockedRef.current || status !== 'playing') return
    const target = targets[round]
    if (!target) return
    lockedRef.current = true
    const correct = el.atomicNumber === target.atomicNumber
    rateCard(elementCardId(target.atomicNumber), correct)
    if (correct) {
      setScore(s => s + 1)
      setOverlay({ [el.atomicNumber]: 'correct' })
    } else {
      setOverlay({
        [el.atomicNumber]: 'wrong',
        [target.atomicNumber]: 'target',
      })
    }
    playSound('ui_tap')
    setTimeout(() => {
      if (round + 1 >= ROUNDS) {
        setStatus('done')
        try {
          const finalScore = score + (correct ? 1 : 0)
          if (finalScore > best) {
            localStorage.setItem(BEST_KEY, String(finalScore))
            setBest(finalScore)
          }
        } catch { /* ignore */ }
        return
      }
      setRound(r => r + 1)
      setOverlay({})
      lockedRef.current = false
    }, 950)
  }

  const target = targets[round]

  const grid = useMemo(() => (
    <div style={{ position: 'relative' }}>
      <div
        style={{ overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(18, ${TILE}px)`,
            gridTemplateRows: `repeat(${MAIN_ROWS}, ${TILE}px) ${SPACER_PX}px repeat(${F_ROWS}, ${TILE}px)`,
            gap: GAP, padding: 6, width: 'max-content',
          }}
        >
          {elements.map(el => {
            const fill = CATEGORY_COLORS[el.category]
            const o = overlay[el.atomicNumber]
            const outline =
              o === 'correct' ? `3px solid ${palette.green}` :
              o === 'wrong'   ? `3px solid ${palette.red}`   :
              o === 'target'  ? `3px solid ${palette.skyDark}` :
              `1.5px solid ${palette.ink}`
            return (
              <button
                key={el.atomicNumber}
                type="button"
                onClick={() => handleClick(el)}
                style={{
                  gridColumn: el.xpos,
                  gridRow: el.ypos <= 7 ? el.ypos : el.ypos + 1,
                  background: fill,
                  border: outline,
                  borderRadius: 6,
                  padding: 0,
                  cursor: 'pointer',
                  opacity: o === 'wrong' ? 0.85 : 1,
                  transition: 'border 80ms ease',
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  ), [overlay, palette]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'idle') {
    return (
      <Center palette={palette}>
        <MapPin size={48} strokeWidth={2.2} color={palette.skyDark} />
        <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.fg }}>Locate</h2>
        <p style={{ fontSize: 13, color: palette.fgMuted, maxWidth: 320, textAlign: 'center' }}>
          10 rounds. We name an element, you tap it on the blank table.
        </p>
        {best > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999,
            background: palette.sunLight, color: palette.ink,
            fontSize: 12, fontWeight: 800,
          }}>
            <Trophy size={13} strokeWidth={2.4} />
            Best · {best} / {ROUNDS}
          </div>
        )}
        <button onClick={start} type="button" style={primaryBtn(palette)}>Start</button>
        <button onClick={onExit} type="button" style={ghostBtn(palette)}>Back</button>
      </Center>
    )
  }

  if (status === 'done') {
    return (
      <Center palette={palette}>
        <Target size={48} strokeWidth={2.2} color={palette.grapeDark} />
        <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.fg }}>Round complete</h2>
        <div style={{ fontSize: 48, fontWeight: 900, color: palette.fg }}>
          {score} / {ROUNDS}
        </div>
        <div style={{ fontSize: 12, color: palette.fgMuted }}>Best · {best}</div>
        <button onClick={start} type="button" style={primaryBtn(palette)}>Play again</button>
        <button onClick={onExit} type="button" style={ghostBtn(palette)}>Back</button>
      </Center>
    )
  }

  return (
    <div style={{
      padding: '0 14px 22px',
      display: 'flex', flexDirection: 'column', gap: 12,
      fontFamily: CHEM_FONT,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <span style={{
          padding: '4px 10px', borderRadius: 999,
          background: palette.cardMuted, color: palette.fg,
          fontSize: 11, fontWeight: 700,
        }}>
          Round {round + 1} / {ROUNDS}
        </span>
        <span style={{
          padding: '4px 10px', borderRadius: 999,
          background: palette.cardMuted, color: palette.fg,
          fontSize: 11, fontWeight: 700,
        }}>
          Score · {score}
        </span>
      </div>

      <div style={{
        borderRadius: 22, padding: 22, textAlign: 'center',
        background: palette.grapeLight, color: palette.ink,
        border: `2px solid ${palette.ink}`,
        boxShadow: neoShadow(palette.ink, 'lg'),
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: palette.grapeDark }}>
          FIND ON THE TABLE
        </div>
        <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>
          {target?.name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginTop: 2 }}>
          symbol · {target?.symbol}
        </div>
      </div>

      {grid}
    </div>
  )
}

function Center({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '40px 22px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      textAlign: 'center', fontFamily: CHEM_FONT, color: palette.fg,
    }}>
      {children}
    </div>
  )
}

function primaryBtn(palette: Palette): React.CSSProperties {
  return {
    marginTop: 6,
    padding: '10px 22px', borderRadius: 999,
    border: `2px solid ${palette.ink}`,
    boxShadow: neoShadow(palette.ink, 'md'),
    background: palette.sky, color: palette.ink,
    fontFamily: CHEM_FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer',
  }
}
function ghostBtn(palette: Palette): React.CSSProperties {
  return {
    padding: '10px 22px', borderRadius: 999,
    border: `2px solid ${palette.ink}`,
    boxShadow: neoShadow(palette.ink, 'sm'),
    background: '#FFFFFF', color: palette.ink,
    fontFamily: CHEM_FONT, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  }
}
