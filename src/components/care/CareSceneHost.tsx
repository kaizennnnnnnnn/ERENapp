'use client'

import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useCare, type CareScene } from '@/contexts/CareContext'
import { foodDrag } from './foodDragFlag'
import AnimatedEren from '@/components/AnimatedEren'
import { playSound } from '@/lib/sounds'
import { useIsDark } from '@/hooks/useIsDark'
import CurtainGlitter from '@/components/CurtainGlitter'

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
  school:    () => import('./SchoolScene'),
  hospital:  () => import('./HospitalScene'),
}
// Module-level cache: populated before `ready` flips, so the render below
// never sees a missing component (no Suspense, no fallback flash).
const sceneComponents: Partial<Record<CareScene, React.ComponentType<SceneProps>>> = {}
const loadScene = (s: CareScene) => SCENE_LOADERS[s]().then(m => { sceneComponents[s] = m.default })

const LOOP_SCENES: CareScene[] = ['feed', 'play', 'sleep', 'wash', 'chemistry', 'vet', 'school']

const SCENE_LABELS: Record<CareScene, string> = {
  feed:      'Kitchen',
  play:      'Playroom',
  sleep:     'Bedroom',
  wash:      'Bathroom',
  chemistry: 'Chemistry Lab',
  vet:       'Vet Office',
  school:    'Serbian Class',
  hospital:  'Vet Clinic',
}

const SCENE_COLORS: Record<CareScene, string> = {
  feed:      '#F5C842',
  play:      '#FF6B9D',
  sleep:     '#818CF8',
  wash:      '#38BDF8',
  chemistry: '#84CC16',
  vet:       '#34D399',
  school:    '#F59E0B',
  hospital:  '#F87171',
}

const SCENE_IMAGES_DAY: Partial<Record<CareScene, string>> = {
  feed:      '/kitchen.png',
  play:      '/playroom.png',
  sleep:     '/bedroom.png',
  wash:      '/bathroom.png',
  chemistry: '/ChemistryDay.png',
  vet:       '/vetBACK.png',
  school:    '/schoolBACK.png',
}
const SCENE_IMAGES_DARK: Partial<Record<CareScene, string>> = {
  feed:      '/KitchenDark.png',
  play:      '/play.png',
  sleep:     '/bedroom.png',
  wash:      '/BathroomDark.png',
  chemistry: '/ChemistryNight.png',
  vet:       '/wetDark.png',
  school:    '/schoolBACK.png',
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
  school:    [],
}

export default function CareSceneHost() {
  const { activeScene, openScene, closeScene } = useCare()
  const isDark = useIsDark()

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
    const bgSrc = (isDark ? SCENE_IMAGES_DARK : SCENE_IMAGES_DAY)[activeScene]
    const sprites = SCENE_EREN_SPRITES[activeScene] ?? ['/erenGood.png']
    const toLoad = [...sprites, ...(bgSrc ? [bgSrc] : [])]
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
        // Opening at the last index (school) = the user swiped right →
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
  }, [activeScene, isDark, retryNonce])

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
      `}</style>

      {/* Solid backdrop */}
      <div className="fixed inset-0 z-40 bg-black" />

      {/* Custom loading screen — matches the app splash (dark purple bg) */}
      {!ready && !loadError && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5"
          style={{ background: '#0F0A1E' }}
        >
          <AnimatedEren px={4} />
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-full" style={{
                width: 5, height: 5, background: '#A78BFA',
                animation: `splDot 1s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
          <style jsx>{`
            @keyframes splDot {
              0%, 100% { opacity: 0.2; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Offline panel — replaces the broken-room render the user hit before.
          Fires when the room's background image fails to decode (offline +
          not yet cached by the SW). Lets them retry once back online, or
          back out to the home page. */}
      {loadError && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8"
          style={{ background: '#0F0A1E' }}
        >
          <AnimatedEren px={3} />
          <div className="text-center" style={{ maxWidth: 280 }}>
            <p className="font-pixel" style={{ fontSize: 9, color: '#F9A8D4', letterSpacing: 2, marginBottom: 10 }}>
              CAN&apos;T REACH THE ROOM
            </p>
            <p className="font-pixel" style={{ fontSize: 7, color: '#E8DCFA', lineHeight: 1.7, letterSpacing: 0.5 }}>
              looks like you&apos;re offline. once you&apos;re back online the
              {' '}{SCENE_LABELS[activeScene as CareScene]?.toLowerCase()}{' '}
              will be ready and saved for next time.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reloadScene}
              className="active:translate-y-[1px] transition-transform"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 8, letterSpacing: 1.5, color: '#0F0A1E',
                background: '#F9A8D4',
                padding: '10px 16px',
                border: '2px solid #831843',
                borderRadius: 4,
                boxShadow: '3px 3px 0 #831843',
              }}
            >
              RETRY
            </button>
            <button
              type="button"
              onClick={() => closeScene()}
              className="active:translate-y-[1px] transition-transform"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 8, letterSpacing: 1.5, color: '#E8DCFA',
                background: 'rgba(40,28,60,0.9)',
                padding: '10px 16px',
                border: '2px solid #5C3A7A',
                borderRadius: 4,
                boxShadow: '3px 3px 0 #050507',
              }}
            >
              GO HOME
            </button>
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
            width: 170, zIndex: 45,
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
            <CurtainGlitter count={28} seed={424242} />
          </div>
        </div>
      )}

      {/* Dot indicators — hidden on the Serbian lesson screen, which has
          its own Duolingo-style top progress bar and doesn't need the
          generic room-nav dots cluttering the bottom. */}
      {ready && activeScene !== 'school' && (
        <div className="fixed bottom-4 left-1/2 z-50 flex items-center gap-2 px-3 py-1.5"
          style={{
            transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.35)',
            borderRadius: 20, backdropFilter: 'blur(6px)', pointerEvents: 'none',
            opacity: labelVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.4)', transition: 'all 0.3s ease' }} />
          {LOOP_SCENES.map((s, i) => (
            <div key={s} style={{
              width:  i === loopIdx ? 18 : 7,
              height: 7,
              borderRadius: 4,
              background: i === loopIdx ? SCENE_COLORS[s] : 'rgba(255,255,255,0.4)',
              transition: 'all 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
              boxShadow: i === loopIdx ? `0 0 6px 2px ${SCENE_COLORS[s]}88` : 'none',
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
            top: 'calc(var(--safe-top) + 120px)',
            transform: 'translateX(-50%)',
            opacity: labelVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}>
          <span key={activeScene} className="font-pixel text-white px-3 py-1"
            style={{ fontSize: 7, background: 'rgba(0,0,0,0.4)', borderRadius: 10, backdropFilter: 'blur(4px)', animation: 'fadeInDown 0.3s ease both' }}>
            {SCENE_LABELS[activeScene]}
          </span>
        </div>
      )}
    </>
  )
}
