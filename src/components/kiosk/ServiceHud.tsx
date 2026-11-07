'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MeadowIcon } from '@/components/meadow'
import {
  TOPPING_BY_ID, SAUCE_BY_ID, SIDE_BY_ID, TORTILLA_SPOTS, MEAT_ON_TORTILLA,
  SAUCE_ON_TORTILLA, SHAVED_MEAT, ROLL_MS, ROLL_BAND, tidinessFor,
  type Build, type Tidiness, type Tray,
} from './kioskShift'
import type { Nudge } from './useKioskShift'
import { KIOSK as K, kioskPanel } from './kioskTheme'

interface Props {
  boards: Build[]; active: number; tray: Tray; wrapsWanted: number; nudge: Nudge
  canRoll: boolean; canServe: boolean
  onTrash: () => void; onPick: (i: number) => void; onRoll: (tidy: Tidiness) => void; onServe: () => void
}
function Laid({ src, label, spot }: { src: string; label: string; spot: { x: number; y: number; size: number; rot: number } }) {
  return <span style={{ position: 'absolute', left: spot.x+'%', top: spot.y+'%', width: spot.size+'%', transform: 'translate(-50%, -50%)' }}>
    <span style={{ display: 'block', transform: 'rotate('+spot.rot+'deg)' }}>
      <img src={src} alt={label} draggable={false} style={{ width: '100%', height: 'auto', display: 'block',
        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))', animation: 'kioskDropOn 320ms cubic-bezier(0.32, 0.72, 0, 1) both' }} />
    </span>
  </span>
}
function Tortilla({ build, size }: { build: Build; size: number }) {
  const busy = build.meat || build.toppings.length > 0 || build.sauce !== null
  return <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
    <img src="/tortilla.webp" alt="Tortilla" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
      filter: 'brightness(0.94) saturate(0.96) drop-shadow(0 2px 3px rgba(0,0,0,0.55))', opacity: busy ? 1 : 0.72 }} />
    {build.meat && <Laid src={SHAVED_MEAT} label="Meat" spot={MEAT_ON_TORTILLA} />}
    {build.toppings.map((t, i) => {
      const second = build.toppings.indexOf(t) !== i, spot = TORTILLA_SPOTS[t]
      return <Laid key={t+'-'+i} src={TOPPING_BY_ID[t].sprite} label={second ? 'Extra '+TOPPING_BY_ID[t].label : TOPPING_BY_ID[t].label}
        spot={second ? { ...spot, x: spot.x+8, y: spot.y-7, rot: spot.rot+26 } : spot} />
    })}
    {build.sauce && <Laid src={SAUCE_BY_ID[build.sauce].drizzle} label={SAUCE_BY_ID[build.sauce].label+' sauce'} spot={SAUCE_ON_TORTILLA} />}
  </div>
}

export default function ServiceHud({ boards, active, tray, wrapsWanted, nudge, canRoll, canServe, onTrash, onPick, onRoll, onServe }: Props) {
  const busy = (b: Build) => b.meat || b.toppings.length > 0 || b.sauce !== null
  const empty = !boards.some(busy) && tray.wraps.length === 0 && tray.sides.length === 0
  const done = tray.wraps.length >= wrapsWanted, two = boards.length > 1
  const [roll, setRoll] = useState<number | null>(null)
  const held = useRef<number | null>(null), frame = useRef(0)
  const endRoll = useCallback(() => {
    const at = held.current
    held.current = null; cancelAnimationFrame(frame.current); setRoll(null)
    if (at !== null) onRoll(tidinessFor(Math.min(1, (performance.now()-at)/ROLL_MS)))
  }, [onRoll])
  const startRoll = useCallback(() => {
    if (held.current !== null) return
    held.current = performance.now()
    const step = () => {
      const at = held.current
      if (at === null) return
      const p = (performance.now()-at)/ROLL_MS
      if (p >= 1.14) { endRoll(); return }
      setRoll(Math.min(1, p)); frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }, [endRoll])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  useEffect(() => {
    if (!canRoll && held.current !== null) { held.current = null; cancelAnimationFrame(frame.current); setRoll(null) }
  }, [canRoll])
  const rolling = roll !== null, tidy = rolling ? tidinessFor(roll) : null
  const enabled = done ? canServe : canRoll
  return <div className="kiosk-prep-hud pointer-events-none" style={{ position: 'absolute', left: 12, right: 12, zIndex: 56,
    bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }}>
    {nudge && <div key={nudge.id} role="status" style={{ ...kioskPanel, padding: '8px 12px', marginBottom: 8, fontSize: 13,
      color: K.coin, lineHeight: 1.4, animation: 'kioskNudge 2.4s ease-out both' }}>{nudge.text}</div>}
    <div style={{ ...kioskPanel, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 104px', gap: 10,
      alignItems: 'center', pointerEvents: 'auto' }}>
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 6 }}>
        {boards.map((board, i) => <button key={i} type="button"
          aria-label={two ? 'Work on wrap '+(i+1)+(i === active ? ' (current)' : '') : 'The wrap in your hands'}
          aria-pressed={two ? i === active : undefined} disabled={!two} onClick={two ? () => onPick(i) : undefined}
          className="m-focus" style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 4, minWidth: 0, padding: 3,
            color: two && i === active ? K.leaf : K.muted, background: two && i === active ? K.raised : 'transparent',
            border: two ? '1px solid '+(i === active ? K.leaf : K.line) : '1px solid transparent', borderRadius: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700 }}>{two ? 'Wrap '+(i+1) : 'Your wrap'}</span>
          <Tortilla build={board} size={two ? 48 : 68} />
        </button>)}
        <div aria-label={'Tray, '+tray.wraps.length+' of '+wrapsWanted+' wraps ready'} style={{ minWidth: 32, display: 'grid', gap: 5, justifyItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: K.muted }}>Tray</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: Math.max(1, wrapsWanted) }, (_, i) => <div key={i} style={{ width: 25, height: 29, borderRadius: 5,
              display: 'grid', placeItems: 'center', boxSizing: 'border-box', border: i < tray.wraps.length ? '1px solid transparent' : '1px dashed '+K.line }}>
              {i < tray.wraps.length && <img src="/wrap_rolled.webp" alt="Rolled wrap" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain',
                transform: tray.wraps[i].tidy === 'split' ? 'rotate(-9deg) scale(0.94)' : undefined,
                animation: 'kioskRollShut 420ms cubic-bezier(0.32, 0.72, 0, 1) both' }} />}
            </div>)}
          </div>
          <div style={{ display: 'flex', gap: 3, height: 23 }}>
            {tray.sides.map(side => <img key={side} src={SIDE_BY_ID[side].sprite} alt={SIDE_BY_ID[side].label} draggable={false}
              style={{ width: side === 'cola' ? 15 : 22, height: 23, objectFit: 'contain', animation: 'kioskDropOn 320ms ease-out both' }} />)}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, alignItems: 'center', justifyItems: 'stretch' }}>
        <div style={{ position: 'relative' }}>
          {rolling && <div aria-hidden style={{ position: 'absolute', bottom: 'calc(100% + 5px)', left: 0, right: 0, height: 6,
            background: K.ground, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: '0 auto 0 '+(ROLL_BAND[0]*100)+'%', width: ((ROLL_BAND[1]-ROLL_BAND[0])*100)+'%', background: K.leafFace }} />
            <div style={{ height: '100%', width: (roll*100)+'%', background: tidy === 'neat' ? K.leaf : tidy === 'split' ? K.danger : K.coin }} />
          </div>}
          <button type="button" className="m-lip m-focus" aria-label={done ? 'Hand the order over' : 'Hold to roll the wrap up'}
            title={done ? 'Serve order' : 'Hold to roll the wrap up'} onClick={done ? onServe : undefined}
            onPointerDown={done || !canRoll ? undefined : startRoll} onPointerUp={done ? undefined : endRoll}
            onPointerLeave={done ? undefined : endRoll} onPointerCancel={done ? undefined : endRoll}
            onBlur={done ? undefined : endRoll}
            onKeyDown={event => { if (!done && canRoll && !event.repeat && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); startRoll() } }}
            onKeyUp={event => { if (!done && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); endRoll() } }}
            onContextMenu={event => event.preventDefault()} disabled={!enabled}
            style={{ '--m-lip': enabled ? K.leafLip : K.lip, '--m-lip-h': '3px', width: '100%', height: 44, border: 0, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: enabled ? '#FFFFFF' : K.muted,
              background: enabled ? K.leafFace : K.raised, opacity: enabled ? 1 : 0.55, fontSize: 15, fontWeight: 800,
              touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}>
            <MeadowIcon name={done ? 'check' : 'shawarma'} size={17} mono color={enabled ? '#FFFFFF' : K.muted} />{done ? 'Serve' : 'Roll'}
          </button>
        </div>
        <button type="button" className="m-focus kiosk-icon-tool" aria-label="Scrap this order and start again" title="Scrap order"
          onClick={onTrash} disabled={empty} style={{ position: 'relative', width: '100%', height: 44, border: 0, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: K.muted, opacity: empty ? 0.35 : 1 }}>
          <MeadowIcon name="trash" size={19} mono color={K.muted} /><span className="kiosk-action-tooltip">Scrap order</span>
        </button>
      </div>
    </div>
  </div>
}
