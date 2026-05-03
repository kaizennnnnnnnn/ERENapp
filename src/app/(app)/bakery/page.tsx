'use client'

// ═══════════════════════════════════════════════════════════════════════════
// EREN'S BAKERY — top-level shop page where Eren sells cakes.
// ──────────────────────────────────────────────────────────────────────────
// Player browses a grid of cakes, taps one, and Eren plays a short "sell"
// animation: cake slides from the menu over to him, he gives a happy
// expression, a "SOLD!" stamp pops, coins fly out, the cake fades.
//
// Currency: existing player coins via TaskContext.spendCoins().
// Persistence: NONE for v1 — purchases are pure flavour. Easy to add a
// bakery_purchases table later if cakes become collectibles or food.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { playSound } from '@/lib/sounds'
import { CAKES, type CakeDef } from '@/lib/cakes'
import { IconCoin, IconStar, IconCake, IconHeart } from '@/components/PixelIcons'

interface PurchaseFx {
  id:    number
  cake:  CakeDef
  startedAt: number
}

export default function BakeryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { coins, spendCoins } = useTasks()
  const { setHideStats } = useCare()

  // The bakery has its own header — hide the persistent StatsHeader so
  // the room takes the full viewport (matches the mini-game pages).
  useEffect(() => { setHideStats(true) }, [setHideStats])

  const [fx, setFx] = useState<PurchaseFx | null>(null)
  const [busy, setBusy] = useState(false)
  const fxIdRef = useRef(0)

  async function buy(cake: CakeDef) {
    if (busy) return
    if (!user?.id) return
    if (coins < cake.price) {
      playSound('ui_modal_open') // soft "no" ping
      return
    }
    setBusy(true)
    playSound('ui_tap')
    const ok = await spendCoins(cake.price)
    if (!ok) {
      setBusy(false)
      return
    }
    const id = ++fxIdRef.current
    setFx({ id, cake, startedAt: performance.now() })
    // Animation runs ~1.6 s; release the buy-lock just after.
    setTimeout(() => {
      setFx(curr => curr && curr.id === id ? null : curr)
      setBusy(false)
    }, 1700)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col game-shell"
      style={{
        background:
          'radial-gradient(ellipse at top, #FFE4E1 0%, #FCE7F3 35%, #FBCFE8 70%, #F9A8D4 100%)',
      }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0 relative z-20" style={{
        background: 'linear-gradient(180deg, rgba(180,83,9,0.92) 0%, rgba(120,53,15,0.85) 100%)',
        borderBottom: '2px solid #FBBF24',
        boxShadow: '0 4px 12px rgba(120,53,15,0.4)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.18)', borderRadius: 6, border: '2px solid rgba(251,191,36,0.6)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-amber-100" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5 inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #DB2777, #9D174D)', border: '2px solid #831843', borderRadius: 4, fontSize: 9, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <IconCake size={12} />
          EREN&apos;S BAKERY
        </span>
        <div className="flex-1" />
        {/* Coin balance pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 font-pixel"
          style={{
            background: 'linear-gradient(180deg, #78350F, #451A03)',
            border: '2px solid #FBBF24',
            borderRadius: 4,
            fontSize: 9,
            color: '#FDE68A',
            boxShadow: '0 2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(251,191,36,0.3)',
          }}>
          <IconCoin size={14} />
          {coins}
        </div>
      </div>

      {/* Drifting sparkle bg */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(251,191,36,0.4) 1px, transparent 1.5px), radial-gradient(circle, rgba(244,114,182,0.4) 1px, transparent 1.5px)',
        backgroundSize: '38px 38px, 56px 56px',
        backgroundPosition: '0 0, 22px 28px',
        animation: 'bkStarDrift 28s linear infinite',
        opacity: 0.55,
      }} />

      {/* Main scene area: counter + Eren behind it */}
      <div className="relative flex-shrink-0 flex flex-col items-center justify-end pt-4 pb-2"
        style={{ minHeight: 220 }}>
        {/* Wall back-panel — bakery interior */}
        <div className="absolute inset-x-0 top-0 bottom-12" style={{
          background: 'linear-gradient(180deg, rgba(254,226,226,0.7) 0%, rgba(252,231,243,0.5) 100%)',
        }} />

        {/* Decorative wall items (a tiny cake on each side, behind Eren) */}
        <div className="absolute" style={{ top: 18, left: '14%', filter: 'drop-shadow(0 2px 0 rgba(120,53,15,0.3))' }}>
          <IconCake size={28} />
        </div>
        <div className="absolute" style={{ top: 22, right: '14%', filter: 'drop-shadow(0 2px 0 rgba(120,53,15,0.3))' }}>
          <IconHeart size={20} />
        </div>
        <div className="absolute" style={{ top: 12, left: '50%', transform: 'translateX(-50%)' }}>
          <span className="font-pixel" style={{
            fontSize: 7, letterSpacing: 3, color: '#7C2D12',
            textShadow: '0 1px 0 rgba(255,255,255,0.7), 0 0 6px rgba(251,191,36,0.4)',
          }}>★ FRESHLY BAKED ★</span>
        </div>

        {/* Eren behind the counter */}
        <div className="relative z-10 mb-2" style={{ animation: 'bkErenBob 2.4s ease-in-out infinite' }}>
          <img src="/erenGood.png" alt="Eren" draggable={false}
            style={{
              width: 110, height: 110, objectFit: 'contain', imageRendering: 'pixelated',
              filter: 'drop-shadow(0 4px 6px rgba(120,53,15,0.4)) drop-shadow(0 0 10px rgba(251,191,36,0.3))',
            }} />
        </div>

        {/* The counter */}
        <div className="relative z-10 w-full" style={{ height: 28 }}>
          <div className="absolute inset-x-2 inset-y-0" style={{
            background: 'linear-gradient(180deg, #92400E 0%, #78350F 50%, #5A1A0A 100%)',
            border: '2px solid #451A03',
            borderRadius: 4,
            boxShadow: '0 4px 0 #451A03, inset 0 2px 0 rgba(255,255,255,0.18)',
          }}>
            {/* Wood grain flecks */}
            <div style={{ position: 'absolute', top: 4, left: '20%', width: 12, height: 2, background: '#5A1A0A', opacity: 0.5 }} />
            <div style={{ position: 'absolute', top: 12, right: '25%', width: 18, height: 2, background: '#5A1A0A', opacity: 0.5 }} />
            <div style={{ position: 'absolute', top: 8, left: '60%', width: 8, height: 2, background: '#5A1A0A', opacity: 0.5 }} />
          </div>
        </div>

        {/* Sell-animation overlay (flies a cake from the tapped tile up to
            Eren and pops a SOLD! stamp). Lives in the scene area so the
            cake clearly travels TO Eren. */}
        {fx && (
          <div className="absolute inset-0 pointer-events-none z-20">
            <div key={fx.id} className="absolute"
              style={{
                left: '50%', bottom: 50,
                transform: 'translateX(-50%)',
                animation: 'bkCakeFly 1.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
              }}>
              <CakeSprite cake={fx.cake} size={54} />
            </div>
            <div key={`stamp-${fx.id}`} className="absolute"
              style={{
                left: '50%', top: '40%',
                transform: 'translate(-50%, -50%)',
                animation: 'bkStampPop 1.6s ease-out forwards',
              }}>
              <div className="px-3 py-1.5 font-pixel" style={{
                background: 'rgba(220,38,38,0.18)',
                border: '3px solid #DC2626',
                borderRadius: 4,
                fontSize: 14,
                color: '#7F1D1D',
                letterSpacing: 4,
                textShadow: '0 1px 0 rgba(255,255,255,0.6)',
                boxShadow: '0 0 14px rgba(220,38,38,0.45)',
                transform: 'rotate(-8deg)',
              }}>
                SOLD!
              </div>
            </div>
            {/* Coin sparks flying out */}
            {[0, 1, 2, 3, 4].map(i => (
              <div key={`coin-${fx.id}-${i}`} className="absolute"
                style={{
                  left: '50%', bottom: 70,
                  transform: 'translateX(-50%)',
                  animation: `bkCoinFly${i} 1.4s ease-out forwards`,
                }}>
                <IconCoin size={14} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cake menu */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-4 pt-2" style={{ scrollbarWidth: 'thin' }}>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="h-[2px] flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,45,18,0.6), transparent)' }} />
          <span className="font-pixel inline-flex items-center gap-1.5" style={{
            fontSize: 8,
            color: '#7C2D12',
            letterSpacing: 2,
            textShadow: '0 1px 0 rgba(255,255,255,0.6)',
          }}>
            <IconStar size={10} />
            TODAY&apos;S MENU
            <IconStar size={10} />
          </span>
          <div className="h-[2px] flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,45,18,0.6), transparent)' }} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CAKES.map(cake => {
            const canAfford = coins >= cake.price
            return (
              <button key={cake.id}
                onClick={() => buy(cake)}
                disabled={!canAfford || busy}
                className="relative p-2.5 text-left active:translate-y-[1px] transition-transform overflow-hidden"
                style={{
                  background: canAfford
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,251,235,0.85) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(252,231,243,0.4) 100%)',
                  border: `2px solid ${canAfford ? cake.dark : 'rgba(120,53,15,0.3)'}`,
                  borderRadius: 6,
                  boxShadow: canAfford
                    ? `3px 3px 0 ${cake.dark}, inset 0 1px 0 rgba(255,255,255,0.65), 0 0 10px ${cake.main}40`
                    : '2px 2px 0 rgba(120,53,15,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
                  opacity: canAfford ? 1 : 0.6,
                  cursor: canAfford && !busy ? 'pointer' : 'not-allowed',
                }}>
                {/* Gold rivet corners — only on affordable tiles */}
                {canAfford && (
                  <>
                    <div style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, background: '#FBBF24' }} />
                    <div style={{ position: 'absolute', top: 3, right: 3, width: 3, height: 3, background: '#FBBF24' }} />
                    <div style={{ position: 'absolute', bottom: 3, left: 3, width: 3, height: 3, background: '#FBBF24' }} />
                    <div style={{ position: 'absolute', bottom: 3, right: 3, width: 3, height: 3, background: '#FBBF24' }} />
                  </>
                )}

                <div className="flex items-center gap-2.5">
                  <div className="flex-shrink-0 flex items-center justify-center"
                    style={{
                      width: 50, height: 50,
                      background: `radial-gradient(circle at 35% 30%, ${cake.light} 0%, ${cake.main} 80%)`,
                      border: `2px solid ${cake.dark}`,
                      borderRadius: 6,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), 0 0 8px ${cake.main}55`,
                    }}>
                    <CakeSprite cake={cake} size={36} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel mb-1" style={{
                      fontSize: 6,
                      color: cake.dark,
                      letterSpacing: 0.6,
                      lineHeight: 1.3,
                      textShadow: '0 1px 0 rgba(255,255,255,0.5)',
                    }}>
                      {cake.name}
                    </p>
                    <p className="text-[10px] mb-1.5" style={{ color: '#7C2D12', opacity: 0.75, lineHeight: 1.25 }}>
                      {cake.blurb}
                    </p>
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 font-pixel"
                      style={{
                        background: canAfford ? 'linear-gradient(180deg, #78350F, #451A03)' : 'rgba(120,53,15,0.3)',
                        border: `1px solid ${canAfford ? '#FBBF24' : 'rgba(120,53,15,0.4)'}`,
                        borderRadius: 3,
                        fontSize: 8,
                        color: canAfford ? '#FDE68A' : '#7C2D12',
                      }}>
                      <IconCoin size={10} />
                      {cake.price}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer note */}
        <div className="flex items-center justify-center gap-2 mt-4 mb-2">
          <div className="h-[1px] w-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }} />
          <p className="font-pixel" style={{ fontSize: 6, color: '#7C2D12', letterSpacing: 2, opacity: 0.7 }}>
            EREN BAKES WITH LOVE
          </p>
          <div className="h-[1px] w-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes bkStarDrift {
          from { background-position: 0 0, 22px 28px; }
          to   { background-position: 200px 0, 222px 28px; }
        }
        @keyframes bkErenBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes bkCakeFly {
          0%   { transform: translateX(-50%) translateY(40px) scale(0.6) rotate(-5deg); opacity: 0; }
          15%  { transform: translateX(-50%) translateY(0)    scale(1)   rotate(0deg);  opacity: 1; }
          55%  { transform: translateX(-50%) translateY(-90px) scale(1.1) rotate(8deg); opacity: 1; }
          80%  { transform: translateX(-50%) translateY(-130px) scale(0.95) rotate(-4deg); opacity: 0.85; }
          100% { transform: translateX(-50%) translateY(-150px) scale(0.4) rotate(0deg); opacity: 0; }
        }
        @keyframes bkStampPop {
          0%   { transform: translate(-50%, -50%) rotate(-8deg) scale(0); opacity: 0; }
          25%  { transform: translate(-50%, -50%) rotate(-12deg) scale(1.4); opacity: 1; }
          40%  { transform: translate(-50%, -50%) rotate(-8deg) scale(1);   opacity: 1; }
          80%  { transform: translate(-50%, -50%) rotate(-8deg) scale(1);   opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(-8deg) scale(0.85); opacity: 0; }
        }
        /* Five coin trajectories fanning out & up */
        @keyframes bkCoinFly0 {
          0%   { transform: translate(-50%, 0)         scale(0.6); opacity: 0; }
          15%  { transform: translate(-50%, -10px)     scale(1);   opacity: 1; }
          100% { transform: translate(-180%, -120px)   scale(0.4); opacity: 0; }
        }
        @keyframes bkCoinFly1 {
          0%   { transform: translate(-50%, 0)         scale(0.6); opacity: 0; }
          15%  { transform: translate(-50%, -10px)     scale(1);   opacity: 1; }
          100% { transform: translate(-130%, -160px)   scale(0.5); opacity: 0; }
        }
        @keyframes bkCoinFly2 {
          0%   { transform: translate(-50%, 0)         scale(0.6); opacity: 0; }
          15%  { transform: translate(-50%, -10px)     scale(1);   opacity: 1; }
          100% { transform: translate(-50%, -180px)    scale(0.4); opacity: 0; }
        }
        @keyframes bkCoinFly3 {
          0%   { transform: translate(-50%, 0)         scale(0.6); opacity: 0; }
          15%  { transform: translate(-50%, -10px)     scale(1);   opacity: 1; }
          100% { transform: translate(30%, -160px)     scale(0.5); opacity: 0; }
        }
        @keyframes bkCoinFly4 {
          0%   { transform: translate(-50%, 0)         scale(0.6); opacity: 0; }
          15%  { transform: translate(-50%, -10px)     scale(1);   opacity: 1; }
          100% { transform: translate(80%, -120px)     scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── CakeSprite — SVG pixel-art cake using the cake's own palette ──────────
// Three layers (cake body / cream / frosting) + a candle. Shape is shared
// across all cakes; the palette differentiates them. Bigger sizes use the
// same 12×12 grid scaled up via SVG width/height.
function CakeSprite({ cake, size }: { cake: CakeDef; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* Candle flame */}
      <rect x="6" y="0" width="1" height="1" fill="#FBBF24" />
      {/* Candle stem */}
      <rect x="6" y="1" width="1" height="1" fill={cake.dark} />
      {/* Top frosting */}
      <rect x="3" y="2" width="6" height="1" fill={cake.main} />
      <rect x="2" y="3" width="8" height="1" fill={cake.main} />
      {/* Frosting drip highlight */}
      <rect x="3" y="3" width="2" height="1" fill={cake.light} />
      <rect x="6" y="3" width="2" height="1" fill={cake.light} />
      {/* Cake body — alternating bands */}
      <rect x="1" y="4" width="10" height="1" fill={cake.dark} />
      <rect x="1" y="5" width="10" height="1" fill="#FDE68A" />
      <rect x="1" y="6" width="10" height="1" fill={cake.dark} />
      <rect x="1" y="7" width="10" height="1" fill="#FDE68A" />
      <rect x="1" y="8" width="10" height="1" fill={cake.dark} />
      {/* Plate */}
      <rect x="0" y="9" width="12" height="1" fill="#525252" />
      <rect x="0" y="9" width="12" height="1" fill="#9CA3AF" opacity="0.6" />
      {/* Sprinkle accents */}
      <rect x="3" y="2" width="1" height="1" fill={cake.accent} />
      <rect x="7" y="2" width="1" height="1" fill={cake.accent} />
      <rect x="5" y="3" width="1" height="1" fill={cake.accent} />
    </svg>
  )
}
