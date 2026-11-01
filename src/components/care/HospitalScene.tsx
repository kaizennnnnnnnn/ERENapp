'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'
import { roomArt } from '@/lib/roomArt'
import BlinkingEren from '@/components/BlinkingEren'
import StinkyFlies from '@/components/StinkyFlies'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import { Sparkles } from '@/components/care/ReactionFx'
import { useErenReaction } from '@/hooks/useErenReaction'
import CareToast from '@/components/care/CareToast'
import ClinicControls, { type ClinicPhase } from '@/components/vet/ClinicControls'

interface Props { onClose: () => void }

export default function HospitalScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)
  const isDark = useIsDark()
  const reaction = useErenReaction()

  const [medGiven, setMedGiven] = useState(false)
  const [giving, setGiving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [toastGood, setToastGood] = useState(true)
  const saveLock = useRef(false)
  const mounted = useRef(true)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (toastTimer.current !== null) clearTimeout(toastTimer.current)
    }
  }, [])

  const phase: ClinicPhase = giving ? 'giving' : medGiven ? 'treated' : !stats ? 'loading' : stats.is_sick ? 'sick' : 'healthy'

  const reasons: string[] = []
  if ((stats?.cleanliness ?? 100) < 20) reasons.push('Needs a bath')
  if ((stats?.sleep_quality ?? 100) < 15) reasons.push('Needs more sleep')
  if ((stats?.weight ?? 4) > 7.5) reasons.push('Lighter meals')

  async function giveMedicine() {
    if (!user?.id || !stats?.is_sick || saveLock.current || medGiven) return
    saveLock.current = true
    setGiving(true)
    setToast(null)
    if (toastTimer.current !== null) { clearTimeout(toastTimer.current); toastTimer.current = null }
    try {
      const result = await applyAction(user.id, 'medicine')
      if (!mounted.current) return
      setMedGiven(result.success)
      showResult(result)
    } catch {
      showResult({ success: false, message: 'Could not save the treatment. Please try again.' })
    } finally {
      saveLock.current = false
      if (mounted.current) setGiving(false)
    }
  }

  function showResult(result: { success: boolean; message: string }) {
    if (!mounted.current) return
    setToastGood(result.success)
    setToast(result.message)
    if (toastTimer.current !== null) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => { if (mounted.current) setToast(null) }, 3000)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: `url(${roomArt('hospital', isDark)})`, backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* Compensate for the sprite's transparent paw margin to sit on the painted table. */}
      <div className="absolute z-10" style={{ left: '50%', bottom: 'calc(40% - 24px)', transform: 'translateX(-50%)', width: 200, height: 200 }}>
        <PetTarget reaction={reaction}>
          <BlinkingEren size={200} src="/erenGood_notail.png" tailSrc="/erenGood_tail.png" />
        </PetTarget>
        <StinkyFlies cleanliness={stats?.cleanliness ?? 100} />
        {reaction.phase === PURR && <PurrFx bottom="62%" />}
        {medGiven && <Sparkles tint="#F5C820" />}
      </div>

      {toast && <CareToast msg={toast} ok={toastGood} top="65%" />}

      <ClinicControls phase={phase} reasons={reasons} weight={stats?.weight ?? 4}
        onGive={() => { playSound('ui_tap'); void giveMedicine() }}
        onClose={() => { playSound('ui_back'); onClose() }} />
    </div>
  )
}
