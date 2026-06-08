'use client'

// ═══════════════════════════════════════════════════════════════════════════
// EREN'S BAKERY — top-level shop page where Eren sells cakes.
// ──────────────────────────────────────────────────────────────────────────
// The room is the CakeShop.png picture shown WHOLE (fit to width) on a soft
// blurred surround, so nothing of the bakery is cropped off. Eren lives inside
// a "stage" that exactly matches the picture, so he always lines up with the
// painted counter: his sprite is clipped at the counter line and only his head
// pokes over it — he reads as standing behind/under the counter. Same breathing
// + blink + idle treatment as every room.
//
// Buying cakes lives in a slide-up "ORDER" sheet so the picture stays the hero.
// On purchase the cake flies up from Eren, a "SOLD!" stamp pops, coins burst.
// Currency: player coins via TaskContext.spendCoins(). No persistence (v1).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'
import { CAKES, type CakeDef } from '@/lib/cakes'
import { IconCoin, IconStar, IconCake } from '@/components/PixelIcons'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'

interface PurchaseFx {
  id:    number
  cake:  CakeDef
  startedAt: number
}

// ErenCakeShop.png pose: pink baker hat with strawberry. Coords from a
// pixel-scan of the 963×1536 sprite, translated to the 360×360 container
// the bakery renders at (portrait sprite height-fits so the image
// occupies the middle ~62.7% of container width).
// Catchlights on this sprite are MIRRORED (not same-position symmetric):
//   eye A (cat's right, viewer's left) — upper-RIGHT of its iris
//   eye B (cat's left, viewer's right) — upper-LEFT of its iris
// He's clipped at the counter line (see EREN block) so only his head +
// chest show above the counter.
const CAKE_EYES = {
  lidTop:     '37.08%',
  lidWidth:   '5.43%',
  lidLeftA:   '41.01%',
  lidLeftB:   '54.98%',
  maskTop:    '37.08%',
  maskLeftA:  '41.01%',
  maskLeftB:  '54.98%',
  maskW:      '5.43%',
  maskH:      '4.62%',
  glintLeftA: '59.7%',
  glintTopA:  '1.6%',
  glintLeftB: '20.5%',
  glintTopB:  '2%',
  glintW:     '18%',
}

// Per-picture metadata. Day and night were authored at different aspect
// ratios (day 941×1672 ≈ 9:16, night 1024×1536 ≈ 4:3-ish) and the
// counter top sits at very different row %s in each — measured from the
// actual PNG bytes with a column-scan for the peachy-wall → dark-wood
// transition. Locking the stage to a single aspect would mean Eren stands
// right at the counter on one picture and floats above it on the other.
// Carry both metrics through together.
interface ShopPic { src: string; w: number; h: number; counterPct: number }
const SHOP_DAY:   ShopPic = { src: '/CakeShop.png',      w:  941, h: 1672, counterPct: 58.5 }
const SHOP_NIGHT: ShopPic = { src: '/CakeShopNight.png', w: 1024, h: 1536, counterPct: 74.3 }
// Eren's box, sized in cqi (container-query inline-size = % of the PICTURE's
// width, see the `.pic` container) so he always tracks the picture and stays
// glued to the counter. vw broke this: on a short/wide viewport the picture
// becomes height-constrained (narrower than the screen), but vw is screen-
// relative, so Eren ballooned oversized and slid off the counter.
const EREN_VW = 42
// Show his top ~62% (head + chest + paws on the counter) above the counter
// line. Raising this lifts him while the cut stays at the counter, so he
// shows more without floating off the edge.
const EREN_SHOW = 0.62
// +2px nudges him a couple pixels up off the counter line so his paws don't
// sit perfectly flush against the wood seam.
const EREN_BOTTOM = `calc(${-(1 - EREN_SHOW) * EREN_VW}cqi + 2px)`

export default function BakeryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { coins, spendCoins } = useTasks()
  const { setHideStats } = useCare()
  const isDark = useIsDark()
  const pic = isDark ? SHOP_NIGHT : SHOP_DAY
  const shopSrc = pic.src
  // The empty letterbox band height tracks the active picture's aspect.
  // Width-constrained phones get bands, landscape gets clamp-to-0.
  const bandH = `max(0px, calc((100dvh - 100vw * ${pic.h} / ${pic.w}) / 2))`

  // Full-screen scene — hide the persistent StatsHeader.
  useEffect(() => { setHideStats(true) }, [setHideStats])

  const [fx, setFx] = useState<PurchaseFx | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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
    setMenuOpen(false)
    const id = ++fxIdRef.current
    setFx({ id, cake, startedAt: performance.now() })
    // Animation runs ~1.6 s; release the buy-lock just after.
    setTimeout(() => {
      setFx(curr => curr && curr.id === id ? null : curr)
      setBusy(false)
    }, 1700)
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none game-shell">

      {/* ══ BLURRED FILL ══ soft surround so the full picture needs no bare bars. */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${shopSrc})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(18px) brightness(0.55)',
        transform: 'scale(1.1)',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
      }} />

      {/* ══ TOP WOOD BEAM ══ a wooden ceiling beam that fills the empty band
          above the picture so the screen reads as a framed shop diorama
          instead of "image with brown gradient bars". Height is the exact
          letterbox band, computed from the picture aspect ratio. */}
      <div className="absolute top-0 inset-x-0 z-[15] pointer-events-none overflow-hidden" style={{
        height: bandH,
        background: 'linear-gradient(180deg, #1F0F06 0%, #3A1F0E 25%, #2D1608 65%, #1A0B06 100%)',
        borderBottom: '3px solid #0A0502',
        boxShadow: '0 4px 8px rgba(0,0,0,0.55), inset 0 -3px 6px rgba(0,0,0,0.4)',
      }}>
        {/* Plank seams — vertical dark lines every ~28vw so the beam reads as
            individual planks instead of one slab. */}
        <div className="absolute inset-0" style={{
          background:
            'repeating-linear-gradient(90deg, transparent 0, transparent 28vw, rgba(0,0,0,0.55) 28vw, rgba(0,0,0,0.55) calc(28vw + 2px))',
        }} />
        {/* Subtle horizontal wood grain */}
        <div className="absolute inset-0" style={{
          background:
            'repeating-linear-gradient(180deg, transparent 0, transparent 6px, rgba(255,180,120,0.05) 6px, rgba(255,180,120,0.05) 7px)',
        }} />
      </div>

      {/* ══ BOTTOM TILE FLOOR ══ pink + cream checker that fills the empty
          band below the picture. The painted floor inside the shop ends at
          the picture's bottom edge; this strip carries it down to the
          viewport edge so the ORDER button sits on tile, not on blur. */}
      <div className="absolute bottom-0 inset-x-0 z-[15] pointer-events-none overflow-hidden" style={{
        height: bandH,
        borderTop: '3px solid #2E1404',
        backgroundColor: '#F4D6CC',
        backgroundImage:
          'conic-gradient(#C97D7D 90deg, #F4D6CC 0 180deg, #C97D7D 0 270deg, #F4D6CC 0)',
        backgroundSize: '28px 28px',
        boxShadow: '0 -4px 8px rgba(0,0,0,0.4), inset 0 3px 6px rgba(0,0,0,0.3)',
      }}>
        {/* Soft top/bottom vignette so the tile edges feel grounded. */}
        <div className="absolute inset-0" style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.18) 100%)',
        }} />
      </div>

      {/* ══ STAGE ══ the whole picture, fit to width and centered. Eren lives
          inside it so he always lines up with the painted counter. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: '100%', aspectRatio: `${pic.w} / ${pic.h}`, maxHeight: '100%', containerType: 'inline-size' }}>
          <img src={shopSrc} alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', WebkitUserSelect: 'none', userSelect: 'none' }} />

          {/* ══ EREN ══ behind the counter. The clip box ends at the counter
              line so his lower body is hidden; only his head pokes over.
              Breathing lives in BlinkingEren, idle wiggles in ErenIdleLayer. */}
          <div className="absolute left-0 right-0 top-0 overflow-hidden pointer-events-none"
            style={{ height: `${pic.counterPct}%`, zIndex: 10 }}>
            <div className="absolute left-1/2" style={{ bottom: EREN_BOTTOM, transform: 'translateX(-50%)' }}>
              <ErenIdleLayer>
                {/* Soften BlinkingEren's default night dimmer
                    (brightness(0.7)+saturate(0.85) — too dark) to a gentle dim
                    with a warm sepia tint that matches the pendant-lamp pool
                    pouring over his head in CakeShopNight.png. Day inherits
                    no filter as usual. */}
                <BlinkingEren
                  size={`${EREN_VW}cqi`}
                  src="/ErenCakeShop.png"
                  eyes={CAKE_EYES}
                  style={isDark ? { filter: 'brightness(0.93) saturate(0.95) sepia(0.08)' } : undefined}
                />
              </ErenIdleLayer>
            </div>
          </div>

          {/* ══ SELL ANIMATION ══ rises from Eren just above the counter. */}
          {fx && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
              <div key={fx.id} className="absolute"
                style={{ left: '50%', top: '56%', transform: 'translateX(-50%)', animation: 'bkCakeFly 1.6s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                <CakeSprite cake={fx.cake} size={56} />
              </div>
              <div key={`stamp-${fx.id}`} className="absolute"
                style={{ left: '50%', top: '46%', transform: 'translate(-50%, -50%)', animation: 'bkStampPop 1.6s ease-out forwards' }}>
                <div className="px-3 py-1.5 font-pixel" style={{
                  background: 'rgba(220,38,38,0.18)', border: '3px solid #DC2626', borderRadius: 4,
                  fontSize: 14, color: '#7F1D1D', letterSpacing: 4,
                  textShadow: '0 1px 0 rgba(255,255,255,0.6)', boxShadow: '0 0 14px rgba(220,38,38,0.45)',
                  transform: 'rotate(-8deg)',
                }}>
                  SOLD!
                </div>
              </div>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={`coin-${fx.id}-${i}`} className="absolute"
                  style={{ left: '50%', top: '57%', transform: 'translateX(-50%)', animation: `bkCoinFly${i} 1.4s ease-out forwards` }}>
                  <IconCoin size={14} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ HEADER ══ back + coins, floated over the picture's top trim. */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-3"
        style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(74,26,10,0.55)', borderRadius: 6, border: '2px solid rgba(251,191,36,0.6)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-amber-100" />
        </button>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 font-pixel"
          style={{ background: 'rgba(74,26,10,0.6)', border: '2px solid #FBBF24', borderRadius: 4, fontSize: 9, color: '#FDE68A', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <IconCoin size={14} />
          {coins}
        </div>
      </div>

      {/* ══ ORDER BUTTON ══ opens the cake menu sheet. */}
      {!menuOpen && (
        <button onClick={() => { playSound('ui_modal_open'); setMenuOpen(true) }}
          className="absolute left-1/2 -translate-x-1/2 z-30 font-pixel text-white inline-flex items-center gap-2 active:translate-y-[2px] transition-transform"
          style={{
            bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
            background: 'linear-gradient(135deg, #DB2777, #9D174D)',
            border: '2px solid #831843', borderRadius: 5,
            padding: '12px 22px', fontSize: 9, letterSpacing: 2,
            boxShadow: '0 3px 0 rgba(0,0,0,0.35)',
          }}>
          <IconCake size={14} />
          ORDER CAKES
          <IconCake size={14} />
        </button>
      )}

      {/* ══ MENU SHEET ══ slide-up cake grid; tap-out or CLOSE to dismiss. */}
      {menuOpen && (
        <div className="absolute inset-0 z-40" style={{ background: 'rgba(40,20,10,0.45)' }}
          onClick={() => { playSound('ui_modal_close'); setMenuOpen(false) }}>
          <div className="absolute bottom-0 inset-x-0 flex flex-col"
            style={{
              maxHeight: '74%',
              background: 'linear-gradient(180deg, #FFF8F0 0%, #FCE7F3 100%)',
              borderTop: '3px solid #DB2777',
              borderRadius: '14px 14px 0 0',
              boxShadow: '0 -6px 20px rgba(120,53,15,0.4)',
              animation: 'bkSheetUp 0.28s ease-out',
            }}
            onClick={e => e.stopPropagation()}>
            {/* Sheet header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
              <span className="font-pixel inline-flex items-center gap-1.5" style={{ fontSize: 9, color: '#9D174D', letterSpacing: 2 }}>
                <IconStar size={10} />
                TODAY&apos;S MENU
                <IconStar size={10} />
              </span>
              <button onClick={() => { playSound('ui_modal_close'); setMenuOpen(false) }}
                className="font-pixel active:scale-95" style={{ fontSize: 8, color: '#9D174D', letterSpacing: 1 }}>
                CLOSE
              </button>
            </div>

            <div className="overflow-y-auto px-3 pb-5" style={{ scrollbarWidth: 'thin' }}>
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
                          <p className="font-pixel mb-1" style={{ fontSize: 6, color: cake.dark, letterSpacing: 0.6, lineHeight: 1.3, textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}>
                            {cake.name}
                          </p>
                          <p className="text-[10px] mb-1.5" style={{ color: '#7C2D12', opacity: 0.75, lineHeight: 1.25 }}>
                            {cake.blurb}
                          </p>
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 font-pixel"
                            style={{
                              background: canAfford ? 'linear-gradient(180deg, #78350F, #451A03)' : 'rgba(120,53,15,0.3)',
                              border: `1px solid ${canAfford ? '#FBBF24' : 'rgba(120,53,15,0.4)'}`,
                              borderRadius: 3, fontSize: 8, color: canAfford ? '#FDE68A' : '#7C2D12',
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
              <div className="flex items-center justify-center gap-2 mt-4 mb-1">
                <div className="h-[1px] w-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }} />
                <p className="font-pixel" style={{ fontSize: 6, color: '#7C2D12', letterSpacing: 2, opacity: 0.7 }}>
                  EREN BAKES WITH LOVE
                </p>
                <div className="h-[1px] w-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes bkSheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes bkCakeFly {
          0%   { transform: translateX(-50%) translateY(20px) scale(0.5) rotate(-8deg); opacity: 0; }
          18%  { transform: translateX(-50%) translateY(0)    scale(1.1) rotate(0deg);  opacity: 1; }
          35%  { transform: translateX(-50%) translateY(-8px) scale(1.0) rotate(4deg);  opacity: 1; }
          55%  { transform: translateX(-50%) translateY(-4px) scale(1.05) rotate(-2deg); opacity: 1; }
          80%  { transform: translateX(-50%) translateY(-50px) scale(0.85) rotate(8deg); opacity: 0.7; }
          100% { transform: translateX(-50%) translateY(-130px) scale(0.4) rotate(14deg); opacity: 0; }
        }
        @keyframes bkStampPop {
          0%   { transform: translate(-50%, -50%) rotate(-8deg) scale(0); opacity: 0; }
          25%  { transform: translate(-50%, -50%) rotate(-12deg) scale(1.4); opacity: 1; }
          40%  { transform: translate(-50%, -50%) rotate(-8deg) scale(1);   opacity: 1; }
          80%  { transform: translate(-50%, -50%) rotate(-8deg) scale(1);   opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(-8deg) scale(0.85); opacity: 0; }
        }
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
function CakeSprite({ cake, size }: { cake: CakeDef; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="6" y="0" width="1" height="1" fill="#FBBF24" />
      <rect x="6" y="1" width="1" height="1" fill={cake.dark} />
      <rect x="3" y="2" width="6" height="1" fill={cake.main} />
      <rect x="2" y="3" width="8" height="1" fill={cake.main} />
      <rect x="3" y="3" width="2" height="1" fill={cake.light} />
      <rect x="6" y="3" width="2" height="1" fill={cake.light} />
      <rect x="1" y="4" width="10" height="1" fill={cake.dark} />
      <rect x="1" y="5" width="10" height="1" fill="#FDE68A" />
      <rect x="1" y="6" width="10" height="1" fill={cake.dark} />
      <rect x="1" y="7" width="10" height="1" fill="#FDE68A" />
      <rect x="1" y="8" width="10" height="1" fill={cake.dark} />
      <rect x="0" y="9" width="12" height="1" fill="#525252" />
      <rect x="0" y="9" width="12" height="1" fill="#9CA3AF" opacity="0.6" />
      <rect x="3" y="2" width="1" height="1" fill={cake.accent} />
      <rect x="7" y="2" width="1" height="1" fill={cake.accent} />
      <rect x="5" y="3" width="1" height="1" fill={cake.accent} />
    </svg>
  )
}
