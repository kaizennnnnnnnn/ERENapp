'use client'

import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { useCare, type CareScene } from '@/contexts/CareContext'
import FeedScene from './FeedScene'
import PlayScene from './PlayScene'
import SleepScene from './SleepScene'
import WashScene from './WashScene'
import HospitalScene from './HospitalScene'

const LOOP_SCENES: CareScene[] = ['feed', 'play', 'sleep', 'wash']

const SCENE_LABELS: Record<CareScene, string> = {
  feed:     'Kitchen',
  play:     'Playroom',
  sleep:    'Bedroom',
  wash:     'Bathroom',
  hospital: 'Vet Clinic',
}

const SCENE_COLORS: Record<CareScene, string> = {
  feed:     '#F5C842',
  play:     '#FF6B9D',
  sleep:    '#818CF8',
  wash:     '#38BDF8',
  hospital: '#F87171',
}

// Background images per scene — null means CSS-only (no preload needed)
const SCENE_IMAGES: Partial<Record<CareScene, string>> = {
  feed:  '/kitchen.png',
  play:  '/playroom.png',
  sleep: '/bedroom.png',
  wash:  '/bathroom.png',
}

export default function CareSceneHost() {
  const { activeScene, openScene, closeScene } = useCare()

const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [animKey,  setAnimKey]  = useState(0)
  const [ready,    setReady]    = useState(false)

  const loopIdx = LOOP_SCENES.indexOf(activeScene as CareScene)

  // Reset ready synchronously before paint so the old scene never flashes through
  useLayoutEffect(() => {
    setReady(false)
  }, [activeScene])

  // Preload background + Eren simultaneously before revealing the scene
  useEffect(() => {
    if (!activeScene) return
    const bgSrc = SCENE_IMAGES[activeScene]

    const toLoad = ['/erenGood.png', ...(bgSrc ? [bgSrc] : [])]
    let loaded = 0

    function onDone() {
      loaded++
      if (loaded >= toLoad.length) setReady(true)
    }

    toLoad.forEach(src => {
      const img = new Image()
      img.onload  = onDone
      img.onerror = onDone
      img.src     = src
    })
  }, [activeScene])

  if (!activeScene) return null


  function navigate(dir: 'left' | 'right') {
    if (loopIdx === -1) return // hospital — no swipe nav
    if (dir === 'left') {
      if (loopIdx === LOOP_SCENES.length - 1) { closeScene(); return } // bathroom → home
      setSlideDir('left'); setAnimKey(k => k + 1); openScene(LOOP_SCENES[loopIdx + 1])
    } else {
      if (loopIdx === 0) { closeScene(); return } // kitchen → home
      setSlideDir('right'); setAnimKey(k => k + 1); openScene(LOOP_SCENES[loopIdx - 1])
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    navigate(dx > 0 ? 'left' : 'right')
  }

  const animStyle: React.CSSProperties = slideDir ? {
    animation: `slideIn${slideDir === 'left' ? 'Right' : 'Left'} 0.28s cubic-bezier(0.25,0.46,0.45,0.94) both`,
  } : {}

  const props = { onClose: closeScene }

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1;   }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0.6; }
          to   { transform: translateX(0);     opacity: 1;   }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      {/* Solid backdrop */}
      <div className="fixed inset-0 z-40 bg-black" />

      {/* Loading spinner — shown while image preloads */}
      {!ready && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.15)', borderTop: '3px solid rgba(255,255,255,0.8)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Scene — hidden until image is ready */}
      <div
        key={animKey}
        className="fixed inset-0 z-40"
        style={{ ...animStyle, opacity: ready ? 1 : 0 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {activeScene === 'feed'     && <FeedScene     {...props} />}
        {activeScene === 'play'     && <PlayScene     {...props} />}
        {activeScene === 'sleep'    && <SleepScene    {...props} />}
        {activeScene === 'wash'     && <WashScene     {...props} />}
        {activeScene === 'hospital' && <HospitalScene {...props} />}
      </div>

      {/* Dot indicators */}
      {ready && (
        <div className="fixed bottom-4 left-1/2 z-50 flex items-center gap-2 px-3 py-1.5"
          style={{ transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.35)', borderRadius: 20, backdropFilter: 'blur(6px)', pointerEvents: 'none' }}>
          {LOOP_SCENES.map((s, i) => (
            <div key={s} style={{
              width:  i === loopIdx ? 18 : 7,
              height: 7,
              borderRadius: 4,
              background: i === loopIdx ? SCENE_COLORS[s] : 'rgba(255,255,255,0.4)',
              transition: 'all 0.25s ease',
              boxShadow: i === loopIdx ? `0 0 6px 2px ${SCENE_COLORS[s]}88` : 'none',
            }} />
          ))}
        </div>
      )}

      {/* Room name label */}
      {ready && (
        <div className="fixed top-16 left-1/2 z-50 pointer-events-none" style={{ transform: 'translateX(-50%)' }}>
          <span key={activeScene} className="font-pixel text-white px-3 py-1"
            style={{ fontSize: 7, background: 'rgba(0,0,0,0.4)', borderRadius: 10, backdropFilter: 'blur(4px)', animation: 'fadeInDown 0.3s ease both' }}>
            {SCENE_LABELS[activeScene]}
          </span>
        </div>
      )}
    </>
  )
}
