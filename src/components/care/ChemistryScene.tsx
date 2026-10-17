'use client'

// Chemistry lab — Eren-style room hosting the periodic-table study system
// (ported in phases from AminaChemistry). Phase 1 wires the bottom STUDY
// button to a placeholder overlay; the actual table / modes / SRS land in
// follow-up phases.

import { useState } from 'react'
import { WeatherMachinePanel } from '@/components/weather/WeatherMachine'
import WeatherMachineProp from '@/components/weather/WeatherMachineProp'
import { IconBook, IconFire } from '@/components/PixelIcons'
import { CheckDisc, FONT_ROUNDED, M, MeadowIcon, TINT } from '@/components/meadow'
import BlinkingEren from '@/components/BlinkingEren'
import { useRoomEren } from '@/hooks/useRoomEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import { useErenReaction } from '@/hooks/useErenReaction'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'
import PeriodicTableOverlay from '@/components/chemistry/PeriodicTableOverlay'
import PeriodicTableButton from '@/components/chemistry/PeriodicTableButton'
import CauldronProp from '@/components/potions/CauldronProp'
import PotionMixer from '@/components/potions/PotionMixer'
import { LAB_EREN } from '@/components/chemistry/labEren'
import { useTasks } from '@/contexts/TaskContext'
import { getDailyKey, TASK_DEFS } from '@/lib/tasks'
import RoomWeather from '@/components/weather/RoomWeather'

interface Props { onClose: () => void }

// Lab idle look (ErenLab, goggles) — default when no Closet skin is set. The
// measurements live in components/chemistry/labEren, beside the sprite.
const CHEM_EREN_FALLBACK = LAB_EREN

export default function ChemistryScene(_props: Props) {
  void _props
  const isDark = useIsDark()
  const chemEren = useRoomEren('chemistry', CHEM_EREN_FALLBACK)
  // The lab has no care action of its own — this runner exists purely so he
  // still purrs when you tap him, like every other room.
  const reaction = useErenReaction()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const [mixerOpen, setMixerOpen] = useState(false)

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

      {/* Whatever sky the household hung outside this window. Layer 1: over
          the room art, under every prop, character and sheet in here. It has
          to live INSIDE the scene — the scene root is its own stacking
          context, so a sibling of it can only be over the whole room or under
          it, and "over" put the window on top of the fridge shop. */}
      <RoomWeather room="chemistry" dark={isDark} />

      {/* ══ DAILY MISSIONS ══
          Floats at the top-left just under StatsHeader so the user sees
          what's worth doing today before tapping into the lab. Moved out
          of the overlay (was taking a whole strip in there). */}
      <RoomMissionChips />


      {/* ══ EREN ══ sits on the rug, clear of the study button below him.
          Percentage, not px, so the clearance holds on a short phone instead
          of the button eating his paws. */}
      <div className="absolute z-10" style={{
        bottom: '21%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        <PetTarget reaction={reaction}>
          <ErenIdleLayer disabled={reaction.active}>
            <BlinkingEren size={230} {...chemEren} />
          </ErenIdleLayer>
        </PetTarget>

        {/* Tap-to-pet purr. */}
        {reaction.phase === PURR && <PurrFx bottom="60%" />}
      </div>

      {/* ══ THE WEATHER MACHINE ══
          It used to be a third slab in the row below. A machine is not a menu
          item, and the row could not afford it: standing it on the floorboards
          gave the room back ~110px and put the thing you tap where the thing
          actually is. It carries its own zIndex (11, over Eren) and the reason
          is written on it — Eren's hit box is a square with wide transparent
          margins, and underneath it half this machine was untappable. */}
      <WeatherMachineProp onOpen={() => { setWeatherOpen(true) }} />

      {/* ══ THE CAULDRON ══ the Potion Mixer, standing on the floor across
          the rug from the machine: a pot is where potions come from. */}
      <CauldronProp onOpen={() => setMixerOpen(true)} />

      {/* ══ THE STUDY BUTTON ══ centred at the bottom of the room, at the
          width it was drawn for (see the note at the head of
          PeriodicTableButton). Honours the iOS / Android safe-area inset so it
          doesn't sit under the home indicator. */}
      <div className="absolute inset-x-0 flex justify-center z-20 px-5"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex w-full" style={{ maxWidth: 200 }}>
          <PeriodicTableButton onClick={openStudy} />
        </div>
      </div>

      {weatherOpen && <WeatherMachinePanel onClose={() => setWeatherOpen(false)} />}

      <LightSwitch targetBottom="22%" targetLeft="50%" persistKey="chemistry" />

      {overlayOpen && (
        <PeriodicTableOverlay onClose={() => setOverlayOpen(false)} />
      )}

      {mixerOpen && <PotionMixer onClose={() => setMixerOpen(false)} />}
    </div>
  )
}

// ── Daily mission chips, top-left in the room ──────────────────────────
// Sits under StatsHeader (z-[60]) so the bar takes precedence. A header pill
// that folds them away, then two chips, two lines each (title + reward),
// state-aware.
//
// White Meadow pieces on the room art like every other room's overlays: the
// over-art lip, no glow, the quest's pixel icon on a tinted tile, and a leaf
// check once it's done. White reads on the night wall as well as the day
// one, so there is no longer a separate night skin.
function RoomMissionChips() {
  const { completedIds } = useTasks()
  // Default expanded so the player sees today's chem quests on entry; the
  // header pill is a button that collapses the chips back into itself.
  const [expanded, setExpanded] = useState(true)
  const dailyKey = getDailyKey()
  const lessonDone = completedIds.has(`daily_chem_lesson:${dailyKey}`)
  const streakDone = completedIds.has(`daily_chem_streak:${dailyKey}`)
  // Reward text is derived from the task defs (the source of truth for the
  // actual payout) so the chips can't drift out of sync — they once showed a
  // stale +10/+15 while the quests already paid 35 each.
  const lessonDef = TASK_DEFS.find(t => t.id === 'daily_chem_lesson')!
  const streakDef = TASK_DEFS.find(t => t.id === 'daily_chem_streak')!
  return (
    <div
      className="meadow-root absolute z-20 pointer-events-none flex flex-col"
      style={{
        gap: 8,
        // Bumped down 110 → 150 so the chips clear the chemistry wall
        // diagram (proton / neutron / electron poster) in the room art.
        top: 'calc(150px + env(safe-area-inset-top, 0px))',
        left: 12,
        // The vw clamp means a narrow phone crops the ROOM, never the chip.
        maxWidth: 'min(210px, calc(100vw - 24px))',
      }}
    >
      {/* Header — the toggle. Tapping folds both chips back up into it;
          tapping again brings them out. */}
      <button
        type="button"
        onClick={() => { playSound('ui_tap'); setExpanded(e => !e) }}
        aria-expanded={expanded}
        className="m-lip m-focus"
        style={{
          '--m-lip': M.overArtLip,
          '--m-lip-h': '3px',
          pointerEvents: 'auto',
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 34,
          padding: '0 8px 0 14px',
          border: 0,
          borderRadius: 999,
          background: '#FFFFFF',
          fontFamily: FONT_ROUNDED,
          fontSize: 13,
          fontWeight: 800,
          color: M.text,
          cursor: 'pointer',
        } as React.CSSProperties}
      >
        Lab quests
        <span aria-hidden style={{
          display: 'inline-flex',
          transform: expanded ? 'rotate(-90deg)' : 'rotate(90deg)',
          transition: 'transform 160ms ease',
        }}>
          <MeadowIcon name="chevronRight" size={18} color={M.text2} />
        </span>
      </button>
      <Collapsible expanded={expanded} delayMs={0}>
        <MissionChip Icon={IconBook} title="Finish a lesson" coins={lessonDef.coins} xp={lessonDef.xp}
          done={lessonDone} tint={TINT.amber} />
      </Collapsible>
      <Collapsible expanded={expanded} delayMs={50}>
        <MissionChip Icon={IconFire} title="5 in a row" coins={streakDef.coins} xp={streakDef.xp}
          done={streakDone} tint={TINT.lilac} />
      </Collapsible>
    </div>
  )
}

// Wrapper that animates its child into / out of the header slab. When
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
          `max-height 260ms steps(6) ${delayMs}ms`,
          `opacity 200ms steps(4) ${delayMs}ms`,
          `transform 260ms steps(6) ${delayMs}ms`,
        ].join(', '),
      }}
    >
      {children}
    </div>
  )
}

// One quest: its pixel icon on a tinted tile, the name, and what it pays —
// or a leaf check and "Done" once claimed.
function MissionChip({ Icon, title, coins, xp, done, tint }: {
  Icon: React.ComponentType<{ size?: number }>
  title: string; coins: number; xp: number; done: boolean; tint: string
}) {
  return (
    <div
      style={{
        // No pointerEvents:'auto' here on purpose. A chip has no onClick — only
        // the header above it toggles — so switching it on bought nothing and
        // cost real estate: on a short viewport these chips reach down over the
        // weather machine, and an interactive div with no handler turns that
        // overlap into a dead zone that swallows taps meant for the machine.
        // The container is pointer-events-none, so leaving it alone lets taps
        // fall through to whatever is actually underneath.
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px 8px 8px',
        borderRadius: 18,
        background: '#FFFFFF',
        boxShadow: `0 3px 0 ${M.overArtLip}`,
      }}
    >
      <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{
        width: 36, height: 36, borderRadius: 12, background: done ? M.leafTint : tint,
      }}>
        {done ? <CheckDisc size={24} /> : <Icon size={20} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 14, lineHeight: 1.25, fontWeight: 800, color: M.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </div>
        <div className="flex items-center" style={{
          gap: 3, marginTop: 2, fontSize: 12, fontWeight: 700,
          color: done ? M.leafInk : M.text2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        }}>
          {done ? 'Done for today' : <>
            <MeadowIcon name="coin" size={14} />+{coins}
            <span style={{ margin: '0 3px', color: M.faint }}>·</span>
            +{xp} XP
          </>}
        </div>
      </div>
    </div>
  )
}
