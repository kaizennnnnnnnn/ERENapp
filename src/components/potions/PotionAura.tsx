'use client'

// ═══════════════════════════════════════════════════════════════════════════
// POTION AURA — what a Lab potion does to him, for an hour.
// ──────────────────────────────────────────────────────────────────────────
// Mounted in ErenIdleLayer beside the donut aura, so it shows in every room and
// on the home screen with no per-room plumbing. Two halves:
//
//   PotionBody     wraps the cat himself: shrink, grow, float, wobble, spin,
//                  go see-through, or shimmer through every colour.
//   PotionAround   what hangs around him: the wash in the batch's own colour,
//                  and the hearts / notes / bubbles / leaves / stars / flowers
//                  rising, falling or twinkling. Behind him or in front, by
//                  `layer`, so a bubble can drift across his face.
//
// Everything is placed in percent of his box, so it fits every room's size of
// him, and animated on transform / opacity only (it runs for an hour on top of
// a room that is already moving). Positions are fixed, not random: this
// re-renders for an hour and must not reshuffle. The keyframes live in
// globals.css ("Potions").
// ═══════════════════════════════════════════════════════════════════════════

import type { CSSProperties, ReactNode } from 'react'
import { MeadowIcon, type MeadowIconName } from '@/components/PixelIcons'
import { M } from '@/components/meadow/tokens'
import type { ActivePotion, PotionDef, PotionEffect } from '@/lib/potions'

type Live = ActivePotion & { def: PotionDef }

// ─── The cat ─────────────────────────────────────────────────────────────────

const BODY: Partial<Record<PotionEffect, { style?: CSSProperties; className?: string }>> = {
  tiny:    { style: { transform: 'scale(0.6)' } },
  big:     { style: { transform: 'scale(1.32)' } },
  ghost:   { style: { opacity: 0.38 } },
  float:   { className: 'potFloat' },
  cloud:   { className: 'potFloatHigh' },
  wobble:  { className: 'potWobble' },
  spin:    { className: 'potSpin' },
  rainbow: { className: 'potRainbow' },
}

export function PotionBody({ potion, children }: { potion: Live | null; children: ReactNode }) {
  const look = potion ? BODY[potion.def.effect] : undefined
  return (
    <div className={look?.className} style={{
      position: 'relative', transformOrigin: 'bottom center',
      transition: 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms steps(3)',
      ...look?.style,
    }}>
      {/* No glow traced round his outline: it made the colour thickest right
          at his edges, a halo that followed his silhouette instead of a light
          he stands in. The wash behind him (PotionAround) is the colour. */}
      {children}
      {/* Cloud Nine: he naps on it, so it rides along with him. */}
      {potion?.def.effect === 'cloud' && <Cloud />}
    </div>
  )
}

function Cloud() {
  return (
    // Its top edge at about his feet: the sprites end 10-17% above their box.
    <span aria-hidden style={{ position: 'absolute', left: '18%', right: '18%', bottom: '5%', height: '14%', pointerEvents: 'none' }}>
      {[
        { left: '0%', bottom: '0%', w: '46%', h: '70%' },
        { left: '30%', bottom: '20%', w: '42%', h: '90%' },
        { left: '58%', bottom: '0%', w: '42%', h: '72%' },
      ].map((b, i) => (
        <span key={i} style={{
          position: 'absolute', left: b.left, bottom: b.bottom, width: b.w, height: b.h,
          borderRadius: 999, background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}`,
        }} />
      ))}
    </span>
  )
}

// ─── What hangs around him ───────────────────────────────────────────────────

type Bit = { left: string; top: string; size: number; delay: string; dur?: string }

const RISING: Bit[] = [
  { left: '14%', top: '60%', size: 26, delay: '0s',   dur: '3.4s' },
  { left: '76%', top: '52%', size: 24, delay: '0.9s', dur: '3.0s' },
  { left: '30%', top: '42%', size: 20, delay: '1.7s', dur: '3.6s' },
  { left: '62%', top: '64%', size: 26, delay: '2.4s', dur: '3.2s' },
  { left: '86%', top: '34%', size: 20, delay: '1.2s', dur: '2.8s' },
  { left: '4%',  top: '40%', size: 22, delay: '2.0s', dur: '3.3s' },
  { left: '48%', top: '30%', size: 18, delay: '0.4s', dur: '3.1s' },
]
const TWINKLES: Bit[] = [
  { left: '10%', top: '30%', size: 24, delay: '0s' },
  { left: '84%', top: '20%', size: 22, delay: '0.6s' },
  { left: '28%', top: '8%',  size: 18, delay: '1.2s' },
  { left: '74%', top: '56%', size: 24, delay: '1.7s' },
  { left: '4%',  top: '58%', size: 18, delay: '2.2s' },
  { left: '90%', top: '42%', size: 20, delay: '0.9s' },
  { left: '52%', top: '2%',  size: 18, delay: '2.6s' },
  { left: '18%', top: '74%', size: 18, delay: '1.4s' },
]
const FALLING: Bit[] = [
  { left: '8%',  top: '0%', size: 24, delay: '0s',   dur: '3.6s' },
  { left: '30%', top: '0%', size: 20, delay: '1.1s', dur: '3.2s' },
  { left: '52%', top: '0%', size: 24, delay: '2.0s', dur: '3.8s' },
  { left: '74%', top: '0%', size: 20, delay: '0.6s', dur: '3.4s' },
  { left: '90%', top: '0%', size: 22, delay: '1.6s', dur: '3.5s' },
]
const FEET: Bit[] = [
  { left: '6%',  top: '74%', size: 30, delay: '0s' },
  { left: '22%', top: '82%', size: 26, delay: '0.5s' },
  { left: '64%', top: '82%', size: 28, delay: '1.0s' },
  { left: '80%', top: '74%', size: 26, delay: '1.5s' },
  { left: '42%', top: '86%', size: 22, delay: '2.0s' },
]

/** A thin light edge, so a pink heart still reads on a pink wall. */
const EDGE = 'drop-shadow(0 0 2px rgba(255,255,255,0.95))'

function Icons({ bits, icon, color, className }: { bits: Bit[]; icon: MeadowIconName; color?: string; className: string }) {
  return (
    <>
      {bits.map((b, i) => (
        <span key={i} className={className} style={{
          position: 'absolute', left: b.left, top: b.top, lineHeight: 0, filter: EDGE,
          animationDelay: b.delay, animationDuration: b.dur,
        }}>
          <MeadowIcon name={icon} size={b.size} color={color} />
        </span>
      ))}
    </>
  )
}

export function PotionAround({ potion, layer }: { potion: Live; layer: 'back' | 'front' }) {
  const { def, color, sparkle } = potion
  const fx = def.effect
  const inset: CSSProperties = { position: 'absolute', inset: '-24%', pointerEvents: 'none', zIndex: layer === 'back' ? 0 : 2 }

  if (layer === 'back') {
    const a = fx === 'glow' || fx === 'stars' ? '52' : '3D'
    return (
      <div aria-hidden style={inset}>
        {/* The wash in this batch's own colour: even across the room you can
            tell he's had something. A tint on the floor, not a spotlight:
            flat all the way out past his edges, then fading, so it is no
            stronger round him than anywhere else in it. */}
        <div className={fx === 'rainbow' ? 'potWash potRainbow' : 'potWash'} style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 58%, ${color}${a} 0%, ${color}${a} 38%, transparent 72%)`,
        }} />
        {fx === 'stars' && <Icons bits={TWINKLES} icon="shine" className="potWink" />}
        {fx === 'flowers' && <Icons bits={FEET} icon="daisy" className="potPop" />}
      </div>
    )
  }

  return (
    <div aria-hidden style={inset}>
      {fx === 'hearts' && <Icons bits={RISING} icon="heart" color={M.love} className="potRise" />}
      {fx === 'notes' && <Icons bits={RISING} icon="note" color={color} className="potRiseSway" />}
      {fx === 'leaves' && <Icons bits={FALLING} icon="leaf" color={color} className="potFall" />}
      {(fx === 'sparkles' || fx === 'glow') && <Icons bits={TWINKLES} icon="sparkle" color={fx === 'glow' ? M.coin : color} className="potWink" />}
      {fx === 'bubbles' && RISING.map((b, i) => (
        <span key={i} className="potRise" style={{
          position: 'absolute', left: b.left, top: b.top, width: b.size, height: b.size, borderRadius: 999,
          border: `3px solid ${color}`, background: 'rgba(255,255,255,0.6)', boxShadow: '0 0 0 2px rgba(255,255,255,0.8)',
          animationDelay: b.delay, animationDuration: b.dur,
        }} />
      ))}
      {fx === 'dizzy' && (
        // Three stars on a ring over his head, going round.
        <span className="potOrbit" style={{ position: 'absolute', left: '30%', top: '8%', width: '40%', height: '16%' }}>
          {[0, 120, 240].map(a => (
            <span key={a} style={{
              // Rounded: a long float renders differently on the server and the client.
              position: 'absolute', left: `${(50 + 42 * Math.cos((a * Math.PI) / 180)).toFixed(1)}%`, top: `${(50 + 42 * Math.sin((a * Math.PI) / 180)).toFixed(1)}%`,
              transform: 'translate(-50%, -50%)', lineHeight: 0,
            }}>
              <MeadowIcon name="star" size={22} />
            </span>
          ))}
        </span>
      )}
      {/* A pinch of stardust: a sparkle on top of whatever the colours do. */}
      {sparkle && fx !== 'sparkles' && <Icons bits={TWINKLES.slice(0, 5)} icon="sparkle" color="#B495FB" className="potWink" />}
    </div>
  )
}
