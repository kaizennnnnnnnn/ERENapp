'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useGacha } from '@/hooks/useGacha'
import { useInventory } from '@/hooks/useInventory'
import { useCare } from '@/contexts/CareContext'
import { PULL_COST_SINGLE, PULL_COST_TEN, PITY_EPIC, PITY_LEGENDARY } from '@/lib/gacha'
import type { GachaPullResult } from '@/types'
import { highestRarity, pickClothesHitVideo } from '@/lib/gachaVideos'
import PullAnimation from '@/components/gacha/PullAnimation'
import StarfallLoader from '@/components/gacha/StarfallLoader'
import GachaPullButton from '@/components/gacha/GachaPullButton'
import { IconCoin, IconSparkles, IconTicket, IconBook } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { requestCloudNav } from '@/components/CloudTransition'
import { PINK_HI, OBSIDIAN_BTN, Rivets, pinkText } from '@/components/obsidian'
import CurtainGlitter from '@/components/CurtainGlitter'

// Two machines, one swipe apart. Page order matches the banner ids in
// GACHA_BANNERS — food first (what the gacha button lands on), animal right.
const PAGES = [
  { id: 'food', bg: '/gacha_food.png?v=3' },
  // ?v bumps the cache key when the art changes — the SW serves images
  // stale-while-revalidate, so a same-path replace shows the old one first.
  { id: 'animal', bg: '/gacha_animal.png?v=3' },
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
  const openedWithVideo = useRef(false) // a video opened this pull → skip the capsule
  const touchedDeck = useRef(false) // gate swipe SFX to real gestures (see onScroll)

  // Scroll-driven swap effect: the off-center machine recedes (scale), dims,
  // blurs, and its art slides slower than the page (parallax). The blur racks
  // into focus as a page centers. Written imperatively per scroll event — no
  // React re-renders mid-swipe.
  const innerRefs = useRef<(HTMLDivElement | null)[]>([])
  const bgRefs = useRef<(HTMLDivElement | null)[]>([])
  const dimRefs = useRef<(HTMLDivElement | null)[]>([])
  const edgeRefs = useRef<(HTMLDivElement | null)[]>([])

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
      if (bg) {
        bg.style.transform = `translateX(${(p * 6).toFixed(3)}%) scale(1.12)`
        // Crisp when centered, racking up to a soft blur a page away. The
        // bg overscans (scale 1.12) so the blur's fading edge stays offscreen.
        bg.style.filter = a > 0.01 ? `blur(${(a * 12).toFixed(2)}px)` : 'none'
      }
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

  function onScroll() {
    applyScrollFx()
    const el = scrollRef.current
    if (!el) return
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
    // This smooth scroll fires onScroll; clear the gesture flag so it doesn't
    // also play the swipe SFX on top of ui_select. The next real touch re-arms.
    touchedDeck.current = false
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
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
    playSound('ui_tap')
    openedWithVideo.current = false

    // Food's rainbow opening is generic, so it plays DURING the roll to mask
    // the latency. Clothes' opening is rarity-tiered, so it can only be chosen
    // after the roll resolves (below).
    if (bannerId === 'food') {
      playSound('gift_open')
      openedWithVideo.current = true
      startOpening('/rainbow_opening.mp4')
    }

    const results = count === 1
      ? await pullSingle(bannerId).then(r => (r ? [r] : null))
      : await pullTen(bannerId)
    if (!results) {
      setOpeningVideo(null)
      return
    }

    if (bannerId !== 'food') {
      // Clothes: open with the hit cinematic for the best drop in the batch.
      const vid = pickClothesHitVideo(highestRarity(results.map(r => r.item.rarity)))
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
          <section key={p.id} className="relative h-full w-full flex-shrink-0 snap-center overflow-hidden">
            <div ref={el => { innerRefs.current[idx] = el }}
              className="absolute inset-0 will-change-transform"
              style={{ transform: `scale(${idx === pageIdx ? 1 : 0.86})` }}>
              <div ref={el => { bgRefs.current[idx] = el }}
                className="absolute inset-0 will-change-transform"
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

              {/* Pull controls */}
              <div className="absolute inset-x-0 bottom-0 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
                <div className="flex justify-center gap-4 mb-2">
                  <span className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', textShadow: '0 0 3px rgba(167,139,250,0.5)' }}>EPIC {pityEpic}/{PITY_EPIC}</span>
                  <span className="font-pixel" style={{ fontSize: 6, color: '#F5C842', textShadow: '0 0 3px rgba(245,200,66,0.5)' }}>LEGENDARY {pityLegendary}/{PITY_LEGENDARY}</span>
                </div>
                <div className="flex gap-3">
                  <GachaPullButton
                    variant={p.id === 'food' ? 'food' : 'clothes'}
                    tier="single"
                    cost={PULL_COST_SINGLE}
                    disabled={pulling || (coins < PULL_COST_SINGLE && tickets <= 0)}
                    showTicket={coins < PULL_COST_SINGLE && tickets > 0}
                    onClick={() => handlePull(1)}
                  />
                  <GachaPullButton
                    variant={p.id === 'food' ? 'food' : 'clothes'}
                    tier="ten"
                    cost={PULL_COST_TEN}
                    disabled={pulling || coins < PULL_COST_TEN}
                    onClick={() => handlePull(10)}
                  />
                </div>
              </div>
            </div>

            {/* Dim veil — fades the machine out as it leaves center */}
            <div ref={el => { dimRefs.current[idx] = el }}
              className="absolute inset-0 pointer-events-none"
              style={{ background: '#0B0414', opacity: idx === pageIdx ? 0 : 0.6 }} />

            {/* Edge vignette — softens the seam between pages (driven in applyScrollFx) */}
            <div ref={el => { edgeRefs.current[idx] = el }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, rgba(5,5,7,0.85) 0%, rgba(5,5,7,0) 16%, rgba(5,5,7,0) 84%, rgba(5,5,7,0.85) 100%)',
                opacity: idx === pageIdx ? 0 : 1,
              }} />
          </section>
        ))}

        {/* Sparkle curtain at the seam — you swipe through it between machines */}
        <div aria-hidden className="absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{ left: '100%', width: 150, transform: 'translateX(-50%)' }}>
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(90deg, transparent, rgba(244,114,182,0.16) 35%, rgba(255,255,255,0.2) 50%, rgba(167,139,250,0.16) 65%, transparent)',
          }} />
          <CurtainGlitter count={40} seed={707070} />
        </div>
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
            <IconSparkles size={14} />
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

      {/* ── Reveal ── */}
      {pullResults && !openingVideo && <PullAnimation results={pullResults} onDone={handlePullDone} skipCapsule={openedWithVideo.current} />}

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
      `}</style>
    </div>
  )
}
