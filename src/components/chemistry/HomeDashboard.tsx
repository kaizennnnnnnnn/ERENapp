'use client'

// The lab's landing screen: what's due, how far along you are, and the eight
// ways in.
//
// It used to wear the imported study-app skin — rounded sans, 24px radii, a
// circular SVG progress ring, lucide line icons — which made the one room in a
// pixel-art game that looks like a SaaS dashboard. Same information, same
// hierarchy, redrawn in the house style: pixel-font labels, 3px borders with
// hard offset shadows, the shared SegmentMeter for both bars, and PixelIcons on
// every tile.

import { useChemistryStore } from '@/lib/chemistry/store'
import { useChemistryTheme } from '@/lib/chemistry/theme'
import { playSound } from '@/lib/sounds'
import { dateStr } from '@/lib/chemistry/srs'
import SegmentMeter, { type MeterPalette } from '@/components/care/SegmentMeter'
import {
  IconLightning, IconBook, IconFlask, IconTicket, IconScroll,
  IconSlots, IconClock, IconPin, IconFire, IconStar,
} from '@/components/PixelIcons'
import {
  PixelPanel, PixelButton, PixelLabel, Rivets,
  pixelSkin, hard, PIXEL_FONT, BODY_FONT, type PixelSkin,
} from './pixel'

type Mode = 'home' | 'review' | 'learn' | 'table' | 'flashcards' | 'quiz' | 'match' | 'speed' | 'locate'

interface Props {
  onGoto: (m: Mode) => void
}

interface TileDef {
  id: Exclude<Mode, 'home'>
  label: string
  sub: string
  Icon: React.ComponentType<{ size?: number }>
  bg: string
}

/** Correct answers needed today to fill the goal bar — about one Quiz round. */
const DAILY_GOAL = 20
const TOTAL_ELEMENTS = 118

// Vivid accents, identical in both skins. Dark ink text sits on all of them.
const TILES: TileDef[] = [
  { id: 'review',     label: 'REVIEW',  sub: 'Spaced repetition',   Icon: IconLightning, bg: '#7CB6F2' },
  { id: 'learn',      label: 'LEARN',   sub: 'New element batches',  Icon: IconBook,      bg: '#C4A7F5' },
  { id: 'table',      label: 'TABLE',   sub: 'All 118, browsable',   Icon: IconFlask,     bg: '#6EE7B7' },
  { id: 'flashcards', label: 'CARDS',   sub: 'Flip and self-rate',   Icon: IconTicket,    bg: '#FCD34D' },
  { id: 'quiz',       label: 'QUIZ',    sub: 'Multiple choice',      Icon: IconScroll,    bg: '#FCA5A5' },
  { id: 'match',      label: 'MATCH',   sub: 'Symbol to name',       Icon: IconSlots,     bg: '#FDE68A' },
  { id: 'speed',      label: 'SPEED',   sub: '60-second sprint',     Icon: IconClock,     bg: '#5EEAD4' },
  { id: 'locate',     label: 'LOCATE',  sub: 'Find it on the grid',  Icon: IconPin,       bg: '#F9A8D4' },
]

/** Recessed-channel palettes for the two bars, in the lab's grape and gold. */
function meterPalettes(skin: PixelSkin): { goal: MeterPalette; xp: MeterPalette } {
  const chrome = { groove: skin.panelLo, frame: skin.ink, rivet: skin.gold }
  return {
    goal: {
      ...chrome,
      fillHi: '#DDC9FF', fillBase: '#A855F7', fillLo: '#6D28D9', fillEdge: '#4C1D95',
      glow: 'rgba(168,85,247,0.45)', track: skin.panel, trackEdge: skin.edge,
    },
    xp: {
      ...chrome,
      fillHi: '#FDE68A', fillBase: '#F5C842', fillLo: '#B45309', fillEdge: '#7C2D12',
      glow: 'rgba(245,200,66,0.45)', track: skin.panel, trackEdge: skin.edge,
    },
  }
}

export default function HomeDashboard({ onGoto }: Props) {
  const { state, dueCount, hydrated } = useChemistryStore()
  const { theme } = useChemistryTheme()
  const skin = pixelSkin(theme)
  const meters = meterPalettes(skin)

  const mastered = Object.values(state.cards).filter(c => c.box >= 6).length
  const streak = state.streak.current
  const reviewsToday = state.history[dateStr()] ?? 0
  const goalDone = Math.min(DAILY_GOAL, reviewsToday)

  // Gentle level system: one mastered element = 4 XP, 100 XP a level.
  const xp = mastered * 4
  const level = Math.floor(xp / 100) + 1
  const inLevel = xp % 100

  const due = hydrated && dueCount > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 12px' }}>

      {/* ── Hero ── */}
      <PixelPanel skin={skin} rivets style={{ padding: '15px 14px 14px' }}>
        <PixelLabel color={skin.gold} size={7}>SPACED REPETITION</PixelLabel>

        <div style={{
          fontFamily: PIXEL_FONT, fontSize: 15, lineHeight: 1.5, color: skin.fg,
          marginTop: 10,
        }}>
          {due ? `${dueCount} CARD${dueCount === 1 ? '' : 'S'} DUE` : 'ALL CAUGHT UP'}
        </div>

        <p style={{
          fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 1.5,
          color: skin.fgDim, margin: '9px 0 0',
        }}>
          {due
            ? 'Clear your reviews to keep everything in long-term memory. One tap to start.'
            : 'Run a Learn batch to pick up fresh elements, or go browse the table.'}
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
          <PixelButton
            skin={skin} tone={skin.gold}
            onClick={() => { playSound('ui_tap'); onGoto(due ? 'review' : 'learn') }}
            style={{ flex: '1 1 150px' }}
          >
            {due ? <IconLightning size={13} /> : <IconBook size={13} />}
            {due ? `REVIEW ${dueCount}` : 'LEARN NEW'}
          </PixelButton>
          <PixelButton
            skin={skin}
            onClick={() => { playSound('ui_tap'); onGoto('table') }}
            style={{ flex: '1 1 110px' }}
          >
            <IconFlask size={13} />
            TABLE
          </PixelButton>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 13,
          paddingTop: 11, borderTop: `2px solid ${skin.edge}`,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconFire size={13} />
            <PixelLabel color={skin.fgDim} size={6}>{streak} DAY</PixelLabel>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconStar size={13} />
            <PixelLabel color={skin.fgDim} size={6}>{mastered} / {TOTAL_ELEMENTS}</PixelLabel>
          </span>
        </div>
      </PixelPanel>

      {/* ── Today's goal + level ── */}
      <PixelPanel skin={skin} style={{ padding: '13px 14px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11,
        }}>
          <PixelLabel color={skin.gold} size={8}>LEVEL {level}</PixelLabel>
          <PixelLabel color={skin.fgDim} size={6}>
            {Math.max(0, DAILY_GOAL - goalDone)} MORE TODAY
          </PixelLabel>
        </div>
        <SegmentMeter
          label="TODAY'S GOAL" value={(goalDone / DAILY_GOAL) * 100}
          valueText={`${goalDone}/${DAILY_GOAL}`} palette={meters.goal}
          labelColor={skin.fgDim} valueColor={skin.fg}
        />
        <div style={{ height: 10 }} />
        <SegmentMeter
          label="XP" value={inLevel} valueText={`${inLevel}/100`} palette={meters.xp}
          labelColor={skin.fgDim} valueColor={skin.fg}
        />
      </PixelPanel>

      {/* ── The eight ways in ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {TILES.map(t => {
          const TileIcon = t.Icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { playSound('ui_tap'); onGoto(t.id) }}
              className="chem-pixel-btn"
              style={{
                position: 'relative', textAlign: 'left',
                padding: '12px 11px 11px',
                background: t.bg,
                border: `3px solid ${skin.edge}`,
                boxShadow: hard(skin.ink),
                color: skin.onAccent,
                display: 'flex', flexDirection: 'column', gap: 7,
                minHeight: 92,
              }}
            >
              <Rivets color={skin.ink} ink="transparent" />
              <span style={{
                width: 30, height: 30, display: 'grid', placeItems: 'center',
                background: 'rgba(255,255,255,0.78)',
                border: `2px solid ${skin.onAccent}`,
                boxShadow: `2px 2px 0 ${skin.onAccent}`,
              }}>
                <TileIcon size={17} />
              </span>
              <span style={{ fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 1.5 }}>{t.label}</span>
              <span style={{
                fontFamily: BODY_FONT, fontSize: 11, fontWeight: 600, lineHeight: 1.3, opacity: 0.75,
              }}>
                {t.sub}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
