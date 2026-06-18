'use client'

// Chemistry lab — Eren-style room hosting the periodic-table study system
// (ported in phases from AminaChemistry). Phase 1 wires the bottom STUDY
// button to a placeholder overlay; the actual table / modes / SRS land in
// follow-up phases.

import { useState } from 'react'
import { BookOpen, Flame, Check, ChevronUp, ChevronDown, type LucideIcon } from 'lucide-react'
import BlinkingEren from '@/components/BlinkingEren'
import { useRoomEren } from '@/hooks/useRoomEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'
import PeriodicTableOverlay from '@/components/chemistry/PeriodicTableOverlay'
import PeriodicTableButton from '@/components/chemistry/PeriodicTableButton'
import { useStoredChemTheme } from '@/lib/chemistry/theme'
import { useTasks } from '@/contexts/TaskContext'
import { getDailyKey } from '@/lib/tasks'

interface Props { onClose: () => void }

// ErenLab.png wears blue lab goggles, so the eye overlays are retuned to the
// lenses (measured off the sprite): the blink lids sit over the dark pupils in
// each lens, and the shine masks sit on the cool highlight in each lens's
// upper-left. Colors are shifted into the goggle-blue family so the blink reads
// as the eye closing behind the tinted glass and the shine reads as a glassy
// reflection rather than a white dot.
const LAB_EYES = {
  // Blink lids — over the visible pupils.
  lidTop:    '35%',
  lidLeftA:  '40.5%',
  lidLeftB:  '51.5%',
  lidWidth:  '7%',
  // Shine masks — upper-left highlight of each lens.
  maskTop:   '33.7%',
  maskLeftA: '37.5%',
  maskLeftB: '50.4%',
  maskW:     '6.8%',
  maskH:     '5.4%',
  // Glint sits in the upper-left of each mask (matches the lens highlight).
  glintLeftA: '24%',
  glintLeftB: '24%',
  glintTopA:  '18%',
  glintTopB:  '18%',
  glintW:     '40%',
}
// Goggle-blue eyelid (a touch deeper than the lens base) + a cool blue-white
// glass reflection for the shine.
const LAB_LID_COLOR = '#5C86A0'
const LAB_GLINT =
  'radial-gradient(circle at 42% 38%, #ffffff 0%, #eaf6ff 26%, rgba(150,205,240,0.82) 54%, rgba(120,185,230,0) 82%)'

// Lab idle look (ErenLab, goggles) — default when no Closet skin is set.
const CHEM_EREN_FALLBACK = {
  src: '/ErenLab_notail.png', tailSrc: '/ErenLab_tail.png', tailOrigin: '69.2% 72.7%',
  eyes: LAB_EYES, lidColor: LAB_LID_COLOR, glintBackground: LAB_GLINT,
}

export default function ChemistryScene(_props: Props) {
  void _props
  const isDark = useIsDark()
  const chemEren = useRoomEren('chemistry', CHEM_EREN_FALLBACK)
  const [overlayOpen, setOverlayOpen] = useState(false)

  function openStudy() {
    playSound('ui_tap')
    setOverlayOpen(true)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${isDark ? '/ChemistryNight.png' : '/ChemistryDay.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
      }} />

      {/* ══ DAILY MISSIONS ══
          Floats at the top-left just under StatsHeader so the user sees
          what's worth doing today before tapping into the lab. Moved out
          of the overlay (was taking a whole strip in there). */}
      <RoomMissionChips night={isDark} />


      {/* ══ EREN ══ sits on the rug. Halfway between the original (too far)
          and the previous bump (too close). */}
      <div className="absolute z-10" style={{
        bottom: '18%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        <ErenIdleLayer>
          <BlinkingEren size={230} {...chemEren} />
        </ErenIdleLayer>
      </div>

      {/* ══ BOTTOM ACTION BUTTON ══
          Chemistry-dressed pixel slab anchored to the bottom of the room.
          Honours the iOS / Android safe-area inset so it doesn't sit under
          the home indicator on devices that have one. */}
      <div className="absolute inset-x-0 flex justify-center z-20 px-8"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <PeriodicTableButton onClick={openStudy} />
      </div>

      <LightSwitch targetBottom="22%" targetLeft="50%" persistKey="chemistry" />

      {overlayOpen && (
        <PeriodicTableOverlay onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  )
}

// ── Daily mission chips, top-left in the room ──────────────────────────
// Sits under StatsHeader (z-[60]) so the bar takes precedence. Small
// rounded chips, two lines each (title + reward), state-aware.
//
// The chips go dark when night falls OR when the periodic-table overlay
// is in dark mode — bright cream glows too hard against the night room
// art. Note the overlay theme DEFAULTS to dark, so out of the box the
// chips run dark even by day; flipping the overlay to light restores the
// cream daytime look.
function RoomMissionChips({ night }: { night: boolean }) {
  const { completedIds } = useTasks()
  const chemTheme = useStoredChemTheme()
  const dark = night || chemTheme === 'dark'
  // Surfaces lifted from the chem DARK_PALETTE so the chips read as part
  // of the same system as the overlay (card / ink / fg).
  const surface = dark ? '#231838' : '#FFF7DA'
  const ink     = dark ? '#0A0517' : '#1A0F2D'
  const fg      = dark ? '#FBF1D9' : '#1A0F2D'
  // Default expanded so the player sees today's chem quests on entry; the
  // header pill is a button that collapses the chips back into itself.
  const [expanded, setExpanded] = useState(true)
  const dailyKey = getDailyKey()
  const lessonDone = completedIds.has(`daily_chem_lesson:${dailyKey}`)
  const streakDone = completedIds.has(`daily_chem_streak:${dailyKey}`)
  return (
    <div
      className="absolute z-20 pointer-events-none flex flex-col gap-2"
      style={{
        // Bumped down 110 → 150 so the chips clear the chemistry wall
        // diagram (proton / neutron / electron poster) in the room art.
        top: 'calc(150px + env(safe-area-inset-top, 0px))',
        left: 10,
        // Widened to 232 so the full title and reward line never ellipsis
        // on a phone-width room.
        maxWidth: 232,
      }}
    >
      {/* Section header — toggle button. Tapping collapses both chips
          back up into this pill; tapping again pops them out. Same cream
          background as the chips so the three pieces read as one unit. */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        style={{
          pointerEvents: 'auto',
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px 3px 10px',
          borderRadius: 999,
          background: surface,
          border: `2px solid ${ink}`,
          boxShadow: `2px 2px 0 ${ink}, 0 4px 10px rgba(0,0,0,0.28)`,
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 7,
          fontWeight: 800,
          letterSpacing: 0.6,
          color: fg,
          marginBottom: 2,
          cursor: 'pointer',
        }}
      >
        DAILY CHEM QUESTS
        {expanded
          ? <ChevronUp   size={12} strokeWidth={3} />
          : <ChevronDown size={12} strokeWidth={3} />}
      </button>
      <Collapsible expanded={expanded} delayMs={0}>
        <MissionChip
          Icon={BookOpen}
          title="Finish a lesson"
          reward="+10 coins  +15 xp"
          done={lessonDone}
          accent="#FCD34D"
          accentDark="#D97706"
          accentDeep="#92400E"
          dark={dark}
        />
      </Collapsible>
      <Collapsible expanded={expanded} delayMs={50}>
        <MissionChip
          Icon={Flame}
          title="5 in a row"
          reward="+15 coins  +20 xp"
          done={streakDone}
          accent="#C4A7F5"
          accentDark="#7C3AED"
          accentDeep="#5B21B6"
          dark={dark}
        />
      </Collapsible>
    </div>
  )
}

// Wrapper that animates its child into / out of the header pill. When
// `expanded` flips false the chip shrinks vertically + fades + slides up
// so it looks like it falls back into the header. Two chips can stagger
// via `delayMs` so they peel out in sequence.
//
// IMPORTANT: do NOT use transform:scale() here. Scaling the wrapper
// interpolates the chip's effective width during the animation, which
// breaks the inner flex text measurement (the first chip rendered as
// blank cream after the user toggled the section a second time).
// Pure opacity + translateY + maxHeight is enough for the "fall in"
// feel and avoids the layout/measurement issue entirely.
function Collapsible({ expanded, delayMs, children }: {
  expanded: boolean; delayMs: number; children: React.ReactNode
}) {
  return (
    <div
      aria-hidden={!expanded}
      style={{
        // Wide max-height ceiling so the chip never gets vertically
        // clipped at the natural expanded size (chip + soft drop shadow
        // can reach ~75px tall on iOS scale).
        maxHeight: expanded ? 200 : 0,
        opacity: expanded ? 1 : 0,
        transform: expanded ? 'translateY(0)' : 'translateY(-14px)',
        pointerEvents: expanded ? 'auto' : 'none',
        // overflow:hidden only when collapsing — when fully expanded we
        // need the chip's drop shadow to spill OUT, which overflow:hidden
        // would clip. Easiest fix: only clip during/while collapsed.
        overflow: expanded ? 'visible' : 'hidden',
        transition: [
          `max-height 260ms ease ${delayMs}ms`,
          `opacity 200ms ease ${delayMs}ms`,
          `transform 260ms cubic-bezier(0.4, 0, 0.2, 1) ${delayMs}ms`,
        ].join(', '),
      }}
    >
      {children}
    </div>
  )
}

function MissionChip({ Icon, title, reward, done, accent, accentDark, accentDeep, dark }: {
  Icon: LucideIcon; title: string; reward: string; done: boolean;
  accent: string; accentDark: string; accentDeep: string; dark: boolean
}) {
  // Light: bright opaque fills — claimed chips wear the accent solid,
  // unclaimed wear cream so they pop against the day room.
  // Dark: chem dark-palette surfaces — unclaimed go plum-card with the
  // accent confined to the icon box; claimed wear the DEEP accent tier
  // (not accentDark: cream text on the amber #D97706 only hits ~2.8:1,
  // the deep ~800 tier clears 4.5:1 on both chips) so a finished quest
  // still reads coloured without glowing at night.
  const surface = dark ? '#231838' : '#FFF7DA'
  const ink     = dark ? '#0A0517' : '#1A0F2D'
  const chipBg     = done ? (dark ? accentDeep : accent) : surface
  const chipEdge   = done && !dark ? accentDark : ink
  const titleColor = dark ? '#FBF1D9' : '#1A0F2D'
  const subColor   = done
    ? (dark ? 'rgba(251,241,217,0.85)' : '#1A0F2D')
    : (dark ? '#C9BBE0' : '#5C4E6E')
  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 12px 8px 8px',
        borderRadius: 16,
        background: chipBg,
        border: `2px solid ${chipEdge}`,
        boxShadow: `2px 3px 0 ${chipEdge}, 0 6px 16px rgba(0,0,0,0.32)`,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 32, height: 32,
          display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 9,
          background: done ? surface : accent,
          border: `2px solid ${chipEdge}`,
          color: done ? (dark ? accent : accentDark) : '#1A0F2D',
        }}
      >
        {done
          ? <Check size={18} strokeWidth={3} />
          : <Icon size={18} strokeWidth={2.4} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 900,
          color: titleColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          letterSpacing: 0.1,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          color: subColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginTop: 1,
          letterSpacing: 0.2,
        }}>
          {done ? 'CLAIMED' : reward}
        </div>
      </div>
    </div>
  )
}
