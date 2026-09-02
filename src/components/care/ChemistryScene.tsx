'use client'

// Chemistry lab — Eren-style room hosting the periodic-table study system
// (ported in phases from AminaChemistry). Phase 1 wires the bottom STUDY
// button to a placeholder overlay; the actual table / modes / SRS land in
// follow-up phases.

import { useEffect, useState } from 'react'
import { WeatherMachinePanel } from '@/components/weather/WeatherMachine'
import WeatherMachineProp from '@/components/weather/WeatherMachineProp'
import { IconBook, IconFire, IconCheck, IconChevronDown } from '@/components/PixelIcons'
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
import BrewOverlay from '@/components/chemistry/BrewOverlay'
import BrewButton from '@/components/chemistry/BrewButton'
import { LAB_EREN } from '@/components/chemistry/labEren'
import { useStoredChemTheme } from '@/lib/chemistry/theme'
import { pixelSkin, hard, PIXEL_FONT, type PixelSkin } from '@/components/chemistry/pixel'
import { useTasks } from '@/contexts/TaskContext'
import { getDailyKey, TASK_DEFS } from '@/lib/tasks'
import RoomWeather from '@/components/weather/RoomWeather'

interface Props { onClose: () => void }

// Lab idle look (ErenLab, goggles) — default when no Closet skin is set. The
// measurements live in components/chemistry/labEren so the Brew bench can put
// the same goggled cat next to its flask.
const CHEM_EREN_FALLBACK = LAB_EREN

export default function ChemistryScene(_props: Props) {
  void _props
  const isDark = useIsDark()
  const chemEren = useRoomEren('chemistry', CHEM_EREN_FALLBACK)
  // The lab has no care action of its own — this runner exists purely so he
  // still purrs when you tap him, like every other room.
  const reaction = useErenReaction()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [brewOpen, setBrewOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)
  // Whether today's brew is already filled, so the beaker on the button reads
  // as done. Re-checked whenever the overlay closes.
  const [brewDone, setBrewDone] = useState(false)
  useEffect(() => {
    if (brewOpen) return
    try { setBrewDone(localStorage.getItem(`eren_brew_done_${getDailyKey()}`) === '1') }
    catch { /* private mode */ }
  }, [brewOpen])

  function openStudy() {
    playSound('ui_tap')
    setOverlayOpen(true)
  }

  function openBrew() {
    playSound('ui_tap')
    setBrewOpen(true)
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
      <RoomMissionChips night={isDark} />


      {/* ══ EREN ══ sits on the rug. Halfway between the original (too far)
          and the previous bump (too close) — then nudged 3% further back once
          the bench grew a second slab. Percentage, not px, so the clearance
          holds on a short phone instead of the buttons eating his paws. */}
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
          actually is. Mounted AFTER Eren so document order can never sort it
          in front of him; it carries its own zIndex 8 either way. */}
      <WeatherMachineProp onOpen={() => { setWeatherOpen(true) }} />

      {/* ══ BOTTOM ACTION BUTTONS ══
          Two chemistry-dressed pixel slabs SIDE BY SIDE at the bottom of the
          room. They were stacked, which cost a whole row for two buttons that
          say the same amount; both were rebuilt to survive at half width (see
          the note at the head of each). Honours the iOS / Android safe-area
          inset so the row doesn't sit under the home indicator. */}
      <div className="absolute inset-x-0 flex justify-center gap-2.5 z-20 px-5"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex w-full gap-2.5" style={{ maxWidth: 380 }}>
          <BrewButton onClick={openBrew} done={brewDone} />
          <PeriodicTableButton onClick={openStudy} />
        </div>
      </div>

      {weatherOpen && <WeatherMachinePanel onClose={() => setWeatherOpen(false)} />}

      <LightSwitch targetBottom="22%" targetLeft="50%" persistKey="chemistry" />

      {overlayOpen && (
        <PeriodicTableOverlay onClose={() => setOverlayOpen(false)} />
      )}

      {brewOpen && (
        <BrewOverlay onClose={() => setBrewOpen(false)} />
      )}
    </div>
  )
}

// ── Daily mission chips, top-left in the room ──────────────────────────
// Sits under StatsHeader (z-[60]) so the bar takes precedence. Two chips,
// two lines each (title + reward), state-aware.
//
// Dressed from the shared chemistry pixel kit so the chips, the brew bench
// and the study overlay are visibly one system: 3px edge, hard offset
// shadow, Press Start 2P, pixel icons. The one deliberate departure from
// the house rule is the soft lift under the hard shadow — these float over
// room ART rather than over a panel, and without it they read as muddy on
// the night wall.
//
// The chips go dark when night falls OR when the chemistry overlay is in
// dark mode — bright parchment glows too hard against the night room art.
// Note the overlay theme DEFAULTS to dark, so out of the box the chips run
// dark even by day; flipping the overlay to light restores the warm look.
function RoomMissionChips({ night }: { night: boolean }) {
  const { completedIds } = useTasks()
  const chemTheme = useStoredChemTheme()
  const skin = pixelSkin(night || chemTheme === 'dark' ? 'dark' : 'light')
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
  const rewardText = (t: typeof lessonDef) => `+${t.coins} COINS +${t.xp} XP`
  return (
    <div
      className="absolute z-20 pointer-events-none flex flex-col gap-2"
      style={{
        // Bumped down 110 → 150 so the chips clear the chemistry wall
        // diagram (proton / neutron / electron poster) in the room art.
        top: 'calc(150px + env(safe-area-inset-top, 0px))',
        left: 10,
        // The chips want 159px in Press Start 2P (measured, longest line is
        // "FINISH A LESSON" at 7px). 200 leaves headroom without eating half
        // the room; the vw clamp means a narrow phone crops the ROOM, never
        // the panel.
        maxWidth: 'min(200px, calc(100vw - 20px))',
      }}
    >
      {/* Section header — toggle button. Tapping collapses both chips back
          up into this slab; tapping again pops them out. Same surface as
          the chips so the three pieces read as one unit. */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="chem-pixel-btn"
        style={{
          pointerEvents: 'auto',
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 8px',
          background: skin.panel,
          border: `2px solid ${skin.edge}`,
          boxShadow: `${hard(skin.ink)}, 0 4px 12px rgba(0,0,0,0.35)`,
          fontFamily: PIXEL_FONT,
          fontSize: 6,
          letterSpacing: 0.8,
          lineHeight: 1.4,
          color: skin.fg,
          marginBottom: 2,
        }}
      >
        DAILY CHEM QUESTS
        <span aria-hidden style={{
          display: 'inline-flex',
          transform: expanded ? 'rotate(180deg)' : undefined,
        }}>
          <IconChevronDown size={10} tone={skin.gold} />
        </span>
      </button>
      <Collapsible expanded={expanded} delayMs={0}>
        <MissionChip
          Icon={IconBook}
          title="FINISH A LESSON"
          reward={rewardText(lessonDef)}
          done={lessonDone}
          accent="#FCD34D"
          skin={skin}
        />
      </Collapsible>
      <Collapsible expanded={expanded} delayMs={50}>
        <MissionChip
          Icon={IconFire}
          title="5 IN A ROW"
          reward={rewardText(streakDef)}
          done={streakDone}
          accent="#C4A7F5"
          skin={skin}
        />
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

// A claimed chip wears its accent solid with dark text, in BOTH skins —
// that's the app's bright-accent-plus-ink-text convention, and it retires
// the old three-tier accent/accentDark/accentDeep dance that existed only
// to keep cream text legible on amber.
function MissionChip({ Icon, title, reward, done, accent, skin }: {
  Icon: React.ComponentType<{ size?: number }>
  title: string; reward: string; done: boolean; accent: string; skin: PixelSkin
}) {
  const body = done ? skin.onAccent : skin.fg
  const sub = done ? skin.onAccent : skin.fgDim
  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 8px 6px 6px',
        background: done ? accent : skin.panel,
        border: `2px solid ${skin.edge}`,
        boxShadow: `${hard(skin.ink)}, 0 4px 12px rgba(0,0,0,0.35)`,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 24, height: 24,
          display: 'grid', placeItems: 'center',
          background: done ? skin.panel : accent,
          border: `2px solid ${skin.edge}`,
          boxShadow: hard(skin.ink, 2),
        }}
      >
        {done ? <IconCheck size={13} tone="#4ADE80" /> : <Icon size={13} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: PIXEL_FONT,
          fontSize: 7,
          letterSpacing: 0.3,
          lineHeight: 1.5,
          color: body,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: PIXEL_FONT,
          fontSize: 5.5,
          letterSpacing: 0.2,
          lineHeight: 1.6,
          color: sub,
          marginTop: 3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {done ? 'CLAIMED' : reward}
        </div>
      </div>
    </div>
  )
}
