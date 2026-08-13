'use client'

// ═══════════════════════════════════════════════════════════════════════════
// TREAT TUMBLE EREN — the character you steer.
//
// He used to be one drawing that bobbed. You dragged him across the whole
// screen and nothing about him changed: same face catching a golden star as
// eating a mousetrap. Every readable thing that happened to him happened to
// the SCENE instead — the screen shook, the score flashed — so the cat was the
// one part of the game that never reacted to the game.
//
// Six poses now, and the pose is chosen by what just happened rather than by a
// timer: he leans into a drag, opens his mouth on a catch, flinches on a hit,
// and stands up on his back paws once the combo is hot. His eyes also track
// the nearest treat, which is the cheapest of the six and the one that reads
// most as "alive" — you catch him looking before you catch him moving.
//
// Not PixelEren. That is the 20×20 mascot that stands beside a board and reads
// at ~30px; this one is the player, drawn at 72px, and it needs a directional
// run lean and a mouth wide enough to sell a catch. Blowing the mascot up 3.6×
// would look worse and would push poses into the shared sprite that no other
// game has any use for. Involuntary motion — blinks, ear flicks — still comes
// from useErenIdle, so he blinks on the same rhythm as every other Eren.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'

export type TumblePose =
  | 'ready'   // standing, watching the sky
  | 'run'     // leaning into a drag
  | 'nom'     // mouth open on a catch
  | 'hurt'    // flinch, ears pinned, eyes squeezed
  | 'hype'    // combo is hot — up on the back paws
  | 'sad'     // out of lives

const INK    = '#4A2E1A'
const FUR    = '#F9EDD5'
const FUR_HI = '#FFFCF2'
const FUR_SH = '#E5D9BE'
const POINT  = '#D4B896'
const PINK   = '#F4B0B8'
const EYE    = '#6BAED6'
const PUPIL  = '#1A1A2E'
const NOSE   = '#F48B9B'
const MOUTH  = '#7A2438'
const TONGUE = '#F06292'
const WHISK  = 'rgba(255,255,255,0.62)'

interface Props {
  pose: TumblePose
  /** -1 / 0 / +1 — travel direction. Leans the body, streams the tail. */
  dir?: number
  /** -1 / 0 / +1 — where the eyes point, i.e. the nearest treat. */
  look?: number
  size?: number
  /** From useErenIdle — eyes shut this instant. */
  blink?: boolean
  /** From useErenIdle — an ear is flicking. */
  twitch?: boolean
  reduced?: boolean
}

/** Tail angle per pose, degrees. The tail leaves the left hip pointing out and
 *  hooks upward, so POSITIVE swings it down (trailing, drooping) and negative
 *  lifts it. Rotation is about the hip joint, which the body covers — a tail
 *  pivoting anywhere else detaches from the cat the moment it moves. */
const TAIL_ANGLE: Record<TumblePose, number> = {
  ready: 0, run: 26, nom: -6, hurt: 16, hype: -26, sad: 42,
}

const TreatTumbleEren = memo(function TreatTumbleEren({
  pose, dir = 0, look = 0, size = 72, blink = false, twitch = false, reduced = false,
}: Props) {
  const running = pose === 'run'
  const nom     = pose === 'nom'
  const hurt    = pose === 'hurt'
  const hype    = pose === 'hype'
  const sad     = pose === 'sad'

  // A blink can't stomp a pose whose whole job is the eye shape.
  const shut = blink && (pose === 'ready' || running)
  // Ears pin back when he is hit or beaten; they perk when he is winning.
  const flatEars = hurt || sad
  const earDy = hype ? -1 : running ? 1 : 0
  // Leaning into the drag is the single clearest "he is moving" signal, and it
  // costs one transform — no extra artwork.
  const lean = running ? dir * 7 : hurt ? 4 : 0

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated',
        display: 'block',
        overflow: 'visible',
        transform: `rotate(${lean}deg)${hurt ? ' translateY(2px)' : ''}`,
        transformOrigin: '50% 92%',
        transition: reduced ? 'none' : 'transform 120ms ease-out',
      }}>

      {/* ── Tail ── outer group swishes, inner group holds the pose angle, so
          the two transforms compose instead of overwriting each other. Kept
          short and tapered: a tail that reaches head height reads as a plank. */}
      <g style={{
        transformOrigin: '6px 19px',
        animation: reduced ? 'none' : `ttTailSwish ${running ? '0.5s' : '2.4s'} ease-in-out infinite`,
      }}>
        <g style={{ transformOrigin: '6px 19px', transform: `rotate(${TAIL_ANGLE[pose]}deg)` }}>
          {/* shaft out of the hip, then a hook upward */}
          <rect x="0" y="17" width="7" height="3" fill={INK} />
          <rect x="0" y="12" width="3" height="6" fill={INK} />
          <rect x="1" y="18" width="5" height="1" fill={POINT} />
          <rect x="1" y="13" width="1" height="5" fill={POINT} />
          <rect x="1" y="13" width="2" height="2" fill={FUR_SH} />
        </g>
      </g>

      {/* ── Ears ── */}
      {flatEars ? (
        // Pinned back and low. Tucked against the skull, not floating off it.
        <>
          <rect x="2"  y="7" width="4" height="2" fill={INK} />
          <rect x="3"  y="7" width="2" height="1" fill={POINT} />
          <rect x="18" y="7" width="4" height="2" fill={INK} />
          <rect x="19" y="7" width="2" height="1" fill={POINT} />
        </>
      ) : (
        // Stepped triangles, wider than the head at the base. Square ears read
        // as a toaster no matter how good the face inside them is.
        <>
          <g transform={`translate(0,${earDy})`}>
            <rect x="5" y="1" width="2" height="1" fill={INK} />
            <rect x="4" y="2" width="4" height="1" fill={INK} />
            <rect x="4" y="3" width="5" height="1" fill={INK} />
            <rect x="3" y="4" width="6" height="3" fill={INK} />
            <rect x="5" y="2" width="1" height="1" fill={POINT} />
            <rect x="5" y="3" width="2" height="1" fill={POINT} />
            <rect x="4" y="4" width="4" height="2" fill={POINT} />
            <rect x="5" y="4" width="2" height="2" fill={PINK} />
          </g>
          <g transform={`translate(0,${earDy + (twitch ? 1 : 0)})`}>
            <rect x="17" y="1" width="2" height="1" fill={INK} />
            <rect x="16" y="2" width="4" height="1" fill={INK} />
            <rect x="15" y="3" width="5" height="1" fill={INK} />
            <rect x="15" y="4" width="6" height="3" fill={INK} />
            <rect x="18" y="2" width="1" height="1" fill={POINT} />
            <rect x="17" y="3" width="2" height="1" fill={POINT} />
            <rect x="16" y="4" width="4" height="2" fill={POINT} />
            <rect x="17" y="4" width="2" height="2" fill={PINK} />
          </g>
        </>
      )}

      {/* ── Body ── narrower than the head, so there is a shoulder step. Two
          boxes of identical width stacked on each other read as furniture. */}
      <rect x="5" y="15" width="14" height="7" fill={INK} />
      <rect x="6" y="15" width="12" height="6" fill={FUR} />
      <rect x="6" y="15" width="12" height="1" fill="#FFFFFF" opacity="0.45" />
      <rect x="6" y="20" width="12" height="1" fill={FUR_SH} />

      {/* ── Back paws ── the run cycle is two CSS-driven groups on opposite
          halves of the same beat, so the shuffle costs no React renders. */}
      {hurt || sad ? (
        // splayed wide — knocked off balance
        <>
          <rect x="3"  y="21" width="5" height="3" fill={INK} />
          <rect x="4"  y="22" width="3" height="1" fill={POINT} />
          <rect x="16" y="21" width="5" height="3" fill={INK} />
          <rect x="17" y="22" width="3" height="1" fill={POINT} />
        </>
      ) : (
        <>
          <g style={{ animation: running && !reduced ? 'ttPawStepA 0.26s steps(1) infinite' : 'none' }}>
            <rect x="6" y="21" width="4" height="3" fill={INK} />
            <rect x="7" y="22" width="2" height="1" fill={POINT} />
          </g>
          <g style={{ animation: running && !reduced ? 'ttPawStepB 0.26s steps(1) infinite' : 'none' }}>
            <rect x="14" y="21" width="4" height="3" fill={INK} />
            <rect x="15" y="22" width="2" height="1" fill={POINT} />
          </g>
        </>
      )}

      {/* ── Front paws thrown out (hype) ── at chest height, not overhead:
          raised above the head they collide with the ears and the three of
          them merge into one blob at 72px. */}
      {hype && (
        <>
          <rect x="0"  y="14" width="5" height="3" fill={INK} />
          <rect x="1"  y="15" width="3" height="1" fill={POINT} />
          <rect x="19" y="14" width="5" height="3" fill={INK} />
          <rect x="20" y="15" width="3" height="1" fill={POINT} />
        </>
      )}

      {/* ── Head ── */}
      <rect x="6" y="4" width="12" height="1" fill={INK} />
      <rect x="5" y="5" width="14" height="1" fill={INK} />
      <rect x="4" y="6" width="16" height="9" fill={INK} />
      <rect x="6" y="5" width="12" height="1" fill={FUR} />
      <rect x="5" y="6" width="14" height="8" fill={FUR} />
      <rect x="5" y="6" width="14" height="1" fill="#FFFFFF" opacity="0.42" />
      {/* Ragdoll mask points — wide enough to frame the eyes, or the colour is
          too close to the fur to register at all. */}
      <rect x="6"  y="7" width="4" height="3" fill={POINT} />
      <rect x="14" y="7" width="4" height="3" fill={POINT} />

      {/* ── Eyes ── the glance shift is what makes him look like he is playing
          the game rather than standing in front of it. */}
      <g transform={look && !shut && !nom && !hurt ? `translate(${look},0)` : undefined}>
        {shut ? (
          <>
            <rect x="7"  y="9" width="2" height="1" fill={INK} />
            <rect x="15" y="9" width="2" height="1" fill={INK} />
          </>
        ) : hurt ? (
          // >< — squeezed shut
          <>
            <rect x="6"  y="8" width="1" height="1" fill={INK} />
            <rect x="7"  y="9" width="2" height="1" fill={INK} />
            <rect x="9"  y="8" width="1" height="1" fill={INK} />
            <rect x="14" y="8" width="1" height="1" fill={INK} />
            <rect x="15" y="9" width="2" height="1" fill={INK} />
            <rect x="17" y="8" width="1" height="1" fill={INK} />
          </>
        ) : nom || hype ? (
          // ^ ^ — happy arcs
          <>
            <rect x="6"  y="9" width="1" height="1" fill={INK} />
            <rect x="7"  y="8" width="2" height="1" fill={INK} />
            <rect x="9"  y="9" width="1" height="1" fill={INK} />
            <rect x="14" y="9" width="1" height="1" fill={INK} />
            <rect x="15" y="8" width="2" height="1" fill={INK} />
            <rect x="17" y="9" width="1" height="1" fill={INK} />
          </>
        ) : sad ? (
          <>
            <rect x="7"  y="9" width="2" height="1" fill={PUPIL} />
            <rect x="7"  y="8" width="1" height="1" fill={PUPIL} />
            <rect x="15" y="9" width="2" height="1" fill={PUPIL} />
            <rect x="16" y="8" width="1" height="1" fill={PUPIL} />
            <rect x="15" y="10" width="1" height="3" fill={EYE} />
          </>
        ) : (
          <>
            <rect x="7"  y="8" width="2" height="2" fill={EYE} />
            <rect x="7"  y="8" width="1" height="1" fill="#FFFFFF" />
            <rect x="8"  y="9" width="1" height="1" fill={PUPIL} />
            <rect x="15" y="8" width="2" height="2" fill={EYE} />
            <rect x="15" y="8" width="1" height="1" fill="#FFFFFF" />
            <rect x="16" y="9" width="1" height="1" fill={PUPIL} />
          </>
        )}
      </g>

      {/* ── Muzzle, cheeks, nose ── */}
      <rect x="9"  y="11" width="6" height="3" fill="#FFFFFF" opacity="0.5" />
      <rect x="5"  y="11" width="2" height="1" fill={PINK} opacity={nom || hype ? 0.95 : 0.62} />
      <rect x="17" y="11" width="2" height="1" fill={PINK} opacity={nom || hype ? 0.95 : 0.62} />
      <rect x="11" y="10" width="2" height="1" fill={NOSE} />

      {/* ── Mouth ── */}
      {nom ? (
        <>
          <rect x="9"  y="11" width="6" height="3" fill={INK} />
          <rect x="10" y="12" width="4" height="2" fill={MOUTH} />
          <rect x="11" y="13" width="2" height="1" fill={TONGUE} />
        </>
      ) : hype ? (
        <>
          <rect x="8"  y="11" width="8" height="1" fill={INK} />
          <rect x="9"  y="12" width="6" height="1" fill={MOUTH} />
          <rect x="10" y="13" width="4" height="1" fill={INK} />
        </>
      ) : hurt ? (
        <>
          <rect x="10" y="11" width="4" height="3" fill={INK} />
          <rect x="11" y="12" width="2" height="1" fill={MOUTH} />
        </>
      ) : sad ? (
        <>
          <rect x="11" y="12" width="2" height="1" fill={INK} />
          <rect x="10" y="13" width="1" height="1" fill={INK} />
          <rect x="13" y="13" width="1" height="1" fill={INK} />
        </>
      ) : (
        // :3
        <>
          <rect x="10" y="12" width="1" height="1" fill={INK} />
          <rect x="13" y="12" width="1" height="1" fill={INK} />
          <rect x="11" y="13" width="2" height="1" fill={INK} />
        </>
      )}

      {/* ── Whiskers ── short. Any longer and they stop reading as whiskers
          and start reading as pipes sticking out of his head. */}
      <rect x="1"  y={sad ? 11 : 10} width="3" height="1" fill={WHISK} />
      <rect x="20" y={sad ? 11 : 10} width="3" height="1" fill={WHISK} />
      <rect x="2"  y={sad ? 13 : 12} width="2" height="1" fill={WHISK} opacity="0.75" />
      <rect x="20" y={sad ? 13 : 12} width="2" height="1" fill={WHISK} opacity="0.75" />
    </svg>
  )
})

export default TreatTumbleEren
export { TreatTumbleEren }
