'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '@/lib/sounds'
import { NUDGE_DEFS, type NudgeDef } from '@/lib/nudges'
import SketchEren from '@/components/SketchEren'
import {
  PINK, PINK_HI, OBSIDIAN_FACE, OBSIDIAN_BTN, pinkText, accentA,
} from '@/components/obsidian'
import { IconHeartDuo } from '@/components/PixelIcons'

interface Props {
  partnerName: string
  onSend: (nudge: NudgeDef) => Promise<boolean>
  onClose: () => void
}

export default function SendErenSheet({ partnerName, onSend, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [sentLabel, setSentLabel] = useState<string | null>(null)
  const [cooling, setCooling] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  async function handlePick(nudge: NudgeDef) {
    if (sentLabel || cooling) return
    playSound('ui_tap')
    const ok = await onSend(nudge)
    if (!ok) {
      // Within cooldown — show a gentle note and don't close.
      setCooling(true)
      setTimeout(() => setCooling(false), 1600)
      return
    }
    setSentLabel(nudge.label)
    setTimeout(() => { onClose() }, 1300)
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={() => { playSound('ui_modal_close'); onClose() }} />

      <div className="relative max-w-md w-full mx-auto flex flex-col overflow-hidden p-4 gap-4"
        style={{
          ...OBSIDIAN_FACE,
          borderRadius: '6px 6px 0 0',
          borderBottom: 'none',
          animation: 'sesSlide 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

        {/* Handle */}
        <div className="flex justify-center" style={{ marginTop: -4 }}>
          <div style={{ width: 36, height: 3, background: PINK, boxShadow: `0 0 4px ${accentA(0.5)}` }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconHeartDuo size={14} />
            <span className="font-pixel" style={{ fontSize: 9, letterSpacing: 1.5, ...pinkText }}>
              SEND EREN TO {partnerName.split(' ')[0].toUpperCase()}
            </span>
          </div>
          <button onClick={() => { playSound('ui_modal_close'); onClose() }}
            className="w-7 h-7 flex items-center justify-center active:translate-y-[1px] transition-transform"
            style={{ ...OBSIDIAN_BTN, color: PINK_HI, fontFamily: '"Press Start 2P"', fontSize: 8 }}>
            ✕
          </button>
        </div>

        {sentLabel ? (
          // Confirmation state — Eren on his way
          <div className="flex flex-col items-center gap-2 py-6">
            <div style={{ animation: 'sesPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <SketchEren state="cheer" size={96} transparent noSpeech />
            </div>
            <p className="font-pixel text-center" style={{ fontSize: 8, ...pinkText, letterSpacing: 1 }}>
              EREN IS ON HIS WAY!
            </p>
            <p className="text-xs text-center" style={{ color: '#9a8aa8' }}>
              {partnerName.split(' ')[0]} is going to love this
            </p>
          </div>
        ) : (
          <>
            <p className="font-pixel text-center" style={{ fontSize: 6, color: '#9a8aa8', letterSpacing: 1 }}>
              {cooling ? 'EREN NEEDS A QUICK BREATHER...' : 'PICK SOMETHING TO SEND'}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {NUDGE_DEFS.map(nudge => (
                <button
                  key={nudge.id}
                  onClick={() => handlePick(nudge)}
                  disabled={cooling}
                  className="flex flex-col items-center gap-1.5 p-3 relative active:translate-y-[1px] transition-transform"
                  style={{
                    ...OBSIDIAN_BTN,
                    opacity: cooling ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    width: 48, height: 48,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    filter: `drop-shadow(0 0 5px ${accentA(0.3)})`,
                  }}>
                    <SketchEren state={nudge.state} size={48} transparent noSpeech />
                  </div>
                  <span className="font-pixel" style={{
                    fontSize: 7, letterSpacing: 1, color: PINK_HI,
                    textShadow: `0 0 4px ${accentA(0.35)}`,
                  }}>
                    {nudge.label.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes sesSlide {
          0%   { transform: translateY(100%); opacity: 0.6; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes sesPop {
          0%   { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
