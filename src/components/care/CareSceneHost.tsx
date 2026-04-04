'use client'

import { useRef, useState } from 'react'
import { useCare, type CareScene } from '@/contexts/CareContext'
import FeedScene from './FeedScene'
import PlayScene from './PlayScene'
import SleepScene from './SleepScene'
import WashScene from './WashScene'
import HospitalScene from './HospitalScene'

const SCENE_ORDER: CareScene[] = ['feed', 'play', 'sleep', 'wash', 'hospital']

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

export default function CareSceneHost() {
  const { activeScene, isSick, openScene, closeScene } = useCare()

  const scenes = isSick ? SCENE_ORDER : SCENE_ORDER.filter(s => s !== 'hospital')

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [slideDir, setSlideDir]   = useState<'left' | 'right' | null>(null)
  const [animKey,  setAnimKey]    = useState(0)

  if (!activeScene) return null

  const currentIdx = scenes.indexOf(activeScene)

  function navigate(dir: 'left' | 'right') {
    const nextIdx = dir === 'left'
      ? (currentIdx + 1) % scenes.length
      : (currentIdx - 1 + scenes.length) % scenes.length
    setSlideDir(dir)
    setAnimKey(k => k + 1)
    openScene(scenes[nextIdx])
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    // Only trigger if horizontal swipe dominates and exceeds 55px
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
      `}</style>

      {/* Swipe wrapper */}
      {/* Solid backdrop — prevents home screen showing through during swipe */}
      <div className="fixed inset-0 z-40 bg-black" />

      <div
        key={animKey}
        className="fixed inset-0 z-40"
        style={animStyle}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {activeScene === 'feed'     && <FeedScene     {...props} />}
        {activeScene === 'play'     && <PlayScene     {...props} />}
        {activeScene === 'sleep'    && <SleepScene    {...props} />}
        {activeScene === 'wash'     && <WashScene     {...props} />}
        {activeScene === 'hospital' && <HospitalScene {...props} />}
      </div>

      {/* Scene indicator dots */}
      <div className="fixed bottom-4 left-1/2 z-50 flex items-center gap-2 px-3 py-1.5"
        style={{ transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.35)', borderRadius: 20, backdropFilter: 'blur(6px)', pointerEvents: 'none' }}>
        {scenes.map((s, i) => (
          <div key={s} style={{
            width:  i === currentIdx ? 18 : 7,
            height: 7,
            borderRadius: 4,
            background: i === currentIdx ? SCENE_COLORS[s] : 'rgba(255,255,255,0.4)',
            transition: 'all 0.25s ease',
            boxShadow: i === currentIdx ? `0 0 6px 2px ${SCENE_COLORS[s]}88` : 'none',
          }} />
        ))}
      </div>

      {/* Room name label */}
      <div className="fixed top-16 left-1/2 z-50 pointer-events-none"
        style={{ transform: 'translateX(-50%)' }}>
        <span key={activeScene} className="font-pixel text-white px-3 py-1"
          style={{ fontSize: 7, background: 'rgba(0,0,0,0.4)', borderRadius: 10, backdropFilter: 'blur(4px)', animation: 'fadeInDown 0.3s ease both' }}>
          {SCENE_LABELS[activeScene]}
        </span>
      </div>

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </>
  )
}
