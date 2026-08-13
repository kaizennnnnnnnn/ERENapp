'use client'

// ═══════════════════════════════════════════════════════════════════════════
// TREAT TUMBLE — the garden it happens in.
//
// The old field was an amber gradient, three blurry radial-gradient clouds
// that slid 50px back and forth, and a flat green stripe. Nothing said where
// you were, and — worse for a game about lining things up — nothing said how
// far away anything was. A treat and the sky it fell through were rendered at
// the same visual depth.
//
// So: a golden-hour garden with four bands that drift at four different rates.
// The sun barely moves, the hills creep, the clouds slide, the grass sways.
// The eye reads those differences as distance without being told, which is the
// same trick FizzyErenScenery uses and the cheapest depth there is.
//
// The picnic blanket is the one piece that is mechanics, not decoration: it
// marks the catch line. Before it you had to infer where Eren's mouth was from
// where treats stopped vanishing.
//
// Everything is memoised. The game re-renders every frame and none of this
// changes, so it must bail out of reconciliation or it repaints 60 times a
// second for nothing.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'

/** Height of the grass band. The game reads this so the visual floor and the
 *  floor a missed treat lands on are the same number. */
export const GROUND_H = 78
/** Distance from the bottom of the screen to the top of the picnic blanket —
 *  where a treat that got past Eren hits and puffs. */
export const FLOOR_OFFSET = 54

/** Height array → hard-edged stepped silhouette. One element per band rather
 *  than one per ridge, and no anti-aliasing to soften the pixel look. */
function stepClip(heights: number[]): string {
  const n = heights.length
  const pts: string[] = ['0% 100%']
  for (let i = 0; i < n; i++) {
    const x0 = ((i / n) * 100).toFixed(3)
    const x1 = (((i + 1) / n) * 100).toFixed(3)
    const y = (100 - heights[i]).toFixed(2)
    pts.push(`${x0}% ${y}%`, `${x1}% ${y}%`)
  }
  pts.push('100% 100%')
  return `polygon(${pts.join(',')})`
}

// Rolling hills — wide, low, no spikes. Spikes read as mountains and mountains
// are the wrong scale for a garden.
const HILLS = [
  38, 46, 55, 63, 68, 70, 67, 60, 52, 45, 41, 44,
  51, 60, 70, 78, 82, 80, 73, 64, 55, 47, 41, 37,
  40, 48, 57, 64, 67, 64, 56, 47, 40, 36, 35, 37,
]

// Hedge — same trick, tighter period, so it reads as foliage rather than land.
const HEDGE = [
  62, 78, 88, 80, 66, 74, 86, 92, 84, 70, 64, 72,
  84, 90, 82, 68, 60, 70, 82, 88, 79, 66, 61, 69,
  81, 89, 83, 71, 63, 73, 85, 91, 80, 67, 62, 70,
]

// Grass fringe — one blade per cell, uneven so it doesn't read as a comb.
const BLADES = [
  70, 100, 45, 85, 60, 100, 35, 75, 95, 50, 80, 65,
  100, 40, 90, 55, 75, 100, 45, 70, 85, 60, 95, 38,
]

// Authored, not random: a seeded PRNG would work but these are eight fixed
// dots and hardcoding them keeps the server and client renders identical.
const MOTES = [
  { x: 8,  y: 30, s: 3, d: 11, delay: 0 },
  { x: 22, y: 55, s: 2, d: 14, delay: 2.4 },
  { x: 37, y: 22, s: 2, d: 9,  delay: 4.1 },
  { x: 51, y: 48, s: 3, d: 13, delay: 1.2 },
  { x: 64, y: 34, s: 2, d: 10, delay: 5.6 },
  { x: 76, y: 62, s: 3, d: 12, delay: 3.0 },
  { x: 88, y: 40, s: 2, d: 15, delay: 6.8 },
  { x: 94, y: 26, s: 2, d: 8,  delay: 1.9 },
]

interface Props { reduced?: boolean }

// ── Sky ─────────────────────────────────────────────────────────────────────
// Golden hour: warm apricot high, palest at the horizon. Deliberately stays in
// the amber family so the existing HUD chrome still belongs to it.
const Sky = memo(function Sky({ reduced }: Props) {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(180deg, #F9A26C 0%, #FBBF5E 22%, #FCD34D 44%, #FDE68A 64%, #FEF3C7 82%, #FFF8E7 100%)',
      }} />

      {/* Low sun, sitting behind the hills. Breathes rather than pulses — a
          sun on a 1s loop reads as a warning light. Held above the hedge line:
          any lower and it sits behind Eren and washes out the catch zone,
          which is the one part of the screen that has to stay legible. */}
      <div className="absolute pointer-events-none" style={{
        left: '70%', bottom: GROUND_H + 104,
        width: 78, height: 78, marginLeft: -39,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #FFFDF0 0%, #FFF3C4 40%, #FDBA74 74%, rgba(253,186,116,0) 100%)',
        opacity: 0.85,
        animation: reduced ? 'none' : 'ttSunBreathe 7s ease-in-out infinite',
      }} />

      {/* Warm top vignette so treats read as arriving from somewhere, rather
          than being switched on at the top edge. */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
        height: '32%',
        background: 'linear-gradient(180deg, rgba(180,83,9,0.22) 0%, rgba(180,83,9,0.06) 55%, transparent 100%)',
      }} />
    </>
  )
})

// ── Clouds ──────────────────────────────────────────────────────────────────
// Hard-edged boxes, not blurred radial gradients. A soft cloud behind crisp
// pixel sprites is the single loudest "these two things were made by different
// people" signal in a pixel-art game.
// Same stepped-silhouette trick as the hills. Three stacked boxes read as a
// staircase however you arrange them; a lumpy height array reads as a cloud.
const CLOUD = [
  8, 20, 38, 54, 66, 74, 70, 62, 70, 84, 94, 100,
  96, 84, 74, 80, 88, 80, 66, 50, 36, 24, 14, 6,
]

function PixelCloud({ w, tone, shade }: { w: number; tone: string; shade: string }) {
  const h = w * 0.46
  return (
    <div style={{
      width: w, height: h,
      clipPath: stepClip(CLOUD),
      background: `linear-gradient(180deg, ${tone} 0%, ${tone} 76%, ${shade} 76%, ${shade} 100%)`,
    }} />
  )
}
const MemoPixelCloud = memo(PixelCloud)

// Kept below 26% — the HUD owns the top fifth of the screen, and a cloud
// parked behind it is a cloud nobody ever sees.
const Clouds = memo(function Clouds({ reduced }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div style={{ position: 'absolute', left: '4%', top: '27%', opacity: 0.92, animation: reduced ? 'none' : 'ttCloudDrift 34s ease-in-out infinite' }}>
        <MemoPixelCloud w={104} tone="#FFFDF6" shade="#F3D9A8" />
      </div>
      <div style={{ position: 'absolute', left: '56%', top: '38%', opacity: 0.8, animation: reduced ? 'none' : 'ttCloudDrift 46s ease-in-out infinite reverse' }}>
        <MemoPixelCloud w={118} tone="#FFF8E8" shade="#EFCE9A" />
      </div>
      <div style={{ position: 'absolute', left: '26%', top: '51%', opacity: 0.6, animation: reduced ? 'none' : 'ttCloudDrift 58s ease-in-out infinite' }}>
        <MemoPixelCloud w={80} tone="#FFF4DC" shade="#E8C48E" />
      </div>
    </div>
  )
})

// ── Horizon: hills behind a hedge ───────────────────────────────────────────
const Horizon = memo(function Horizon({ reduced }: Props) {
  return (
    <>
      {/* Far hills — hazed toward the sky colour. Atmospheric perspective does
          more for depth here than any amount of extra detail would. */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        bottom: GROUND_H + 8, height: 92,
        clipPath: stepClip(HILLS),
        background: 'linear-gradient(180deg, #E7B183 0%, #D89A6E 55%, #C98A5B 100%)',
        opacity: 0.75,
        animation: reduced ? 'none' : 'ttHillDrift 90s ease-in-out infinite',
      }} />

      {/* Hedge — near, saturated, sits right on the grass. */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        bottom: GROUND_H - 4, height: 54,
        clipPath: stepClip(HEDGE),
        background: 'linear-gradient(180deg, #5FA85A 0%, #3E8442 48%, #256B34 100%)',
        animation: reduced ? 'none' : 'ttHedgeDrift 52s ease-in-out infinite',
      }} />
      {/* Sun catching the top of the hedge. */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        bottom: GROUND_H - 4, height: 54,
        clipPath: stepClip(HEDGE),
        background: 'linear-gradient(180deg, rgba(253,224,71,0.55) 0%, transparent 26%)',
        animation: reduced ? 'none' : 'ttHedgeDrift 52s ease-in-out infinite',
      }} />
    </>
  )
})

// ── Ground: grass, blades, daisies, blanket ─────────────────────────────────
const Ground = memo(function Ground({ reduced }: Props) {
  return (
    <>
      {/* Grass body */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{
        height: GROUND_H,
        background: 'linear-gradient(180deg, #63D389 0%, #2FB86D 34%, #1B8F52 70%, #14532D 100%)',
      }} />

      {/* Blade fringe along the top edge, swaying as one field. */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        bottom: GROUND_H - 1, height: 9,
        clipPath: stepClip(BLADES),
        background: 'linear-gradient(180deg, #7BE39B 0%, #3FC57A 100%)',
        transformOrigin: '50% 100%',
        animation: reduced ? 'none' : 'ttGrassSway 4.4s ease-in-out infinite',
      }} />

      {/* Four daisies. Enough to say "garden", few enough to stay out of the
          way of a treat's landing shadow. */}
      {[14, 39, 63, 88].map((left, i) => (
        <div key={left} className="absolute pointer-events-none" style={{
          left: `${left}%`, bottom: GROUND_H - 11,
          width: 5, height: 5,
          background: i % 2 ? '#FFFFFF' : '#FEF08A',
          boxShadow: `0 0 0 1px ${i % 2 ? '#FDE68A' : '#FACC15'}`,
        }} />
      ))}

      {/* Picnic blanket — where Eren stands, and where treats land. Kept low
          contrast on purpose: the landing shadows are drawn on top of it and a
          hard red check swallows them, which costs the player the one cue that
          tells them where a treat is going before it gets there. */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        bottom: FLOOR_OFFSET - 30, height: 38,
        backgroundImage: 'repeating-conic-gradient(#DB9A93 0deg 90deg, #FFF4E6 90deg 180deg)',
        backgroundSize: '22px 22px',
        borderTop: '3px solid #B0645E',
        boxShadow: '0 -2px 0 rgba(0,0,0,0.12), inset 0 3px 0 rgba(255,255,255,0.3)',
        // Fades out at the edges so it reads as a blanket laid across the lawn
        // rather than one more full-width band stacked on the others.
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 9%, #000 91%, transparent 100%)',
        maskImage: 'linear-gradient(90deg, transparent 0%, #000 9%, #000 91%, transparent 100%)',
      }} />
    </>
  )
})

// ── Pollen ──────────────────────────────────────────────────────────────────
const Motes = memo(function Motes() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {MOTES.map(m => (
        <div key={`${m.x}-${m.y}`} style={{
          position: 'absolute',
          left: `${m.x}%`, top: `${m.y}%`,
          width: m.s, height: m.s,
          background: '#FFF7D6',
          boxShadow: '0 0 4px rgba(253,230,138,0.9)',
          opacity: 0.75,
          animation: `ttMoteFloat ${m.d}s ease-in-out ${m.delay}s infinite`,
        }} />
      ))}
    </div>
  )
})

/** The whole world, in paint order. One import for the game. */
const TreatTumbleWorld = memo(function TreatTumbleWorld({ reduced = false }: Props) {
  return (
    <>
      <Sky reduced={reduced} />
      <Clouds reduced={reduced} />
      <Horizon reduced={reduced} />
      <Ground reduced={reduced} />
      {!reduced && <Motes />}
    </>
  )
})

export default TreatTumbleWorld
export { TreatTumbleWorld }
