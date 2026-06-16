'use client'

import { IconCherry, IconFlower, IconStar, IconSparkles, IconShawarma } from '@/components/PixelIcons'

// ─── HOME DOCK BUTTONS ───────────────────────────────────────────────────────
// Pixel-art candy buttons for the bottom dock. Flat 2-tone face with hard ink
// border + offset shadow (no smooth gloss), each themed with little pixel
// trinkets: cake gets piped frosting + a cherry + corner flowers, gacha gets a
// paw + sparkles, shawarma gets a star + sparkles.

export type DockTheme = 'gacha' | 'cake' | 'shawarma'

interface ThemeCfg { face: string; hi: string; shade: string; ink: string }
const THEMES: Record<DockTheme, ThemeCfg> = {
  gacha:    { face: '#9B7BF5', hi: '#C8B6FF', shade: '#6E46D2', ink: '#2C1A4A' },
  cake:     { face: '#F074AE', hi: '#FBAAD3', shade: '#D24E8E', ink: '#561C3E' },
  shawarma: { face: '#F59C45', hi: '#FBC079', shade: '#DC772A', ink: '#5A2E12' },
}

// The frame is a transparent positioning wrapper so trinkets can poke above the
// button; the visible chrome lives on the inner .dock-fill (which clips the
// frosting). Press state in globals.css drops the fill into its shadow.
export const dockFrame: React.CSSProperties = {
  flex: 1,
  height: 46,
  position: 'relative',
  display: 'block',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}

const dockLabel: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0, top: '56%',
  transform: 'translateY(-50%)',
  textAlign: 'center',
  fontFamily: '"Press Start 2P"',
  fontSize: 7,
  letterSpacing: 0.5,
  color: '#FFF6E9',
  textShadow: '1px 1px 0 rgba(0,0,0,0.7)',
  zIndex: 3,
  pointerEvents: 'none',
}

function fillStyle(t: ThemeCfg): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    borderRadius: 4,
    background: t.face,
    border: `3px solid ${t.ink}`,
    // Hard pixel edges: light strip across the top, dark strip across the
    // bottom, plus the classic offset drop shadow. No blur anywhere.
    boxShadow: `3px 3px 0 ${t.ink}, inset 0 3px 0 ${t.hi}, inset 0 -4px 0 ${t.shade}`,
    overflow: 'hidden',
    // Read by the press rule in globals.css so the pressed shadow matches.
    ['--dock-ink' as string]: t.ink,
  } as React.CSSProperties
}

// ── Pixel frosting strip (piped icing, tiled) ────────────────────────────────
const FROST_GRID = [
  'EEEEEEEEEE',
  'HHHHHHHHHH',
  'BBBBBBBBBB',
  'BBSSBBSSBB',
  'BBBBBBBBBB',
  'EBBBBBBBBE',
  '.EBBBBBBE.',
  '..EBBBBE..',
  '..EBBBBE..',
  '...EBBE...',
  '...EEEE...',
]
const FROST_PAL: Record<string, string> = { E: '#D14A86', H: '#FFFFFF', B: '#FFF0F7', S: '#FFDCEC' }
const FROST_URI = (() => {
  let rects = ''
  FROST_GRID.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = FROST_PAL[row[x]]
      if (c) rects += `<rect x='${x}' y='${y}' width='1.02' height='1.02' fill='${c}'/>`
    }
  })
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='11' viewBox='0 0 10 11' shape-rendering='crispEdges'>${rects}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
})()

function FrostingStrip() {
  return (
    <div aria-hidden style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 15, zIndex: 2,
      backgroundImage: `url("${FROST_URI}")`,
      backgroundRepeat: 'repeat-x',
      backgroundSize: '14px 16px',
      imageRendering: 'pixelated',
      pointerEvents: 'none',
    }} />
  )
}

const topMotif: React.CSSProperties = {
  position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
  zIndex: 4, pointerEvents: 'none', lineHeight: 0,
  filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,0.45))',
}
const cornerDeco: React.CSSProperties = {
  position: 'absolute', zIndex: 4, pointerEvents: 'none', lineHeight: 0,
}

// Static gachapon crank knob that pokes out the top of the gacha button — the
// "control handle". The red push-button lives on the button face (see below).
function GachaKnob() {
  return (
    <div style={{
      position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
      width: 20, height: 16, zIndex: 4, pointerEvents: 'none',
      filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,0.45))',
    }}>
      {/* crank knob */}
      <div style={{
        position: 'absolute', left: 4, top: 2, width: 12, height: 12, borderRadius: '50%',
        background: '#E6BE4A', border: '2px solid #6E4A12',
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.18)',
      }} />
      {/* static lever — gives the knob its crank silhouette */}
      <div style={{
        position: 'absolute', left: 9, top: 6.25, width: 8, height: 3.5,
        background: '#C4C9D2', border: '1.5px solid #383B43', borderRadius: 2,
        transformOrigin: '1px 50%', transform: 'rotate(-32deg)',
      }}>
        <div style={{
          position: 'absolute', right: -3, top: -2, width: 6, height: 6, borderRadius: '50%',
          background: '#E7EAEF', border: '1.5px solid #383B43',
        }} />
      </div>
    </div>
  )
}

// Corner trinkets twinkle gently (keyframe in globals.css) — staggered so the
// three buttons don't pulse in lockstep.
const twinkle = (delay: string): React.CSSProperties => ({
  animation: `dockTwinkle 2.2s ease-in-out ${delay} infinite`,
})

// A dispensed prize capsule resting in the gachapon's tray — clear top half,
// coloured bottom half. Pairs with the self-pressing red button so the machine
// reads as "ready to drop a prize".
function GachaCapsule() {
  return (
    <>
      {/* dark dispenser recess + a lighter lip across its top */}
      <span aria-hidden style={{
        position: 'absolute', left: 4, bottom: 3, width: 17, height: 8,
        borderRadius: '0 0 3px 3px', background: '#1B0F33',
        borderLeft: '1.5px solid #15092A', borderRight: '1.5px solid #15092A',
        borderBottom: '1.5px solid #15092A', zIndex: 4,
      }} />
      <span aria-hidden style={{
        position: 'absolute', left: 4, bottom: 10, width: 17, height: 2,
        background: '#C8B6FF', opacity: 0.55, zIndex: 4,
      }} />
      {/* the capsule itself */}
      <span aria-hidden style={{
        position: 'absolute', left: 7, bottom: 5, width: 11, height: 11, borderRadius: '50%',
        background: 'linear-gradient(180deg, #FFFFFF 0 46%, #FF6FA5 46% 100%)',
        border: '1.5px solid #2C1A4A', zIndex: 5,
        boxShadow: '0 1px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
      }} />
    </>
  )
}

// A few sprinkles scattered across the cake's frosting strip.
const SPRINKLES = [
  { c: '#7DD3FC', left: '20%', top: 4, rot: 18 },
  { c: '#FFD64D', left: '40%', top: 8, rot: -12 },
  { c: '#9BE89B', left: '58%', top: 3, rot: 40 },
  { c: '#FF8FBC', left: '76%', top: 7, rot: -22 },
  { c: '#FFFFFF', left: '30%', top: 10, rot: 8 },
]
function Sprinkles() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
      {SPRINKLES.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', left: s.left, top: s.top, width: 3, height: 1.6,
          background: s.c, borderRadius: 1, transform: `rotate(${s.rot}deg)`,
        }} />
      ))}
    </div>
  )
}

// Steam wisps rising off the fresh-off-the-spit shawarma (keyframe in globals).
function SteamWisps() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <span key={i} aria-hidden style={{
          position: 'absolute', left: `${42 + i * 7}%`, top: -19, width: 2.5, height: 11,
          background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 55%, rgba(255,255,255,0) 100%)',
          borderRadius: 2, zIndex: 4,
          animation: `dockSteam 2s ease-in-out ${i * 0.45}s infinite`,
        }} />
      ))}
    </>
  )
}

export function DockContent({ theme, label }: { theme: DockTheme; label: string }) {
  const t = THEMES[theme]
  return (
    <>
      <div className="dock-fill" style={fillStyle(t)}>
        {theme === 'cake' && <FrostingStrip />}
        {theme === 'cake' && <Sprinkles />}
      </div>

      {theme === 'cake' && (
        <>
          <span style={topMotif}><IconCherry size={18} /></span>
          <span style={{ ...cornerDeco, bottom: 3, left: 5, ...twinkle('0s') }}><IconFlower size={12} /></span>
          <span style={{ ...cornerDeco, bottom: 3, right: 5, ...twinkle('1.1s') }}><IconFlower size={12} /></span>
        </>
      )}
      {theme === 'gacha' && (
        <>
          <GachaKnob />
          <GachaCapsule />
          {/* red push-button on the machine face — self-presses on a loop, pure
              decor (see .gacha-red-btn in globals.css) so it looks tappable */}
          <div className="gacha-red-btn" style={{
            position: 'absolute', right: 9, bottom: 6, width: 11, height: 11, borderRadius: '50%',
            background: '#FF3B3B', border: '1.5px solid #7E0F0F', zIndex: 4, pointerEvents: 'none',
          }} />
          <span style={{ ...cornerDeco, top: 3, left: 5, ...twinkle('0s') }}><IconSparkles size={12} /></span>
          <span style={{ ...cornerDeco, top: 3, right: 5, ...twinkle('0.8s') }}><IconStar size={11} /></span>
        </>
      )}
      {theme === 'shawarma' && (
        <>
          <SteamWisps />
          <span style={topMotif}><IconShawarma size={17} /></span>
          <span style={{ ...cornerDeco, top: 3, right: 5, ...twinkle('0s') }}><IconStar size={11} /></span>
          <span style={{ ...cornerDeco, bottom: 2, left: 5, ...twinkle('0.9s') }}><IconSparkles size={12} /></span>
        </>
      )}

      <span style={dockLabel}>{label}</span>
    </>
  )
}
