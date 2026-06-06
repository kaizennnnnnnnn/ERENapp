'use client'

// ─── LightSwitch ──────────────────────────────────────────────────────────
// A night-only wall switch in the corner of a room. Looks like a classic
// pixel-art wall toggle: cream faceplate, two screws, dark recessed slot,
// gold lever that snaps between up (off) and down (on). Tapping it lights
// a visible ceiling lamp + a soft warm cone down onto Eren so the source
// of the light is obvious and never reads as just "Eren glows".

import { useEffect, useState } from 'react'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'

interface Props {
  /** Which corner the wall switch sits in. Default: 'right'. */
  side?: 'left' | 'right'
  /** How far down from the top of the scene the switch hangs. */
  switchTop?: string
  /** Where the visible ceiling lamp hangs. */
  lampTop?: string
  /** Where the light should pool — defaults to Eren's usual standing spot. */
  targetLeft?: string
  targetBottom?: string
  /**
   * When true, replaces the small ceiling-lamp dot with a proper glowing
   * bulb: bigger warm halo, ambient rim, and an animated star-ray burst.
   * Used in the kitchen where the wall art has a visible bulb fixture
   * the player expects to actually light up.
   */
  dramatic?: boolean
  /**
   * Optional independent X/Y for the dramatic bulb effect, when the
   * in-art bulb isn't directly above Eren. Falls back to lampTop /
   * targetLeft so simpler rooms don't need to set them.
   */
  bulbTop?: string
  bulbLeft?: string
  /**
   * Stable identifier for the room/scene this switch belongs to. When
   * provided, the on/off state is persisted to localStorage so that
   * swiping away from a care room and back keeps the light on. The home
   * page already persists across navigation because it doesn't unmount;
   * the care rooms unmount on swipe, so each one needs its own key.
   */
  persistKey?: string
}

const PERSIST_PREFIX = 'eren_light_'

function readPersisted(persistKey: string | undefined): boolean {
  if (!persistKey || typeof window === 'undefined') return false
  try { return localStorage.getItem(PERSIST_PREFIX + persistKey) === '1' }
  catch { return false }
}

function writePersisted(persistKey: string | undefined, value: boolean): void {
  if (!persistKey || typeof window === 'undefined') return
  try { localStorage.setItem(PERSIST_PREFIX + persistKey, value ? '1' : '0') }
  catch { /* quota / privacy mode — fall through */ }
}

export default function LightSwitch({
  side         = 'right',
  switchTop    = '22%',
  lampTop      = '7%',
  targetLeft   = '50%',
  targetBottom = '14%',
  dramatic     = false,
  bulbTop,
  bulbLeft,
  persistKey,
}: Props) {
  const isDark = useIsDark()
  // Lazy init from localStorage so the first render already shows the
  // persisted state — avoids a 1-frame flash of OFF on remount.
  const [on, setOn] = useState<boolean>(() => readPersisted(persistKey))
  useEffect(() => { writePersisted(persistKey, on) }, [on, persistKey])
  if (!isDark) return null

  return (
    <>
      {/* ─── Visible light source + cone (only while on) ─── */}
      {on && (
        <>
          {/* Bulb — simple 9px dot by default, or a full glowing bulb with
              star-rays + halo in dramatic mode (used by the kitchen, where
              the wall art has a visible bulb fixture). */}
          {dramatic ? (
            <>
              {/* Outer halo — big, soft, pulses with the cone. Slightly
                  more saturated than v1 so the bulb reads as actively
                  emitting rather than ambient. */}
              <div className="absolute pointer-events-none" style={{
                top: bulbTop ?? lampTop,
                left: bulbLeft ?? targetLeft,
                transform: 'translate(-50%, -50%)',
                width: 68, height: 68,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,232,170,0.78) 0%, rgba(255,216,128,0.46) 35%, rgba(255,204,108,0.18) 65%, transparent 100%)',
                filter: 'blur(2px)',
                zIndex: 12,
                animation: 'lsBulbHalo 2.6s ease-in-out infinite',
              }} />
              {/* Animated star-rays — slow rotation so light feels alive. */}
              <div className="absolute pointer-events-none" style={{
                top: bulbTop ?? lampTop,
                left: bulbLeft ?? targetLeft,
                transform: 'translate(-50%, -50%)',
                width: 74, height: 74,
                zIndex: 13,
                animation: 'lsBulbRays 9s linear infinite',
              }}>
                {/* Four crossed rays drawn with conic-gradient so they
                    feather softly instead of looking like hard spokes. */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,240,190,0.78) 8deg, transparent 22deg, transparent 88deg, rgba(255,240,190,0.78) 98deg, transparent 112deg, transparent 178deg, rgba(255,240,190,0.78) 188deg, transparent 202deg, transparent 268deg, rgba(255,240,190,0.78) 278deg, transparent 292deg, transparent 360deg)',
                  borderRadius: '50%',
                  filter: 'blur(3px)',
                  opacity: 0.88,
                  WebkitMask: 'radial-gradient(circle, transparent 20%, black 30%, black 90%, transparent 100%)',
                  mask: 'radial-gradient(circle, transparent 20%, black 30%, black 90%, transparent 100%)',
                }} />
              </div>
              {/* Bulb itself — bright warm core with the same gradient family
                  but ~2x the previous radius so it reads as a lit bulb. */}
              <div className="absolute pointer-events-none" style={{
                top: bulbTop ?? lampTop,
                left: bulbLeft ?? targetLeft,
                transform: 'translate(-50%, -50%)',
                width: 20, height: 20,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 38%, #FFFFFF 0%, #FFF1B8 35%, #F5C870 70%, #A06628 95%, transparent 100%)',
                boxShadow: '0 0 14px rgba(255,238,180,1), 0 0 30px rgba(255,218,130,0.78), 0 0 60px rgba(255,206,108,0.45)',
                zIndex: 14,
                animation: 'lsBulbCorePulse 2.6s ease-in-out infinite',
              }} />
            </>
          ) : (
            /* Original simple lamp dot — unchanged behaviour for non-dramatic
               rooms so existing scenes keep their current quiet light source. */
            <div className="absolute pointer-events-none" style={{
              top: lampTop,
              left: targetLeft,
              transform: 'translate(-50%, -50%)',
              width: 9, height: 9,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #FFF1B8 0%, #EAC470 55%, #9E6428 90%, transparent 100%)',
              boxShadow: '0 0 7px rgba(255,232,160,0.5), 0 0 16px rgba(255,210,120,0.25), 0 0 32px rgba(255,200,100,0.12)',
              opacity: 0.85,
              zIndex: 12,
              animation: 'lsHaloPulse 4s ease-in-out infinite',
            }} />
          )}

          {/* Soft directional pool — pure radial-gradient ellipse. NO
              clipPath, NO straight edges. The old trapezoid had two
              diagonal sides that, under mix-blend-mode:screen on the
              dark blue KitchenDark.png, turned the warm yellow into a
              cool cyan stripe — visible as a vertical line during
              room-swipes because the scene container's translateX moved
              the edge into the eye. A radial gradient has no edge to
              leak: opacity falls smoothly to zero in every direction. */}
          <div className="absolute pointer-events-none" style={{
            top: lampTop,
            bottom: targetBottom,
            left: targetLeft,
            transform: 'translateX(-50%)',
            width: 'min(85%, 400px)',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(255,236,180,0.32) 0%, rgba(255,236,180,0.18) 40%, rgba(255,236,180,0) 75%)',
            filter: 'blur(14px)',
            mixBlendMode: 'screen',
            zIndex: 11,
            animation: 'lsHaloPulse 4s ease-in-out infinite',
          }} />

          {/* Soft pool at Eren's feet. */}
          <div className="absolute pointer-events-none" style={{
            left: targetLeft,
            bottom: targetBottom,
            width: 320, height: 220,
            transform: 'translate(-50%, 32%)',
            background: 'radial-gradient(ellipse at center, rgba(255,236,180,0.22) 0%, rgba(255,236,180,0.10) 38%, rgba(255,236,180,0.02) 68%, rgba(255,236,180,0) 90%)',
            mixBlendMode: 'screen',
            filter: 'blur(8px)',
            zIndex: 11,
          }} />
        </>
      )}

      {/* ─── Wall switch ─── */}
      <button
        onClick={(e) => { e.stopPropagation(); setOn(o => !o); playSound('ui_toggle') }}
        className="absolute"
        style={{
          top: switchTop,
          [side]: 12,
          zIndex: 28,
          width: 38, height: 58,
          padding: 0,
          // Cream wall plate — reads as a clearly visible faceplate against
          // any room's wall tone.
          background: 'linear-gradient(180deg, #F0E6D0 0%, #D6C6A2 100%)',
          border: '2px solid #2A1810',
          borderRadius: 4,
          boxShadow: '0 4px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.6), 0 0 14px rgba(var(--accent-rgb), 0.55), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.18)',
          cursor: 'pointer',
        }}
        aria-label={on ? 'Turn light off' : 'Turn light on'}
      >
        {/* Top mounting screw */}
        <div style={{
          position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)',
          width: 5, height: 5, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #999 0%, #555 55%, #222 100%)',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.5)',
        }}>
          {/* Slot line on the screw */}
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, transform: 'translateY(-50%) rotate(35deg)', background: 'rgba(0,0,0,0.6)' }} />
        </div>

        {/* Recessed dark slot the lever rides in */}
        <div style={{
          position: 'absolute', top: 12, bottom: 12, left: 9, right: 9,
          background: 'linear-gradient(180deg, #1A0F0A 0%, #08040A 100%)',
          borderRadius: 3,
          border: '1px solid #050204',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.7)',
        }}>
          {/* Toggle lever */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, ${on ? '8px' : '-8px'})`,
            width: 12, height: 16,
            background: on
              ? 'linear-gradient(180deg, #FFEAA0 0%, #E0B850 50%, #B88830 100%)'
              : 'linear-gradient(180deg, #6E6258 0%, #322820 100%)',
            borderRadius: 2,
            border: '1px solid #0A0608',
            boxShadow: on
              ? '0 0 10px rgba(255,232,160,0.85), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.4)'
              : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4)',
            transition: 'transform 130ms ease, background 200ms ease, box-shadow 200ms ease',
          }} />
        </div>

        {/* Bottom mounting screw */}
        <div style={{
          position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
          width: 5, height: 5, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #999 0%, #555 55%, #222 100%)',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.5)',
        }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, transform: 'translateY(-50%) rotate(-25deg)', background: 'rgba(0,0,0,0.6)' }} />
        </div>
      </button>
    </>
  )
}
