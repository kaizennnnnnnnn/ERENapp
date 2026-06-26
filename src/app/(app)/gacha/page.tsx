'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useGacha } from '@/hooks/useGacha'
import { useInventory } from '@/hooks/useInventory'
import { useCare } from '@/contexts/CareContext'
import { PULL_COST_SINGLE, PULL_COST_TEN, PITY_EPIC, PITY_LEGENDARY } from '@/lib/gacha'
import type { GachaPullResult, GachaRarity } from '@/types'
import { highestRarity, pickClothesHitVideo } from '@/lib/gachaVideos'
import { getSkin } from '@/lib/skins'
import PullAnimation from '@/components/gacha/PullAnimation'
import GachaEnergyOpening from '@/components/gacha/GachaEnergyOpening'
import StarfallLoader from '@/components/gacha/StarfallLoader'
import GachaPullButton from '@/components/gacha/GachaPullButton'
import { IconCoin, IconSparkles, IconTicket, IconBook } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { requestCloudNav } from '@/components/CloudTransition'
import { PINK_HI, OBSIDIAN_BTN, Rivets, pinkText } from '@/components/obsidian'
import CurtainGlitter from '@/components/CurtainGlitter'

// Three machines, one swipe apart. Page order matches the banner ids in
// GACHA_BANNERS — food first (what the gacha button lands on), animal next,
// FoodSuits third.
const PAGES = [
  { id: 'food', bg: '/gacha_food.png?v=3' },
  // ?v bumps the cache key when the art changes — the SW serves images
  // stale-while-revalidate, so a same-path replace shows the old one first.
  { id: 'animal', bg: '/gacha_animal.png?v=3' },
  // FoodSuits — placeholder reward pool for now (see GACHA_BANNERS). ?v bumps
  // on every art replace so the SW doesn't serve the old image stale.
  { id: 'foodsuits', bg: '/gacha_foodsuits.png?v=2' },
] as const

export default function GachaPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const { coins, stardust, pityEpic, pityLegendary, pulling, pullSingle, pullTen, tickets } = useGacha()
  const { refetch: refetchInv } = useInventory()

  // Hide the persistent StatsHeader on this subpage; restore on unmount.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [pullResults, setPullResults] = useState<GachaPullResult[] | null>(null)
  // The opening cinematic for the current pull: the rainbow video for food, a
  // rarity-tiered hit video for clothes. null = no video playing.
  const [openingVideo, setOpeningVideo] = useState<string | null>(null)
  const [videoReady, setVideoReady] = useState(false) // opening video can render its first frame
  // The FoodSuits machine opens with a CSS energy cinematic instead of a video,
  // so the burst can be tinted by the pulled rarity. energyOn = overlay active;
  // energyRarity stays null until the roll resolves (the shine masks the wait).
  const [energyOn, setEnergyOn] = useState(false)
  const [energyRarity, setEnergyRarity] = useState<GachaRarity | null>(null)
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
  }, [])

  const applyScrollFx = useCallback(() => {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    const x = el.scrollLeft / el.clientWidth
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

  useEffect(() => { applyScrollFx() }, [applyScrollFx])
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current) }, [])

  function onScroll() {
    setLayerHints(true)
    applyScrollFx()
    const el = scrollRef.current
    if (!el) return
    // Drop the layer hints once the swipe settles so resting pages aren't left
    // force-promoted (see setLayerHints). Momentum keeps the timer resetting.
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => setLayerHints(false), 160)
    const idx = Math.min(PAGES.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)))
    if (idx !== pageIdx) {
      // Only on a real swipe. A scroll event isn't a user-activation gesture,
      // so firing audio from initial layout or scroll restoration trips the
      // AudioContext autoplay warning (and the sound wouldn't play anyway).
      // touchedDeck flips on pointerdown, which carries sticky activation.
      if (touchedDeck.current) playSound('ui_swipe_room')
      setPageIdx(idx)
    }
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
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'instant' })
  }

  // Show a video opening from a clean "still buffering" state, so the starfall
  // loader covers the gap until the first frame is decodable.
  const startOpening = useCallback((src: string) => {
    setVideoReady(false)
    setOpeningVideo(src)
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

    // The rainbow opening is generic, so it plays DURING the roll to mask the
    // latency — used by the food machine. The FoodSuits machine opens with the
    // rarity-tinted CSS energy cinematic (its shine phase masks the roll, then
    // the burst colours to the result). Clothes' opening is a rarity-tiered hit
    // video, chosen after the roll resolves (below).
    const usesRainbowOpening = bannerId === 'food'
    const usesEnergyOpening = bannerId === 'foodsuits'
    if (usesRainbowOpening) {
      playSound('gift_open')
      openedWithVideo.current = true
      startOpening('/rainbow_opening.mp4')
    } else if (usesEnergyOpening) {
      openedWithVideo.current = true
      setEnergyRarity(null)
      setEnergyOn(true)
    }

    const results = count === 1
      ? await pullSingle(bannerId, useTicket).then(r => (r ? [r] : null))
      : await pullTen(bannerId)
    if (!results) {
      setOpeningVideo(null)
      setEnergyOn(false)
      return
    }

    // Warm the skin sprites while the opening cinematic plays, so the reveal
    // shows the cat already drawn on its podium instead of popping in after it
    // (SkinPodium also gates on decode; this just pre-fills the cache).
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

    const best = highestRarity(results.map(r => r.item.rarity))
    if (usesEnergyOpening) {
      // Hand the FoodSuits energy cinematic its rarity → it charges and bursts.
      setEnergyRarity(best)
    } else if (bannerId === 'animal') {
      // Clothes: open with the hit cinematic for the best drop in the batch.
      const vid = pickClothesHitVideo(best)
      if (vid) {
        openedWithVideo.current = true
        startOpening(vid)
      }
    }

    setPullResults(results)
  }

  function handlePullDone() {
    setPullResults(null)
    refetchInv()
  }

  return (
    <div className="fixed inset-0" style={{ background: '#050507' }}>

      {/* ── Swipeable machine pages ── */}
      <div ref={scrollRef} onScroll={onScroll} onPointerDown={() => { touchedDeck.current = true }}
        className="relative h-full w-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
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

              {/* Bottom shade so the controls read over the machine base */}
              <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{
                height: 190,
                background: 'linear-gradient(180deg, rgba(5,5,7,0) 0%, rgba(5,5,7,0.78) 70%)',
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
            glitter at every boundary regardless of how many machines there are. */}
        {PAGES.slice(1).map((_, i) => (
          <div key={i} aria-hidden className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{ left: `${(i + 1) * 100}%`, width: 150, transform: 'translateX(-50%)' }}>
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(90deg, transparent, rgba(244,114,182,0.16) 35%, rgba(255,255,255,0.2) 50%, rgba(167,139,250,0.16) 65%, transparent)',
            }} />
            <CurtainGlitter count={40} seed={707070 + i * 131} />
          </div>
        ))}
      </div>

      {/* ── Header overlay ── */}
      <div className="absolute inset-x-0 top-0 px-3" style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => { playSound('ui_back'); requestCloudNav('/home', 'rainbow') }}
            className="flex items-center justify-center active:translate-y-[1px] transition-transform relative"
            style={{ width: 32, height: 32, ...OBSIDIAN_BTN }}>
            <Rivets inset={2} size={2} />
            <ChevronLeft size={16} style={{ color: PINK_HI }} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 px-2 py-1.5 relative" style={OBSIDIAN_BTN}>
            <Rivets inset={2} size={2} />
            <IconCoin size={14} />
            <span className="font-pixel" style={{ fontSize: 8, color: '#F5C842', textShadow: '0 0 3px rgba(245,200,66,0.5)' }}>{coins}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5 relative" style={OBSIDIAN_BTN}>
            <Rivets inset={2} size={2} />
            <span className="gacha-sparkle-icon"><IconSparkles size={14} /></span>
            <span className="font-pixel gacha-stardust-val" style={{ fontSize: 8 }}>{stardust}</span>
          </div>
          {tickets > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 relative" style={OBSIDIAN_BTN}>
              <Rivets inset={2} size={2} />
              <IconTicket size={14} />
              <span className="font-pixel" style={{ fontSize: 8, ...pinkText }}>{tickets}</span>
            </div>
          )}
          <button onClick={() => { playSound('ui_tap'); router.push('/gacha/collection') }}
            className="flex items-center justify-center active:translate-y-[1px] transition-transform relative"
            style={{ width: 32, height: 32, ...OBSIDIAN_BTN }}>
            <Rivets inset={2} size={2} />
            <IconBook size={18} />
          </button>
        </div>

        {/* Page dots */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <div className="flex justify-center gap-2">
            {PAGES.map((p, i) => (
              <button key={p.id} onClick={() => goTo(i)} aria-label={p.id}
                style={{
                  width: 10, height: 10,
                  background: i === pageIdx ? PINK_HI : 'rgba(255,255,255,0.35)',
                  border: '1px solid rgba(5,5,7,0.8)',
                  boxShadow: '1px 1px 0 rgba(5,5,7,0.6)',
                }} />
            ))}
          </div>
          <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', textShadow: '1px 1px 0 rgba(5,5,7,0.8)' }}>SWIPE</span>
        </div>
      </div>

      {/* ── Pull controls (fixed HUD, keyed to the current page) ──
          Rendered OUTSIDE the swipeable deck and its per-page transform/scale
          layers. Inside those layers the candy buttons intermittently failed to
          paint on mobile GPUs — only their animated halos showed, blanking the
          PULL x1 / x10 controls. A single bottom HUD in the root layer always
          paints (and means two buttons exist instead of six). pointer-events
          stay off the surrounding strip so swipes still reach the deck. */}
      <div className="absolute inset-x-0 bottom-0 px-4 z-30 pointer-events-none"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
        <div className="flex justify-center gap-4 mb-2">
          <span className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', textShadow: '0 0 3px rgba(167,139,250,0.5)' }}>EPIC {pityEpic}/{PITY_EPIC}</span>
          <span className="font-pixel" style={{ fontSize: 6, color: '#F5C842', textShadow: '0 0 3px rgba(245,200,66,0.5)' }}>LEGENDARY {pityLegendary}/{PITY_LEGENDARY}</span>
        </div>
        <div className="flex gap-3 pointer-events-auto">
          <GachaPullButton
            variant={PAGES[pageIdx].id === 'animal' ? 'clothes' : 'food'}
            tier="single"
            cost={PULL_COST_SINGLE}
            disabled={pulling || (coins < PULL_COST_SINGLE && tickets <= 0)}
            showTicket={tickets > 0}
            onClick={() => handlePull(1)}
          />
          <GachaPullButton
            variant={PAGES[pageIdx].id === 'animal' ? 'clothes' : 'food'}
            tier="ten"
            cost={PULL_COST_TEN}
            disabled={pulling || coins < PULL_COST_TEN}
            onClick={() => handlePull(10)}
          />
        </div>
      </div>

      {/* ── Opening cinematic (rainbow for food, rarity hit for clothes) ── */}
      {openingVideo && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: '#000' }}
          onClick={() => setOpeningVideo(null)}>
          <video key={openingVideo} src={openingVideo} autoPlay muted playsInline preload="auto"
            className="h-full w-full object-cover"
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            onEnded={() => setOpeningVideo(null)}
            onError={() => setOpeningVideo(null)} />
          {/* Magical sprinkles fill the buffering gap, then dissolve once the
              video has a frame to show. */}
          <div className="absolute inset-0 transition-opacity ease-out" style={{ opacity: videoReady ? 0 : 1, transitionDuration: '450ms' }}>
            <StarfallLoader />
          </div>
          {videoReady && (
            <span className="absolute font-pixel" style={{ fontSize: 6, color: 'rgba(255,255,255,0.45)', bottom: 'calc(var(--safe-bottom) + 18px)' }}>TAP TO SKIP</span>
          )}
        </div>
      )}

      {/* ── FoodSuits energy cinematic (keyhole shine → rarity-tinted burst) ── */}
      {energyOn && <GachaEnergyOpening rarity={energyRarity} onDone={() => setEnergyOn(false)} />}

      {/* ── Reveal ── */}
      {pullResults && !openingVideo && !energyOn && <PullAnimation results={pullResults} onDone={handlePullDone} skipCapsule={openedWithVideo.current} />}

      <style jsx>{`
        .gacha-stardust-val {
          background: linear-gradient(90deg,
            #ff6b6b 0%, #ffb347 16%, #fff700 33%,
            #87ff57 50%, #57c8ff 66%, #c87cff 83%, #ff6b6b 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gachaStardustFlow 2s linear infinite;
        }
        @keyframes gachaStardustFlow {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .gacha-sparkle-icon {
          display: inline-flex;
          align-items: center;
          animation: gachaSparkleHue 2s linear infinite;
        }
        @keyframes gachaSparkleHue {
          0%   { filter: hue-rotate(0deg)   saturate(2) brightness(1.15); }
          100% { filter: hue-rotate(360deg) saturate(2) brightness(1.15); }
        }
      `}</style>
    </div>
  )
}
