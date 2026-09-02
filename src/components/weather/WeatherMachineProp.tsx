'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE WEATHER MACHINE — standing on the Lab floor, left of the rug.
//
// It used to be a full-width slab in the button stack, which was three
// problems in one: it ate a row the room could not spare, it made a machine
// look like a menu item, and it implied the weather lived in a settings screen
// rather than in a thing you walk up to. So it got out of the stack and stood
// up.
//
// IT IS A HUSK YOU REPAIR. At zero parts this is a dead iron cabinet: grimy,
// dark screen, no dish, no gauge, no lever, nothing moving. Each part bolts
// onto a DIFFERENT side of it — the coil up the left, the gauge on the face,
// the dish on the roof, the lever out the right — so a half-built machine
// reads as a machine growing rather than a box collecting stickers. The grime
// lifts a quarter at a time, and the pane wakes in three stages: dead, then
// warming with a carrier band, then the household's actual sky running live.
//
// A MISSING PART LEAVES A SOCKET, NOT A GAP. Grime and absence are both
// invisible at 80px on a phone — a machine with no gauge just reads as a
// plainer machine. An empty round bay with screw lugs in it does not: it says
// a round thing goes there, without a word of copy, and it makes the purchase
// land in a hole that was visibly waiting for it.
//
// WHY THE PANE SHOWS THE LAB'S OWN WINDOW. The machine sets every window in
// the house, but the one you can check from where you are standing is the one
// behind it. Showing this room's sky makes the little pane a mirror rather
// than a decoration.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { useTrophyCosmetics } from '@/hooks/useTrophyCosmetics'
import { useWeatherMachine } from '@/hooks/useWeatherMachine'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useIsDark } from '@/hooks/useIsDark'
import { type WeatherId } from '@/lib/weather'
import type { MachinePartId } from '@/lib/weatherMachine'
import WeatherFx from './WeatherFx'
import { playSound } from '@/lib/sounds'

const PIXEL_FONT = '"Press Start 2P", monospace'

// Blue-steel equipment, inherited from the slab this replaced so the two read
// as the same machine in two places.
const STEEL_HI = '#4A5570'
const STEEL_MID = '#2A3145'
const STEEL_LO = '#171C29'
const INK = '#080A11'
const GOLD = '#F5C842'
const LAMP_ON = '#63F094'
const LAMP_OFF = '#4A1F24'

// Everything is laid out inside this box, in px, because the prop has to hold
// its proportions on a 360px phone and a tablet alike — a machine that scaled
// with the viewport would stop matching the floorboards it stands on.
export const MACHINE_W = 100
export const MACHINE_H = 126
const BODY = { left: 8, top: 20, w: 76, h: 96 }

// WHERE IT STANDS, and why these two numbers are not eyeballed. Measured off
// ChemistryDay.png: the rug's top edge is at art y 1136 and the desk's feet all
// end by art y 1070, which leaves one band of bare floorboard between them.
// `bottom: 34%` lands the machine's contact point at art y ~1104 — dead centre
// of that band on every phone — and `left: 5%` puts its right edge ~24px clear
// of Eren's silhouette at the narrowest viewport. Both are VIEWPORT percent,
// not px: the room art is drawn `cover`, so a percentage pins the same art
// pixel on every phone while a px offset drifts with the crop.
const STANDS = { left: '5%', bottom: '34%' }

export default memo(function WeatherMachineProp({ onOpen }: { onOpen(): void }) {
  const cos = useTrophyCosmetics()
  const m = useWeatherMachine()
  const reduced = useReducedMotion()
  const dark = useIsDark()

  const here = (cos.weather.chemistry ?? 'clear') as WeatherId
  // An unanswered wallet is not an unbuilt machine — but it is not a built one
  // either, and SOMETHING has to be drawn. Draw the husk and say nothing: no
  // tag, no count. Drawing it complete and then collapsing to a husk a moment
  // later is the worse of the two flickers by far — for the households who
  // have not built it yet, which is all of them on day one, it reads as their
  // machine breaking in front of them.
  const pending = !m.loaded
  const installed = pending ? 0 : m.installed
  const built = !pending && m.built

  return (
    <button
      type="button"
      onClick={() => { playSound('ui_select'); onOpen() }}
      aria-label={pending ? 'Weather machine'
        : built ? 'Weather machine'
        : `Weather machine, ${installed} of ${m.total} parts fitted`}
      className="absolute active:translate-y-[1px] transition-transform"
      style={{
        ...STANDS,
        width: MACHINE_W,
        height: MACHINE_H,
        background: 'none',
        border: 0,
        padding: 0,
        // Explicit, and deliberately below Eren's 10: RoomWeather sits at 0 and
        // redraws the window's own pixels, so a prop with no z-index of its own
        // would be sorted against it by document order and could end up behind
        // a copy of the wall.
        zIndex: 8,
      }}
    >
      <MachineArt
        installed={installed}
        total={m.total}
        has={m.has}
        sky={here}
        reduced={reduced}
        dark={dark}
        pending={pending}
      />
    </button>
  )
})

// ─── The art ─────────────────────────────────────────────────────────────────
// Pure, so every build state can be put side by side in a preview harness
// without a Supabase session behind it. `has` is passed in rather than derived
// from `installed` because the parts are bought in whatever order the
// household can afford, not in catalogue order — a house that saved for the
// dish first should see a dish first.

export function MachineArt({ installed, total, has, sky, reduced, dark, pending }: {
  installed: number
  total: number
  has(part: MachinePartId): boolean
  sky: WeatherId
  reduced?: boolean
  /** The room has swapped to its night art. Adds the rim the pendant lamp
   *  would throw — without it a blue-grey box dies against the night floor. */
  dark?: boolean
  /** Nobody knows the build state yet. Draw the machine, assert no number. */
  pending?: boolean
}) {
  const built = installed >= total
  // Grime lifts a quarter per part, so the very first purchase is visible from
  // across the room.
  const grime = (total - installed) / total
  const anim = (cls: string) => (reduced ? undefined : cls)
  const m = { total, has }
  // The pane runs on the COIL, and it only has a signal to draw once the gauge
  // is reading. Keying this off a COUNT was incoherent: a household that saved
  // for the dish and the lever first got a powered carrier band on a machine
  // with nothing powering it.
  const powered = built || has('coil')
  const receiving = built || (has('coil') && has('gauge'))

  return (
    <>
      {/* ── The tag. The only thing over here that moves without being asked,
             and only while the machine still wants something. Silent entirely
             until the build state is known — a count is the one thing this
             prop must never guess at. ── */}
      {!pending && <span
        className={built ? undefined : anim('wx-tag')}
        style={{
          position: 'absolute', left: '50%',
          // Anchored to the tallest thing that is actually THERE. Pinning it to
          // the box top would leave it floating over the 20px of empty air the
          // dish has not been bought yet.
          top: (built || has('dish')) ? 0 : BODY.top - 4,
          transform: 'translate(-50%, -100%)',
          // The dish is tilted, so its far lip rides above the box top; give
          // the tag a little more air when there is a dish to clear.
          marginTop: (built || has('dish')) ? -9 : -3,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 6px 3px',
          whiteSpace: 'nowrap',
          background: built ? 'rgba(10,14,24,0.82)' : 'rgba(38,26,6,0.9)',
          border: `2px solid ${built ? 'rgba(143,224,255,0.5)' : GOLD}`,
          boxShadow: `2px 2px 0 ${INK}`,
          fontFamily: PIXEL_FONT, fontSize: 5.5, letterSpacing: 1,
          color: built ? '#9FC6E8' : GOLD,
        }}
      >
        WEATHER
        {!built && <span style={{ color: '#FFF0C2' }}>{installed}/{m.total}</span>}
      </span>}

      {/* ── The roof saddle, empty, waiting for a dish ── */}
      {!built && !has('dish') && (
        <span aria-hidden style={{
          position: 'absolute', left: '50%', top: 8,
          transform: 'translateX(-50%)', width: 22, height: 12,
        }}>
          {/* two bare prongs and the bolt between them */}
          {[0, 18].map(l => (
            <span key={l} style={{
              position: 'absolute', left: l, top: 0, width: 4, height: 12,
              background: STEEL_LO, border: `1px solid ${INK}`,
            }} />
          ))}
          <span style={{
            position: 'absolute', left: 2, top: 7, width: 18, height: 3,
            background: '#0E1320', border: `1px solid ${INK}`,
          }} />
        </span>
      )}

      {/* ── The dish on the roof (part: dish) ── */}
      {(built || m.has('dish')) && (
        <span aria-hidden style={{
          position: 'absolute', left: '50%', top: 0,
          transform: 'translateX(-50%)',
          width: 46, height: 22,
        }}>
          {/* mast first, so the bowl sits in front of it */}
          <span style={{
            position: 'absolute', left: '50%', top: 9, marginLeft: -2,
            width: 4, height: 13, background: STEEL_MID,
            border: `1px solid ${INK}`,
          }} />
          {/* A wide flat ELLIPSE, not a dome. A parabola seen from the side IS
              an ellipse; the dome this started as read as a helmet, and
              squashing a helmet only reads as a smaller helmet. */}
          <span style={{
            position: 'absolute', left: 0, top: 0, width: 46, height: 15,
            transform: 'rotate(-7deg)', transformOrigin: '50% 120%',
          }}>
          <span className={anim('wx-dish')} style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: 'linear-gradient(180deg, #A9BCD6 0%, #6B7C9E 44%, #39456A 100%)',
            border: `2px solid ${INK}`,
            transformOrigin: 'center',
          }}>
            {/* Concave, not a plate: the inside is DARKEST at the top, where a
                bowl turned up at the sky would be shading itself. */}
            <span style={{
              position: 'absolute', inset: 2, borderRadius: '50%',
              background: 'linear-gradient(180deg, #232C46 0%, #4C5B80 62%, #7387AB 100%)',
            }} />
            {/* rim light along the near lip */}
            <span style={{
              position: 'absolute', left: '14%', right: '14%', bottom: 1, height: 1,
              background: 'rgba(206,222,246,0.6)', borderRadius: '50%',
            }} />
            {/* the emitter pip at the focus */}
            <span style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 4, height: 4, margin: '-2px 0 0 -2px',
              background: '#FFE9A8', boxShadow: `0 0 4px ${GOLD}`,
            }} />
          </span>
          </span>
        </span>
      )}

      {/* ── Two bare collars up the left flank, nothing running through them ── */}
      {!built && !has('coil') && (
        <span aria-hidden>
          {[42, 78].map(t => (
            <span key={t} style={{
              position: 'absolute', left: 2, top: t, width: 12, height: 7,
              background: `linear-gradient(180deg, ${STEEL_HI} 0%, ${STEEL_LO} 100%)`,
              border: `2px solid ${INK}`, borderRadius: 3,
            }}>
              <span style={{
                position: 'absolute', inset: 1, background: '#0B0F1A', borderRadius: 2,
              }} />
            </span>
          ))}
        </span>
      )}

      {/* ── The coil up the left flank (part: coil) ── */}
      {(built || m.has('coil')) && (
        <span aria-hidden style={{
          position: 'absolute', left: 0, top: 32, width: 13, height: 70,
          background: `linear-gradient(90deg, ${STEEL_LO} 0%, ${STEEL_HI} 55%, ${STEEL_LO} 100%)`,
          border: `2px solid ${INK}`,
          borderRadius: 5,
          overflow: 'hidden',
        }}>
          <span className={anim('wx-coil')} style={{
            position: 'absolute', left: 1, right: 1, top: 4, bottom: 4,
            background: 'linear-gradient(180deg, #FFD79A 0%, #FF9E3D 55%, #C2521A 100%)',
            borderRadius: 3,
          }} />
          {/* three clamps, so it reads as plumbing and not a battery */}
          {[10, 30, 50].map(t => (
            <span key={t} style={{
              position: 'absolute', left: -1, right: -1, top: t,
              height: 3, background: STEEL_LO, borderTop: `1px solid ${INK}`,
            }} />
          ))}
        </span>
      )}

      {/* ── The slot the lever goes through, with no lever in it ── */}
      {!built && !has('lever') && (
        <span aria-hidden style={{
          position: 'absolute', left: BODY.left + BODY.w - 4, top: 62,
          width: 11, height: 10,
          background: `linear-gradient(180deg, ${STEEL_MID} 0%, ${STEEL_LO} 100%)`,
          border: `2px solid ${INK}`, borderRadius: 2,
        }}>
          <span style={{
            position: 'absolute', left: 2, top: 2, right: 2, bottom: 2,
            background: '#0B0F1A',
          }} />
        </span>
      )}

      {/* ── The lever out the right flank (part: lever) ── */}
      {(built || m.has('lever')) && (
        <span aria-hidden style={{
          position: 'absolute', left: BODY.left + BODY.w - 4, top: 46,
          width: 20, height: 34,
        }}>
          {/* the housing it is bolted through */}
          <span style={{
            position: 'absolute', left: 0, top: 16, width: 11, height: 10,
            background: STEEL_HI, border: `2px solid ${INK}`, borderRadius: 2,
          }} />
          {/* the rod, leaning out and back */}
          <span style={{
            position: 'absolute', left: 4, top: 2, width: 4, height: 20,
            background: 'linear-gradient(90deg, #E6EDF8 0%, #96A4BC 100%)',
            border: `1px solid ${INK}`,
            transform: 'rotate(24deg)', transformOrigin: 'bottom center',
          }} />
          {/* the red knob you would actually grab */}
          <span style={{
            position: 'absolute', left: 9, top: -1, width: 11, height: 11,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 34% 30%, #FFC7BC, #E5453A 58%, #7A1610 100%)',
            border: `2px solid ${INK}`,
          }} />
        </span>
      )}

      {/* ══ THE BODY ══ */}
      <span aria-hidden className={built ? anim('wx-thrum') : undefined} style={{
        position: 'absolute',
        left: BODY.left, top: BODY.top, width: BODY.w, height: BODY.h,
        background: `linear-gradient(180deg, ${STEEL_HI} 0%, ${STEEL_MID} 58%, ${STEEL_LO} 100%)`,
        border: `3px solid ${INK}`,
        borderRadius: 4,
        // Warm ink, not blue-black: this shadow lands on oak floorboards, and a
        // cold shadow on warm wood is the tell that a prop was pasted in.
        boxShadow: dark
          ? '3px 3px 0 rgba(20,10,4,0.55), inset -1px 0 0 rgba(255,190,120,0.18), inset 0 1px 0 rgba(255,205,150,0.14)'
          : '3px 3px 0 rgba(46,22,10,0.42)',
        overflow: 'hidden',
      }}>
        {/* Grime. A flat wash plus a coarse streak — dust does not gradient,
            it sits in the corners and runs down the front. */}
        {grime > 0 && (
          <span style={{
            position: 'absolute', inset: 0, opacity: grime * 0.72,
            background: `
              repeating-linear-gradient(96deg, rgba(58,48,32,0.55) 0 3px, rgba(26,22,15,0.4) 3px 7px),
              linear-gradient(180deg, rgba(74,64,44,0.9) 0%, rgba(30,26,18,0.95) 100%)`,
          }} />
        )}

        {/* Cobweb in the corner, gone the moment anybody touches the thing.
            Three strands and two crossings is all a web needs at this size. */}
        {installed === 0 && (
          <>
            {[14, 30, 46].map((deg, i) => (
              <span key={deg} style={{
                position: 'absolute', left: -1, top: -1,
                width: 26 - i * 2, height: 1,
                background: 'rgba(226,232,240,0.34)',
                transform: `rotate(${deg}deg)`, transformOrigin: 'left top',
              }} />
            ))}
            {[9, 17].map(d => (
              <span key={d} style={{
                position: 'absolute', left: d, top: d,
                width: d + 3, height: 1,
                background: 'rgba(226,232,240,0.26)',
                transform: 'rotate(52deg)', transformOrigin: 'left top',
              }} />
            ))}
          </>
        )}

        {/* vent grille across the top */}
        {[5, 9, 13].map(t => (
          <span key={t} style={{
            position: 'absolute', left: 8, right: 8, top: t,
            height: 2, background: 'rgba(0,0,0,0.45)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }} />
        ))}

        {/* ── The pane ── */}
        <span style={{
          position: 'absolute', left: 6, top: 20, width: 64, height: 34,
          containerType: 'size',
          overflow: 'hidden',
          background: '#070B16',
          border: `2px solid ${INK}`,
          boxShadow: built
            ? 'inset 0 0 6px rgba(0,0,0,0.9), 0 0 7px rgba(120,200,255,0.4)'
            : 'inset 0 0 6px rgba(0,0,0,0.95)',
        }}>
          {built ? (
            <WeatherFx id={sky} still={reduced} />
          ) : powered && receiving ? (
            <>
              {/* powered, nothing to receive: a flat horizon and a carrier
                  band crawling down it */}
              <span style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, #16202F 0%, #22303F 62%, #2C3A45 100%)',
              }} />
              <span style={{
                position: 'absolute', left: 0, right: 0, top: '62%', height: 1,
                background: 'rgba(150,200,230,0.5)',
              }} />
              <span className={anim('wx-warm')} style={{
                position: 'absolute', left: 0, right: 0, height: 6,
                background: 'linear-gradient(180deg, rgba(150,220,255,0) 0%, rgba(150,220,255,0.28) 50%, rgba(150,220,255,0) 100%)',
              }} />
            </>
          ) : (
            /* dead glass, with the crack it has had since somebody left it here */
            <>
              <span style={{
                position: 'absolute', left: '18%', top: '-10%',
                width: 1, height: '130%',
                background: 'rgba(190,205,225,0.35)',
                transform: 'rotate(16deg)',
              }} />
              <span style={{
                position: 'absolute', left: '18%', top: '44%',
                width: '34%', height: 1,
                background: 'rgba(190,205,225,0.28)',
                transform: 'rotate(-34deg)',
              }} />
            </>
          )}
          {/* scanlines over whatever the pane is doing */}
          <span style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.26) 2px 3px)',
          }} />
        </span>

        {/* ── Status lamps: one per part, lit as it goes in ── */}
        {Array.from({ length: m.total }, (_, i) => {
          const lit = i < installed
          return (
            <span key={i}
              className={lit && built ? anim('wx-lamp') : undefined}
              style={{
                position: 'absolute', left: 8 + i * 10, top: 60,
                width: 5, height: 5, borderRadius: '50%',
                background: lit ? LAMP_ON : LAMP_OFF,
                border: `1px solid ${INK}`,
                boxShadow: lit ? `0 0 4px ${LAMP_ON}` : undefined,
              }} />
          )
        })}

        {/* ── The bay the gauge screws into, empty ── */}
        {!built && !has('gauge') && (
          <span style={{
            position: 'absolute', left: 50, top: 56, width: 20, height: 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 40%, #05070C 0%, #10151F 70%, #1B2130 100%)',
            border: `2px solid ${INK}`,
            boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.9)',
          }}>
            {/* three screw lugs at 12, 4 and 8 o'clock — the shape of what is
                supposed to be bolted on here */}
            {[[8, 0.5], [15.5, 13], [0.5, 13]].map(([l, t], i) => (
              <span key={i} style={{
                position: 'absolute', left: l, top: t, width: 3.5, height: 3.5,
                background: '#3E4757', border: `1px solid ${INK}`, borderRadius: '50%',
              }} />
            ))}
          </span>
        )}

        {/* ── The gauge on the face (part: gauge) ── */}
        {(built || m.has('gauge')) && (
          <span style={{
            position: 'absolute', left: 50, top: 56, width: 20, height: 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 30%, #FFF3D0 0%, #E8C88A 46%, #8A6A2E 100%)',
            border: `2px solid ${INK}`,
          }}>
            <span className={anim('wx-needle')} style={{
              position: 'absolute', left: '50%', bottom: '50%',
              width: 2, height: 6, marginLeft: -1,
              background: '#3A2408',
              transformOrigin: 'bottom center',
            }} />
            <span style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 3, height: 3, margin: '-1.5px 0 0 -1.5px',
              borderRadius: '50%', background: '#3A2408',
            }} />
          </span>
        )}

        {/* ── The count plate ── */}
        <span style={{
          position: 'absolute', left: 6, bottom: 5, width: 38, height: 13,
          display: 'grid', placeItems: 'center',
          background: '#0C1120',
          border: `2px solid ${INK}`,
          fontFamily: PIXEL_FONT, fontSize: 6, letterSpacing: 1,
          color: pending ? '#3E4757' : built ? LAMP_ON : GOLD,
        }}>
          {pending ? '\u00B7\u00B7\u00B7' : built ? 'READY' : `${installed}/${m.total}`}
        </span>

        {/* gold rivets — the app's "this is a premium surface" marker */}
        {[{ l: 3, t: 3 }, { r: 3, t: 3 }, { l: 3, b: 3 }, { r: 3, b: 3 }].map((p, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: p.l, top: p.t, right: p.r, bottom: p.b,
            width: 3, height: 3,
            background: built ? GOLD : '#6B5A2E',
            boxShadow: `1px 1px 0 ${INK}`,
          }} />
        ))}
      </span>

      {/* ── Feet, so it stands on the boards instead of floating ── */}
      {[BODY.left + 6, BODY.left + BODY.w - 20].map(l => (
        <span key={l} aria-hidden style={{
          position: 'absolute', left: l, top: BODY.top + BODY.h - 1,
          width: 14, height: 7,
          background: STEEL_LO,
          border: `2px solid ${INK}`,
          borderRadius: '0 0 3px 3px',
        }} />
      ))}
      {/* the shadow it casts on the floorboards */}
      <span aria-hidden style={{
        position: 'absolute', left: BODY.left - 2, top: BODY.top + BODY.h + 4,
        width: BODY.w + 4, height: 6,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(46,22,10,0.44) 0%, rgba(46,22,10,0) 72%)',
      }} />
    </>
  )
}
