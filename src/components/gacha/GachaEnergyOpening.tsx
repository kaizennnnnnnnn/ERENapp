'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GachaRarity } from '@/types'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// ─── GachaEnergyOpening ───────────────────────────────────────────────────────
// The FoodSuits machine's opening cinematic, built in CSS/SVG instead of a video
// so the energy can be tinted by the pulled rarity. Sequence:
//   shine  — a real brushed-metal lock catches a sweeping glint while the roll
//            resolves (rarity unknown → neutral gold-white) on a dim machine
//   charge — the machine dims, the rarity colour gathers into a vortex and
//            sparks implode while the lock strains (anticipation)
//   burst  — the lock detonates: a turbulent plasma fireball (SVG feTurbulence),
//            shockwave rings, volumetric god-rays, lightning, shard shrapnel,
//            gravity-arcing embers, rising smoke and a lingering afterglow
//   fade   — the afterglow dissolves into the item reveal
// Perf notes (mobile): the turbulence filter is STATIC (baked) — only
// transform/opacity animate over it, so Perlin never re-runs per frame; no
// backdrop-filter (flattened context kills it silently on iOS); particles carry
// no per-node box-shadow (one shared bloom instead). Respects
// prefers-reduced-motion: drops the strobe/whiteout/shake/shrapnel for a calm
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

const MIN_SHINE = 760, CHARGE_MS = 740, BURST_MS = 540, FADE_MS = 520

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

interface Ember { tx: number; ty: number; rot: number; delay: number; size: number }
function makeEmbers(n: number): Ember[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.7
    const d = 96 + Math.random() * 300
    return {
      tx: Math.cos(a) * d, ty: Math.sin(a) * d,
      rot: (a * 180) / Math.PI + 90, // align the streak with its outward launch
      delay: Math.random() * 0.12, size: 2.5 + Math.random() * 3.5,
    }
  })
}
interface Spark { tx: number; ty: number; delay: number; scale: number }
function makeSparks(n: number): Spark[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6
    const d = 110 + Math.random() * 230
    return { tx: Math.cos(a) * d, ty: Math.sin(a) * d, delay: Math.random() * 0.14, scale: 0.5 + Math.random() * 1 }
  })
}

const RAYS = [0, 28, 58, 92, 128, 156, 184, 214, 250, 282, 312, 338] // uneven → volumetric, not a clock
const RAY_W = [9, 5, 11, 6, 8, 5, 10, 6, 9, 5, 11, 7]
const BOLTS = [14, 62, 128, 196, 248, 312]
const SHARDS = Array.from({ length: 8 }, (_, i) => ({ ang: i * (360 / 8) + (i % 2 ? 13 : -9), d: 66 + (i % 3) * 30 }))
const WISPS = Array.from({ length: 5 }, (_, i) => {
  const a = (i / 5) * Math.PI * 2 + 0.5
  return { wx: Math.cos(a) * 78, wy: Math.sin(a) * 64 - 34, delay: i * 0.035 } // drift out and up
})

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
  const converge = useMemo(() => makeSparks(28), [])
  const embers = useMemo(() => makeEmbers(16), [])

  const charged = phase === 'charge' || phase === 'burst' || phase === 'fade'
  const bursting = phase === 'burst' || phase === 'fade'
  const calm = reduced // reduced-motion → drop the strobe/whiteout/shake/shrapnel

  // A real blast is mostly DARK with a hot core. Gold energy over the warm gold
  // machine washes flat, so warm rarities get a much darker field (and a tighter
  // flood) for the white-hot core + rays to read against; cool rarities can keep
  // the machine brighter since they already contrast it.
  const warm = rarity === 'legendary'
  const machineFilter = bursting
    ? (warm ? 'brightness(0.5) saturate(0.95)' : 'brightness(0.82) saturate(0.62)')
    : phase === 'charge' ? 'brightness(0.4)' : 'brightness(0.5)'
  const floodOpacity = bursting ? (warm ? 0.62 : 0.9) : charged ? 0.58 : 0

  const rootVars = {
    '--core': pal.core, '--mid': pal.mid, '--deep': pal.deep, '--g': pal.g, '--spark': pal.spark,
  } as React.CSSProperties

  return (
    <div className="eo-root fixed inset-0 z-[80] overflow-hidden" style={{ background: '#040208', ...rootVars }}
      onClick={() => doneRef.current()}>

      {/* Static turbulence filter — baked: only transform/opacity animate over it
          so Perlin never re-runs per frame (mobile-safe). The noise MODULATES the
          core's luminance (bright cores + dark veins/filaments), then a small
          displacement breaks the edge — so it reads as roiling plasma, not a
          smooth disc. */}
      <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
        <defs>
          <filter id="eoPlasma" x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.058" numOctaves={3} seed={7} result="noise" />
            {/* noise → high-contrast grayscale so the veins read hard */}
            <feColorMatrix in="noise" type="saturate" values="0" result="gray" />
            <feComponentTransfer in="gray" result="bands">
              <feFuncR type="gamma" amplitude="1.6" exponent="2.4" offset="-0.1" />
              <feFuncG type="gamma" amplitude="1.6" exponent="2.4" offset="-0.1" />
              <feFuncB type="gamma" amplitude="1.6" exponent="2.4" offset="-0.1" />
            </feComponentTransfer>
            {/* gradient × noise → hot cores where noise is high, dark veins where low */}
            <feComposite in="SourceGraphic" in2="bands" operator="arithmetic" k1="1.5" k2="0.18" k3="0" k4="0" result="fire" />
            <feDisplacementMap in="fire" in2="noise" scale={9} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div className={`eo-shake absolute inset-0 ${bursting && !calm ? 'eo-shaking' : ''}`}>

        {/* Machine backdrop — dim, then lit by the energy. Desaturated at the
            burst so cool blue/purple energy reads against the warm machine. */}
        <div className="eo-machine absolute inset-0" style={{
          backgroundImage: `url(${machineSrc})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: machineFilter,
        }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 46%, transparent 26%, rgba(4,2,8,0.9) 100%)',
          // deepen the dark surround at the burst so the hot core has a field to pop against
          opacity: bursting ? 1 : 0.9,
        }} />

        {/* Rarity colour flood — screen-blended over the lit machine */}
        <div className="eo-flood absolute inset-0" style={{ opacity: floodOpacity }} />

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

          {/* God-rays + rings + plasma core + shards + embers (burst) */}
          {bursting && <>
            <div className="eo-afterglow" />
            <div className="eo-rays">
              {RAYS.map((deg, i) => <span key={i} style={{ transform: `rotate(${deg}deg)`, width: RAY_W[i] }} />)}
            </div>
            {!calm && <>
              <div className="eo-ring" style={{ animationDelay: '0s' }} />
              <div className="eo-ring" style={{ animationDelay: '0.08s' }} />
            </>}
            <div className="eo-ring eo-ring-core" style={{ animationDelay: '0.14s' }} />
            <div className="eo-plasma" />
            {!calm && SHARDS.map((s, i) => (
              <span key={i} className="eo-shard" style={{ '--ang': `${s.ang}deg`, '--d': `${s.d}px` } as React.CSSProperties} />
            ))}
            {!calm && <>
              <div className="eo-emberglow" />
              {embers.map((e, i) => (
                <span key={i} className="eo-ember" style={{
                  '--tx': `${e.tx}px`, '--ty': `${e.ty}px`, animationDelay: `${e.delay}s`,
                } as React.CSSProperties}>
                  <i style={{ transform: `rotate(${e.rot}deg)`, width: e.size, height: e.size * 4.5 }} />
                </span>
              ))}
              {/* dark smoke rising over the cooling core — drawn last (on top) */}
              {WISPS.map((w, i) => (
                <span key={`w${i}`} className="eo-wisp" style={{ '--wx': `${w.wx}px`, '--wy': `${w.wy}px`, animationDelay: `${0.16 + w.delay}s` } as React.CSSProperties} />
              ))}
            </>}
          </>}

          {/* Keyhole — a real brushed-steel lock plate. Layered so the glint can
              only flash the polished metal, never light the recessed hole:
              plate → brushed finish → glint sweep → dark hole on top → stir. */}
          <div className={`eo-lock ${charged ? 'eo-key-charged' : ''}`}>
            {/* flat plate lit from the top edge (not a domed sphere) + rim bevel */}
            <svg viewBox="0 0 64 64" width="68" height="68" aria-hidden className="eo-lock-plate">
              <defs>
                <linearGradient id="eoPlate" x1="0.12" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#eef2f7" />
                  <stop offset="34%" stopColor="#b6c0cd" />
                  <stop offset="68%" stopColor="#818c9b" />
                  <stop offset="100%" stopColor="#49525f" />
                </linearGradient>
                <radialGradient id="eoSpec" cx="46%" cy="18%" r="62%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
                <radialGradient id="eoVig" cx="50%" cy="46%" r="54%">
                  <stop offset="64%" stopColor="rgba(0,0,0,0)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.42)" />
                </radialGradient>
                <linearGradient id="eoRim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="46%" stopColor="rgba(150,160,172,0.18)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="30" fill="url(#eoPlate)" />
              {/* elongated raking highlight across the top — flat metal, not a ball */}
              <ellipse cx="30" cy="16" rx="21" ry="8" fill="url(#eoSpec)" />
              <circle cx="32" cy="32" r="30" fill="url(#eoVig)" />
              <circle cx="32" cy="32" r="30" fill="none" stroke="url(#eoRim)" strokeWidth="2.4" />
            </svg>
            {/* spun brushed-metal finish */}
            <span className="eo-brush" />
            {/* specular glint sweeping the polish (the micro shine) */}
            <span className="eo-glint"><span /></span>
            {/* recessed hole drawn ON TOP of the glint so its inside stays dark */}
            <svg viewBox="0 0 64 64" width="68" height="68" aria-hidden className="eo-lock-cap">
              <defs>
                <radialGradient id="eoHole" cx="50%" cy="30%" r="82%">
                  <stop offset="0%" stopColor="#0b0d11" />
                  <stop offset="42%" stopColor="#050608" />
                  <stop offset="100%" stopColor="#000000" />
                </radialGradient>
              </defs>
              {/* dark recess with an AO edge cut into the plate */}
              <path fill="url(#eoHole)" stroke="rgba(0,0,0,0.55)" strokeWidth="1.5"
                d="M32 17a8.4 8.4 0 0 0-3.7 15.9L26 46a2.1 2.1 0 0 0 2 2.5h8a2.1 2.1 0 0 0 2-2.5l-2.3-13.1A8.4 8.4 0 0 0 32 17z" />
              {/* bright bevel on the light-facing top rim, lip catch below */}
              <path d="M25.6 22.6a8.4 8.4 0 0 1 12.8 0" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9" strokeLinecap="round" />
              <path d="M28.7 45h6.6" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" strokeLinecap="round" />
              {/* two countersunk slotted screws */}
              <circle cx="32" cy="7.6" r="2.3" fill="#20262e" stroke="rgba(0,0,0,0.5)" strokeWidth="0.6" />
              <line x1="30.4" y1="6.7" x2="33.6" y2="8.5" stroke="rgba(0,0,0,0.6)" strokeWidth="0.7" />
              <path d="M30 6.4a2.3 2.3 0 0 1 3.6 0" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
              <circle cx="32" cy="56.4" r="2.3" fill="#20262e" stroke="rgba(0,0,0,0.5)" strokeWidth="0.6" />
              <line x1="30.4" y1="55.5" x2="33.6" y2="57.3" stroke="rgba(0,0,0,0.6)" strokeWidth="0.7" />
              <path d="M30 55.2a2.3 2.3 0 0 1 3.6 0" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
            </svg>
            {/* energy stirring inside the hole (grows into the charge) */}
            <span className="eo-stir" />
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
          filter: drop-shadow(0 0 5px var(--mid));
          opacity: 0; animation: eoBolt 0.42s steps(2,end) infinite;
        }
        .eo-shaking .eo-bolt { animation-duration: 0.2s; height: 280px; margin-top: -278px; }
        @keyframes eoBolt { 0%,100% { opacity: 0; } 30% { opacity: 0.95; } 60% { opacity: 0.35; } }

        /* ── metal lock ── */
        .eo-lock { position: absolute; left: -34px; top: -34px; width: 68px; height: 68px; }
        .eo-lock-plate, .eo-lock-cap { position: absolute; inset: 0; display: block; }
        .eo-lock-plate { filter: drop-shadow(0 3px 5px rgba(0,0,0,0.7)); }
        /* spun brushed finish — faint fine spokes catching the light */
        .eo-brush {
          position: absolute; inset: 3px; border-radius: 50%; pointer-events: none;
          background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.05) 0deg, rgba(255,255,255,0.05) 0.9deg, rgba(0,0,0,0.055) 0.9deg, rgba(0,0,0,0.055) 1.8deg);
          mix-blend-mode: overlay; opacity: 0.8;
        }
        /* a resting lock is reflective metal, not emissive — the rarity glow only
           wells up once it is charging */
        .eo-key-charged { filter: drop-shadow(0 0 10px rgba(var(--g),0.85)) drop-shadow(0 0 22px rgba(var(--g),0.5)); }
        .eo-key-charged { animation: eoKeyCharge 0.74s cubic-bezier(0.5,0,0.75,0) both; }
        @keyframes eoKeyCharge {
          0%   { transform: scale(1) rotate(0deg); opacity: 1; }
          35%  { transform: scale(0.9) rotate(-3deg); opacity: 1; }
          55%  { transform: scale(0.84) rotate(4deg); opacity: 1; }   /* lock straining/rattling */
          78%  { transform: scale(0.78) rotate(-2deg); opacity: 1; }
          /* collapses to a point — consumed as the plasma detonates out of it */
          100% { transform: scale(0.36) rotate(0deg); opacity: 0; }
        }
        /* energy welling up inside the dark cutout */
        .eo-stir {
          position: absolute; left: 50%; top: 56%; width: 17px; height: 22px;
          transform: translate(-50%,-50%); border-radius: 50%; mix-blend-mode: screen;
          background: radial-gradient(ellipse, var(--core) 0%, rgba(var(--g),0.75) 42%, transparent 76%);
          animation: eoStir 2.1s ease-in-out infinite;
        }
        .eo-key-charged .eo-stir { animation: eoStirCharge 0.74s ease-in forwards; }
        @keyframes eoStir {
          0%,100% { opacity: 0.12; transform: translate(-50%,-50%) scale(0.65); }
          50%     { opacity: 0.5;  transform: translate(-50%,-50%) scale(1.05); }
        }
        @keyframes eoStirCharge {
          0%   { opacity: 0.5; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 1;   transform: translate(-50%,-50%) scale(3.2); }
        }
        /* specular highlight clipped to the polished plate, swept with translateX
           (compositor-cheap) with a long off-screen dwell so it flashes like a
           moving reflection. isolation keeps the screen-blend off the backdrop. */
        .eo-glint { position: absolute; inset: 3px; border-radius: 50%; overflow: hidden; pointer-events: none; isolation: isolate; mix-blend-mode: screen; }
        .eo-glint > span {
          position: absolute; top: -22%; left: 0; width: 58%; height: 144%;
          /* a soft, broad polished-metal smear, not a thin glass-glare line */
          background: linear-gradient(100deg, transparent 28%, rgba(255,255,255,0.22) 42%, rgba(255,255,255,0.62) 50%, rgba(255,255,255,0.22) 58%, transparent 72%);
          filter: blur(0.6px);
          transform: translateX(-150%) skewX(-16deg);
          animation: eoGlint 2.8s ease-in-out infinite;
        }
        @keyframes eoGlint { 0% { transform: translateX(-160%) skewX(-16deg); } 36%,100% { transform: translateX(320%) skewX(-16deg); } }
        .eo-key-charged .eo-glint { display: none; }

        /* ── converging sparks (one shared bloom, no per-node glow) ── */
        .eo-spark {
          position: absolute; left: -3px; top: -3px; width: 6px; height: 6px; border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, var(--spark) 45%, rgba(var(--g),0) 100%);
        }
        .eo-converge { animation: eoConverge 0.5s ease-in forwards; }
        @keyframes eoConverge {
          0% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(0,0) scale(0.2); opacity: 0; }
        }

        /* ── embers: gravity arc + motion-blur streak ── */
        .eo-emberglow {
          position: absolute; left: 0; top: 0; width: 260px; height: 260px; margin: -130px 0 0 -130px;
          border-radius: 50%; background: radial-gradient(circle, rgba(var(--g),0.5) 0%, transparent 62%);
          animation: eoEmberGlow 0.6s ease-out forwards;
        }
        @keyframes eoEmberGlow { 0% { opacity: 0; transform: scale(0.3); } 25% { opacity: 0.85; } 100% { opacity: 0; transform: scale(1.2); } }
        .eo-ember {
          position: absolute; left: 0; top: 0;
          animation: eoEmber 0.78s cubic-bezier(0.1,0.6,0.3,1) forwards;
        }
        @keyframes eoEmber {
          0% { transform: translate(0,0); opacity: 0; }
          14% { opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translate(var(--tx), calc(var(--ty) + 80px)); opacity: 0; } /* gravity pulls the arc down */
        }
        .eo-ember > i {
          position: absolute; left: 0; top: 0; transform-origin: 50% 50%; border-radius: 50%;
          margin-left: -1.5px; margin-top: -8px;
          /* dark→coloured→white-hot head so the streak reads against bright fields */
          background: linear-gradient(to top, rgba(10,6,16,0) 0%, var(--mid) 30%, var(--spark) 66%, #fff 100%);
          box-shadow: 0 0 2px rgba(10,6,16,0.5);
          filter: blur(0.4px);
        }

        /* ── lock shards (the keyhole bursting open) ── */
        .eo-shard {
          position: absolute; left: -2px; top: -7px; width: 4px; height: 14px; border-radius: 1px;
          background: linear-gradient(180deg, #fff 0%, var(--core) 45%, var(--mid) 100%);
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

        /* ── volumetric god rays (uneven widths, coloured most of the length) ── */
        .eo-rays { position: absolute; left: 0; top: 0; animation: eoRaysSpin 0.95s ease-out both; }
        .eo-rays span {
          position: absolute; top: 0; margin-left: -4px; height: 430px;
          margin-top: -430px; transform-origin: 50% 100%;
          background: linear-gradient(0deg, #fff 0%, var(--core) 9%, var(--mid) 32%, var(--deep) 64%, rgba(var(--g),0.22) 86%, transparent 100%);
          filter: blur(0.7px);
        }
        @keyframes eoRaysSpin {
          0% { opacity: 0; transform: scale(0.15) rotate(-22deg); }
          22% { opacity: 1; } 52% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.3) rotate(12deg); }
        }

        /* ── turbulent plasma core (SVG feTurbulence displaced edge) ── */
        .eo-plasma {
          position: absolute; left: 0; top: 0; width: 150px; height: 150px; margin: -75px 0 0 -75px; border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, #fff 8%, var(--core) 22%, var(--mid) 46%, rgba(var(--g),0.55) 70%, transparent 82%);
          filter: url(#eoPlasma);
          /* modest scale so the baked turbulence stays crisp — the rings/rays
             carry the big outward expansion, not the fireball texture */
          animation: eoPlasma 0.62s cubic-bezier(0.2,0.7,0.35,1) forwards;
        }
        @keyframes eoPlasma {
          0% { transform: scale(0.4); opacity: 1; }
          16% { opacity: 1; }
          70% { opacity: 0.85; }
          100% { transform: scale(2.3); opacity: 0; }
        }

        /* ── lingering afterglow — outlasts the flash, fades into the reveal ── */
        .eo-afterglow {
          position: absolute; left: 0; top: 0; width: 190px; height: 190px; margin: -95px 0 0 -95px; border-radius: 50%;
          background: radial-gradient(circle, var(--core) 0%, rgba(var(--g),0.5) 26%, rgba(var(--g),0.12) 52%, transparent 72%);
          animation: eoAfterglow 1s ease-out forwards;
        }
        @keyframes eoAfterglow {
          0% { opacity: 0; transform: scale(0.3); }
          18% { opacity: 0.62; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.5); }
        }

        /* ── whole-frame flash at the peak — tinted, capped opacity ── */
        .eo-whiteout {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 46%, #fff 0%, var(--core) 32%, var(--mid) 72%, rgba(var(--g),0.7) 100%);
          animation: eoWhiteout 0.42s ease-out forwards;
        }
        @keyframes eoWhiteout { 0% { opacity: 0; } 9% { opacity: 0.7; } 26% { opacity: 0; } 100% { opacity: 0; } }

        /* ── rising smoke — DARK volume, not glow; drifts up over the cooling
              core as aftermath (normal blend, charcoal, delayed) ── */
        .eo-wisp {
          position: absolute; left: -34px; top: -34px; width: 68px; height: 68px; border-radius: 50%;
          background: radial-gradient(circle, rgba(16,11,22,0.6) 0%, rgba(16,11,22,0.32) 44%, transparent 72%);
          filter: blur(7px);
          animation: eoWisp 1s ease-out 0.16s both;
        }
        @keyframes eoWisp {
          0% { opacity: 0; transform: translate(0,0) scale(0.4); }
          40% { opacity: 0.55; }
          100% { opacity: 0; transform: translate(var(--wx), var(--wy)) scale(1.8); }
        }

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
