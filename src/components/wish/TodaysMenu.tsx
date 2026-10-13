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
//
// In the Meadow look: a white circle over the room art (the heart on his
// other side matches), and a white card with the three plates on soft tiles,
// a leaf tick on each one he has eaten.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import type { FoodKey } from '@/types'
import { FOOD_META, foodArt } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import { CheckDisc, M, MeadowIcon, RoundButton, TINT, TYPE, FONT_ROUNDED } from '@/components/meadow'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'

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
  const cat = useCat()
  const rootRef = useRef<HTMLDivElement>(null)
  const fedCount = progress.filter(Boolean).length

  // Any tap ELSEWHERE closes it. Registered only while open so the home screen
  // isn't carrying a document listener for a card nobody has opened.
  //
  // The inside/outside test has to be `contains`, not the wrapper's
  // stopPropagation. The App Router hydrates <html>, so React's own delegated
  // listeners sit on `document` — the same node as this one — and
  // stopPropagation() never stops a listener on the same node (only
  // stopImmediatePropagation does, and only for listeners registered later).
  // So a tap on the bowl ran this handler anyway: pointerdown closed the card
  // and the click that followed toggled it straight back open, which looked
  // exactly like the card refusing to shut.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  if (menu.length === 0) return null

  return (
    // Closed, the bowl is furniture and sits with the room's other props (3,
    // same as Eren's speech bubble). Open, it has to clear everything that
    // drifts around him uninvited: the daily wish and the partner's thought
    // cloud (both 4), the care-battle HUD (8), and Eren's whisper (45). One of
    // those WILL end up parked over this card — a thing that appears on its own
    // must never cover a thing the player deliberately opened.
    //
    // 50 is the gap between that ambient tier and the committed-modal tier:
    // ThoughtCloud's expanded composer sits at 55-61 and the app's popups at
    // 70+, and this must stay under both. Everything named here lives inside
    // the room's `fixed inset-0; z-index: 0` wrapper, so these all resolve
    // against each other in that one stacking context.
    // The stopPropagation still earns its place: it keeps the tap off the
    // room's own React handlers underneath. It just can't police `document`.
    <div ref={rootRef} className="absolute meadow-root" style={{ bottom: '22%', right: '23%', zIndex: open ? 50 : 3 }}
      onPointerDown={e => e.stopPropagation()}>

      {/* ── The card ── only while asked for ── */}
      {open && (
        <div role="group" aria-label={cat.t("Today's menu")}
          style={{
            position: 'absolute', bottom: 52, left: '50%',
            width: 184, boxSizing: 'border-box', padding: '10px 8px',
            borderRadius: 20, background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}`,
            fontFamily: FONT_ROUNDED, color: M.text,
            animation: 'tmPop 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
          <p style={{ margin: '0 0 8px', textAlign: 'center', ...TYPE.label, fontSize: 11, color: complete ? M.leafInk : M.label }}>
            {complete ? 'Menu done' : cat.t('Today {he} wants')}
          </p>

          <div className="flex items-start justify-center" style={{ gap: 4 }}>
            {menu.map((key, i) => {
              const fed = progress[i]
              const name = FOOD_META[key]?.name ?? key
              return (
                <div key={key} className="flex flex-col items-center" style={{ width: 52 }}>
                  <div style={{
                    position: 'relative', width: 46, height: 46, borderRadius: 14,
                    background: fed ? TINT.leaf : M.soft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ opacity: fed ? 0.45 : 1, lineHeight: 0 }}>
                      {hasPlate(key)
                        ? <img src={foodArt(key)} alt="" width={32} height={32} draggable={false}
                            style={{ width: 32, height: 32, objectFit: 'contain', display: 'block' }} />
                        : <FoodIcon id={key} size={30} />}
                    </span>
                    {fed && <CheckDisc size={20} corner style={{ position: 'absolute', top: -6, right: -6 }} />}
                  </div>
                  {/* The name matters: you opened this to find out what to go
                      and buy. */}
                  <span style={{
                    marginTop: 4, textAlign: 'center', fontSize: 11, lineHeight: 1.2, fontWeight: 700,
                    color: fed ? M.faint : M.text2, overflowWrap: 'anywhere',
                  }}>
                    {name}
                    {fed && <span className="sr-only">, fed</span>}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="flex items-center justify-center" style={{
            margin: '8px 0 0', gap: 4, fontSize: 13, fontWeight: 700,
            color: complete ? M.leafInk : M.text2,
          }}>
            {complete ? 'Paid' : 'All three'}
            <MeadowIcon name="coin" size={16} />
            <span style={{ ...TYPE.number, color: M.text }}>+{reward}</span>
          </p>

          {/* Tail pointing down at the bowl. */}
          <span aria-hidden style={{
            position: 'absolute', bottom: -5, left: 'calc(50% - 6px)', width: 12, height: 12,
            background: '#FFFFFF', transform: 'rotate(45deg)',
          }} />
        </div>
      )}

      {/* ── The bowl ── a white circle like the heart on his other side */}
      <RoundButton
        surface="art"
        size={40}
        onClick={() => { playSound(open ? 'ui_modal_close' : 'ui_modal_open'); setOpen(o => !o) }}
        ariaLabel={complete ? "Today's menu, all fed" : `Today's menu, ${fedCount} of ${menu.length} fed`}
        expanded={open}
        style={{ position: 'relative' }}
      >
        <MeadowIcon name="bowl" size={22} />
        {/* Progress badge — the count IS the nag, so the bowl never has to
            animate for attention the way the send-heart does. */}
        <span aria-hidden style={{
          position: 'absolute', top: -7, right: -11,
          minWidth: 20, height: 20, boxSizing: 'border-box', padding: '0 5px',
          borderRadius: 999, border: '2px solid #FFFFFF',
          background: complete ? M.leaf : M.coin, color: complete ? '#FFFFFF' : M.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, lineHeight: 1, whiteSpace: 'nowrap', ...TYPE.number,
        }}>
          {complete ? <MeadowIcon name="check" size={12} color="#FFFFFF" mono /> : `${fedCount}/${menu.length}`}
        </span>
      </RoundButton>

      {/* A plain <style>: the pop is named from an inline style, which only
          reaches global keyframes (it sat in a scoped styled-jsx block and
          never ran). */}
      <style>{`
        @keyframes tmPop {
          from { transform: translateX(-50%) scale(0.85); opacity: 0; }
          to   { transform: translateX(-50%) scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
