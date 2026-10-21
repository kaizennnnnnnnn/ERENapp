'use client'

// ─── TickCelebration ─────────────────────────────────────────────────────────
// The moment a plan comes off the list: Eren hops in a burst of sparkles over
// a white card with the plan on it, and a word about where it went (the
// Hallway wall). Tap anywhere, or the button, to carry on.

import { useEffect, useRef } from 'react'
import { useCat } from '@/hooks/useCat'
import { M, MeadowIcon, PrimaryButton, TINT, TextButton, TYPE } from '@/components/meadow'

/** Where the sparkles sit around the cat, as offsets from its centre. */
const SPARKS = [
  { x: -78, y: -30, s: 22, d: 0.05 },
  { x: 70, y: -44, s: 18, d: 0.15 },
  { x: -60, y: 34, s: 16, d: 0.25 },
  { x: 82, y: 22, s: 22, d: 0.1 },
  { x: 0, y: -66, s: 16, d: 0.2 },
]

export default function TickCelebration({ title, onClose }: {
  /** The plan just ticked off; null hides it. */
  title: string | null
  onClose: () => void
}) {
  const cat = useCat()
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (title) cardRef.current?.focus() }, [title])
  if (!title) return null

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Ticked off"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      className="meadow-root"
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(47,43,40,.36)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        animation: 'tickFade 0.2s ease-out both',
      }}
    >
      <div ref={cardRef} tabIndex={-1} onClick={e => e.stopPropagation()} style={{
        outline: 'none', width: '100%', maxWidth: 340, boxSizing: 'border-box', borderRadius: 28, background: '#FFFFFF',
        padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'tickCardIn 0.34s cubic-bezier(0.34,1.4,0.64,1) both',
      }}>
        <div style={{
          position: 'relative', width: '100%', boxSizing: 'border-box', borderRadius: 22, background: TINT.leaf,
          height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          {SPARKS.map((p, i) => (
            <span key={i} aria-hidden style={{
              position: 'absolute', left: '50%', top: '50%', lineHeight: 0,
              transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
            }}>
              <span style={{ display: 'block', animation: `tickSpark 0.6s ${p.d + 0.15}s cubic-bezier(0.34,1.56,0.64,1) both` }}>
                <MeadowIcon name="sparkle" size={p.s} />
              </span>
            </span>
          ))}
          {/* image-rendering stays `auto`: a hi-res sprite scaled down. */}
          <img src="/erenGood.png" alt="" draggable={false} style={{
            width: 136, height: 136, objectFit: 'contain', imageRendering: 'auto', display: 'block',
            animation: 'tickHop 0.7s 0.1s cubic-bezier(0.34,1.56,0.64,1) both',
          }} />
          <span aria-hidden style={{
            position: 'absolute', right: 'calc(50% - 74px)', bottom: 16, width: 34, height: 34, borderRadius: 999,
            background: M.leaf, border: '3px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'tickSpark 0.5s 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <MeadowIcon name="check" size={16} mono color="#FFFFFF" />
          </span>
        </div>

        <span style={{ ...TYPE.label, color: M.leafInk, marginTop: 16 }}>Ticked off</span>
        <h2 style={{
          margin: '6px 0 0', fontSize: 22, lineHeight: 1.25, fontWeight: 800, color: M.text, textAlign: 'center',
          textWrap: 'balance', overflowWrap: 'anywhere',
        }}>{title}</h2>
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
          {cat.t("{name} hung it on the Hallway wall.")}
        </p>

        <PrimaryButton onClick={onClose} style={{ marginTop: 16 }}>Yay</PrimaryButton>
        <TextButton href="/hallway" tone="leaf" style={{ marginTop: 6 }}>See the wall</TextButton>
      </div>

      <style>{`
        @keyframes tickFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tickCardIn { 0% { transform: translateY(14px) scale(.94); opacity: 0 } 100% { transform: none; opacity: 1 } }
        @keyframes tickHop {
          0% { transform: translateY(40px) scale(.7); opacity: 0 }
          55% { transform: translateY(-12px) scale(1.04); opacity: 1 }
          100% { transform: none; opacity: 1 }
        }
        @keyframes tickSpark { 0% { transform: scale(0) rotate(-40deg); opacity: 0 } 100% { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) {
          [style*="tickHop"], [style*="tickSpark"], [style*="tickCardIn"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
