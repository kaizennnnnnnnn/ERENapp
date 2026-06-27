'use client'

// ═══════════════════════════════════════════════════════════════════════════
// CatchCelebration — the moment a fish is landed.
// A water splash bursts, the catch leaps up out of the surface, sparkles ring
// rare-or-better, the screen flashes for a legendary, then the reveal card
// settles in. Mounts when phase becomes 'caught', so every entry animation
// fires exactly once. Snap/step timings, no cross-fades (house style).
// ═══════════════════════════════════════════════════════════════════════════

import { FishSprite, type SpritePalette } from './FishSprite'

type Tier = 'normal' | 'rarePlus' | 'legendary'

interface Props {
  s: SpritePalette
  name: string
  value: number
  rarityColor: string
  rarityLabel: string
  tier: Tier
  isNew: boolean
  reduced: boolean
}

// splash droplets — fixed directions so the burst is symmetrical-ish but lively
const DROPS = [
  { dx: -46, dy: -34, s: 6, d: 0 },
  { dx: -28, dy: -52, s: 5, d: 0.02 },
  { dx: -10, dy: -60, s: 7, d: 0 },
  { dx: 12, dy: -58, s: 5, d: 0.04 },
  { dx: 30, dy: -48, s: 6, d: 0.02 },
  { dx: 48, dy: -30, s: 5, d: 0.06 },
  { dx: -54, dy: -12, s: 4, d: 0.05 },
  { dx: 56, dy: -10, s: 4, d: 0.03 },
  { dx: -20, dy: -40, s: 4, d: 0.08 },
  { dx: 22, dy: -42, s: 4, d: 0.07 },
]

const SPARKS = [
  { x: '14%', y: '24%', d: 0.1 },
  { x: '84%', y: '20%', d: 0.32 },
  { x: '8%', y: '64%', d: 0.5 },
  { x: '90%', y: '58%', d: 0.22 },
  { x: '50%', y: '8%', d: 0.4 },
  { x: '70%', y: '82%', d: 0.62 },
  { x: '26%', y: '86%', d: 0.16 },
]

export default function CatchCelebration({ s, name, value, rarityColor, rarityLabel, tier, isNew, reduced }: Props) {
  const big = tier !== 'normal'
  const legendary = tier === 'legendary'

  return (
    <div className="absolute inset-0 flex items-center justify-center px-6 overflow-hidden">
      {/* legendary screen flash */}
      {legendary && !reduced && (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 46%, rgba(253,224,71,0.5), rgba(253,224,71,0) 60%)', animation: 'gfFlash 0.7s ease-out both' }} />
      )}

      {/* splash droplets — anchored to where the fish breaches */}
      {!reduced && (
        <div className="absolute" style={{ top: '38%', left: '50%' }}>
          {DROPS.map((p, i) => (
            <span key={i} style={{
              position: 'absolute', width: p.s, height: p.s, marginLeft: -p.s / 2, marginTop: -p.s / 2, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #FFFFFF, rgba(186,230,253,0.5) 70%, rgba(186,230,253,0) 100%)',
              ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`,
              animation: `gfDrop 0.66s cubic-bezier(0.2,0.7,0.3,1) ${p.d}s both`,
            }} />
          ))}
          {/* expanding splash ring */}
          <span style={{
            position: 'absolute', width: 30, height: 12, marginLeft: -15, marginTop: -6, borderRadius: '50%',
            border: '2px solid rgba(224,242,254,0.8)', animation: 'gfSplashRing 0.6s ease-out both',
          }} />
        </div>
      )}

      {/* sparkles for rare+ */}
      {big && !reduced && SPARKS.map((p, i) => (
        <span key={`sp${i}`} className="absolute font-pixel" style={{
          left: p.x, top: p.y, fontSize: 12, color: legendary ? '#FEF9C3' : rarityColor,
          textShadow: `0 0 6px ${rarityColor}`, animation: `gfTwinkle 1.1s ease-in-out ${p.d}s infinite`,
        }}>+</span>
      ))}

      {/* reveal card */}
      <div className="relative flex flex-col items-center gap-2 px-6 py-5" style={{
        background: 'linear-gradient(180deg, #0B2A3E 0%, #07202F 100%)',
        border: `3px solid ${rarityColor}`,
        borderRadius: 8,
        boxShadow: `0 6px 0 #06141F, 0 0 ${big ? 38 : 24}px ${rarityColor}${big ? '88' : '55'}`,
        animation: reduced ? undefined : 'gfPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        overflow: 'hidden',
      }}>
        {/* legendary shimmer sweep */}
        {legendary && !reduced && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)',
            animation: 'gfShimmer 1.6s ease-in-out 0.3s infinite',
          }} />
        )}

        {isNew && (
          <span className="font-pixel" style={{ fontSize: 8, color: '#0C2A3E', background: '#FDE047', padding: '2px 8px', borderRadius: 3, letterSpacing: 2, boxShadow: '0 0 10px rgba(253,224,71,0.7)' }}>NEW!</span>
        )}

        <div style={{
          filter: legendary && !reduced ? 'drop-shadow(0 0 10px rgba(253,224,71,0.9))' : big ? `drop-shadow(0 0 6px ${rarityColor})` : undefined,
          animation: reduced ? undefined : 'gfLeap 0.6s cubic-bezier(0.3,1.4,0.5,1) both',
        }}>
          <FishSprite s={s} size={76} />
        </div>

        <p className="font-pixel" style={{ fontSize: 11, color: '#FFFFFF', letterSpacing: 1.5 }}>{name}</p>
        <span className="font-pixel" style={{ fontSize: 7, color: rarityColor, letterSpacing: 2 }}>{rarityLabel}</span>
        <p className="font-pixel" style={{ fontSize: 14, color: '#FDE68A', textShadow: '0 0 8px rgba(251,191,36,0.55)', animation: reduced ? undefined : 'gfValuePop 0.5s cubic-bezier(0.34,1.7,0.5,1) 0.18s both' }}>+{value}</p>
        <p className="font-pixel" style={{ fontSize: 5, color: '#7DD3FC', letterSpacing: 1, marginTop: 2 }}>TAP TO CONTINUE</p>
      </div>
    </div>
  )
}
