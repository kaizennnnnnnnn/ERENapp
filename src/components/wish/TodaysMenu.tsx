'use client'

// ═══════════════════════════════════════════════════════════════════════════
// TODAY'S MENU — the three foods Eren wants, behind a bowl at his side.
// ──────────────────────────────────────────────────────────────────────────
// This started as a full-width bar stacked under the co-op goal, and it was
// wrong: three small pictures do not need a slab of chrome across the room, and
// stacking a third panel there pushed the HUD down over the wall art. The home
// screen is a ROOM — the more of it a HUD covers, the less it's a room.
//
// So it's an object in the room instead: a food bowl beside Eren, mirroring the
// heart on his other side, with the count on it. Tap it and the three foods
// come up. Nothing is covered until you ask.
//
// The card opens UPWARD from the bowl because the bowl sits low next to him;
// opening down would run it off the bottom of the room.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import type { FoodKey } from '@/types'
import { FOOD_META, foodArt } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import { IconBowl, IconCoin } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

/** Foods with real plate art in public/food; the rest draw as pixel icons. */
const hasPlate = (id: string) => id === 'donut' || id.startsWith('donut_')

interface Props {
  menu: FoodKey[]
  /** Parallel to `menu` — true where that food has been fed today. */
  progress: boolean[]
  complete: boolean
  reward: number
}

export default function TodaysMenu({ menu, progress, complete, reward }: Props) {
  const [open, setOpen] = useState(false)
  const fedCount = progress.filter(Boolean).length

  // Any tap elsewhere closes it. Registered only while open so the home screen
  // isn't carrying a document listener for a card nobody has opened.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    // Deferred a tick: the tap that OPENED the card would otherwise be the
    // same one that closes it.
    const t = setTimeout(() => document.addEventListener('pointerdown', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', close) }
  }, [open])

  if (menu.length === 0) return null

  return (
    <div className="absolute" style={{ bottom: '22%', right: '23%', zIndex: 3 }}
      onPointerDown={e => e.stopPropagation()}>

      {/* ── The card ── only while asked for ── */}
      {open && (
        <div className="absolute"
          style={{
            bottom: 46, left: '50%', transform: 'translateX(-50%)',
            width: 168, padding: '8px 8px 7px',
            background: 'linear-gradient(180deg, #2E1409 0%, #1A0B06 100%)',
            border: `2px solid ${complete ? '#22C55E' : '#B45309'}`,
            borderRadius: 7,
            boxShadow: `3px 3px 0 rgba(0,0,0,0.45), 0 0 14px ${complete ? 'rgba(34,197,94,0.35)' : 'rgba(180,83,9,0.3)'}`,
            animation: 'tmPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
          <p className="font-pixel text-center mb-1.5"
            style={{ fontSize: 6, color: complete ? '#BBF7D0' : '#FDE68A', letterSpacing: 1 }}>
            {complete ? 'MENU DONE' : 'TODAY HE WANTS'}
          </p>

          <div className="flex items-start justify-center gap-1.5">
            {menu.map((key, i) => {
              const fed = progress[i]
              const name = FOOD_META[key]?.name ?? key
              return (
                <div key={key} className="flex flex-col items-center" style={{ width: 46 }}>
                  <div className="relative flex items-center justify-center"
                    style={{
                      width: 34, height: 34, borderRadius: 5,
                      background: fed ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${fed ? '#22C55E' : 'rgba(251,191,36,0.35)'}`,
                      opacity: fed ? 0.5 : 1,
                    }}>
                    {hasPlate(key)
                      ? <img src={foodArt(key)} alt="" width={27} height={27} draggable={false}
                          style={{ width: 27, height: 27, objectFit: 'contain', display: 'block' }} />
                      : <FoodIcon id={key} size={25} />}
                    {fed && (
                      <span className="absolute font-pixel" style={{
                        top: -5, right: -5, width: 12, height: 12, lineHeight: '12px',
                        fontSize: 6, textAlign: 'center', color: '#052E16',
                        background: '#22C55E', border: '1px solid #14532D', borderRadius: 2,
                      }}>✓</span>
                    )}
                  </div>
                  {/* The name matters here in a way it didn't in the strip: you
                      opened this to find out what to go and buy. */}
                  <span className="text-center mt-1" style={{
                    fontSize: 8, lineHeight: 1.15,
                    color: fed ? '#7BA98B' : '#E7C39A',
                    textDecoration: fed ? 'line-through' : 'none',
                  }}>
                    {name}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="font-pixel text-center mt-1.5 inline-flex items-center justify-center gap-1 w-full"
            style={{ fontSize: 5.5, color: complete ? '#86EFAC' : '#C89A6B', letterSpacing: 0.8 }}>
            {complete
              ? <>PAID +{reward}<IconCoin size={7} /></>
              : <>ALL THREE = +{reward}<IconCoin size={7} /></>}
          </p>

          {/* Tail pointing down at the bowl. */}
          <div className="absolute" style={{
            bottom: -7, left: '50%', marginLeft: -5,
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: `6px solid ${complete ? '#22C55E' : '#B45309'}`,
          }} />
        </div>
      )}

      {/* ── The bowl ── same obsidian treatment as the heart on his other side */}
      <button
        onClick={() => { playSound(open ? 'ui_modal_close' : 'ui_modal_open'); setOpen(o => !o) }}
        aria-label={complete ? "Today's menu — all fed" : `Today's menu — ${fedCount} of ${menu.length} fed`}
        aria-expanded={open}
        className="relative flex items-center justify-center active:scale-90 transition-transform"
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 28%, #2a1c14 0%, #0a0a0c 60%, #000 100%)',
          border: `1.5px solid ${complete ? 'rgba(34,197,94,0.55)' : 'rgba(245,158,11,0.5)'}`,
          boxShadow: complete
            ? '0 0 12px rgba(34,197,94,0.4), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 0 12px rgba(245,158,11,0.35), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}>
        <IconBowl size={19} />
        {/* Progress badge — the count IS the nag, so the bowl never has to
            animate for attention the way the send-heart does. */}
        <span className="absolute font-pixel flex items-center justify-center"
          style={{
            top: -3, right: -3, minWidth: 17, height: 13, padding: '0 2px',
            fontSize: 5, letterSpacing: 0.3,
            color: complete ? '#052E16' : '#3A1B02',
            background: complete ? '#22C55E' : '#FBBF24',
            border: '2px solid #050507', borderRadius: 5,
          }}>
          {complete ? '✓' : `${fedCount}/${menu.length}`}
        </span>
      </button>

      <style jsx>{`
        @keyframes tmPop {
          from { transform: translateX(-50%) scale(0.85); opacity: 0; }
          to   { transform: translateX(-50%) scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
