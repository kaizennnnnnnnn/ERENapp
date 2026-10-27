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
// Buying lives in Meadow sheets so the picture stays the hero. Two counters
// share them: CAKES (each bought pastry joins your fridge) and DONUTS, which
// sells three real fridge foods
// a day off a rotating case (see lib/donuts.ts) and stocks your pile. The
// controls over the picture are Meadow's white over-art pieces, like the home
// screen's. Currency: player coins via TaskContext.spendCoins().
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useErenStats } from '@/hooks/useErenStats'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'
import type { CakeDef } from '@/lib/cakes'
import { purchaseCakeFood } from '@/lib/cakePurchase'
import { dailyDonuts, msUntilNextBatch, rollDonut, SPIN_COST, type DonutDef } from '@/lib/donuts'
import { foodArt } from '@/lib/foodMeta'
import { todayKey } from '@/lib/seededRng'
import { useDonutMachine } from '@/hooks/useDonutMachine'
import { IconCake, IconDonut } from '@/components/PixelIcons'
import { CoinChip, M, MeadowIcon, RoundButton, TINT } from '@/components/meadow'
import BlinkingEren from '@/components/BlinkingEren'
import CakeMenuSheet from '@/components/bakery/CakeMenuSheet'
import CakeSprite from '@/components/bakery/CakeSprite'
import DonutCasePanel from '@/components/bakery/DonutCasePanel'
import DonutCounterSheet from '@/components/bakery/DonutCounterSheet'
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
interface ShopPic { src: string; w: number; h: number; counterPct: number; top: string; bottom: string }
// counterPct = first row of the counter's lit TOP surface, NOT the
// front-edge seam lower down (that painted Eren over the whole counter
// top so he read as standing in front of it).
// top / bottom = the picture's own first and last rows (the wood trim, the
// pink floor), averaged across the width. A tall phone's empty bands above
// and below the picture are painted these flat, so the picture simply carries
// on to the screen's edges.
const SHOP_DAY:   ShopPic = { src: '/CakeShop.png',      w: 941, h: 1672, counterPct: 58.5, top: '#854514', bottom: '#E29C75' }
const SHOP_NIGHT: ShopPic = { src: '/CakeShopNight.png', w: 941, h: 1672, counterPct: 58.5, top: '#30170A', bottom: '#734431' }
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
  const { stats, addToMyFood, addManyToMyFood, consumeMyFood } = useErenStats(profile?.household_id ?? null)
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
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
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
   * fridge pile. Cakes use their own saved-stock checkout below.
   */
  async function purchase(price: number, sold: SoldItem, food?: DonutDef['id']) {
    if (busy || (sold.kind === 'cake' && !stats)) return
    if (!user?.id) return
    if (coins < price) {
      playSound('ui_modal_open') // soft "no" ping
      return
    }
    setBusy(true)
    setPurchaseError(null)
    playSound('ui_tap')
    // Cakes verify the stock write before charging. Donuts retain their
    // existing parallel writes and payment-failure rollback.
    const ok = sold.kind === 'cake'
      ? await purchaseCakeFood(sold.cake, {
        addFood: key => addManyToMyFood(user.id, [key]),
        spendCoins,
        removeFood: key => consumeMyFood(user.id, key),
      })
      : (await Promise.all([
        spendCoins(price),
        food ? addToMyFood(user.id, food) : Promise.resolve(),
      ]))[0]
    if (!ok) {
      // Cakes already restored their stock. Donuts still need the food
      // rollback after spendCoins restores a failed payment.
      if (food) await consumeMyFood(user.id, food)
      if (sold.kind === 'cake') setPurchaseError('Could not save your purchase. Please try again.')
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

      {/* ══ BANDS ══ the empty bands above and below the picture on a tall
          phone, in the picture's own edge colours. */}
      <div className="absolute top-0 inset-x-0 z-[15] pointer-events-none" style={{ height: bandH, background: pic.top }} />
      <div className="absolute bottom-0 inset-x-0 z-[15] pointer-events-none" style={{ height: bandH, background: pic.bottom }} />

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
          {!spin && (
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
                  ? <CakeSprite cake={fx.sold.cake} size={80} />
                  : <img src={foodArt(fx.sold.donut.id)} alt="" width={56} height={56} draggable={false}
                      style={{ display: 'block', objectFit: 'contain' }} />}
              </div>
              <div key={`stamp-${fx.id}`} className="absolute"
                style={{ left: '50%', top: '46%', transform: 'translate(-50%, -50%)', animation: 'bkStampPop 1.6s ease-out forwards' }}>
                <div className="meadow-root inline-flex items-center" style={{
                  height: 44, padding: '0 18px 0 12px', gap: 8, borderRadius: 999, background: '#FFFFFF',
                  boxShadow: `0 3px 0 ${M.overArtLip}`, fontSize: 20, fontWeight: 800, color: M.leaf,
                  whiteSpace: 'nowrap', transform: 'rotate(-6deg)',
                }}>
                  <MeadowIcon name="check" size={22} color={M.leaf} />
                  Sold!
                </div>
              </div>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={`coin-${fx.id}-${i}`} className="absolute"
                  style={{ left: '50%', top: '57%', transform: 'translateX(-50%)', animation: `bkCoinFly${i} 1.4s ease-out forwards` }}>
                  <MeadowIcon name="coin" size={18} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ HEADER ══ back + coins, floated over the picture's top trim. */}
      <div className="meadow-root absolute top-0 inset-x-0 z-30 flex items-center justify-between"
        style={{ padding: 'calc(10px + env(safe-area-inset-top, 0px)) 16px 0' }}>
        <RoundButton surface="art" ariaLabel="Back" onClick={() => { playSound('ui_back'); requestCloudNav('/home') }}>
          <MeadowIcon name="chevronLeft" color={M.text} />
        </RoundButton>
        <CoinChip amount={coins} surface="art" />
      </div>

      {/* ══ COUNTER BUTTONS ══ the two things Eren sells, side by side over the
          floor: white pills on the art, each with its own tinted disc, so the
          two counters read as two tills rather than a mode switch.
          The row spans the screen and centres its children rather than sitting
          at left:50% — an absolutely-positioned shrink-to-fit box only gets the
          width from its left edge to the parent's right edge, which is half the
          screen, and a label wrapped to two lines inside it. */}
      <div className="meadow-root absolute inset-x-0 z-30 flex justify-center" style={{
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', gap: 12, padding: '0 16px',
      }}>
        <CounterButton label="Cakes" tint={TINT.love} onClick={() => { playSound('ui_modal_open'); setMenuOpen(true) }}>
          <IconCake size={22} />
        </CounterButton>
        <CounterButton label="Donuts" tint={TINT.amber} onClick={() => { playSound('ui_modal_open'); setCaseOpen(true) }}>
          <IconDonut size={22} />
        </CounterButton>
      </div>

      <CakeMenuSheet open={menuOpen} coins={coins} busy={busy || !stats} error={purchaseError}
        onBuy={cake => purchase(cake.price, { kind: 'cake', cake })}
        onClose={() => setMenuOpen(false)} />

      {/* ══ DONUT CASE ══ three donuts, changed every night. Unlike the cakes
          these are real food: buying one puts it in your fridge pile. */}
      <DonutCounterSheet open={caseOpen} donuts={todaysDonuts} coins={coins} busy={busy}
        batchIn={now ? batchCountdown(msUntilNextBatch(now)) : null}
        onBuy={donut => purchase(donut.price, { kind: 'donut', donut }, donut.id)}
        onClose={() => setCaseOpen(false)} />

      {/* ══ MACHINE PANEL ══ the whole case, then the spin. See DonutCasePanel
          for why the grid comes before the button. */}
      <DonutCasePanel
          open={machineOpen && !spin}
          tasted={tastedDonuts}
          coins={coins}
          freeReady={machine.freeReady}
          loaded={machine.loaded}
          busy={busy}
          freeIn={batchCountdown(machine.msUntilFree)}
          onSpin={doSpin}
          onClose={() => setMachineOpen(false)}
        />


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

/** "4h 12m" / "12m". Rounds UP so it never reads 0m with time left. */
function batchCountdown(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`
}

/** A counter's white pill: its icon on a tinted disc, then its name. */
function CounterButton({ label, tint, onClick, children }: {
  label: string; tint: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} className="m-lip m-focus inline-flex items-center" style={{
      '--m-lip': M.overArtLip, '--m-lip-h': '3px',
      height: 56, padding: '0 22px 0 10px', gap: 10, border: 0, borderRadius: 999, background: '#FFFFFF',
      fontFamily: 'inherit', fontSize: 17, fontWeight: 800, color: M.text, cursor: 'pointer', whiteSpace: 'nowrap',
    } as React.CSSProperties}>
      <span aria-hidden className="flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 999, background: tint }}>
        {children}
      </span>
      {label}
    </button>
  )
}
