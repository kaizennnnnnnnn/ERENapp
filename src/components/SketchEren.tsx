'use client'

// Sketch-pen animated Eren — 54 reactive states for the Serbian lessons,
// the daily mood gate, the daily gift and the couple nudges. Ported verbatim
// from the design file (eren-sketch-plus.jsx); all states reuse the same
// head/body geometry and only the eyes/mouth/extras/transform change.

import { useId } from 'react'

export type SketchErenState =
  | 'idle' | 'happy' | 'sad' | 'thinking' | 'sleeping'
  | 'wave' | 'cheer' | 'love' | 'confused' | 'streak'
  | 'tired' | 'dance' | 'wink' | 'point' | 'peek'
  | 'shy' | 'wow' | 'cry' | 'magic' | 'listen'
  | 'eureka' | 'shrug' | 'flex' | 'gasp' | 'grad'
  | 'rocket' | 'nom' | 'bow' | 'focus' | 'chill'
  | 'trophy' | 'kiss' | 'angry' | 'proud' | 'meditate'
  | 'sick' | 'read' | 'pet' | 'party' | 'yawn'
  | 'silly' | 'laugh' | 'highfive' | 'sneeze' | 'scared'
  | 'dizzy' | 'sip' | 'search' | 'cold' | 'facepalm'
  | 'gift' | 'salute' | 'sing' | 'balloon'

export const SKETCH_EREN_STATES: SketchErenState[] = [
  'idle','happy','sad','thinking','sleeping','wave','cheer','love',
  'confused','streak','tired','dance','wink','point','peek','shy',
  'wow','cry','magic','listen','eureka','shrug','flex','gasp',
  'grad','rocket','nom','bow','focus','chill','trophy','kiss',
  'angry','proud','meditate','sick','read','pet','party','yawn',
  'silly','laugh','highfive','sneeze','scared','dizzy','sip','search',
  'cold','facepalm','gift','salute','sing','balloon',
]

const INK = '#1c1c1c'
const BLUE = '#3a8acb'
const BLUE_HL = '#cfe6f7'
const PINK = '#e89aae'
const GREY = '#a89a86'
// Eren seal-point colorpoint fur (warm taupe brown) + darker ear/tail tips
const FUR = '#8a7768'
const FUR_DK = '#574438'

const HEAD  = "M 22 66 Q 8 100, 22 132 Q 50 152, 100 152 Q 150 152, 178 132 Q 192 100, 178 66"
const CAP   = "M 22 66 Q 16 80, 24 88 Q 40 80, 60 76 Q 76 72, 84 74 L 92 86 L 100 74 L 108 86 L 116 74 Q 124 72, 140 76 Q 160 80, 176 88 Q 184 80, 178 66 L 158 8 L 132 58 Q 100 52, 68 58 L 42 8 Z"
const IL    = "M 47 22 L 38 58 L 64 56 Z"
const IR    = "M 153 22 L 162 58 L 136 56 Z"
const NOSE  = "M 92 118 L 108 118 L 100 128 Z"
const EYE_L  = { cx: 74, cy: 100 }
const EYE_R  = { cx: 126, cy: 100 }

interface SketchErenProps {
  state?: SketchErenState
  size?: number
  /** If true, removes the cream background so the SVG floats on the parent surface. */
  transparent?: boolean
  /** Hide the bottom-right speech bubble (default visible). */
  noSpeech?: boolean
}

export default function SketchEren({
  state = 'idle',
  size = 200,
  transparent = false,
  noSpeech = false,
}: SketchErenProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const fid = `boilx-${uid}`
  const gid = `furg-${uid}`
  const bfid = `furblur-${uid}`
  const cid = `headclip-${uid}`

  // body-level transforms that animate via CSS classes
  return (
    <div className={`eren-sk eren-sk-${state}`}
      style={{ width: size, height: size * 1.1, position: 'relative',
               background: transparent ? 'transparent' : '#fbf4dc',
               overflow: 'hidden' }}>
      <SketchPlusStyles />

      <svg viewBox="0 0 200 220" width="100%" height="100%">
        <defs>
          <filter id={fid} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="1">
              <animate attributeName="seed" values="1;2;3;4;5;6;7;8"
                dur="0.7s" calcMode="discrete" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="1.4" />
          </filter>
          {/* vertical fur gradient — lighter crown, deeper toward the cheeks */}
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9d8b79" />
            <stop offset="0.5" stopColor={FUR} />
            <stop offset="1" stopColor="#776150" />
          </linearGradient>
          {/* soft-edge blur used to feather the colorpoint into the face */}
          <filter id={bfid} filterUnits="userSpaceOnUse"
            x="-20" y="-20" width="240" height="260">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          {/* clip = full head + ears silhouette, so the blurred mask blends
             softly into the white face but stays crisp at the outer edge */}
          <clipPath id={cid}>
            <path d="M 42 8 L 22 66 Q 8 100, 22 132 Q 50 152, 100 152 Q 150 152, 178 132 Q 192 100, 178 66 L 158 8 L 132 58 Q 100 52, 68 58 Z" />
          </clipPath>
        </defs>

        <g filter={`url(#${fid})`}>
          <g className="sk-body">
            {/* TAIL — inside body group so it follows all body transforms.
               Seal-point brown with a darker fluffy tip (Eren look). */}
            <g className="sk-tail">
              <path d="M 160 168 Q 196 148, 192 110 Q 188 84, 168 90 Q 152 96, 160 112 Z"
                fill={FUR} />
              {/* darker tip */}
              <path d="M 192 110 Q 188 84, 168 90 Q 160 95, 165 106 Q 180 102, 186 114 Q 190 113, 192 110 Z"
                fill={FUR_DK} opacity="0.7" />
              {/* soft banding + lighter underside fur */}
              <g opacity="0.4" fill="none" strokeLinecap="round">
                <path d="M 165 150 Q 174 145, 183 150" stroke={FUR_DK} strokeWidth="3" />
                <path d="M 171 128 Q 180 123, 188 129" stroke={FUR_DK} strokeWidth="2.6" />
              </g>
              <path d="M 162 162 Q 156 134, 169 110" stroke="#b6a995" strokeWidth="2.2"
                fill="none" strokeLinecap="round" opacity="0.6" />
              <path d="M 160 168 Q 196 148, 192 110 Q 188 84, 168 90 Q 152 96, 160 112"
                fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"
                strokeLinejoin="round" />
              {/* fur ticks */}
              <path d="M 175 152 Q 182 150, 186 148 M 180 132 Q 186 130, 188 126 M 182 116 Q 186 114, 186 110"
                stroke={INK} strokeWidth="1.4" fill="none" />
            </g>
            {/* BODY */}
            <path d="M 60 132 Q 28 148, 24 184 Q 26 210, 50 220 L 150 220 Q 174 210, 176 184 Q 172 148, 140 132 Q 100 144, 60 132 Z"
              fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            {/* chest fluff shading + haunch contours */}
            <g opacity="0.4" fill="none" strokeLinecap="round">
              <path d="M 46 156 Q 34 182, 42 208" stroke="#e7ddcd" strokeWidth="3" />
              <path d="M 154 156 Q 166 182, 158 208" stroke="#e7ddcd" strokeWidth="3" />
              <path d="M 78 150 Q 100 168, 122 150" stroke="#e7ddcd" strokeWidth="2.4" />
            </g>
            {/* neck shadow just under the chin */}
            <path d="M 76 150 Q 100 160, 124 150" stroke="#ddd2c0" strokeWidth="3"
              fill="none" strokeLinecap="round" opacity="0.4" />
            <path d="M 100 178 L 100 218" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            <path d="M 80 204 Q 100 210, 120 204" stroke={INK} strokeWidth="1.5"
              fill="none" opacity="0.6" />
            {/* toe lines on the front paws */}
            <g stroke={INK} strokeWidth="1.4" strokeLinecap="round" opacity="0.5">
              <path d="M 84 210 L 84 219" />
              <path d="M 92 212 L 92 220" />
              <path d="M 108 212 L 108 220" />
              <path d="M 116 210 L 116 219" />
            </g>
            {/* haunch contours — round the back legs on the lower sides */}
            <g opacity="0.32" fill="none" strokeLinecap="round">
              <path d="M 50 186 Q 60 196, 57 210" stroke="#d8cdbb" strokeWidth="2.4" />
              <path d="M 150 186 Q 140 196, 143 210" stroke="#d8cdbb" strokeWidth="2.4" />
            </g>

            {/* paws/arms moved to AFTER head group so they render on top */}

            {/* HEAD */}
            <g className="sk-head">
              {/* white face base */}
              <path d={HEAD + ' Z'} fill="#fff" stroke={INK} strokeWidth="2.4"
                strokeLinejoin="round" />

              {/* SEAL-POINT MASK — soft-blurred brown colorpoint, clipped to the
                 head so it feathers smoothly into the white face. The ear/crown
                 silhouette is kept crisp by the ink outline drawn afterwards;
                 the lower colorpoint edge is intentionally left soft. */}
              <g clipPath={`url(#${cid})`}>
                <path d="M 42 8
                         L 22 66
                         Q 8 100, 24 122
                         Q 40 134, 60 124
                         Q 78 114, 86 98
                         Q 88 82, 90 72
                         Q 94 68, 100 68
                         Q 106 68, 110 72
                         Q 112 82, 114 98
                         Q 122 114, 140 124
                         Q 160 134, 176 122
                         Q 192 100, 178 66
                         L 158 8
                         L 132 58
                         Q 100 52, 68 58 Z"
                  fill={`url(#${gid})`} filter={`url(#${bfid})`} />
                {/* eye-socket shading — depth within the mask */}
                <g fill={FUR_DK} opacity="0.18" filter={`url(#${bfid})`}>
                  <ellipse cx="74" cy="99" rx="16" ry="14" />
                  <ellipse cx="126" cy="99" rx="16" ry="14" />
                </g>
                {/* darker ear tips */}
                <path d="M 42 8 L 32 38 Q 44 32, 54 36 Z" fill={FUR_DK} opacity="0.55"
                  filter={`url(#${bfid})`} />
                <path d="M 158 8 L 168 38 Q 156 32, 146 36 Z" fill={FUR_DK} opacity="0.55"
                  filter={`url(#${bfid})`} />
                {/* tabby striping — light fur streaks radiating up the forehead
                   either side of the blaze (clipped to stay on the brown) */}
                <g stroke="#cabca7" strokeLinecap="round" fill="none" opacity="0.55">
                  <path d="M 84 94 Q 80 78, 82 62" strokeWidth="2.4" />
                  <path d="M 72 100 Q 66 84, 66 66" strokeWidth="2.2" />
                  <path d="M 58 108 Q 50 92, 49 74" strokeWidth="2" />
                  <path d="M 116 94 Q 120 78, 118 62" strokeWidth="2.4" />
                  <path d="M 128 100 Q 134 84, 134 66" strokeWidth="2.2" />
                  <path d="M 142 108 Q 150 92, 151 74" strokeWidth="2" />
                </g>
              </g>

              {/* crisp ink outline — ear + crown silhouette only */}
              <path d="M 22 66 L 42 8 L 68 58 Q 100 52, 132 58 L 158 8 L 178 66"
                fill="none" stroke={INK} strokeWidth="2.4" strokeLinejoin="round"
                strokeLinecap="round" />

              {/* inner ears — pale pink */}
              {/* ═══ EARS — pale inner bowl, soft pink centre, fluffy tufts,
                 and a darker outer rim, matching the Ragdoll reference ═══ */}
              {/* darker outer-ear rim just inside the silhouette */}
              <g stroke={FUR_DK} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.4">
                <path d="M 29 60 L 43 14" />
                <path d="M 171 60 L 157 14" />
              </g>
              {/* pale inner-ear bowls (filling most of each ear triangle) */}
              <path d="M 44 20 Q 36 36, 38 52 Q 47 59, 56 52 Q 56 36, 48 20 Q 46 17, 44 20 Z"
                fill="#ecdcd6" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M 156 20 Q 164 36, 162 52 Q 153 59, 144 52 Q 144 36, 152 20 Q 154 17, 156 20 Z"
                fill="#ecdcd6" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
              {/* soft pink centres */}
              <path d="M 46 30 Q 41 42, 45 51 Q 51 54, 55 48 Q 56 39, 49 29 Q 47 27, 46 30 Z"
                fill={PINK} opacity="0.42" />
              <path d="M 154 30 Q 159 42, 155 51 Q 149 54, 145 48 Q 144 39, 151 29 Q 153 27, 154 30 Z"
                fill={PINK} opacity="0.42" />
              {/* fluffy light tufts inside the ears */}
              <g stroke="#f4ede2" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.9">
                <path d="M 44 52 L 46 34" />
                <path d="M 51 52 L 53 36" />
                <path d="M 40 50 L 41 39" />
                <path d="M 156 52 L 154 34" />
                <path d="M 149 52 L 147 36" />
                <path d="M 160 50 L 159 39" />
              </g>

              {/* cheek-fluff shading + whisker-pad dots on the white muzzle */}
              <g opacity="0.5">
                <path d="M 42 116 Q 50 130, 66 134" stroke="#e3d9c8" strokeWidth="2.4"
                  fill="none" strokeLinecap="round" />
                <path d="M 158 116 Q 150 130, 134 134" stroke="#e3d9c8" strokeWidth="2.4"
                  fill="none" strokeLinecap="round" />
              </g>
              <g fill="#b9ab97" opacity="0.7">
                <circle cx="64" cy="122" r="0.9" />
                <circle cx="60" cy="128" r="0.9" />
                <circle cx="68" cy="127" r="0.9" />
                <circle cx="136" cy="122" r="0.9" />
                <circle cx="140" cy="128" r="0.9" />
                <circle cx="132" cy="127" r="0.9" />
              </g>

              {/* pale brow tufts standing up above each eye */}
              <g stroke="#e6dccb" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7">
                <path d="M 64 86 Q 62 80, 65 75" />
                <path d="M 72 84 Q 71 78, 74 73" />
                <path d="M 136 86 Q 138 80, 135 75" />
                <path d="M 128 84 Q 129 78, 126 73" />
              </g>

              {/* whiskers */}
              <g stroke={INK} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7">
                <path d="M 52 116 Q 30 114, 12 118" />
                <path d="M 54 126 Q 30 128, 12 134" />
                <path d="M 148 116 Q 170 114, 188 118" />
                <path d="M 146 126 Q 170 128, 188 134" />
              </g>

              {/* blush for love state */}
              {state === 'love' && (
                <g>
                  <ellipse cx="48" cy="118" rx="9" ry="4.5" fill="#ff8a9a" opacity="0.55" />
                  <ellipse cx="152" cy="118" rx="9" ry="4.5" fill="#ff8a9a" opacity="0.55" />
                </g>
              )}
              {/* cheer blush */}
              {state === 'cheer' && (
                <g>
                  <circle cx="48" cy="118" r="5" fill="#ffb4b4" opacity="0.7" />
                  <circle cx="152" cy="118" r="5" fill="#ffb4b4" opacity="0.7" />
                </g>
              )}
              {/* fire crown for streak */}
              {state === 'streak' && (
                <g className="sk-fire">
                  <path d="M 86 6 Q 92 18, 100 12 Q 108 18, 114 6 Q 118 22, 110 30 Q 100 36, 90 30 Q 82 22, 86 6 Z"
                    fill="#ff6a2c" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M 92 14 Q 96 22, 100 18 Q 104 22, 108 14 Q 110 24, 100 28 Q 90 24, 92 14 Z"
                    fill="#ffd24a" opacity="0.85" />
                </g>
              )}

              {/* SUNGLASSES for chill */}
              {state === 'chill' && (
                <g className="sk-shades">
                  {/* nose bridge */}
                  <path d="M 88 100 Q 100 92, 112 100" stroke={INK} strokeWidth="2.2"
                    fill="none" strokeLinecap="round" />
                  {/* left lens */}
                  <path d="M 50 92 L 90 90 Q 92 106, 78 112 Q 60 114, 52 106 Z"
                    fill="#1c1c1c" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  {/* right lens */}
                  <path d="M 110 90 L 150 92 Q 148 106, 140 110 Q 122 114, 108 106 Z"
                    fill="#1c1c1c" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  {/* lens shine highlights */}
                  <path d="M 58 96 L 70 100" stroke="#fff" strokeWidth="1.8"
                    strokeLinecap="round" opacity="0.7" />
                  <path d="M 118 96 L 130 100" stroke="#fff" strokeWidth="1.8"
                    strokeLinecap="round" opacity="0.7" />
                  {/* arms tucking behind ears */}
                  <path d="M 50 96 L 38 92 M 150 96 L 162 92"
                    stroke={INK} strokeWidth="2" strokeLinecap="round" />
                </g>
              )}

              {/* TARGET RETICLE for focus */}
              {state === 'focus' && (
                <g className="sk-reticle">
                  <circle cx="170" cy="40" r="14" fill="none" stroke="#c8252c"
                    strokeWidth="2" />
                  <circle cx="170" cy="40" r="7" fill="none" stroke="#c8252c"
                    strokeWidth="1.6" />
                  <circle cx="170" cy="40" r="1.6" fill="#c8252c" />
                  <path d="M 150 40 L 158 40 M 182 40 L 190 40 M 170 20 L 170 28 M 170 52 L 170 60"
                    stroke="#c8252c" strokeWidth="1.6" strokeLinecap="round" />
                </g>
              )}

              {/* BROW FURROW for focus */}
              {state === 'focus' && (
                <g stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none">
                  <path d="M 60 84 L 80 88" />
                  <path d="M 140 84 L 120 88" />
                </g>
              )}

              {/* TREAT (fish bone) for nom */}
              {state === 'nom' && (
                <g className="sk-treat">
                  {/* chubby fish body */}
                  <path d="M 108 144
                           Q 108 134, 128 132
                           Q 150 132, 156 144
                           Q 150 156, 128 156
                           Q 108 154, 108 144 Z"
                    fill="#f3956a" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  {/* V-tail fin */}
                  <path d="M 156 144 L 172 132 Q 168 144, 172 156 Z"
                    fill="#f3956a" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  {/* dorsal fin */}
                  <path d="M 128 132 Q 134 124, 142 132 Z"
                    fill="#f3956a" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                  {/* little belly fin */}
                  <path d="M 138 156 Q 142 162, 146 156 Z"
                    fill="#f3956a" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
                  {/* gill curve */}
                  <path d="M 124 138 Q 122 144, 124 150"
                    stroke={INK} strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  {/* big cute eye with highlight */}
                  <circle cx="118" cy="142" r="2.4" fill={INK} />
                  <circle cx="118.6" cy="141.3" r="0.7" fill="#fff" />
                  {/* belly shimmer */}
                  <path d="M 116 150 Q 130 154, 148 150"
                    stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.6" strokeLinecap="round" />
                </g>
              )}

              {/* BOW motion lines */}
              {state === 'bow' && (
                <g stroke={INK} strokeWidth="1.4" strokeLinecap="round" fill="none"
                  opacity="0.55" className="sk-bow-arc">
                  <path d="M 24 56 Q 14 80, 26 100" />
                  <path d="M 176 56 Q 186 80, 174 100" />
                </g>
              )}

              {/* HEADPHONES for listen */}
              {state === 'listen' && (
                <g className="sk-phones">
                  <path d="M 30 60 Q 100 -4, 170 60" fill="none" stroke={INK}
                    strokeWidth="4" strokeLinecap="round" />
                  <ellipse cx="22" cy="76" rx="11" ry="14" fill="#1c1c1c" stroke={INK} strokeWidth="2" />
                  <ellipse cx="178" cy="76" rx="11" ry="14" fill="#1c1c1c" stroke={INK} strokeWidth="2" />
                  <ellipse cx="22" cy="76" rx="5" ry="7" fill="#3a8acb" />
                  <ellipse cx="178" cy="76" rx="5" ry="7" fill="#3a8acb" />
                </g>
              )}

              {/* GRADUATION cap */}
              {state === 'grad' && (
                <g className="sk-grad-cap">
                  {/* CAP BAND — sits snug on the head like a real cap base */}
                  <path d="M 32 64
                           Q 32 50, 100 46
                           Q 168 50, 168 64
                           Q 168 72, 100 70
                           Q 32 72, 32 64 Z"
                    fill="#1c1c1c" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                  {/* MORTARBOARD — flat square on top of the band */}
                  <path d="M 16 46 L 100 32 L 184 46 L 100 60 Z"
                    fill="#1c1c1c" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                  {/* subtle top highlight */}
                  <path d="M 16 46 L 100 32 L 184 46"
                    fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.4" />
                  {/* button on top */}
                  <circle cx="100" cy="32" r="2.6" fill="#ffd24a" stroke={INK} strokeWidth="1" />
                  {/* tassel — hanging off the right corner */}
                  <path d="M 184 46 Q 192 50, 192 62 Q 192 70, 196 74"
                    stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"
                    className="sk-tassel-line" />
                  <g className="sk-tassel-ball">
                    <circle cx="196" cy="76" r="4" fill="#ffd24a" stroke={INK} strokeWidth="1.4" />
                    {/* tassel strands */}
                    <path d="M 194 79 L 193 84 M 196 80 L 196 86 M 198 79 L 199 84"
                      stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
                  </g>
                </g>
              )}

              {/* PARTY hat — cone on top of head */}
              {state === 'party' && (
                <g className="sk-party-hat">
                  {/* cone */}
                  <path d="M 100 8 L 70 64 Q 100 56, 130 64 Z"
                    fill="#3a85e0" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                  {/* zig-zag stripes */}
                  <path d="M 78 50 Q 89 46, 100 50 Q 111 54, 122 50"
                    stroke="#ffd24a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                  <path d="M 84 36 Q 92 33, 100 36 Q 108 39, 116 36"
                    stroke="#e63a6b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                  {/* pom-pom on top */}
                  <circle cx="100" cy="8" r="6" fill="#ffd24a" stroke={INK} strokeWidth="1.8" />
                  <path d="M 100 2 L 100 -2 M 96 4 L 94 1 M 104 4 L 106 1 M 95 9 L 91 9 M 105 9 L 109 9"
                    stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
                  {/* brim ribbon */}
                  <path d="M 68 64 Q 100 60, 132 64 Q 100 70, 68 64 Z"
                    fill="#ffd24a" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                </g>
              )}

              {/* EUREKA lightbulb */}
              {state === 'eureka' && (
                <g className="sk-bulb">
                  {/* glow rays */}
                  <g stroke="#ffd24a" strokeWidth="2" strokeLinecap="round" fill="none"
                    className="sk-bulb-rays">
                    <path d="M 100 -2 L 100 -10" />
                    <path d="M 78 6 L 72 -2" />
                    <path d="M 122 6 L 128 -2" />
                    <path d="M 66 24 L 58 22" />
                    <path d="M 134 24 L 142 22" />
                  </g>
                  {/* bulb glass */}
                  <path d="M 86 30 Q 86 12, 100 8 Q 114 12, 114 30 Q 114 42, 108 46 L 92 46 Q 86 42, 86 30 Z"
                    fill="#fff7c2" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  {/* filament */}
                  <path d="M 92 30 Q 96 22, 100 32 Q 104 22, 108 30"
                    stroke="#c8252c" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  {/* screw base */}
                  <rect x="92" y="46" width="16" height="4" fill={GREY} stroke={INK} strokeWidth="1.4" />
                  <path d="M 92 50 L 108 50 M 92 53 L 108 53"
                    stroke={INK} strokeWidth="0.8" />
                </g>
              )}

              {/* WOW blush */}
              {state === 'wow' && (
                <g>
                  <circle cx="46" cy="120" r="6" fill="#ff8a9a" opacity="0.6" />
                  <circle cx="154" cy="120" r="6" fill="#ff8a9a" opacity="0.6" />
                </g>
              )}

              {/* SHY — full blush across face */}
              {state === 'shy' && (
                <g>
                  <ellipse cx="58" cy="118" rx="14" ry="6" fill="#ff8a9a" opacity="0.7" />
                  <ellipse cx="142" cy="118" rx="14" ry="6" fill="#ff8a9a" opacity="0.7" />
                  <path d="M 70 120 Q 76 124, 82 120 M 86 124 Q 92 128, 98 124 M 102 124 Q 108 128, 114 124 M 118 120 Q 124 124, 130 120"
                    stroke="#e89aae" strokeWidth="1.4" fill="none" opacity="0.55" />
                </g>
              )}

              {/* SICK — fever cheeks */}
              {state === 'sick' && (
                <g>
                  <ellipse cx="52" cy="120" rx="10" ry="5" fill="#d65555" opacity="0.45" />
                  <ellipse cx="148" cy="120" rx="10" ry="5" fill="#d65555" opacity="0.45" />
                  {/* sweat drop on forehead */}
                  <path d="M 80 60 Q 76 70, 80 78 Q 84 70, 80 60 Z"
                    fill="#7eb2d8" stroke={INK} strokeWidth="1.4" className="sk-drop" />
                </g>
              )}

              {/* PET — happy cheek blush */}
              {state === 'pet' && (
                <g>
                  <circle cx="48" cy="120" r="5" fill="#ffb4b4" opacity="0.7" />
                  <circle cx="152" cy="120" r="5" fill="#ffb4b4" opacity="0.7" />
                </g>
              )}

              {/* KISS — single cheek blush on kiss side */}
              {state === 'kiss' && (
                <g>
                  <ellipse cx="56" cy="120" rx="11" ry="5" fill="#ff8a9a" opacity="0.65" />
                  <ellipse cx="144" cy="120" rx="11" ry="5" fill="#ff8a9a" opacity="0.65" />
                </g>
              )}

              {/* MEDITATE — halo above head */}
              {state === 'meditate' && (
                <g className="sk-halo">
                  <ellipse cx="100" cy="14" rx="44" ry="9" fill="none"
                    stroke="#ffd24a" strokeWidth="3" />
                  <ellipse cx="100" cy="14" rx="44" ry="9" fill="none"
                    stroke="#fff7c2" strokeWidth="1.4" opacity="0.7" />
                </g>
              )}

              {/* ANGRY — steam puffs above head */}
              {state === 'angry' && (
                <g className="sk-steam">
                  <path d="M 36 14 Q 30 6, 36 0 Q 44 6, 38 14 Z"
                    fill="#d6d4cf" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M 60 6 Q 54 -4, 62 -10 Q 70 -2, 62 8 Z"
                    fill="#d6d4cf" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
                  {/* anger mark on temple */}
                  <g transform="translate(160 36)">
                    <path d="M 0 0 L 8 -4 L 4 4 L 12 0 L 4 8 L 8 0 Z"
                      fill="#c8252c" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
                  </g>
                </g>
              )}

              {/* SICK — thermometer in mouth (drawn through head group so it animates with mouth-area) */}
              {state === 'sick' && (
                <g className="sk-thermo">
                  {/* red bulb — the end that goes IN the mouth */}
                  <circle cx="116" cy="138" r="5.5" fill="#e84a4a" stroke={INK} strokeWidth="1.8" />
                  {/* glass stick */}
                  <rect x="120" y="135" width="38" height="6" rx="2"
                    fill="#fdf8e6" stroke={INK} strokeWidth="1.8" />
                  {/* mercury rising part-way up the stick */}
                  <rect x="120" y="136.4" width="14" height="3.2" fill="#e84a4a" opacity="0.9" />
                  {/* tick marks */}
                  <g stroke={INK} strokeWidth="1" opacity="0.6" strokeLinecap="round">
                    <path d="M 138 134.5 L 138 137" />
                    <path d="M 144 134.5 L 144 137" />
                    <path d="M 150 134.5 L 150 137" />
                  </g>
                  {/* rounded outer tip */}
                  <circle cx="158" cy="138" r="2.4" fill="#fdf8e6" stroke={INK} strokeWidth="1.6" />
                </g>
              )}

              <SkEyes state={state} />
              <SkNose />
              <SkMouth state={state} />

              {/* shy paws moved to AFTER head (below) so they sit on top */}
            </g>

            {/* ═══ PAWS & ACCESSORIES drawn AFTER head — they sit on top ═══ */}
            {state === 'wave' && (
              <g className="sk-paw-wave">
                {/* arm/paw shape */}
                <path d="M 38 156 Q 22 138, 22 118 Q 28 112, 36 120 Q 42 134, 50 148 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* toe beans on the paw face */}
                <ellipse cx="24" cy="118" rx="3.2" ry="3.6" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="31" cy="115" rx="3.2" ry="3.6" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="38" cy="118" rx="3.2" ry="3.6" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                {/* curved claws emerging above the toe beans */}
                <path d="M 24 114 Q 23 112, 22 111" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M 31 111 Q 31 109, 30 108" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <path d="M 38 114 Q 39 112, 40 111" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                {/* big central pad */}
                <ellipse cx="32" cy="128" rx="6" ry="4.5" fill={PINK} opacity="0.55" stroke={INK} strokeWidth="1.2" />
              </g>
            )}
            {state === 'cheer' && (
              <g>
                <g className="sk-paw-cheer-l">
                  <path d="M 50 152 Q 36 130, 36 100 Q 42 92, 50 100 Q 56 122, 62 144 Z"
                    fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  {/* toe beans + claws */}
                  <ellipse cx="38" cy="98" rx="3" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                  <ellipse cx="44" cy="94" rx="3" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                  <ellipse cx="50" cy="98" rx="3" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                  <path d="M 38 95 Q 37 93, 36 92" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <path d="M 44 91 Q 44 89, 43 88" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <path d="M 50 95 Q 51 93, 52 92" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <ellipse cx="46" cy="110" rx="5" ry="4" fill={PINK} opacity="0.55" stroke={INK} strokeWidth="1.2" />
                </g>
                <g className="sk-paw-cheer-r">
                  <path d="M 150 152 Q 164 130, 164 100 Q 158 92, 150 100 Q 144 122, 138 144 Z"
                    fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  <ellipse cx="162" cy="98" rx="3" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                  <ellipse cx="156" cy="94" rx="3" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                  <ellipse cx="150" cy="98" rx="3" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                  <path d="M 162 95 Q 163 93, 164 92" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <path d="M 156 91 Q 156 89, 157 88" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <path d="M 150 95 Q 149 93, 148 92" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <ellipse cx="154" cy="110" rx="5" ry="4" fill={PINK} opacity="0.55" stroke={INK} strokeWidth="1.2" />
                </g>
              </g>
            )}
            {state === 'thinking' && (
              <g className="sk-paw-think">
                <path d="M 116 132 Q 124 124, 130 116 Q 138 114, 138 124 Q 132 132, 124 138 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* toe beans on paw face */}
                <ellipse cx="128" cy="120" rx="2.2" ry="2.6" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                <ellipse cx="133" cy="122" rx="2.2" ry="2.6" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                <ellipse cx="131" cy="127" rx="2.2" ry="2.6" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
              </g>
            )}
            {state === 'point' && (
              <g className="sk-paw-point">
                <path d="M 150 150 Q 178 138, 196 134 Q 200 142, 192 148 Q 178 154, 150 160 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* extended finger/claw on the tip */}
                <path d="M 198 141 Q 200 140, 201 141" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                {/* toe beans on the back */}
                <ellipse cx="186" cy="148" rx="2.6" ry="2" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
              </g>
            )}
            {state === 'magic' && (
              <g className="sk-paw-magic">
                {/* simple raised arm — single curved limb from shoulder to paw */}
                <path d="M 150 150
                         Q 162 120, 162 90
                         L 178 90
                         Q 178 122, 168 152 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* paw pad at top */}
                <ellipse cx="170" cy="82" rx="11" ry="9" fill="#fff"
                  stroke={INK} strokeWidth="2.4" />
                {/* toe beans */}
                <ellipse cx="163" cy="76" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="170" cy="74" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="177" cy="76" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                {/* main pad */}
                <ellipse cx="170" cy="85" rx="5" ry="3.8" fill={PINK} opacity="0.55"
                  stroke={INK} strokeWidth="1.2" />
              </g>
            )}
            {state === 'shrug' && (
              <g className="sk-paws-shrug">
                <g>
                  <path d="M 56 150 Q 36 124, 24 110 Q 18 120, 28 134 Q 36 146, 52 158 Z"
                    fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  <ellipse cx="24" cy="108" rx="10" ry="6" fill="#fff" stroke={INK} strokeWidth="2" />
                  <ellipse cx="19" cy="103" rx="2.4" ry="3" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                  <ellipse cx="26" cy="101" rx="2.4" ry="3" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                  <ellipse cx="31" cy="105" rx="2.4" ry="3" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                </g>
                <g>
                  <path d="M 144 150 Q 164 124, 176 110 Q 182 120, 172 134 Q 164 146, 148 158 Z"
                    fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                  <ellipse cx="176" cy="108" rx="10" ry="6" fill="#fff" stroke={INK} strokeWidth="2" />
                  <ellipse cx="181" cy="103" rx="2.4" ry="3" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                  <ellipse cx="174" cy="101" rx="2.4" ry="3" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                  <ellipse cx="169" cy="105" rx="2.4" ry="3" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                </g>
              </g>
            )}
            {state === 'flex' && (
              <g className="sk-arm-flex">
                {/* strain/speed lines suggesting effort — kept clear of the
                    whiskers (y≈116-134, x≤12 / x≥188) so they don't tangle
                    with them. Moved up to the upper-cheek / temple area. */}
                <g stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none">
                  <path d="M 188 78 L 202 72" />
                  <path d="M 192 92 L 206 90" />
                  <path d="M 12 78 L -2 72" />
                  <path d="M 8 92 L -6 90" />
                </g>
              </g>
            )}
            {state === 'gasp' && (
              <g className="sk-paw-gasp">
                {/* simple curved arm — one shape from shoulder up to mouth */}
                <path d="M 70 162
                         Q 64 144, 78 132
                         Q 92 124, 104 130
                         L 110 144
                         Q 100 154, 90 156
                         Q 78 160, 70 162 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* paw pad over mouth */}
                <ellipse cx="100" cy="136" rx="12" ry="9" fill="#fff"
                  stroke={INK} strokeWidth="2.4" />
                {/* toe beans */}
                <ellipse cx="92" cy="130" rx="2.6" ry="3" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="100" cy="127" rx="2.6" ry="3" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="108" cy="130" rx="2.6" ry="3" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                {/* central pad */}
                <ellipse cx="100" cy="140" rx="5" ry="3.5" fill={PINK} opacity="0.55"
                  stroke={INK} strokeWidth="1.2" />
              </g>
            )}
            {state === 'rocket' && (
              <g className="sk-rocket">
                <path d="M 64 220 Q 76 240, 84 258 Q 92 240, 100 220 Q 108 240, 116 258 Q 124 240, 136 220 Z"
                  fill="#ff6a2c" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M 78 222 Q 88 234, 96 246 Q 100 234, 104 246 Q 112 234, 122 222 Z"
                  fill="#ffd24a" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" opacity="0.9" />
                <circle cx="46" cy="248" r="6" fill="#fff" stroke={INK} strokeWidth="1.4" opacity="0.8" />
                <circle cx="154" cy="250" r="7" fill="#fff" stroke={INK} strokeWidth="1.4" opacity="0.8" />
                <circle cx="36" cy="236" r="4" fill="#fff" stroke={INK} strokeWidth="1.2" opacity="0.7" />
                <circle cx="164" cy="238" r="4" fill="#fff" stroke={INK} strokeWidth="1.2" opacity="0.7" />
              </g>
            )}
            {state === 'shy' && (
              <g className="sk-paws-shy">
                {/* LEFT arm — clean curved sleeve from shoulder up to wrist */}
                <path d="M 52 144 Q 40 122, 50 104 Q 58 96, 70 100 L 78 110 Q 70 116, 64 124 Q 56 134, 58 146 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* LEFT paw — big round pad covering left eye */}
                <circle cx="74" cy="104" r="16" fill="#fff" stroke={INK} strokeWidth="2.4" />
                <ellipse cx="64" cy="94" rx="3.4" ry="4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.3" />
                <ellipse cx="74" cy="90" rx="3.4" ry="4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.3" />
                <ellipse cx="84" cy="94" rx="3.4" ry="4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.3" />
                <ellipse cx="74" cy="108" rx="6" ry="5" fill={PINK} opacity="0.55"
                  stroke={INK} strokeWidth="1.3" />

                {/* RIGHT arm — mirror */}
                <path d="M 148 144 Q 160 122, 150 104 Q 142 96, 130 100 L 122 110 Q 130 116, 136 124 Q 144 134, 142 146 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                <circle cx="126" cy="104" r="16" fill="#fff" stroke={INK} strokeWidth="2.4" />
                <ellipse cx="116" cy="94" rx="3.4" ry="4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.3" />
                <ellipse cx="126" cy="90" rx="3.4" ry="4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.3" />
                <ellipse cx="136" cy="94" rx="3.4" ry="4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.3" />
                <ellipse cx="126" cy="108" rx="6" ry="5" fill={PINK} opacity="0.55"
                  stroke={INK} strokeWidth="1.3" />
              </g>
            )}

            {/* ═══ NEW STATES — accessories on top of body ═══ */}
            {state === 'trophy' && (
              <g className="sk-trophy-grp">
                {/* LEFT arm holding handle */}
                <path d="M 50 152 Q 40 130, 56 116 Q 64 110, 76 116 L 84 130 Q 74 134, 68 138 Q 60 144, 60 156 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* RIGHT arm holding handle */}
                <path d="M 150 152 Q 160 130, 144 116 Q 136 110, 124 116 L 116 130 Q 126 134, 132 138 Q 140 144, 140 156 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* TROPHY CUP */}
                <g className="sk-trophy">
                  {/* handles */}
                  <path d="M 72 108 Q 60 108, 60 122 Q 60 132, 72 130"
                    stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                  <path d="M 128 108 Q 140 108, 140 122 Q 140 132, 128 130"
                    stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
                  {/* cup body */}
                  <path d="M 72 100 L 128 100 Q 126 134, 100 138 Q 74 134, 72 100 Z"
                    fill="#ffd24a" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                  {/* shine */}
                  <path d="M 80 108 Q 82 122, 92 130" stroke="#fff" strokeWidth="2"
                    fill="none" strokeLinecap="round" opacity="0.7" />
                  {/* number 1 on cup */}
                  <text x="100" y="124" textAnchor="middle" fontSize="18"
                    fontFamily='"Caveat", cursive' fill={INK} fontWeight="700">1</text>
                  {/* stem */}
                  <rect x="92" y="138" width="16" height="8" fill="#ffd24a"
                    stroke={INK} strokeWidth="2" />
                  {/* base */}
                  <path d="M 80 146 L 120 146 L 116 156 L 84 156 Z"
                    fill="#ffd24a" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                </g>
              </g>
            )}

            {state === 'kiss' && (
              <g className="sk-paw-kiss">
                {/* curved arm raised to mouth holding kiss */}
                <path d="M 50 156 Q 42 138, 54 124 Q 64 116, 78 122 L 86 134 Q 76 140, 70 146 Q 60 152, 56 158 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* paw pad near mouth */}
                <ellipse cx="80" cy="128" rx="11" ry="9" fill="#fff"
                  stroke={INK} strokeWidth="2.4" />
                <ellipse cx="72" cy="123" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="80" cy="120" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="88" cy="123" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="80" cy="132" rx="5" ry="3.5" fill={PINK} opacity="0.55"
                  stroke={INK} strokeWidth="1.2" />
              </g>
            )}

            {state === 'pet' && (
              <g className="sk-pet-hand">
                {/* sleeve / cuff */}
                <rect x="64" y="-18" width="72" height="12" rx="3"
                  fill="#3a85e0" stroke={INK} strokeWidth="2" />

                {/* simple rounded mitten — one soft bean shape */}
                <path d="M 66 -6
                         Q 52 -6, 52 12
                         Q 52 38, 76 44
                         Q 100 48, 124 44
                         Q 148 38, 148 12
                         Q 148 -6, 134 -6 Z"
                  fill="#f4d28a" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />

                {/* three tiny finger crease hints along the bottom */}
                <path d="M 80 40 Q 81 44, 80 47"
                  stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55" />
                <path d="M 100 42 Q 100 46, 100 49"
                  stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55" />
                <path d="M 120 40 Q 119 44, 120 47"
                  stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55" />
              </g>
            )}

            {state === 'read' && (
              <g className="sk-book">
                {/* open book on lap */}
                <path d="M 40 178 Q 100 168, 160 178 L 160 214 Q 100 204, 40 214 Z"
                  fill="#fdf6e0" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* center spine */}
                <path d="M 100 172 L 100 208" stroke={INK} strokeWidth="2.2" />
                {/* text lines left */}
                <g stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
                  <path d="M 50 184 L 92 184" />
                  <path d="M 50 190 L 88 191" />
                  <path d="M 50 196 L 90 197" />
                  <path d="M 50 202 L 80 204" />
                </g>
                {/* text lines right */}
                <g stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
                  <path d="M 108 184 L 150 184" />
                  <path d="M 108 190 L 152 191" />
                  <path d="M 108 196 L 148 197" />
                  <path d="M 108 202 L 144 204" />
                </g>
                {/* paws holding book corners */}
                <ellipse cx="42" cy="180" rx="10" ry="7" fill="#fff" stroke={INK} strokeWidth="2.2" />
                <ellipse cx="158" cy="180" rx="10" ry="7" fill="#fff" stroke={INK} strokeWidth="2.2" />
              </g>
            )}

            {state === 'proud' && (
              <g className="sk-medal">
                {/* ribbon */}
                <path d="M 86 150 L 100 178 L 114 150 Z"
                  fill="#3a85e0" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
                <path d="M 86 150 L 100 178 L 92 154 Z"
                  fill="#1d5fa3" stroke={INK} strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
                {/* medal disc */}
                <circle cx="100" cy="186" r="14" fill="#ffd24a" stroke={INK} strokeWidth="2.4" />
                <circle cx="100" cy="186" r="10" fill="none" stroke={INK} strokeWidth="1" opacity="0.6" />
                <text x="100" y="192" textAnchor="middle" fontSize="14"
                  fontFamily='"Caveat", cursive' fill={INK} fontWeight="700">★</text>
              </g>
            )}

            {state === 'meditate' && (
              <g className="sk-lotus">
                {/* lotus mat */}
                <ellipse cx="100" cy="218" rx="68" ry="6" fill="#9d6ee0"
                  stroke={INK} strokeWidth="2" opacity="0.4" />
                <ellipse cx="100" cy="216" rx="60" ry="4" fill="#9d6ee0"
                  stroke={INK} strokeWidth="1.6" opacity="0.7" />
                {/* paws resting in lap (palms up) */}
                <ellipse cx="58" cy="202" rx="12" ry="6" fill="#fff" stroke={INK} strokeWidth="2.2" />
                <ellipse cx="142" cy="202" rx="12" ry="6" fill="#fff" stroke={INK} strokeWidth="2.2" />
                {/* finger curl hints */}
                <path d="M 50 202 Q 54 198, 58 202 Q 62 198, 66 202"
                  stroke={INK} strokeWidth="1.2" fill="none" />
                <path d="M 134 202 Q 138 198, 142 202 Q 146 198, 150 202"
                  stroke={INK} strokeWidth="1.2" fill="none" />
              </g>
            )}

            {/* ═══ NEW STATES (batch 2) — paws & props on top of body ═══ */}
            {state === 'highfive' && (
              <g className="sk-paw-highfive">
                {/* raised arm */}
                <path d="M 150 152 Q 162 130, 160 104 L 176 104 Q 178 132, 168 154 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* big open palm facing the viewer */}
                <circle cx="170" cy="92" r="16" fill="#fff" stroke={INK} strokeWidth="2.4" />
                <ellipse cx="162" cy="84" rx="3" ry="3.6" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="170" cy="81" rx="3" ry="3.6" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="178" cy="84" rx="3" ry="3.6" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.2" />
                <ellipse cx="170" cy="96" rx="6" ry="5" fill={PINK} opacity="0.55" stroke={INK} strokeWidth="1.2" />
              </g>
            )}

            {state === 'sip' && (
              <g className="sk-mug-grp">
                {/* arm cradling the mug */}
                <path d="M 60 156 Q 54 140, 66 128 Q 76 122, 88 128 L 94 140 Q 84 144, 78 150 Q 68 154, 64 158 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* mug body */}
                <path d="M 78 126 L 120 126 L 116 150 Q 100 156, 82 150 Z"
                  fill="#3a85e0" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* handle */}
                <path d="M 120 130 Q 132 130, 132 138 Q 132 146, 120 144"
                  stroke={INK} strokeWidth="2.4" fill="none" />
                {/* rim */}
                <ellipse cx="99" cy="126" rx="21" ry="4" fill="#cfe6f7" stroke={INK} strokeWidth="2" />
                {/* little heart on the mug */}
                <path d="M 99 142 C 94 138, 93 134, 96 133 C 98 132, 99 134 99 135 C 99 134, 100 132, 102 133 C 105 134, 104 138, 99 142 Z"
                  fill="#fff" opacity="0.85" />
              </g>
            )}

            {state === 'search' && (
              <g className="sk-magnify">
                {/* arm holding the glass */}
                <path d="M 150 152 Q 162 134, 158 116 L 174 116 Q 176 138, 168 156 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* handle */}
                <rect x="161" y="108" width="8" height="24" rx="3" fill="#a37444"
                  stroke={INK} strokeWidth="2.2" transform="rotate(40 165 120)" />
                {/* lens */}
                <circle cx="150" cy="94" r="20" fill="#cfe6f7" opacity="0.5" stroke={INK} strokeWidth="3.2" />
                <circle cx="150" cy="94" r="20" fill="none" stroke={INK} strokeWidth="1" opacity="0.5" />
                {/* shine */}
                <path d="M 142 86 Q 138 94, 142 102" stroke="#fff" strokeWidth="2.6"
                  fill="none" strokeLinecap="round" opacity="0.8" />
              </g>
            )}

            {state === 'cold' && (
              <g className="sk-cold-arms">
                {/* both arms hugging across the chest */}
                <path d="M 56 150 Q 70 138, 96 140 Q 104 142, 100 150 Q 80 152, 64 162 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M 144 150 Q 130 138, 104 140 Q 96 142, 100 150 Q 120 152, 136 162 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* paw pads at the hands */}
                <ellipse cx="98" cy="146" rx="5" ry="3.6" fill={PINK} opacity="0.55" stroke={INK} strokeWidth="1" />
                <ellipse cx="102" cy="146" rx="5" ry="3.6" fill={PINK} opacity="0.55" stroke={INK} strokeWidth="1" />
              </g>
            )}

            {/* ═══ NEW STATES (batch 3) — paws & props on top of body ═══ */}
            {state === 'facepalm' && (
              <g className="sk-paw-facepalm">
                {/* arm sweeping up from the left shoulder to the forehead */}
                <path d="M 58 160 Q 46 134, 60 112 Q 70 100, 84 102 L 94 116 Q 82 122, 74 132 Q 64 144, 64 162 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* rounded paw mitten pressed over the brow */}
                <path d="M 70 100 Q 66 86, 78 82 Q 92 78, 104 84 Q 112 90, 108 102 Q 100 112, 86 110 Q 74 108, 70 100 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* toe beans + central pad */}
                <ellipse cx="80" cy="88" rx="2.8" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.1" />
                <ellipse cx="90" cy="85" rx="2.8" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.1" />
                <ellipse cx="99" cy="88" rx="2.8" ry="3.4" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.1" />
                <ellipse cx="88" cy="100" rx="5.5" ry="4" fill={PINK} opacity="0.55" stroke={INK} strokeWidth="1.1" />
                {/* finger creases */}
                <path d="M 85 82 Q 84 92, 87 100 M 95 84 Q 95 93, 93 101"
                  stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4" />
              </g>
            )}

            {state === 'gift' && (
              <g className="sk-gift">
                {/* arms holding the box sides */}
                <path d="M 52 156 Q 44 172, 56 184 L 68 178 Q 60 170, 60 160 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M 148 156 Q 156 172, 144 184 L 132 178 Q 140 170, 140 160 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                {/* box body */}
                <rect x="62" y="172" width="76" height="42" rx="3"
                  fill="#e63a6b" stroke={INK} strokeWidth="2.4" />
                {/* lid */}
                <rect x="58" y="163" width="84" height="14" rx="3"
                  fill="#ff5fa2" stroke={INK} strokeWidth="2.4" />
                {/* vertical ribbon */}
                <rect x="94" y="163" width="12" height="51"
                  fill="#ffd24a" stroke={INK} strokeWidth="1.6" />
                {/* bow loops */}
                <path d="M 100 163 Q 84 148, 82 159 Q 82 168, 100 163 Z"
                  fill="#ffd24a" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M 100 163 Q 116 148, 118 159 Q 118 168, 100 163 Z"
                  fill="#ffd24a" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                <circle cx="100" cy="162" r="4" fill="#ffd24a" stroke={INK} strokeWidth="1.6" />
              </g>
            )}

            {state === 'salute' && (
              <g className="sk-paw-salute">
                {/* upper arm — shoulder up the right side to the elbow */}
                <path d="M 150 158 Q 168 142, 168 116 Q 168 104, 158 100 Q 148 100, 148 112 Q 150 134, 150 158 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* forearm — elbow across to the brow */}
                <path d="M 162 98 Q 168 104, 166 112 L 130 100 Q 126 92, 132 88 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                {/* flat paw resting at the brow */}
                <path d="M 112 84 Q 126 76, 140 84 Q 137 94, 124 95 Q 113 93, 112 84 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                <ellipse cx="120" cy="87" rx="2.2" ry="2.6" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                <ellipse cx="127" cy="88" rx="2.2" ry="2.6" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
                <ellipse cx="134" cy="87" rx="2.2" ry="2.6" fill={PINK} opacity="0.7" stroke={INK} strokeWidth="1" />
              </g>
            )}

            {state === 'sing' && (
              <g className="sk-mic-grp">
                {/* mic handle (behind paw), centred under the mouth */}
                <rect x="95.5" y="154" width="9" height="28" rx="4"
                  fill="#3a3f47" stroke={INK} strokeWidth="2" />
                {/* mic ball — just below the open mouth */}
                <circle cx="100" cy="154" r="10" fill="#8a8f98" stroke={INK} strokeWidth="2.2" />
                <path d="M 93 149 Q 100 153, 107 149 M 92 155 Q 100 158, 108 155 M 94 161 Q 100 163, 106 161"
                  stroke={INK} strokeWidth="1" fill="none" opacity="0.6" />
                <ellipse cx="96" cy="150" rx="3" ry="2" fill="#fff" opacity="0.5" />
                {/* paw gripping the handle from the left */}
                <path d="M 62 162 Q 52 150, 66 141 Q 78 135, 90 143 Q 99 150, 92 164 Q 84 172, 73 170 Q 65 168, 62 162 Z"
                  fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
                <ellipse cx="86" cy="159" rx="4.5" ry="3.4" fill={PINK} opacity="0.5" stroke={INK} strokeWidth="1" />
              </g>
            )}

            {state === 'balloon' && (
              <g>
                <g className="sk-balloon-arm">
                  {/* raised arm holding the string */}
                  <path d="M 150 152 Q 162 128, 158 104 L 174 104 Q 176 132, 168 154 Z"
                    fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                  <ellipse cx="166" cy="98" rx="10" ry="8" fill="#fff" stroke={INK} strokeWidth="2.4" />
                  <ellipse cx="160" cy="92" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.1" />
                  <ellipse cx="167" cy="90" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.1" />
                  <ellipse cx="174" cy="92" rx="2.4" ry="2.8" fill={PINK} opacity="0.8" stroke={INK} strokeWidth="1.1" />
                </g>
                <g className="sk-balloon">
                  {/* string */}
                  <path d="M 166 90 Q 152 64, 162 48" stroke={INK} strokeWidth="1.4"
                    fill="none" strokeLinecap="round" />
                  {/* balloon body */}
                  <path d="M 164 8 Q 144 10, 142 32 Q 142 50, 164 54 Q 186 50, 186 30 Q 184 10, 164 8 Z"
                    fill="#e63a6b" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
                  {/* knot */}
                  <path d="M 160 53 L 164 58 L 168 53 Z"
                    fill="#e63a6b" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                  {/* shine */}
                  <ellipse cx="156" cy="24" rx="4" ry="7" fill="#fff" opacity="0.45"
                    transform="rotate(-18 156 24)" />
                </g>
              </g>
            )}
          </g>
        </g>

        {/* extras layer (NOT through boil filter — read crisp) */}
        <SkExtras state={state} noSpeech={noSpeech} />
      </svg>

      {!noSpeech && <SkSpeech state={state} />}
    </div>
  );
}

// ─── EYES ────────────────────────────────────────────────────────────
function SkEyes({ state }: { state: SketchErenState }) {
  if (state === 'happy' || state === 'cheer') {
    return (
      <g stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M 60 98 Q 74 86, 88 98" />
        <path d="M 112 98 Q 126 86, 140 98" />
      </g>
    );
  }
  if (state === 'wink') {
    // left eye closed crescent, right eye normal almond
    return (
      <g>
        <path d="M 60 100 Q 74 90, 88 100" stroke={INK} strokeWidth="3" fill="none"
          strokeLinecap="round" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2" ry="8" fill={INK} />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3" fill={BLUE_HL} />
        <path d="M 95 86 L 92 92 M 105 86 L 108 92" stroke="#ffd24a" strokeWidth="1.6"
          strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'point') {
    // looking right — pupils shifted
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx + 5} cy={EYE_L.cy + 1} rx="2.2" ry="8" fill={INK} />
        <ellipse cx={EYE_R.cx + 5} cy={EYE_R.cy + 1} rx="2.2" ry="8" fill={INK} />
        <circle cx={EYE_L.cx + 8} cy={EYE_L.cy - 5} r="2.4" fill={BLUE_HL} />
        <circle cx={EYE_R.cx + 8} cy={EYE_R.cy - 5} r="2.4" fill={BLUE_HL} />
      </g>
    );
  }
  if (state === 'peek') {
    // wide curious eyes — bigger highlights, pupils up
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="13" ry="17"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="13" ry="17"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy - 2} rx="2.4" ry="7" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy - 2} rx="2.4" ry="7" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 7} r="3.5" fill={BLUE_HL} />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 7} r="3.5" fill={BLUE_HL} />
      </g>
    );
  }
  if (state === 'wow') {
    // star pupils
    const Star = ({ cx, cy }: { cx: number; cy: number }) => (
      <path d={`M ${cx} ${cy-9} L ${cx+2.5} ${cy-3} L ${cx+9} ${cy-3} L ${cx+4} ${cy+1.5} L ${cx+6} ${cy+8} L ${cx} ${cy+4} L ${cx-6} ${cy+8} L ${cx-4} ${cy+1.5} L ${cx-9} ${cy-3} L ${cx-2.5} ${cy-3} Z`}
            fill="#ffd24a" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      );
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="14" ry="17"
          fill="#fff" stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="14" ry="17"
          fill="#fff" stroke={INK} strokeWidth="2.2" />
        <Star cx={EYE_L.cx} cy={EYE_L.cy} />
        <Star cx={EYE_R.cx} cy={EYE_R.cy} />
      </g>
    );
  }
  if (state === 'cry') {
    // squeezed-shut eyes, tears bursting
    return (
      <g>
        <g stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round">
          <path d="M 60 104 Q 74 96, 88 104" />
          <path d="M 112 104 Q 126 96, 140 104" />
          <path d="M 58 92 L 62 96 M 90 92 L 86 96" strokeWidth="1.6" />
          <path d="M 110 96 L 114 92 M 142 96 L 138 92" strokeWidth="1.6" />
        </g>
        {/* tears bursting outward */}
        <g className="sk-tears">
          <path d="M 56 110 Q 50 120, 52 134 Q 58 130, 60 118 Z" fill="#7eb2d8" stroke={INK} strokeWidth="1.2" />
          <path d="M 144 110 Q 150 120, 148 134 Q 142 130, 140 118 Z" fill="#7eb2d8" stroke={INK} strokeWidth="1.2" />
        </g>
      </g>
    );
  }
  if (state === 'magic') {
    // glowy almond eyes
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="16"
          fill="#9d6ee0" stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16"
          fill="#9d6ee0" stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2" ry="8" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2" ry="8" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="3" fill="#fff" />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3" fill="#fff" />
        {/* tiny glow stars in eyes */}
        <path d="M 64 94 L 64 90 M 62 92 L 66 92" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 132 94 L 132 90 M 130 92 L 134 92" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'listen') {
    // gentle closed eyes, head-bob style
    return (
      <g stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M 60 100 Q 74 96, 88 100" />
        <path d="M 112 100 Q 126 96, 140 100" />
      </g>
    );
  }
  if (state === 'eureka') {
    // sparkly excited eyes — slightly wider with extra highlight
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="13" ry="17"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="13" ry="17"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2.2" ry="8" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2.2" ry="8" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="3.5" fill="#fff" />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3.5" fill="#fff" />
        <path d="M 64 92 L 64 88 M 62 90 L 66 90" stroke="#ffd24a" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 132 92 L 132 88 M 130 90 L 134 90" stroke="#ffd24a" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'shrug') {
    // raised-brow + dot eyes (uncertain)
    return (
      <g>
        <circle cx={EYE_L.cx} cy={EYE_L.cy + 2} r="3.5" fill={INK} />
        <circle cx={EYE_R.cx} cy={EYE_R.cy + 2} r="3.5" fill={INK} />
        {/* raised brows */}
        <path d="M 62 86 Q 74 80, 86 86" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 114 86 Q 126 80, 138 86" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'flex') {
    // smug squinty eyes
    return (
      <g stroke={INK} strokeLinecap="round" fill="none">
        <path d="M 60 102 Q 74 92, 88 102" strokeWidth="2.6" />
        <path d="M 112 102 Q 126 92, 140 102" strokeWidth="2.6" />
        <path d="M 60 100 Q 74 106, 88 100" strokeWidth="2.2" fill={BLUE} opacity="0.6" />
        <path d="M 112 100 Q 126 106, 140 100" strokeWidth="2.2" fill={BLUE} opacity="0.6" />
        <ellipse cx="74" cy="100" rx="2" ry="2.5" fill={INK} stroke="none" />
        <ellipse cx="126" cy="100" rx="2" ry="2.5" fill={INK} stroke="none" />
      </g>
    );
  }
  if (state === 'gasp') {
    // huge round eyes
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="14" ry="18"
          fill="#fff" stroke={INK} strokeWidth="2.4" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="14" ry="18"
          fill="#fff" stroke={INK} strokeWidth="2.4" />
        <circle cx={EYE_L.cx} cy={EYE_L.cy} r="4.5" fill={INK} />
        <circle cx={EYE_R.cx} cy={EYE_R.cy} r="4.5" fill={INK} />
        <circle cx={EYE_L.cx + 2} cy={EYE_L.cy - 2} r="1.5" fill="#fff" />
        <circle cx={EYE_R.cx + 2} cy={EYE_R.cy - 2} r="1.5" fill="#fff" />
      </g>
    );
  }
  if (state === 'grad') {
    // proud closed-arc eyes (like happy but smaller)
    return (
      <g stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round">
        <path d="M 62 98 Q 74 90, 86 98" />
        <path d="M 114 98 Q 126 90, 138 98" />
      </g>
    );
  }
  if (state === 'rocket') {
    // determined narrow eyes looking up
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy + 2} rx="12" ry="11"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy + 2} rx="12" ry="11"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx="2.4" ry="5" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx="2.4" ry="5" fill={INK} />
        <circle cx={EYE_L.cx + 3} cy={EYE_L.cy - 2} r="2" fill="#fff" />
        <circle cx={EYE_R.cx + 3} cy={EYE_R.cy - 2} r="2" fill="#fff" />
      </g>
    );
  }
  if (state === 'chill') {
    // hidden under sunglasses
    return null;
  }
  if (state === 'trophy') {
    // sparkly proud eyes — extra highlight + tiny star
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="13" ry="17"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="13" ry="17"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2.2" ry="8" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2.2" ry="8" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="3.5" fill="#fff" />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3.5" fill="#fff" />
        <path d="M 64 92 L 64 88 M 62 90 L 66 90" stroke="#ffd24a" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 132 92 L 132 88 M 130 90 L 134 90" stroke="#ffd24a" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'kiss') {
    // both eyes closed soft — like a long content blink
    return (
      <g stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round">
        <path d="M 60 100 Q 74 92, 88 100" />
        <path d="M 112 100 Q 126 92, 140 100" />
      </g>
    );
  }
  if (state === 'angry') {
    // sharp V-brows + pinprick pupils on white circles
    return (
      <g>
        <circle cx={EYE_L.cx} cy={EYE_L.cy + 2} r="9" fill="#fff" stroke={INK} strokeWidth="2.2" />
        <circle cx={EYE_R.cx} cy={EYE_R.cy + 2} r="9" fill="#fff" stroke={INK} strokeWidth="2.2" />
        <circle cx={EYE_L.cx + 1} cy={EYE_L.cy + 4} r="2.6" fill={INK} />
        <circle cx={EYE_R.cx - 1} cy={EYE_R.cy + 4} r="2.6" fill={INK} />
        {/* V brows */}
        <path d="M 56 84 L 88 96" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M 144 84 L 112 96" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'proud') {
    // closed-arc proud eyes (slightly bigger curve)
    return (
      <g stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M 58 100 Q 74 86, 90 100" />
        <path d="M 110 100 Q 126 86, 142 100" />
      </g>
    );
  }
  if (state === 'meditate') {
    // peaceful flat closed eyes
    return (
      <g stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M 62 100 L 86 100" />
        <path d="M 114 100 L 138 100" />
      </g>
    );
  }
  if (state === 'sick') {
    // half-lidded droopy eyes, dull blue
    return (
      <g>
        <path d="M 62 98 Q 74 94, 86 98" stroke={INK} strokeWidth="2.4"
          fill="none" strokeLinecap="round" />
        <path d="M 114 98 Q 126 94, 138 98" stroke={INK} strokeWidth="2.4"
          fill="none" strokeLinecap="round" />
        <path d="M 62 98 Q 74 108, 86 98" stroke={INK} strokeWidth="2" fill="#7eb2d8"
          opacity="0.5" />
        <path d="M 114 98 Q 126 108, 138 98" stroke={INK} strokeWidth="2" fill="#7eb2d8"
          opacity="0.5" />
        {/* swirly tired dots */}
        <circle cx={EYE_L.cx} cy="100" r="2" fill={INK} />
        <circle cx={EYE_R.cx} cy="100" r="2" fill={INK} />
      </g>
    );
  }
  if (state === 'read') {
    // looking-down half-lidded with reading glasses
    return (
      <g>
        {/* reading glasses */}
        <g stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round">
          <circle cx={EYE_L.cx} cy={EYE_L.cy + 2} r="13" fill="#fff" opacity="0.6" />
          <circle cx={EYE_R.cx} cy={EYE_R.cy + 2} r="13" fill="#fff" opacity="0.6" />
          <path d="M 87 100 L 113 100" />
          <path d="M 61 96 L 54 92 M 139 96 L 146 92" />
        </g>
        {/* eyes inside */}
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 6} rx="2.4" ry="4" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 6} rx="2.4" ry="4" fill={INK} />
      </g>
    );
  }
  if (state === 'pet') {
    // blissed-out closed eyes (deeper curve than happy)
    return (
      <g stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M 58 96 Q 74 110, 90 96" />
        <path d="M 110 96 Q 126 110, 142 96" />
      </g>
    );
  }
  if (state === 'nom') {
    // small content closed-arc eyes
    return (
      <g stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M 64 100 Q 74 92, 84 100" />
        <path d="M 116 100 Q 126 92, 136 100" />
      </g>
    );
  }
  if (state === 'bow') {
    // gentle closed grateful eyes
    return (
      <g stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round">
        <path d="M 64 102 Q 74 96, 84 102" />
        <path d="M 116 102 Q 126 96, 136 102" />
      </g>
    );
  }
  if (state === 'focus') {
    // narrow determined slits, pinpoint pupils
    return (
      <g>
        <path d="M 56 100 L 86 100" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M 114 100 L 144 100" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <circle cx="74" cy="100" r="2" fill="#c8252c" />
        <circle cx="126" cy="100" r="2" fill="#c8252c" />
      </g>
    );
  }
  if (state === 'shy') {
    // eyes hidden by paws — render just a hint behind paws
    return (
      <g opacity="0.4">
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="16" fill={BLUE} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16" fill={BLUE} />
      </g>
    );
  }
  if (state === 'sad') {
    return (
      <g stroke={INK} strokeLinecap="round" fill="none">
        <path d="M 60 108 Q 74 96, 88 106" strokeWidth="2.6" />
        <path d="M 112 106 Q 126 96, 140 108" strokeWidth="2.6" />
        <path d="M 62 102 L 58 96 M 86 102 L 90 96" strokeWidth="1.8" />
        <path d="M 114 102 L 110 96 M 138 102 L 142 96" strokeWidth="1.8" />
      </g>
    );
  }
  if (state === 'sleeping') {
    return (
      <g stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round">
        <path d="M 60 100 Q 74 110, 88 100" />
        <path d="M 112 100 Q 126 110, 140 100" />
      </g>
    );
  }
  if (state === 'love') {
    // heart-shaped eyes — bigger, calmer
    const Heart = ({ cx, cy }: { cx: number; cy: number }) => (
      <g transform={`translate(${cx} ${cy}) scale(1.5) translate(-11 -9)`}>
        <path d="M 11 18 C 2 12, 0 4, 6 1 C 9 -0.5, 11 2, 11 4 C 11 2, 13 -0.5, 16 1 C 22 4, 20 12, 11 18 Z"
          fill="#e63a6b" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M 6 5 Q 8 4, 10 6" stroke="#fff" strokeWidth="1" fill="none"
          strokeLinecap="round" opacity="0.9" />
      </g>
    );
    return (
      <g className="sk-love-eyes">
        <Heart cx={EYE_L.cx} cy={EYE_L.cy} />
        <Heart cx={EYE_R.cx} cy={EYE_R.cy} />
      </g>
    );
  }
  if (state === 'confused') {
    // spiral eyes
    return (
      <g stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round">
        <path d="M 74 100 m -10 0 a 10 10 0 1 1 20 0 a 8 8 0 1 1 -16 0 a 6 6 0 1 1 12 0 a 4 4 0 1 1 -8 0" />
        <path d="M 126 100 m -10 0 a 10 10 0 1 1 20 0 a 8 8 0 1 1 -16 0 a 6 6 0 1 1 12 0 a 4 4 0 1 1 -8 0" />
      </g>
    );
  }
  if (state === 'thinking') {
    // looking up-right
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx + 5} cy={EYE_L.cy - 4} rx="2" ry="7" fill={INK} />
        <ellipse cx={EYE_R.cx + 5} cy={EYE_R.cy - 4} rx="2" ry="7" fill={INK} />
        <circle cx={EYE_L.cx + 8} cy={EYE_L.cy - 8} r="2" fill="#fff" />
        <circle cx={EYE_R.cx + 8} cy={EYE_R.cy - 8} r="2" fill="#fff" />
      </g>
    );
  }
  if (state === 'tired') {
    // half-closed droopy
    return (
      <g>
        <path d={`M 62 100 Q 74 92, 86 100`} stroke={INK} strokeWidth="2.4"
          fill="none" strokeLinecap="round" />
        <path d={`M 114 100 Q 126 92, 138 100`} stroke={INK} strokeWidth="2.4"
          fill="none" strokeLinecap="round" />
        {/* under-eye droop */}
        <path d={`M 62 100 Q 74 110, 86 100`} stroke={INK} strokeWidth="2" fill={BLUE}
          opacity="0.7" />
        <path d={`M 114 100 Q 126 110, 138 100`} stroke={INK} strokeWidth="2" fill={BLUE}
          opacity="0.7" />
        {/* eye-bag line */}
        <path d="M 66 112 Q 74 116, 84 112" stroke={INK} strokeWidth="1.2" fill="none"
          opacity="0.5" />
        <path d="M 116 112 Q 126 116, 136 112" stroke={INK} strokeWidth="1.2" fill="none"
          opacity="0.5" />
      </g>
    );
  }
  if (state === 'streak') {
    // determined — narrowed eyes
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy + 3} rx="12" ry="9"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy + 3} rx="12" ry="9"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 4} rx="2.5" ry="5" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 4} rx="2.5" ry="5" fill={INK} />
        {/* angry brows */}
        <path d="M 56 88 L 88 96" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M 112 96 L 144 88" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'party') {
    // happy upturned closed-arc eyes (like proud but bouncy)
    return (
      <g stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M 58 102 Q 74 88, 90 102" />
        <path d="M 110 102 Q 126 88, 142 102" />
      </g>
    );
  }
  if (state === 'yawn') {
    // tightly closed sleepy eyes with tiny tear at corner
    return (
      <g>
        <path d="M 60 102 Q 74 96, 88 102" stroke={INK} strokeWidth="2.6"
          fill="none" strokeLinecap="round" />
        <path d="M 112 102 Q 126 96, 140 102" stroke={INK} strokeWidth="2.6"
          fill="none" strokeLinecap="round" />
        {/* tiny tear */}
        <circle cx="58" cy="106" r="2" fill={BLUE} stroke={INK} strokeWidth="1" opacity="0.9" />
      </g>
    );
  }
  if (state === 'silly') {
    // happy upside-down U eyes (^_^) — playful, not dead
    return (
      <g stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round">
        <path d="M 60 104 Q 74 92, 88 104" />
        <path d="M 112 104 Q 126 92, 140 104" />
      </g>
    );
  }
  if (state === 'laugh') {
    // big squeezed-happy arcs + joy tears at the outer corners
    return (
      <g>
        <g stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M 58 96 Q 74 84, 90 96" />
          <path d="M 110 96 Q 126 84, 142 96" />
        </g>
        <path d="M 54 100 Q 48 108, 50 118 Q 56 112, 56 104 Z"
          fill="#7eb2d8" stroke={INK} strokeWidth="1.2" className="sk-joy-tear" />
        <path d="M 146 100 Q 152 108, 150 118 Q 144 112, 144 104 Z"
          fill="#7eb2d8" stroke={INK} strokeWidth="1.2" className="sk-joy-tear"
          style={{ animationDelay: '0.3s' }} />
      </g>
    );
  }
  if (state === 'highfive') {
    // bright excited almond eyes
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2.2" ry="8" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2.2" ry="8" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="3.4" fill={BLUE_HL} />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3.4" fill={BLUE_HL} />
      </g>
    );
  }
  if (state === 'sneeze') {
    // scrunched-shut eyes
    return (
      <g stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round">
        <path d="M 60 102 Q 74 94, 88 102" />
        <path d="M 112 102 Q 126 94, 140 102" />
        <path d="M 58 94 L 62 98 M 90 94 L 86 98" strokeWidth="1.6" />
        <path d="M 110 98 L 114 94 M 142 98 L 138 94" strokeWidth="1.6" />
      </g>
    );
  }
  if (state === 'scared') {
    // huge whites, tiny pupils, worried brows
    return (
      <g className="sk-scared-eyes">
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx="13" ry="17" fill="#fff"
          stroke={INK} strokeWidth="2.4" />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx="13" ry="17" fill="#fff"
          stroke={INK} strokeWidth="2.4" />
        <circle cx={EYE_L.cx} cy={EYE_L.cy + 3} r="3" fill={INK} />
        <circle cx={EYE_R.cx} cy={EYE_R.cy + 3} r="3" fill={INK} />
        <path d="M 60 84 Q 72 80, 84 84" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 116 84 Q 128 80, 140 84" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'dizzy') {
    // spiral eyes
    return (
      <g stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round">
        <path d="M 74 100 m -10 0 a 10 10 0 1 1 20 0 a 8 8 0 1 1 -16 0 a 6 6 0 1 1 12 0 a 4 4 0 1 1 -8 0" />
        <path d="M 126 100 m -10 0 a 10 10 0 1 1 20 0 a 8 8 0 1 1 -16 0 a 6 6 0 1 1 12 0 a 4 4 0 1 1 -8 0" />
      </g>
    );
  }
  if (state === 'sip') {
    // content half-closed eyes
    return (
      <g stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M 62 100 Q 74 96, 86 100" />
        <path d="M 114 100 Q 126 96, 138 100" />
      </g>
    );
  }
  if (state === 'search') {
    // curious almond eyes; pupils scan side-to-side
    return (
      <g>
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="16" fill={BLUE}
          stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16" fill={BLUE}
          stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-search-pupil" cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2.4" ry="8" fill={INK} />
        <ellipse className="sk-search-pupil" cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2.4" ry="8" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="2.6" fill={BLUE_HL} />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="2.6" fill={BLUE_HL} />
      </g>
    );
  }
  if (state === 'cold') {
    // shivering squeezed eyes
    return (
      <g className="sk-cold-eyes" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round">
        <path d="M 62 100 Q 74 94, 86 100" />
        <path d="M 114 100 Q 126 94, 138 100" />
      </g>
    );
  }
  if (state === 'facepalm') {
    // squeezed-shut embarrassed eyes (mostly hidden by the paw)
    return (
      <g stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.85">
        <path d="M 60 102 Q 74 96, 88 102" />
        <path d="M 112 102 Q 126 96, 140 102" />
      </g>
    );
  }
  if (state === 'gift') {
    // sparkly excited eyes
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="13" ry="17"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="13" ry="17"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2.2" ry="8" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2.2" ry="8" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="3.5" fill="#fff" />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3.5" fill="#fff" />
        <path d="M 64 92 L 64 88 M 62 90 L 66 90" stroke="#ffd24a" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M 132 92 L 132 88 M 130 90 L 134 90" stroke="#ffd24a" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'salute') {
    // alert, determined almond eyes with sharp brows
    return (
      <g>
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="15" fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="15" fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2.2" ry="7" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2.2" ry="7" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="3" fill={BLUE_HL} />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3" fill={BLUE_HL} />
        <path d="M 60 84 L 86 82" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M 140 84 L 114 82" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'sing') {
    // joyful belted closed-arc eyes
    return (
      <g stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M 58 102 Q 74 88, 90 102" />
        <path d="M 110 102 Q 126 88, 142 102" />
      </g>
    );
  }
  if (state === 'balloon') {
    // delighted bright almond eyes
    return (
      <g>
        <ellipse className="sk-eye-shape" cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse className="sk-eye-shape" cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16"
          fill={BLUE} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2.2" ry="8" fill={INK} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2.2" ry="8" fill={INK} />
        <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="3.4" fill={BLUE_HL} />
        <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3.4" fill={BLUE_HL} />
      </g>
    );
  }
  // idle, wave, dance — default almond eyes (with blink for idle only)
  return (
    <g>
      <ellipse className={state === 'idle' ? 'sk-eye-blink' : 'sk-eye-shape'}
        cx={EYE_L.cx} cy={EYE_L.cy} rx="12" ry="16" fill={BLUE}
        stroke={INK} strokeWidth="2.2" />
      <ellipse className={state === 'idle' ? 'sk-eye-blink' : 'sk-eye-shape'}
        cx={EYE_R.cx} cy={EYE_R.cy} rx="12" ry="16" fill={BLUE}
        stroke={INK} strokeWidth="2.2" />
      {/* brighter inner iris for depth */}
      <ellipse className={state === 'idle' ? 'sk-eye-blink' : 'sk-eye-shape'}
        cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="8.5" ry="12" fill="#62acea" />
      <ellipse className={state === 'idle' ? 'sk-eye-blink' : 'sk-eye-shape'}
        cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="8.5" ry="12" fill="#62acea" />
      {/* darker outer iris ring — two-tone blue like the reference */}
      <ellipse className={state === 'idle' ? 'sk-eye-blink' : 'sk-eye-shape'}
        cx={EYE_L.cx} cy={EYE_L.cy} rx="10.5" ry="14.5" fill="none"
        stroke="#235f9c" strokeWidth="1.8" opacity="0.55" />
      <ellipse className={state === 'idle' ? 'sk-eye-blink' : 'sk-eye-shape'}
        cx={EYE_R.cx} cy={EYE_R.cy} rx="10.5" ry="14.5" fill="none"
        stroke="#235f9c" strokeWidth="1.8" opacity="0.55" />
      {/* soft lower rim catch-light */}
      <path d={`M ${EYE_L.cx - 7} ${EYE_L.cy + 9} Q ${EYE_L.cx} ${EYE_L.cy + 14} ${EYE_L.cx + 7} ${EYE_L.cy + 9}`}
        stroke="#bfe0fb" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d={`M ${EYE_R.cx - 7} ${EYE_R.cy + 9} Q ${EYE_R.cx} ${EYE_R.cy + 14} ${EYE_R.cx + 7} ${EYE_R.cy + 9}`}
        stroke="#bfe0fb" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
      <ellipse cx={EYE_L.cx} cy={EYE_L.cy + 1} rx="2" ry="8" fill={INK} />
      <ellipse cx={EYE_R.cx} cy={EYE_R.cy + 1} rx="2" ry="8" fill={INK} />
      <circle cx={EYE_L.cx + 4} cy={EYE_L.cy - 5} r="3" fill={BLUE_HL} />
      <circle cx={EYE_R.cx + 4} cy={EYE_R.cy - 5} r="3" fill={BLUE_HL} />
      <circle cx={EYE_L.cx - 4} cy={EYE_L.cy + 6} r="1.6" fill="#fff" opacity="0.9" />
      <circle cx={EYE_R.cx - 4} cy={EYE_R.cy + 6} r="1.6" fill="#fff" opacity="0.9" />
      {/* dark upper eyeliner from the colorpoint */}
      <path d={`M ${EYE_L.cx - 12} ${EYE_L.cy - 4} Q ${EYE_L.cx} ${EYE_L.cy - 19} ${EYE_L.cx + 12} ${EYE_L.cy - 4}`}
        stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d={`M ${EYE_R.cx - 12} ${EYE_R.cy - 4} Q ${EYE_R.cx} ${EYE_R.cy - 19} ${EYE_R.cx + 12} ${EYE_R.cy - 4}`}
        stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.85" />
    </g>
  );
}

function SkNose() {
  return (
    <g>
      <path d={NOSE} fill={PINK} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      {/* tiny highlight on the nose */}
      <ellipse cx="97" cy="120.5" rx="2.2" ry="1.3" fill="#fff" opacity="0.5" />
      {/* philtrum line down toward the mouth */}
      <path d="M 100 128 L 100 134" stroke={INK} strokeWidth="1.3" strokeLinecap="round"
        opacity="0.55" />
    </g>
  );
}

// ─── MOUTH ───────────────────────────────────────────────────────────
function SkMouth({ state }: { state: SketchErenState }) {
  if (state === 'happy' || state === 'cheer' || state === 'wave' || state === 'wink' || state === 'highfive') {
    return <path d="M 86 132 Q 100 148, 114 132 Q 108 142, 100 142 Q 92 142, 86 132 Z"
      fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  if (state === 'point') {
    return <path d="M 90 132 L 110 132 Q 106 138, 100 138 Q 94 138, 90 132 Z"
      fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  if (state === 'peek') {
    // tiny content smile (only mouth visible above the peek edge)
    return <path d="M 92 132 Q 100 138, 108 132" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'wow') {
    // round "O" mouth
    return (
      <ellipse cx="100" cy="138" rx="6" ry="8" fill="#3a1a18" stroke={INK} strokeWidth="2" />
    );
  }
  if (state === 'cry') {
    // wavy crying mouth
    return (
      <path d="M 84 138 Q 89 132, 94 138 Q 99 132, 104 138 Q 109 132, 114 138 Q 119 132, 116 138"
        stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    );
  }
  if (state === 'magic') {
    // mysterious tiny smile
    return <path d="M 92 134 Q 100 140, 108 134" stroke={INK} strokeWidth="2.2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'listen') {
    // tiny content smile (head-bobbing)
    return <path d="M 92 134 Q 100 140, 108 134" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'shy') {
    // small awkward smile peeking under paws
    return <path d="M 92 138 Q 100 142, 108 138" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'eureka') {
    // open excited smile
    return <path d="M 86 132 Q 100 148, 114 132 Q 108 142, 100 142 Q 92 142, 86 132 Z"
      fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  if (state === 'shrug') {
    // flat unsure line
    return <path d="M 90 138 L 110 138" stroke={INK} strokeWidth="2.2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'flex') {
    // smug smirk
    return <path d="M 86 134 Q 96 142, 110 138 Q 108 140, 104 140"
      stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  }
  if (state === 'gasp') {
    // hidden by paw — render nothing or tiny
    return null;
  }
  if (state === 'grad') {
    // proud smile
    return <path d="M 84 132 Q 100 146, 116 132 Q 108 140, 100 140 Q 92 140, 84 132 Z"
      fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  if (state === 'rocket') {
    // brave determined open mouth
    return (
      <g>
        <path d="M 92 130 Q 100 142, 108 130 Q 106 138, 100 138 Q 94 138, 92 130 Z"
          fill="#3a1a18" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      </g>
    );
  }
  if (state === 'chill') {
    return <path d="M 86 132 Q 96 142, 112 138 Q 108 142, 102 142"
      stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  }
  if (state === 'trophy') {
    // big proud open smile
    return <path d="M 82 132 Q 100 150, 118 132 Q 110 142, 100 142 Q 90 142, 82 132 Z"
      fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  if (state === 'kiss') {
    // pursed lips — small oval kiss shape
    return (
      <g>
        <path d="M 94 134 Q 100 128, 106 134 Q 100 142, 94 134 Z"
          fill="#e63a6b" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M 97 132 Q 100 130, 103 132" stroke="#fff" strokeWidth="1"
          fill="none" opacity="0.7" />
      </g>
    );
  }
  if (state === 'angry') {
    // teeth-bared scowl
    return (
      <g>
        <path d="M 84 138 Q 100 128, 116 138 Q 110 144, 100 144 Q 90 144, 84 138 Z"
          fill="#3a1a18" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        {/* tiny teeth */}
        <path d="M 92 138 L 92 142 M 100 138 L 100 142 M 108 138 L 108 142"
          stroke="#fff" strokeWidth="1.4" />
      </g>
    );
  }
  if (state === 'proud') {
    // confident smile
    return <path d="M 84 134 Q 100 144, 116 134" stroke={INK} strokeWidth="2.4"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'meditate') {
    // serene gentle curve
    return <path d="M 92 134 Q 100 138, 108 134" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'sick') {
    // wavy uncomfortable line — thermometer goes over this in extras
    return <path d="M 88 138 Q 94 134, 100 138 Q 106 142, 112 138"
      stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />;
  }
  if (state === 'read') {
    // tiny absorbed line
    return <path d="M 94 138 L 106 138" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'pet') {
    // wide blissed smile
    return <path d="M 84 132 Q 100 148, 116 132 Q 108 144, 100 144 Q 92 144, 84 132 Z"
      fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  if (state === 'nom') {
    return <path d="M 96 140 Q 102 144, 110 140" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'bow') {
    return <path d="M 92 134 Q 100 140, 108 134" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'focus') {
    return <path d="M 90 138 L 110 138" stroke={INK} strokeWidth="2.4"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'sad') {
    return <path d="M 86 140 Q 100 130, 114 140" stroke={INK} strokeWidth="2.2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'sleeping') {
    // tiny snore mouth
    return <path d="M 94 134 Q 100 138, 106 134" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'tired') {
    // yawn — open oval
    return (
      <g>
        <ellipse cx="100" cy="138" rx="7" ry="8" fill="#3a1a18" stroke={INK}
          strokeWidth="2" />
        <path d="M 95 138 Q 100 145, 105 138" stroke="#e89aae" strokeWidth="1.4"
          fill="none" />
      </g>
    );
  }
  if (state === 'love') {
    // smug content smile
    return <path d="M 90 134 Q 100 144, 110 134" stroke={INK} strokeWidth="2.2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'confused') {
    return <path d="M 88 138 Q 94 134, 100 138 Q 106 142, 112 138" stroke={INK}
      strokeWidth="2" fill="none" strokeLinecap="round" />;
  }
  if (state === 'streak') {
    // determined frown smirk
    return (
      <g stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M 100 128 L 100 134" />
        <path d="M 100 134 Q 90 136, 86 132" />
        <path d="M 100 134 Q 110 136, 114 132" />
      </g>
    );
  }
  if (state === 'thinking') {
    return <path d="M 90 136 Q 100 132, 110 138" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'dance') {
    // little open smile
    return (
      <g>
        <path d="M 86 130 Q 100 142, 114 130" stroke={INK} strokeWidth="2.2"
          fill="#fff" strokeLinejoin="round" />
        <path d="M 90 132 L 110 132" stroke={INK} strokeWidth="1.4" />
      </g>
    );
  }
  if (state === 'party') {
    // wide cat smile (no human teeth) with little pink tongue
    return (
      <g>
        <path d="M 84 130 Q 100 150, 116 130 Q 108 146, 100 146 Q 92 146, 84 130 Z"
          fill="#c8252c" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        {/* tiny tongue tip */}
        <path d="M 94 140 Q 100 148, 106 140 Q 100 144, 94 140 Z"
          fill="#e89aae" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    );
  }
  if (state === 'yawn') {
    // wide open oval with pink tongue
    return (
      <g>
        <ellipse cx="100" cy="140" rx="14" ry="12"
          fill="#3a1a1a" stroke={INK} strokeWidth="2.2" />
        <ellipse cx="100" cy="146" rx="9" ry="5"
          fill="#e89aae" stroke={INK} strokeWidth="1.4" />
      </g>
    );
  }
  if (state === 'silly') {
    // tongue sticking out — top arc traces the same path as the smile so the smile stroke covers the seam
    return (
      <g>
        {/* tongue (drawn first) — top curve mirrors the smile arc between x=92 and x=108 */}
        <path d="M 92 134
                 Q 100 138, 108 134
                 L 108 150
                 Q 108 158, 100 158
                 Q 92 158, 92 150
                 Z"
          fill="#e89aae" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        {/* center crease */}
        <path d="M 100 140 L 100 154"
          stroke={INK} strokeWidth="1" fill="none" opacity="0.4" />
        {/* smile line drawn AFTER tongue — its stroke covers the tongue's top arc seamlessly */}
        <path d="M 86 132 Q 100 140, 114 132"
          stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'laugh') {
    // wide open laugh with a little tongue
    return (
      <g>
        <path d="M 82 130 Q 100 152, 118 130 Q 110 148, 100 148 Q 90 148, 82 130 Z"
          fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <path d="M 92 144 Q 100 150, 108 144 Q 100 147, 92 144 Z"
          fill="#e89aae" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    );
  }
  if (state === 'sneeze') {
    // open mid-sneeze oval
    return <ellipse cx="100" cy="138" rx="7" ry="9" fill="#3a1a18" stroke={INK} strokeWidth="2" />;
  }
  if (state === 'scared') {
    // wavy worried open mouth
    return <path d="M 88 136 Q 94 132, 100 136 Q 106 140, 112 136 Q 108 144, 100 144 Q 92 144, 88 136 Z"
      fill="#3a1a18" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  if (state === 'dizzy') {
    // woozy wavy line
    return <path d="M 88 138 Q 94 132, 100 138 Q 106 144, 112 138"
      stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />;
  }
  if (state === 'sip') {
    // hidden behind the mug
    return null;
  }
  if (state === 'search') {
    // small focused curve
    return <path d="M 92 136 Q 100 132, 108 136" stroke={INK} strokeWidth="2"
      fill="none" strokeLinecap="round" />;
  }
  if (state === 'cold') {
    // chattering teeth
    return (
      <g>
        <path d="M 86 136 L 114 136 L 110 142 L 90 142 Z"
          fill="#3a1a18" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M 90 139 L 110 139" stroke="#fff" strokeWidth="1.2" />
        <path d="M 96 136 L 96 142 M 104 136 L 104 142" stroke="#fff" strokeWidth="1" />
      </g>
    );
  }
  if (state === 'facepalm') {
    // flat embarrassed wavy grimace
    return <path d="M 88 138 Q 94 135, 100 138 Q 106 141, 112 138"
      stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  }
  if (state === 'gift') {
    // happy open smile
    return <path d="M 84 132 Q 100 148, 116 132 Q 108 142, 100 142 Q 92 142, 84 132 Z"
      fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  if (state === 'salute') {
    // confident small smile
    return <path d="M 88 134 Q 100 140, 112 134"
      stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  }
  if (state === 'sing') {
    // open belting mouth with a little tongue, centred over the mic
    return (
      <g>
        <ellipse cx="100" cy="137" rx="7" ry="9" fill="#3a1a18" stroke={INK} strokeWidth="2" />
        <ellipse cx="100" cy="142" rx="4.5" ry="3" fill="#e89aae" stroke={INK} strokeWidth="1.2" />
      </g>
    );
  }
  if (state === 'balloon') {
    // happy open smile
    return <path d="M 86 132 Q 100 148, 114 132 Q 108 142, 100 142 Q 92 142, 86 132 Z"
      fill="#c8252c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  }
  // idle default — :3 like
  return (
    <g stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round">
      <path d="M 100 128 L 100 134" />
      <path d="M 100 134 Q 92 140, 88 136" />
      <path d="M 100 134 Q 108 140, 112 136" />
    </g>
  );
}

// ─── EXTRAS (sparkles, Zs, music notes, ?, etc) ──────────────────────
function SkExtras({ state, noSpeech }: { state: SketchErenState; noSpeech: boolean }) {
  if (state === 'happy') {
    return (
      <g className="sk-fx-pop">
        {[[28,46],[170,52],[44,30],[156,28]].map(([x,y],i) => (
          <g key={i} stroke="#e63a6b" strokeWidth="1.8" fill="none"
            strokeLinecap="round" style={{ animationDelay: `${i*0.1}s` }}
            className="sk-spark">
            <path d={`M ${x-4} ${y} L ${x+4} ${y} M ${x} ${y-4} L ${x} ${y+4}`} />
          </g>
        ))}
      </g>
    );
  }
  if (state === 'cheer') {
    return (
      <g>
        {([[16,30,'#ffd24a'],[184,40,'#ff5fa2'],[28,70,'#3a85e0'],[172,68,'#1d8a5a'],
          [40,12,'#e63a6b'],[160,16,'#ffd24a']] as [number, number, string][]).map(([x,y,c],i) => (
          <g key={i} className="sk-confetti" style={{ animationDelay: `${i*0.15}s` }}>
            <rect x={x} y={y} width="6" height="3" fill={c}
              transform={`rotate(${i*30} ${x+3} ${y+1.5})`} />
          </g>
        ))}
        <text x="100" y="20" textAnchor="middle" fontSize="18"
          fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.5">SUPER!</text>
      </g>
    );
  }
  if (state === 'sleeping') {
    return (
      <g className="sk-zz" fill={INK} stroke={INK} strokeWidth="0.6"
        fontFamily='"Caveat", cursive'>
        <text x="150" y="36" fontSize="22" className="sk-z1">z</text>
        <text x="166" y="22" fontSize="16" className="sk-z2">z</text>
        <text x="178" y="12" fontSize="12" className="sk-z3">z</text>
      </g>
    );
  }
  if (state === 'thinking') {
    return (
      <g className="sk-think">
        {/* thought bubbles rising */}
        <circle cx="160" cy="60" r="3.5" fill="none" stroke={INK} strokeWidth="1.6"
          className="sk-bubble-a" />
        <circle cx="170" cy="44" r="5" fill="none" stroke={INK} strokeWidth="1.6"
          className="sk-bubble-b" />
        <g className="sk-bubble-c">
          <circle cx="180" cy="22" r="11" fill="#fff" stroke={INK} strokeWidth="1.8" />
          <text x="180" y="28" textAnchor="middle" fontSize="14"
            fontFamily='"Caveat", cursive' fill={INK}>?</text>
        </g>
      </g>
    );
  }
  if (state === 'wave') {
    // The word is speech too, even though it lives in the SVG rather than the
    // HTML bubble — callers that asked for a silent Eren get a silent wave.
    if (noSpeech) return null
    return (
      <g>
        <text x="20" y="40" fontSize="20" fontFamily='"Caveat", cursive'
          fill={INK} className="sk-wave-text">zdravo!</text>
      </g>
    );
  }
  if (state === 'love') {
    return (
      <g>
        {[[24,30],[180,40],[16,80],[186,76],[40,12],[160,16]].map(([x,y],i) => (
          <path key={i}
            d={`M ${x} ${y+6} C ${x-7} ${y}, ${x-7} ${y-5}, ${x-3} ${y-5}
                C ${x} ${y-5}, ${x} ${y-2}, ${x} ${y-2}
                C ${x} ${y-2}, ${x} ${y-5}, ${x+3} ${y-5}
                C ${x+7} ${y-5}, ${x+7} ${y}, ${x} ${y+6} Z`}
            fill="#e63a6b" stroke={INK} strokeWidth="1.2"
            className="sk-heart" style={{ animationDelay: `${i*0.18}s` }} />
        ))}
      </g>
    );
  }
  if (state === 'confused') {
    return (
      <g>
        <text x="170" y="30" fontSize="22" fontFamily='"Caveat", cursive'
          fill={INK} className="sk-q1">?</text>
        <text x="22" y="38" fontSize="18" fontFamily='"Caveat", cursive'
          fill={INK} className="sk-q2" transform="rotate(-12 22 38)">?</text>
      </g>
    );
  }
  if (state === 'tired') {
    return (
      <g className="sk-yawn-aura" stroke={INK} strokeWidth="1.4" fill="none"
        strokeLinecap="round" opacity="0.7">
        <path d="M 92 90 Q 96 84, 100 88" />
        <path d="M 100 86 Q 104 80, 108 84" />
      </g>
    );
  }
  if (state === 'streak') {
    return (
      <g>
        <text x="22" y="80" fontSize="14" fontFamily='"Caveat", cursive'
          fill="#ff6a2c" className="sk-streak-n">+1</text>
        <text x="170" y="86" fontSize="14" fontFamily='"Caveat", cursive'
          fill="#ff6a2c" className="sk-streak-n" style={{ animationDelay: '0.3s' }}>+1</text>
      </g>
    );
  }
  if (state === 'dance') {
    return (
      <g fill={INK} fontFamily='"Caveat", cursive' fontSize="18">
        <text x="20" y="60" className="sk-note-a">♪</text>
        <text x="174" y="48" className="sk-note-b">♫</text>
        <text x="34" y="22" className="sk-note-c">♬</text>
      </g>
    );
  }
  if (state === 'wink') {
    return (
      <g>
        <text x="40" y="36" fontSize="22" fontFamily='"Caveat", cursive' fill={INK}
          className="sk-wink-text" transform="rotate(-8 40 36)">;)</text>
        <g stroke="#ffd24a" strokeWidth="1.6" fill="none" strokeLinecap="round"
          className="sk-spark" style={{ transformOrigin: '60px 80px' }}>
          <path d="M 56 76 L 64 84 M 64 76 L 56 84 M 60 72 L 60 88 M 52 80 L 68 80" />
        </g>
      </g>
    );
  }
  if (state === 'point') {
    return (
      <g className="sk-point-fx">
        {/* dotted trail past pointing paw */}
        <g fill={INK}>
          <circle cx="186" cy="140" r="2.2" className="sk-dot sk-d1" />
          <circle cx="194" cy="138" r="2.2" className="sk-dot sk-d2" />
          <circle cx="202" cy="136" r="2.2" className="sk-dot sk-d3" />
        </g>
        <text x="14" y="40" fontSize="18" fontFamily='"Caveat", cursive' fill={INK}>
          ovde →
        </text>
      </g>
    );
  }
  if (state === 'peek') {
    return (
      <g>
        {/* dotted ground line he's peeking over */}
        <path d="M -10 170 L 220 170" stroke={INK} strokeWidth="1.4" strokeDasharray="4 4"
          fill="none" opacity="0.5" />
        <text x="100" y="20" textAnchor="middle" fontSize="16" fontFamily='"Caveat", cursive'
          fill={INK} className="sk-peek-text">pst…</text>
      </g>
    );
  }
  if (state === 'wow') {
    return (
      <g>
        {[[24,30],[176,32],[12,84],[188,80],[40,12],[160,16]].map(([x,y],i) => (
          <g key={i} className="sk-wow-star" style={{ animationDelay: `${i*0.18}s`,
            transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}>
            <path d={`M ${x} ${y-6} L ${x+1.5} ${y-2} L ${x+5.5} ${y-2} L ${x+2.5} ${y+0.5} L ${x+4} ${y+5} L ${x} ${y+2.5} L ${x-4} ${y+5} L ${x-2.5} ${y+0.5} L ${x-5.5} ${y-2} L ${x-1.5} ${y-2} Z`}
              fill="#ffd24a" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          </g>
        ))}
      </g>
    );
  }
  if (state === 'cry') {
    return (
      <g>
        {/* tear streams running down */}
        <g stroke="#7eb2d8" strokeWidth="2.2" fill="none" strokeLinecap="round"
          className="sk-stream">
          <path d="M 54 116 Q 50 140, 56 168" />
          <path d="M 146 116 Q 150 140, 144 168" />
        </g>
        {/* extra drops */}
        <g fill="#7eb2d8" stroke={INK} strokeWidth="1" className="sk-drop">
          <path d="M 46 140 Q 42 148, 46 156 Q 50 148, 46 140 Z" />
          <path d="M 154 145 Q 158 152, 154 160 Q 150 152, 154 145 Z" />
        </g>
      </g>
    );
  }
  if (state === 'magic') {
    return (
      <g>
        {/* spiral sparkles around raised paw */}
        {[0,1,2,3,4,5].map(i => {
          const a = (i / 6) * Math.PI * 2;
          const r = 26;
          const cx = 165 + Math.cos(a) * r;
          const cy = 90 + Math.sin(a) * r;
          return (
            <g key={i} className="sk-mag-spark" style={{ animationDelay: `${i*0.12}s`,
              transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' }}>
              <path d={`M ${cx} ${cy-4} L ${cx+1} ${cy-1} L ${cx+4} ${cy} L ${cx+1} ${cy+1} L ${cx} ${cy+4} L ${cx-1} ${cy+1} L ${cx-4} ${cy} L ${cx-1} ${cy-1} Z`}
                fill="#9d6ee0" stroke={INK} strokeWidth="0.8" />
            </g>
          );
        })}
        <text x="22" y="36" fontSize="22" fontFamily='"Caveat", cursive' fill="#9d6ee0"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4">✨</text>
      </g>
    );
  }
  if (state === 'listen') {
    return (
      <g fill={INK} fontFamily='"Caveat", cursive' fontSize="16">
        <text x="14" y="100" className="sk-note-a">♪</text>
        <text x="180" y="118" className="sk-note-b">♫</text>
        <text x="22" y="130" className="sk-note-c">♬</text>
      </g>
    );
  }
  if (state === 'eureka') {
    return (
      <g>
        {[[24,90],[180,94],[20,140],[184,140]].map(([x,y],i) => (
          <g key={i} style={{ animationDelay: `${i*0.12}s` }} className="sk-mag-spark">
            <path d={`M ${x} ${y-3} L ${x+1} ${y} L ${x+3} ${y} L ${x+1} ${y+1.5} L ${x+2} ${y+4} L ${x} ${y+2} L ${x-2} ${y+4} L ${x-1} ${y+1.5} L ${x-3} ${y} L ${x-1} ${y} Z`}
              fill="#ffd24a" stroke={INK} strokeWidth="0.8" />
          </g>
        ))}
        <text x="22" y="42" fontSize="20" fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4"
          transform="rotate(-8 22 42)">!!!</text>
      </g>
    );
  }
  if (state === 'shrug') {
    return (
      <g>
        <text x="14" y="34" fontSize="18" fontFamily='"Caveat", cursive' fill={INK}
          className="sk-q1" transform="rotate(-10 14 34)">?</text>
        <text x="180" y="38" fontSize="18" fontFamily='"Caveat", cursive' fill={INK}
          className="sk-q2" transform="rotate(12 180 38)">?</text>
      </g>
    );
  }
  if (state === 'flex') {
    return (
      <g>
        {/* sweat drop on bicep */}
        <path d="M 196 100 Q 192 108, 196 116 Q 200 108, 196 100 Z"
          fill="#7eb2d8" stroke={INK} strokeWidth="1.4" className="sk-drop" />
        <text x="14" y="40" fontSize="20" fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4"
          transform="rotate(-6 14 40)">jak!</text>
      </g>
    );
  }
  if (state === 'gasp') {
    return (
      <g>
        <text x="20" y="38" fontSize="28" fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.5"
          transform="rotate(-10 20 38)">!</text>
        <text x="174" y="34" fontSize="22" fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.5"
          style={{ animationDelay: '0.2s' }}
          transform="rotate(8 174 34)">!</text>
      </g>
    );
  }
  if (state === 'grad') {
    return (
      <g>
        {/* diploma scroll on body */}
        <g transform="translate(124 192) rotate(-12)">
          <rect x="0" y="0" width="42" height="14" fill="#fdf6e0" stroke={INK} strokeWidth="1.6" rx="2" />
          <path d="M 4 4 L 36 4 M 4 8 L 32 8 M 4 12 L 28 12" stroke={INK} strokeWidth="0.7" />
          <path d="M 0 0 Q -3 7, 0 14 M 42 0 Q 45 7, 42 14"
            stroke={INK} strokeWidth="1.6" fill="#fdf6e0" />
        </g>
        {/* confetti */}
        {([[16,40,'#ffd24a'],[184,46,'#ff5fa2'],[28,80,'#3a85e0']] as [number, number, string][]).map(([x,y,c],i) => (
          <g key={i} className="sk-confetti" style={{ animationDelay: `${i*0.2}s` }}>
            <rect x={x} y={y} width="6" height="3" fill={c}
              transform={`rotate(${i*30} ${x+3} ${y+1.5})`} />
          </g>
        ))}
      </g>
    );
  }
  if (state === 'rocket') {
    return (
      <g>
        {/* speed lines + stars in background */}
        <g stroke={INK} strokeWidth="1.4" strokeLinecap="round" fill="none"
          className="sk-speed-lines">
          <path d="M 10 60 L 22 76" />
          <path d="M 12 100 L 30 100" />
          <path d="M 188 60 L 176 78" />
          <path d="M 186 102 L 168 102" />
        </g>
        <g fill="#ffd24a" stroke={INK} strokeWidth="0.8">
          <circle cx="30" cy="40" r="1.6" />
          <circle cx="170" cy="36" r="1.6" />
          <circle cx="14" cy="170" r="1.6" />
          <circle cx="186" cy="174" r="1.6" />
        </g>
      </g>
    );
  }
  if (state === 'chill') {
    return (
      <g fill={INK} fontFamily='"Caveat", cursive' fontSize="22"
        className="sk-fx-pop">
        <text x="22" y="42" transform="rotate(-8 22 42)">♪</text>
        <text x="178" y="50" transform="rotate(10 178 50)">♫</text>
      </g>
    );
  }
  if (state === 'nom') {
    return (
      <g>
        <g fill="#a37444" stroke={INK} strokeWidth="0.8" className="sk-crumbs">
          <circle cx="172" cy="148" r="2" />
          <circle cx="176" cy="158" r="1.5" />
          <circle cx="165" cy="160" r="1.8" />
        </g>
        <text x="20" y="40" fontSize="22" fontFamily='"Caveat", cursive' fill={INK}
          className="sk-pop-text"
          transform="rotate(-6 20 40)">mmm…</text>
      </g>
    );
  }
  if (state === 'bow') {
    return (
      <g>
        <text x="14" y="30" fontSize="20" fontFamily='"Caveat", cursive' fill="#1d8a5a"
          className="sk-pop-text"
          transform="rotate(-8 14 30)">hvala</text>
      </g>
    );
  }
  if (state === 'focus') {
    return (
      <g>
        <path d="M 36 70 Q 32 78, 36 86 Q 40 78, 36 70 Z"
          fill="#7eb2d8" stroke={INK} strokeWidth="1.4" className="sk-drop" />
      </g>
    );
  }
  if (state === 'trophy') {
    return (
      <g>
        {/* shine rays radiating from cup */}
        <g stroke="#ffd24a" strokeWidth="2.2" strokeLinecap="round" fill="none"
          className="sk-rays-pulse-grp">
          <path d="M 30 100 L 18 96" />
          <path d="M 170 100 L 182 96" />
          <path d="M 100 60 L 100 48" />
          <path d="M 60 70 L 52 60" />
          <path d="M 140 70 L 148 60" />
        </g>
        {/* sparkles */}
        {[[28,40],[172,42],[40,12],[160,14]].map(([x,y],i) => (
          <g key={i} className="sk-mag-spark" style={{ animationDelay: `${i*0.14}s` }}>
            <path d={`M ${x} ${y-4} L ${x+1.4} ${y-1} L ${x+4} ${y} L ${x+1.4} ${y+1} L ${x} ${y+4} L ${x-1.4} ${y+1} L ${x-4} ${y} L ${x-1.4} ${y-1} Z`}
              fill="#ffd24a" stroke={INK} strokeWidth="0.8" />
          </g>
        ))}
        <text x="100" y="22" textAnchor="middle" fontSize="20"
          fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4">#1!</text>
      </g>
    );
  }
  if (state === 'kiss') {
    return (
      <g>
        {/* floating heart from mouth */}
        <g className="sk-kiss-heart">
          <path d="M 130 130 C 122 124, 120 116, 126 114
                   C 130 112, 132 116, 132 117
                   C 132 116, 134 112, 138 114
                   C 144 116, 142 124, 134 130 Z"
            fill="#e63a6b" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M 128 118 Q 130 116, 132 117"
            stroke="#fff" strokeWidth="1" fill="none" opacity="0.9" />
        </g>
        {/* second heart, drifting further */}
        <g className="sk-kiss-heart" style={{ animationDelay: '0.7s' }}>
          <path d="M 150 90 C 142 84, 140 76, 146 74
                   C 150 72, 152 76, 152 77
                   C 152 76, 154 72, 158 74
                   C 164 76, 162 84, 154 90 Z"
            fill="#e63a6b" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
        </g>
        <text x="22" y="40" fontSize="20" fontFamily='"Caveat", cursive' fill="#e63a6b"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4"
          transform="rotate(-8 22 40)">mwah!</text>
      </g>
    );
  }
  if (state === 'angry') {
    return (
      <g>
        {/* extra puff rising */}
        <g className="sk-steam-rise">
          <path d="M 80 -10 Q 76 -20, 82 -26 Q 88 -20, 84 -10 Z"
            fill="#d6d4cf" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
        <text x="20" y="40" fontSize="22" fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.5"
          transform="rotate(-8 20 40)">grrr!</text>
      </g>
    );
  }
  if (state === 'proud') {
    return (
      <g>
        {/* shine lines around medal */}
        <g stroke="#ffd24a" strokeWidth="1.6" strokeLinecap="round" fill="none"
          className="sk-rays-pulse-grp">
          <path d="M 78 174 L 70 170" />
          <path d="M 122 174 L 130 170" />
          <path d="M 80 198 L 70 200" />
          <path d="M 120 198 L 130 200" />
        </g>
        <text x="100" y="24" textAnchor="middle" fontSize="18"
          fontFamily='"Caveat", cursive' fill="#1d8a5a"
          className="sk-pop-text" stroke={INK} strokeWidth="0.3">bravo!</text>
      </g>
    );
  }
  if (state === 'meditate') {
    return (
      <g>
        {/* om / breath ripples */}
        <g stroke="#9d6ee0" strokeWidth="1.4" fill="none" opacity="0.6"
          className="sk-breath-ring">
          <ellipse cx="100" cy="14" rx="58" ry="14" />
        </g>
        <g stroke="#9d6ee0" strokeWidth="1.2" fill="none" opacity="0.4"
          className="sk-breath-ring" style={{ animationDelay: '0.6s' }}>
          <ellipse cx="100" cy="14" rx="68" ry="18" />
        </g>
        {/* lotus petals at base */}
        <g fill="#9d6ee0" stroke={INK} strokeWidth="1.2" opacity="0.8">
          <ellipse cx="60" cy="218" rx="8" ry="3" transform="rotate(-20 60 218)" />
          <ellipse cx="140" cy="218" rx="8" ry="3" transform="rotate(20 140 218)" />
          <ellipse cx="40" cy="220" rx="6" ry="2.5" transform="rotate(-35 40 220)" />
          <ellipse cx="160" cy="220" rx="6" ry="2.5" transform="rotate(35 160 220)" />
        </g>
        <text x="22" y="40" fontSize="22" fontFamily='"Caveat", cursive' fill="#9d6ee0"
          className="sk-pop-text" stroke={INK} strokeWidth="0.3">om…</text>
      </g>
    );
  }
  if (state === 'sick') {
    return (
      <g>
        {/* floaty green nausea cloud */}
        <g className="sk-yawn-aura" stroke={INK} strokeWidth="1.4" fill="#bcd6a4"
          opacity="0.7">
          <ellipse cx="36" cy="50" rx="10" ry="5" />
          <ellipse cx="170" cy="56" rx="9" ry="4.5" />
        </g>
        <text x="22" y="40" fontSize="20" fontFamily='"Caveat", cursive' fill="#6e8c4a"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4"
          transform="rotate(-6 22 40)">uhh…</text>
      </g>
    );
  }
  if (state === 'read') {
    return (
      <g>
        {/* "concentration" lines + tiny page-turn flutter */}
        <g stroke={INK} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.5">
          <path d="M 22 50 L 30 50" />
          <path d="M 22 58 L 32 58" />
          <path d="M 170 50 L 178 50" />
          <path d="M 168 58 L 178 58" />
        </g>
        <text x="180" y="174" fontSize="16" fontFamily='"Caveat", cursive' fill={INK}
          className="sk-pop-text" transform="rotate(-8 180 174)">…</text>
      </g>
    );
  }
  if (state === 'pet') {
    return (
      <g>
        {/* love hearts floating around */}
        {[[40,80],[160,86],[28,140],[172,142]].map(([x,y],i) => (
          <path key={i}
            d={`M ${x} ${y+5} C ${x-6} ${y}, ${x-6} ${y-4}, ${x-2.5} ${y-4}
                C ${x} ${y-4}, ${x} ${y-1}, ${x} ${y-1}
                C ${x} ${y-1}, ${x} ${y-4}, ${x+2.5} ${y-4}
                C ${x+6} ${y-4}, ${x+6} ${y}, ${x} ${y+5} Z`}
            fill="#e63a6b" stroke={INK} strokeWidth="1.1"
            className="sk-heart" style={{ animationDelay: `${i*0.22}s` }} />
        ))}
        {/* purring lines */}
        <g stroke={INK} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.5"
          className="sk-purr">
          <path d="M 18 130 Q 24 132, 30 130" />
          <path d="M 16 138 Q 24 140, 32 138" />
          <path d="M 170 130 Q 176 132, 182 130" />
          <path d="M 168 138 Q 176 140, 184 138" />
        </g>
      </g>
    );
  }

  if (state === 'party') {
    // confetti shower
    const confetti: [number, number, string][] = [
      [28, 50, '#e63a6b'], [44, 30, '#ffd24a'], [60, 60, '#3a85e0'],
      [156, 30, '#e63a6b'], [172, 56, '#ffd24a'], [184, 32, '#3a85e0'],
      [22, 110, '#ffd24a'], [180, 110, '#e63a6b'],
    ];
    return (
      <g className="sk-confetti">
        {confetti.map(([x, y, c], i) => (
          <rect key={i} x={x} y={y} width="5" height="3" rx="0.5"
            fill={c} stroke={INK} strokeWidth="0.8"
            transform={`rotate(${(i * 47) % 90 - 30} ${x + 2} ${y + 1})`}
            style={{ animationDelay: `${(i * 0.13) % 1}s` }} />
        ))}
        {/* streamers */}
        <path d="M 14 24 Q 24 36, 18 50" stroke="#e63a6b" strokeWidth="1.6"
          fill="none" strokeLinecap="round" />
        <path d="M 186 24 Q 176 36, 182 50" stroke="#3a85e0" strokeWidth="1.6"
          fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (state === 'yawn') {
    // small puffy breath cloud
    return (
      <g className="sk-yawn-puff">
        <ellipse cx="170" cy="100" rx="10" ry="6" fill="#fff"
          stroke={INK} strokeWidth="1.6" opacity="0.85" />
        <ellipse cx="182" cy="94" rx="6" ry="4" fill="#fff"
          stroke={INK} strokeWidth="1.4" opacity="0.7" />
        <ellipse cx="188" cy="86" rx="3.5" ry="2.5" fill="#fff"
          stroke={INK} strokeWidth="1.2" opacity="0.55" />
      </g>
    );
  }
  if (state === 'silly') {
    // wiggly motion lines around head
    return (
      <g className="sk-silly-wiggle" stroke={INK} strokeWidth="1.6"
        fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M 18 70 Q 24 74, 18 78" />
        <path d="M 14 86 Q 20 90, 14 94" />
        <path d="M 182 70 Q 176 74, 182 78" />
        <path d="M 186 86 Q 180 90, 186 94" />
        {/* tiny stars */}
        <path d="M 30 40 L 30 48 M 26 44 L 34 44" stroke="#ffd24a" strokeWidth="2" />
        <path d="M 170 40 L 170 48 M 166 44 L 174 44" stroke="#ffd24a" strokeWidth="2" />
      </g>
    );
  }
  if (state === 'laugh') {
    return (
      <g>
        <text x="18" y="40" fontSize="22" fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4"
          transform="rotate(-10 18 40)">ha!</text>
        <text x="170" y="46" fontSize="20" fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4"
          style={{ animationDelay: '0.25s' }} transform="rotate(10 170 46)">ha!</text>
      </g>
    );
  }
  if (state === 'highfive') {
    return (
      <g className="sk-hf-impact" stroke="#ffd24a" strokeWidth="2.2" strokeLinecap="round"
        fill="none">
        <path d="M 170 62 L 170 52 M 190 72 L 198 66 M 150 72 L 142 66 M 192 92 L 202 90 M 150 92 L 140 90" />
      </g>
    );
  }
  if (state === 'sneeze') {
    return (
      <g>
        <g className="sk-sneeze-spray" fill="#bcd6e8" stroke={INK} strokeWidth="0.8">
          <circle cx="122" cy="140" r="2.2" />
          <circle cx="134" cy="133" r="1.6" />
          <circle cx="139" cy="147" r="2.4" />
          <circle cx="151" cy="138" r="1.5" />
          <circle cx="127" cy="151" r="1.7" />
        </g>
        <text x="100" y="22" textAnchor="middle" fontSize="20"
          fontFamily='"Caveat", cursive' fill="#3a85e0"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4">apćiha!</text>
      </g>
    );
  }
  if (state === 'scared') {
    return (
      <g>
        {/* dread shading across the top of the head */}
        <path d="M 40 64 Q 100 56, 160 64 L 160 78 Q 100 72, 40 78 Z"
          fill="#7eb2d8" opacity="0.28" />
        {/* sweat drops flinging off */}
        <path d="M 40 96 Q 36 104, 40 112 Q 44 104, 40 96 Z"
          fill="#7eb2d8" stroke={INK} strokeWidth="1.4" className="sk-drop" />
        <path d="M 160 100 Q 156 108, 160 116 Q 164 108, 160 100 Z"
          fill="#7eb2d8" stroke={INK} strokeWidth="1.4" className="sk-drop"
          style={{ animationDelay: '0.3s' }} />
        <text x="22" y="40" fontSize="22" fontFamily='"Caveat", cursive' fill="#c8252c"
          className="sk-pop-text" stroke={INK} strokeWidth="0.5"
          transform="rotate(-10 22 40)">!?</text>
      </g>
    );
  }
  if (state === 'dizzy') {
    return (
      <g className="sk-dizzy-orbit">
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          const cx = 100 + Math.cos(a) * 42;
          const cy = 34 + Math.sin(a) * 10;
          return (
            <path key={i}
              d={`M ${cx} ${cy-5} L ${cx+1.4} ${cy-1} L ${cx+5} ${cy} L ${cx+1.4} ${cy+1} L ${cx} ${cy+5} L ${cx-1.4} ${cy+1} L ${cx-5} ${cy} L ${cx-1.4} ${cy-1} Z`}
              fill="#ffd24a" stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
          );
        })}
      </g>
    );
  }
  if (state === 'sip') {
    return (
      <g className="sk-steam-rise" stroke={INK} strokeWidth="1.6" fill="none"
        strokeLinecap="round" opacity="0.6">
        <path d="M 92 120 Q 88 112, 94 106 Q 100 112, 96 120" />
        <path d="M 104 120 Q 108 112, 102 106 Q 98 112, 100 120" />
      </g>
    );
  }
  if (state === 'cold') {
    return (
      <g>
        {[[30, 40], [170, 50], [20, 90], [182, 84], [44, 16], [158, 20]].map(([x, y], i) => (
          <g key={i} className="sk-snowflake" style={{ animationDelay: `${i * 0.4}s`,
            transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}>
            <path d={`M ${x} ${y-4} L ${x} ${y+4} M ${x-4} ${y} L ${x+4} ${y} M ${x-3} ${y-3} L ${x+3} ${y+3} M ${x-3} ${y+3} L ${x+3} ${y-3}`}
              stroke="#9cc4e0" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ))}
        <text x="22" y="42" fontSize="22" fontFamily='"Caveat", cursive' fill="#3a85e0"
          className="sk-pop-text" stroke={INK} strokeWidth="0.4">brrr!</text>
      </g>
    );
  }
  if (state === 'facepalm') {
    return (
      <g>
        {/* sweat drop on the temple */}
        <path d="M 150 86 Q 146 94, 150 102 Q 154 94, 150 86 Z"
          fill="#7eb2d8" stroke={INK} strokeWidth="1.4" className="sk-drop" />
      </g>
    );
  }
  if (state === 'gift') {
    return (
      <g>
        {[[28,40],[172,44],[40,14],[160,16]].map(([x,y],i) => (
          <g key={i} className="sk-mag-spark" style={{ animationDelay: `${i*0.14}s` }}>
            <path d={`M ${x} ${y-4} L ${x+1.4} ${y-1} L ${x+4} ${y} L ${x+1.4} ${y+1} L ${x} ${y+4} L ${x-1.4} ${y+1} L ${x-4} ${y} L ${x-1.4} ${y-1} Z`}
              fill="#ffd24a" stroke={INK} strokeWidth="0.8" />
          </g>
        ))}
      </g>
    );
  }
  if (state === 'salute') {
    return (
      <g className="sk-fx-pop">
        <g className="sk-spark" stroke="#ffd24a" strokeWidth="1.8" fill="none"
          strokeLinecap="round" style={{ transformOrigin: '120px 76px' }}>
          <path d="M 116 72 L 124 80 M 124 72 L 116 80 M 120 68 L 120 84" />
        </g>
      </g>
    );
  }
  if (state === 'sing') {
    return (
      <g fill={INK} fontFamily='"Caveat", cursive' fontSize="18">
        <text x="150" y="56" className="sk-note-a">♪</text>
        <text x="172" y="40" className="sk-note-b">♫</text>
        <text x="24" y="60" className="sk-note-c">♬</text>
      </g>
    );
  }
  if (state === 'balloon') {
    return (
      <g>
        {[[40,72],[30,120]].map(([x,y],i) => (
          <g key={i} className="sk-mag-spark" style={{ animationDelay: `${i*0.3}s` }}>
            <path d={`M ${x} ${y-3} L ${x+1} ${y} L ${x+3} ${y} L ${x+1} ${y+1.5} L ${x+2} ${y+4} L ${x} ${y+2} L ${x-2} ${y+4} L ${x-1} ${y+1.5} L ${x-3} ${y} L ${x-1} ${y} Z`}
              fill="#ffd24a" stroke={INK} strokeWidth="0.8" />
          </g>
        ))}
      </g>
    );
  }

  return null;
}

// speech bubble at corner
function SkSpeech({ state }: { state: SketchErenState }) {
  const map: Partial<Record<SketchErenState, { t: string; c: string }>> = {
    sad:      { t: 'Joj…',   c: '#3a5a8c' },
    sleeping: { t: 'zzz',    c: INK },
    wave:     { t: 'hi!',    c: '#c8252c' },
    confused: { t: '???',    c: INK },
    streak:   { t: '5 u nizu!', c: '#ff6a2c' },
    tired:    { t: 'haaaah',  c: INK },
    love:     { t: '<3',      c: '#e63a6b' },
    wink:     { t: 'lako!',   c: '#ff6a2c' },
    point:    { t: 'tap!',    c: '#c8252c' },
    peek:     { t: 'eo me…',  c: INK },
    shy:      { t: 'ne gledaj…', c: '#c46070' },
    wow:      { t: 'wow!',    c: '#ffaa00' },
    cry:      { t: 'buuuu…',  c: '#3a5a8c' },
    magic:    { t: 'abrakadabra', c: '#9d6ee0' },
    listen:   { t: 'slušaj',  c: INK },
    eureka:   { t: 'ideja!',  c: '#c8252c' },
    shrug:    { t: 'ko zna…', c: INK },
    flex:     { t: 'lako!',   c: '#c8252c' },
    gasp:     { t: 'jao!',    c: '#c8252c' },
    grad:     { t: 'završeno!', c: '#1d8a5a' },
    rocket:   { t: 'idemo!',  c: '#ff6a2c' },
    nom:      { t: 'njam!',   c: '#a37444' },
    bow:      { t: 'hvala…', c: '#1d8a5a' },
    focus:    { t: 'fokus',   c: '#c8252c' },
    chill:    { t: 'cool',    c: '#3a85e0' },
    trophy:   { t: 'pobeda!', c: '#c8252c' },
    kiss:     { t: 'muah',    c: '#e63a6b' },
    angry:    { t: 'grrr!',   c: '#c8252c' },
    proud:    { t: 'ponosan', c: '#1d8a5a' },
    meditate: { t: 'mir…',    c: '#9d6ee0' },
    sick:     { t: 'bolesan…', c: '#6e8c4a' },
    read:     { t: 'čitam…',  c: INK },
    pet:      { t: 'prr~',    c: '#e63a6b' },
    party:    { t: 'žurka!', c: '#e63a6b' },
    yawn:     { t: 'haaa…',  c: '#7a8aa8' },
    silly:    { t: ':P',     c: '#e63a6b' },
    highfive: { t: 'daj pet!', c: '#c8252c' },
    scared:   { t: 'joj!',    c: '#3a5a8c' },
    dizzy:    { t: 'vrti se…', c: '#9d6ee0' },
    sip:      { t: 'mljac',   c: '#a37444' },
    search:   { t: 'hmm?',    c: INK },
    facepalm: { t: 'uf…',     c: '#7a8aa8' },
    gift:     { t: 'izvoli!', c: '#e63a6b' },
    salute:   { t: 'razumem!', c: '#c8252c' },
    sing:     { t: 'la la la~', c: '#9d6ee0' },
    balloon:  { t: 'jupi!',   c: '#e63a6b' },
  };
  const entry = map[state]
  if (!entry) return null
  const { t, c } = entry
  return (
    <div style={{
      position: 'absolute', bottom: 6, right: 8,
      fontFamily: '"Caveat", "Patrick Hand", cursive',
      fontSize: 20, color: c,
      background: '#fff', padding: '2px 10px',
      border: `2px solid ${INK}`, borderRadius: 14,
      transform: 'rotate(-3deg)',
      boxShadow: '0 2px 0 #1a1a1a',
    }}>{t}</div>
  );
}

// All CSS animations live here so the component is self-contained.
function SketchPlusStyles() {
  return (
    <style>{`
      .eren-sk { font-family: inherit; }

      /* TAIL — always animated, base at the cat's back (~170, 110 in viewBox).
         The tail group sits INSIDE .sk-body so all body transforms cascade
         and the tail moves with the cat. On top of that, the tail has its
         own wag so it always reads as alive. */
      .sk-tail {
        transform-origin: 160px 168px;
        transform-box: view-box;
        animation: sk-tail-wag 1.6s ease-in-out infinite;
      }
      @keyframes sk-tail-wag {
        0%, 100% { transform: rotate(-5deg); }
        50%      { transform: rotate(6deg); }
      }

      /* IDLE — gentle breath + slow tail */
      .eren-sk-idle .sk-body { animation: sk-breath 3.6s ease-in-out infinite; transform-origin: 50% 90%; }
      .eren-sk-idle .sk-tail { animation: sk-tail-wag 3s ease-in-out infinite; }
      @keyframes sk-breath { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.02, 0.98); } }
      .sk-eye-blink { animation: sk-blink 5.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.06); } }

      /* HAPPY — bounce */
      .eren-sk-happy .sk-body { animation: sk-bounce 0.55s cubic-bezier(.6,-0.2,.4,1.6) infinite; transform-origin: 50% 100%; }
      @keyframes sk-bounce { 0%,100% { transform: translateY(0) scale(1,1); } 30% { transform: translateY(-6px) scale(0.96,1.04); } 60% { transform: translateY(2px) scale(1.06,0.94); } }
      .sk-fx-pop .sk-spark { animation: sk-spark-anim 0.9s ease-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-spark-anim { 0% { opacity: 0; transform: scale(0.4); } 40% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0; transform: scale(1.4); } }

      /* SAD — slump tilt */
      .eren-sk-sad .sk-body { animation: sk-slump 2.6s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-slump { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(4px) rotate(3deg); } }

      /* THINKING — head tilt, paw tap, bubbles rise */
      .eren-sk-thinking .sk-head { animation: sk-think-tilt 2.4s ease-in-out infinite; transform-origin: 50% 85%; }
      @keyframes sk-think-tilt { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(4deg); } }
      .sk-paw-think { animation: sk-paw-tap 0.9s ease-in-out infinite; transform-origin: 130 130; }
      @keyframes sk-paw-tap { 0%,100% { transform: translate(0,0) rotate(0); } 50% { transform: translate(0,-3px) rotate(-6deg); } }
      .sk-bubble-a { animation: sk-bub 2.4s ease-in-out infinite; }
      .sk-bubble-b { animation: sk-bub 2.4s ease-in-out infinite 0.4s; }
      .sk-bubble-c { animation: sk-bub-big 2.4s ease-in-out infinite 0.8s; transform-origin: 180px 22px; }
      @keyframes sk-bub { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      @keyframes sk-bub-big { 0% { opacity: 0; transform: scale(0.6); } 30% { opacity: 1; transform: scale(1); } 70% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.1); } }

      /* SLEEPING — slow breath, Zs rise */
      .eren-sk-sleeping .sk-body { animation: sk-sleep-breath 3.5s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-sleep-breath { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.04, 0.96); } }
      .sk-z1, .sk-z2, .sk-z3 { animation: sk-zfloat 2.2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; opacity: 0; }
      .sk-z2 { animation-delay: 0.5s; }
      .sk-z3 { animation-delay: 1s; }
      @keyframes sk-zfloat { 0% { opacity: 0; transform: translate(0,8px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(8px,-12px); } }

      /* WAVE — paw waves, body leans */
      .eren-sk-wave .sk-paw-wave { animation: sk-paw-wave 0.55s ease-in-out infinite; transform-origin: 38px 152px; }
      @keyframes sk-paw-wave { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(18deg); } }
      .eren-sk-wave .sk-head { animation: sk-head-lean 1.8s ease-in-out infinite; transform-origin: 50% 80%; }
      @keyframes sk-head-lean { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
      .sk-wave-text { animation: sk-wave-text 1.8s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-wave-text { 0%,100% { opacity: 0.6; transform: translateY(2px); } 50% { opacity: 1; transform: translateY(-2px); } }

      /* CHEER — big bounce + paws up + confetti + SUPER text */
      .eren-sk-cheer .sk-body { animation: sk-cheer-bounce 0.5s cubic-bezier(.6,-0.2,.4,1.6) infinite; transform-origin: 50% 100%; }
      @keyframes sk-cheer-bounce { 0%,100% { transform: translateY(0) scale(1,1); } 30% { transform: translateY(-12px) scale(0.94,1.06); } 60% { transform: translateY(4px) scale(1.06,0.94); } }
      .sk-paw-cheer-l, .sk-paw-cheer-r { animation: sk-paw-shake 0.4s ease-in-out infinite; transform-origin: 50px 152px; }
      .sk-paw-cheer-r { transform-origin: 150px 152px; }
      @keyframes sk-paw-shake { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
      .sk-confetti { animation: sk-confetti-fall 1.6s linear infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-confetti-fall { 0% { opacity: 0; transform: translateY(-20px) rotate(0); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(40px) rotate(360deg); } }
      .sk-pop-text { animation: sk-pop 0.7s ease-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-pop { 0% { opacity: 0; transform: scale(0.6); } 30% { opacity: 1; transform: scale(1.15); } 100% { opacity: 0; transform: scale(1.3); } }

      /* LOVE — hearts pulse */
      .eren-sk-love .sk-love-eyes { animation: sk-heart-eyes 1.4s ease-in-out infinite; transform-origin: 100px 100px; transform-box: fill-box; }
      @keyframes sk-heart-eyes { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
      .sk-heart { animation: sk-heart-float 2.2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; opacity: 0; }
      @keyframes sk-heart-float { 0% { opacity: 0; transform: translateY(8px) scale(0.6); } 30% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-12px) scale(1.1); } }

      /* CONFUSED — head tilt, ? bob */
      .eren-sk-confused .sk-head { animation: sk-confused-tilt 1.4s ease-in-out infinite; transform-origin: 50% 85%; }
      @keyframes sk-confused-tilt { 0% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } 100% { transform: rotate(-6deg); } }
      .sk-q1 { animation: sk-q-bob 1s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      .sk-q2 { animation: sk-q-bob 1s ease-in-out infinite 0.3s; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-q-bob { 0%,100% { transform: translateY(2px); opacity: 0.6; } 50% { transform: translateY(-2px); opacity: 1; } }

      /* STREAK — fierce shake + fire flicker */
      .eren-sk-streak .sk-body { animation: sk-streak-shake 0.18s ease-in-out infinite; }
      @keyframes sk-streak-shake { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-1px,1px); } 75% { transform: translate(1px,-1px); } }
      .sk-fire { animation: sk-fire-flick 0.18s steps(2) infinite; transform-origin: 100px 30px; }
      @keyframes sk-fire-flick { 0%,100% { transform: scaleY(1) scaleX(1); } 50% { transform: scaleY(1.15) scaleX(0.92); } }
      .sk-streak-n { animation: sk-streak-rise 1.4s ease-out infinite; transform-origin: center; transform-box: fill-box; opacity: 0; }
      @keyframes sk-streak-rise { 0% { opacity: 0; transform: translateY(10px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-20px); } }

      /* TIRED — slow droop */
      .eren-sk-tired .sk-body { animation: sk-tired-droop 4s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-tired-droop { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.03,0.97) translateY(2px); } }
      .eren-sk-tired .sk-head { animation: sk-head-droop 4s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-head-droop { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(3px) rotate(2deg); } }
      .sk-yawn-aura { animation: sk-yawn-puff 4s ease-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-yawn-puff { 0%, 30% { opacity: 0; transform: translateY(0); } 50% { opacity: 0.7; transform: translateY(-2px); } 100% { opacity: 0; transform: translateY(-10px); } }

      /* DANCE — sway side-to-side */
      .eren-sk-dance .sk-body { animation: sk-dance-sway 0.5s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-dance-sway { 0%,100% { transform: rotate(-6deg) translateX(-2px); } 50% { transform: rotate(6deg) translateX(2px); } }
      .eren-sk-dance .sk-head { animation: sk-dance-head 0.5s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-dance-head { 0%,100% { transform: rotate(6deg); } 50% { transform: rotate(-6deg); } }
      .sk-note-a, .sk-note-b, .sk-note-c { animation: sk-note 1.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; opacity: 0; }
      .sk-note-b { animation-delay: 0.4s; }
      .sk-note-c { animation-delay: 0.8s; }
      @keyframes sk-note { 0% { opacity: 0; transform: translateY(6px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px) rotate(20deg); } }

      /* PER-STATE TAIL SPEED — overrides the default wag */
      .eren-sk-happy    .sk-tail { animation: sk-tail-wag 0.4s ease-in-out infinite; }
      .eren-sk-cheer    .sk-tail { animation: sk-tail-flick 0.3s ease-in-out infinite; }
      .eren-sk-wave     .sk-tail { animation: sk-tail-wag 0.6s ease-in-out infinite; }
      .eren-sk-dance    .sk-tail { animation: sk-tail-flick 0.4s ease-in-out infinite; }
      .eren-sk-love     .sk-tail { animation: sk-tail-wag 0.8s ease-in-out infinite; }
      .eren-sk-streak   .sk-tail { animation: sk-tail-flick 0.25s ease-in-out infinite; }
      .eren-sk-thinking .sk-tail { animation: sk-tail-wag 2.4s ease-in-out infinite; }
      .eren-sk-confused .sk-tail { animation: sk-tail-wag 1.1s ease-in-out infinite; }
      .eren-sk-sleeping .sk-tail { animation: sk-tail-sleep 4s ease-in-out infinite; }
      .eren-sk-tired    .sk-tail { animation: sk-tail-droop 3.2s ease-in-out infinite; }
      .eren-sk-sad      .sk-tail { animation: sk-tail-droop 2.6s ease-in-out infinite; }
      .eren-sk-wink     .sk-tail { animation: sk-tail-wag 0.7s ease-in-out infinite; }
      .eren-sk-point    .sk-tail { animation: sk-tail-wag 1s ease-in-out infinite; }
      .eren-sk-peek     .sk-tail { animation: sk-tail-wag 0.5s ease-in-out infinite; }
      .eren-sk-shy      .sk-tail { animation: sk-tail-wag 1.4s ease-in-out infinite; }
      .eren-sk-wow      .sk-tail { animation: sk-tail-flick 0.45s ease-in-out infinite; }
      .eren-sk-cry      .sk-tail { animation: sk-tail-droop 2.8s ease-in-out infinite; }
      .eren-sk-magic    .sk-tail { animation: sk-tail-flick 0.7s ease-in-out infinite; }
      .eren-sk-listen   .sk-tail { animation: sk-tail-wag 0.85s ease-in-out infinite; }

      @keyframes sk-tail-flick {
        0%, 100% { transform: rotate(-11deg); }
        50%      { transform: rotate(12deg); }
      }
      @keyframes sk-tail-sleep {
        0%, 100% { transform: rotate(-3deg); }
        50%      { transform: rotate(3deg); }
      }
      @keyframes sk-tail-droop {
        0%, 100% { transform: rotate(28deg); }
        50%      { transform: rotate(32deg); }
      }

      /* WINK — quick lean, eye-spark */
      .eren-sk-wink .sk-body { animation: sk-wink-lean 1.4s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-wink-lean { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(3deg); } }
      .sk-wink-text { animation: sk-pop 1.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }

      /* POINT — paw extends rhythmically, dotted trail steps right */
      .sk-paw-point { animation: sk-paw-reach 0.7s ease-in-out infinite; transform-origin: 150px 155px; }
      @keyframes sk-paw-reach { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(6px); } }
      .sk-dot { animation: sk-dot-pulse 0.9s ease-in-out infinite; opacity: 0; }
      .sk-d1 { animation-delay: 0s; }
      .sk-d2 { animation-delay: 0.2s; }
      .sk-d3 { animation-delay: 0.4s; }
      @keyframes sk-dot-pulse { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }

      /* PEEK — slide up from the bottom on loop */
      .eren-sk-peek .sk-body { animation: sk-peek-up 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-peek-up {
        0%, 100% { transform: translateY(70px); }
        20%, 80% { transform: translateY(30px); }
        50%      { transform: translateY(8px); }
      }
      .sk-peek-text { animation: sk-q-bob 1.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }

      /* SHY — body trembles tiny + paws can't quite stay still */
      .eren-sk-shy .sk-body { animation: sk-shy-tremble 0.25s ease-in-out infinite; }
      @keyframes sk-shy-tremble { 0%,100% { transform: translateX(-0.5px); } 50% { transform: translateX(0.5px); } }
      .sk-paws-shy { animation: sk-paws-peek 3s ease-in-out infinite; transform-origin: 100px 100px; transform-box: fill-box; }
      @keyframes sk-paws-peek {
        0%, 100% { transform: translateY(0); }
        45%, 55% { transform: translateY(0); }
        70%      { transform: translateY(-8px); }
      }

      /* WOW — small lean-back + stars orbit-pop */
      .eren-sk-wow .sk-head { animation: sk-wow-back 1.8s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-wow-back { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-6deg) translateY(-3px); } }
      .sk-wow-star { animation: sk-spark-anim 1.4s ease-out infinite; }

      /* CRY — body shakes, tears stream */
      .eren-sk-cry .sk-body { animation: sk-cry-shake 0.4s ease-in-out infinite; }
      @keyframes sk-cry-shake { 0%,100% { transform: translateX(-1px) rotate(-1deg); } 50% { transform: translateX(1px) rotate(1deg); } }
      .sk-stream { animation: sk-stream-drop 0.9s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-stream-drop { 0% { opacity: 0; transform: translateY(-6px); } 30% { opacity: 1; } 100% { opacity: 0.4; transform: translateY(6px); } }
      .sk-drop { animation: sk-drop-fall 0.9s linear infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-drop-fall { 0% { opacity: 0; transform: translateY(-8px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(20px); } }

      /* MAGIC — paw raised, sparkles orbit */
      .eren-sk-magic .sk-paw-magic { animation: sk-paw-cast 1.4s ease-in-out infinite; transform-origin: 162px 152px; }
      @keyframes sk-paw-cast { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
      .sk-mag-spark { animation: sk-mag-orbit 1.8s ease-in-out infinite; }
      @keyframes sk-mag-orbit { 0%, 100% { opacity: 0; transform: scale(0.5); } 40% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0; transform: scale(0.4); } }

      /* LISTEN — head bobs gently */
      .eren-sk-listen .sk-head { animation: sk-listen-bob 0.8s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-listen-bob { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }

      /* EUREKA — bulb flickers/pulses, body little hop */
      .eren-sk-eureka .sk-body { animation: sk-eureka-hop 0.8s cubic-bezier(.6,-0.2,.4,1.6) infinite; transform-origin: 50% 100%; }
      @keyframes sk-eureka-hop { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-4px) scale(0.98,1.02); } }
      .sk-bulb { animation: sk-bulb-pulse 0.6s ease-in-out infinite; transform-origin: 100px 30px; transform-box: view-box; }
      @keyframes sk-bulb-pulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.4); } }
      .sk-bulb-rays { animation: sk-rays-pulse 0.6s ease-in-out infinite; transform-origin: 100px 20px; transform-box: view-box; }
      @keyframes sk-rays-pulse { 0%,100% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.15); } }

      /* SHRUG — paws/shoulders bounce up */
      .sk-paws-shrug { animation: sk-shrug-up 1.4s ease-in-out infinite; transform-origin: 100px 130px; transform-box: view-box; }
      @keyframes sk-shrug-up {
        0%, 30%, 100% { transform: translateY(8px); }
        50%, 80% { transform: translateY(-4px); }
      }
      .eren-sk-shrug .sk-head { animation: sk-shrug-tilt 1.4s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-shrug-tilt { 0%, 30%, 100% { transform: rotate(0); } 50%, 80% { transform: rotate(-4deg); } }

      /* FLEX — bicep pulses, body slight strain */
      .sk-arm-flex { animation: sk-flex-pump 0.7s ease-in-out infinite; transform-origin: 192px 130px; transform-box: view-box; }
      @keyframes sk-flex-pump { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05) rotate(-1deg); } }
      .eren-sk-flex .sk-body { animation: sk-flex-strain 0.7s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-flex-strain { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-2deg) translateY(-1px); } }

      /* GASP — head jolts, paw pulses */
      .eren-sk-gasp .sk-head { animation: sk-gasp-jolt 1.6s ease-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-gasp-jolt { 0% { transform: translateY(0); } 8% { transform: translateY(-4px) rotate(-2deg); } 30% { transform: translateY(0); } 100% { transform: translateY(0); } }
      .sk-paw-gasp { animation: sk-gasp-paw 1.6s ease-out infinite; transform-origin: 100px 138px; transform-box: view-box; }
      @keyframes sk-gasp-paw { 0% { transform: translateY(8px); opacity: 0; } 10% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }

      /* GRADUATION — proud body wiggle, tassel sways */
      .eren-sk-grad .sk-body { animation: sk-grad-proud 1.6s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-grad-proud { 0%,100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-2px) rotate(1.5deg); } }
      .sk-tassel-line, .sk-tassel-ball { animation: sk-tassel 1.6s ease-in-out infinite; transform-origin: 184px 46px; transform-box: view-box; }
      @keyframes sk-tassel { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }

      /* ROCKET — body shoots up then settles, flame flickers, speed lines streak */
      .eren-sk-rocket .sk-body { animation: sk-rocket-launch 1.6s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-rocket-launch {
        0%   { transform: translateY(60px); }
        20%  { transform: translateY(-8px); }
        45%  { transform: translateY(-12px) translateX(1px); }
        60%  { transform: translateY(-12px) translateX(-1px); }
        100% { transform: translateY(60px); }
      }
      .sk-rocket { animation: sk-flame-flick 0.12s steps(2) infinite; transform-origin: 100px 220px; transform-box: view-box; }
      @keyframes sk-flame-flick { 0%,100% { transform: scaleY(1) scaleX(1); } 50% { transform: scaleY(1.2) scaleX(0.9); } }
      .sk-speed-lines { animation: sk-speed-streak 0.3s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-speed-streak { 0% { opacity: 0; transform: translateY(-6px); } 50% { opacity: 1; } 100% { opacity: 0; transform: translateY(6px); } }

      /* PER-STATE TAIL extra speeds */
      .eren-sk-eureka  .sk-tail { animation: sk-tail-flick 0.4s ease-in-out infinite; }
      .eren-sk-shrug   .sk-tail { animation: sk-tail-wag 1.4s ease-in-out infinite; }
      .eren-sk-flex    .sk-tail { animation: sk-tail-flick 0.5s ease-in-out infinite; }
      .eren-sk-gasp    .sk-tail { animation: sk-tail-wag 0.9s ease-in-out infinite; }
      .eren-sk-grad    .sk-tail { animation: sk-tail-wag 0.6s ease-in-out infinite; }
      .eren-sk-rocket  .sk-tail { animation: sk-tail-flick 0.2s ease-in-out infinite; }

      /* NOM — head wiggles side-to-side chewing, crumbs bounce */
      .eren-sk-nom .sk-head { animation: sk-nom-chew 0.32s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-nom-chew { 0%,100% { transform: rotate(-2deg) translateY(0); } 50% { transform: rotate(2deg) translateY(-1px); } }
      .sk-treat { animation: sk-nom-chew 0.32s ease-in-out infinite; transform-origin: 100px 144px; transform-box: view-box; }
      .sk-crumbs { animation: sk-crumbs-bounce 0.6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-crumbs-bounce { 0% { opacity: 0; transform: translateY(-2px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(8px); } }
      .eren-sk-nom .sk-tail { animation: sk-tail-flick 0.5s ease-in-out infinite; }

      /* BOW — cat crouches forward and head dips down toward the floor */
      .eren-sk-bow .sk-body {
        animation: sk-bow-down 2.2s ease-in-out infinite;
        transform-origin: 50% 100%;
      }
      @keyframes sk-bow-down {
        0%, 100% { transform: translateY(0) scaleY(1); }
        35%, 60% { transform: translateY(10px) scaleY(0.9); }
      }
      .eren-sk-bow .sk-head {
        animation: sk-bow-tilt 2.2s ease-in-out infinite;
        transform-origin: 50% 100%;
      }
      @keyframes sk-bow-tilt {
        0%, 100% { transform: translateY(0) rotate(0); }
        35%, 60% { transform: translateY(22px) rotate(-6deg) scale(0.94); }
      }
      .sk-bow-arc { animation: sk-bow-arc-fade 2.2s ease-in-out infinite; }
      @keyframes sk-bow-arc-fade { 0%, 25%, 70%, 100% { opacity: 0; } 35%, 60% { opacity: 0.6; } }

      /* FOCUS — reticle floats then snaps to target, body locked still */
      .sk-reticle { animation: sk-reticle-lock 2.2s ease-in-out infinite; transform-origin: 170px 40px; transform-box: view-box; }
      @keyframes sk-reticle-lock {
        0%   { transform: translate(8px, -6px) scale(1.2); opacity: 0.4; }
        40%  { transform: translate(0,0) scale(1); opacity: 1; }
        60%  { transform: translate(0,0) scale(1); opacity: 1; }
        100% { transform: translate(-6px, 8px) scale(1.15); opacity: 0.3; }
      }
      .eren-sk-focus .sk-tail { animation: sk-tail-flick 0.35s ease-in-out infinite; }

      /* CHILL — gentle slow head sway, sunglasses shine pulse */
      .eren-sk-chill .sk-head { animation: sk-chill-bob 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-chill-bob { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
      .eren-sk-chill .sk-tail { animation: sk-tail-wag 1.6s ease-in-out infinite; }
      .sk-shades { animation: sk-shades-shine 2.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-shades-shine { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }

      /* TROPHY — held high, sparkle pulses */
      .eren-sk-trophy .sk-body { animation: sk-cheer-bounce 0.6s cubic-bezier(.6,-0.2,.4,1.6) infinite; transform-origin: 50% 100%; }
      .sk-trophy-grp { animation: sk-trophy-hold 1.6s ease-in-out infinite; transform-origin: 100px 130px; transform-box: view-box; }
      @keyframes sk-trophy-hold { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
      .sk-rays-pulse-grp { animation: sk-rays-pulse 0.9s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      .eren-sk-trophy .sk-tail { animation: sk-tail-flick 0.35s ease-in-out infinite; }

      /* KISS — head tilts, heart floats away */
      .eren-sk-kiss .sk-head { animation: sk-kiss-tilt 1.6s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-kiss-tilt { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(2deg); } }
      .sk-paw-kiss { animation: sk-kiss-paw 1.6s ease-in-out infinite; transform-origin: 80px 138px; transform-box: view-box; }
      @keyframes sk-kiss-paw {
        0% { transform: translate(0, 4px); opacity: 0.85; }
        30% { transform: translate(0,0); opacity: 1; }
        100% { transform: translate(0,0); opacity: 1; }
      }
      .sk-kiss-heart { animation: sk-kiss-float 2.2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; opacity: 0; }
      @keyframes sk-kiss-float {
        0% { opacity: 0; transform: translate(0,8px) scale(0.5); }
        20% { opacity: 1; transform: translate(0,0) scale(1); }
        70% { opacity: 1; transform: translate(20px,-30px) scale(1.1); }
        100% { opacity: 0; transform: translate(40px,-60px) scale(0.9); }
      }
      .eren-sk-kiss .sk-tail { animation: sk-tail-wag 0.9s ease-in-out infinite; }

      /* ANGRY — fast shake + steam puff up */
      .eren-sk-angry .sk-body { animation: sk-angry-shake 0.16s ease-in-out infinite; }
      @keyframes sk-angry-shake { 0%,100% { transform: translate(-1px,1px); } 50% { transform: translate(1px,-1px); } }
      .sk-steam { animation: sk-steam-puff 1.2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      .sk-steam-rise { animation: sk-steam-rise 1.4s ease-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-steam-puff { 0%,100% { transform: scale(0.92); opacity: 0.85; } 50% { transform: scale(1.1); opacity: 1; } }
      @keyframes sk-steam-rise { 0% { opacity: 0; transform: translateY(20px) scale(0.6); } 30% { opacity: 0.9; } 100% { opacity: 0; transform: translateY(-20px) scale(1.3); } }
      .eren-sk-angry .sk-tail { animation: sk-tail-flick 0.2s ease-in-out infinite; }

      /* PROUD — slow chest puff, body grows on inhale */
      .eren-sk-proud .sk-body { animation: sk-proud-puff 3s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-proud-puff {
        0%,100% { transform: scale(1,1); }
        50%     { transform: scale(1.05,1.05) translateY(-2px); }
      }
      .sk-medal { animation: sk-medal-shine 2s ease-in-out infinite; transform-origin: 100px 186px; transform-box: view-box; }
      @keyframes sk-medal-shine { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.2); } }
      .eren-sk-proud .sk-tail { animation: sk-tail-wag 1.4s ease-in-out infinite; }

      /* MEDITATE — extremely still, halo glow, breath rings expand */
      .eren-sk-meditate .sk-body { animation: sk-meditate-breath 5s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-meditate-breath { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.025, 0.985); } }
      .sk-halo { animation: sk-halo-glow 3.2s ease-in-out infinite; transform-origin: 100px 14px; transform-box: view-box; }
      @keyframes sk-halo-glow {
        0%,100% { opacity: 0.85; transform: scale(1); }
        50%     { opacity: 1;    transform: scale(1.06); }
      }
      .sk-breath-ring { animation: sk-breath-ring 3.2s ease-out infinite; transform-origin: 100px 14px; transform-box: view-box; opacity: 0; }
      @keyframes sk-breath-ring {
        0%   { opacity: 0; transform: scale(0.8); }
        40%  { opacity: 0.6; }
        100% { opacity: 0; transform: scale(1.4); }
      }
      .eren-sk-meditate .sk-tail { animation: sk-tail-sleep 5s ease-in-out infinite; }

      /* SICK — slow droop + shivers, thermometer wobbles */
      .eren-sk-sick .sk-body { animation: sk-sick-shiver 0.32s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-sick-shiver { 0%,100% { transform: translateX(-0.7px) translateY(0); } 50% { transform: translateX(0.7px) translateY(1px); } }
      .eren-sk-sick .sk-head { animation: sk-sick-droop 3.4s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-sick-droop { 0%,100% { transform: rotate(-2deg) translateY(0); } 50% { transform: rotate(3deg) translateY(2px); } }
      .sk-thermo { animation: sk-thermo-wobble 3.4s ease-in-out infinite; transform-origin: 116px 138px; transform-box: view-box; }
      @keyframes sk-thermo-wobble { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(4deg); } }
      .eren-sk-sick .sk-tail { animation: sk-tail-droop 3.4s ease-in-out infinite; }

      /* READ — head dips toward book, page-turn bob */
      .eren-sk-read .sk-head { animation: sk-read-bob 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
      @keyframes sk-read-bob { 0%,100% { transform: rotate(-4deg) translateY(1px); } 50% { transform: rotate(2deg) translateY(-1px); } }
      .sk-book { animation: sk-book-hold 2.4s ease-in-out infinite; transform-origin: 100px 196px; transform-box: view-box; }
      @keyframes sk-book-hold { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
      .eren-sk-read .sk-tail { animation: sk-tail-wag 2.4s ease-in-out infinite; }

      /* PET — head pushes up into hand, hand presses down */
      .eren-sk-pet .sk-head { animation: sk-pet-push 1.2s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-pet-push { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      .sk-pet-hand { animation: sk-pet-hand 1.2s ease-in-out infinite; transform-origin: 100px 0px; transform-box: view-box; }
      @keyframes sk-pet-hand { 0%,100% { transform: translateY(8px); } 50% { transform: translateY(20px); } }
      .sk-purr { animation: sk-purr-flick 0.5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-purr-flick { 0%,100% { opacity: 0.35; transform: translateX(-1px); } 50% { opacity: 0.8; transform: translateX(1px); } }
      .eren-sk-pet .sk-tail { animation: sk-tail-flick 0.6s ease-in-out infinite; }

      /* PARTY — bouncy head + tilting hat + confetti drift */
      .eren-sk-party .sk-head { animation: sk-party-bounce 0.5s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-party-bounce { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-3px) rotate(3deg); } }
      .eren-sk-party .sk-body { animation: sk-party-bop 0.5s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-party-bop { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
      .sk-party-hat { animation: sk-party-hat 0.5s ease-in-out infinite; transform-origin: 100px 64px; transform-box: view-box; }
      @keyframes sk-party-hat { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(5deg); } }
      .sk-confetti rect { animation: sk-confetti-fall 1.6s linear infinite; }
      @keyframes sk-confetti-fall { 0% { transform: translateY(-6px); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(24px); opacity: 0; } }
      .eren-sk-party .sk-tail { animation: sk-tail-flick 0.3s ease-in-out infinite; }

      /* YAWN — slow chest rise, head tilts back, puff cloud drifts */
      .eren-sk-yawn .sk-body { animation: sk-yawn-breathe 2.6s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-yawn-breathe { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.05); } }
      .eren-sk-yawn .sk-head { animation: sk-yawn-tilt 2.6s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-yawn-tilt { 0%,100% { transform: rotate(0deg) translateY(0); } 50% { transform: rotate(-4deg) translateY(-2px); } }
      .sk-yawn-puff { animation: sk-yawn-puff 2.6s ease-in-out infinite; transform-origin: 170px 100px; transform-box: view-box; }
      @keyframes sk-yawn-puff { 0%,30% { opacity: 0; transform: translate(0,0); } 60% { opacity: 1; } 100% { opacity: 0; transform: translate(8px,-8px); } }
      .eren-sk-yawn .sk-tail { animation: sk-tail-droop 3.4s ease-in-out infinite; }

      /* SILLY — quick side-to-side wiggle */
      .eren-sk-silly .sk-head { animation: sk-silly-wig 0.5s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-silly-wig { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
      .eren-sk-silly .sk-body { animation: sk-silly-bop 0.5s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-silly-bop { 0%,100% { transform: translateX(-1px); } 50% { transform: translateX(1px); } }
      .sk-silly-wiggle { animation: sk-silly-shimmer 0.5s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-silly-shimmer { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      .eren-sk-silly .sk-tail { animation: sk-tail-flick 0.32s ease-in-out infinite; }

      /* ═══ NEW STATES (batch 2) ═══ */

      /* LAUGH — head rocks back, body jiggles, joy tears fall */
      .eren-sk-laugh .sk-head { animation: sk-laugh-rock 0.4s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-laugh-rock { 0%,100% { transform: rotate(-4deg) translateY(0); } 50% { transform: rotate(4deg) translateY(-3px); } }
      .eren-sk-laugh .sk-body { animation: sk-laugh-jiggle 0.4s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-laugh-jiggle { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-2px) scaleY(1.03); } }
      .sk-joy-tear { animation: sk-joy-tear 1.2s ease-in infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-joy-tear { 0% { opacity: 0; transform: translateY(-4px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(14px); } }
      .eren-sk-laugh .sk-tail { animation: sk-tail-flick 0.3s ease-in-out infinite; }

      /* HIGHFIVE — paw pushes toward the viewer, impact star pops, body bounces */
      .sk-paw-highfive { animation: sk-hf-push 1.2s ease-in-out infinite; transform-origin: 170px 92px; transform-box: view-box; }
      @keyframes sk-hf-push { 0%,100% { transform: scale(0.92) translateY(2px); } 45% { transform: scale(1.1) translateY(-2px); } }
      .sk-hf-impact { animation: sk-spark-anim 1.2s ease-out infinite; transform-origin: 170px 80px; transform-box: view-box; }
      .eren-sk-highfive .sk-body { animation: sk-bounce 0.6s cubic-bezier(.6,-0.2,.4,1.6) infinite; transform-origin: 50% 100%; }
      .eren-sk-highfive .sk-tail { animation: sk-tail-flick 0.35s ease-in-out infinite; }

      /* SNEEZE — head winds back then snaps forward, spray bursts out */
      .eren-sk-sneeze .sk-head { animation: sk-sneeze-jerk 1.6s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-sneeze-jerk {
        0%, 45% { transform: rotate(-9deg) translateY(-3px); }
        55%     { transform: rotate(11deg) translateY(7px); }
        70%,100%{ transform: rotate(0) translateY(0); }
      }
      .sk-sneeze-spray { animation: sk-sneeze-spray 1.6s ease-out infinite; transform-origin: 110px 140px; transform-box: view-box; }
      @keyframes sk-sneeze-spray {
        0%, 48% { opacity: 0; transform: scale(0.3) translateX(-12px); }
        58%     { opacity: 1; transform: scale(1) translateX(0); }
        100%    { opacity: 0; transform: scale(1.3) translateX(18px); }
      }
      .eren-sk-sneeze .sk-tail { animation: sk-tail-wag 1s ease-in-out infinite; }

      /* SCARED — nervous tremble, eyes shudder, sweat drips */
      .eren-sk-scared .sk-body { animation: sk-scared-shake 0.32s ease-in-out infinite; }
      @keyframes sk-scared-shake { 0%,100% { transform: translate(-0.5px,0); } 50% { transform: translate(0.5px,0); } }
      .sk-scared-eyes { animation: sk-scared-shake 0.3s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      .eren-sk-scared .sk-tail { animation: sk-tail-flick 0.18s ease-in-out infinite; }

      /* DIZZY — head wobbles, body sways, stars orbit overhead */
      .eren-sk-dizzy .sk-head { animation: sk-dizzy-wobble 1.6s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-dizzy-wobble { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
      .eren-sk-dizzy .sk-body { animation: sk-dizzy-sway 1.6s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-dizzy-sway { 0%,100% { transform: translateX(-2px) rotate(-1deg); } 50% { transform: translateX(2px) rotate(1deg); } }
      .sk-dizzy-orbit { animation: sk-dizzy-spin 1.4s linear infinite; transform-origin: 100px 34px; transform-box: view-box; }
      @keyframes sk-dizzy-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      .eren-sk-dizzy .sk-tail { animation: sk-tail-droop 2s ease-in-out infinite; }

      /* SIP — mug tilts up to drink, head dips, steam curls */
      .sk-mug-grp { animation: sk-sip-tilt 2.6s ease-in-out infinite; transform-origin: 100px 150px; transform-box: view-box; }
      @keyframes sk-sip-tilt { 0%,100% { transform: translateY(2px) rotate(0); } 45%,60% { transform: translateY(-4px) rotate(-6deg); } }
      .eren-sk-sip .sk-head { animation: sk-sip-head 2.6s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-sip-head { 0%,100% { transform: rotate(0); } 45%,60% { transform: rotate(4deg) translateY(-1px); } }
      .eren-sk-sip .sk-tail { animation: sk-tail-wag 2s ease-in-out infinite; }

      /* SEARCH — head & glass scan side to side, pupils track */
      .eren-sk-search .sk-head { animation: sk-search-scan 2.4s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-search-scan { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
      .sk-magnify { animation: sk-magnify-scan 2.4s ease-in-out infinite; transform-origin: 150px 150px; transform-box: view-box; }
      @keyframes sk-magnify-scan { 0%,100% { transform: translateX(0) rotate(0); } 50% { transform: translateX(-8px) rotate(-4deg); } }
      .sk-search-pupil { animation: sk-search-pupil 2.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
      @keyframes sk-search-pupil { 0%,100% { transform: translateX(3px); } 50% { transform: translateX(-3px); } }
      .eren-sk-search .sk-tail { animation: sk-tail-wag 1.4s ease-in-out infinite; }

      /* COLD — gentle shiver, snowflakes drift down */
      .eren-sk-cold .sk-body { animation: sk-cold-shiver 0.3s ease-in-out infinite; }
      @keyframes sk-cold-shiver { 0%,100% { transform: translate(-0.45px,0) rotate(-0.25deg); } 50% { transform: translate(0.45px,0) rotate(0.25deg); } }
      .eren-sk-cold .sk-head { animation: sk-cold-shiver 0.3s ease-in-out infinite; transform-origin: 50% 95%; }
      .sk-snowflake { animation: sk-snow-fall 3s linear infinite; }
      @keyframes sk-snow-fall { 0% { opacity: 0; transform: translateY(-6px) rotate(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(22px) rotate(70deg); } }
      .eren-sk-cold .sk-tail { animation: sk-tail-flick 0.15s ease-in-out infinite; }

      /* ═══ NEW STATES (batch 3) ═══ */

      /* FACEPALM — paw slaps up onto the forehead, head dips in dismay */
      .sk-paw-facepalm { animation: sk-facepalm 2.4s ease-in-out infinite; transform-origin: 60px 158px; transform-box: view-box; }
      @keyframes sk-facepalm {
        0%   { transform: translateY(12px) rotate(-10deg); opacity: 0.4; }
        16%  { transform: translateY(0) rotate(2deg); opacity: 1; }
        22%  { transform: translateY(2px) rotate(0); }
        100% { transform: translateY(0); opacity: 1; }
      }
      .eren-sk-facepalm .sk-head { animation: sk-facepalm-head 2.4s ease-in-out infinite; transform-origin: 50% 95%; }
      @keyframes sk-facepalm-head {
        0%   { transform: rotate(0) translateY(0); }
        18%  { transform: rotate(-3deg) translateY(4px); }
        60%  { transform: rotate(-2deg) translateY(3px); }
        100% { transform: rotate(0) translateY(0); }
      }
      .eren-sk-facepalm .sk-tail { animation: sk-tail-droop 3s ease-in-out infinite; }

      /* GIFT — box jiggles, body bounces with excitement */
      .eren-sk-gift .sk-body { animation: sk-bounce 0.7s cubic-bezier(.6,-0.2,.4,1.6) infinite; transform-origin: 50% 100%; }
      .sk-gift { animation: sk-gift-jiggle 0.7s ease-in-out infinite; transform-origin: 100px 190px; transform-box: view-box; }
      @keyframes sk-gift-jiggle { 0%,100% { transform: rotate(-2deg) translateY(0); } 50% { transform: rotate(2deg) translateY(-3px); } }
      .eren-sk-gift .sk-tail { animation: sk-tail-flick 0.35s ease-in-out infinite; }

      /* SALUTE — paw snaps up to the brow then holds, proud chest */
      .sk-paw-salute { animation: sk-salute 2.2s ease-in-out infinite; transform-origin: 150px 154px; transform-box: view-box; }
      @keyframes sk-salute {
        0%   { transform: translate(6px,8px) rotate(8deg); opacity: 0.5; }
        16%  { transform: translate(0,0) rotate(0); opacity: 1; }
        20%  { transform: translate(0,1px) rotate(-1deg); }
        100% { transform: translate(0,0) rotate(0); opacity: 1; }
      }
      .eren-sk-salute .sk-body { animation: sk-proud-puff 2.2s ease-in-out infinite; transform-origin: 50% 100%; }
      .eren-sk-salute .sk-tail { animation: sk-tail-wag 1.2s ease-in-out infinite; }

      /* SING — head sways to the beat, mic bobs, notes rise */
      .eren-sk-sing .sk-head { animation: sk-sing-sway 0.7s ease-in-out infinite; transform-origin: 50% 92%; }
      @keyframes sk-sing-sway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
      .eren-sk-sing .sk-body { animation: sk-party-bop 0.7s ease-in-out infinite; transform-origin: 50% 100%; }
      .sk-mic-grp { animation: sk-mic-bob 0.7s ease-in-out infinite; transform-origin: 90px 162px; transform-box: view-box; }
      @keyframes sk-mic-bob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-2px) rotate(2deg); } }
      .eren-sk-sing .sk-tail { animation: sk-tail-flick 0.35s ease-in-out infinite; }

      /* BALLOON — buoyant lift, balloon sways on its string */
      .eren-sk-balloon .sk-body { animation: sk-balloon-float 2.8s ease-in-out infinite; transform-origin: 50% 100%; }
      @keyframes sk-balloon-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      .sk-balloon { animation: sk-balloon-sway 2.8s ease-in-out infinite; transform-origin: 166px 90px; transform-box: view-box; }
      @keyframes sk-balloon-sway { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
      .sk-balloon-arm { animation: sk-balloon-armbob 2.8s ease-in-out infinite; transform-origin: 150px 152px; transform-box: view-box; }
      @keyframes sk-balloon-armbob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      .eren-sk-balloon .sk-tail { animation: sk-tail-wag 1.4s ease-in-out infinite; }
    `}</style>
  );
}
