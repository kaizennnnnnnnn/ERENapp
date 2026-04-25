'use client'

import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { useCare, type CareScene } from '@/contexts/CareContext'
import FeedScene from './FeedScene'
import PlayScene from './PlayScene'
import SleepScene from './SleepScene'
import WashScene from './WashScene'
import HospitalScene from './HospitalScene'
import VetScene from './VetScene'
import SchoolScene from './SchoolScene'
import AnimatedEren from '@/components/AnimatedEren'
import { playSound } from '@/lib/sounds'

const LOOP_SCENES: CareScene[] = ['feed', 'play', 'sleep', 'wash', 'vet', 'school']

const SCENE_LABELS: Record<CareScene, string> = {
  feed:     'Kitchen',
  play:     'Playroom',
  sleep:    'Bedroom',
  wash:     'Bathroom',
  vet:      'Vet Office',
  school:   'Serbian Class',
  hospital: 'Vet Clinic',
}

const SCENE_COLORS: Record<CareScene, string> = {
  feed:     '#F5C842',
  play:     '#FF6B9D',
  sleep:    '#818CF8',
  wash:     '#38BDF8',
  vet:      '#34D399',
  school:   '#F59E0B',
  hospital: '#F87171',
}

const SCENE_IMAGES: Partial<Record<CareScene, string>> = {
  feed:   '/kitchen.png',
  play:   '/playroom.png',
  sleep:  '/bedroom.png',
  wash:   '/bathroom.png',
  vet:    '/vetBACK.png',
  school: '/schoolBACK.png',
}

export default function CareSceneHost() {
  const { activeScene, openScene, closeScene } = useCare()

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const isDragging = useRef(false)
  const sceneContainerRef = useRef<HTMLDivElement>(null)

  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animKey,  setAnimKey]  = useState(0)
  const [ready,    setReady]    = useState(false)
  const [dragX,    setDragX]    = useState(0)
  const prevSceneRef = useRef<string | null>(null)

  const loopIdx = LOOP_SCENES.indexOf(activeScene as CareScene)

  useLayoutEffect(() => {
    setReady(false)
  }, [activeScene])

  useEffect(() => {
    if (!activeScene) return
    const bgSrc = SCENE_IMAGES[activeScene]
    const toLoad = ['/erenGood.png', ...(bgSrc ? [bgSrc] : [])]
    let loaded = 0
    const isFirstEntry = prevSceneRef.current === null

    function onDone() {
      loaded++
      if (loaded >= toLoad.length) {
        if (isFirstEntry) {
          setSlideDir('left')
          setAnimKey(k => k + 1)
        }
        prevSceneRef.current = activeScene
        setReady(true)
      }
    }

    toLoad.forEach(src => {
      const img = new window.Image()
      img.onload  = onDone
      img.onerror = onDone
      img.src     = src
    })
  }, [activeScene])

  useEffect(() => {
    if (!activeScene) prevSceneRef.current = null
  }, [activeScene])

  if (!activeScene) return null

  function navigate(dir: 'left' | 'right') {
    if (loopIdx === -1) return
    if (dir === 'left') {
      if (loopIdx === LOOP_SCENES.length - 1) { closeScene(); return }
      playSound('ui_swipe_room')
      setSlideDir('left'); setAnimKey(k => k + 1); openScene(LOOP_SCENES[loopIdx + 1])
    } else {
      if (loopIdx === 0) { closeScene(); return }
      playSound('ui_swipe_room')
      setSlideDir('right'); setAnimKey(k => k + 1); openScene(LOOP_SCENES[loopIdx - 1])
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    isDragging.current = false
    setDragX(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Only start horizontal drag if clearly horizontal
    if (!isDragging.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        isDragging.current = true
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

  const animStyle: React.CSSProperties = dragX !== 0
    ? { transform: `translateX(${dragX}px)`, transition: 'none' }
    : { animation: `slideIn${slideDir === 'left' ? 'Right' : 'Left'} 0.4s cubic-bezier(0.32, 0.72, 0, 1) both` }

  const props = { onClose: closeScene }

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0);    }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0);     }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      {/* Solid backdrop */}
      <div className="fixed inset-0 z-40 bg-black" />

      {/* Custom loading screen — matches the app splash (dark purple bg) */}
      {!ready && (
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
          {activeScene === 'feed'     && <FeedScene     {...props} />}
          {activeScene === 'play'     && <PlayScene     {...props} />}
          {activeScene === 'sleep'    && <SleepScene    {...props} />}
          {activeScene === 'wash'     && <WashScene     {...props} />}
          {activeScene === 'vet'      && <VetScene      {...props} />}
          {activeScene === 'school'   && <SchoolScene   {...props} />}
          {activeScene === 'hospital' && <HospitalScene {...props} />}
        </div>
      )}

      {/* Dot indicators */}
      {ready && (
        <div className="fixed bottom-4 left-1/2 z-50 flex items-center gap-2 px-3 py-1.5"
          style={{ transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.35)', borderRadius: 20, backdropFilter: 'blur(6px)', pointerEvents: 'none' }}>
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

      {/* Room name label — below stats header */}
      {ready && (
        <div className="fixed left-1/2 z-[55] pointer-events-none" style={{ top: 108, transform: 'translateX(-50%)' }}>
          <span key={activeScene} className="font-pixel text-white px-3 py-1"
            style={{ fontSize: 7, background: 'rgba(0,0,0,0.4)', borderRadius: 10, backdropFilter: 'blur(4px)', animation: 'fadeInDown 0.3s ease both' }}>
            {SCENE_LABELS[activeScene]}
          </span>
        </div>
      )}
    </>
  )
}
