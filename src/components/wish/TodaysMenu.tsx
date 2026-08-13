'use client'

// ═══════════════════════════════════════════════════════════════════════════
// TODAY'S MENU — the three foods Eren wants today, as three pictures.
// ──────────────────────────────────────────────────────────────────────────
// Sits alongside the daily wish rather than replacing it. The wish is one line
// he says once; this is a standing order you can see all day without asking,
// which is why it's a strip in the HUD and not another speech bubble.
//
// Pictures, not names: at HUD size a food is recognised faster than it's read,
// and three plates in a row says "shopping list" without a word of copy.
// ═══════════════════════════════════════════════════════════════════════════

import type { FoodKey } from '@/types'
import { FOOD_META, foodArt } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import { IconCoin } from '@/components/PixelIcons'

/** Foods with real plate art in public/food; the rest fall back to FoodIcon. */
const hasPlate = (id: string) => id === 'donut' || id.startsWith('donut_')

interface Props {
  menu: FoodKey[]
  /** Parallel to `menu` — true where that food has been fed today. */
  progress: boolean[]
  complete: boolean
  reward: number
}

export default function TodaysMenu({ menu, progress, complete, reward }: Props) {
  if (menu.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-2 py-1.5"
      style={{
        background: complete
          ? 'linear-gradient(135deg, rgba(20,83,45,0.88), rgba(6,46,25,0.9))'
          : 'linear-gradient(135deg, rgba(46,20,10,0.85), rgba(26,11,6,0.9))',
        border: `2px solid ${complete ? '#22C55E' : '#B45309'}`,
        borderRadius: 6,
        boxShadow: `2px 2px 0 rgba(0,0,0,0.35), 0 0 10px ${complete ? 'rgba(34,197,94,0.3)' : 'rgba(180,83,9,0.25)'}`,
      }}>

      <div className="flex flex-col flex-shrink-0" style={{ lineHeight: 1.5 }}>
        <span className="font-pixel" style={{ fontSize: 6, color: complete ? '#BBF7D0' : '#FDE68A', letterSpacing: 1 }}>
          {complete ? 'MENU DONE' : 'HE WANTS'}
        </span>
        <span className="font-pixel inline-flex items-center gap-0.5"
          style={{ fontSize: 5, color: complete ? '#86EFAC' : '#C89A6B', letterSpacing: 0.5 }}>
          {complete ? <>+{reward}<IconCoin size={7} /></> : <>{progress.filter(Boolean).length}/{menu.length} FED</>}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 justify-end">
        {menu.map((key, i) => {
          const fed = progress[i]
          const meta = FOOD_META[key]
          return (
            <div key={key} className="relative flex items-center justify-center flex-shrink-0"
              title={meta?.name ?? key}
              style={{
                width: 30, height: 30, borderRadius: 4,
                background: fed ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${fed ? '#22C55E' : 'rgba(251,191,36,0.35)'}`,
                // Fed items dim rather than vanish: the list has to stay
                // readable as a list once you've started working through it.
                opacity: fed ? 0.55 : 1,
              }}>
              {hasPlate(key)
                ? <img src={foodArt(key)} alt={meta?.name ?? key} width={24} height={24} draggable={false}
                    style={{ width: 24, height: 24, objectFit: 'contain', display: 'block' }} />
                : <FoodIcon id={key} size={22} />}
              {fed && (
                <span className="absolute font-pixel" style={{
                  top: -4, right: -4, width: 11, height: 11, lineHeight: '11px',
                  fontSize: 6, textAlign: 'center', color: '#052E16',
                  background: '#22C55E', border: '1px solid #14532D', borderRadius: 2,
                }}>✓</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
