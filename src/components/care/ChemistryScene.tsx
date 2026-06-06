'use client'

// Chemistry lab — Eren-style room hosting the periodic-table study system
// (ported in phases from AminaChemistry). Phase 1 wires the bottom STUDY
// button to a placeholder overlay; the actual table / modes / SRS land in
// follow-up phases.

import { useState } from 'react'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'
import PeriodicTableOverlay from '@/components/chemistry/PeriodicTableOverlay'
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

export default function ChemistryScene(_props: Props) {
  void _props
  const isDark = useIsDark()
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
      <RoomMissionChips />


      {/* ══ EREN ══ sits on the rug. Halfway between the original (too far)
          and the previous bump (too close). */}
      <div className="absolute z-10" style={{
        bottom: '18%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        <ErenIdleLayer>
          <BlinkingEren
            size={230}
            src="/ErenLab.png"
            eyes={LAB_EYES}
            lidColor={LAB_LID_COLOR}
            glintBackground={LAB_GLINT}
          />
        </ErenIdleLayer>
      </div>

      {/* ══ BOTTOM ACTION BUTTON ══
          Pixel-art slab anchored to the bottom of the room. Honours the
          iOS / Android safe-area inset so it doesn't sit under the home
          indicator on devices that have one. */}
      <div className="absolute inset-x-0 flex justify-center z-20 px-8"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <button
          type="button"
          onClick={openStudy}
          className="w-full max-w-xs py-3 text-white transition-all active:translate-y-[2px]"
          style={{
            background: 'linear-gradient(135deg, #84CC16, #65A30D)',
            borderRadius: 3,
            border: '2px solid #3F6212',
            boxShadow: '0 3px 0 #1A2E05',
            fontFamily: '"Press Start 2P"',
            fontSize: 8,
            letterSpacing: 1.5,
          }}>
          PERIODIC TABLE
        </button>
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
function RoomMissionChips() {
  const { completedIds } = useTasks()
  const dailyKey = getDailyKey()
  const lessonDone = completedIds.has(`daily_chem_lesson:${dailyKey}`)
  const streakDone = completedIds.has(`daily_chem_streak:${dailyKey}`)
  return (
    <div
      className="absolute z-20 pointer-events-none flex flex-col gap-1.5"
      style={{
        top: 'calc(96px + env(safe-area-inset-top, 0px))',
        left: 10,
        maxWidth: 168,
      }}
    >
      <MissionChip
        icon="📚"
        title="Finish a lesson"
        reward="+10c · +15xp"
        done={lessonDone}
        accent="#FCD34D"
      />
      <MissionChip
        icon="🔥"
        title="5 in a row"
        reward="+15c · +20xp"
        done={streakDone}
        accent="#C4A7F5"
      />
    </div>
  )
}

function MissionChip({ icon, title, reward, done, accent }: {
  icon: string; title: string; reward: string; done: boolean; accent: string
}) {
  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px 6px 6px',
        borderRadius: 14,
        background: done ? accent : 'rgba(20, 12, 40, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
        opacity: done ? 0.92 : 1,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 26, height: 26,
          display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
          background: done ? 'rgba(0,0,0,0.18)' : accent,
          fontSize: 14,
        }}
      >
        {done ? '✓' : icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 800,
          color: done ? '#1A0F2D' : '#F4EEE2',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          letterSpacing: 0.2,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 8,
          fontWeight: 700,
          color: done ? 'rgba(26,15,45,0.66)' : 'rgba(244,238,226,0.62)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {done ? 'Claimed' : reward}
        </div>
      </div>
    </div>
  )
}
