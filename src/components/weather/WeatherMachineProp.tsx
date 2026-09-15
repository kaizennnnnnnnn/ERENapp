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
import { MACHINE_PARTS, type MachinePartId } from '@/lib/weatherMachine'
import WeatherFx from './WeatherFx'
import { playSound } from '@/lib/sounds'

const PIXEL_FONT = '"Press Start 2P", monospace'

// Blue-steel equipment, inherited from the slab this replaced so the two read
// as the same machine in two places.
const STEEL_LIT = '#6E7C9C'
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
        // ABOVE Eren's 10, and that is not a paint decision — it is a TAP one.
        // BlinkingEren draws into a SQUARE box with the portrait sprite
        // object-fit:contain inside it, so at size 230 the cat is 125px wide
        // with 52px of transparent pad on each side; PetTarget wraps that in a
        // bare clickable div that shrink-wraps to the square, so the pad
        // hit-tests. Under it, 53 of this prop's 100px were dead on a 360px
        // phone — the lever, the gauge and half the tag among them.
        //
        // Nothing is lost by going over him: the two boxes only overlap where
        // his sprite is transparent (the drawn cat starts 69px into its own
        // box) until the viewport is under ~324px, and there by 2px. It must
        // still be EXPLICIT and non-zero, because RoomWeather sits at 0 and
        // redraws the window's own pixels — an auto z-index would be sorted
        // against that by document order and could end up behind the wall.
        zIndex: 11,
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

export function MachineArt({
  installed, total, has, sky, reduced, dark, pending, ghost,
}: {
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
  /**
   * Drawn as a reference picture rather than as this household's machine:
   * no tag, no count, no cobweb. The shop card uses it, where a part thumbnail
   * is a statement about the PART and saying "0/4" on it is both untrue and,
   * at 0.76x, an unreadable smear. Deliberately NOT `pending` — that means
   * "the wallet is unread", and welding the two would make a future change to
   * loading behaviour silently redraw every shop card.
   */
  ghost?: boolean
}) {
  const built = installed >= total
  // Grime lifts per part, on a curve rather than a quarter at a time: linear
  // put the biggest step between 3/4 and 4/4, which is already the loudest
  // moment in the build, and made the FIRST purchase — the one that has to
  // prove the machine responds at all — invisible.
  const grime = pending ? 0.42 : Math.pow((total - installed) / total, 1.5)
  const anim = (cls: string) => (reduced ? undefined : cls)
  // The pane runs on the COIL, and it only has a signal to draw once the gauge
  // is reading. Keying this off a COUNT was incoherent: a household that saved
  // for the dish and the lever first got a powered carrier band on a machine
  // with nothing powering it.
  const powered = built || has('coil')
  const receiving = built || (has('coil') && has('gauge'))
  // Everything the prop asserts about THIS household. A shop card asserts none
  // of it, and neither does a machine whose wallet has not answered yet.
  const speaks = !pending && !ghost

  return (
    <>
      {/* ── The tag. The only thing over here that moves without being asked,
             and only while the machine still wants something. It used to
             measure 85px against a 76px body — a label physically bigger than
             the thing it labels — at a font size whose glyph cell could not
             land on the pixel grid, so the loudest object in the frame was
             also the only illegible one. It is now narrower than the machine,
             says only the name, and is gone entirely once built: the count it
             used to carry is on the plate, which is the one piece of type here
             that actually resolves at 1x. ── */}
      {speaks && !built && <span
        className={anim('wx-tag')}
        style={{
          position: 'absolute', left: '50%',
          // Anchored to the tallest thing that is actually THERE. Pinning it to
          // the box top would leave it floating over the 20px of empty air the
          // dish has not been bought yet.
          top: has('dish') ? 0 : BODY.top - 6,
          transform: 'translate(-50%, -100%)',
          marginTop: has('dish') ? -4 : 0,
          padding: '3px 4px 2px',
          whiteSpace: 'nowrap',
          background: 'rgba(30,20,5,0.92)',
          border: `2px solid ${GOLD}`,
          // Warm ink, like the body's. This is the one surface that overhangs
          // bare oak in every state it is drawn in, and it was the last cold
          // shadow left on the prop.
          boxShadow: '2px 2px 0 rgba(46,22,10,0.6)',
          fontFamily: PIXEL_FONT, fontSize: 6, letterSpacing: 1,
          color: GOLD,
        }}
      >
        WEATHER
      </span>}

      {/* ── The roof mount. Drawn whether or not a dish is in it, because a
             socket is what a part LANDS IN, not what it is replaced by. Low and
             wide with the bolt hole sunk into it: the two prongs and the bar
             across them that used to be here read as a CARRY HANDLE, and on a
             warm vertically-grained box that made the whole husk a wooden
             toolbox — in the three states nobody has bought a dish yet, which
             includes the only state a new household ever sees. ── */}
      <span aria-hidden style={{
        position: 'absolute', left: 37, top: 18,
        width: 26, height: 8, zIndex: 1,
        background: `linear-gradient(180deg, ${STEEL_LIT} 0%, ${STEEL_MID} 50%, ${STEEL_LO} 100%)`,
        border: `2px solid ${INK}`,
        borderRadius: '2px 2px 0 0',
        boxShadow: '2px 2px 0 rgba(46,22,10,0.4)',
      }}>
        <span style={{
          position: 'absolute', left: 8, top: 0, width: 6, height: 4,
          background: '#05070C',
        }} />
        {[1, 17].map(l => (
          <span key={l} style={{
            position: 'absolute', left: l, top: 0, width: 4, height: 3,
            background: STEEL_HI, borderBottom: `1px solid ${INK}`,
          }} />
        ))}
      </span>

      {/* ── The dish on the roof (part: dish) ──
             `left: 37` and not `left:'50%' + translateX(-50%)`, because wx-dish
             needs to own `transform`: an inline centring translate and an
             animated transform cannot coexist, the animation wins, and the dish
             jumps. 37 = (MACHINE_W - 26) / 2 for the mount, 28 for the bowl. */}
      {(built || has('dish')) && (
        <span aria-hidden className={anim('wx-dish')} style={{
          position: 'absolute', left: 28, top: 0, width: 44, height: 15,
          zIndex: 1, transformOrigin: '50% 130%',
        }}>
          {/* the post, down into the mount's hole */}
          <span style={{
            position: 'absolute', left: 19, top: 8, width: 6, height: 12,
            background: `linear-gradient(90deg, ${STEEL_LO} 0%, ${STEEL_HI} 50%, ${STEEL_LO} 100%)`,
            border: `2px solid ${INK}`, borderTop: 0,
          }} />
          <span style={{
            position: 'absolute', left: 0, top: 0, width: 44, height: 15,
            transform: 'rotate(-8deg)', transformOrigin: '50% 130%',
          }}>
            {/* A wide flat ELLIPSE, not a dome. A parabola seen from the side IS
                an ellipse; the dome this started as read as a helmet, and
                squashing a helmet only reads as a smaller helmet. */}
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: `linear-gradient(180deg, ${STEEL_HI} 0%, #39456A 58%, ${STEEL_LO} 100%)`,
              border: `2px solid ${INK}`,
              boxShadow: '2px 2px 0 rgba(46,22,10,0.38)',
            }}>
              {/* Concave: DARKEST at the top inside, where a bowl turned up at
                  the sky shades itself, with the bounce on the far wall. */}
              <span style={{
                position: 'absolute', inset: 2, borderRadius: '50%',
                background: 'linear-gradient(180deg, #161D38 0%, #313E68 46%, #6E82AC 100%)',
              }} />
              {/* one HARD 2px lip light — a 1px line at half alpha is a grey haze */}
              <span style={{
                position: 'absolute', left: 13, right: 13, bottom: 1, height: 2,
                background: '#A9BCD6', borderRadius: '50%',
              }} />
            </span>
            {/* THE FEED HORN. Two struts and a pip standing off the bowl's face.
                The triangle of empty air between them is the only cue that
                separates a dish from a spoon at 20px, and it is three spans.
                Light steel rather than ink: ink on a dark bowl has no contrast
                left at 1x. */}
            {[{ l: 13, d: 34 }, { l: 29, d: -34 }].map(st => (
              <span key={st.l} style={{
                position: 'absolute', left: st.l, top: 3, width: 2, height: 9,
                // Mid steel, not near-white: at #C3D2E8 and 12px tall the two
                // struts plus the pip above them read as a white letter A
                // sitting on the bowl.
                background: '#8FA0BE',
                transform: `rotate(${st.d}deg)`, transformOrigin: 'bottom center',
              }} />
            ))}
            <span style={{
              position: 'absolute', left: 19, top: 1, width: 6, height: 4,
              background: '#E8C88A', border: `1px solid ${INK}`, borderRadius: 1,
            }} />
          </span>
        </span>
      )}

      {/* ── The two collars up the left flank. Permanent: empty they are bare
             brackets, filled the coil runs THROUGH them. They sit proud of the
             body (x0..14 against BODY.left 8) so they read as hardware bolted
             across the flank rather than as two ears floating beside it. ── */}
      <span aria-hidden>
        {[42, 78].map(t => (
          <span key={t} style={{
            position: 'absolute', left: 0, top: t, width: 14, height: 8, zIndex: 2,
            background: `linear-gradient(180deg, ${STEEL_LIT} 0%, ${STEEL_LO} 100%)`,
            border: `2px solid ${INK}`, borderRadius: 2,
            boxShadow: '2px 1px 0 rgba(46,22,10,0.35)',
          }}>
            {!built && !has('coil') && (
              <span style={{
                position: 'absolute', inset: 1, background: '#07090F', borderRadius: 1,
              }} />
            )}
          </span>
        ))}
      </span>

      {/* ── The coil up the left flank (part: coil) ──
             zIndex, because the body is emitted after this and painted over it:
             measured in Chrome, exactly 5px of the coil used to survive at 1x
             (3.8px on the shop card). The first purchase in catalogue order
             bought a stripe. ── */}
      {(built || has('coil')) && (
        <span aria-hidden style={{
          position: 'absolute', left: 2, top: 32, width: 10, height: 70, zIndex: 1,
          background: `linear-gradient(90deg, ${INK} 0%, ${STEEL_LO} 50%, ${INK} 100%)`,
          border: `2px solid ${INK}`,
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          {/* Wound, not banded. A cream-to-rust ramp repeated in three equal
              chunks is a caramel wafer; a turn with a dark separator, put on a
              pitch by the 162deg axis, is a helix. Overdrawn by one pitch at
              the top so the travel loops seamlessly. */}
          <span className={anim('wx-coil')} style={{
            position: 'absolute', left: 0, right: 0, top: -6, bottom: 0,
            // Hot metal in a tube, not a candy cane. The first pass ran
            // near-white (#FFE2AE) against saturated orange, which put the
            // cheapest of the four parts at the top of the value range and made
            // it the loudest thing on a machine it is only one quarter of.
            // Incandescence lightens toward the CORE of the turn and goes dark
            // copper at the edges, so the range is narrower and the peak sits
            // below the gauge's cream.
            background: `repeating-linear-gradient(162deg,
              #5E2A11 0 2px, #C8761F 2px 4px, #7E3A14 4px 6px)`,
          }} />
        </span>
      )}

      {/* ── The lever housing. Permanent: empty it is a slot, filled it is the
             block the rod swings in. Proud of the body by 7px — it used to be
             4px occluded by it, which is why the rod appeared to begin in mid
             air with an unrelated tab behind it. ── */}
      <span aria-hidden style={{
        position: 'absolute', left: BODY.left + BODY.w - 6, top: 60,
        width: 13, height: 12, zIndex: 1,
        background: `linear-gradient(180deg, ${STEEL_LIT} 0%, ${STEEL_MID} 45%, ${STEEL_LO} 100%)`,
        border: `2px solid ${INK}`, borderRadius: 2,
        boxShadow: '2px 2px 0 rgba(46,22,10,0.38)',
      }}>
        {/* the aperture. A rod cannot read as passing through anything that has
            no hole in it. */}
        <span style={{
          position: 'absolute', left: 2, top: 0, width: 5, height: 8,
          background: '#05070C',
        }} />
      </span>

      {/* ── The lever out the right flank (part: lever) ──
             Ends at x=98, not 100: the knob's ink border used to land exactly on
             MACHINE_W inside ItemPreview's overflow:hidden box, so it was shaved
             flush on the one shop card whose whole job is to sell the lever. ── */}
      {(built || has('lever')) && (
        <span aria-hidden style={{
          position: 'absolute', left: BODY.left + BODY.w - 6, top: 44,
          width: 20, height: 28, zIndex: 2,
        }}>
          {/* the rod — 5px with a 2px ink border, matching every other member
              that reads; the 1px border it had antialiased to grey */}
          <span style={{
            position: 'absolute', left: 3, top: 2, width: 5, height: 20,
            background: 'linear-gradient(90deg, #E6EDF8 0%, #8E9CB6 100%)',
            border: `2px solid ${INK}`,
            transform: 'rotate(22deg)', transformOrigin: 'bottom center',
          }} />
          {/* the pivot boss, painted AFTER the rod so it caps the join. This one
              7px circle is the difference between a lever and a map pin. */}
          <span style={{
            position: 'absolute', left: 2, top: 18, width: 7, height: 7,
            borderRadius: '50%', background: STEEL_HI,
            border: `2px solid ${INK}`,
          }} />
          {/* a flat grip. A sphere on a stick is a lollipop at every size. */}
          <span style={{
            position: 'absolute', left: 6, top: -1, width: 12, height: 7,
            background: 'linear-gradient(180deg, #FF7A6A 0%, #E5453A 45%, #7A1610 100%)',
            border: `2px solid ${INK}`, borderRadius: 2,
            transform: 'rotate(22deg)',
            boxShadow: '2px 2px 0 rgba(46,22,10,0.34)',
          }} />
        </span>
      )}

      {/* ══ THE BODY ══
          No wx-thrum. translateY(0.5px) sat on the parent of the 3px ink
          border, the pixel-font plate and all four rivets: half a pixel is not
          perceived as motion at 1x, it resamples the whole subtree off the
          device-pixel grid — so the FINISHED machine went soft on a timer while
          the husk stayed crisp. Backwards, and the same failure family as the
          documented sprite-scale seam trap. */}
      <span aria-hidden style={{
        position: 'absolute',
        left: BODY.left, top: BODY.top, width: BODY.w, height: BODY.h,
        background: `linear-gradient(180deg, ${STEEL_HI} 0%, ${STEEL_MID} 58%, ${STEEL_LO} 100%)`,
        border: `3px solid ${INK}`,
        // A heavier bottom rail, and a top rounder than the base. One radius on
        // four corners and one weight on four sides is the shape language of a
        // UI panel; a cabinet is asymmetric at its edges.
        borderBottomWidth: 4,
        borderRadius: '5px 5px 2px 2px',
        // Warm ink, not blue-black: this shadow lands on oak floorboards, and a
        // cold shadow on warm wood is the tell that a prop was pasted in. Near
        // opaque, because a hard-edged offset shadow is a stylised device — at
        // 0.42 the floorboard grain read straight through it and it looked like
        // a rendering fault rather than a choice.
        boxShadow: dark
          ? '3px 3px 0 rgba(20,10,4,0.72)'
          : '3px 3px 0 rgba(46,22,10,0.7)',
        overflow: 'hidden',
      }}>
        {/* The lit top plane. Nothing on this body used to be lighter than
            STEEL_HI, which is why the steel read as matte board while the dish
            at #A9BCD6 read as chrome bolted onto it. A 1px inset highlight is
            the right instinct at the wrong scale — it does not survive the
            0.76x shop thumbnail; a band does. */}
        <span style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 5,
          background: `linear-gradient(180deg, ${STEEL_LIT} 0%, ${STEEL_HI} 100%)`,
        }} />

        {/* Grime. Dust is NEUTRAL and it DARKENS. This was warm olive laid in a
            regular 3px/7px comb: a regular pitch is the signature of a milled
            or woven material, so it read as oak panelling or corduroy; the hue
            put the dead machine in the floorboards' own colour so the husk lost
            its figure against them; and at 0.9 alpha it was LIGHTER than the
            steel beneath, which is why the night husk was the brightest object
            in a dark room — value running backwards on the one variable that
            says dead-or-alive. Corner pools, then three streaks at irregular
            widths and gaps in a gradient that does not repeat. `inset: 2` keeps
            a machined frame the dirt has been wiped off. */}
        {grime > 0 && (
          <span style={{
            position: 'absolute', inset: 2, borderRadius: 2,
            opacity: grime * 0.85,
            background: `
              radial-gradient(88% 55% at 50% 0%, rgba(6,8,12,0.60) 0%, rgba(6,8,12,0) 72%),
              radial-gradient(64% 42% at 0% 100%, rgba(6,8,12,0.66) 0%, rgba(6,8,12,0) 74%),
              radial-gradient(64% 42% at 100% 100%, rgba(6,8,12,0.56) 0%, rgba(6,8,12,0) 74%),
              linear-gradient(90deg,
                rgba(22,24,22,0) 0 9px, rgba(22,24,22,0.46) 9px 12px,
                rgba(22,24,22,0) 12px 31px, rgba(22,24,22,0.38) 31px 33px,
                rgba(22,24,22,0) 33px 52px, rgba(22,24,22,0.52) 52px 57px,
                rgba(22,24,22,0) 57px),
              linear-gradient(180deg, rgba(26,28,26,0.42) 0%, rgba(10,11,10,0.80) 100%)`,
          }} />
        )}

        {/* The pendant lamp's rim, at night. A real span painted AFTER the
            grime and on the LIT edges: as an inset box-shadow it painted on the
            background layer, so an inset:0 grime span covered it at up to 0.72
            alpha — it was ~72% gone at exactly 0/4-night, the one state it was
            written for. Top and left, because the drop shadow falls down-right
            and one object gets one key. */}
        {dark && (
          <>
            <span style={{
              position: 'absolute', left: 0, right: 0, top: 0, height: 1,
              background: 'rgba(255,205,150,0.30)',
            }} />
            <span style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 1,
              background: 'rgba(255,190,120,0.22)',
            }} />
          </>
        )}

        {/* Cobweb in the corner, gone the moment anybody touches the thing. A
            web is legible from its concentric CHORDS, not its spokes, and there
            was not one arc in the old drawing — five straight rotated hairlines
            are claw marks in every context. A square with only its right and
            bottom borders and a 100% bottom-right radius rasterises as a clean
            quarter-arc, with no rotation and so no antialiased smear. */}
        {installed === 0 && speaks && (
          <>
            {[22, 52].map((deg, i) => (
              <span key={deg} style={{
                position: 'absolute', left: 0, top: 0, width: 24 - i * 2, height: 1,
                background: 'rgba(214,226,244,0.22)',
                transform: `rotate(${deg}deg)`, transformOrigin: 'left top',
              }} />
            ))}
            {[9, 15, 22].map((r, i) => (
              <span key={r} style={{
                position: 'absolute', left: 0, top: 0, width: r, height: r,
                borderRight: `1px solid rgba(214,226,244,${0.44 - i * 0.08})`,
                borderBottom: `1px solid rgba(214,226,244,${0.44 - i * 0.08})`,
                borderRadius: '0 0 100% 0',
              }} />
            ))}
          </>
        )}

        {/* vent grille across the top, inside the 5px content margin */}
        {[4, 8, 12].map(t => (
          <span key={t} style={{
            position: 'absolute', left: 5, right: 5, top: t,
            height: 2, background: 'rgba(0,0,0,0.45)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }} />
        ))}
        {/* The seam that closes the vent panel. One non-decorative line is what
            stops 80px of empty gradient reading as a flat card. */}
        <span style={{
          position: 'absolute', left: 0, right: 0, top: 17, height: 2,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0 1px, rgba(168,186,214,0.16) 1px 2px)',
        }} />

        {/* ── The pane ──
            Tailwind's preflight sets box-sizing:border-box, so BODY.w=76
            INCLUDES the 3px border and the content box is 70 wide. At left:6
            width:64 this landed at 6..70 — flush against the inner face of the
            right border, its 2px ink merging with the body's 3px into one black
            bar, while the left kept a 6px bezel. The whole face was shoved
            right. 5..65 centres it, and the lamp row, the plate and the gauge
            now share that 5px margin. */}
        <span style={{
          position: 'absolute', left: 5, top: 21, width: 60, height: 33,
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
          ) : receiving ? (
            /* powered and tuned: a flat horizon and a carrier band crawling
               down it */
            <>
              <span style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, #16202F 0%, #22303F 62%, #2C3A45 100%)',
              }} />
              <span style={{
                position: 'absolute', left: 0, right: 0, top: 21, height: 1,
                background: 'rgba(150,200,230,0.5)',
              }} />
              <span className={anim('wx-warm')} style={{
                position: 'absolute', left: 0, right: 0, height: 6,
                background: 'linear-gradient(180deg, rgba(150,220,255,0) 0%, rgba(150,220,255,0.28) 50%, rgba(150,220,255,0) 100%)',
              }} />
            </>
          ) : powered ? (
            /* Coil only: filament, no tuning. This stage is promised at the top
               of this file and was in nobody's build — the guard read
               `powered && receiving`, and since `receiving` already requires
               the coil that is identically `receiving`, so `powered` could
               never be the deciding term and a coil-first household fell
               through to dead glass. The coil is the first part in catalogue
               order; it used to buy a stripe on the flank and nothing else. */
            <>
              <span style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, #0A1422 0%, #142131 100%)',
              }} />
              <span className={anim('wx-warm')} style={{
                position: 'absolute', left: 0, right: 0, height: 4,
                background: 'linear-gradient(180deg, rgba(120,190,235,0) 0%, rgba(120,190,235,0.22) 50%, rgba(120,190,235,0) 100%)',
              }} />
            </>
          ) : (
            /* Dead glass, with the break it has had since somebody left it
               here. A line with no impact point and no branching is a specular
               streak, which is exactly what this used to read as — and it was
               the same visual word as the cobweb 20px above it. */
            <>
              <span style={{
                position: 'absolute', left: 14, top: 12, width: 2, height: 2,
                background: 'rgba(230,240,255,0.55)',
              }} />
              {[
                { x: 15, y: 13, w: 21, deg: 24 },
                { x: 15, y: 13, w: 13, deg: -62 },
                { x: 22, y: 16, w: 9, deg: 74 },
              ].map(b => (
                <span key={b.deg} style={{
                  position: 'absolute', left: b.x, top: b.y, width: b.w, height: 1,
                  background: 'rgba(230,240,255,0.30)',
                  transform: `rotate(${b.deg}deg)`, transformOrigin: 'left center',
                }} />
              ))}
            </>
          )}
          {/* CRT ruling: one dark row in four at a tenth, not one in three at a
              quarter. At 0.26 over a 33px pane the bars were eleven venetian
              slats and every sky came out as the same static — rain and snow
              are small light marks, and they were indistinguishable from it. */}
          <span style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.11) 3px 4px)',
          }} />
          {/* …and one hard streak, so there is GLASS in front of the weather.
              Glass is read from what is on it, not from what is behind it. */}
          <span style={{
            position: 'absolute', left: 6, top: -10, width: 8, height: 52,
            background: 'rgba(214,232,255,0.06)',
            transform: 'rotate(24deg)', transformOrigin: 'top left',
          }} />
        </span>

        {/* ── Status lamps: one per part, in the order the parts sit on the
               machine — coil (left flank), gauge (face), dish (roof), lever
               (right flank). Keyed off WHICH part is owned, not off the count:
               the old row lit lamp i when i < installed, so a household that
               bought the dish and the lever lit the COIL and GAUGE lamps. The
               row is the one element on the prop that says which bays are live,
               which is the thing that makes an out-of-order build read as
               deliberate rather than as a smaller number. ── */}
        {MACHINE_PARTS.slice(0, total).map((p, i) => {
          const lit = built || has(p.id)
          return (
            <span key={p.id}
              className={lit && built ? anim('wx-lamp') : undefined}
              style={{
                position: 'absolute', left: 5 + i * 9, top: 58,
                width: 5, height: 5, borderRadius: '50%',
                background: lit ? LAMP_ON : LAMP_OFF,
                border: `1px solid ${INK}`,
                boxShadow: lit ? `0 0 4px ${LAMP_ON}` : undefined,
              }} />
          )
        })}

        {/* ── The bay the gauge screws into, empty ──
               A recess is DARKEST at the top, where its own lip shadows it, and
               catches bounce on the bottom inner wall. The old gradient lit the
               centre and darkened the rim, which is the shading of a sphere —
               so the biggest dark shape on the face read as a fitted rubber
               KNOB, and buying the gauge looked like losing an object. */}
        {!built && !has('gauge') && (
          <span style={{
            position: 'absolute', left: 45, top: 56, width: 20, height: 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 118%, #3A465E 0%, #161C29 46%, #05070C 88%)',
            border: `2px solid ${INK}`,
            boxShadow: 'inset 0 3px 3px rgba(0,0,0,0.95)',
          }}>
            <span style={{
              position: 'absolute', left: 5, bottom: 1, width: 6, height: 1,
              background: 'rgba(124,142,176,0.8)',
            }} />
          </span>
        )}

        {/* ── The gauge on the face (part: gauge) ── */}
        {(built || has('gauge')) && (
          <span style={{
            position: 'absolute', left: 45, top: 56, width: 20, height: 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 30%, #FFF3D0 0%, #E8C88A 46%, #8A6A2E 100%)',
            border: `2px solid ${INK}`,
          }}>
            {/* A barometer with no pressure behind it does not read; it slumps
                on the bottom peg. It is the one place the machine says out loud
                that its parts depend on each other, and it gives a gauge-first
                household a visible reason to buy the coil next. The inline
                transform is also the RESTING frame a reduced-motion reader
                gets — a sane pose, not keyframe zero's -38deg extreme. */}
            <span className={powered ? anim('wx-needle') : undefined} style={{
              position: 'absolute', left: '50%', bottom: '50%',
              width: 2, height: 6, marginLeft: -1,
              background: '#3A2408',
              transform: powered ? 'rotate(-8deg)' : 'rotate(-84deg)',
              transformOrigin: 'bottom center',
            }} />
            <span style={{
              position: 'absolute', left: 9, top: 9, width: 2, height: 2,
              borderRadius: '50%', background: '#3A2408',
            }} />
          </span>
        )}

        {/* The three screw lugs that ring the bay, drawn in BOTH states so the
            gauge lands in hardware that was visibly waiting rather than
            swallowing it. Whole pixels: at 3.5x3.5 on half-pixel offsets they
            rendered as two rows of 50% grey and vanished at 1x. */}
        <span aria-hidden style={{
          position: 'absolute', left: 43, top: 54, width: 24, height: 24,
        }}>
          {[[9, 0], [20, 15], [0, 15]].map(([l, t], i) => (
            <span key={i} style={{
              position: 'absolute', left: l, top: t, width: 4, height: 4,
              background: (built || has('gauge')) ? '#7A6634' : STEEL_HI,
              border: `1px solid ${INK}`, borderRadius: '50%',
            }} />
          ))}
        </span>

        {/* ── The count plate. The one piece of type on this prop that resolves
               at 1x, which is why it — and not the tag — carries the number. ── */}
        <span style={{
          position: 'absolute', left: 5, bottom: 6, width: 36, height: 13,
          display: 'grid', placeItems: 'center',
          background: '#0C1120',
          border: `2px solid ${INK}`,
          fontFamily: PIXEL_FONT, fontSize: 6, letterSpacing: 1,
          color: speaks ? (built ? LAMP_ON : GOLD) : '#3E4757',
        }}>
          {!speaks ? '···' : built ? 'READY' : `${installed}/${total}`}
        </span>

        {/* gold rivets — the app's "this is a premium surface" marker */}
        {[{ l: 2, t: 2 }, { r: 2, t: 2 }, { l: 2, b: 2 }, { r: 2, b: 2 }].map((p, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: p.l, top: p.t, right: p.r, bottom: p.b,
            width: 3, height: 3,
            background: built ? GOLD : '#6B5A2E',
            boxShadow: `1px 1px 0 ${INK}`,
          }} />
        ))}
      </span>

      {/* ── Feet, with a lit top plane so they separate from the case's own
             black bottom border. They used to be STEEL_LO butted against that
             border, so they merged into it and no legs read at all — and with
             ~30px of floorboard between them, the room now shows THROUGH the
             silhouette, which is the cheapest single thing that stops a prop
             reading as a UI card. ── */}
      {[BODY.left + 5, BODY.left + BODY.w - 19].map(l => (
        <span key={l} aria-hidden style={{
          position: 'absolute', left: l, top: BODY.top + BODY.h - 2,
          width: 14, height: 8,
          background: `linear-gradient(180deg, ${STEEL_LIT} 0 2px, ${STEEL_MID} 2px 5px, ${STEEL_LO} 5px)`,
          border: `2px solid ${INK}`, borderTop: 0,
          borderRadius: '0 0 2px 2px',
        }} />
      ))}
      {/* Two HARD contact patches, offset down-right like the body's own
          shadow. The single soft radial ellipse that was here was the only
          blurred element on the whole prop, it sat under a two-footed object,
          and it began below where the feet ended — so the machine hovered over
          a smudge. */}
      {[BODY.left + 7, BODY.left + BODY.w - 17].map(l => (
        <span key={l} aria-hidden style={{
          position: 'absolute', left: l, top: BODY.top + BODY.h + 6,
          width: 15, height: 3,
          background: 'rgba(46,22,10,0.5)',
        }} />
      ))}
    </>
  )
}
