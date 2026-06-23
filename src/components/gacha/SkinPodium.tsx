'use client'

import BlinkingEren from '@/components/BlinkingEren'
import type { SkinDef } from '@/lib/skins'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

interface Props {
  skin: SkinDef
  rarity: Rarity
}

const EREN_SIZE = 108

// Sparkle positions: [left%, top%] offsets from scene center
const RARE_SPARKS  = [[22,28],[74,18],[12,62],[80,55],[48,14]] as const
const EPIC_SPARKS  = [[14,22],[78,16],[8,58],[85,50],[50,10],[20,72],[82,68]] as const
const LEG_SPARKS   = [[10,16],[82,14],[4,52],[90,48],[50,6],[18,76],[84,72],[50,88],[30,36],[70,34]] as const

export default function SkinPodium({ skin, rarity }: Props) {
  const isLeg  = rarity === 'legendary'
  const isEpic = rarity === 'epic'
  const sparks = isLeg ? LEG_SPARKS : isEpic ? EPIC_SPARKS : RARE_SPARKS

  return (
    <div style={{ position: 'relative', width: 220, height: 188 }}>

      {/* ── BACKDROP GLOW ─────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: isLeg
          ? 'radial-gradient(ellipse 75% 55% at 50% 48%, rgba(255,200,0,0.2) 0%, transparent 72%)'
          : isEpic
            ? 'radial-gradient(ellipse 75% 55% at 50% 48%, rgba(168,85,247,0.2) 0%, transparent 72%)'
            : 'radial-gradient(ellipse 75% 55% at 50% 48%, rgba(45,125,210,0.18) 0%, transparent 72%)',
      }} />

      {/* ── LEGENDARY: rotating god rays ──────────────── */}
      {isLeg && (
        <div style={{
          position: 'absolute',
          top: '44%', left: '50%',
          width: 280, height: 280,
          marginTop: -140, marginLeft: -140,
          animation: 'podiumRaysRotate 12s linear infinite',
          zIndex: 1, pointerEvents: 'none',
        }}>
          {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => (
            <div key={deg} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 2, height: 140, marginLeft: -1,
              transformOrigin: '50% 0',
              transform: `rotate(${deg}deg)`,
              background: 'linear-gradient(180deg, rgba(255,210,0,0.55) 0%, transparent 100%)',
            }} />
          ))}
        </div>
      )}

      {/* ── EPIC: pulsing aura ring ────────────────────── */}
      {isEpic && (
        <div style={{
          position: 'absolute',
          top: '36%', left: '50%',
          width: 144, height: 144,
          marginTop: -72, marginLeft: -72,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.28) 0%, rgba(168,85,247,0.08) 55%, transparent 70%)',
          animation: 'podiumPulseAura 2.4s ease-in-out infinite',
          zIndex: 1, pointerEvents: 'none',
        }} />
      )}

      {/* ── EREN SPRITE ───────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: '50%',
        zIndex: 5,
        animation: 'podiumErenIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.08s both',
      }}>
        <BlinkingEren
          size={EREN_SIZE}
          src={skin.src}
          tailSrc={skin.tailSrc}
          tailOrigin={skin.tailOrigin}
          eyes={skin.eyes}
        />
      </div>

      {/* ── PODIUM ────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: EREN_SIZE - 8, left: '50%',
        zIndex: 4,
        animation: 'podiumRiseIn 0.4s ease-out both',
      }}>
        {isLeg ? (
          /* THREE-TIER GOLDEN THRONE */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Tier 1 top */}
            <div style={{
              width: 144, height: 15,
              background: 'linear-gradient(180deg,#fffbe0 0%,#ffd700 30%,#c8960c 100%)',
              border: '2px solid #ffec80', borderRadius: '3px 3px 0 0',
              boxShadow: '0 -4px 14px rgba(255,215,0,0.9), inset 0 2px 6px rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 10px',
            }}>
              {['✦','✦','✦'].map((s,i) => (
                <span key={i} style={{ fontSize: 7, color: '#5a3800', lineHeight: 1 }}>{s}</span>
              ))}
            </div>
            {/* Tier 1 body */}
            <div style={{
              width: 144, height: 20,
              background: 'linear-gradient(180deg,#8b6914 0%,#5a4008 100%)',
              border: '2px solid #d4af37', borderTop: 'none',
              boxShadow: '3px 3px 0 #2a1c00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '65%', height: 2, background: 'linear-gradient(90deg,transparent,#ffd700,transparent)' }} />
            </div>
            {/* Tier 2 rim */}
            <div style={{ width: 178, height: 8, background: 'linear-gradient(180deg,#c8960c,#8b6914)', border: '2px solid #d4af37', borderTop: 'none' }} />
            {/* Tier 2 body */}
            <div style={{
              width: 178, height: 22,
              background: 'linear-gradient(180deg,#6b4f10 0%,#3d2c08 100%)',
              border: '2px solid #d4af37', borderTop: 'none',
              boxShadow: '3px 3px 0 #1a1000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#fff8c0,#ffd700)', boxShadow: '0 0 8px rgba(255,215,0,0.9)' }} />
            </div>
            {/* Tier 3 rim */}
            <div style={{ width: 210, height: 8, background: 'linear-gradient(180deg,#c8960c,#8b6914)', border: '2px solid #d4af37', borderTop: 'none' }} />
            {/* Tier 3 body */}
            <div style={{
              width: 210, height: 26,
              background: 'linear-gradient(180deg,#4a3208 0%,#241800 100%)',
              border: '2px solid #d4af37', borderTop: 'none',
              boxShadow: '3px 3px 0 #100a00, 0 0 18px rgba(255,215,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              {['✦','✦✦','✦'].map((s,i) => (
                <span key={i} style={{ fontSize: i===1?9:7, color:'#ffd700', lineHeight:1, textShadow:'0 0 4px rgba(255,215,0,0.8)' }}>{s}</span>
              ))}
            </div>
          </div>
        ) : isEpic ? (
          /* TWO-TIER PURPLE MARBLE WITH GOLD */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Tier 1 top */}
            <div style={{
              width: 152, height: 13,
              background: 'linear-gradient(180deg,#d8b4fe 0%,#7c3aed 40%,#3b1a7a 100%)',
              border: '2px solid #f59e0b', borderRadius: '3px 3px 0 0',
              boxShadow: '0 -3px 12px rgba(168,85,247,0.75), inset 0 1px 5px rgba(255,255,255,0.22)',
            }} />
            {/* Tier 1 body */}
            <div style={{
              width: 152, height: 22,
              background: 'linear-gradient(180deg,#2d1b4e 0%,#1a0f33 100%)',
              border: '2px solid #f59e0b', borderTop: 'none',
              boxShadow: '3px 3px 0 #0a0616',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 10, height: 10, background: '#f59e0b', transform: 'rotate(45deg)', boxShadow: '0 0 6px rgba(245,158,11,0.9)' }} />
            </div>
            {/* Tier 2 rim */}
            <div style={{ width: 194, height: 9, background: 'linear-gradient(180deg,#a855f7,#6b21a8)', border: '2px solid #f59e0b', borderTop: 'none' }} />
            {/* Tier 2 body */}
            <div style={{
              width: 194, height: 24,
              background: 'linear-gradient(180deg,#1f1040 0%,#0f0820 100%)',
              border: '2px solid #f59e0b', borderTop: 'none',
              boxShadow: '3px 3px 0 #060312, 0 0 14px rgba(168,85,247,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {['◆','◆','◆'].map((s,i) => (
                <span key={i} style={{ fontSize: 7, color:'#c084fc', lineHeight:1 }}>{s}</span>
              ))}
            </div>
          </div>
        ) : (
          /* SINGLE-DISC CRYSTAL PLATFORM (rare / common) */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Top surface */}
            <div style={{
              width: 158, height: 13,
              background: 'linear-gradient(180deg,#90c7f7 0%,#2d7dd2 45%,#1a3a6b 100%)',
              border: '2px solid #7ec8ff',
              borderRadius: '50% 50% 0 0 / 60% 60% 0 0',
              boxShadow: '0 -2px 10px rgba(91,164,230,0.65), inset 0 1px 4px rgba(255,255,255,0.28)',
            }} />
            {/* Column */}
            <div style={{
              width: 88, height: 26,
              background: 'linear-gradient(180deg,#1a3a6b 0%,#0f2040 100%)',
              border: '1.5px solid #2d5a9e', borderTop: 'none',
              boxShadow: '3px 3px 0 #060f1f',
            }} />
            {/* Base */}
            <div style={{
              width: 128, height: 18,
              background: 'linear-gradient(180deg,#1e4a8c 0%,#0f2040 100%)',
              border: '1.5px solid #2d5a9e', borderTop: 'none',
              boxShadow: '3px 3px 0 #060f1f, 0 0 10px rgba(45,125,210,0.25)',
            }} />
          </div>
        )}
      </div>

      {/* ── PARTICLES (sparkle diamonds) ──────────────── */}
      {sparks.map(([lp, tp], i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${lp}%`, top: `${tp}%`,
          zIndex: 6, pointerEvents: 'none',
          animation: `podiumSparkle 2.6s ease-in-out ${(i * 0.31).toFixed(2)}s infinite`,
        }}>
          <div style={{
            width: isLeg ? 7 : isEpic ? 6 : 5,
            height: isLeg ? 7 : isEpic ? 6 : 5,
            transform: 'rotate(45deg)',
            background: isLeg ? '#ffd700' : isEpic ? '#c084fc' : '#7ec8ff',
            boxShadow: isLeg
              ? '0 0 5px rgba(255,215,0,0.9)'
              : isEpic
                ? '0 0 4px rgba(192,132,252,0.9)'
                : '0 0 4px rgba(126,200,255,0.8)',
          }} />
        </div>
      ))}

      <style jsx>{`
        @keyframes podiumErenIn {
          0%   { transform: translateX(-50%) translateY(-22px) scale(0.84); opacity: 0; }
          65%  { transform: translateX(-50%) translateY(4px) scale(1.06); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        @keyframes podiumRiseIn {
          0%   { transform: translateX(-50%) translateY(16px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes podiumRaysRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes podiumPulseAura {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50%      { transform: scale(1.13); opacity: 0.85; }
        }
        @keyframes podiumSparkle {
          0%, 100% { transform: scale(0) rotate(45deg); opacity: 0; }
          30%, 70% { transform: scale(1) rotate(45deg); opacity: 1; }
          50%      { transform: scale(1.35) rotate(45deg); opacity: 0.75; }
        }
      `}</style>
    </div>
  )
}
