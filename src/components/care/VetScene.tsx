'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'

interface Props { onClose: () => void }

export default function VetScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()

  const [checkDone, setCheckDone] = useState(false)
  const [checking,  setChecking]  = useState(false)
  const [medGiven,  setMedGiven]  = useState(false)
  const [giving,    setGiving]    = useState(false)
  const [toast,     setToast]     = useState<string | null>(null)

  const isSick       = stats?.is_sick ?? false
  const cleanliness  = stats?.cleanliness ?? 100
  const sleepQuality = stats?.sleep_quality ?? 100
  const weight       = stats?.weight ?? 4
  const energy       = stats?.energy ?? 100

  // Health assessment
  const issues: string[] = []
  if (isSick) issues.push('Feeling sick')
  if (cleanliness < 30) issues.push('Needs a bath')
  if (sleepQuality < 30) issues.push('Sleep deprived')
  if (weight > 7) issues.push('Overweight')
  if (energy < 20) issues.push('Very tired')
  const healthy = issues.length === 0

  async function doCheckup() {
    if (checking || checkDone) return
    setChecking(true)
    await new Promise(r => setTimeout(r, 1200))
    setChecking(false)
    setCheckDone(true)
  }

  async function giveMedicine() {
    if (!user?.id || giving || medGiven) return
    setGiving(true)
    await new Promise(r => setTimeout(r, 800))
    const result = await applyAction(user.id, 'medicine')
    setGiving(false)
    setMedGiven(true)
    setToast(result.message)
    if (result.success) completeTask('daily_wash')
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ BACKGROUND IMAGE ══ */}
      <img src="/vetBACK.png" alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center' }} draggable={false} />

      {/* ══ EREN ══ */}
      <div className={cn('absolute z-10 transition-all duration-500', checkDone ? 'bottom-[16%]' : 'bottom-[14%]')}
        style={{ left: '50%', transform: 'translateX(-50%)' }}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 200, height: 200, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ STETHOSCOPE ANIM when checking ══ */}
      {checking && (
        <div className="absolute z-20 pointer-events-none" style={{ left: '55%', bottom: '35%', animation: 'pulse 0.6s ease-in-out infinite' }}>
          <div style={{ fontSize: 28 }}>🩺</div>
        </div>
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2.5 animate-float whitespace-nowrap"
          style={{ background: '#1B5E20', borderRadius: 3, border: '2px solid #2E7D32', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {/* ══ BOTTOM UI ══ */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3 px-6 z-20">

        {/* Health report card */}
        {checkDone && (
          <div className="w-full max-w-xs"
            style={{ background: '#1A2E1A', borderRadius: 4, border: '2px solid #2E5A2E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', padding: '10px 12px' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-pixel text-green-300" style={{ fontSize: 7 }}>HEALTH REPORT</span>
              <span className="font-pixel" style={{ fontSize: 7, color: healthy ? '#4ADE80' : '#F87171' }}>
                {healthy ? 'HEALTHY' : 'NEEDS CARE'}
              </span>
            </div>
            {healthy ? (
              <p className="font-pixel text-green-400 text-center" style={{ fontSize: 6, lineHeight: 2 }}>
                EREN IS IN GREAT SHAPE!
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div style={{ width: 4, height: 4, borderRadius: 2, background: '#F87171' }} />
                    <span className="font-pixel text-red-300" style={{ fontSize: 6 }}>{issue.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        {!checkDone ? (
          <button onClick={doCheckup} disabled={checking}
            className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px] disabled:opacity-50"
            style={checking
              ? { background: '#388E3C', borderRadius: 3, border: '2px solid #2E7D32', fontFamily: '"Press Start 2P"', fontSize: 8 }
              : { background: 'linear-gradient(135deg, #4CAF50, #388E3C)', borderRadius: 3, border: '2px solid #1B5E20', boxShadow: '0 3px 0 #145218', fontFamily: '"Press Start 2P"', fontSize: 8 }
            }>
            {checking ? 'EXAMINING...' : 'CHECK UP'}
          </button>
        ) : !healthy && !medGiven ? (
          <button onClick={giveMedicine} disabled={giving}
            className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px] disabled:opacity-50"
            style={giving
              ? { background: '#7B1FA2', borderRadius: 3, border: '2px solid #6A1B9A', fontFamily: '"Press Start 2P"', fontSize: 8 }
              : { background: 'linear-gradient(135deg, #AB47BC, #7B1FA2)', borderRadius: 3, border: '2px solid #4A148C', boxShadow: '0 3px 0 #38006B', fontFamily: '"Press Start 2P"', fontSize: 8 }
            }>
            {giving ? 'GIVING MEDICINE...' : 'GIVE MEDICINE'}
          </button>
        ) : (
          <div className="w-full max-w-xs text-center py-3"
            style={{ background: healthy ? 'linear-gradient(135deg, #4CAF50, #388E3C)' : 'linear-gradient(135deg, #AB47BC, #7B1FA2)', borderRadius: 3, border: `2px solid ${healthy ? '#1B5E20' : '#4A148C'}`, boxShadow: `0 2px 0 ${healthy ? '#145218' : '#38006B'}`, fontFamily: '"Press Start 2P"', fontSize: 8, color: 'white' }}>
            {healthy ? 'ALL GOOD!' : 'MEDICINE GIVEN!'}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1) rotate(-15deg); }
          50%       { transform: scale(1.15) rotate(5deg); }
        }
      `}</style>
    </div>
  )
}
