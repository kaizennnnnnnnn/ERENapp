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
// Buying lives in slide-up sheets so the picture stays the hero. Two counters
// share them: ORDER CAKES (flavour only — the cake flies up, a "SOLD!" stamp
// pops, coins burst, nothing is kept) and DONUTS, which sells three real fridge
// foods a day off a rotating case (see lib/donuts.ts) and stocks your pile.
// Currency: player coins via TaskContext.spendCoins().
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useErenStats } from '@/hooks/useErenStats'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'
import { CAKES, type CakeDef } from '@/lib/cakes'
import { dailyDonuts, msUntilNextBatch, rollDonut, SPIN_COST, TASTE_JOY, type DonutDef } from '@/lib/donuts'
import { foodArt } from '@/lib/foodMeta'
import { todayKey } from '@/lib/seededRng'
import { useDonutMachine } from '@/hooks/useDonutMachine'
import { IconCoin, IconStar, IconCake, IconDonut } from '@/components/PixelIcons'
import BlinkingEren from '@/components/BlinkingEren'
import DonutCasePanel from '@/components/bakery/DonutCasePanel'
import DonutMachine from '@/components/bakery/DonutMachine'
import DonutSpin from '@/components/bakery/DonutSpin'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import { requestCloudNav } from '@/components/CloudTransition'

/** What just went over the counter — decides what the fly-up animation shows. */
type SoldItem =
  | { kind: 'cake';  cake:  CakeDef }
  | { kind: 'donut'; donut: DonutDef }

interface PurchaseFx {
  id:   number
  sold: SoldItem
}

// ErenCakeShop.png pose: pink baker hat with strawberry. Coords from a
// pixel-scan of the 963×1536 sprite, translated to the 360×360 container
// the bakery renders at (portrait sprite height-fits so the image
// occupies the middle ~62.7% of container width).
// The two eyes are exact horizontal mirrors of each other (the right eye
// was re-mirrored from the left in the PNG — see scripts/fix_cake_eye_
// symmetry.py — so the dark pupil reads the same on both sides, which the
// night sepia filter used to exaggerate on the right). Catchlights:
//   eye A (cat's right, viewer's left) — upper-RIGHT of its iris
//   eye B (cat's left, viewer's right) — upper-LEFT of its iris (mirror)
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
  // Exact mirror of A within its mask: center 68.7% → 31.3%, same top.
  glintLeftB: '22.3%',
  glintTopB:  '1.6%',
  glintW:     '18%',
}

// Per-picture metadata, measured from the actual PNG bytes with a
// column-scan for the wall → dark-seam → wood transition (see
// scripts/measure_bakery_night2.py). The current night art is a night-lit
// repaint of the day composition — same 941×1672 canvas, counter top at
// the same row (day: seam 58.37%, wood 58.49%; night: seam 58.31%, wood
// 58.43%) — but keep the per-picture struct so a future repaint with
// different geometry only needs new numbers here.
interface ShopPic { src: string; w: number; h: number; counterPct: number }
// counterPct = first row of the counter's lit TOP surface, NOT the
// front-edge seam lower down (that painted Eren over the whole counter
// top so he read as standing in front of it).
const SHOP_DAY:   ShopPic = { src: '/CakeShop.png',      w: 941, h: 1672, counterPct: 58.5 }
const SHOP_NIGHT: ShopPic = { src: '/CakeShopNight.png', w: 941, h: 1672, counterPct: 58.5 }
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
  const { user, profile } = useAuth()
  const { coins, spendCoins } = useTasks()
  const { stats, addToMyFood, consumeMyFood } = useErenStats(profile?.household_id ?? null)
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
  const [caseOpen, setCaseOpen] = useState(false)
  const fxIdRef = useRef(0)

  // The donut case is clock-derived, so it stays unresolved until the sheet is
  // actually opened — which is necessarily after mount. Computing a day key
  // during the first render would read UTC on the server and local time on the
  // phone, and hydrate a different three donuts than it rendered.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    if (!caseOpen) return
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [caseOpen])
  const dayKey = now ? todayKey(now) : null
  const todaysDonuts = useMemo(() => dayKey ? dailyDonuts(dayKey) : [], [dayKey])

  // ── The machine ────────────────────────────────────────────────────────
  const machine = useDonutMachine(user?.id)
  // Tapping the machine opens this first. A tap that immediately took 50 coins
  // would be a trap on a thing that sits in the middle of the room.
  const [machineOpen, setMachineOpen] = useState(false)
  const [spin, setSpin] = useState<{ won: DonutDef; wasFree: boolean } | null>(null)
  const canPaySpin = coins >= SPIN_COST
  // Which donuts Eren has actually eaten — household-wide, so the partner
  // filling in the case fills in yours too. Memoised because the panel takes it
  // as a Set and rebuilding one per render would churn its props.
  const tastedDonuts = useMemo(
    () => new Set(stats?.donuts_tasted ?? []),
    [stats?.donuts_tasted])

  // The panel counts down to the next free spin, so it needs the same ticking
  // clock the donut case uses — and for the same reason, only once it's open.
  useEffect(() => {
    if (!machineOpen) return
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [machineOpen])

  /**
   * Free spin first, always — nobody wants to discover afterwards that they
   * paid 50 for the one that was going to be free. Grants the donut up front
   * so the reel is watching a purchase that already happened, not a promise.
   */
  async function doSpin() {
    // `loaded` matters as much as `busy`: until the cooldown read lands,
    // freeReady is false, and spinning on that would charge for a free spin.
    if (busy || !user?.id || !machine.loaded) return
    const usingFree = machine.freeReady
    if (!usingFree && !canPaySpin) {
      playSound('ui_modal_open') // soft "no" ping
      return
    }
    setBusy(true)
    playSound(usingFree ? 'ui_tap' : 'coin_ching')
    setMenuOpen(false)
    setCaseOpen(false)
    setMachineOpen(false)

    const won = rollDonut()
    const [ok] = await Promise.all([
      usingFree ? Promise.resolve(true) : spendCoins(SPIN_COST),
      addToMyFood(user.id, won.id),
    ])
    if (!ok) {
      await consumeMyFood(user.id, won.id)
      setBusy(false)
      return
    }
    if (usingFree) await machine.consumeFreeSpin()
    setSpin({ won, wasFree: usingFree })
    setBusy(false)
  }

  /**
   * One counter, one till. `food` is what the purchase puts in the buyer's
   * fridge pile — cakes pass none, so they stay the flavour they've always been.
   */
  async function purchase(price: number, sold: SoldItem, food?: DonutDef['id']) {
    if (busy) return
    if (!user?.id) return
    if (coins < price) {
      playSound('ui_modal_open') // soft "no" ping
      return
    }
    setBusy(true)
    playSound('ui_tap')
    // Both writes hit different tables with no ordering between them, and each
    // updates locally the moment it's called — same reasoning as the kitchen's
    // handleBuy, so the fridge fills on tap instead of after two round trips.
    const [ok] = await Promise.all([
      spendCoins(price),
      food ? addToMyFood(user.id, food) : Promise.resolve(),
    ])
    if (!ok) {
      // Pre-checked above, so this is a failed write, not a poor cat owner —
      // spendCoins already rolled the balance back and the stock has to follow.
      if (food) await consumeMyFood(user.id, food)
      setBusy(false)
      return
    }
    setMenuOpen(false)
    setCaseOpen(false)
    const id = ++fxIdRef.current
    setFx({ id, sold })
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
                {/* Night dim tuned between BlinkingEren's default
                    (brightness(0.7) — too dark, fur goes gray) and the old
                    0.93 (too bright — he popped out of the dim room like a
                    sticker). 0.8 + warm sepia sits him in the room's dusk
                    while the pendant-lamp pool over his head keeps him warm.
                    Picked against rendered candidates — see
                    scripts/preview_bakery_night_dim.py. Day inherits no
                    filter as usual. */}
                <BlinkingEren
                  size={`${EREN_VW}cqi`}
                  src="/ErenCakeShop.png"
                  eyes={CAKE_EYES}
                  style={isDark ? { filter: 'brightness(0.8) saturate(0.9) sepia(0.1)' } : undefined}
                />
              </ErenIdleLayer>
            </div>
          </div>

          {/* ══ DONUT MACHINE ══ stands ON the counter, left of Eren and clear
              of the painted cash register. Sized and placed in cqi/% of the
              PICTURE, not the viewport, so it stays glued to the counter on
              every aspect — the same reason Eren is. Its base sits a touch
              below the counter's top edge (58.5%) so it rests on the wood
              instead of hovering over the front face. */}
          {!menuOpen && !caseOpen && !spin && (
            <div className="absolute" style={{
              left: '17%', bottom: '40.5%', width: '19cqi', aspectRatio: '48 / 64',
              zIndex: 11, pointerEvents: 'auto',
            }}>
              <DonutMachine
                free={machine.freeReady}
                busy={busy}
                onTap={() => { playSound('ui_modal_open'); setMachineOpen(true) }}
              />
            </div>
          )}

          {/* ══ SELL ANIMATION ══ rises from Eren just above the counter. */}
          {fx && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
              <div key={fx.id} className="absolute"
                style={{ left: '50%', top: '56%', transform: 'translateX(-50%)', animation: 'bkCakeFly 1.6s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                {fx.sold.kind === 'cake'
                  ? <CakeSprite cake={fx.sold.cake} size={56} />
                  : <img src={foodArt(fx.sold.donut.id)} alt="" width={56} height={56} draggable={false}
                      style={{ display: 'block', objectFit: 'contain' }} />}
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
        <button onClick={() => { playSound('ui_back'); requestCloudNav('/home') }}
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

      {/* ══ COUNTER BUTTONS ══ the two things Eren sells. Cakes keep the wide
          pink pill they've always had; the donut case sits beside it in its own
          amber, so the new counter reads as a second till rather than a mode
          switch on the first one.
          The row spans the screen and centres its children rather than sitting
          at left:50% — an absolutely-positioned shrink-to-fit box only gets the
          width from its left edge to the parent's right edge, which is half the
          screen, and ORDER CAKES wrapped to two lines inside it. */}
      {!menuOpen && !caseOpen && (
        <div className="absolute inset-x-0 z-30 flex items-stretch justify-center gap-2 px-3"
          style={{ bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={() => { playSound('ui_modal_open'); setMenuOpen(true) }}
            className="font-pixel text-white inline-flex items-center gap-2 active:translate-y-[2px] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #DB2777, #9D174D)',
              border: '2px solid #831843', borderRadius: 5,
              padding: '12px 14px', fontSize: 9, letterSpacing: 1.5,
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 0 rgba(0,0,0,0.35)',
            }}>
            <IconCake size={14} />
            ORDER CAKES
          </button>
          <button onClick={() => { playSound('ui_modal_open'); setCaseOpen(true) }}
            className="font-pixel text-white inline-flex items-center gap-2 active:translate-y-[2px] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #B45309)',
              border: '2px solid #78350F', borderRadius: 5,
              padding: '12px 14px', fontSize: 9, letterSpacing: 1.5,
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 0 rgba(0,0,0,0.35)',
            }}>
            <IconDonut size={14} />
            DONUTS
          </button>
        </div>
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
                      onClick={() => purchase(cake.price, { kind: 'cake', cake })}
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

      {/* ══ DONUT CASE ══ three donuts, changed every night. Unlike the cakes
          these are real food: buying one puts it in your fridge pile, so the
          card leads with the art and states what it does to Eren. */}
      {caseOpen && (
        <div className="absolute inset-0 z-40" style={{ background: 'rgba(40,20,10,0.45)' }}
          onClick={() => { playSound('ui_modal_close'); setCaseOpen(false) }}>
          <div className="absolute bottom-0 inset-x-0 flex flex-col"
            style={{
              maxHeight: '74%',
              background: 'linear-gradient(180deg, #FFF8EC 0%, #FDE8C8 100%)',
              borderTop: '3px solid #B45309',
              borderRadius: '14px 14px 0 0',
              boxShadow: '0 -6px 20px rgba(120,53,15,0.4)',
              animation: 'bkSheetUp 0.28s ease-out',
            }}
            onClick={e => e.stopPropagation()}>
            {/* Sheet header — the same dark-wood-and-brass bar the machine's
                case panel wears, so the bakery's two counters read as one
                shop rather than two unrelated menus. */}
            <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
              style={{
                background: 'linear-gradient(180deg, #6B3A18 0%, #48250E 100%)',
                borderBottom: '2px solid #2E1404',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
              }}>
              <span className="font-pixel inline-flex items-center gap-1.5" style={{ fontSize: 9, color: '#FBBF24', letterSpacing: 2, textShadow: '0 1px 0 rgba(0,0,0,0.5)' }}>
                <IconDonut size={11} />
                FRESH TODAY
              </span>
              <button onClick={() => { playSound('ui_modal_close'); setCaseOpen(false) }}
                className="font-pixel active:scale-95" style={{ fontSize: 8, color: '#F0C892', letterSpacing: 1 }}>
                CLOSE
              </button>
            </div>

            {/* The whole point of the counter: it is not the same three
                tomorrow. Says so, with the time left on it — on a brass ticket,
                because it's the one line here that expires. */}
            <div className="mx-3 mt-3 mb-2 px-2.5 py-2 flex items-center justify-center gap-2 flex-shrink-0"
              style={{
                background: 'linear-gradient(180deg, #3A1B02 0%, #241004 100%)',
                border: '2px solid #B45309', borderRadius: 5,
                boxShadow: 'inset 0 1px 0 rgba(251,191,36,0.35), 2px 2px 0 rgba(120,53,15,0.35)',
              }}>
              <IconStar size={9} />
              <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1.2 }}>
                {now ? `NEW BATCH IN ${batchCountdown(msUntilNextBatch(now))}` : 'BAKING…'}
              </span>
              <IconStar size={9} />
            </div>

            <div className="overflow-y-auto px-3 pb-5" style={{ scrollbarWidth: 'thin' }}>
              <div className="flex flex-col gap-2">
                {todaysDonuts.map(donut => {
                  const canAfford = coins >= donut.price
                  return (
                    <button key={donut.id}
                      onClick={() => purchase(donut.price, { kind: 'donut', donut }, donut.id)}
                      disabled={!canAfford || busy}
                      className="relative flex items-center gap-3 p-2.5 text-left active:translate-y-[1px] transition-transform overflow-hidden"
                      style={{
                        background: canAfford
                          ? 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,247,229,0.85) 100%)'
                          : 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(253,232,200,0.4) 100%)',
                        border: `2px solid ${canAfford ? '#B45309' : 'rgba(120,53,15,0.3)'}`,
                        borderRadius: 6,
                        boxShadow: canAfford
                          ? `3px 3px 0 #78350F, inset 0 1px 0 rgba(255,255,255,0.65), 0 0 10px ${donut.color}40`
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
                      {/* Art straight on the card — a tinted plate behind it
                          would be a second shape competing with the donut, the
                          same call the kitchen shop cards make. It gets a
                          contact shadow instead, so it sits on the card. */}
                      <img src={foodArt(donut.id)} alt="" width={64} height={64} draggable={false}
                        className="flex-shrink-0"
                        style={{
                          width: 64, height: 64, objectFit: 'contain', display: 'block',
                          filter: canAfford ? 'drop-shadow(0 3px 2px rgba(120,53,15,0.32))' : 'none',
                        }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-pixel mb-1" style={{ fontSize: 7, color: '#78350F', letterSpacing: 0.6, lineHeight: 1.3, textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}>
                          {donut.name.toUpperCase()}
                        </p>
                        <p className="text-[10px] mb-1.5" style={{ color: '#7C2D12', opacity: 0.75, lineHeight: 1.25 }}>
                          {donut.desc}
                        </p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-pixel" style={{ fontSize: 6, padding: '3px 5px', borderRadius: 4, background: '#FFE3C4', color: '#B4622A', border: '1px solid #F0B884' }}>HGR+{donut.hungerD}</span>
                          {/* The joy he ACTUALLY gets: the feeding path scales it
                              by taste, so the raw catalogue number would be wrong
                              on every donut he loves or won't touch. */}
                          <span className="font-pixel" style={{ fontSize: 6, padding: '3px 5px', borderRadius: 4, background: '#FFDCE8', color: '#C0407A', border: '1px solid #F5A8C4' }}>
                            JOY+{Math.round(donut.happyD * TASTE_JOY[donut.taste])}
                          </span>
                          {/* What it DOES — the reason one donut is worth more
                              than another was on every other donut surface but
                              this one, which is the one you buy from. */}
                          <span className="font-pixel" style={{ fontSize: 6, padding: '3px 5px', borderRadius: 4, background: '#E4F5DC', color: '#3E7A33', border: '1px solid #A8D598' }}>
                            {donut.perk.label}
                          </span>
                        </div>
                      </div>
                      {/* Price as a pressable-looking plate on the right rather
                          than a fourth chip in the pile: the whole row is the
                          buy button, and nothing on it said so. */}
                      <span className="flex-shrink-0 inline-flex flex-col items-center justify-center gap-0.5 font-pixel"
                        style={{
                          padding: '7px 8px', minWidth: 46,
                          background: canAfford
                            ? 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 46%, #B45309 100%)'
                            : 'rgba(120,53,15,0.22)',
                          border: `2px solid ${canAfford ? '#7C2D12' : 'rgba(120,53,15,0.4)'}`,
                          borderRadius: 5,
                          boxShadow: canAfford ? '0 2px 0 #5A2408, inset 0 1px 0 rgba(255,255,255,0.5)' : 'none',
                        }}>
                        <span className="inline-flex items-center gap-1" style={{ fontSize: 9, color: canAfford ? '#3A1B02' : '#7C2D12' }}>
                          <IconCoin size={10} />{donut.price}
                        </span>
                        <span style={{ fontSize: 5, letterSpacing: 0.8, color: canAfford ? '#5A2408' : '#7C2D12', opacity: 0.85 }}>
                          {canAfford ? 'BUY' : 'BROKE'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-center gap-2 mt-4 mb-1">
                <div className="h-[1px] w-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }} />
                <p className="font-pixel" style={{ fontSize: 6, color: '#7C2D12', letterSpacing: 2, opacity: 0.7 }}>
                  STRAIGHT TO YOUR FRIDGE
                </p>
                <div className="h-[1px] w-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MACHINE PANEL ══ the whole case, then the spin. See DonutCasePanel
          for why the grid comes before the button. */}
      {machineOpen && !spin && (
        <DonutCasePanel
          tasted={tastedDonuts}
          coins={coins}
          freeReady={machine.freeReady}
          loaded={machine.loaded}
          busy={busy}
          freeIn={batchCountdown(machine.msUntilFree)}
          onSpin={doSpin}
          onClose={() => setMachineOpen(false)}
        />
      )}


      {/* ══ SPIN ══ the reel, then the reveal. The donut is already banked by
          the time this mounts; this is the telling, not the deciding. */}
      {spin && (
        <DonutSpin
          key={spin.won.id + String(coins)}
          won={spin.won}
          wasFree={spin.wasFree}
          spinAgainCost={machine.freeReady ? 'free' : SPIN_COST}
          onClose={() => setSpin(null)}
          onSpinAgain={machine.freeReady || canPaySpin
            ? () => { setSpin(null); doSpin() }
            : undefined}
        />
      )}

      <style jsx global>{`
        @keyframes bkCardPop {
          from { transform: scale(0.88); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
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

/** "4H 12M" / "12M". Rounds UP so the strip never reads 0M with time left. */
function batchCountdown(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}H ${mins % 60}M` : `${mins}M`
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
