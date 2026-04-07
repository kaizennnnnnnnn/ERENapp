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

      {/* ══ WALL ══ */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #E8F5E9 0%, #C8E6C9 60%, #A5D6A7 100%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,80,40,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,80,40,0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      {/* ══ FLOOR ══ */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: '62%' }}>
        {Array.from({ length: 30 }).map((_, i) => {
          const col = i % 6, row = Math.floor(i / 6)
          return (
            <div key={i} className="absolute" style={{
              left: `${col * (100 / 6)}%`, top: `${row * 20}%`,
              width: `${100 / 6 - 0.3}%`, height: '21%',
              background: (col + row) % 2 === 0
                ? 'linear-gradient(135deg, #F0F7F0 0%, #E0EDE0 100%)'
                : 'linear-gradient(135deg, #E4F0E4 0%, #D4E8D4 100%)',
              border: '1px solid rgba(100,160,100,0.2)',
            }} />
          )
        })}
      </div>

      {/* ══ WAINSCOTING ══ */}
      <div className="absolute left-0 right-0" style={{ top: '62%', height: 6, background: 'linear-gradient(180deg, #81C784, #66BB6A)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />

      {/* ══ MEDICAL CABINET (left wall) ══ */}
      <div className="absolute" style={{ left: '4%', top: '12%', width: 60, height: 90 }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #FAFAFA, #F0F0F0)', border: '2px solid #BDBDBD', borderRadius: 4, boxShadow: '2px 3px 0 rgba(0,0,0,0.15)' }}>
          {/* Shelves */}
          {[25, 50, 75].map(y => (
            <div key={y} className="absolute left-0 right-0" style={{ top: `${y}%`, height: 2, background: '#BDBDBD' }} />
          ))}
          {/* Cross symbol */}
          <div className="absolute" style={{ top: 6, left: '50%', transform: 'translateX(-50%)' }}>
            <div style={{ width: 12, height: 3, background: '#EF5350', borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: -4.5, left: 4.5, width: 3, height: 12, background: '#EF5350', borderRadius: 1 }} />
          </div>
          {/* Bottles on shelves */}
          {[
            { x: 8, y: 30, w: 8, h: 14, c: '#42A5F5' },
            { x: 25, y: 30, w: 8, h: 12, c: '#66BB6A' },
            { x: 42, y: 30, w: 8, h: 16, c: '#FFA726' },
            { x: 10, y: 55, w: 10, h: 14, c: '#AB47BC' },
            { x: 35, y: 55, w: 12, h: 12, c: '#26A69A' },
          ].map((b, i) => (
            <div key={i} className="absolute" style={{ left: b.x, top: `${b.y}%`, width: b.w, height: b.h, background: b.c, borderRadius: 2, border: '1px solid rgba(0,0,0,0.15)' }} />
          ))}
        </div>
      </div>

      {/* ══ EXAMINATION TABLE ══ */}
      <div className="absolute" style={{ left: '50%', top: '48%', transform: 'translateX(-50%)', width: 180, height: 40 }}>
        {/* Table top */}
        <div style={{ width: '100%', height: 12, background: 'linear-gradient(180deg, #E0E0E0, #BDBDBD)', borderRadius: '4px 4px 0 0', border: '2px solid #9E9E9E', borderBottom: 'none' }} />
        {/* Padding */}
        <div style={{ width: '88%', height: 8, margin: '0 auto', background: 'linear-gradient(180deg, #90CAF9, #64B5F6)', borderRadius: '0 0 2px 2px' }} />
        {/* Legs */}
        <div className="flex justify-between px-3" style={{ marginTop: 2 }}>
          {[0,1].map(i => (
            <div key={i} style={{ width: 6, height: 18, background: 'linear-gradient(180deg, #9E9E9E, #757575)', borderRadius: '0 0 2px 2px' }} />
          ))}
        </div>
      </div>

      {/* ══ SCALE (right side) ══ */}
      <div className="absolute" style={{ right: '8%', top: '42%' }}>
        <div style={{ width: 40, height: 6, background: '#BDBDBD', borderRadius: 3, border: '1px solid #9E9E9E' }} />
        <div style={{ width: 4, height: 20, background: '#9E9E9E', margin: '0 auto', borderRadius: 2 }} />
        <div style={{ width: 30, height: 4, background: '#BDBDBD', margin: '0 auto', borderRadius: 2 }} />
        <div className="font-pixel text-center text-gray-500 mt-1" style={{ fontSize: 5 }}>{weight.toFixed(1)}kg</div>
      </div>

      {/* ══ CLIPBOARD on wall ══ */}
      <div className="absolute" style={{ right: '6%', top: '14%', width: 36, height: 48 }}>
        <div style={{ width: '100%', height: '100%', background: '#FFF8E1', border: '2px solid #D7CCC8', borderRadius: 3, boxShadow: '2px 2px 0 rgba(0,0,0,0.1)' }}>
          {/* Clip */}
          <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 16, height: 8, background: '#8D6E63', borderRadius: '3px 3px 0 0', border: '1px solid #6D4C41' }} />
          {/* Lines */}
          {[20, 32, 44, 56, 68, 80].map(y => (
            <div key={y} className="absolute" style={{ left: 6, right: 6, top: `${y}%`, height: 1, background: 'rgba(0,0,0,0.08)' }} />
          ))}
        </div>
      </div>

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
