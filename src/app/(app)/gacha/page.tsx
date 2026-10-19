'use client'

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGacha } from '@/hooks/useGacha'
import { useInventory } from '@/hooks/useInventory'
import { useCare } from '@/contexts/CareContext'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { MONSTA_RAINBOW_ID, MONSTA_GOLD_ID, GACHA_FOOD_GRANT, GACHA_BANNERS } from '@/lib/gacha'
import type { GachaPullResult, GachaRarity } from '@/types'
import { highestRarity, pickClothesHitVideo } from '@/lib/gachaVideos'
import { getSkin } from '@/lib/skins'
import PullAnimation from '@/components/gacha/PullAnimation'
import GachaEnergyOpening from '@/components/gacha/GachaEnergyOpening'
import GachaOddsSheet from '@/components/gacha/GachaOddsSheet'
import GachaFizzOpening from '@/components/gacha/GachaFizzOpening'
import StarfallLoader from '@/components/gacha/StarfallLoader'
import GachaHud from '@/components/gacha/GachaHud'
import TapToSkip from '@/components/gacha/TapToSkip'
import { playSound } from '@/lib/sounds'
import { requestCloudNav } from '@/components/CloudTransition'
import CurtainGlitter from '@/components/CurtainGlitter'

// Three machines, one swipe apart. Page order matches the banner ids in
// GACHA_BANNERS — food first (what the gacha button lands on), animal next,
// FoodSuits third.
// WEBP, not PNG, and deliberately so: all three backdrops are mounted at once,
// each on its own transformed compositor layer, so their decoded size is
// resident the whole time you're on this screen. As PNGs they were 11.4 MB on
// the wire and ~29 MB of bitmap; re-encoded (scripts/backdrop_to_webp.py) they
// are 0.46 MB and ~19 MB, which is what made the swipe smooth. Keep new art in
// webp — a PNG here costs a lot more than its file size suggests.
// ?v bumps the cache key when the art changes: the SW serves images
// stale-while-revalidate, so a same-path replace shows the old one first.
const PAGES = [
  { id: 'food', bg: '/gacha_food.webp?v=1' },
  { id: 'animal', bg: '/gacha_animal.webp?v=1' },
  // FoodSuits — placeholder reward pool for now (see GACHA_BANNERS).
  { id: 'foodsuits', bg: '/gacha_foodsuits.webp?v=1' },
] as const

// The switcher's names, in page order.
const MACHINES = PAGES.map(p => ({ id: p.id, name: GACHA_BANNERS.find(b => b.id === p.id)?.name ?? p.id }))

export default function GachaPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const { coins, stardust, pityEpic, pityLegendary, pulling, pullSingle, pullTen, tickets } = useGacha()
  const { refetch: refetchInv } = useInventory()
  const { user, profile } = useAuth()
  // Singleton context (provider lives in (app)/layout) — no extra realtime
  // channel from consuming it here.
  const { addManyToMyFood } = useErenStats(profile?.household_id ?? null)

  // Hide the persistent StatsHeader on this subpage; restore on unmount.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [showOdds, setShowOdds] = useState(false)
  const [pullResults, setPullResults] = useState<GachaPullResult[] | null>(null)
  // The machine those results came from, so the reveal plays its own sounds.
  const [pullMachine, setPullMachine] = useState<(typeof PAGES)[number]['id']>('food')
  // Video playing over the pull: the rainbow reward video (Rainbow Monsta only)
  // or a rarity-tiered hit video for clothes. null = no video playing.
  const [openingVideo, setOpeningVideo] = useState<string | null>(null)
  const [videoReady, setVideoReady] = useState(false) // opening video can render its first frame
  // Which drawn cinematic is on screen. Each machine has its own so they don't
  // feel like one box in different wallpaper: Snacks pours and fizzes, FoodSuits
  // charges and detonates. Rarity stays null until the roll resolves — the idle
  // phase of either cinematic is what masks that wait.
  const [cinematic, setCinematic] = useState<'fizz' | 'energy' | null>(null)
  const [cinematicRarity, setCinematicRarity] = useState<GachaRarity | null>(null)
  const openedWithVideo = useRef(false) // a video/energy opening this pull → skip the capsule
  const touchedDeck = useRef(false) // gate swipe SFX to real gestures (see onScroll)

  // Scroll-driven swap effect: the off-center machine recedes (scale), dims,
  // and its art slides slower than the page (parallax). Written imperatively
  // per scroll event — no React re-renders mid-swipe.
  const innerRefs = useRef<(HTMLDivElement | null)[]>([])
  const bgRefs = useRef<(HTMLDivElement | null)[]>([])
  const dimRefs = useRef<(HTMLDivElement | null)[]>([])
  const edgeRefs = useRef<(HTMLDivElement | null)[]>([])

  // will-change is a layer hint, not a paint. Holding it on the machine layers
  // at rest force-promotes them to permanent compositor layers — and a forced,
  // static layer inside an actively-scrolled container intermittently fails to
  // repaint on mobile GPUs, blanking the centered machine's pull buttons. So we
  // arm the hint only while a swipe is in flight and drop it once it settles.
  const hintsOn = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setLayerHints = useCallback((on: boolean) => {
    if (hintsOn.current === on) return
    hintsOn.current = on
    const wc = on ? 'transform' : 'auto'
    for (const el of innerRefs.current) if (el) el.style.willChange = wc
    for (const el of bgRefs.current) if (el) el.style.willChange = wc
    // The seam glitter rides the same lifecycle. Eighty particles animating
    // opacity + scale + a blurred box-shadow, forever, INSIDE the container
    // you're scrolling — and parked off-screen at every seam while the deck is
    // settled, so none of it was even visible. `cg-idle` freezes the field the
    // moment the swipe ends; it thaws on the next pointerdown, which is the
    // only time you can see a seam anyway. Toggled on the DOM node rather than
    // through state so it costs zero re-renders of the memoized curtains.
    scrollRef.current?.classList.toggle('cg-idle', !on)
  }, [])
  // Every path that arms the hints goes through this to disarm them, so a tap
  // that never turns into a scroll can't leave the deck permanently promoted.
  // Momentum keeps resetting it via onScroll; the last frame wins.
  const armSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => setLayerHints(false), 160)
  }, [setLayerHints])

  // Page width is read ONCE per resize, never per scroll event. `clientWidth`
  // is a layout read, and the previous event has just written 12 inline styles
  // — so reading it mid-scroll forced a synchronous reflow on every single
  // event. That was jank the FX themselves didn't cost.
  const pageW = useRef(0)
  useEffect(() => {
    const measure = () => { pageW.current = scrollRef.current?.clientWidth ?? 0 }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  const applyScrollFx = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const w = pageW.current || el.clientWidth
    if (!w) return
    const x = el.scrollLeft / w
    PAGES.forEach((_, i) => {
      const p = Math.max(-1, Math.min(1, x - i)) // 0 = centered, ±1 = a full page away
      const a = Math.abs(p)
      const inner = innerRefs.current[i]
      if (inner) inner.style.transform = `scale(${(1 - 0.14 * a).toFixed(4)})`
      const bg = bgRefs.current[i]
      // Parallax only — the off-center art slides slower than the page. The bg
      // overscans (scale 1.12) so the shift never reveals an edge. (No per-frame
      // blur: re-rasterizing a full-screen blur every scroll frame was the swipe
      // jank, and the GPU-memory pressure it created was blanking the buttons.)
      if (bg) bg.style.transform = `translateX(${(p * 6).toFixed(3)}%) scale(1.12)`
      const dim = dimRefs.current[i]
      if (dim) dim.style.opacity = (0.6 * a).toFixed(3)
      // Edge vignette ramps in off-center so the two abutting page edges melt
      // into a soft dark gutter at the seam instead of a hard line. Zero when
      // centered, so the settled machine stays full-bleed.
      const edge = edgeRefs.current[i]
      if (edge) edge.style.opacity = Math.min(1, a * 1.5).toFixed(3)
    })
  }, [])

  const seamCurtains = useMemo(() => PAGES.slice(1).map((_, i) => (
    <div key={i} aria-hidden className="absolute top-0 bottom-0 z-10 pointer-events-none"
      style={{ left: `${(i + 1) * 100}%`, width: 150, transform: 'translateX(-50%)' }}>
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(90deg, transparent, rgba(244,114,182,0.16) 35%, rgba(255,255,255,0.2) 50%, rgba(167,139,250,0.16) 65%, transparent)',
      }} />
      <CurtainGlitter count={40} seed={707070 + i * 131} />
    </div>
  )), [])

  useEffect(() => { applyScrollFx() }, [applyScrollFx])
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    if (fxFrame.current) cancelAnimationFrame(fxFrame.current)
  }, [])

  // Scroll events fire faster than the screen refreshes — on a flick, several
  // per frame. Doing the FX work per EVENT meant repeating a whole pass of
  // style writes that only the last one of each frame could ever be seen. One
  // rAF per frame collapses that to exactly the work the display can show.
  const fxFrame = useRef(0)
  const pageIdxRef = useRef(0)

  function onScroll() {
    setLayerHints(true)
    armSettle()

    if (fxFrame.current) return // this frame's pass is already booked
    fxFrame.current = requestAnimationFrame(() => {
      fxFrame.current = 0
      applyScrollFx()
      const el = scrollRef.current
      if (!el) return
      const w = pageW.current || el.clientWidth
      if (!w) return
      const idx = Math.min(PAGES.length - 1, Math.max(0, Math.round(el.scrollLeft / w)))
      if (idx === pageIdxRef.current) return
      pageIdxRef.current = idx
      // Only on a real swipe. A scroll event isn't a user-activation gesture,
      // so firing audio from initial layout or scroll restoration trips the
      // AudioContext autoplay warning (and the sound wouldn't play anyway).
      // touchedDeck flips on pointerdown, which carries sticky activation.
      if (touchedDeck.current) playSound('ui_swipe_room')
      // The dots and the pull-button variant are the only things that read
      // pageIdx, and neither is worth a blocking render in the middle of a
      // gesture — this used to land a full re-render right at the swipe's
      // midpoint, which is precisely where it was felt. As a transition React
      // may interrupt it to keep the scroll at frame rate.
      startTransition(() => setPageIdx(idx))
    })
  }

  function goTo(idx: number) {
    const el = scrollRef.current
    if (!el) return
    playSound('ui_select')
    // Jump instantly: snap-always (scroll-snap-stop: always, set on each page to
    // stop hard flicks skipping a machine) also blocks a *smooth* programmatic
    // scroll from crossing a snap point, so a far-dot tap would otherwise stall
    // one page short. An instant scroll lands on the target directly.
    // This fires onScroll; clear the gesture flag so it doesn't also play the
    // swipe SFX on top of ui_select. The next real touch re-arms.
    touchedDeck.current = false
    pageIdxRef.current = idx
    setPageIdx(idx)
    el.scrollTo({ left: idx * (pageW.current || el.clientWidth), behavior: 'instant' })
  }

  // ── Rainbow Monsta jackpot ─────────────────────────────────────────────────
  // The rainbow video is the Rainbow Monsta's alone. Every pull opens with the
  // energy cinematic; only a batch containing the rainbow can chases it with
  // the video, so seeing the video *is* the tell that you hit the jackpot.
  //
  // A ref, not state, because the async pull would close over a stale copy.
  // No race to arbitrate: the cinematic holds its idle phase until
  // `cinematicRarity` is set, so its onDone can't land before the roll has
  // resolved and armed this — as long as it stays armed *before* that hand-off.
  const jackpotPending = useRef(false)

  // Show a video opening from a clean "still buffering" state, so the starfall
  // loader covers the gap until the first frame is decodable.
  const startOpening = useCallback((src: string) => {
    setVideoReady(false)
    setOpeningVideo(src)
  }, [])

  // Cinematic finished. On a jackpot this is where the rainbow video takes
  // over; otherwise the reveal follows straight on.
  const endCinematic = useCallback(() => {
    setCinematic(null)
    if (!jackpotPending.current) return
    jackpotPending.current = false
    playSound('gift_open')
    startOpening('/rainbow_opening.mp4')
  }, [startOpening])

  // Single exit for the opening video — it can end by finishing, erroring, or
  // being tapped through, and all three have to clear it the same way.
  const endOpening = useCallback(() => {
    setOpeningVideo(null)
  }, [])

  async function handlePull(count: 1 | 10) {
    if (pulling || openingVideo || pullResults) return
    const bannerId = PAGES[pageIdx].id
    // A single pull spends a free ticket whenever one is held — tickets are
    // earned pulls, so they're used before coins and stay usable at any coin
    // balance. Falls back to coins only once tickets run out. (x10 is always
    // coins.) Mirrors the button's own `showTicket` affordance.
    const useTicket = count === 1 && tickets > 0
    playSound('ui_tap')
    openedWithVideo.current = false

    // Both food machines open with the rarity-tinted energy cinematic: its
    // shine phase masks the roll, then the burst colours to the result. The
    // rainbow video is no longer a generic opener — it belongs to the Rainbow
    // Monsta alone and plays after the cinematic (see endCinematic). Clothes'
    // opening is a rarity-tiered hit video, chosen after the roll (below).
    const drawnOpening = bannerId === 'food' ? 'fizz' : bannerId === 'foodsuits' ? 'energy' : null
    if (drawnOpening) {
      openedWithVideo.current = true
      setCinematicRarity(null)
      setCinematic(drawnOpening)
    }

    const results = count === 1
      ? await pullSingle(bannerId, useTicket).then(r => (r ? [r] : null))
      : await pullTen(bannerId)
    if (!results) {
      endOpening()
      setCinematic(null)
      return
    }

    // Warm the skin sprites while the opening cinematic plays, so the reveal
    // shows the cat already drawn on its stage instead of popping in after it.
    for (const r of results) {
      const sk = r.item.skinId ? getSkin(r.item.skinId) : undefined
      if (!sk) continue
      for (const s of [sk.src, sk.tailSrc]) {
        if (!s) continue
        const im = new Image()
        im.src = s
        im.decode?.().catch(() => {})
      }
    }

    // Drinks also stock the fridge, so a pulled can is somewhere you can feed
    // it from (see GACHA_FOOD_GRANT). One batched write for the whole batch.
    if (user) {
      const foods = results.map(r => GACHA_FOOD_GRANT[r.item.id]).filter(Boolean)
      if (foods.length > 0) addManyToMyFood(user.id, foods)
    }

    const best = highestRarity(results.map(r => r.item.rarity))
    // Arm the jackpot BEFORE handing the cinematic its rarity — that hand-off
    // is what lets the cinematic finish, and endCinematic reads this flag.
    // Both SPECIAL EDITION cans earn the chaser video — a gold pull that ended
    // on the plain fizz would read as the lesser jackpot next to the rainbow.
    jackpotPending.current = results.some(r =>
      r.item.id === MONSTA_RAINBOW_ID || r.item.id === MONSTA_GOLD_ID)
    if (drawnOpening) {
      // Hand the cinematic its rarity → it resolves and bursts.
      setCinematicRarity(best)
    } else if (bannerId === 'animal') {
      // Clothes: open with the hit cinematic for the best drop in the batch.
      const vid = pickClothesHitVideo(best)
      if (vid) {
        openedWithVideo.current = true
        startOpening(vid)
      }
    }

    setPullMachine(bannerId)
    setPullResults(results)
  }

  function handlePullDone() {
    setPullResults(null)
    refetchInv()
  }

  return (
    <div className="fixed inset-0" style={{ background: '#050507' }}>

      {/* ── Swipeable machine pages ── */}
      {/* Layer hints go up on TOUCH-DOWN, not on the first scroll event: the
          compositor needs a beat to promote these layers, and arming them once
          the finger is already moving spent that beat on the opening frame of
          the swipe — the one you feel most. */}
      <div ref={scrollRef} onScroll={onScroll}
        onPointerDown={() => { touchedDeck.current = true; setLayerHints(true) }}
        onPointerUp={armSettle} onPointerCancel={armSettle}
        className="cg-idle relative h-full w-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}>
        {PAGES.map((p, idx) => (
          <section key={p.id} className="relative h-full w-full flex-shrink-0 snap-center snap-always overflow-hidden">
            {/* snap-always = scroll-snap-stop: always — a hard flick can't fly
                past a page; the scroll must settle on each machine in turn, so
                you always step 1 → 2 → 3 instead of skipping straight to 3. */}
            {/* applyScrollFx is the SOLE writer of the scroll-FX styles below
                (transform here, dim/edge opacity further down). The inline
                values are keyed off the constant `idx` — never the reactive
                `pageIdx` — so a mid-swipe re-render (setPageIdx firing at the
                page midpoint) can't clobber the live imperative scale. That
                clobber used to leave the centered page shrunk/clipped (the
                pull button "vanished") and, by mutating a snap-container child
                mid-gesture, made iOS `mandatory` snap re-resolve to the first
                page (the swipe-back "teleport"). idx===0 is the at-load
                centered page, so the first paint matches applyScrollFx(). */}
            <div ref={el => { innerRefs.current[idx] = el }}
              className="absolute inset-0"
              style={{ transform: `scale(${idx === 0 ? 1 : 0.86})` }}>
              <div ref={el => { bgRefs.current[idx] = el }}
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${p.bg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transform: 'scale(1.12)',
                }} />
            </div>

            {/* Dim veil — fades the machine out as it leaves center */}
            <div ref={el => { dimRefs.current[idx] = el }}
              className="absolute inset-0 pointer-events-none"
              style={{ background: '#0B0414', opacity: idx === 0 ? 0 : 0.6 }} />

            {/* Edge vignette — softens the seam between pages (driven in applyScrollFx) */}
            <div ref={el => { edgeRefs.current[idx] = el }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, rgba(5,5,7,0.85) 0%, rgba(5,5,7,0) 16%, rgba(5,5,7,0) 84%, rgba(5,5,7,0.85) 100%)',
                opacity: idx === 0 ? 0 : 1,
              }} />
          </section>
        ))}

        {/* Sparkle curtains — one per seam between machines, so you swipe through
            glitter at every boundary regardless of how many machines there are.
            Memoized: this is eighty-odd sparkle nodes of purely static markup,
            and without it every pageIdx change re-reconciled the lot mid-swipe. */}
        {seamCurtains}
      </div>

      {/* ── Controls ──
          Rendered OUTSIDE the swipeable deck and its per-page transform/scale
          layers. Inside those layers the pull buttons intermittently failed to
          paint on mobile GPUs, blanking them. The root layer always paints, and
          the HUD lets swipes through wherever there's no control. */}
      <GachaHud
        machines={MACHINES}
        index={pageIdx}
        onGo={goTo}
        coins={coins}
        stardust={stardust}
        tickets={tickets}
        pityEpic={pityEpic}
        pityLegendary={pityLegendary}
        pulling={pulling}
        onBack={() => { playSound('ui_back'); requestCloudNav('/home', 'rainbow') }}
        onCollection={() => { playSound('ui_tap'); router.push('/gacha/collection') }}
        onOdds={() => { playSound('ui_modal_open'); setShowOdds(true) }}
        onPull={handlePull}
      />

      {/* ── Opening cinematic (rainbow for food, rarity hit for clothes) ── */}
      {openingVideo && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: '#000' }}
          onClick={endOpening}>
          <video key={openingVideo} src={openingVideo} autoPlay muted playsInline preload="auto"
            className="h-full w-full object-cover"
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            onEnded={endOpening}
            onError={endOpening} />
          {/* Magical sprinkles fill the buffering gap, then dissolve once the
              video has a frame to show. */}
          <div className="absolute inset-0 transition-opacity ease-out" style={{ opacity: videoReady ? 0 : 1, transitionDuration: '450ms' }}>
            <StarfallLoader />
          </div>
          {videoReady && <TapToSkip />}
        </div>
      )}

      {/* ── FoodSuits energy cinematic (keyhole shine → rarity-tinted burst) ── */}
      {cinematic === 'fizz'   && <GachaFizzOpening   rarity={cinematicRarity} onDone={endCinematic} />}
      {cinematic === 'energy' && <GachaEnergyOpening rarity={cinematicRarity} onDone={endCinematic} />}

      {/* ── Reveal ── */}
      {pullResults && !openingVideo && !cinematic && <PullAnimation results={pullResults} onDone={handlePullDone} skipCapsule={openedWithVideo.current} machine={pullMachine} />}

      {/* ── Drop rates. The sheet's backdrop swallows taps: handlePull only
             guards on pulling/video/results, so without one a miss would spend
             50 coins. */}
      <GachaOddsSheet
        open={showOdds}
        bannerId={PAGES[pageIdx].id}
        bannerName={MACHINES[pageIdx].name}
        onClose={() => setShowOdds(false)}
      />

    </div>
  )
}
