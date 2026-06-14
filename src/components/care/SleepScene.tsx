'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats, getCachedIsSleeping } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/sounds'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import StinkyFlies from '@/components/StinkyFlies'
import LightSwitch from '@/components/LightSwitch'
import { useWish } from '@/contexts/WishContext'
import WishHintBanner from '@/components/wish/WishHintBanner'
import { wishHintRoom } from '@/lib/wishes'
import { useErenReaction } from '@/hooks/useErenReaction'
import { WORD_COLOR } from '@/lib/erenReactions'
import SoundWord from '@/components/SoundWord'
import PoseSprite from '@/components/care/PoseSprite'
import PixelPoof from '@/components/PixelPoof'
import { preloadImages } from '@/lib/preloadImages'

interface Props { onClose: () => void }

export default function SleepScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction, wakeUp } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const wish = useWish()
  const wishMatchesThisRoom = wish?.wish ? wishHintRoom(wish.wish) === 'sleep' : false

  const [tucking, setTucking] = useState(false)
  const [waking,  setWaking]  = useState(false)
  const [toast,   setToast]   = useState<string | null>(null)
  const [sleepIdx, setSleepIdx] = useState(0)   // which curled pose (0–3)
  const [showPoof, setShowPoof] = useState(false)
  const reaction = useErenReaction()

  // Fall back to the module-level cache so the button reads WAKE UP
  // immediately on swipe-in; otherwise it flashes TUCK IN for ~200 ms
  // while useErenStats refetches.
  const tuckedIn  = stats?.is_sleeping ?? getCachedIsSleeping() ?? false
  const sleepVal  = stats?.sleep_quality ?? 100
  const isSleepy  = sleepVal < 50
  const busy      = tucking || waking

  // Roll a curled-pose pick on mount (covers a reload / remote-partner tuck-in
  // where handleTuckIn never ran) and warm the four stickers so the poof
  // reveals a decoded bitmap, not a blank frame.
  useEffect(() => {
    setSleepIdx(Math.floor(Math.random() * 4))
    preloadImages(['/erenSleep1.png?v=2', '/erenSleep2.png?v=2', '/erenSleep3.png?v=2', '/erenSleep4.png?v=2'])
  }, [])
  // Poof-mask the asleep<->awake pose swap, but only on a real transition — not
  // on mount or a room-swipe (prevTucked starts equal to the first value).
  const prevTucked = useRef(tuckedIn)
  useEffect(() => {
    if (prevTucked.current !== tuckedIn) {
      prevTucked.current = tuckedIn
      setShowPoof(true)
    }
  }, [tuckedIn])

  async function handleTuckIn() {
    if (!user?.id || busy) return
    setTucking(true)
    // Re-roll which curled pose he'll fall asleep in, so it's random each time.
    setSleepIdx(Math.floor(Math.random() * 4))
    // Sleepy sway → settle squash while the eyes drift shut. The stats flip
    // to is_sleeping after applyAction, which keeps him settled + lids-closed
    // from then on (so a partner's remote tuck-in lands the same resting pose
    // with no choreography).
    reaction.play([
      { name: 'sway',   ms: 500, onEnter: () => playSound('care_sleep') },
      { name: 'settle', ms: 700 },
    ])
    await new Promise(r => setTimeout(r, 1150))
    const result = await applyAction(user.id, 'sleep')
    setTucking(false)
    setToast(result.message)
    if (result.success) completeTask('daily_sleep')
    setTimeout(() => setToast(null), 3000)
  }

  async function handleWakeUp() {
    if (busy) return
    setWaking(true)
    const result = await wakeUp()
    setWaking(false)
    // Eyes open (is_sleeping is now false), then a big waking stretch.
    reaction.play([{ name: 'wake', ms: 1800, onEnter: () => playSound('care_sleep') }])
    setToast(result.message)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {wish?.wish && (
        <WishHintBanner text={wish.text} status={wish.status} matchesThisRoom={wishMatchesThisRoom} />
      )}

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: 'url(/bedroom.png)', backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* ══ STAR GLOWS ══ */}
      {[
        { x: '54%', y: '22%', d: '2.0s' },
        { x: '43%', y: '35%', d: '0s'   },
        { x: '38%', y: '36%', d: '1.1s' },
        { x: 'calc(67% - 2px)', y: '41%', d: '0.7s' },
        { x: '58%', y: '38%', d: '1.2s' },
        { x: '39%', y: '41%', d: '0.6s' },
        { x: '44%', y: '31%', d: '1.8s' },
        { x: '57%', y: '34%', d: '0.3s' },
        { x: '45%', y: '43%', d: '1.5s' },
        { x: '55%', y: '40%', d: '0.9s' },
      ].map((s, i) => (
        <div key={i} className="absolute pointer-events-none z-[1]" style={{
          left: s.x, top: s.y,
          width: 0, height: 0,
          boxShadow: '0 0 2px 1.5px rgba(210,230,255,1), 0 0 5px 2.5px rgba(190,215,255,0.8)',
          animation: `starTwinkle 3s ease-in-out ${s.d} infinite`,
        }} />
      ))}

      {/* ══ MOON GLOW ══ */}
      <div className="absolute pointer-events-none z-[1]" style={{
        left: '60%', top: '33%',
        width: 0, height: 0,
        boxShadow: '0 0 14px 8px rgba(255,250,200,0.9), 0 0 28px 14px rgba(255,240,160,0.55), 0 0 50px 22px rgba(240,225,130,0.28)',
        animation: 'moonGlow 5s ease-in-out infinite',
      }} />

      <style jsx>{`
        @keyframes moonGlow {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1;  }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 1;   }
          50%       { opacity: 0.1; }
        }
      `}</style>

      {/* ══ EREN ══ */}
      <div className={cn('absolute z-10 transition-all duration-700', tuckedIn ? 'bottom-[17%]' : 'bottom-[14%]')}
        style={{ left: '50%', transform: 'translateX(-50%)' }}>
        {tuckedIn ? (
          // Asleep: a curled-up pose sticker (eyes painted shut, no overlays).
          // The pick is re-rolled on each tuck-in; the swap is hidden by the
          // poof. Breath slowed so the sleeping body rises and falls gently.
          <PoseSprite src={`/erenSleep${sleepIdx + 1}.png?v=2`} width={125} breatheDur={6.5} />
        ) : (
          <ErenIdleLayer disabled={reaction.active}>
            {/* Awake in the bedroom: the nightcap pose. Sleepy sway → settle
                squash as he's tucked in, waking stretch on wake. The bedroom
                cap pushes the face down, so the blink/glint overlays are
                re-aimed lower and closer together; lids shut during the settle. */}
            <div style={{
              animation: reaction.phase === 'sway'   ? 'erenSleepySway 500ms ease-in-out 2'
                : reaction.phase === 'settle' ? 'erenSettle 700ms ease-out both'
                : reaction.phase === 'wake'   ? 'erenIdleStretch 1800ms ease-in-out'
                : undefined,
              transformOrigin: 'bottom center',
            }}>
              <BlinkingEren size={230} src="/erenSleep_notail.png" tailSrc="/erenSleep_tail.png" tailOrigin="69.4% 73.6%"
                lidsClosed={tucking || reaction.phase === 'settle'}
                sleepyLids
                breatheDur={4}
                eyes={{
                  lidTop:    '36%',
                  lidLeftA:  '41%',
                  lidLeftB:  '51%',
                  maskTop:   '36.3%',
                  maskLeftA: '40.3%',
                  maskLeftB: '52.8%',
                  glintW:    '28%',
                }} />
            </div>
          </ErenIdleLayer>
        )}
        <StinkyFlies cleanliness={stats?.cleanliness ?? 100} />

        {/* Poof that masks the asleep<->awake sticker swap (never on mount). */}
        {showPoof && <PixelPoof size={210} onDone={() => setShowPoof(false)} />}

        {/* Sleepy yawn / waking sound-words, anchored above his head. */}
        {reaction.phase === 'sway' && <SoundWord word="MRAAW" color={WORD_COLOR.sleep} left={50} top={4} />}
        {reaction.phase === 'wake' && <SoundWord word="MRRP!" color={WORD_COLOR.sleep} left={50} top={4} />}
      </div>

      {/* ══ ZZZs ══ */}
      {tuckedIn && (
        <div className="absolute pointer-events-none z-20" style={{ bottom: '40%', left: '58%' }}>
          {[{z:'z',s:10,d:0},{z:'z',s:14,d:0.5},{z:'Z',s:18,d:1.0}].map((zz, i) => (
            <span key={i} className="absolute font-bold select-none"
              style={{ fontSize: zz.s, left: i * 16, top: -i * 16, color: '#A5B4FC', opacity: 0.9, fontFamily: '"Press Start 2P"', animation: `float ${1.2 + i * 0.4}s ease-in-out ${zz.d}s infinite` }}>
              {zz.z}
            </span>
          ))}
        </div>
      )}

      {/* Dream cloud when deeply sleeping */}
      {tuckedIn && (
        <div className="absolute pointer-events-none" style={{ bottom: '44%', left: '40%', animation: 'float 5s ease-in-out infinite' }}>
          <div style={{ width: 60, height: 28, borderRadius: 20, background: 'rgba(160,150,240,0.15)', border: '1px solid rgba(180,170,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {/* CSS fish */}
            <div style={{ position: 'relative', width: 12, height: 8, opacity: 0.65 }}>
              <div style={{ width: 9, height: 7, borderRadius: '50% 40% 40% 50%', background: '#6BAED6' }} />
              <div style={{ position: 'absolute', right: -3, top: 0, width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '5px solid #4A90BC' }} />
            </div>
            {/* CSS paw */}
            <div style={{ position: 'relative', width: 9, height: 9, opacity: 0.6 }}>
              <div style={{ width: 5, height: 4, borderRadius: '50%', background: '#C0A0E0', margin: '0 auto' }} />
              {[[-3,1],[3,1],[-1.5,4],[1.5,4]].map(([px,py], k) => (
                <div key={k} style={{ position: 'absolute', left: 4.5 + px, top: py, width: 2.5, height: 2, borderRadius: '50%', background: '#C0A0E0' }} />
              ))}
            </div>
            {/* CSS 4-star */}
            <div style={{ position: 'relative', width: 9, height: 9, opacity: 0.55 }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', background: '#F5E060', borderRadius: 1 }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%)', background: '#F5E060', borderRadius: 1 }} />
            </div>
          </div>
        </div>
      )}

      {/* ══ UI ══ */}

      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap"
          style={{ background: '#2E2860', borderRadius: 3, border: '2px solid #4A40A0', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {/* ══ BOTTOM UI ══ */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3 px-8 z-20">
        {/* Sleep quality — pixel bar */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-pixel text-indigo-300" style={{ fontSize: 7 }}>SLEEP QUALITY</span>
            <span className="font-pixel text-indigo-300" style={{ fontSize: 7 }}>{sleepVal}</span>
          </div>
          <div className="flex gap-[3px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1" style={{ height: 10, borderRadius: 2, background: i < Math.round(sleepVal / 100 * 12) ? (sleepVal > 50 ? '#818CF8' : sleepVal > 25 ? '#C084FC' : '#F87171') : '#1E1848', boxShadow: i < Math.round(sleepVal / 100 * 12) ? '0 0 4px rgba(130,120,255,0.5)' : 'none' }} />
            ))}
          </div>
        </div>

        <button onClick={() => { playSound('ui_tap'); tuckedIn ? handleWakeUp() : handleTuckIn() }} disabled={busy}
          className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px] disabled:opacity-50"
          style={waking
            ? { background: '#D97706', borderRadius: 3, border: '2px solid #F59E0B', fontFamily: '"Press Start 2P"', fontSize: 8 }
            : tuckedIn
              ? { background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 3, border: '2px solid #92400E', boxShadow: '0 3px 0 #78350F', fontFamily: '"Press Start 2P"', fontSize: 8 }
              : tucking
                ? { background: '#4F46E5', borderRadius: 3, border: '2px solid #6366F1', fontFamily: '"Press Start 2P"', fontSize: 8 }
                : { background: 'linear-gradient(135deg, #6366F1, #4F46E5)', borderRadius: 3, border: '2px solid #3730A3', boxShadow: '0 3px 0 #2D2A7A', fontFamily: '"Press Start 2P"', fontSize: 8 }
          }>
          {waking ? 'WAKING UP...' : tuckedIn ? 'WAKE UP' : tucking ? 'TUCKING IN...' : 'TUCK IN'}
        </button>
      </div>

      <LightSwitch targetBottom="16%" targetLeft="50%" persistKey="bedroom" />
    </div>
  )
}
