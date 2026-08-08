'use client'

// ─── ReactionFx ─────────────────────────────────────────────────────────────
// Pure pixel particle bits shared by the care-scene reactions: floating hearts,
// eating crumbs, shake-off droplets, clean-sparkles, and the food bowl. Each is
// absolutely positioned inside the scene's Eren container (centered on left
// 50%); the scene mounts/unmounts them by reaction `phase`, and their keyframes
// (defined in globals.css, erenX names) play once. No emojis — crispEdges SVG /
// CSS only.

import { IconHeart } from '@/components/PixelIcons'

type Vars = React.CSSProperties & Record<'--tx' | '--ty', string>

// ── Floating hearts — rise from near the head, drift sideways, vanish at top.
export function Hearts({ count = 3, bottom = '62%' }: { count?: number; bottom?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const dir = i % 2 === 0 ? 1 : -1
        const tx = (8 + (i % 2) * 10) * dir
        return (
          <div key={i} className="absolute pointer-events-none" style={{
            left: `${50 + dir * (6 + i * 3)}%`, bottom,
            transform: 'translateX(-50%)',
            zIndex: 23,
            animation: `erenHeartRise 1.2s ease-out ${i * 150}ms both`,
            ['--tx']: `${tx}px`, ['--ty']: '0px',
          } as Vars}>
            <IconHeart size={i === 1 ? 12 : 10} />
          </div>
        )
      })}
    </>
  )
}

// ── Eating crumbs — small food-colored pixels pop off the bowl with gravity.
// `left` lets the scene anchor them at Eren's mouth (off-center in the crouch
// poses) instead of the container centre.
export function Crumbs({ color, bottom = '4%', left = '50%' }: { color: string; bottom?: string; left?: string }) {
  const bits = [
    { tx: -16, ty: -22, d: 200 }, { tx: 14, ty: -26, d: 500 },
    { tx: -10, ty: -30, d: 900 }, { tx: 18, ty: -20, d: 1300 },
    { tx: -20, ty: -24, d: 1700 }, { tx: 12, ty: -28, d: 2100 },
  ]
  return (
    <>
      {bits.map((b, i) => (
        <div key={i} className="absolute pointer-events-none" style={{
          left, bottom,
          width: i % 2 ? 3 : 4, height: i % 2 ? 3 : 4,
          background: color,
          zIndex: 23,
          animation: `erenCrumb 700ms ease-out ${b.d}ms both`,
          ['--tx']: `${b.tx}px`, ['--ty']: `${b.ty}px`,
        } as Vars} />
      ))}
    </>
  )
}

// ── Shake-off droplets — cyan pixels fly radially and vanish at full extent.
export function Droplets({ bottom = '38%' }: { bottom?: string }) {
  const N = 8
  return (
    <>
      {Array.from({ length: N }, (_, i) => {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2
        const r = 44 + (i % 3) * 12
        return (
          <div key={i} className="absolute pointer-events-none" style={{
            left: '50%', bottom,
            width: 4, height: 4,
            background: '#9FD8F5',
            borderRadius: '50% 50% 55% 55% / 35% 35% 85% 85%',
            zIndex: 23,
            animation: `erenDroplet 420ms cubic-bezier(0.2,0.6,0.4,1) ${(i % 4) * 60}ms both`,
            ['--tx']: `${Math.cos(angle) * r}px`,
            ['--ty']: `${Math.sin(angle) * r}px`,
          } as Vars} />
        )
      })}
    </>
  )
}

// ── Clean sparkles — white/cyan pixel crosses pop at the body's corners.
export function Sparkles({ tint = '#DFF3FF' }: { tint?: string }) {
  const spots = [
    { left: '24%', bottom: '52%', d: 0 },
    { left: '76%', bottom: '48%', d: 120 },
    { left: '32%', bottom: '20%', d: 240 },
    { left: '70%', bottom: '24%', d: 360 },
  ]
  return (
    <>
      {spots.map((s, i) => (
        <div key={i} className="absolute pointer-events-none" style={{
          left: s.left, bottom: s.bottom,
          width: 12, height: 12,
          transform: 'translate(-50%, 50%)',
          zIndex: 23,
          animation: `erenSparklePop 700ms ease-out ${s.d}ms both`,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges">
            <rect x="5" y="0" width="2" height="4" fill={tint} />
            <rect x="5" y="8" width="2" height="4" fill={tint} />
            <rect x="0" y="5" width="4" height="2" fill={tint} />
            <rect x="8" y="5" width="4" height="2" fill={tint} />
            <rect x="5" y="5" width="2" height="2" fill="#FFFFFF" />
          </svg>
        </div>
      ))}
    </>
  )
}

// ── Lolipop — the vet's treat, the food bowl's opposite number: same pop-in,
// same "stays put while he eats, the scene unmounts it" contract, and it
// anchors at EAT_NOSE_X the same way.
//
// It LIES on the floor rather than standing on its stick. That isn't a style
// choice: in the head-down crouch his muzzle is barely a dozen pixels off the
// ground, so an upright lolipop tall enough to read as candy puts the disc up
// over his eyes. Lying down it keeps the bowl's wide-and-short footprint,
// which already reads correctly at this scale.
//
// The stick trails LEFT, out onto open floor. Pointing it the other way buries
// it behind his muzzle and all you see is a pink ball.
//
// `left` centres the prop — the wrapper owns the -50% shift and the inner div
// owns the pop, because erenPropPop animates `transform` and would otherwise
// wipe a translateX on the same element for good (its end state is filled).
export function Lolipop({ bottom = '0%', left = '50%', width = 34 }: { bottom?: string; left?: string; width?: number }) {
  const height = Math.round(width * 14 / 20)
  // A 12px candy disc: rim first, then the same disc inset by a pixel on every
  // side, so the outline stays exactly one pixel thick without hand-drawing
  // each edge.
  const RIM = [
    { y: 0, x: 4, w: 4 }, { y: 1, x: 2, w: 8 }, { y: 2, x: 1, w: 10 },
    { y: 3, x: 1, w: 10 }, { y: 4, x: 0, w: 12 }, { y: 5, x: 0, w: 12 },
    { y: 6, x: 0, w: 12 }, { y: 7, x: 0, w: 12 }, { y: 8, x: 1, w: 10 },
    { y: 9, x: 1, w: 10 }, { y: 10, x: 2, w: 8 }, { y: 11, x: 4, w: 4 },
  ]
  const CANDY = [
    { y: 1, x: 4, w: 4 }, { y: 2, x: 2, w: 8 }, { y: 3, x: 1, w: 10 },
    { y: 4, x: 1, w: 10 }, { y: 5, x: 1, w: 10 }, { y: 6, x: 1, w: 10 },
    { y: 7, x: 1, w: 10 }, { y: 8, x: 2, w: 8 }, { y: 9, x: 2, w: 8 },
    { y: 10, x: 4, w: 4 },
  ]
  // Diagonal of 2×2 blocks — a spiral collapses into a smudge at this size, one
  // clean stripe says "sweet". Same call as IconLolipop.
  const STRIPE = [{ x: 7, y: 2 }, { x: 6, y: 3 }, { x: 5, y: 4 }, { x: 4, y: 5 }, { x: 3, y: 6 }]
  // Stair-stepped stick, so it lies at a shallow angle instead of dead flat.
  const STICK = [{ x: 8, y: 8 }, { x: 6, y: 9 }, { x: 4, y: 10 }, { x: 2, y: 11 }, { x: 0, y: 12 }]
  // The disc sits in the right half of the box; the stick runs out to the left.
  const DX = 8
  return (
    <div className="absolute pointer-events-none" style={{
      left, bottom, transform: 'translateX(-50%)', zIndex: 18,
    }}>
      <div style={{
        width, height,
        animation: 'erenPropPop 220ms ease-out both',
        transformOrigin: 'center bottom',
      }}>
        <svg width={width} height={height} viewBox="0 0 20 14" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
          {/* stick first, so the disc covers where it tucks underneath */}
          {/* A paper-white stick with a dark underline. Wood-tan was invisible:
              it sits a couple of shades off the vet room's terracotta floor. */}
          {STICK.map((s, i) => (
            <g key={`k${i}`}>
              <rect x={s.x} y={s.y} width="3" height="1" fill="#FFF4F8" />
              <rect x={s.x} y={s.y + 1} width="3" height="1" fill="#7A2440" />
            </g>
          ))}
          {RIM.map((r, i) => <rect key={`r${i}`} x={r.x + DX} y={r.y} width={r.w} height="1" fill="#7A2440" />)}
          {CANDY.map((c, i) => <rect key={`c${i}`} x={c.x + DX} y={c.y} width={c.w} height="1" fill="#FF5C8A" />)}
          {STRIPE.map((s, i) => <rect key={`s${i}`} x={s.x + DX} y={s.y} width="2" height="2" fill="#FFF4F8" />)}
        </svg>
      </div>
    </div>
  )
}

// ── Food bowl — a chunky pixel bowl that pops in at the feet, holding a band
// of the fed food's color. Stays put while Eren eats; the scene unmounts it.
export function FoodBowl({ color, bottom = '0%', left = '50%', width = 48 }: { color: string; bottom?: string; left?: string; width?: number }) {
  const height = Math.round(width * 13 / 24)
  return (
    <div className="absolute pointer-events-none" style={{
      left, bottom,
      transform: 'translateX(-50%)',
      width, height,
      zIndex: 18,
      animation: 'erenPropPop 220ms ease-out both',
      transformOrigin: 'center bottom',
    }}>
      <svg width={width} height={height} viewBox="0 0 24 13" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        {/* food mound */}
        <rect x="5" y="3" width="14" height="3" fill={color} />
        <rect x="7" y="2" width="10" height="1" fill={color} />
        {/* bowl body */}
        <rect x="3" y="5" width="18" height="2" fill="#E8E4DC" />
        <rect x="4" y="7" width="16" height="3" fill="#C9C3B8" />
        <rect x="6" y="10" width="12" height="1" fill="#A8A296" />
        {/* rim highlight */}
        <rect x="3" y="5" width="18" height="1" fill="#FFFFFF" />
      </svg>
    </div>
  )
}
