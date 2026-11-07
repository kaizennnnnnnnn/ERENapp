'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCare } from '@/contexts/CareContext'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import { EXHAUSTED_ENERGY } from '@/lib/gameRewards'
import { useKioskRecord } from '@/components/kiosk/useKioskRecord'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import KioskInterior, { KIOSK_VIEW_SRCS } from '@/components/kiosk/KioskInterior'
import { requestCloudNav } from '@/components/CloudTransition'
import KioskSaveNotice from '@/components/kiosk/KioskSaveNotice'
import KioskFrontControls from '@/components/kiosk/KioskFrontControls'
import { KIOSK as K, KIOSK_CSS, kioskPanel, kioskRound } from '@/components/kiosk/kioskTheme'
import { RoundButton, MeadowIcon } from '@/components/meadow'

// Art coordinates keep the cook behind the front rail on every screen size.
const PIC = { src: '/ShawarmaKiosk.png?v=2', w: 768, h: 1376 }
const SKY_EDGE = '#0B0D1E', ASPHALT_EDGE = '#65555C'
const RAIL_PCT = 60.25, EREN_CQI = 32, EREN_SHOW = 0.64
const EREN_BOTTOM = `${-(1 - EREN_SHOW) * EREN_CQI}cqi`
const COOK_EYES = {
  lidTop: '37.19%', lidWidth: '5.42%', lidLeftA: '40.79%', lidLeftB: '54.79%',
  maskTop: '37.19%', maskLeftA: '40.79%', maskLeftB: '54.79%', maskW: '5.42%', maskH: '4.62%',
  glintLeftA: '60.3%', glintTopA: '3%', glintLeftB: '20.5%', glintTopB: '3%', glintW: '18%',
}
type Phase = 'front' | 'entering' | 'inside' | 'leaving'
const ENTER_MS = 620, LEAVE_MS = 420

export default function ShawarmaPage() {
  const { setHideStats } = useCare()
  const { user, profile } = useAuth()
  const { stats } = useErenStats()
  const cat = useCat(), record = useKioskRecord()
  const [phase, setPhase] = useState<Phase>('front')
  const tired = (stats?.energy ?? 100) < EXHAUSTED_ENERGY
  const payable = record.session ? record.session.paid : !record.workedTonight && !tired
  const practiceReason = record.session?.blocked
    ? cat.t('{name} needs a rest before another paid shift.')
    : (record.session && !record.session.paid) || record.workedTonight
      ? 'Your paid shift is already complete for tonight.'
      : tired ? cat.t('{name} needs a rest before another paid shift.') : null
  const mine = !!record.lastShift && !!user && record.lastShift.user_id === user.id
  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])
  useEffect(() => {
    const timer = setTimeout(() => { KIOSK_VIEW_SRCS.forEach(src => { const img = new window.Image(); img.src = src }) }, 1200)
    return () => clearTimeout(timer)
  }, [])
  const transition = useRef(0)
  useEffect(() => {
    transition.current++; setPhase('front')
    return () => { transition.current++ }
  }, [user?.id, profile?.household_id])
  const goInside = useCallback(async () => {
    const token = ++transition.current
    if (!await record.beginShift() || token !== transition.current) return
    playSound('ui_modal_open'); setPhase('entering')
    const pushIn = new Promise(resolve => setTimeout(resolve, ENTER_MS))
    const firstWall = new window.Image(); firstWall.src = KIOSK_VIEW_SRCS[0]
    Promise.all([pushIn, firstWall.decode().catch(() => null)])
      .then(() => { if (token === transition.current) setPhase('inside') })
  }, [record.beginShift])
  const goOutside = useCallback(() => { setPhase('leaving'); setTimeout(() => setPhase('front'), LEAVE_MS) }, [])
  const bandH = `max(0px, calc((100cqh - 100cqw * ${PIC.h} / ${PIC.w}) / 2))`
  return <div className="meadow-root kiosk-theme fixed inset-0 z-40 overflow-hidden select-none game-shell" style={{ background: '#040304', overflow: 'clip', containerType: 'size' }}>
    <style>{KIOSK_CSS + `
      @keyframes kioskPushIn { 0% {transform:scale(1);opacity:1} 62% {transform:scale(1.5);opacity:1} 100% {transform:scale(2.15);opacity:0} }
      @keyframes kioskVeilIn { from {opacity:0} to {opacity:1} }
      @keyframes kioskVeilOut { from {opacity:1} to {opacity:0} }
      @keyframes kioskStepIn { from {transform:scale(1.16);opacity:0} to {transform:scale(1);opacity:1} }
      @keyframes kioskStepOut { from {transform:scale(1);opacity:1} to {transform:scale(1.16);opacity:0} }
    `}</style>
    <div className="absolute inset-0" aria-hidden={phase === 'inside' || phase === 'leaving'} style={{
      pointerEvents: phase === 'front' ? undefined : 'none',
      animation: phase === 'entering' ? `kioskPushIn ${ENTER_MS}ms cubic-bezier(0.5, 0, 0.75, 0) both` : undefined,
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${PIC.src})`, backgroundSize: 'cover',
        backgroundPosition: 'center', filter: 'blur(20px) brightness(0.4)', transform: 'scale(1.1)' }} />
      <div className="absolute top-0 inset-x-0 z-[15] pointer-events-none" style={{ height: bandH,
        background: `linear-gradient(180deg, #04050C 0%, #080A16 55%, ${SKY_EDGE} 100%)` }} />
      <div className="absolute bottom-0 inset-x-0 z-[15] pointer-events-none" style={{ height: bandH,
        background: `linear-gradient(180deg, ${ASPHALT_EDGE} 0%, #4C4148 62%, #2E272C 100%)` }} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: '100%', aspectRatio: `${PIC.w} / ${PIC.h}`, maxHeight: '100%', containerType: 'inline-size' }}>
          <img src={PIC.src} alt="Shawarma kiosk" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />
          <div className="absolute left-0 right-0 top-0 overflow-hidden pointer-events-none" style={{ height: `${RAIL_PCT}%`, zIndex: 10 }}>
            <div className="absolute left-1/2" style={{ bottom: EREN_BOTTOM, transform: 'translateX(-50%)' }}>
              <ErenIdleLayer><BlinkingEren size={`${EREN_CQI}cqi`} src="/ErenCook.png" eyes={COOK_EYES} style={{ filter: 'brightness(0.86) saturate(0.92)' }} /></ErenIdleLayer>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 48%, transparent 42%, rgba(0,0,0,0.35) 78%, rgba(0,0,0,0.65) 100%)' }} />
      <header style={{ position: 'absolute', zIndex: 30, left: 16, right: 16, top: 'calc(14px + env(safe-area-inset-top, 0px))',
        display: 'flex', gap: 12, alignItems: 'center' }}>
        <RoundButton ariaLabel="Back to home" style={kioskRound} onClick={() => { playSound('ui_back'); requestCloudNav('/home', 'smoke') }}>
          <MeadowIcon name="chevronLeft" size={20} mono color={K.text} />
        </RoundButton>
        <div style={{ ...kioskPanel, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MeadowIcon name="moon" size={21} mono color={K.leaf} /><div><h1 style={{ fontSize: 18, lineHeight: 1.2, fontWeight: 800, margin: 0 }}>Shawarma</h1>
            <div style={{ fontSize: 12, color: K.muted, marginTop: 2 }}>The night shift</div></div>
        </div>
      </header>
      {phase === 'front' && <KioskFrontControls record={record} mine={mine} practiceReason={practiceReason}
        disabled={record.saving || record.pending > 0} onEnter={() => { void goInside() }} />}
      {phase === 'front' && (record.saving || record.pending > 0) && <div style={{ position: 'absolute', zIndex: 35,
        top: 'calc(88px + env(safe-area-inset-top, 0px))', left: 16, right: 16 }}>
        <KioskSaveNotice busy={record.saving} error={record.saveError} onRetry={() => { void record.retrySave() }} />
      </div>}
      {phase === 'front' && record.startError && !record.pending && <div role="status" style={{ ...kioskPanel, position: 'absolute', zIndex: 35,
        top: 'calc(88px + env(safe-area-inset-top, 0px))', left: 16, right: 16, padding: 14, fontSize: 14, lineHeight: 1.4 }}>{record.startError}</div>}
    </div>
    {phase !== 'front' && <div className="absolute inset-0 z-[45] pointer-events-none" style={{ background: '#050408',
      animation: phase === 'entering' ? `kioskVeilIn ${ENTER_MS}ms ease-in both` : phase === 'leaving' ? `kioskVeilOut ${LEAVE_MS}ms ease-out both` : undefined }} />}
    {(phase === 'inside' || phase === 'leaving') && <div className="absolute inset-0 z-[60]" style={{ animation: phase === 'leaving'
      ? `kioskStepOut ${LEAVE_MS}ms ease-in both` : 'kioskStepIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
      <KioskInterior onExit={goOutside} record={record} payable={payable} practiceReason={practiceReason} />
    </div>}
  </div>
}
