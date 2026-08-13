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
// Eren works the stand: he lives inside a "stage" that exactly matches the
// picture, clipped at the serving counter, so only his top half shows through
// the window — same trick the bakery uses to seat him behind its counter.
//
// Reached from the home dock via the 'smoke' cloud transition.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useCare } from '@/contexts/CareContext'
import { playSound } from '@/lib/sounds'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import { requestCloudNav } from '@/components/CloudTransition'

// Intrinsic size of /ShawarmaKiosk.png. Drives the stage aspect ratio and
// the letterbox band height, so swapping in a repaint at a different size
// only needs these two numbers changed.
const PIC = { src: '/ShawarmaKiosk.png', w: 768, h: 1376 }

// Averaged over the top 6 / bottom 6 rows of the PNG.
const SKY_EDGE = '#0C0E1F'
const ASPHALT_EDGE = '#63565F'

// First row of the serving counter's lit top surface, from a column scan of
// the PNG (row 839 of 1376) — NOT the front lip a dozen rows lower, which
// would paint Eren over the counter and read as him standing in front of it.
const COUNTER_PCT = 60.97
// Eren's box, sized in cqi (container-query inline-size = % of the PICTURE's
// width, see the stage's containerType) so he tracks the picture and stays
// glued to the counter. vw would balloon him on a short/wide viewport, where
// the picture goes height-constrained and is narrower than the screen.
const EREN_CQI = 32
// How much of him clears the counter: half — chef hat, face and chest.
const EREN_SHOW = 0.5
const EREN_BOTTOM = `${-(1 - EREN_SHOW) * EREN_CQI}cqi`

// ErenCook.png (chef-hat pose) eye coords — the same measured layout the
// kitchen uses: a pixel-scan of the 959×1536 sprite translated to the square
// BlinkingEren box, where the portrait sprite height-fits and so occupies the
// middle ~62.6% of the box width. Catchlights are mirrored per eye (each sits
// on the side of its iris nearest the nose).
const COOK_EYES = {
  lidTop: '37.19%', lidWidth: '5.42%', lidLeftA: '40.79%', lidLeftB: '54.79%',
  maskTop: '37.19%', maskLeftA: '40.79%', maskLeftB: '54.79%', maskW: '5.42%', maskH: '4.62%',
  glintLeftA: '60.3%', glintTopA: '3%', glintLeftB: '20.5%', glintTopB: '3%', glintW: '18%',
}

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

      {/* ══ STAGE ══ the whole picture, fit to width and centred. Eren lives
          inside it so he always lines up with the painted counter. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: '100%', aspectRatio: `${PIC.w} / ${PIC.h}`, maxHeight: '100%', containerType: 'inline-size' }}>
          <img src={PIC.src} alt="Shawarma kiosk" draggable={false} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'fill', WebkitUserSelect: 'none', userSelect: 'none',
          }} />

          {/* ══ EREN ══ working the window. The clip box ends at the counter's
              top edge, so everything below his chest is hidden behind it and
              he reads as standing inside the kiosk rather than pasted on it.
              Breathing lives in BlinkingEren, idle wiggles in ErenIdleLayer. */}
          <div className="absolute left-0 right-0 top-0 overflow-hidden pointer-events-none"
            style={{ height: `${COUNTER_PCT}%`, zIndex: 10 }}>
            <div className="absolute left-1/2" style={{ bottom: EREN_BOTTOM, transform: 'translateX(-50%)' }}>
              <ErenIdleLayer>
                {/* The kiosk is painted at night whatever the app's theme is,
                    so the dim is fixed here instead of left to BlinkingEren's
                    isDark filter: enough to sit him in the window's own light,
                    not so much that the white fur goes grey. */}
                <BlinkingEren
                  size={`${EREN_CQI}cqi`}
                  src="/ErenCook.png"
                  eyes={COOK_EYES}
                  style={{ filter: 'brightness(0.86) saturate(0.92)' }}
                />
              </ErenIdleLayer>
            </div>
          </div>
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
