'use client'

// Chemistry lab — Eren-style room hosting the periodic-table study system
// (ported in phases from AminaChemistry). Phase 1 wires the bottom STUDY
// button to a placeholder overlay; the actual table / modes / SRS land in
// follow-up phases.

import { useState } from 'react'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'
import PeriodicTableOverlay from '@/components/chemistry/PeriodicTableOverlay'

interface Props { onClose: () => void }

export default function ChemistryScene(_props: Props) {
  void _props
  const isDark = useIsDark()
  const [overlayOpen, setOverlayOpen] = useState(false)

  function openStudy() {
    playSound('ui_tap')
    setOverlayOpen(true)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${isDark ? '/ChemistryNight.png' : '/ChemistryDay.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
      }} />

      {/* ══ EREN ══ sits on the rug, roughly centered with the desk above */}
      <div className="absolute z-10" style={{
        bottom: '22%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        <ErenIdleLayer>
          <BlinkingEren size={180} />
        </ErenIdleLayer>
      </div>

      {/* ══ BOTTOM ACTION BUTTON ══
          Pixel-art slab anchored to the bottom of the room. Honours the
          iOS / Android safe-area inset so it doesn't sit under the home
          indicator on devices that have one. */}
      <div className="absolute inset-x-0 flex justify-center z-20 px-8"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <button
          type="button"
          onClick={openStudy}
          className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px]"
          style={{
            background: 'linear-gradient(135deg, #84CC16, #65A30D)',
            borderRadius: 3,
            border: '2px solid #3F6212',
            boxShadow: '0 3px 0 #1A2E05',
            fontFamily: '"Press Start 2P"',
            fontSize: 8,
            letterSpacing: 1.5,
          }}>
          PERIODIC TABLE
        </button>
      </div>

      <LightSwitch targetBottom="22%" targetLeft="50%" persistKey="chemistry" />

      {overlayOpen && (
        <PeriodicTableOverlay onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  )
}
