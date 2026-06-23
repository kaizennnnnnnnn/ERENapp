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
const OVERLAP   = 10   // px Eren's feet sink into the top platform surface
const SCENE_W   = 300  // container width (max-w-sm gives ~320px content area)
const SCENE_H   = 316  // tall enough for all three tiers of the legendary throne

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
        {isLeg ? (
          /* ── THREE-TIER GOLDEN THRONE ─────────────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Tier 1 — crown top */}
            <div style={{
              width: 216, height: 22,
              background: 'linear-gradient(180deg,#fffbe0 0%,#ffd700 28%,#c8960c 100%)',
              border: '2.5px solid #ffec80',
              borderRadius: '4px 4px 0 0',
              boxShadow: '0 -5px 20px rgba(255,215,0,0.95), inset 0 2px 8px rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 14px',
            }}>
              {['✦','✦','✦','✦','✦'].map((s,i) => (
                <span key={i} style={{ fontSize: 8, color: '#5a3800', lineHeight: 1 }}>{s}</span>
              ))}
            </div>
            {/* Tier 1 — body */}
            <div style={{
              width: 216, height: 30,
              background: 'linear-gradient(180deg,#8b6914 0%,#5a4008 100%)',
              border: '2.5px solid #d4af37', borderTop: 'none',
              boxShadow: '4px 4px 0 #2a1c00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '70%', height: 2, background: 'linear-gradient(90deg,transparent,#ffd700,transparent)' }} />
            </div>
            {/* Tier 2 — rim */}
            <div style={{ width: 268, height: 12, background: 'linear-gradient(180deg,#c8960c,#8b6914)', border: '2.5px solid #d4af37', borderTop: 'none' }} />
            {/* Tier 2 — body */}
            <div style={{
              width: 268, height: 34,
              background: 'linear-gradient(180deg,#6b4f10 0%,#3d2c08 100%)',
              border: '2.5px solid #d4af37', borderTop: 'none',
              boxShadow: '4px 4px 0 #1a1000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#fff8c0,#ffd700)', boxShadow: '0 0 12px rgba(255,215,0,0.95)' }} />
            </div>
            {/* Tier 3 — rim */}
            <div style={{ width: 316, height: 12, background: 'linear-gradient(180deg,#c8960c,#8b6914)', border: '2.5px solid #d4af37', borderTop: 'none' }} />
            {/* Tier 3 — base */}
            <div style={{
              width: 316, height: 40,
              background: 'linear-gradient(180deg,#4a3208 0%,#241800 100%)',
              border: '2.5px solid #d4af37', borderTop: 'none',
              boxShadow: '4px 4px 0 #100a00, 0 0 24px rgba(255,215,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              {['✦','✦✦✦','✦'].map((s,i) => (
                <span key={i} style={{ fontSize: i===1?11:8, color:'#ffd700', lineHeight:1, textShadow:'0 0 6px rgba(255,215,0,0.9)' }}>{s}</span>
              ))}
            </div>
          </div>

        ) : isEpic ? (
          /* ── TWO-TIER PURPLE MARBLE + GOLD ───────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Tier 1 — top surface */}
            <div style={{
              width: 228, height: 19,
              background: 'linear-gradient(180deg,#d8b4fe 0%,#7c3aed 40%,#3b1a7a 100%)',
              border: '2.5px solid #f59e0b',
              borderRadius: '4px 4px 0 0',
              boxShadow: '0 -4px 16px rgba(168,85,247,0.8), inset 0 2px 6px rgba(255,255,255,0.25)',
            }} />
            {/* Tier 1 — body */}
            <div style={{
              width: 228, height: 33,
              background: 'linear-gradient(180deg,#2d1b4e 0%,#1a0f33 100%)',
              border: '2.5px solid #f59e0b', borderTop: 'none',
              boxShadow: '4px 4px 0 #0a0616',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              {[12,14,12].map((sz,i) => (
                <div key={i} style={{ width: sz, height: sz, background: '#f59e0b', transform: 'rotate(45deg)', boxShadow: '0 0 8px rgba(245,158,11,0.9)' }} />
              ))}
            </div>
            {/* Tier 2 — rim */}
            <div style={{ width: 292, height: 13, background: 'linear-gradient(180deg,#a855f7,#6b21a8)', border: '2.5px solid #f59e0b', borderTop: 'none' }} />
            {/* Tier 2 — body */}
            <div style={{
              width: 292, height: 36,
              background: 'linear-gradient(180deg,#1f1040 0%,#0f0820 100%)',
              border: '2.5px solid #f59e0b', borderTop: 'none',
              boxShadow: '4px 4px 0 #060312, 0 0 18px rgba(168,85,247,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              {['◆','◆','◆','◆','◆'].map((s,i) => (
                <span key={i} style={{ fontSize: 9, color:'#c084fc', lineHeight:1, textShadow:'0 0 4px rgba(192,132,252,0.8)' }}>{s}</span>
              ))}
            </div>
          </div>

        ) : (
          /* ── SINGLE-DISC CRYSTAL PLATFORM (rare / common) ─────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Top surface — elliptical disc face */}
            <div style={{
              width: 238, height: 20,
              background: 'linear-gradient(180deg,#b8deff 0%,#4a9edf 30%,#2d7dd2 60%,#1a3a6b 100%)',
              border: '2.5px solid #7ec8ff',
              borderRadius: '50% 50% 0 0 / 65% 65% 0 0',
              boxShadow: '0 -3px 14px rgba(91,164,230,0.7), inset 0 2px 6px rgba(255,255,255,0.32)',
            }} />
            {/* Column */}
            <div style={{
              width: 132, height: 38,
              background: 'linear-gradient(180deg,#1a3a6b 0%,#0f2040 100%)',
              border: '2px solid #2d5a9e', borderTop: 'none',
              boxShadow: '4px 4px 0 #060f1f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '60%', height: 2, background: 'linear-gradient(90deg,transparent,rgba(126,200,255,0.5),transparent)' }} />
            </div>
            {/* Base */}
            <div style={{
              width: 192, height: 28,
              background: 'linear-gradient(180deg,#1e4a8c 0%,#0f2040 100%)',
              border: '2px solid #2d5a9e', borderTop: 'none',
              boxShadow: '4px 4px 0 #060f1f, 0 0 14px rgba(45,125,210,0.3)',
            }} />
          </div>
        )}
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
