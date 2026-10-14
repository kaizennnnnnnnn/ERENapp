'use client'

// The lab's landing screen: what's due, how far along you are, and the eight
// ways in.
//
// In the Meadow look, like the Play tab: a white hero card that says what to
// do next with the one leaf button, a card with the level and the two bars,
// and the eight modes as white tiles, each with its pixel icon on a tint.

import { useChemistryStore } from '@/lib/chemistry/store'
import { playSound } from '@/lib/sounds'
import { dateStr } from '@/lib/chemistry/srs'
import {
  IconLightning, IconBook, IconFlask, IconTicket, IconScroll,
  IconSlots, IconClock, IconPin,
} from '@/components/PixelIcons'
import {
  Card, M, Meter, MeadowIcon, PrimaryButton, SecondaryButton, Tag, TINT, TYPE,
} from '@/components/meadow'

type Mode = 'home' | 'review' | 'learn' | 'table' | 'flashcards' | 'quiz' | 'match' | 'speed' | 'locate'

interface Props {
  onGoto: (m: Mode) => void
}

interface TileDef {
  id: Exclude<Mode, 'home'>
  label: string
  sub: string
  Icon: React.ComponentType<{ size?: number }>
  tint: string
}

/** Correct answers needed today to fill the goal bar — about one Quiz round. */
const DAILY_GOAL = 20
const TOTAL_ELEMENTS = 118

const TILES: TileDef[] = [
  { id: 'review',     label: 'Review', sub: 'Spaced repetition',   Icon: IconLightning, tint: TINT.blue },
  { id: 'learn',      label: 'Learn',  sub: 'New element batches', Icon: IconBook,      tint: TINT.lilac },
  { id: 'table',      label: 'Table',  sub: 'All 118, browsable',  Icon: IconFlask,     tint: TINT.leaf },
  { id: 'flashcards', label: 'Cards',  sub: 'Flip and self-rate',  Icon: IconTicket,    tint: TINT.amber },
  { id: 'quiz',       label: 'Quiz',   sub: 'Multiple choice',     Icon: IconScroll,    tint: TINT.love },
  { id: 'match',      label: 'Match',  sub: 'Symbol to name',      Icon: IconSlots,     tint: TINT.orange },
  { id: 'speed',      label: 'Speed',  sub: '60-second sprint',    Icon: IconClock,     tint: TINT.sky },
  { id: 'locate',     label: 'Locate', sub: 'Find it on the grid', Icon: IconPin,       tint: TINT.danger },
]

export default function HomeDashboard({ onGoto }: Props) {
  const { state, dueCount, hydrated } = useChemistryStore()

  const mastered = Object.values(state.cards).filter(c => c.box >= 6).length
  const streak = state.streak.current
  const reviewsToday = state.history[dateStr()] ?? 0
  const goalDone = Math.min(DAILY_GOAL, reviewsToday)

  // Gentle level system: one mastered element = 4 XP, 100 XP a level.
  const xp = mastered * 4
  const level = Math.floor(xp / 100) + 1
  const inLevel = xp % 100

  const due = hydrated && dueCount > 0
  const left = Math.max(0, DAILY_GOAL - goalDone)

  return (
    <div className="flex flex-col" style={{ gap: 12, padding: '0 16px' }}>

      {/* ── What to do next ── */}
      <Card padding="16px 18px 16px">
        <p style={{ margin: 0, ...TYPE.label, fontSize: 11, color: M.label }}>Spaced repetition</p>
        <h2 style={{ margin: '6px 0 0', fontSize: 26, lineHeight: 1.2, fontWeight: 800, color: M.text }}>
          {due ? `${dueCount} card${dueCount === 1 ? '' : 's'} due` : 'All caught up'}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
          {due
            ? 'Clear your reviews to keep everything in long-term memory. One tap to start.'
            : 'Run a Learn batch to pick up fresh elements, or go browse the table.'}
        </p>

        <div className="flex" style={{ gap: 8, marginTop: 14 }}>
          <PrimaryButton size="md" full
            onClick={() => { playSound('ui_tap'); onGoto(due ? 'review' : 'learn') }}
            icon={due ? <IconLightning size={18} /> : <IconBook size={18} />}
            style={{ flex: '1 1 0', padding: '0 12px' }}>
            {due ? `Review ${dueCount}` : 'Learn new'}
          </PrimaryButton>
          <SecondaryButton size="md"
            onClick={() => { playSound('ui_tap'); onGoto('table') }}
            icon={<IconFlask size={18} />}
            style={{ padding: '0 16px' }}>
            Table
          </SecondaryButton>
        </div>

        <div className="flex flex-wrap" style={{ gap: 6, marginTop: 14 }}>
          <Tag size="sm" tone="soft" icon={<MeadowIcon name="flame" size={14} />} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {streak} day streak
          </Tag>
          <Tag size="sm" tone="soft" icon={<MeadowIcon name="star" size={14} />} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {mastered} of {TOTAL_ELEMENTS} mastered
          </Tag>
        </div>
      </Card>

      {/* ── Today's goal + level ── */}
      <Card padding="14px 18px 16px">
        <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: M.text }}>Level {level}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>
            {left > 0 ? `${left} more today` : 'Goal reached today'}
          </span>
        </div>
        <Bar label="Today's goal" value={goalDone / DAILY_GOAL} text={`${goalDone}/${DAILY_GOAL}`} color={M.leaf} />
        <Bar label="XP" value={inLevel / 100} text={`${inLevel}/100`} color={M.coin} />
      </Card>

      {/* ── The eight ways in ── */}
      <div className="grid grid-cols-2" style={{ gap: 10 }}>
        {TILES.map(t => {
          const TileIcon = t.Icon
          return (
            <Card key={t.id} padding="14px 14px 14px" onClick={() => { playSound('ui_tap'); onGoto(t.id) }}
              ariaLabel={`${t.label}: ${t.sub}`}>
              <span aria-hidden className="flex items-center justify-center" style={{
                width: 44, height: 44, borderRadius: 14, background: t.tint,
              }}>
                <TileIcon size={24} />
              </span>
              <span style={{ display: 'block', marginTop: 10, fontSize: 16, lineHeight: 1.2, fontWeight: 800, color: M.text }}>
                {t.label}
              </span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>
                {t.sub}
              </span>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/** One labelled bar: name on the left, the count on the right, the meter under. */
function Bar({ label, value, text, color }: { label: string; value: number; text: string; color: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>{label}</span>
        <span style={{ fontSize: 13, ...TYPE.number, color: M.text }}>{text}</span>
      </div>
      <Meter value={value} color={color} height={10} label={label} />
    </div>
  )
}
