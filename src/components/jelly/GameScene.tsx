'use client'

// ─── GameScene ──────────────────────────────────────────────────────────────
// The little picture on each Parlour game tile: the game's own pixel cat
// (the shared PixelEren both games play with) doing that game's one thing.
//
//   run   mid-sprint, legs going, speed lines behind, the jelly tide
//         wobbling up from the left after him.
//   jump  leaping between two shelves, a jelly on each, rising and landing.
//
// Everything stops under reduced motion and the cat holds the pose.

import { useEffect, useState } from 'react'
import PixelEren from '@/components/games/PixelEren'
import { JELLIES } from '@/lib/jellies'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { M, TINT } from '@/components/meadow'

/** How often the runner swaps legs. Fast enough to read as a sprint. */
const STEP_MS = 160
const CAT = 44

export default function GameScene({ game }: { game: 'run' | 'jump' }) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(false)
  useEffect(() => {
    if (game !== 'run' || reduced) return
    const t = setInterval(() => setStep(s => !s), STEP_MS)
    return () => clearInterval(t)
  }, [game, reduced])
  const move = (name: string, dur: string, delay = '0s') => (reduced ? undefined : `${name} ${dur} ease-in-out ${delay} infinite`)

  return (
    <span aria-hidden className="relative block overflow-hidden" style={{
      height: 84, borderRadius: 16, background: game === 'run' ? TINT.love : TINT.lilac,
    }}>
      {game === 'run' ? (
        <>
          {/* The floor he runs along. */}
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, background: 'rgba(255,255,255,0.7)' }} />
          {/* The jelly tide, coming up from the left. */}
          {[0, 1, 2].map(i => (
            <img key={i} src={JELLIES[[0, 4, 0][i]].art} alt="" draggable={false} style={{
              position: 'absolute', left: -12 + i * 18, bottom: 4 + (i === 1 ? 10 : 0), width: 34, height: 34,
              objectFit: 'contain', transform: `rotate(${[-12, 6, -4][i]}deg)`,
              animation: move('gsTide', '1.4s', `${i * 0.2}s`),
            }} />
          ))}
          {/* Speed lines behind him. */}
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              position: 'absolute', left: '44%', top: 30 + i * 9, width: 14 - i * 3, height: 3, borderRadius: 2,
              background: M.love, opacity: 0.9,
              animation: move('gsSpeed', '0.5s', `${i * 0.12}s`),
            }} />
          ))}
          <span style={{ position: 'absolute', left: '60%', bottom: 10, lineHeight: 0, animation: move('gsBob', '0.32s') }}>
            <PixelEren pose="run" size={CAT} step={step} />
          </span>
        </>
      ) : (
        <>
          {/* Two shelves, a jelly on each. */}
          {[{ l: '8%', b: 14, j: 2 }, { l: '56%', b: 44, j: 3 }].map((s, i) => (
            <span key={i} style={{ position: 'absolute', left: s.l, bottom: s.b, width: '36%' }}>
              <img src={JELLIES[s.j].art} alt="" draggable={false} style={{
                display: 'block', width: 26, height: 26, margin: '0 auto -2px', objectFit: 'contain',
                animation: move('parlourJiggle', '2.6s', `${i * 0.4}s`),
              }} />
              <span style={{ display: 'block', height: 6, borderRadius: 3, background: '#FFFFFF' }} />
            </span>
          ))}
          <span style={{ position: 'absolute', left: 'calc(50% - 22px)', bottom: 12, lineHeight: 0, animation: move('gsLeap', '1.3s') }}>
            <PixelEren pose="leap" size={CAT} />
          </span>
        </>
      )}

      {/* A plain <style>: these names come from inline styles, which only
          reach global keyframes. */}
      <style>{`
        @keyframes gsTide {
          0%, 100% { transform: translate(0, 0) rotate(-6deg); }
          50%      { transform: translate(5px, -3px) rotate(4deg); }
        }
        @keyframes gsSpeed {
          0%   { transform: translateX(6px); opacity: 0; }
          40%  { opacity: 0.9; }
          100% { transform: translateX(-14px); opacity: 0; }
        }
        @keyframes gsBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        @keyframes gsLeap {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50%      { transform: translateY(-16px) rotate(4deg); }
        }
      `}</style>
    </span>
  )
}
