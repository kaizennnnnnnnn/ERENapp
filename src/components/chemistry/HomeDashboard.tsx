'use client'

// HomeDashboard — the new default landing view inside the chemistry
// overlay. Modeled on the Mandel screenshots: lavender hero card with the
// "X cards due today" CTA, cream-yellow goal card with a progress ring and
// XP-style bar, then a 2-column pastel mode-tile grid that lets the user
// jump to Table / Cards / Quiz / Match (and lists Review / Learn / Speed /
// Locate as "soon" so the roadmap is visible without the broken header
// pills that confused taps earlier).
//
// Tile pastels and the hero/goal layout are scoped to this file so the
// rest of the overlay can keep its current theme until step 2 softens the
// remaining surfaces.

import {
  Zap, BookOpen, Atom, Layers, ListChecks, LayoutGrid, Timer, MapPin, Flame,
  type LucideIcon,
} from 'lucide-react'
import { useChemistryStore } from '@/lib/chemistry/store'
import { useChemistryTheme, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import { playSound } from '@/lib/sounds'
import { dateStr } from '@/lib/chemistry/srs'

type Mode = 'home' | 'review' | 'learn' | 'table' | 'flashcards' | 'quiz' | 'match' | 'speed' | 'locate'

interface Props {
  palette: Palette
  onGoto: (m: Mode) => void
}

// Tile spec: id targets live overlay modes; 'soon' tiles render disabled.
interface TileDef {
  id: string
  label: string
  sub: string
  Icon: LucideIcon
  bg: string      // pastel fill
  status: 'live' | 'soon'
}

// Daily goal — count of correct answers needed today to fill the ring.
// Tuned to roughly one full Quiz round.
const DAILY_GOAL = 20

export default function HomeDashboard({ palette, onGoto }: Props) {
  const { state, dueCount, hydrated } = useChemistryStore()
  // Theme is still consumed by sibling components; the dashboard itself
  // now uses the same bright pastel hex values regardless of theme, only
  // the underlying overlay bg shifts dark.
  useChemistryTheme()

  const masteredCount = Object.values(state.cards).filter(c => c.box >= 6).length
  const totalElements = 118 // matches the catalogue
  const streak = state.streak.current

  // "Today's goal" — count of card reviews logged today. Each rate() writes
  // into history[today]; we cap at DAILY_GOAL so the ring fills cleanly.
  const todayKey = dateStr()
  const reviewsToday = state.history[todayKey] ?? 0
  const goalProgress = Math.min(DAILY_GOAL, reviewsToday)

  // XP-style bar — gentle level system: 1 mastered = 4 XP, 100 XP/level.
  const xp     = masteredCount * 4
  const level  = Math.floor(xp / 100) + 1
  const inLvl  = xp % 100
  const xpPct  = (inLvl / 100) * 100

  // Bright pastel pairs — same hex in both themes. The dark overlay bg
  // gives the contrast; pastels stay pastels.
  const tilePastel = {
    grape:  palette.grapeLight, // #E4D6FB
    sky:    palette.skyLight,   // #D6E9FC
    sun:    palette.sunLight,   // #FEF1C3
    mint:   '#CFEFE0',
    coral:  '#FFD8D2',
    cream:  '#FCEAB1',
  }
  const TILES: TileDef[] = [
    { id: 'review',     label: 'Review',     sub: 'Spaced-repetition driver',     Icon: Zap,        bg: tilePastel.sky,   status: 'live' },
    { id: 'learn',      label: 'Learn',      sub: 'Guided new-element batches',   Icon: BookOpen,   bg: tilePastel.grape, status: 'live' },
    { id: 'table',      label: 'Table',      sub: 'Browse all 118 elements',      Icon: Atom,       bg: tilePastel.mint,  status: 'live' },
    { id: 'flashcards', label: 'Flashcards', sub: 'Flip & self-rate',             Icon: Layers,     bg: tilePastel.sun,   status: 'live' },
    { id: 'quiz',       label: 'Quiz',       sub: 'Multiple-choice rounds',       Icon: ListChecks, bg: tilePastel.coral, status: 'live' },
    { id: 'match',      label: 'Match',      sub: 'Timed symbol ↔ name',          Icon: LayoutGrid, bg: tilePastel.cream, status: 'live' },
    { id: 'speed',      label: 'Speed',      sub: '60-second sprint',             Icon: Timer,      bg: tilePastel.grape, status: 'live' },
    { id: 'locate',     label: 'Locate',     sub: 'Find on the table',            Icon: MapPin,     bg: tilePastel.sky,   status: 'live' },
  ]

  function handleHeroPrimary() {
    playSound('ui_tap')
    // If there are due cards, drop straight into Review; otherwise run
    // a Learn batch so the user always lands somewhere productive.
    onGoto(dueCount > 0 ? 'review' : 'learn')
  }
  function handleHeroSecondary() {
    playSound('ui_tap')
    onGoto('table')
  }
  function handleTile(t: TileDef) {
    if (t.status !== 'live') return
    playSound('ui_tap')
    onGoto(t.id as Mode)
  }

  return (
    <div style={{
      paddingLeft: 14,
      paddingRight: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontFamily: CHEM_FONT,
    }}>
      {/* ── Hero card — bright lavender in both themes ── */}
      <div style={{
        position: 'relative',
        borderRadius: 24,
        padding: 18,
        background: palette.grapeLight,
        overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', top: -22, right: -22,
          width: 90, height: 90, borderRadius: 999,
          background: palette.sun, opacity: 0.95,
        }} />
        <div aria-hidden style={{
          position: 'absolute', bottom: -32, right: 28,
          width: 64, height: 64, borderRadius: 999,
          background: palette.sky, opacity: 0.65,
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
            color: palette.grapeDark,
          }}>
            SPACED REPETITION · ACTIVE RECALL
          </div>
          <div style={{
            marginTop: 6,
            fontSize: 26, fontWeight: 900, letterSpacing: -0.5,
            color: palette.ink,
          }}>
            {hydrated && dueCount > 0
              ? `${dueCount} card${dueCount === 1 ? '' : 's'} due today`
              : 'You\'re all caught up'}
          </div>
          <div style={{
            marginTop: 6, fontSize: 13, fontWeight: 500,
            color: palette.ink, opacity: 0.78,
            maxWidth: 360,
          }}>
            {hydrated && dueCount > 0
              ? 'Clear your reviews to keep everything in long-term memory. One tap to start.'
              : 'Run a Learn batch to start fresh elements, or browse the table.'}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleHeroPrimary}
              style={{
                padding: '10px 16px',
                borderRadius: 999,
                border: 'none',
                background: palette.grapeDark,
                color: '#FFF',
                fontFamily: CHEM_FONT,
                fontSize: 14, fontWeight: 800,
                whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              {hydrated && dueCount > 0 ? (
                <>
                  <Zap size={16} strokeWidth={2.6} />
                  Review {dueCount} due
                </>
              ) : (
                <>
                  <BookOpen size={16} strokeWidth={2.4} />
                  Learn new elements
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleHeroSecondary}
              style={{
                padding: '10px 16px',
                borderRadius: 999,
                border: `2px solid ${palette.ink}`,
                background: 'transparent',
                color: palette.ink,
                fontFamily: CHEM_FONT,
                fontSize: 14, fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Open table
            </button>
          </div>

          <div style={{
            marginTop: 12, display: 'flex', gap: 14, alignItems: 'center',
            fontSize: 12, fontWeight: 600,
            color: palette.ink, opacity: 0.78,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Flame size={13} strokeWidth={2.4} color={palette.sunDark} />
              {streak}-day streak
            </span>
            <span>•</span>
            <span>{masteredCount} / {totalElements} mastered</span>
          </div>
        </div>
      </div>

      {/* ── Today's goal card — cream/sunlight in both themes ── */}
      <div style={{
        borderRadius: 24,
        padding: 16,
        background: palette.sunLight,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}>
        <ProgressRing value={goalProgress} max={DAILY_GOAL} palette={palette} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 900,
            color: palette.ink,
          }}>
            Level {level}
          </div>
          <div style={{
            marginTop: 6,
            height: 10,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${xpPct}%`,
              height: '100%',
              background: palette.grapeDark,
              transition: 'width 240ms ease',
            }} />
          </div>
          <div style={{
            marginTop: 6,
            fontSize: 12, fontWeight: 700,
            color: palette.ink, opacity: 0.78,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <Flame size={13} strokeWidth={2.4} color={palette.sunDark} />
            {streak} day streak · {Math.max(0, DAILY_GOAL - goalProgress)} more to go
          </div>
        </div>
      </div>

      {/* ── Mode tile grid (2 cols) — all live, all bright ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}>
        {TILES.map(t => {
          const TileIcon = t.Icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTile(t)}
              style={{
                position: 'relative',
                textAlign: 'left',
                padding: 14,
                borderRadius: 18,
                border: 'none',
                background: t.bg,
                color: palette.ink,
                fontFamily: CHEM_FONT,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 100,
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 34, height: 34,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.6)',
                display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                color: palette.grapeDark,
              }}>
                <TileIcon size={20} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{t.label}</div>
              <div style={{
                fontSize: 11, fontWeight: 500,
                opacity: 0.72,
                lineHeight: 1.3,
              }}>
                {t.sub}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProgressRing({ value, max, palette }: {
  value: number; max: number; palette: Palette
}) {
  const pct = Math.max(0, Math.min(1, value / max))
  const size = 64
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dashOffset = c - pct * c
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(0,0,0,0.18)" strokeWidth={stroke} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={palette.grapeDark} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 240ms ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: CHEM_FONT, lineHeight: 1,
      }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: palette.ink }}>{value}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: palette.ink, opacity: 0.66 }}>of {max}</div>
      </div>
    </div>
  )
}
