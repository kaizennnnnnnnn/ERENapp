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

import { useChemistryStore } from '@/lib/chemistry/store'
import { useChemistryTheme, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import { playSound } from '@/lib/sounds'
import { dateStr } from '@/lib/chemistry/srs'

type Mode = 'home' | 'table' | 'flashcards' | 'quiz' | 'match'

interface Props {
  palette: Palette
  onGoto: (m: Mode) => void
}

// Tile spec: id targets live overlay modes; 'soon' tiles render disabled.
interface TileDef {
  id: string
  label: string
  sub: string
  icon: string
  bg: string      // pastel fill
  status: 'live' | 'soon'
}

// Daily goal — count of correct answers needed today to fill the ring.
// Tuned to roughly one full Quiz round.
const DAILY_GOAL = 20

export default function HomeDashboard({ palette, onGoto }: Props) {
  const { state, dueCount, hydrated } = useChemistryStore()
  const { theme } = useChemistryTheme()

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

  // Tile palette — pastel pairs sourced from the theme so light/dark both
  // read. Picks track the Mandel screenshots' soft hues.
  const tilePastel = {
    grape:  theme === 'dark' ? '#4A3568' : palette.grapeLight,
    sky:    theme === 'dark' ? '#214861' : palette.skyLight,
    sun:    theme === 'dark' ? '#5A4A1F' : palette.sunLight,
    mint:   theme === 'dark' ? '#1F4D38' : '#CFEFE0',
    coral:  theme === 'dark' ? '#5D2A2A' : '#FFD8D2',
    cream:  theme === 'dark' ? '#3D3320' : '#FCEAB1',
  }
  const TILES: TileDef[] = [
    { id: 'review',     label: 'Review',     sub: 'Spaced-repetition driver',     icon: '⚡', bg: tilePastel.sky,   status: 'soon' },
    { id: 'learn',      label: 'Learn',      sub: 'Guided new-element batches',   icon: '📖', bg: tilePastel.grape, status: 'soon' },
    { id: 'table',      label: 'Table',      sub: 'Browse all 118 elements',      icon: '⌗',  bg: tilePastel.mint,  status: 'live' },
    { id: 'flashcards', label: 'Flashcards', sub: 'Flip & self-rate',             icon: '🗂', bg: tilePastel.sun,   status: 'live' },
    { id: 'quiz',       label: 'Quiz',       sub: 'Multiple-choice rounds',       icon: '✦',  bg: tilePastel.coral, status: 'live' },
    { id: 'match',      label: 'Match',      sub: 'Timed symbol ↔ name',          icon: '⊞',  bg: tilePastel.cream, status: 'live' },
    { id: 'speed',      label: 'Speed',      sub: '60-second sprint',             icon: '⏱', bg: tilePastel.grape, status: 'soon' },
    { id: 'locate',     label: 'Locate',     sub: 'Find on the table',            icon: '◎', bg: tilePastel.sky,   status: 'soon' },
  ]

  function handleHeroPrimary() {
    // Until Review mode ships, the "X cards due" CTA routes to Quiz so
    // the user always has somewhere productive to land.
    playSound('ui_tap')
    onGoto('quiz')
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
      {/* ── Hero card ── */}
      <div style={{
        position: 'relative',
        borderRadius: 24,
        padding: 18,
        background: theme === 'dark' ? '#3F2A5E' : palette.grapeLight,
        overflow: 'hidden',
      }}>
        {/* Decorative orbs — sun top-right, sky bottom-right, like Mandel */}
        <div aria-hidden style={{
          position: 'absolute', top: -22, right: -22,
          width: 90, height: 90, borderRadius: 999,
          background: palette.sun, opacity: 0.85,
        }} />
        <div aria-hidden style={{
          position: 'absolute', bottom: -32, right: 28,
          width: 64, height: 64, borderRadius: 999,
          background: palette.sky, opacity: 0.55,
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
            color: theme === 'dark' ? palette.grape : palette.grapeDark,
            opacity: 0.9,
          }}>
            SPACED REPETITION · ACTIVE RECALL
          </div>
          <div style={{
            marginTop: 6,
            fontSize: 26, fontWeight: 900, letterSpacing: -0.5,
            color: theme === 'dark' ? palette.fg : palette.ink,
          }}>
            {hydrated && dueCount > 0
              ? `${dueCount} card${dueCount === 1 ? '' : 's'} due today`
              : 'You\'re all caught up'}
          </div>
          <div style={{
            marginTop: 6, fontSize: 13, fontWeight: 500,
            color: theme === 'dark' ? palette.fgMuted : palette.ink,
            opacity: 0.78,
            maxWidth: 360,
          }}>
            {hydrated && dueCount > 0
              ? 'Clear your reviews to keep everything in long-term memory. One tap to start.'
              : 'Run a quiz round or browse the table while you wait for tomorrow\'s reviews.'}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleHeroPrimary}
              style={{
                padding: '10px 16px',
                borderRadius: 999,
                border: 'none',
                background: palette.sky,
                color: palette.ink,
                fontFamily: CHEM_FONT,
                fontSize: 14, fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              ⚡ Start quiz
            </button>
            <button
              type="button"
              onClick={handleHeroSecondary}
              style={{
                padding: '10px 16px',
                borderRadius: 999,
                border: 'none',
                background: theme === 'dark' ? palette.cardMuted : palette.card,
                color: palette.fg,
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
            color: theme === 'dark' ? palette.fgMuted : palette.ink,
            opacity: 0.78,
          }}>
            <span>🔥 {streak}-day streak</span>
            <span>•</span>
            <span>{masteredCount} / {totalElements} mastered</span>
          </div>
        </div>
      </div>

      {/* ── Today's goal card ── */}
      <div style={{
        borderRadius: 24,
        padding: 16,
        background: theme === 'dark' ? '#4A3C13' : palette.sunLight,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}>
        <ProgressRing value={goalProgress} max={DAILY_GOAL} palette={palette} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 900,
            color: theme === 'dark' ? palette.fg : palette.ink,
          }}>
            Level {level}
          </div>
          {/* XP bar */}
          <div style={{
            marginTop: 6,
            height: 10,
            borderRadius: 999,
            background: theme === 'dark' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)',
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
            color: theme === 'dark' ? palette.fgMuted : palette.ink,
            opacity: 0.78,
          }}>
            🔥 {streak} day streak · {Math.max(0, DAILY_GOAL - goalProgress)} more to go
          </div>
        </div>
      </div>

      {/* ── Mode tile grid (2 cols) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}>
        {TILES.map(t => {
          const live = t.status === 'live'
          return (
            <button
              key={t.id}
              type="button"
              disabled={!live}
              onClick={() => handleTile(t)}
              style={{
                position: 'relative',
                textAlign: 'left',
                padding: 14,
                borderRadius: 18,
                border: 'none',
                background: t.bg,
                opacity: live ? 1 : 0.55,
                cursor: live ? 'pointer' : 'not-allowed',
                color: theme === 'dark' ? palette.fg : palette.ink,
                fontFamily: CHEM_FONT,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 100,
              }}
            >
              <div style={{
                width: 32, height: 32,
                borderRadius: 10,
                background: theme === 'dark' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.55)',
                display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>
                {t.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {t.label}
                {!live && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 9, fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: palette.sun,
                    color: palette.ink,
                    verticalAlign: 'middle',
                  }}>
                    SOON
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 11, fontWeight: 500,
                opacity: 0.78,
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
