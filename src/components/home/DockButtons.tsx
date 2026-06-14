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

export function DockContent({ theme, label }: { theme: DockTheme; label: string }) {
  const t = THEMES[theme]
  return (
    <>
      <div className="dock-fill" style={fillStyle(t)}>
        {theme === 'cake' && <FrostingStrip />}
      </div>

      {theme === 'cake' && (
        <>
          <span style={topMotif}><IconCherry size={18} /></span>
          <span style={{ ...cornerDeco, bottom: 3, left: 5 }}><IconFlower size={12} /></span>
          <span style={{ ...cornerDeco, bottom: 3, right: 5 }}><IconFlower size={12} /></span>
        </>
      )}
      {theme === 'gacha' && (
        <>
          <GachaKnob />
          {/* red push-button on the machine face — self-presses on a loop, pure
              decor (see .gacha-red-btn in globals.css) so it looks tappable */}
          <div className="gacha-red-btn" style={{
            position: 'absolute', right: 9, bottom: 6, width: 11, height: 11, borderRadius: '50%',
            background: '#FF3B3B', border: '1.5px solid #7E0F0F', zIndex: 4, pointerEvents: 'none',
          }} />
          <span style={{ ...cornerDeco, top: 3, left: 5 }}><IconSparkles size={12} /></span>
          <span style={{ ...cornerDeco, top: 3, right: 5 }}><IconStar size={11} /></span>
        </>
      )}
      {theme === 'shawarma' && (
        <>
          <span style={topMotif}><IconShawarma size={17} /></span>
          <span style={{ ...cornerDeco, top: 3, right: 5 }}><IconStar size={11} /></span>
          <span style={{ ...cornerDeco, bottom: 2, left: 5 }}><IconSparkles size={12} /></span>
        </>
      )}

      <span style={dockLabel}>{label}</span>
    </>
  )
}
