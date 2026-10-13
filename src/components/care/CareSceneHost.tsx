'use client'

import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useCare, type CareScene } from '@/contexts/CareContext'
import { useErenStats } from '@/hooks/useErenStats'
import { resolveRoomSkin } from '@/lib/skins'
import { ROOM_ART_DAY, ROOM_ART_DARK } from '@/lib/roomArt'
import { foodDrag } from './foodDragFlag'
import AnimatedEren from '@/components/AnimatedEren'
import { playSound } from '@/lib/sounds'
import { useIsDark } from '@/hooks/useIsDark'
import CurtainGlitter from '@/components/CurtainGlitter'
import { ROOM_HEADER_CLEARANCE } from '@/components/meadow/tokens'
import { M, PrimaryButton, TextButton, FONT_ROUNDED } from '@/components/meadow'

// Scenes are lazy chunks instead of static imports so the ~560 KB of room
// code stays out of the shared (app) layout bundle every route parses.
type SceneProps = { onClose: () => void }
const SCENE_LOADERS: Record<CareScene, () => Promise<{ default: React.ComponentType<SceneProps> }>> = {
  feed:      () => import('./FeedScene'),
  play:      () => import('./PlayScene'),
  sleep:     () => import('./SleepScene'),
  wash:      () => import('./WashScene'),
  chemistry: () => import('./ChemistryScene'),
  vet:       () => import('./VetScene'),
  garden:    () => import('./GardenScene'),
  talk:      () => import('./TalkScene'),
  hospital:  () => import('./HospitalScene'),
}
// Module-level cache: populated before `ready` flips, so the render below
// never sees a missing component (no Suspense, no fallback flash).
const sceneComponents: Partial<Record<CareScene, React.ComponentType<SceneProps>>> = {}
const loadScene = (s: CareScene) => SCENE_LOADERS[s]().then(m => { sceneComponents[s] = m.default })

const LOOP_SCENES: CareScene[] = ['feed', 'play', 'sleep', 'wash', 'chemistry', 'vet', 'garden', 'talk']

const SCENE_LABELS: Record<CareScene, string> = {
  feed:      'Kitchen',
  play:      'Playroom',
  sleep:     'Bedroom',
  wash:      'Bathroom',
  chemistry: 'Chemistry Lab',
  vet:       'Vet Office',
  garden:    'The Garden',
  talk:      'The Attic',
  hospital:  'Vet Clinic',
}

const SCENE_COLORS: Record<CareScene, string> = {
  feed:      '#F5C842',
  play:      '#FF6B9D',
  sleep:     '#818CF8',
  wash:      '#38BDF8',
  chemistry: '#84CC16',
  vet:       '#34D399',
  garden:    '#8DBF8E',
  talk:      '#D8B4FE',
  hospital:  '#F87171',
}

// The Eren sprite each scene actually paints. Themed scenes use their own
// PNG (kitchen → ErenCook, vet → ErenVet, …); rooms that still use the
// universal sprite list `/erenGood.png`. Preloading these alongside the
// background prevents the half-second pop-in when the scene mounts and
// the <img> fetches fresh from network.
const SCENE_EREN_SPRITES: Partial<Record<CareScene, string[]>> = {
  feed:      ['/ErenCook_notail.png',         '/ErenCook_tail.png'],
  play:      ['/ErenBell_notail.png',         '/ErenBell_tail.png'],
  sleep:     ['/erenSleep_notail.png',        '/erenSleep_tail.png'],
  wash:      ['/ErenBathroomHat_notail.png',  '/ErenBathroomHat_tail.png'],
  chemistry: ['/ErenLab_notail.png',          '/ErenLab_tail.png'],
  vet:       ['/ErenVet_notail.png',          '/ErenVet_tail.png'],
  garden:    ['/erenGood_notail.png',         '/erenGood_tail.png'],
  talk:      ['/erenGood_notail.png',         '/erenGood_tail.png'],
}

// Props a scene paints that aren't Eren. Unlike SCENE_EREN_SPRITES these are
// always loaded — a Closet skin replaces the cat, not the furniture.
const SCENE_PROPS: Partial<Record<CareScene, string[]>> = {
  talk: ['/donut.png'],
}

export default function CareSceneHost() {
  const { activeScene, openScene, closeScene } = useCare()
  const isDark = useIsDark()
  const { stats } = useErenStats()
  // The idle Eren the active room will actually paint: a Closet skin (its
  // cache-busted ?v= URLs) or the room's built-in default. BlinkingEren
  // decode-gates itself, so without preloading the SKIN here the room reveals
  // and the skinned Eren pops in a beat later — SCENE_EREN_SPRITES only covers
  // the defaults. Stable ref per skin id, so it's safe in the effect deps.
  const roomSkin = activeScene ? resolveRoomSkin(stats?.room_skins, activeScene) : null

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const isDragging = useRef(false)
  const sceneContainerRef = useRef<HTMLDivElement>(null)

  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animKey,  setAnimKey]  = useState(0)
  const [ready,    setReady]    = useState(false)
  const [loadError, setLoadError] = useState(false)
  // Bumps when the offline-panel retry button is tapped, forcing the image
  // load effect to re-run without changing activeScene/isDark.
  const [retryNonce, setRetryNonce] = useState(0)
  const [dragX,    setDragX]    = useState(0)
  const prevSceneRef = useRef<string | null>(null)

  // Room-name label visibility — only show during swipes / scene changes,
  // not while the user is just standing in a room. flashLabel() pops it
  // open and starts a 1.4-s timer to fade it back out.
  const [labelVisible, setLabelVisible] = useState(false)
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashLabel = () => {
    setLabelVisible(true)
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current)
    labelTimerRef.current = setTimeout(() => setLabelVisible(false), 1400)
  }
  useEffect(() => () => { if (labelTimerRef.current) clearTimeout(labelTimerRef.current) }, [])

  const loopIdx = LOOP_SCENES.indexOf(activeScene as CareScene)

  useLayoutEffect(() => {
    setReady(false)
    setLoadError(false)
  }, [activeScene])

  const reloadScene = useCallback(() => {
    setLoadError(false)
    setReady(false)
    setRetryNonce(n => n + 1)
  }, [])

  useEffect(() => {
    if (!activeScene) return
    const bgSrc = (isDark ? ROOM_ART_DARK : ROOM_ART_DAY)[activeScene]
    const sprites = roomSkin
      ? [roomSkin.src, roomSkin.tailSrc].filter(Boolean) as string[]
      : (SCENE_EREN_SPRITES[activeScene] ?? ['/erenGood.png'])
    const toLoad = [...sprites, ...(SCENE_PROPS[activeScene] ?? []), ...(bgSrc ? [bgSrc] : [])]
    const isFirstEntry = prevSceneRef.current === null
    let cancelled = false

    // img.decode() returns a promise that resolves only when the image is
    // fully decoded and paintable — and rejects on network failure or 404.
    // The old code wired onerror to the same handler as onload, so an
    // offline scroll would mark the scene ready and render a black void
    // (the screenshot the user reported). decode() gives us a real signal.
    Promise.all([loadScene(activeScene) as Promise<unknown>, ...toLoad.map(src => {
      const img = new window.Image()
      img.src = src
      return img.decode()
    })]).then(() => {
      if (cancelled) return
      if (isFirstEntry) {
        // Entry direction follows the swipe that opened the scene from home.
        // Opening at index 0 (feed) = the user swiped left → new content
        // enters from the right (slideDir 'left' → slideInRight).
        // Opening at the last index (the attic) = the user swiped right →
        // new content should enter from the left, following their finger.
        const idx = LOOP_SCENES.indexOf(activeScene as CareScene)
        setSlideDir(idx === LOOP_SCENES.length - 1 ? 'right' : 'left')
        setAnimKey(k => k + 1)
      }
      prevSceneRef.current = activeScene
      setReady(true)
    }).catch(() => {
      if (cancelled) return
      // Image decode failed — almost always offline + image not yet cached
      // via the SW. Show the offline panel instead of falling through to a
      // broken room render.
      setLoadError(true)
    })

    return () => { cancelled = true }
  }, [activeScene, isDark, retryNonce, roomSkin])

  useEffect(() => {
    if (!activeScene) prevSceneRef.current = null
  }, [activeScene])

  // Warm every scene chunk shortly after mount so room opens stay instant and
  // rooms keep working if the connection drops mid-session (sw.js precaches
  // room images but not JS). Deliberately deferred off the cold-load critical
  // path — this is the whole point of splitting the scenes out of the layout.
  useEffect(() => {
    const t = setTimeout(() => {
      (Object.keys(SCENE_LOADERS) as CareScene[]).forEach(s => { loadScene(s).catch(() => {}) })
    }, 2000)
    return () => clearTimeout(t)
  }, [])

  // Memoize the scene element so drag-driven host re-renders (setDragX at
  // touch-move rate) bail out of re-rendering the heavy scene subtree.
  // SceneComp and closeScene are both stable for the duration of a drag.
  const SceneComp = activeScene ? sceneComponents[activeScene] : undefined
  const sceneEl = useMemo(
    () => (SceneComp ? <SceneComp onClose={closeScene} /> : null),
    [SceneComp, closeScene]
  )

  if (!activeScene) return null

  function navigate(dir: 'left' | 'right') {
    if (loopIdx === -1) return
    flashLabel()
    if (dir === 'left') {
      if (loopIdx === LOOP_SCENES.length - 1) { playSound('ui_swipe_room'); closeScene(); return }
      playSound('ui_swipe_room')
      setSlideDir('left'); setAnimKey(k => k + 1); openScene(LOOP_SCENES[loopIdx + 1])
    } else {
      if (loopIdx === 0) { playSound('ui_swipe_room'); closeScene(); return }
      playSound('ui_swipe_room')
      setSlideDir('right'); setAnimKey(k => k + 1); openScene(LOOP_SCENES[loopIdx - 1])
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    if (foodDrag.active) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    isDragging.current = false
    setDragX(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (foodDrag.active) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Only start horizontal drag if clearly horizontal
    if (!isDragging.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        isDragging.current = true
        flashLabel()
      } else {
        return
      }
    }

    // Rubber-band: dampen if dragging past first/last room
    const atStart = loopIdx === 0 && dx > 0
    const atEnd   = loopIdx === LOOP_SCENES.length - 1 && dx < 0
    if (atStart || atEnd) {
      setDragX(dx * 0.25) // rubber-band resistance
    } else {
      setDragX(dx)
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (foodDrag.active) { setDragX(0); return }
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    const elapsed = Date.now() - touchStartTime.current
    const velocity = Math.abs(dx) / elapsed // px/ms

    setDragX(0)

    if (!isDragging.current) return
    isDragging.current = false

    // Trigger nav if swiped far enough (>20% screen) or fast enough (>0.4 px/ms)
    const threshold = window.innerWidth * 0.2
    if (Math.abs(dx) > threshold || velocity > 0.4) {
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        navigate(dx > 0 ? 'left' : 'right')
      }
    }
  }

  const dragging = dragX !== 0
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390
  const dragProgress = Math.min(1, Math.abs(dragX) / vw)

  const animStyle: React.CSSProperties = dragging
    ? { transform: `translateX(${dragX}px)`, transition: 'none' }
    : { animation: `slideIn${slideDir === 'left' ? 'Right' : 'Left'} 0.45s cubic-bezier(0.32, 0.72, 0, 1) both` }

  // Which edge the sparkle curtain hugs. While dragging it sits in the gap the
  // receding room is opening; during the slide-in it rides the incoming room's
  // leading edge so it sweeps across like a curtain you pass through.
  const curtainSide: 'left' | 'right' = dragging
    ? (dragX > 0 ? 'left' : 'right')
    : (slideDir === 'left' ? 'left' : 'right')

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%) scale(0.92); }
          to   { transform: translateX(0)    scale(1);    }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%) scale(0.92); }
          to   { transform: translateX(0)     scale(1);    }
        }
        @keyframes roomArriveDim {
          from { opacity: 0.55; }
          to   { opacity: 0;    }
        }
        @keyframes roomCurtain {
          0%   { opacity: 0; }
          35%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes roomLoadDot {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .room-load-dot { animation: none !important; opacity: 0.6; }
        }
      `}</style>

      {/* Dreamy "between rooms" backdrop — what shows in the gap as a room
          slides away during a swipe. Replaces the old pure-black void with a
          soft twilight gradient and a gentle starfield so the seam between
          rooms feels magical instead of like a hole punched in the screen.
          Sits under the scene (z-40, scene rendered after) so it's only ever
          visible mid-swipe. */}
      <div className="fixed inset-0 z-40 overflow-hidden" style={{
        background:
          'radial-gradient(90% 60% at 22% 16%, rgba(167,139,250,0.22), transparent 60%),' +
          'radial-gradient(80% 55% at 80% 84%, rgba(244,114,182,0.18), transparent 60%),' +
          'linear-gradient(180deg, #241640 0%, #160d2b 52%, #20143c 100%)',
      }}>
        {/* Soft, sparse starfield drifting across the whole void — dimmer than
            the bright seam curtain so the seam still reads as the focal point. */}
        <div className="absolute inset-0" style={{ opacity: 0.7 }}>
          <CurtainGlitter count={24} seed={313131} />
        </div>
      </div>

      {/* Loading the room: the cat walking on the Meadow's soft ground, the
          room's name, and three leaf dots. (The dots' keyframes used to sit in
          a scoped styled-jsx block, which an inline style can't reach, so
          they never blinked.) */}
      {!ready && !loadError && (
        <div
          role="status"
          className="meadow-root fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: M.soft, gap: 14 }}
        >
          <AnimatedEren px={4} glow={false} />
          <span style={{ fontFamily: FONT_ROUNDED, fontSize: 17, fontWeight: 800, color: M.text }}>
            {SCENE_LABELS[activeScene]}
          </span>
          <span aria-hidden className="flex items-center" style={{ gap: 6 }}>
            {[0, 1, 2].map(i => (
              <span key={i} className="room-load-dot" style={{
                width: 7, height: 7, borderRadius: 999, background: M.leaf,
                animation: `roomLoadDot 1s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </span>
          <span className="sr-only">Loading</span>
        </div>
      )}

      {/* Offline panel — replaces the broken-room render the user hit before.
          Fires when the room's background image fails to decode (offline +
          not yet cached by the SW). Lets them retry once back online, or
          back out to the home page. */}
      {loadError && (
        <div
          role="alert"
          className="meadow-root fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
          style={{ background: M.soft }}
        >
          <AnimatedEren px={3} glow={false} />
          <div className="text-center" style={{ maxWidth: 300, marginTop: 18 }}>
            <p style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: M.text }}>
              Can&apos;t reach the {SCENE_LABELS[activeScene as CareScene]?.replace(/^The /, '').toLowerCase()}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
              It looks like you&apos;re offline. Once you&apos;re back online the room
              will load and be saved for next time.
            </p>
          </div>
          <div className="flex flex-col items-center" style={{ gap: 6, marginTop: 24, width: '100%', maxWidth: 300 }}>
            <PrimaryButton onClick={reloadScene}>Try again</PrimaryButton>
            {/* A text button: a soft one would vanish into the soft ground. */}
            <TextButton tone="muted" onClick={() => closeScene()}>Go home</TextButton>
          </div>
        </div>
      )}

      {/* Scene */}
      {ready && (
        <div
          ref={sceneContainerRef}
          key={animKey}
          className="fixed inset-0 z-40"
          style={animStyle}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {sceneEl}

          {/* Depth veil — the room darkens as it recedes (during a drag) and
              brightens back in as the next room arrives (during the slide).
              Sits just above the scene root (z-40), below the nav dots (z-50). */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: '#0B0414', zIndex: 41,
            ...(dragging
              ? { opacity: 0.5 * dragProgress }
              : { opacity: 0, animation: 'roomArriveDim 0.45s ease-out both' }),
          }} />

          {/* Sparkle curtain — the magical seam between rooms. */}
          <div aria-hidden className="absolute top-0 bottom-0 pointer-events-none" style={{
            width: 130, zIndex: 45,
            left:  curtainSide === 'left'  ? 0 : undefined,
            right: curtainSide === 'right' ? 0 : undefined,
            transform: `translateX(${curtainSide === 'left' ? '-50%' : '50%'})`,
            ...(dragging
              ? { opacity: 0.25 + 0.75 * dragProgress }
              : { animation: 'roomCurtain 0.5s ease-out both' }),
          }}>
            <div className="absolute inset-0" style={{
              background: curtainSide === 'left'
                ? 'linear-gradient(90deg, transparent, rgba(244,114,182,0.18) 40%, rgba(255,255,255,0.22) 55%, rgba(167,139,250,0.16) 70%, transparent)'
                : 'linear-gradient(90deg, transparent, rgba(167,139,250,0.16) 30%, rgba(255,255,255,0.22) 45%, rgba(244,114,182,0.18) 60%, transparent)',
            }} />
            <CurtainGlitter count={32} seed={424242} />
          </div>
        </div>
      )}

      {/* Dot indicators — shown with the room label during swipes. */}
      {ready && (
        <div aria-hidden className="fixed bottom-4 left-1/2 z-50 flex items-center gap-2 px-3 py-2"
          style={{
            transform: 'translateX(-50%)', background: '#FFFFFF',
            borderRadius: 999, boxShadow: `0 3px 0 ${M.overArtLip}`, pointerEvents: 'none',
            opacity: labelVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}>
          {/* Home, first in the loop. */}
          <div style={{ width: 7, height: 7, borderRadius: 4, background: M.track, transition: 'all 0.3s ease' }} />
          {LOOP_SCENES.map((s, i) => (
            <div key={s} style={{
              width:  i === loopIdx ? 18 : 7,
              height: 7,
              borderRadius: 4,
              background: i === loopIdx ? SCENE_COLORS[s] : M.track,
              transition: 'all 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }} />
          ))}
        </div>
      )}

      {/* Room name label — only visible during swipes / scene changes, not
          when the user is just standing in a room. Fades in fast and out
          gently 1.4s after the last interaction. */}
      {ready && (
        <div className="fixed left-1/2 z-[55] pointer-events-none"
          style={{
            top: `calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE}px)`,
            transform: 'translateX(-50%)',
            opacity: labelVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}>
          <span key={activeScene} className="meadow-root" style={{
            display: 'inline-block', padding: '5px 14px', borderRadius: 999, background: '#FFFFFF',
            boxShadow: `0 3px 0 ${M.overArtLip}`, fontFamily: FONT_ROUNDED, fontSize: 14, fontWeight: 800,
            color: M.text, whiteSpace: 'nowrap', animation: 'fadeInDown 0.3s ease both',
          }}>
            {SCENE_LABELS[activeScene]}
          </span>
        </div>
      )}
    </>
  )
}
