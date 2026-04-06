'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'

interface Props { onClose: () => void }

export default function SleepScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()

  const [tuckedIn, setTuckedIn] = useState(false)
  const [tucking,  setTucking]  = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)

  const sleepVal  = stats?.sleep_quality ?? 100
  const isSleepy  = sleepVal < 50

  async function handleTuckIn() {
    if (!user?.id || tucking || tuckedIn) return
    setTucking(true)
    await new Promise(r => setTimeout(r, 700))
    const result = await applyAction(user.id, 'sleep')
    setTucking(false)
    setTuckedIn(true)
    setToast(result.message)
    if (result.success) completeTask('daily_sleep')
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ BACKGROUND IMAGE ══ */}
      <img src="/bedroom.png" alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover", objectPosition: "center" }} draggable={false} />

      {/* ══ BEDROOM LIGHT EFFECTS ══ */}
      <div className="absolute inset-0 pointer-events-none z-[1]">

        {/* String lights across the top */}
        {[
          { x: '12%', y: '7%',  d: '0s'   },
          { x: '22%', y: '5%',  d: '0.3s' },
          { x: '32%', y: '5%',  d: '0.7s' },
          { x: '42%', y: '5%',  d: '1.1s' },
          { x: '52%', y: '5%',  d: '0.5s' },
          { x: '62%', y: '5%',  d: '0.9s' },
          { x: '72%', y: '6%',  d: '0.2s' },
          { x: '81%', y: '7%',  d: '1.4s' },
          { x: '89%', y: '8%',  d: '0.6s' },
        ].map((l, i) => (
          <div key={`light-${i}`} className="absolute rounded-full" style={{
            left: l.x, top: l.y, width: 5, height: 5,
            transform: 'translate(-50%,-50%)',
            background: '#ffe090',
            boxShadow: '0 0 6px 3px rgba(255,220,100,0.85), 0 0 14px 6px rgba(255,200,60,0.4)',
            animation: `bulbPulse 2.8s ease-in-out ${l.d} infinite`,
          }} />
        ))}

        {/* Stars in the sky through the window */}
        {[
          { x: '42%', y: '15%', d: '0s'   },
          { x: '47%', y: '12%', d: '0.5s' },
          { x: '53%', y: '14%', d: '1.1s' },
          { x: '58%', y: '12%', d: '0.3s' },
          { x: '44%', y: '21%', d: '0.8s' },
          { x: '50%', y: '19%', d: '1.5s' },
          { x: '56%', y: '20%', d: '0.6s' },
          { x: '62%', y: '17%', d: '1.8s' },
          { x: '40%', y: '28%', d: '0.2s' },
          { x: '48%', y: '30%', d: '1.2s' },
          { x: '55%', y: '27%', d: '0.9s' },
          { x: '43%', y: '36%', d: '1.6s' },
          { x: '51%', y: '38%', d: '0.4s' },
          { x: '60%', y: '34%', d: '2.0s' },
          { x: '46%', y: '44%', d: '1.0s' },
          { x: '57%', y: '45%', d: '0.7s' },
        ].map((s, i) => (
          <div key={`star-${i}`} className="absolute rounded-full" style={{
            left: s.x, top: s.y, width: 2, height: 2,
            transform: 'translate(-50%,-50%)',
            background: '#ddeeff',
            boxShadow: '0 0 3px 2px rgba(200,220,255,0.9), 0 0 7px 3px rgba(170,200,255,0.5)',
            animation: `starTwinkle 3s ease-in-out ${s.d} infinite`,
          }} />
        ))}

        {/* Moon glow */}
        <div className="absolute" style={{
          left: '64%', top: '27%',
          width: 22, height: 22,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,250,210,0.4) 0%, transparent 70%)',
          boxShadow: '0 0 12px 6px rgba(255,245,180,0.35), 0 0 28px 12px rgba(240,230,150,0.15)',
          animation: 'moonGlow 5s ease-in-out infinite',
        }} />

        {/* Bedside lamp warm glow */}
        <div className="absolute" style={{
          left: '55%', top: '62%',
          width: 70, height: 50,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,200,80,0.28) 0%, transparent 70%)',
          boxShadow: '0 0 20px 10px rgba(255,190,70,0.2)',
          animation: 'lampGlow 3.5s ease-in-out infinite',
        }} />
      </div>

      <style jsx>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 1;    transform: translate(-50%,-50%) scale(1);   }
          50%       { opacity: 0.2; transform: translate(-50%,-50%) scale(0.4); }
        }
        @keyframes moonGlow {
          0%, 100% { opacity: 0.65; }
          50%       { opacity: 1;   }
        }
        @keyframes lampGlow {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1;  }
        }
        @keyframes bulbPulse {
          0%, 100% { opacity: 0.8; }
          50%       { opacity: 1;  }
        }
      `}</style>

      {/* ══ EREN ══ */}
      <div className={cn('absolute z-10 transition-all duration-700', tuckedIn ? 'bottom-[16%]' : 'bottom-[14%]')}
        style={{ left: '50%', transform: 'translateX(-50%)' }}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 200, height: 200, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ ZZZs ══ */}
      {tuckedIn && (
        <div className="absolute pointer-events-none z-20" style={{ bottom: '65%', left: '60%' }}>
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
        <div className="absolute pointer-events-none" style={{ bottom: '72%', left: '40%', animation: 'float 5s ease-in-out infinite' }}>
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

        <button onClick={handleTuckIn} disabled={tucking || tuckedIn}
          className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px] disabled:opacity-50"
          style={tuckedIn
            ? { background: '#312E81', borderRadius: 3, border: '2px solid #4338CA', boxShadow: '0 2px 0 #2D3748', fontFamily: '"Press Start 2P"', fontSize: 8 }
            : tucking
              ? { background: '#4F46E5', borderRadius: 3, border: '2px solid #6366F1', fontFamily: '"Press Start 2P"', fontSize: 8 }
              : { background: 'linear-gradient(135deg, #6366F1, #4F46E5)', borderRadius: 3, border: '2px solid #3730A3', boxShadow: '0 3px 0 #2D2A7A', fontFamily: '"Press Start 2P"', fontSize: 8 }
          }>
          {tuckedIn ? 'SLEEPING SOUNDLY...' : tucking ? 'TUCKING IN...' : 'TUCK IN'}
        </button>
      </div>
    </div>
  )
}
