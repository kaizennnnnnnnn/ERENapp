'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { cn } from '@/lib/utils'

interface Props {
  onClose: () => void
}

export default function HospitalScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)

  const [medGiven, setMedGiven] = useState(false)
  const [giving, setGiving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Diagnose reason for sickness
  const reasons: string[] = []
  if ((stats?.cleanliness ?? 100) < 20) reasons.push('Too dirty 🧹')
  if ((stats?.sleep_quality ?? 100) < 15) reasons.push('Sleep deprived 💤')
  if ((stats?.weight ?? 4) > 7.5) reasons.push('Overweight 🍔')

  async function giveMedicine() {
    if (!user?.id || giving || medGiven) return
    setGiving(true)
    await new Promise(r => setTimeout(r, 800))
    const result = await applyAction(user.id, 'medicine')
    setGiving(false)
    setMedGiven(true)
    setToast(result.message)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: 'linear-gradient(to bottom, #F0FFF4 60%, #E8F5E9 60%)' }}
    >
      {/* ── Hospital decorations ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Red cross on wall */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2">
          <div className="relative w-12 h-12">
            <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-4 bg-red-500 rounded" />
            <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-4 bg-red-500 rounded" />
          </div>
        </div>

        {/* Examination table */}
        <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-52 h-6 bg-white border-2 border-green-200 rounded-xl shadow" />
        <div className="absolute bottom-[28%] left-1/2 -translate-x-1/2 w-4 h-8 bg-green-200 rounded-b" />

        {/* Medicine cabinet */}
        <div className="absolute right-4 top-20 w-16 h-24 bg-white border-2 border-green-200 rounded-sm shadow">
          <div className="absolute top-2 left-2 right-2 bottom-2 grid grid-cols-2 gap-1">
            <div className="w-full h-full bg-red-100 rounded-sm border border-red-200" />
            <div className="w-full h-full bg-blue-100 rounded-sm border border-blue-200" />
            <div className="w-full h-full bg-yellow-100 rounded-sm border border-yellow-200" />
            <div className="w-full h-full bg-green-100 rounded-sm border border-green-200" />
          </div>
          {/* Cross on cabinet */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-red-500 font-bold text-xs">+</div>
        </div>

        {/* IV stand */}
        <div className="absolute left-6 bottom-[28%] w-1 h-28 bg-gray-300" />
        <div className="absolute left-3 bottom-[54%] w-7 h-0.5 bg-gray-300" />
        <div className="absolute left-7 bottom-[50%] w-4 h-6 bg-sky-200 border border-sky-300 rounded" />
        <div className="absolute left-8 bottom-[36%] w-0.5 h-16 bg-sky-300" />

        {/* Floor */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute border border-green-100"
            style={{
              left: `${i * 12.5}%`, top: '60%',
              width: '12.5%', height: '40%',
              background: i % 2 === 0 ? '#F0FFF4' : '#E8F5E9',
            }}
          />
        ))}
      </div>

      {/* ── Back button ── */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md active:scale-95"
      >
        <ChevronLeft size={22} className="text-gray-700" />
      </button>

      {/* ── Scene label ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <span className="text-xs font-bold text-red-600 bg-white/80 px-3 py-1 rounded-full">
          Vet Clinic 🏥
        </span>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg animate-float">
          {toast}
        </div>
      )}

      {/* ── Diagnosis card ── */}
      {reasons.length > 0 && !medGiven && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-white border border-red-200 rounded-2xl px-4 py-2 shadow w-64">
          <p className="text-xs font-bold text-red-600 mb-1">Diagnosis:</p>
          {reasons.map((r, i) => (
            <p key={i} className="text-xs text-gray-600">• {r}</p>
          ))}
        </div>
      )}

      {/* ── Eren on examination table ── */}
      <div className={cn(
        'absolute transition-all duration-500 bottom-[32%] left-[38%]',
      )}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 130, height: 130, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ── Cone of shame when sick, removed after medicine ── */}
      {!medGiven && (
        <div className="absolute bottom-[44%] left-[44%] pointer-events-none">
          <div
            className="w-10 h-8 border-4 border-[#E8C06A] rounded-b-full opacity-70"
            style={{ background: 'transparent', borderBottom: 'none' }}
          />
        </div>
      )}

      {/* ── Sparkles after medicine ── */}
      {medGiven && (
        <div className="absolute bottom-[46%] left-[54%] pointer-events-none">
          {['✨', '⭐', '✨'].map((s, i) => (
            <span
              key={i}
              className="absolute text-base"
              style={{
                left: `${i * 12}px`,
                top: `${-i * 10}px`,
                animation: `float ${0.8 + i * 0.3}s ease-in-out infinite`,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* ── Bottom UI ── */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-3 px-8">
        <div className="w-full max-w-xs bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-xs font-semibold text-red-600">
            {medGiven
              ? '💊 Medicine given! Make sure to fix the root cause.'
              : `⚠️ Eren is sick! Give him medicine.`}
          </p>
          {!medGiven && (stats?.weight ?? 0) > 6.5 && (
            <p className="text-xs text-orange-500 mt-1">
              Weight: {stats?.weight?.toFixed(1)} kg — he&apos;s getting chubby!
            </p>
          )}
        </div>

        <button
          onClick={giveMedicine}
          disabled={giving || medGiven}
          className={cn(
            'w-full max-w-xs py-3 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-95',
            medGiven
              ? 'bg-green-400 text-white cursor-not-allowed'
              : giving
                ? 'bg-green-300 text-white animate-pulse-soft'
                : 'bg-green-500 text-white hover:bg-green-600',
          )}
        >
          {medGiven ? '✓ Medicine given!' : giving ? 'Giving medicine...' : 'Give medicine 💊'}
        </button>
      </div>
    </div>
  )
}
