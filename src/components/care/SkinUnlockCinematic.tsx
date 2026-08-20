'use client'

// ═══════════════════════════════════════════════════════════════════════════
// SKIN UNLOCK CINEMATIC — the payoff for pouring a SPECIAL EDITION can.
//
// Plays once, the first time Eren finishes a Rainbow or Gold Monsta. Three acts,
// driven by one small state machine rather than by CSS chaining, because each
// act swaps what's on screen (not just how it moves):
//
//   CHARGE  the room dims, the can's colour pours UP the screen as a light
//           column, and eight motes fall inward — the drink taking hold.
//   FLASH   one hard white frame. The transformation is never SHOWN; it's the
//           oldest trick there is and it's the one that reads at 60fps.
//   REVEAL  Eren, already wearing it, punched up on a rotating ray fan with a
//           burst, a name plate, and the two buttons.
//
// Motion budget follows the rule the gacha cinematics wrote down the hard way:
// everything animates on transform/opacity, the only blurred elements are two
// full-size gradients (not per-particle filters), and prefers-reduced-motion
// drops straight to the REVEAL frame with the acts skipped entirely.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import BlinkingEren from '@/components/BlinkingEren'
import CanFeedBurst from './CanFeedBurst'
import type { CanVariant } from './CanAura'
import { IconSparkles, IconDress } from '@/components/PixelIcons'
import { RARITY_COLORS } from '@/lib/gacha'
import type { SkinDef } from '@/lib/skins'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type Act = 'charge' | 'flash' | 'reveal'

const CHARGE_MS = 950
const FLASH_MS = 260
/** Buttons hold back until the reveal has landed, so the pose reads first. */
const BUTTONS_MS = 780

// Per-variant colour language. `column` is the light that pours up in CHARGE,
// `key` the dominant tint on the reveal furniture, `rays` the fan behind him.
const LOOK: Record<CanVariant, { key: string; deep: string; column: string; rays: string; motes: string[] }> = {
  rainbow: {
    key: '#C77DFF',
    deep: '#3B0764',
    column: 'linear-gradient(0deg, rgba(255,77,109,0.85) 0%, rgba(255,226,61,0.7) 30%, rgba(75,224,122,0.6) 55%, rgba(53,199,245,0.55) 78%, rgba(166,92,246,0) 100%)',
    rays: 'repeating-conic-gradient(from 0deg, rgba(255,77,109,0.30) 0deg 9deg, transparent 9deg 22deg, rgba(53,199,245,0.30) 22deg 31deg, transparent 31deg 45deg)',
    motes: ['#FF4D6D', '#FFE23D', '#4BE07A', '#35C7F5', '#A65CF6'],
  },
  gold: {
    key: '#F5C842',
    deep: '#4A2E05',
    column: 'linear-gradient(0deg, rgba(245,200,66,0.9) 0%, rgba(255,232,120,0.7) 40%, rgba(255,246,210,0.45) 72%, rgba(245,200,66,0) 100%)',
    rays: 'repeating-conic-gradient(from 0deg, rgba(255,232,120,0.34) 0deg 9deg, transparent 9deg 22deg, rgba(245,200,66,0.24) 22deg 31deg, transparent 31deg 45deg)',
    motes: ['#FFF6D2', '#F5C842', '#FFE878', '#D4A818'],
  },
}

/** Eight motes that fall INTO him during CHARGE. x is % of width, d the beat. */
const FALLING = [
  { x: 18, d: 0.00 }, { x: 34, d: 0.22 }, { x: 46, d: 0.44 }, { x: 58, d: 0.11 },
  { x: 70, d: 0.33 }, { x: 84, d: 0.55 }, { x: 26, d: 0.50 }, { x: 64, d: 0.66 },
]

interface Props {
  skin: SkinDef
  variant: CanVariant
  /** Name of the can that did it — printed on the "how you got this" line. */
  drinkName: string
  /** WEAR IT — dress every room in the new look, then close. */
  onWear: () => void
  onClose: () => void
}

export default function SkinUnlockCinematic({ skin, variant, drinkName, onWear, onClose }: Props) {
  const reduced = useReducedMotion()
  const look = LOOK[variant]
  const rarity = RARITY_COLORS[skin.rarity]

  const [act, setAct] = useState<Act>(reduced ? 'reveal' : 'charge')
  const [showButtons, setShowButtons] = useState(reduced)
  const busyRef = useRef(false)

  // One chained schedule for the whole thing. Reduced motion never starts it —
  // that branch mounts already at REVEAL with the buttons live.
  useEffect(() => {
    if (reduced) { playSound('level_up'); return }
    const timers = [
      setTimeout(() => setAct('flash'), CHARGE_MS),
      setTimeout(() => { setAct('reveal'); playSound('level_up') }, CHARGE_MS + FLASH_MS),
      setTimeout(() => setShowButtons(true), CHARGE_MS + FLASH_MS + BUTTONS_MS),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reduced])

  // Guard the two exits: the buttons only appear once, but a double-tap on a
  // slow device must not fire two room_skins writes.
  const once = (fn: () => void) => () => {
    if (busyRef.current) return
    busyRef.current = true
    fn()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden"
      role="dialog" aria-modal="true" aria-label={`New look unlocked: ${skin.name}`}
      style={{
        zIndex: 90,
      }}>

      {/* Backdrop. Held half-transparent through CHARGE so the kitchen — and
          Eren, still sitting where he drank — reads underneath: the light is
          coming off HIM, not off a black screen. Closes for the reveal. */}
      <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(120% 80% at 50% 62%, ${look.deep} 0%, #0B0717 62%, #05030C 100%)`,
        opacity: act === 'charge' ? 0.55 : 1,
        transition: `opacity ${FLASH_MS}ms ease-in`,
      }} />

      {/* CRT scanlines — the dark game-panel convention, on the backdrop only. */}
      <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0px, rgba(0,0,0,0.20) 1px, transparent 1px, transparent 3px)',
      }} />

      {/* ══ ACT 1 — the drink taking hold ══ */}
      {act === 'charge' && (
        <>
          <span aria-hidden className="unlock-column" style={{
            position: 'absolute', left: '50%', bottom: 0, width: 210, height: '80%',
            marginLeft: -105, background: look.column,
            // Feathered on BOTH axes by one radial mask rather than a blur —
            // a hard-edged rectangle reads as a bar, and blurring an element
            // this large re-rasterizes every frame (the janky path the gacha
            // cinematics documented).
            maskImage: 'radial-gradient(58% 100% at 50% 100%, #000 0%, rgba(0,0,0,0.8) 46%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(58% 100% at 50% 100%, #000 0%, rgba(0,0,0,0.8) 46%, transparent 100%)',
          }} />
          {FALLING.map((m, i) => (
            <span key={i} aria-hidden className="unlock-fall" style={{
              position: 'absolute', left: `${m.x}%`, top: '-6%', width: 7, height: 7,
              background: look.motes[i % look.motes.length],
              clipPath: 'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)',
              animationDelay: `${m.d}s`,
            }} />
          ))}
        </>
      )}

      {/* ══ ACT 2 — the cut ══ */}
      {act === 'flash' && (
        <span aria-hidden className="unlock-flash absolute inset-0" style={{ background: '#FFFDF5' }} />
      )}

      {/* ══ ACT 3 — him, wearing it ══ */}
      {act === 'reveal' && (
        <div className="relative flex flex-col items-center px-6" style={{ width: '100%', maxWidth: 380 }}>

          {/* Ray fan — one rotating element, never per-ray nodes. 620px of it
              sits OVER the buttons, so it must not eat their taps. */}
          <span aria-hidden className="unlock-rays pointer-events-none" style={{
            position: 'absolute', top: '30%', left: '50%', width: 620, height: 620,
            marginLeft: -310, marginTop: -310, background: look.rays,
            maskImage: 'radial-gradient(closest-side, #000 22%, transparent 74%)',
            WebkitMaskImage: 'radial-gradient(closest-side, #000 22%, transparent 74%)',
          }} />

          {/* Banner */}
          <div className="unlock-pop-a relative flex items-center gap-2 px-3 py-1.5 mb-1" style={{
            background: 'linear-gradient(180deg, rgba(43,27,74,0.95), rgba(22,14,46,0.95))',
            border: `2px solid ${look.key}`, borderRadius: 8,
            boxShadow: `0 0 16px ${look.key}66, 0 2px 0 rgba(0,0,0,0.45)`,
          }}>
            <span className="sparkle-hue" aria-hidden><IconSparkles size={12} /></span>
            <span className="font-pixel" style={{ fontSize: 8, color: '#fff', letterSpacing: 1.2 }}>NEW LOOK UNLOCKED</span>
          </div>

          {/* Him */}
          <div className="unlock-pop-b relative flex items-end justify-center pointer-events-none" style={{ height: 208 }}>
            <span aria-hidden style={{
              position: 'absolute', bottom: 6, width: 150, height: 18, borderRadius: '50%',
              background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.5), rgba(0,0,0,0))',
            }} />
            <BlinkingEren size={200} src={skin.src} tailSrc={skin.tailSrc}
              tailOrigin={skin.tailOrigin} eyes={skin.eyes} lidTone={skin.lidTone} coat={skin.coat} />
            {!reduced && <CanFeedBurst variant={variant} left="50%" bottom="46%" />}
          </div>

          {/* Name plate */}
          <div className="unlock-pop-c relative flex flex-col items-center gap-1.5 px-5 py-3 mt-1" style={{
            background: 'linear-gradient(180deg, rgba(35,22,66,0.94), rgba(11,7,23,0.94))',
            border: `2px solid ${rarity.border}`, borderRadius: 12,
            boxShadow: `0 0 20px ${rarity.glow}, 0 3px 0 rgba(0,0,0,0.5)`,
          }}>
            {/* gold rivets — premium card convention */}
            {([['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']] as const).map(([v, h], i) => (
              <span key={i} aria-hidden className="absolute" style={{
                width: 4, height: 4, background: '#F5C842', boxShadow: '0 0 3px rgba(245,200,66,0.9)',
                top: v === 't' ? 6 : undefined, bottom: v === 'b' ? 6 : undefined,
                left: h === 'l' ? 6 : undefined, right: h === 'r' ? 6 : undefined,
              }} />
            ))}
            <span className="font-pixel px-2 py-1" style={{
              fontSize: 6, letterSpacing: 1.5, color: rarity.text, background: rarity.bg,
              border: `1.5px solid ${rarity.border}`, borderRadius: 4,
            }}>{skin.rarity.toUpperCase()}</span>
            <p className="font-pixel text-center" style={{ fontSize: 11, color: '#fff', letterSpacing: 0.5 }}>
              {skin.name.toUpperCase()}
            </p>
            <p className="text-center" style={{ fontSize: 10, lineHeight: 1.6, color: '#B9A6DE' }}>
              He finished the {drinkName} and kept the colours.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col items-stretch gap-2 mt-4 w-full" style={{
            maxWidth: 260,
            opacity: showButtons ? 1 : 0,
            transform: showButtons ? 'none' : 'translateY(6px)',
            transition: 'opacity 260ms ease-out, transform 260ms ease-out',
            pointerEvents: showButtons ? 'auto' : 'none',
          }}>
            <button onClick={once(() => { playSound('ui_select'); onWear() })}
              className="flex items-center justify-center gap-2 py-3 active:translate-y-[1px] transition-transform"
              style={{
                borderRadius: 10, background: 'linear-gradient(180deg, #8B5CF6, #6D28D9)',
                border: '2px solid #A78BFA', boxShadow: '0 3px 0 #4C1D95, 0 0 16px rgba(139,92,246,0.5)',
              }}>
              <IconDress size={14} />
              <span className="font-pixel" style={{ fontSize: 8, color: '#fff', letterSpacing: 0.6 }}>WEAR IT EVERYWHERE</span>
            </button>
            <button onClick={once(() => { playSound('ui_modal_close'); onClose() })}
              className="py-2.5 active:translate-y-[1px] transition-transform"
              style={{ borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(167,139,250,0.28)' }}>
              <span className="font-pixel" style={{ fontSize: 8, color: '#9D8BC4', letterSpacing: 0.6 }}>KEEP IT IN THE CLOSET</span>
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .unlock-column {
          transform-origin: bottom center;
          animation: unlockColumn ${CHARGE_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }
        @keyframes unlockColumn {
          0%   { opacity: 0;    transform: scaleY(0.05) scaleX(0.5); }
          30%  { opacity: 0.95; transform: scaleY(1)    scaleX(1); }
          75%  { opacity: 0.8;  transform: scaleY(1)    scaleX(0.72); }
          100% { opacity: 1;    transform: scaleY(1.05) scaleX(0.3); }
        }
        .unlock-fall {
          opacity: 0;
          animation: unlockFall 620ms cubic-bezier(0.5, 0, 0.75, 0) forwards;
          will-change: transform, opacity;
        }
        @keyframes unlockFall {
          0%   { opacity: 0; transform: translateY(0)     scale(1)   rotate(0deg); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(64vh)  scale(0.3) rotate(220deg); }
        }
        .unlock-flash {
          animation: unlockFlash ${FLASH_MS}ms steps(4, end) forwards;
        }
        @keyframes unlockFlash {
          0%   { opacity: 0.2; }
          25%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .unlock-rays {
          opacity: 0;
          animation: unlockRaysIn 700ms ease-out forwards, unlockRaysSpin 22s linear infinite;
          will-change: transform, opacity;
        }
        @keyframes unlockRaysIn  { to { opacity: 1; } }
        @keyframes unlockRaysSpin { to { transform: rotate(360deg); } }
        .unlock-pop-a, .unlock-pop-b, .unlock-pop-c {
          opacity: 0;
          animation: unlockPop 460ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }
        .unlock-pop-b { animation-delay: 90ms; }
        .unlock-pop-c { animation-delay: 230ms; }
        @keyframes unlockPop {
          0%   { opacity: 0; transform: scale(0.72) translateY(14px); }
          62%  { opacity: 1; transform: scale(1.06) translateY(0); }
          100% { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .unlock-rays  { animation: none; opacity: 1; }
          .unlock-pop-a, .unlock-pop-b, .unlock-pop-c { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
