'use client'

import BlinkingEren from '@/components/BlinkingEren'
import type { SkinDef } from '@/lib/skins'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

interface Props {
  skin: SkinDef
  rarity: Rarity
}

// ── Scene constants ───────────────────────────────────────────────────────────
const EREN_SIZE = 160  // live animated sprite
const OVERLAP   = 17   // px Eren's feet sink into the top platform surface
const SCENE_W   = 300  // container width (max-w-sm gives ~320px content area)
const SCENE_H   = 330  // tall enough for all three tiers of the legendary throne

// ── Sparkle positions: [left%, top%] relative to scene ───────────────────────
const RARE_SPARKS = [
  [18,20],[76,15],[10,58],[84,52],[48,10],[30,80],[72,78],
] as const

const EPIC_SPARKS = [
  [12,18],[80,13],[6,54],[88,48],[50,8],[16,74],[84,70],[52,86],[36,30],[66,28],
] as const

const LEG_SPARKS = [
  [8,12],[84,10],[4,48],[92,44],[50,4],[14,72],[86,68],[50,88],
  [26,34],[74,30],[38,60],[64,58],[20,46],[82,44],[44,22],[56,22],
] as const

// ── Material system ───────────────────────────────────────────────────────────
// Each plinth is a stack of cylinders. A cylinder reads as 3D from three parts:
//   • a lit elliptical TOP FACE (light comes from above)
//   • a WALL shaded cylindrically left→right with a specular highlight band, so
//     the round body catches light down its centre and falls into shadow at the
//     silhouette edges
//   • a darker rounded BASE rim peeking under the wall
// Lower (wider) tiers sit behind the narrower one above, so their top face shows
// as a real step you can see the top of — the wedding-cake plinth read.
interface Mat {
  topHi: string   // brightest point on the top face (light side)
  topMid: string
  topLo: string   // front lip of the top face (away from light)
  edge: string    // wall silhouette (darkest)
  mid: string     // wall mid tone
  center: string  // lit centre column of the wall
  hot: string     // specular highlight band down the wall centre
  rim: string     // bright bevel line along the top edge
  groove: string  // engraved / inlay line colour
  glow: string    // ambient colour glow under the plinth
}

const MATS: Record<Rarity, Mat> = {
  // Matte slate-blue stone — humble, no glow.
  common: {
    topHi: '#aebfd4', topMid: '#74879f', topLo: '#3f4f64',
    edge: '#172230', mid: '#33445a', center: '#4a5d76', hot: '#62758d',
    rim: '#b7cae0', groove: 'rgba(190,212,236,0.30)', glow: 'rgba(90,130,180,0.30)',
  },
  // Polished blue crystal — glossy, cool glow.
  rare: {
    topHi: '#dff1ff', topMid: '#79b6ec', topLo: '#225a96',
    edge: '#0a2444', mid: '#19447f', center: '#2f74c4', hot: '#7fc0f8',
    rim: '#bfe4ff', groove: 'rgba(150,205,255,0.40)', glow: 'rgba(55,140,225,0.55)',
  },
  // Royal purple marble with gold trim.
  epic: {
    topHi: '#efd9ff', topMid: '#b07ff0', topLo: '#4f2496',
    edge: '#180a30', mid: '#371a63', center: '#5a2f93', hot: '#8a55c8',
    rim: '#f1c75a', groove: 'rgba(240,200,90,0.55)', glow: 'rgba(168,85,247,0.55)',
  },
  // Engraved metallic gold.
  legendary: {
    topHi: '#fff6cf', topMid: '#ffdd74', topLo: '#b07f12',
    edge: '#5e4106', mid: '#a9790d', center: '#e2ad2c', hot: '#fff0a8',
    rim: '#fff1a8', groove: 'rgba(120,84,8,0.85)', glow: 'rgba(255,200,0,0.6)',
  },
}

// Tier geometry, top (narrowest, where Eren stands) → bottom (widest base).
type Tier = { w: number; h: number; eh: number }  // eh = top-face ellipse height
const TIERS: Record<Rarity, Tier[]> = {
  common: [
    { w: 150, h: 44, eh: 26 },
    { w: 198, h: 26, eh: 30 },
  ],
  rare: [
    { w: 150, h: 46, eh: 26 },
    { w: 208, h: 30, eh: 32 },
  ],
  epic: [
    { w: 156, h: 40, eh: 24 },
    { w: 212, h: 30, eh: 30 },
    { w: 262, h: 26, eh: 34 },
  ],
  legendary: [
    { w: 168, h: 40, eh: 24 },
    { w: 224, h: 32, eh: 30 },
    { w: 284, h: 34, eh: 38 },
  ],
}

// Cylindrical wall: a vertical sheen+shade pass over a horizontal cylinder shade
// with a tight specular band just left of centre (light from upper-left).
function wallBg(m: Mat): string {
  return [
    'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 16%, rgba(0,0,0,0.10) 52%, rgba(0,0,0,0.42) 100%)',
    `linear-gradient(90deg, ${m.edge} 0%, ${m.mid} 16%, ${m.center} 38%, ${m.hot} 47%, ${m.center} 56%, ${m.mid} 82%, ${m.edge} 100%)`,
  ].join(',')
}

// Top face: light pools at the back (top of the ellipse) and falls to the front
// lip; a faint specular crescent rides the back rim.
function topFaceBg(m: Mat): string {
  return [
    'radial-gradient(ellipse 56% 60% at 50% 16%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 46%)',
    `radial-gradient(ellipse 78% 128% at 50% 4%, ${m.topHi} 0%, ${m.topMid} 44%, ${m.topLo} 100%)`,
  ].join(',')
}

// ── One cylinder tier ─────────────────────────────────────────────────────────
function Cylinder({
  tier, m, z, children,
}: { tier: Tier; m: Mat; z: number; children?: React.ReactNode }) {
  const { w, h, eh } = tier
  // Curve the wall's bottom edge to follow the base ellipse so the silhouette is
  // a drum, not a square card. The vertical radius is half the ellipse height as
  // a share of the wall height.
  const rb = Math.round((eh * 0.5 / h) * 100)
  return (
    <div style={{ position: 'relative', width: w, height: h, zIndex: z, marginTop: z === 99 ? 0 : -eh * 0.42 }}>
      {/* rounded base rim — dark underside, mostly hidden by the wall, its front
          curve peeking below to round off the cylinder bottom */}
      <div style={{
        position: 'absolute', left: 0, bottom: -eh * 0.42, width: w, height: eh,
        borderRadius: '50%', background: m.edge, zIndex: 0,
      }} />
      {/* wall — rounded bottom, soft contact shadow following the round form
          (no hard offset slab: a cylinder doesn't cast a rectangular card shadow) */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: wallBg(m),
        borderRadius: `0 0 50% 50% / 0 0 ${rb}% ${rb}%`,
        filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.4))',
      }}>
        {children}
      </div>
      {/* lit top face — the surface the next tier (or Eren) stands on */}
      <div style={{
        position: 'absolute', left: 0, top: -eh * 0.5, width: w, height: eh,
        borderRadius: '50%', background: topFaceBg(m), zIndex: 2,
        borderTop: `1.5px solid ${m.rim}`,
        boxShadow: `inset 0 2px 4px rgba(255,255,255,0.45), inset 0 -4px 7px rgba(0,0,0,0.4), 0 0 12px ${m.glow}`,
      }} />
    </div>
  )
}

// A faceted gem — rotated square with a top-left catchlight and a dark facet.
function Gem({ size, c1, c2 }: { size: number; c1: string; c2: string }) {
  return (
    <div style={{
      width: size, height: size, transform: 'rotate(45deg)', borderRadius: 1,
      background: `radial-gradient(circle at 32% 26%, #ffffff 0%, ${c1} 34%, ${c2} 100%)`,
      boxShadow: `0 0 7px ${c1}, inset -1px -1px 1px rgba(0,0,0,0.4), inset 1px 1px 1px rgba(255,255,255,0.5)`,
    }} />
  )
}

// A round metal setting holding a gem — the centrepiece of an ornate tier.
function Medallion({ d, ring, c1, c2 }: { d: number; ring: string; c1: string; c2: string }) {
  return (
    <div style={{
      width: d, height: d, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(circle at 36% 30%, #fff3c8 0%, ${ring} 60%, #5a3d04 100%)`,
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.55)',
    }}>
      <Gem size={d * 0.52} c1={c1} c2={c2} />
    </div>
  )
}

// An engraved groove across a wall — a dark recessed line with a light lower lip.
function Groove({ m, top, inset = 12 }: { m: Mat; top: string | number; inset?: number }) {
  return (
    <div style={{
      position: 'absolute', left: inset, right: inset, top, height: 2,
      background: `linear-gradient(90deg, transparent, ${m.groove}, transparent)`,
      boxShadow: '0 1.5px 0 rgba(255,255,255,0.10)',
    }} />
  )
}

// A metallic trim ring just under the rim — bright in the lit centre, fading
// into the cylinder's shadow edges so it wraps the drum instead of sitting flat.
function Collar({ band, top }: { band: string; top: number }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top, height: 5,
      background: `linear-gradient(180deg, #fff6cf 0%, ${band} 55%, #7a560a 100%)`,
      WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 24%, #000 76%, transparent 100%)',
      maskImage: 'linear-gradient(90deg, transparent 0%, #000 24%, #000 76%, transparent 100%)',
      boxShadow: '0 2px 2px rgba(0,0,0,0.4)',
    }} />
  )
}

// Faint marble veining — two soft diagonal light streaks drifting across a wall.
function Veins() {
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, overflow: 'hidden', mixBlendMode: 'screen', opacity: 0.72,
      pointerEvents: 'none',
    }}>
      <div style={{ position: 'absolute', left: '18%', top: -6, width: 3, height: '150%', transform: 'rotate(24deg)', background: 'linear-gradient(180deg, transparent, rgba(231,202,255,0.8), transparent)' }} />
      <div style={{ position: 'absolute', left: '64%', top: -6, width: 2.5, height: '150%', transform: 'rotate(18deg)', background: 'linear-gradient(180deg, transparent, rgba(231,202,255,0.6), transparent)' }} />
    </div>
  )
}

// ── The full plinth: stack of cylinders + per-rarity ornament + shadows ───────
function Plinth({ rarity }: { rarity: Rarity }) {
  const m = MATS[rarity]
  const tiers = TIERS[rarity]
  const widest = Math.max(...tiers.map(t => t.w))

  // Jewels flank the cat on the wide base tier — a centred trio gets buried
  // behind the sprite, so the ornaments sit out in the exposed side zones.
  const flank = (medallion: React.ReactNode) => (
    <>
      <div style={{ position: 'absolute', left: '17%', top: '52%', transform: 'translate(-50%,-50%)' }}>{medallion}</div>
      <div style={{ position: 'absolute', left: '83%', top: '52%', transform: 'translate(-50%,-50%)' }}>{medallion}</div>
    </>
  )

  // Per-tier ornament painted onto the wall.
  const ornament = (i: number): React.ReactNode => {
    const isBase = i === tiers.length - 1
    if (rarity === 'epic') {
      // purple marble veining under a gold collar; jewelled medallions flanking the base
      return (
        <>
          <Veins />
          <Collar band="#e7bd45" top={Math.round(tiers[i].eh * 0.34)} />
          {isBase && flank(<Medallion d={20} ring="#e7bd45" c1="#f0d2ff" c2="#7a2fc0" />)}
        </>
      )
    }
    if (rarity === 'legendary') {
      // engraved bands + a gold collar; ruby medallions enthroned on the base
      return (
        <>
          <Collar band="#e7bd45" top={Math.round(tiers[i].eh * 0.32)} />
          <Groove m={m} top={'calc(100% - 7px)'} inset={10} />
          {isBase && flank(<Medallion d={22} ring="#e7bd45" c1="#ff9c9c" c2="#8c1f1f" />)}
        </>
      )
    }
    if (rarity === 'rare') {
      // a single crisp engraved line — keep the crystal clean and glossy
      return i === 0 ? <Groove m={m} top={'calc(50% - 1px)'} /> : null
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* contact shadow — Eren's footprint pooled on the top face. Two stacked
          ellipses (tight dark core + soft penumbra) so the cat reads as planted,
          not pasted above the surface. */}
      <div style={{
        position: 'absolute', top: tiers[0].eh * 0.30, left: '50%', transform: 'translateX(-50%)',
        width: tiers[0].w * 0.52, height: tiers[0].eh * 0.66, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 72%)',
        zIndex: 3, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: tiers[0].eh * 0.42, left: '50%', transform: 'translateX(-50%)',
        width: tiers[0].w * 0.30, height: tiers[0].eh * 0.42, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
        zIndex: 3, pointerEvents: 'none',
      }} />

      {tiers.map((t, i) => (
        <Cylinder key={i} tier={t} m={m} z={i === 0 ? 99 : tiers.length - i}>
          {ornament(i)}
        </Cylinder>
      ))}

      {/* cast shadow on the floor under the whole plinth */}
      <div style={{
        marginTop: tiers[tiers.length - 1].eh * 0.2,
        width: widest * 1.02, height: 16, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 70%)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

export default function SkinPodium({ skin, rarity }: Props) {
  const isLeg  = rarity === 'legendary'
  const isEpic = rarity === 'epic'
  const sparks = isLeg ? LEG_SPARKS : isEpic ? EPIC_SPARKS : RARE_SPARKS

  return (
    <div style={{ position: 'relative', width: SCENE_W, height: SCENE_H }}>

      {/* ── BACKDROP GLOW ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: isLeg
          ? 'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(255,200,0,0.26) 0%, transparent 70%)'
          : isEpic
            ? 'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(168,85,247,0.24) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(45,125,210,0.22) 0%, transparent 70%)',
      }} />

      {/* ── LEGENDARY: rotating god rays ──────────────────────────────── */}
      {isLeg && (
        <div style={{
          position: 'absolute',
          top: '34%', left: '50%',
          width: 380, height: 380,
          marginTop: -190, marginLeft: -190,
          animation: 'podiumRaysRotate 12s linear infinite',
          zIndex: 1, pointerEvents: 'none',
        }}>
          {[0,22,45,67,90,112,135,157,180,202,225,247,270,292,315,337].map(deg => (
            <div key={deg} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 2.5, height: 190, marginLeft: -1.25,
              transformOrigin: '50% 0',
              transform: `rotate(${deg}deg)`,
              background: 'linear-gradient(180deg, rgba(255,210,0,0.6) 0%, transparent 100%)',
            }} />
          ))}
        </div>
      )}

      {/* ── EPIC: pulsing aura ring ────────────────────────────────────── */}
      {isEpic && (
        <div style={{
          position: 'absolute',
          top: '30%', left: '50%',
          width: 200, height: 200,
          marginTop: -100, marginLeft: -100,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0.1) 55%, transparent 72%)',
          animation: 'podiumPulseAura 2.4s ease-in-out infinite',
          zIndex: 1, pointerEvents: 'none',
        }} />
      )}

      {/* ── EREN SPRITE (centered, drops in from above) ───────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: '50%',
        zIndex: 5,
        animation: 'podiumErenIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.08s both',
      }}>
        <BlinkingEren
          size={EREN_SIZE}
          src={skin.src}
          tailSrc={skin.tailSrc}
          tailOrigin={skin.tailOrigin}
          eyes={skin.eyes}
        />
      </div>

      {/* ── PODIUM (rises from below, overlaps Eren's feet) ───────────── */}
      <div style={{
        position: 'absolute',
        top: EREN_SIZE - OVERLAP,
        left: '50%',
        zIndex: 4,
        animation: 'podiumRiseIn 0.45s ease-out both',
      }}>
        <Plinth rarity={rarity} />
      </div>

      {/* ── SPARKLE PARTICLES ─────────────────────────────────────────── */}
      {sparks.map(([lp, tp], i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${lp}%`, top: `${tp}%`,
          zIndex: 6, pointerEvents: 'none',
          animation: `podiumSparkle 2.8s ease-in-out ${(i * 0.28).toFixed(2)}s infinite`,
        }}>
          <div style={{
            width:  isLeg ? 10 : isEpic ? 8 : 7,
            height: isLeg ? 10 : isEpic ? 8 : 7,
            transform: 'rotate(45deg)',
            background: isLeg ? '#ffd700' : isEpic ? '#c084fc' : '#7ec8ff',
            boxShadow: isLeg
              ? '0 0 7px rgba(255,215,0,0.95)'
              : isEpic
                ? '0 0 6px rgba(192,132,252,0.95)'
                : '0 0 5px rgba(126,200,255,0.9)',
          }} />
        </div>
      ))}

      <style jsx>{`
        @keyframes podiumErenIn {
          0%   { transform: translateX(-50%) translateY(-28px) scale(0.8); opacity: 0; }
          65%  { transform: translateX(-50%) translateY(5px) scale(1.07); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        @keyframes podiumRiseIn {
          0%   { transform: translateX(-50%) translateY(20px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes podiumRaysRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes podiumPulseAura {
          0%, 100% { transform: scale(1);    opacity: 0.4; }
          50%      { transform: scale(1.15); opacity: 0.9; }
        }
        @keyframes podiumSparkle {
          0%, 100% { transform: scale(0)    rotate(45deg); opacity: 0; }
          30%, 70% { transform: scale(1)    rotate(45deg); opacity: 1; }
          50%      { transform: scale(1.4)  rotate(45deg); opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
