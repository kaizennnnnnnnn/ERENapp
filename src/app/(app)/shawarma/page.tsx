'use client'

// ═══════════════════════════════════════════════════════════════════════════
// SHAWARMA KIOSK — the late-night stand at the end of the street.
// ──────────────────────────────────────────────────────────────────────────
// Same presentation contract as the bakery: the picture is shown WHOLE (fit
// to width) over a blurred copy of itself, so nothing of the kiosk is ever
// cropped. The letterbox bands above and below are painted in the picture's
// own measured edge colours (night sky #0C0E1F on top, asphalt #63565F
// below — sampled off the PNG, not eyeballed) so the art reads as extending
// to the screen edges instead of sitting in bars.
//
// Reached from the home dock via the 'smoke' cloud transition.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useCare } from '@/contexts/CareContext'
import { playSound } from '@/lib/sounds'
import { requestCloudNav } from '@/components/CloudTransition'

// Intrinsic size of /ShawarmaKiosk.png. Drives the stage aspect ratio and
// the letterbox band height, so swapping in a repaint at a different size
// only needs these two numbers changed.
const PIC = { src: '/ShawarmaKiosk.png', w: 768, h: 1376 }

// Averaged over the top 6 / bottom 6 rows of the PNG.
const SKY_EDGE = '#0C0E1F'
const ASPHALT_EDGE = '#63565F'

export default function ShawarmaPage() {
  const { setHideStats } = useCare()

  // Full-screen scene — hide the persistent StatsHeader while we're here.
  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  // Height of ONE empty band. Clamps to 0 on viewports wide enough that the
  // picture becomes height-constrained instead of width-constrained.
  const bandH = `max(0px, calc((100dvh - 100vw * ${PIC.h} / ${PIC.w}) / 2))`

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none game-shell" style={{ background: '#040304' }}>

      {/* ══ BLURRED FILL ══ soft surround behind the bands, so any sliver the
          bands don't cover still shows kiosk colours rather than flat black. */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${PIC.src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(20px) brightness(0.4)',
        transform: 'scale(1.1)',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
      }} />

      {/* ══ TOP BAND ══ night sky, darkening upward away from the streetlight. */}
      <div className="absolute top-0 inset-x-0 z-[15] pointer-events-none" style={{
        height: bandH,
        background: `linear-gradient(180deg, #04050C 0%, #080A16 55%, ${SKY_EDGE} 100%)`,
      }} />

      {/* ══ BOTTOM BAND ══ the pavement carried down to the viewport edge. */}
      <div className="absolute bottom-0 inset-x-0 z-[15] pointer-events-none" style={{
        height: bandH,
        background: `linear-gradient(180deg, ${ASPHALT_EDGE} 0%, #4C4148 62%, #2E272C 100%)`,
      }} />

      {/* ══ STAGE ══ the whole picture, fit to width and centred. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: '100%', aspectRatio: `${PIC.w} / ${PIC.h}`, maxHeight: '100%' }}>
          <img src={PIC.src} alt="Shawarma kiosk" draggable={false} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'fill', WebkitUserSelect: 'none', userSelect: 'none',
          }} />
        </div>
      </div>

      {/* ══ VIGNETTE ══ keeps the alley feeling closed-in, and stops the band
          seams from being the brightest thing at the screen edges. */}
      <div className="absolute inset-0 z-20 pointer-events-none" style={{
        background: 'radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.35) 78%, rgba(0,0,0,0.65) 100%)',
      }} />

      {/* ══ BACK ══ same smoke transition home, so the trip reads both ways. */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center px-3"
        style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={() => { playSound('ui_back'); requestCloudNav('/home', 'smoke') }}
          aria-label="Back to home"
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'rgba(20,10,8,0.65)',
            border: '2px solid rgba(245,156,69,0.65)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.45)',
          }}>
          <ChevronLeft size={16} className="text-orange-100" />
        </button>
      </div>
    </div>
  )
}
