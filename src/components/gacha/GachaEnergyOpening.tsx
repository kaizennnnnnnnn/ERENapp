'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GachaRarity } from '@/types'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// ─── GachaEnergyOpening ───────────────────────────────────────────────────────
// The FoodSuits machine's opening cinematic, built in CSS instead of a video so
// the energy can be tinted by the pulled rarity. Sequence:
//   shine  — a micro glint sweeps the keyhole while the roll resolves (rarity
//            still unknown, so it stays a neutral gold-white) on a dim machine
//   charge — the machine dims further as the rarity colour gathers, a vortex
//            spins up and sparks implode into the keyhole (anticipation)
//   burst  — the keyhole detonates: a core flash, shockwave rings, god-rays,
//            lightning, shard shrapnel and sparks explode outward with a shake
//   fade   — the bloom dissolves into the item reveal
// rarity arrives mid-shine; the sequence waits for it (and a minimum shine
// time) before charging, so a slow roll never cuts the drama short.
// Respects prefers-reduced-motion: drops the strobe/whiteout/shake for a calm
// bloom so the burst is never a photosensitivity hazard.

type Phase = 'shine' | 'charge' | 'burst' | 'fade'

interface Pal { core: string; mid: string; deep: string; g: string; spark: string }

// `g` is an "r,g,b" triplet so keyframes can build rgba(var(--g), <alpha>).
const PALS: Record<GachaRarity, Pal> = {
  common:    { core: '#f4f7fb', mid: '#aab6c6', deep: '#5b6573', g: '170,182,198', spark: '#eef2f8' },
  rare:      { core: '#d6ecff', mid: '#2e8bff', deep: '#0b39a8', g: '46,139,255',  spark: '#9fd0ff' },
  epic:      { core: '#eed6ff', mid: '#a64dff', deep: '#5512b8', g: '166,77,255',  spark: '#d6a8ff' },
  legendary: { core: '#fff2c2', mid: '#ffba1f', deep: '#a86c04', g: '255,186,31',  spark: '#ffe49a' },
}
// Neutral gold-white while the rarity is still unknown (the shine phase).
const SHINE_PAL: Pal = { core: '#fff8e8', mid: '#ffe6a8', deep: '#b98a3c', g: '255,228,150', spark: '#fff2c8' }

const MIN_SHINE = 760, CHARGE_MS = 740, BURST_MS = 520, FADE_MS = 460

interface Props {
  /** Highest rarity in the batch. null while the roll is still resolving. */
  rarity: GachaRarity | null
  onDone: () => void
  machineSrc?: string
  /** Slow the whole sequence (for screenshotting frames). 1 = normal. */
  speed?: number
  /** Hold a single phase open for screenshots; disables auto-advance. */
  freeze?: Phase
}

interface Particle { tx: number; ty: number; delay: number; scale: number }
function makeParticles(n: number, min: number, span: number): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6
    const d = min + Math.random() * span
    return { tx: Math.cos(a) * d, ty: Math.sin(a) * d, delay: Math.random() * 0.14, scale: 0.5 + Math.random() * 1 }
  })
}

const RAYS = Array.from({ length: 14 }, (_, i) => i * (360 / 14))
const BOLTS = [14, 62, 128, 196, 248, 312]
// Lock shards — the keyhole bursting open. Angle + travel distance per shard.
const SHARDS = Array.from({ length: 8 }, (_, i) => ({ ang: i * (360 / 8) + (i % 2 ? 13 : -9), d: 66 + (i % 3) * 30 }))

export default function GachaEnergyOpening({
  rarity, onDone, machineSrc = '/gacha_foodsuits.png?v=2', speed = 1, freeze,
}: Props) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(freeze ?? 'shine')
  const [scale, setScale] = useState(1)
  const mountRef = useRef(0)
  const startedRef = useRef(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  // Keep the focal effects proportional across phone sizes.
  useEffect(() => {
    mountRef.current = performance.now()
    const measure = () => setScale(Math.min(1.12, Math.max(0.72, window.innerWidth / 430)))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Run the charge → burst → fade → done chain once the rarity is known.
  useEffect(() => {
    if (freeze || rarity == null || startedRef.current) return
    startedRef.current = true
    const charge = CHARGE_MS * speed, burst = BURST_MS * speed, fade = FADE_MS * speed
    const elapsed = performance.now() - mountRef.current
    const shineWait = Math.max(0, MIN_SHINE * speed - elapsed)
    const timers: number[] = []
    timers.push(window.setTimeout(() => {
      playSound('gift_open')
      setPhase('charge')
      timers.push(window.setTimeout(() => { setPhase('burst'); playSound(`gacha_reveal_${rarity}`) }, charge))
      timers.push(window.setTimeout(() => setPhase('fade'), charge + burst))
      timers.push(window.setTimeout(() => doneRef.current(), charge + burst + fade))
    }, shineWait))
    return () => timers.forEach(clearTimeout)
  }, [rarity, speed, freeze])

  const pal = rarity ? PALS[rarity] : SHINE_PAL
  const converge = useMemo(() => makeParticles(30, 110, 240), [])
  const explode  = useMemo(() => makeParticles(36, 90, 330), [])

  const charged = phase === 'charge' || phase === 'burst' || phase === 'fade'
  const bursting = phase === 'burst' || phase === 'fade'
  const calm = reduced // reduced-motion → drop the strobe/whiteout/shake

  const rootVars = {
    '--core': pal.core, '--mid': pal.mid, '--deep': pal.deep, '--g': pal.g, '--spark': pal.spark,
  } as React.CSSProperties

  return (
    <div className="eo-root fixed inset-0 z-[80] overflow-hidden" style={{ background: '#040208', ...rootVars }}
      onClick={() => doneRef.current()}>
      <div className={`eo-shake absolute inset-0 ${bursting && !calm ? 'eo-shaking' : ''}`}>

        {/* Machine backdrop — dim, then lit by the energy. Desaturated at the
            burst so cool blue/purple energy reads against the warm machine. */}
        <div className="eo-machine absolute inset-0" style={{
          backgroundImage: `url(${machineSrc})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: bursting ? 'brightness(1.0) saturate(0.7)' : phase === 'charge' ? 'brightness(0.42)' : 'brightness(0.55)',
        }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 46%, transparent 30%, rgba(4,2,8,0.86) 100%)' }} />

        {/* Rarity colour flood from the keyhole */}
        <div className="eo-flood absolute inset-0" style={{ opacity: bursting ? 0.95 : charged ? 0.62 : 0 }} />

        {/* Focal stack, centred on the keyhole, scaled to the viewport */}
        <div className="absolute" style={{ left: '50%', top: '46%', transform: `translate(-50%,-50%) scale(${scale})`, width: 0, height: 0 }}>

          {/* Gathering bloom — energy drawn into the keyhole during the charge */}
          {phase === 'charge' && <div className="eo-gather" />}

          {/* Spinning energy vortex (charge onward) */}
          {charged && <div className="eo-vortex" />}

          {/* Lightning cracks (dropped under reduced-motion — it strobes) */}
          {charged && !calm && BOLTS.map((deg, i) => (
            <div key={i} className="eo-bolt" style={{ transform: `rotate(${deg}deg)`, animationDelay: `${(i % 3) * 0.07}s` }} />
          ))}

          {/* Converging sparks (charge implosion) */}
          {phase === 'charge' && converge.map((p, i) => (
            <span key={i} className="eo-spark eo-converge" style={{
              '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, animationDelay: `${p.delay}s`, transform: `scale(${p.scale})`,
            } as React.CSSProperties} />
          ))}

          {/* God-rays + shockwave rings + flash + shards + sparks (burst) */}
          {bursting && <>
            <div className="eo-rays">
              {RAYS.map((deg, i) => <span key={i} style={{ transform: `rotate(${deg}deg)` }} />)}
            </div>
            <div className="eo-ring" style={{ animationDelay: '0s' }} />
            <div className="eo-ring" style={{ animationDelay: '0.08s' }} />
            <div className="eo-ring eo-ring-core" style={{ animationDelay: '0.16s' }} />
            <div className="eo-flash" />
            {SHARDS.map((s, i) => (
              <span key={i} className="eo-shard" style={{ '--ang': `${s.ang}deg`, '--d': `${s.d}px` } as React.CSSProperties} />
            ))}
            {explode.map((p, i) => (
              <span key={i} className="eo-spark eo-explode" style={{
                '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, animationDelay: `${p.delay}s`,
              } as React.CSSProperties} />
            ))}
          </>}

          {/* Keyhole — the lock that charges, then detonates as the core */}
          <div className={`eo-keyhole ${charged ? 'eo-key-charged' : ''}`}>
            <svg viewBox="0 0 40 54" width="56" height="76" aria-hidden>
              <path d="M20 4a13 13 0 0 0-5.4 24.8L11 47.5a2.4 2.4 0 0 0 2.3 3.1h13.4a2.4 2.4 0 0 0 2.3-3.1l-3.6-18.7A13 13 0 0 0 20 4z" />
            </svg>
            {/* micro shine sweep across the keyhole */}
            {!charged && <span className="eo-sweep" />}
          </div>
        </div>

        {/* Burst-peak full-frame flash (dropped under reduced-motion) */}
        {bursting && !calm && <div className="eo-whiteout" />}
      </div>

      <span className="eo-hint absolute font-pixel" style={{ left: 0, right: 0, bottom: 'calc(var(--safe-bottom) + 16px)', textAlign: 'center', fontSize: 6, color: 'rgba(255,255,255,0.35)' }}>TAP TO SKIP</span>

      <style jsx>{`
        .eo-root { -webkit-tap-highlight-color: transparent; }

        /* ── machine + flood ── */
        .eo-machine { transition: filter 0.45s ease-out; }
        .eo-flood {
          transition: opacity 0.4s ease-out;
          background:
            radial-gradient(circle at 50% 46%, rgba(var(--g),0.95) 0%, rgba(var(--g),0.5) 26%, rgba(var(--g),0.16) 50%, transparent 72%),
            radial-gradient(circle at 50% 46%, var(--core) 0%, transparent 13%);
          mix-blend-mode: screen;
        }

        /* ── gathering bloom ── */
        .eo-gather {
          position: absolute; left: 0; top: 0; width: 420px; height: 420px; margin: -210px 0 0 -210px;
          border-radius: 50%; mix-blend-mode: screen;
          background: radial-gradient(circle, rgba(var(--g),0.9) 0%, rgba(var(--g),0.4) 32%, transparent 64%);
          animation: eoGather 0.74s ease-in both;
        }
        @keyframes eoGather {
          0% { opacity: 0; transform: scale(1.5); }
          55% { opacity: 0.9; transform: scale(1); }
          100% { opacity: 1; transform: scale(0.32); }
        }

        /* ── vortex (rarity-tinted spokes, white only at the hot edge) ── */
        .eo-vortex {
          position: absolute; left: 0; top: 0; width: 500px; height: 500px;
          margin: -250px 0 0 -250px; border-radius: 50%;
          background: conic-gradient(from 0deg,
            transparent 0deg, rgba(var(--g),0.9) 36deg, var(--core) 50deg, rgba(var(--g),0.9) 64deg, transparent 110deg,
            rgba(var(--g),0.75) 156deg, var(--core) 170deg, rgba(var(--g),0.75) 184deg, transparent 230deg,
            rgba(var(--g),0.9) 276deg, var(--core) 290deg, rgba(var(--g),0.9) 304deg, transparent 350deg, transparent 360deg);
          mix-blend-mode: screen; filter: blur(1px);
          animation: eoVortex 0.85s linear infinite, eoVortexGrow 0.7s ease-out both;
          will-change: transform;
        }
        @keyframes eoVortex { to { transform: rotate(360deg); } }
        @keyframes eoVortexGrow { from { opacity: 0; transform: scale(0.4); } to { opacity: 0.95; transform: scale(1); } }

        /* ── lightning ── */
        .eo-bolt {
          position: absolute; left: -3px; top: 0; width: 6px; height: 210px;
          margin-top: -208px; transform-origin: 50% 100%;
          background: linear-gradient(0deg, rgba(var(--g),0) 0%, var(--mid) 50%, var(--core) 80%, #fff 96%);
          clip-path: polygon(40% 100%, 60% 100%, 52% 64%, 70% 60%, 46% 30%, 64% 26%, 50% 0, 30% 30%, 50% 34%, 32% 62%, 48% 64%);
          filter: drop-shadow(0 0 5px var(--mid)) drop-shadow(0 0 2px var(--core));
          opacity: 0; animation: eoBolt 0.42s steps(2,end) infinite;
        }
        .eo-shaking .eo-bolt { animation-duration: 0.2s; height: 280px; margin-top: -278px; }
        @keyframes eoBolt { 0%,100% { opacity: 0; } 30% { opacity: 0.95; } 60% { opacity: 0.35; } }

        /* ── keyhole ── */
        .eo-keyhole { position: absolute; left: -28px; top: -38px; width: 56px; height: 76px; }
        .eo-keyhole svg { display: block; }
        .eo-keyhole path { fill: var(--core); filter: drop-shadow(0 0 8px rgba(var(--g),0.95)) drop-shadow(0 0 18px rgba(var(--g),0.6)); }
        .eo-keyhole { animation: eoKeyPulse 1.1s ease-in-out infinite; }
        .eo-key-charged { animation: eoKeyCharge 0.74s ease-in both; }
        @keyframes eoKeyPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
        @keyframes eoKeyCharge {
          0% { transform: scale(1) rotate(0deg); }
          70% { transform: scale(0.5) rotate(-14deg); filter: brightness(1.6); }
          100% { transform: scale(1.5) rotate(0deg); filter: brightness(3); opacity: 0.9; }
        }
        .eo-sweep {
          position: absolute; left: -40%; top: -10%; width: 60%; height: 120%;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.95) 50%, transparent 70%);
          transform: skewX(-18deg); animation: eoSweep 1.3s ease-in-out infinite; mix-blend-mode: screen;
        }
        @keyframes eoSweep { 0% { left: -60%; } 55%,100% { left: 120%; } }

        /* ── converging / exploding sparks ── */
        .eo-spark {
          position: absolute; left: -3px; top: -3px; width: 6px; height: 6px; border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, var(--spark) 45%, rgba(var(--g),0) 100%);
          box-shadow: 0 0 6px 1px rgba(var(--g),0.9);
        }
        .eo-converge { animation: eoConverge 0.5s ease-in forwards; }
        @keyframes eoConverge {
          0% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(0,0) scale(0.2); opacity: 0; }
        }
        .eo-explode { animation: eoExplode 0.62s cubic-bezier(0.12,0.7,0.3,1) forwards; }
        @keyframes eoExplode {
          0% { transform: translate(0,0) scale(0.3); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(var(--tx), calc(var(--ty) + 46px)) scale(0.5); opacity: 0; }
        }

        /* ── lock shards (the keyhole bursting open) ── */
        .eo-shard {
          position: absolute; left: -2px; top: -7px; width: 4px; height: 14px; border-radius: 1px;
          background: linear-gradient(180deg, #fff 0%, var(--core) 45%, var(--mid) 100%);
          box-shadow: 0 0 6px rgba(var(--g),0.9);
          animation: eoShard 0.52s cubic-bezier(0.15,0.7,0.3,1) forwards;
        }
        @keyframes eoShard {
          0% { opacity: 0; transform: rotate(var(--ang)) translateY(0) scale(0.4); }
          22% { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--ang)) translateY(calc(var(--d) * -1)) scale(1); }
        }

        /* ── shockwave rings (rarity-tinted bodies) ── */
        .eo-ring {
          position: absolute; left: 0; top: 0; width: 60px; height: 60px; margin: -30px 0 0 -30px;
          border-radius: 50%; border: 4px solid var(--mid);
          box-shadow: 0 0 24px 3px rgba(var(--g),0.95), 0 0 8px var(--core), inset 0 0 16px rgba(var(--g),0.85);
          animation: eoRing 0.62s cubic-bezier(0.1,0.7,0.25,1) forwards;
        }
        .eo-ring-core { border-width: 5px; border-color: var(--core); }
        @keyframes eoRing {
          0% { transform: scale(0.1); opacity: 1; }
          70% { opacity: 0.9; }
          100% { transform: scale(12); opacity: 0; }
        }

        /* ── god rays (coloured for most of their length, white only at root) ── */
        .eo-rays { position: absolute; left: 0; top: 0; animation: eoRaysSpin 0.95s ease-out both; }
        .eo-rays span {
          position: absolute; left: -4px; top: 0; width: 8px; height: 420px;
          margin-top: -420px; transform-origin: 50% 100%;
          background: linear-gradient(0deg, #fff 0%, var(--core) 8%, var(--mid) 30%, var(--deep) 62%, rgba(var(--g),0.25) 85%, transparent 100%);
          filter: blur(0.6px) drop-shadow(0 0 7px rgba(var(--g),0.85));
        }
        @keyframes eoRaysSpin {
          0% { opacity: 0; transform: scale(0.15) rotate(-22deg); }
          22% { opacity: 1; } 52% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.3) rotate(12deg); }
        }

        /* ── core flash (slim white core, rarity owns the body) ── */
        .eo-flash {
          position: absolute; left: 0; top: 0; width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, #fff 8%, var(--core) 22%, var(--mid) 46%, rgba(var(--g),0.7) 68%, transparent 82%);
          animation: eoFlash 0.55s ease-out forwards;
        }
        @keyframes eoFlash { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(7); opacity: 0; } }

        /* ── whole-frame flash at the peak — tinted, capped opacity ── */
        .eo-whiteout {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 46%, #fff 0%, var(--core) 32%, var(--mid) 72%, rgba(var(--g),0.7) 100%);
          animation: eoWhiteout 0.42s ease-out forwards;
        }
        @keyframes eoWhiteout { 0% { opacity: 0; } 9% { opacity: 0.7; } 26% { opacity: 0; } 100% { opacity: 0; } }

        /* ── screen shake (trimmed amplitude) ── */
        .eo-shaking { animation: eoShake 0.4s cubic-bezier(0.36,0.07,0.19,0.97) both; }
        @keyframes eoShake {
          0%,100% { transform: translate(0,0); }
          15% { transform: translate(-5px,3px); } 35% { transform: translate(5px,-4px); }
          55% { transform: translate(-4px,-3px); } 75% { transform: translate(4px,3px); }
        }

        .eo-hint { animation: eoHint 1.4s ease-in-out infinite; }
        @keyframes eoHint { 0%,100% { opacity: 0.25; } 50% { opacity: 0.55; } }
      `}</style>
    </div>
  )
}
