'use client'

// ═══════════════════════════════════════════════════════════════════════════
// EREN REACT — the shared "nice one" / "oh no" reaction, wrapped around any of
// the arcade's Erens.
//
// Every game already had its OWN idea of a good-thing face (cheer, hyped,
// streak) and a bad-thing face (fail, worried, wobble), all drawn differently.
// Those stay — they're the sprite's expression. What was missing was the part
// that reads the same in every game: the little hop and sparkle when you do
// well, and the flinch and sweat-drop when you don't.
//
// Doing it as a WRAPPER rather than per-sprite artwork is the whole point. It
// works identically on a head-only chibi, a DJ in headphones and a full-body
// pixel cat, so a game gets the reaction by wrapping whatever Eren it already
// draws — no sprite has to be redrawn, and none of them can drift apart.
//
// Keyframes live in globals.css (erenGoodHop / erenBadShudder / erenSparkUp /
// erenSweatFly) because this component is shared and can't rely on any one
// game's <style jsx>.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export type ErenReactKind = 'none' | 'good' | 'bad'

export interface ErenReactState {
  kind: ErenReactKind
  key: number   // bumped every fire, so the same reaction twice replays
}

const HOLD_GOOD = 720
const HOLD_BAD  = 620

/** Fire-and-forget reactions. `good()` on something that went well for the
 *  player, `bad()` on something that didn't; both clear themselves.
 *
 *  Re-firing mid-reaction restarts it rather than being swallowed — a player on
 *  a hot streak should get a hop per hit, not one hop and then nothing. */
export function useErenReaction() {
  const [reaction, setReaction] = useState<ErenReactState>({ kind: 'none', key: 0 })
  const keyRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fire = useCallback((kind: Exclude<ErenReactKind, 'none'>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    keyRef.current += 1
    setReaction({ kind, key: keyRef.current })
    timerRef.current = setTimeout(
      () => setReaction(r => ({ kind: 'none', key: r.key })),
      kind === 'good' ? HOLD_GOOD : HOLD_BAD,
    )
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const good = useCallback(() => fire('good'), [fire])
  const bad  = useCallback(() => fire('bad'),  [fire])
  return { reaction, good, bad }
}

// Sparkles thrown up and out on a good thing. Fixed directions so they don't
// reshuffle on every render.
const SPARKS = [
  { dx: -13, dy: -20, d: 0,   cross: true },
  { dx: 0,   dy: -26, d: 60,  cross: true },
  { dx: 14,  dy: -19, d: 30,  cross: true },
  { dx: -20, dy: -9,  d: 110, cross: false },
  { dx: 20,  dy: -7,  d: 90,  cross: false },
]

// Two sweat drops flicked off the head on a bad thing.
const SWEAT = [
  { x: '76%', dx: 13, dy: -15, d: 0 },
  { x: '18%', dx: -12, dy: -12, d: 90 },
]

interface Props {
  reaction: ErenReactState
  children: React.ReactNode
  /** Scales the particle throw to the sprite. Pass the Eren's rendered size. */
  size?: number
  /** Anchor for the hop. Sprites that stand on something want 'bottom'. */
  origin?: 'bottom' | 'center'
}

export default function ErenReact({ reaction, children, size = 40, origin = 'bottom' }: Props) {
  const reduced = useReducedMotion()
  const { kind, key } = reaction
  const scale = size / 40
  const active = kind !== 'none' && !reduced

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {/* The sprite itself hops or flinches. Keyed so firing the same reaction
          twice in a row replays it instead of sitting at the end state. */}
      <span key={`rx-${key}`} style={{
        display: 'inline-block',
        transformOrigin: origin === 'bottom' ? 'center bottom' : 'center center',
        animation: !active ? undefined
          : kind === 'good' ? 'erenGoodHop 0.6s cubic-bezier(0.34,1.5,0.64,1)'
          : 'erenBadShudder 0.5s ease-out',
      }}>
        {children}
      </span>

      {/* Particle layer — pointer-events-none and out of flow, so wrapping a
          sprite in this can never change what the player can tap. */}
      {active && kind === 'good' && SPARKS.map((s, i) => (
        <span key={`g${key}-${i}`} aria-hidden style={{
          position: 'absolute', left: '50%', top: '12%',
          width: s.cross ? 5 * scale : 3 * scale,
          height: s.cross ? 5 * scale : 3 * scale,
          pointerEvents: 'none',
          background: s.cross
            // a 4-point pixel sparkle: two bars crossed, no border-radius
            ? `linear-gradient(to right, transparent 40%, #FFF8D6 40%, #FFF8D6 60%, transparent 60%),
               linear-gradient(to bottom, transparent 40%, #FDE68A 40%, #FDE68A 60%, transparent 60%)`
            : '#FFFFFF',
          borderRadius: s.cross ? 0 : '50%',
          filter: 'drop-shadow(0 0 4px rgba(253,230,138,0.9))',
          ['--rdx' as string]: `${s.dx * scale}px`,
          ['--rdy' as string]: `${s.dy * scale}px`,
          animation: `erenSparkUp 0.62s ease-out ${s.d}ms both`,
        } as React.CSSProperties} />
      ))}

      {active && kind === 'bad' && SWEAT.map((s, i) => (
        <span key={`b${key}-${i}`} aria-hidden style={{
          position: 'absolute', left: s.x, top: '6%',
          width: 4 * scale, height: 5 * scale,
          pointerEvents: 'none',
          background: 'linear-gradient(180deg, #DBF1FF, #7FC4F0)',
          borderRadius: '50% 50% 50% 50% / 65% 65% 35% 35%',
          boxShadow: '0 0 3px rgba(127,196,240,0.8)',
          ['--rdx' as string]: `${s.dx * scale}px`,
          ['--rdy' as string]: `${s.dy * scale}px`,
          animation: `erenSweatFly 0.5s ease-out ${s.d}ms both`,
        } as React.CSSProperties} />
      ))}
    </span>
  )
}
