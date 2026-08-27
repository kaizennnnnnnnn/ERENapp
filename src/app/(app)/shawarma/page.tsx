'use client'

// ═══════════════════════════════════════════════════════════════════════════
// SHAWARMA KIOSK — the late-night stand at the end of the street.
// ──────────────────────────────────────────────────────────────────────────
// Same presentation contract as the bakery: the picture is shown WHOLE (fit
// to width) over a blurred copy of itself, so nothing of the kiosk is ever
// cropped. The letterbox bands above and below are painted in the picture's
// own measured edge colours (night sky #0B0D1E on top, asphalt #65555C
// below — sampled off the PNG, not eyeballed) so the art reads as extending
// to the screen edges instead of sitting in bars.
//
// Eren works the stand: he lives inside a "stage" that exactly matches the
// picture, clipped at the serving counter, so only his top half shows through
// the window — same trick the bakery uses to seat him behind its counter.
//
// Reached from the home dock via the 'smoke' cloud transition.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { IconCrown } from '@/components/PixelIcons'
import { useCare } from '@/contexts/CareContext'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { playSound } from '@/lib/sounds'
import { EXHAUSTED_ENERGY } from '@/lib/gameRewards'
import { useKioskRecord } from '@/components/kiosk/useKioskRecord'
import { GRADE_WORD } from '@/components/kiosk/kioskEconomy'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import KioskInterior, { KIOSK_VIEW_SRCS } from '@/components/kiosk/KioskInterior'
import { requestCloudNav } from '@/components/CloudTransition'

// Intrinsic size of /ShawarmaKiosk.png. Drives the stage aspect ratio and
// the letterbox band height, so swapping in a repaint at a different size
// only needs these two numbers changed. The ?v= is a cache-bust: the service
// worker serves images stale-while-revalidate, so a repaint dropped at the
// same path shows the OLD art until the query changes.
const PIC = { src: '/ShawarmaKiosk.png?v=2', w: 768, h: 1376 }

// Averaged over the top 6 / bottom 6 rows of the PNG.
const SKY_EDGE = '#0B0D1E'
const ASPHALT_EDGE = '#65555C'

// Top edge of the window's bottom RAIL — the metal bar that runs across the
// opening, in front of the interior (row 829 of 1376, the dark outline above
// its lit face; a column scan finds it at the same row at every x Eren
// occupies). Clipping at the counter's top surface instead — 20 rows lower —
// hides his legs but leaves the rail painted across his chest, which reads as
// him standing *through* it. The rail is the frontmost thing behind the
// counter, so it's what he has to stand behind.
const RAIL_PCT = 60.25
// Eren's box, sized in cqi (container-query inline-size = % of the PICTURE's
// width, see the stage's containerType) so he tracks the picture and stays
// glued to the rail. vw would balloon him on a short/wide viewport, where the
// picture goes height-constrained and is narrower than the screen.
const EREN_CQI = 32
// How much of him clears the rail. Half cut him at the chin — a head on a
// ledge. 0.64 lands the cut under his chest, just above the front paws, so he
// stands at the window like someone actually serving.
const EREN_SHOW = 0.64
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

// Stepping through the window. 'entering' runs the push-in on the front and
// darkens to black; the interior only mounts once we're through, so its
// arrival animation always starts from a clean black screen.
type Phase = 'front' | 'entering' | 'inside' | 'leaving'
const ENTER_MS = 620
const LEAVE_MS = 420

export default function ShawarmaPage() {
  const { setHideStats } = useCare()
  const { user } = useAuth()
  const { stats } = useErenStats()
  // Owned up here rather than inside the kiosk: the board on the front reads
  // it too, and two copies would mean two fetches of the same book.
  const record = useKioskRecord()
  const [phase, setPhase] = useState<Phase>('front')

  // A night only pays once, and only if the cat has the energy for it. Both
  // reasons are said out loud on the front door rather than discovered at the
  // till — nobody should work a shift to find out it was unpaid.
  const tired = (stats?.energy ?? 100) < EXHAUSTED_ENERGY
  const payable = !record.workedTonight && !tired
  const practiceReason = record.workedTonight
    ? 'you already worked tonight — this one was for the practice'
    : tired
      ? 'eren was too tired to take the money seriously'
      : null

  const last = record.lastShift
  const mine = !!last && !!user && last.user_id === user.id

  // Full-screen scene — hide the persistent StatsHeader while we're here.
  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  // Warm all four walls in the background so the door opens instantly. Held
  // off the cold-load critical path — the front picture is what matters when
  // the page first paints.
  useEffect(() => {
    const t = setTimeout(() => {
      KIOSK_VIEW_SRCS.forEach(src => { const img = new window.Image(); img.src = src })
    }, 1200)
    return () => clearTimeout(t)
  }, [])

  const goInside = useCallback(() => {
    playSound('ui_modal_open')
    setPhase('entering')
    // Cut to the interior when BOTH the push-in has finished and the first
    // wall can actually paint. The preload above almost always wins the race;
    // this is the guard for a tap in the first second on a cold load.
    const pushIn = new Promise(resolve => setTimeout(resolve, ENTER_MS))
    const firstWall = new window.Image()
    firstWall.src = KIOSK_VIEW_SRCS[0]
    Promise.all([pushIn, firstWall.decode().catch(() => null)]).then(() => setPhase('inside'))
  }, [])

  const goOutside = useCallback(() => {
    setPhase('leaving')
    setTimeout(() => setPhase('front'), LEAVE_MS)
  }, [])

  // Height of ONE empty band. Clamps to 0 on viewports wide enough that the
  // picture becomes height-constrained instead of width-constrained.
  const bandH = `max(0px, calc((100dvh - 100vw * ${PIC.h} / ${PIC.w}) / 2))`

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none game-shell" style={{ background: '#040304' }}>
      <style>{`
        @keyframes kioskPushIn {
          0%   { transform: scale(1);    opacity: 1; }
          62%  { transform: scale(1.5);  opacity: 1; }
          100% { transform: scale(2.15); opacity: 0; }
        }
        @keyframes kioskVeilIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kioskVeilOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes kioskStepIn {
          from { transform: scale(1.16); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes kioskStepOut {
          from { transform: scale(1);    opacity: 1; }
          to   { transform: scale(1.16); opacity: 0; }
        }
      `}</style>

      {/* ══ FRONT ══ the kiosk from the street. Everything in here rides the
          push-in together, so the sign, the window and Eren all rush past you
          as one picture rather than the button flying off on its own. */}
      <div className="absolute inset-0" style={{
        pointerEvents: phase === 'front' ? undefined : 'none',
        ...(phase === 'entering'
          ? { animation: `kioskPushIn ${ENTER_MS}ms cubic-bezier(0.5, 0, 0.75, 0) both` }
          : null),
      }}>

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

          {/* ══ EREN ══ working the window. The clip box ends at the window
              rail, so everything below his chest is hidden behind it and he
              reads as standing inside the kiosk rather than pasted on it.
              Breathing lives in BlinkingEren, idle wiggles in ErenIdleLayer. */}
          <div className="absolute left-0 right-0 top-0 overflow-hidden pointer-events-none"
            style={{ height: `${RAIL_PCT}%`, zIndex: 10 }}>
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

          {/* ══ GO INSIDE ══ anchored to the PICTURE, not the viewport, so it
              always lands on the pavement in front of the counter instead of
              drifting onto the art on a short screen. */}
          <button
            type="button"
            onClick={goInside}
            className="font-pixel absolute left-1/2 active:translate-y-[2px] transition-transform"
            style={{
              bottom: '13%', transform: 'translateX(-50%)',
              zIndex: 12, pointerEvents: 'auto',
              fontSize: 8, letterSpacing: 1.5, color: '#3A1B08',
              background: '#F59C45',
              padding: '11px 15px 10px',
              border: '3px solid #5A2E12',
              borderRadius: 4,
              boxShadow: '0 3px 0 #DC772A, 3px 5px 0 rgba(0,0,0,0.5), 0 0 20px rgba(245,156,69,0.3)',
            }}
          >
            GO INSIDE
          </button>

          {/* ══ THE BOARD ══ last night's takings, chalked up by the door, and
              whatever they left at the till for whoever works next. Anchored
              to the PICTURE like the button, so it can't drift onto the art on
              a short screen. */}
          {last && (
            <div className="absolute left-1/2 pointer-events-none" style={{
              bottom: '23%', transform: 'translateX(-50%)', zIndex: 12,
              width: '76%', maxWidth: 280,
              padding: '8px 10px 9px',
              background: 'rgba(12,9,8,0.82)',
              border: '2px solid rgba(245,156,69,0.45)',
              borderRadius: 8,
              boxShadow: '0 3px 0 rgba(0,0,0,0.5), 0 0 18px rgba(245,156,69,0.14)',
              backdropFilter: 'blur(3px)',
            }}>
              <div className="font-pixel" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 5.5, letterSpacing: 1.4, color: 'rgba(255,231,196,0.6)',
              }}>
                {/* Whose night it was. Brown is yours, pink is hers — the same
                    two colours every other shared thing in the app uses. */}
                <span aria-hidden style={{
                  width: 7, height: 7, borderRadius: 2, flex: '0 0 auto',
                  background: mine ? '#8B5E3C' : '#FF4D7D',
                }} />
                LAST SHIFT
              </div>
              <div className="font-pixel" style={{
                fontSize: 6.5, lineHeight: 1.8, letterSpacing: 0.3,
                color: '#FFE7C4', marginTop: 5,
              }}>
                {last.served} served · {GRADE_WORD[last.grade]}
                {last.rained ? ' · in the rain' : ''}
              </div>
              {last.note && (
                <div className="font-pixel" style={{
                  fontSize: 6, lineHeight: 1.8, color: '#F5C89A', marginTop: 6,
                  borderTop: '1px solid rgba(245,156,69,0.25)', paddingTop: 6,
                }}>
                  “{last.note}”
                </div>
              )}

              {/* Seven nights, side by side. Nobody needs telling who's
                  winning — but the crown says it anyway. */}
              {record.week.mine + record.week.theirs > 0 && (
                <div style={{
                  marginTop: 8, paddingTop: 7,
                  borderTop: '1px solid rgba(245,156,69,0.25)',
                }}>
                  <div className="font-pixel" style={{
                    fontSize: 5.5, letterSpacing: 1.4, color: 'rgba(255,231,196,0.6)',
                  }}>
                    THIS WEEK
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                    {[
                      { who: 'YOU', dot: '#8B5E3C', wraps: record.week.mine, nights: record.week.myNights },
                      { who: 'THEM', dot: '#FF4D7D', wraps: record.week.theirs, nights: record.week.theirNights },
                    ].map(side => {
                      const ahead = side.wraps > 0
                        && side.wraps >= Math.max(record.week.mine, record.week.theirs)
                        && record.week.mine !== record.week.theirs
                      return (
                        <div key={side.who} className="font-pixel" style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          fontSize: 6.5, letterSpacing: 0.5,
                          color: ahead ? '#FFE7C4' : 'rgba(255,231,196,0.55)',
                        }}>
                          <span aria-hidden style={{
                            width: 7, height: 7, borderRadius: 2, flex: '0 0 auto',
                            background: side.dot,
                            opacity: ahead ? 1 : 0.6,
                          }} />
                          {side.who} {side.wraps}
                          {ahead && <IconCrown size={11} />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No pay tonight, and why. Said before you go in, not after. */}
          {record.loaded && practiceReason && (
            <div className="font-pixel absolute left-1/2 pointer-events-none" style={{
              bottom: '8.5%', transform: 'translateX(-50%)', zIndex: 12,
              whiteSpace: 'nowrap',
              fontSize: 5.5, letterSpacing: 1, color: 'rgba(255,231,196,0.72)',
              background: 'rgba(12,9,8,0.7)',
              border: '2px solid rgba(200,190,205,0.25)',
              borderRadius: 7, padding: '5px 8px 4px',
            }}>
              {record.workedTonight ? 'PRACTICE — TONIGHT’S PAY IS SPENT' : 'PRACTICE — EREN IS TOO TIRED'}
            </div>
          )}
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

      </div>{/* ── end FRONT ── */}

      {/* ══ THRESHOLD ══ the black you pass through. Rises with the push-in,
          holds under the interior so the front can snap back to rest unseen,
          and fades with the walk back out. */}
      {phase !== 'front' && (
        <div className="absolute inset-0 z-[45] pointer-events-none" style={{
          background: '#050408',
          ...(phase === 'entering' ? { animation: `kioskVeilIn ${ENTER_MS}ms ease-in both` }
            : phase === 'leaving'  ? { animation: `kioskVeilOut ${LEAVE_MS}ms ease-out both` }
            : { opacity: 1 }),
        }} />
      )}

      {/* ══ INSIDE ══ mounted only once you're through, so the walls never
          flash behind the push-in. */}
      {(phase === 'inside' || phase === 'leaving') && (
        <div className="absolute inset-0 z-[60]" style={{
          animation: phase === 'leaving'
            ? `kioskStepOut ${LEAVE_MS}ms ease-in both`
            : 'kioskStepIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}>
          <KioskInterior
            onExit={goOutside}
            record={record}
            payable={payable}
            practiceReason={practiceReason}
          />
        </div>
      )}
    </div>
  )
}
