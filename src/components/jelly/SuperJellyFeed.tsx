'use client'

// ─── SuperJellyFeed ─────────────────────────────────────────────────────────
// Feeding Eren the day's Super Jelly.
//
// This is the beat the whole daily loop points at, so it is a scene rather than
// a toast: the jelly is served, he eats it, and only then do the numbers show
// up. Three acts on one chained schedule —
//
//   SERVE  the jelly drops onto the plate in front of him and settles.
//   EAT    he leans in (the kitchen's own eat poses), the jelly is taken down
//          in three bites, crumbs fly.
//   DONE   what it did, and how many spoons remain before the coat.
//
// The RPC has already run by the time this mounts: `fed`/`goal` are the values
// it returned. That ordering matters — the animation must never be what decides
// whether the feed counted, or a closed tab mid-scene eats the jelly for free.
//
// prefers-reduced-motion mounts straight at DONE with the same information.

import { useEffect, useMemo, useState } from 'react'
import BlinkingEren from '@/components/BlinkingEren'
import SuperJelly from './SuperJelly'
import { IconSparkles, IconCrown } from '@/components/PixelIcons'
import { SUPER_JELLY_BUFF } from '@/lib/jellies'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type Act = 'serve' | 'eat' | 'done'

const SERVE_MS = 720
const EAT_MS = 1240
/** The kitchen's own head-down poses, cycled so he visibly works at it. */
const EAT_POSES = ['/erenEat1.png', '/erenEat3.png', '/erenEat2.png', '/erenEat4.png']

const INK = '#3A1F2B'
const CREAM = '#FFF8EE'

interface Props {
  /** Feeds completed INCLUDING this one, straight from the RPC. */
  fed: number
  goal: number
  /** Super Jellies still in hand afterwards. */
  supersLeft: number
  onClose: () => void
}

export default function SuperJellyFeed({ fed, goal, supersLeft, onClose }: Props) {
  const reduced = useReducedMotion()
  const [act, setAct] = useState<Act>(reduced ? 'done' : 'serve')
  const [bite, setBite] = useState(0)

  useEffect(() => {
    if (reduced) return
    const t = [
      window.setTimeout(() => { setAct('eat'); playSound('jl_bounce') }, SERVE_MS),
      window.setTimeout(() => { setBite(1); playSound('jl_slice') }, SERVE_MS + 260),
      window.setTimeout(() => { setBite(2); playSound('jl_slice') }, SERVE_MS + 640),
      window.setTimeout(() => { setBite(3); playSound('jl_combo') }, SERVE_MS + 1000),
      window.setTimeout(() => { setAct('done'); playSound('level_up') }, SERVE_MS + EAT_MS),
    ]
    return () => t.forEach(window.clearTimeout)
  }, [reduced])

  // Stat chips, derived from the buff so the copy can never drift from what
  // feedWithFood actually applied.
  const chips = useMemo(() => {
    const b = SUPER_JELLY_BUFF
    const out: string[] = []
    if (b.hunger) out.push(`HUNGER +${b.hunger}`)
    if (b.happiness) out.push(`JOY +${b.happiness}`)
    if (b.energy) out.push('ENERGY FULL')
    if (b.sleep_quality) out.push(`SLEEP +${b.sleep_quality}`)
    if (b.cleanliness) out.push(`CLEAN +${b.cleanliness}`)
    if (b.cure) out.push('CURED')
    if (b.coins) out.push(`+${b.coins} COINS`)
    return out
  }, [])

  const eating = act === 'eat'
  const left = Math.max(0, goal - fed)

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-end" role="dialog" aria-modal="true"
      style={{
        zIndex: 90,
        background: 'radial-gradient(90% 60% at 50% 62%, rgba(94,38,58,0.72) 0%, rgba(30,12,20,0.9) 100%)',
      }}>

      {/* ── The scene ── he stands on a lit patch of parlour floor. */}
      <div className="relative w-full flex items-end justify-center" style={{ height: '52%', maxWidth: 440 }}>
        <span aria-hidden style={{
          position: 'absolute', bottom: 46, width: 210, height: 26, borderRadius: '50%',
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,214,150,0.32), rgba(255,214,150,0))',
        }} />

        {/* Eren. The head-down eat poses replace the sticker for the middle act;
            outside it he's the everyday cat, tail and all. */}
        <div style={{ position: 'absolute', bottom: 34 }}>
          {eating ? (
            <img src={EAT_POSES[bite % EAT_POSES.length]} alt="" draggable={false} style={{
              width: 190, height: 190, objectFit: 'contain', imageRendering: 'auto',
            }} />
          ) : (
            <BlinkingEren size={190} src="/erenGood_notail.png" tailSrc="/erenGood_tail.png" />
          )}
        </div>

        {/* The jelly on the floor in front of him, taken down in three bites. */}
        {bite < 3 && (
          <div style={{
            position: 'absolute', bottom: 28, left: '50%',
            transform: `translateX(-50%) scale(${1 - bite * 0.3})`,
            transformOrigin: 'bottom center',
            transition: reduced ? undefined : 'transform 180ms cubic-bezier(0.16,1,0.3,1)',
            animation: act === 'serve' && !reduced ? 'superJellyServe 720ms cubic-bezier(0.34,1.56,0.64,1) both' : undefined,
          }}>
            <SuperJelly size={104} wobble={!reduced} />
          </div>
        )}

        {/* Crumbs — only while he's actually eating. */}
        {eating && !reduced && [0, 1, 2, 3, 4, 5].map(i => (
          <span key={i} aria-hidden style={{
            position: 'absolute', bottom: 46, left: `calc(50% + ${(i - 2.5) * 15}px)`,
            width: 7, height: 7, borderRadius: '50%',
            background: ['#D73832', '#94D219', '#985EBA', '#EBD63F', '#F86618', '#FF7FA6'][i],
            animation: `superJellyCrumb ${520 + i * 40}ms ease-out ${i * 70}ms infinite`,
          }} />
        ))}
      </div>

      {/* ── The card ── */}
      <div className="w-full px-5" style={{ maxWidth: 380, paddingBottom: 'calc(var(--safe-bottom) + 18px)' }}>
        <div className="relative flex flex-col items-center px-4 pt-4 pb-4" style={{
          borderRadius: 16, background: `linear-gradient(180deg, ${CREAM} 0%, #FFE9F0 100%)`,
          border: `3px solid ${INK}`, boxShadow: `0 6px 0 ${INK}, 0 18px 40px rgba(0,0,0,0.45)`,
          opacity: act === 'done' ? 1 : 0,
          transform: act === 'done' ? 'translateY(0)' : 'translateY(14px)',
          transition: reduced ? undefined : 'opacity 260ms ease-out, transform 260ms cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: act === 'done' ? 'auto' : 'none',
        }}>
          {/* Gold rivets — the app's "this one matters" tell. */}
          {[[6, 6], [6, 0], [0, 6], [0, 0]].map(([l, t], i) => (
            <span key={i} aria-hidden style={{
              position: 'absolute', width: 3, height: 3, background: '#F5C842',
              left: l ? 6 : undefined, right: l ? undefined : 6,
              top: t ? 6 : undefined, bottom: t ? undefined : 6,
            }} />
          ))}

          <div className="flex items-center gap-1.5 mb-1.5">
            <IconSparkles size={12} />
            <span className="font-pixel" style={{ fontSize: 9, color: INK, letterSpacing: 0.5 }}>SUPER JELLY EATEN</span>
            <IconSparkles size={12} />
          </div>

          <div className="flex flex-wrap justify-center gap-1 mb-3">
            {chips.map(c => (
              <span key={c} className="font-pixel px-1.5 py-1" style={{
                fontSize: 6, color: CREAM, background: '#B3436A', borderRadius: 5,
              }}>{c}</span>
            ))}
          </div>

          {/* ── The road to the coat ── five spoons, one per feed. */}
          <div className="w-full flex items-center gap-2 px-1 py-2 mb-3" style={{
            background: 'rgba(58,31,43,0.06)', borderRadius: 10,
          }}>
            <IconCrown size={14} />
            <div className="flex-1 flex gap-1.5">
              {Array.from({ length: goal }).map((_, i) => (
                <span key={i} style={{
                  flex: 1, height: 9, borderRadius: 3,
                  background: i < fed
                    ? 'linear-gradient(180deg, #FF9EC0, #E14C7C)'
                    : 'rgba(58,31,43,0.14)',
                  border: `2px solid ${i < fed ? INK : 'transparent'}`,
                  animation: !reduced && i === fed - 1 ? 'jellyComboPop 380ms cubic-bezier(0.16,1,0.3,1)' : undefined,
                }} />
              ))}
            </div>
            <span className="font-pixel" style={{ fontSize: 8, color: INK }}>{fed}/{goal}</span>
          </div>

          <p className="text-center mb-3" style={{ fontSize: 10.5, lineHeight: 1.5, color: '#6E4354' }}>
            {left === 0
              ? 'He has had his fill. The jelly coat is yours.'
              : left === 1
                ? 'One more Super Jelly and the coat is his.'
                : `${left} more Super Jellies and the coat is his.`}
            {supersLeft > 0 && <> You still have <strong style={{ color: INK }}>{supersLeft}</strong> in hand.</>}
          </p>

          <button onClick={() => { playSound('ui_select'); onClose() }}
            className="w-full py-3 active:translate-y-[1px] transition-transform"
            style={{
              borderRadius: 12, background: 'linear-gradient(180deg, #FF7FA6, #E14C7C)',
              border: `3px solid ${INK}`, boxShadow: `0 4px 0 ${INK}`,
            }}>
            <span className="font-pixel" style={{ fontSize: 9, color: CREAM }}>GOOD BOY</span>
          </button>
        </div>
      </div>
    </div>
  )
}
