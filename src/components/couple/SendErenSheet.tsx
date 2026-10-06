'use client'

// ─── Send the cat ────────────────────────────────────────────────────────────
// A one-tap gesture for the other person: pick one of four little animated
// cats (SketchEren poses) and the cat carries it to them. A Meadow sheet: the
// four cats on soft tiles, each in a tint of its own; on send, the cat cheers
// and the sheet drops away by itself.

import { useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import { NUDGE_DEFS, type NudgeDef } from '@/lib/nudges'
import { useCat } from '@/hooks/useCat'
import SketchEren from '@/components/SketchEren'
import { Sheet, M, TINT, GROUND } from '@/components/meadow'

interface Props {
  partnerName: string
  onSend: (nudge: NudgeDef) => Promise<boolean>
  onClose: () => void
}

/** Each nudge's tile tint, by its id. */
const NUDGE_TINT: Record<string, string> = {
  loveyou: TINT.love,
  kiss:    GROUND.us,
  miss:    TINT.sky,
  think:   TINT.lilac,
}

/** The sheet's drop-away before the parent unmounts it (Sheet's EXIT_MS). */
const EXIT_MS = 180

export default function SendErenSheet({ partnerName, onSend, onClose }: Props) {
  const [open, setOpen] = useState(true)
  const [sentLabel, setSentLabel] = useState<string | null>(null)
  const [cooling, setCooling] = useState(false)
  const cat = useCat()
  const firstName = partnerName.split(' ')[0]
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }

  // Close in two steps so the sheet can drop away before the parent
  // unmounts it.
  function close() {
    if (!open) return
    setOpen(false)
    later(onClose, EXIT_MS)
  }

  async function handlePick(nudge: NudgeDef) {
    if (sentLabel || cooling) return
    playSound('ui_tap')
    const ok = await onSend(nudge)
    if (!ok) {
      // Within cooldown: a gentle note, and the sheet stays.
      setCooling(true)
      later(() => setCooling(false), 1600)
      return
    }
    setSentLabel(nudge.label)
    later(close, 1300)
  }

  return (
    <Sheet open={open} onClose={() => { playSound('ui_modal_close'); close() }}
      title={`Send ${cat.name} to ${firstName}`}>
      {sentLabel ? (
        // Sent: the cat is on the way.
        <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '4px 0 12px', textAlign: 'center' }}>
          <div style={{ animation: 'sesPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <SketchEren state="cheer" size={112} transparent noSpeech />
          </div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: M.text, overflowWrap: 'anywhere' }}>
            {cat.t('{name} is on {his} way!')}
          </p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: M.text2 }}>
            {firstName} is going to love this.
          </p>
        </div>
      ) : (
        <>
          <p aria-live="polite" style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: M.text2, textAlign: 'center' }}>
            {cooling ? cat.t('{name} needs a quick breather. Try again in a moment.') : 'Pick something to send.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {NUDGE_DEFS.map(nudge => (
              <button
                key={nudge.id}
                type="button"
                onClick={() => handlePick(nudge)}
                disabled={cooling}
                aria-label={`Send ${nudge.label}`}
                className="m-press m-focus"
                style={{
                  border: 0, borderRadius: 20, padding: '14px 8px 14px',
                  background: NUDGE_TINT[nudge.id] ?? M.soft,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  fontFamily: 'inherit', color: M.text, cursor: cooling ? 'default' : 'pointer',
                  opacity: cooling ? 0.5 : 1, transition: 'opacity 0.2s ease',
                }}
              >
                {/* The little animated cat, as it was: only the tile changed. */}
                <SketchEren state={nudge.state} size={76} transparent noSpeech />
                <span style={{ fontSize: 15, fontWeight: 800 }}>{nudge.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Global on purpose: an inline animation only resolves global names. */}
      <style jsx global>{`
        @keyframes sesPop {
          0%   { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </Sheet>
  )
}
