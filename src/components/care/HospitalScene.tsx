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
  const { stats, finishMedicineSession, medicineSaveBusy, medicineSavePending, medicineSaveError } = useErenStats(profile?.household_id ?? null)
  const isDark = useIsDark()
  const reaction = useErenReaction()

  const [medGiven, setMedGiven] = useState(false)
  const [giving, setGiving] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [toastGood, setToastGood] = useState(true)
  const saveLock = useRef<symbol | null>(null)
  const mounted = useRef(true)
  const saveEpoch = useRef(0)
  const saveScope = useRef({ userId: user?.id, householdId: profile?.household_id })
  if (saveScope.current.userId !== user?.id || saveScope.current.householdId !== profile?.household_id) saveScope.current = { userId: user?.id, householdId: profile?.household_id }
  const currentSaveScope = saveScope.current
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mounted.current = true; saveLock.current = null
    setMedGiven(false); setGiving(false); setRecovering(false); setToast(null)
    return () => {
      mounted.current = false; saveEpoch.current++
      if (toastTimer.current !== null) clearTimeout(toastTimer.current)
    }
  }, [user?.id, profile?.household_id])

  const busy = giving || medicineSaveBusy
  const phase: ClinicPhase = recovering || busy && medicineSavePending ? 'recovering' : busy ? 'giving' : medicineSavePending ? 'recover' : medGiven ? 'treated' : !stats ? 'loading' : stats.is_sick ? 'sick' : 'healthy'

  const reasons: string[] = []
  if ((stats?.cleanliness ?? 100) < 20) reasons.push('Needs a bath')
  if ((stats?.sleep_quality ?? 100) < 15) reasons.push('Needs more sleep')
  if ((stats?.weight ?? 4) > 7.5) reasons.push('Lighter meals')

  async function giveMedicine(recover = false) {
    const generation = saveEpoch.current, token = Symbol('clinic-save')
    const active = () => mounted.current && saveEpoch.current === generation && saveScope.current === currentSaveScope
    if (!user?.id || !stats || stats.household_id !== profile?.household_id || saveLock.current || medicineSaveBusy || !active()) return
    if (!recover && (medicineSavePending || !stats.is_sick || medGiven)) return
    saveLock.current = token
    setGiving(true); setRecovering(recover)
    setToast(null)
    if (toastTimer.current !== null) { clearTimeout(toastTimer.current); toastTimer.current = null }
    try {
      const result = await finishMedicineSession(recover)
      if (!active()) return
      setMedGiven(!recover && result.success && result.changed === true)
      showResult(result)
    } catch {
      if (active()) showResult({ success: false, message: 'Could not save the treatment. Please try again.' })
    } finally {
      if (saveLock.current === token) saveLock.current = null
      if (active()) { setGiving(false); setRecovering(false) }
    }
  }

  function showResult(result: { success: boolean; message: string }) {
    const generation = saveEpoch.current
    const active = () => mounted.current && saveEpoch.current === generation && saveScope.current === currentSaveScope
    if (!active()) return
    setToastGood(result.success)
    setToast(result.message)
    if (toastTimer.current !== null) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => { if (active()) setToast(null) }, 3000)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: `url(${roomArt('hospital', isDark)})`, backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* Paws sit toward the front of the tabletop, with the ears clear of the care notes. */}
      <div className="absolute z-10" style={{ left: '50%', bottom: 'calc(43% - 36px)', transform: 'translateX(-50%)', width: 200, height: 200 }}>
        <PetTarget reaction={reaction}>
          <BlinkingEren size={200} src="/erenGood_notail.png" tailSrc="/erenGood_tail.png" />
        </PetTarget>
        <StinkyFlies cleanliness={stats?.cleanliness ?? 100} />
        {reaction.phase === PURR && <PurrFx bottom="62%" />}
        {medGiven && <Sparkles tint="#F5C820" />}
      </div>

      {toast && <CareToast msg={toast} ok={toastGood} top="65%" />}

      <ClinicControls phase={phase} reasons={reasons} weight={stats?.weight ?? 4}
        disabled={!user?.id || !stats || stats.household_id !== profile?.household_id}
        saveError={medicineSaveError}
        onGive={() => { playSound('ui_tap'); void giveMedicine(medicineSavePending) }}
        onClose={() => { playSound('ui_back'); onClose() }} />
    </div>
  )
}
