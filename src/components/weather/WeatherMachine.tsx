'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE WEATHER MACHINE PANEL — what opens when you tap the machine in the Lab.
//
// It is two screens behind one door, and which one you get is not a setting:
//
//   NOT BUILT  the workbench. Four slots, four parts, what each one bolts on
//              and who paid for it. There is no picker at all, because a
//              machine with no dish cannot point at anything.
//   BUILT      the picker. Every sky, no padlocks, no prices — that is what
//              finishing it bought. A dial per window, and a lever to commit.
//
// Buying a sky and deciding where it hangs used to be different places, and
// splitting them was right; what was wrong was that there were TEN things to
// buy, which made the sky a wardrobe. Now there is one thing to own and it is
// this machine, so the shop and the workbench sell the same four parts and the
// picker is a reward rather than a catalogue.
//
// IT EDITS A DRAFT AND SAVES ONCE. `room_weather` is a single jsonb column, so
// every write replaces the whole room→sky map. Writing on each tap meant
// rebuilding that map from the last value the client had seen, and two taps
// inside one realtime round-trip both rebuilt from the same stale copy — the
// second erasing the first. "This sky in every window" did that seven times
// and left one window changed. So: pick freely, then commit the map once.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyCosmetics, sameMap } from '@/hooks/useTrophyCosmetics'
import { useWeatherMachine } from '@/hooks/useWeatherMachine'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useIsDark } from '@/hooks/useIsDark'
import {
  WEATHER, WEATHER_BY_ID, weatherDef, skyBlockedIn, skyBlurbIn, roomIsNightOnly,
  type WeatherId, type WeatherDef,
} from '@/lib/weather'
import { MACHINE_PARTS, type MachinePart } from '@/lib/weatherMachine'
import { WEATHER_ROOMS, ROOM_WINDOWS } from '@/lib/roomWindows'
import { shopItem } from '@/lib/trophyShop'
import WeatherFx from './WeatherFx'
import { MachineArt, MACHINE_W, MACHINE_H } from './WeatherMachineProp'
import TrophyBuySheet from '@/components/trophies/TrophyBuySheet'
import {
  IconClose, IconChevronRight, IconCheck, IconMoon,
  IconHouse, IconMeat, IconYarn, IconBath, IconFlask, IconSpeech,
} from '@/components/PixelIcons'
import TrophyCup from '@/components/trophies/TrophyCup'
import { playSound } from '@/lib/sounds'

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

const SHELL: React.CSSProperties = {
  background: 'radial-gradient(120% 70% at 50% 0%, #16233A 0%, #0B1120 55%, #05070E 100%)',
}

export function WeatherMachinePanel({ onClose }: { onClose(): void }) {
  const trophies = useTrophies()
  const machine = useWeatherMachine()
  // Owned HERE, not inside the workbench: fitting the fourth part swaps the
  // workbench for the picker, and a sheet rendered inside the workbench would
  // be torn out mid-confirmation — losing the one beat the whole build was for.
  const [buying, setBuying] = useState<MachinePart | null>(null)

  return createPortal(
    <div className="fixed inset-0 z-[150] flex flex-col" style={SHELL}>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.22) 3px 4px)',
      }} />

      {/* ── Header ── */}
      <div className="relative flex items-center gap-3 px-3 py-3 flex-shrink-0" style={{
        borderBottom: '2px solid rgba(120,200,255,0.35)',
        background: 'linear-gradient(180deg, rgba(20,36,58,0.8), rgba(10,16,28,0.5))',
      }}>
        <span className="font-pixel flex-1" style={{
          fontSize: 9, letterSpacing: 2.5, color: '#8FE0FF',
          textShadow: '0 0 7px rgba(120,200,255,0.5)',
        }}>WEATHER MACHINE</span>
        {/* The wallet belongs to the WORKBENCH, where the four parts have
            prices. On the picker nothing costs anything — that is what
            finishing the machine bought — so a running balance in the corner is
            a number with no question attached to it, in the same gold the panel
            uses to mean "unsaved". */}
        {!machine.built && (
          <span className="flex items-center gap-1.5 px-2 py-1" style={{
            border: '1.5px solid rgba(245,200,66,0.5)', borderRadius: 3,
            background: 'rgba(245,200,66,0.1)',
          }}>
            <TrophyCup tier="gold" size={13} shine={false} />
            <span className="font-pixel" style={{ fontSize: 9, color: '#FDE68A' }}>
              {trophies.loaded ? trophies.balance : '—'}
            </span>
          </span>
        )}
        <button onClick={() => { playSound('ui_back'); onClose() }}
          aria-label="Close" className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform">
          <IconClose size={15} />
        </button>
      </div>

      {/* THREE states, not two. An unanswered wallet is not an unbuilt machine —
          but it is not a built one either, and the picker's lever WRITES. So
          while the read is in flight neither screen is honest: show the dials
          warming up instead, and let onForeground retry underneath. */}
      {!machine.loaded
        ? <WarmingUp />
        : machine.built
          ? <PickerScreen />
          : <BuildScreen machine={machine} onBuy={setBuying} />}

      {/* Above the panel's own 150, or the sheet opens underneath it. */}
      {buying && (
        <TrophyBuySheet
          item={shopItem(buying.itemId)!}
          z={165}
          onClose={() => setBuying(null)}
        />
      )}
    </div>,
    document.body,
  )
}

// The beat between opening the door and knowing what is behind it. Deliberately
// not a spinner and not an empty panel: the machine's own lamps, unlit.
function WarmingUp() {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-2">
        {MACHINE_PARTS.map((p, i) => (
          <span key={p.id} className="wx-lamp" style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#2A3145', border: '1px solid #080A11',
            animationDelay: `${i * 0.26}s`,
          }} />
        ))}
      </div>
      <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#4E627E' }}>
        READING THE DIALS
      </span>
    </div>
  )
}

// ═══ THE WORKBENCH ═══════════════════════════════════════════════════════════

// Exported so a throwaway preview route can render it at a chosen build state
// without a Supabase session — same reason ShopCard is exported.
export function BuildScreen({ machine, onBuy }: {
  machine: ReturnType<typeof useWeatherMachine>
  onBuy(part: MachinePart): void
}) {
  const scale = 1.55
  // The tag's overhang above the machine's box, scaled up with it.
  const TAG_ROOM = Math.ceil(26 * scale)

  return (
    <>
      <div className="relative flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4">

        {/* The machine as it actually stands right now, blown up. Seeing the
            thing you are paying for is the whole pitch. */}
        {/* TAG_ROOM is not padding-for-looks. The prop hangs its WEATHER n/4
            tag ABOVE its own box — up to 26px, once a dish pushes it clear —
            and this hero sits at the very top of an `overflow-y-auto` column.
            Content that overflows the block-start edge of a scroll box is
            clipped and cannot be scrolled back to, so without room reserved
            here the tag is simply sliced off. */}
        <div className="relative mx-auto flex-shrink-0" style={{
          width: MACHINE_W * scale, height: MACHINE_H * scale + TAG_ROOM,
        }}>
          <div style={{
            position: 'absolute', left: '50%', top: TAG_ROOM,
            width: MACHINE_W, height: MACHINE_H,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: 'top center',
          }}>
            <MachineArt
              installed={machine.installed}
              total={machine.total}
              has={machine.has}
              sky="clear"
            />
          </div>
        </div>

        <p className="text-center text-[11px] px-2" style={{ color: '#8FA6C0' }}>
          Somebody left it in the corner of the Lab with four pieces missing.
          Put them all back and every sky in the game is yours — for good, in
          any window.
        </p>

        <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#6E86A8' }}>
          WHAT IT IS STILL MISSING
        </span>

        <div className="flex flex-col gap-2">
          {MACHINE_PARTS.map(p => (
            <PartSlot key={p.id} part={p} machine={machine} onBuy={() => onBuy(p)} />
          ))}
        </div>

        <Link href="/trophies" onClick={() => playSound('ui_tap')}
          className="flex items-center gap-2 px-3 py-2.5"
          style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px dashed rgba(255,255,255,0.16)', borderRadius: 4,
          }}>
          <TrophyCup tier="gold" size={14} shine={false} />
          <span className="flex-1">
            <span className="font-pixel block" style={{ fontSize: 6, letterSpacing: 1, color: '#D6CBE2' }}>
              WHERE TROPHIES COME FROM
            </span>
            <span className="text-[10px]" style={{ color: '#7E90A8' }}>
              Win a day of the Care Battle. The parts are on the shelf there too.
            </span>
          </span>
          <IconChevronRight size={11} />
        </Link>
      </div>

      <BuildBar machine={machine} />
    </>
  )
}

// One slot on the rack. Fitted slots say WHO fitted them, which is the whole
// point of letting either partner buy any part.
function PartSlot({ part, machine, onBuy }: {
  part: MachinePart
  machine: ReturnType<typeof useWeatherMachine>
  onBuy(): void
}) {
  const { user } = useAuth()
  const { partner } = useCouple()
  const trophies = useTrophies()

  const fitted = machine.has(part.id)
  const byMe = fitted && machine.fitterOf(part.id) === user?.id
  const who = byMe ? 'you' : (partner?.name?.split(' ')[0] || 'them')
  const affordable = trophies.balance >= part.price

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2" style={{
      background: fitted ? 'rgba(99,240,148,0.08)' : 'rgba(255,255,255,0.035)',
      border: `2px solid ${fitted ? 'rgba(99,240,148,0.45)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 4,
      boxShadow: fitted ? '0 0 10px rgba(99,240,148,0.15)' : undefined,
    }}>
      <PartGlyph part={part} lit={fitted} />

      <span className="flex-1 min-w-0">
        <span className="font-pixel block truncate" style={{
          fontSize: 7, letterSpacing: 0.5, color: fitted ? '#A7F3C0' : part.tone,
        }}>{part.name.toUpperCase()}</span>
        <span className="block text-[10px] mt-0.5" style={{ color: '#7E90A8' }}>
          {fitted ? `Fitted by ${who}.` : part.blurb}
        </span>
      </span>

      {fitted ? (
        <span className="flex items-center gap-1 flex-shrink-0 px-1.5">
          <IconCheck size={11} tone="#4ADE80" />
        </span>
      ) : (
        <button onClick={() => { playSound('ui_select'); onBuy() }}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 active:translate-y-[1px] transition-transform"
          style={{
            border: `1.5px solid ${affordable ? '#63F094' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 3,
            background: affordable
              ? 'linear-gradient(180deg, rgba(99,240,148,0.22) 0%, rgba(99,240,148,0.06) 100%)'
              : 'rgba(255,255,255,0.04)',
            opacity: affordable ? 1 : 0.6,
          }}>
          <TrophyCup tier="gold" size={10} shine={false} />
          <span className="font-pixel" style={{
            fontSize: 7, color: affordable ? '#A7F3C0' : '#8B99AD',
          }}>{part.price}</span>
        </button>
      )}
    </div>
  )
}

// A 26px pictogram of the piece itself — the same silhouette it will wear on
// the machine, so the slot and the bolted-on part are recognisably one thing.
export function PartGlyph({ part, lit, size = 26 }: {
  part: MachinePart; lit?: boolean; size?: number
}) {
  const ink = '#080A11'
  // Dimmed, not hidden. A part you have not bought still has to be
  // recognisable as the thing that will show up on the machine — knock it back
  // far enough and the row is four identical grey smudges.
  const dim = lit ? undefined : 'grayscale(0.5) brightness(0.85)'
  const s = (n: number) => Math.round((n / 26) * size)

  return (
    <span aria-hidden className="relative flex-shrink-0" style={{
      width: size, height: size, filter: dim,
    }}>
      {part.id === 'coil' && (
        <span style={{
          position: 'absolute', left: s(8), top: s(2), width: s(10), height: s(22),
          // Wound copper, matching the tube on the prop. This used to be the
          // old cream-to-rust ramp, so the row showed a different object from
          // the one the purchase actually bolts on.
          background: `repeating-linear-gradient(162deg,
            #5E2A11 0 2px, #C8761F 2px 4px, #7E3A14 4px 6px)`,
          border: `2px solid ${ink}`, borderRadius: s(4),
        }} />
      )}
      {part.id === 'gauge' && (
        <span style={{
          position: 'absolute', left: s(2), top: s(2), width: s(22), height: s(22),
          borderRadius: '50%',
          background: 'radial-gradient(circle at 36% 30%, #FFF3D0 0%, #E8C88A 46%, #8A6A2E 100%)',
          border: `2px solid ${ink}`,
        }}>
          <span style={{
            position: 'absolute', left: '50%', bottom: '50%',
            width: 2, height: s(7), marginLeft: -1,
            background: '#3A2408', transform: 'rotate(32deg)', transformOrigin: 'bottom center',
          }} />
        </span>
      )}
      {part.id === 'dish' && (
        <>
          {/* A flat ELLIPSE with a feed horn standing off it, which is what
              the prop draws. The dome-on-a-stick this used to be read as a
              mushroom, and it was a different object from the one the card
              sells. */}
          <span style={{
            position: 'absolute', left: s(1), top: s(5), width: s(24), height: s(10),
            background: 'linear-gradient(180deg, #8FA6C4 0%, #55668A 60%, #2B3550 100%)',
            border: `2px solid ${ink}`, borderRadius: '50%',
          }} />
          <span style={{
            position: 'absolute', left: '50%', top: s(13), marginLeft: -2,
            width: 4, height: s(11), background: '#2A3145', border: `1px solid ${ink}`,
          }} />
          <span style={{
            position: 'absolute', left: s(11), top: s(2), width: s(5), height: s(4),
            background: '#E8C88A', border: `1px solid ${ink}`, borderRadius: 1,
          }} />
        </>
      )}
      {part.id === 'lever' && (
        <>
          <span style={{
            position: 'absolute', left: s(4), top: s(15), width: s(11), height: s(9),
            background: '#4A5570', border: `2px solid ${ink}`, borderRadius: 2,
          }} />
          <span style={{
            position: 'absolute', left: s(10), top: s(6), width: 4, height: s(12),
            background: '#C9D4E8', border: `1px solid ${ink}`,
            transform: 'rotate(18deg)', transformOrigin: 'bottom center',
          }} />
          <span style={{
            position: 'absolute', left: s(12), top: s(1), width: s(10), height: s(10),
            borderRadius: '50%',
            background: 'radial-gradient(circle at 34% 30%, #FFC7BC, #E5453A 58%, #7A1610 100%)',
            border: `2px solid ${ink}`,
          }} />
        </>
      )}
    </span>
  )
}

// The footer on the workbench. Deliberately the same shape and place as the
// picker's SAVE lever, so finishing the build lands the player's thumb exactly
// where the next screen wants it.
function BuildBar({ machine }: { machine: ReturnType<typeof useWeatherMachine> }) {
  return (
    <div className="relative flex-shrink-0 px-3 pt-2" style={{
      paddingBottom: 'calc(var(--safe-bottom) + 10px)',
      borderTop: '2px solid rgba(120,200,255,0.28)',
      background: 'linear-gradient(0deg, rgba(10,16,28,0.96), rgba(16,26,44,0.8))',
    }}>
      <div className="flex items-center gap-1.5 mb-2">
        {MACHINE_PARTS.map(p => (
          <span key={p.id} className="flex-1" style={{
            height: 6,
            background: machine.has(p.id)
              ? 'linear-gradient(180deg, #8DF7B4 0%, #1E9A5A 100%)'
              : 'rgba(255,255,255,0.07)',
            border: `1px solid ${machine.has(p.id) ? '#0B3A22' : 'rgba(255,255,255,0.12)'}`,
            boxShadow: machine.has(p.id) ? '0 0 6px rgba(99,240,148,0.4)' : undefined,
          }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#DCEEFF' }}>
          {machine.installed} OF {machine.total} FITTED
        </span>
        <span className="flex items-center gap-1.5">
          <TrophyCup tier="gold" size={11} shine={false} />
          <span className="font-pixel" style={{ fontSize: 7, color: '#FFCE6B' }}>
            {machine.remaining} TO GO
          </span>
        </span>
      </div>
    </div>
  )
}


// ═══ THE PICKER ══════════════════════════════════════════════════════════════
//
// ONE BIG TRUTH INSTEAD OF EIGHTEEN SMALL LIES.
//
// This screen used to mount eighteen live skies: eleven 52px tiles and seven
// 26px room chips. Three things were wrong with that at once.
//
//   THE TILES WERE THE WRONG SHAPE. Every tile was a 3.1:1 letterbox and every
//   window in the game is portrait, 0.29:1 (the playroom's slot) to 0.86:1 (the
//   living room bay) — and the effects size themselves in CONTAINER units, so a
//   tile was not a small version of the result, it was a differently shaped
//   picture assembled from the same parts. It was sold as a preview and it was
//   a different render.
//
//   THE ROOM CHIPS SAID NOTHING. Six of the seven normally show the same sky,
//   so the strip spent seven animated layers drawing one picture six times, and
//   which room was which lived in 5px type underneath it. A pixel icon answers
//   that instantly and costs nothing.
//
//   AND THE NAMES CARRIED EVERYTHING AT 6px. Rain and Thunderstorm are the same
//   picture for most of every second; Meteor Shower and Rose Meteors differ by
//   hue alone. Meanwhile weather.ts writes a sentence for every one of them and
//   this screen showed none of them.
//
// So: ONE live pane, cut to the selected room's real aperture, with that room's
// name over it and that sky's own sentence under it — and the eleven choices
// become STILL swatches. Still is not a compromise: every effect already has a
// reduced-motion resting frame, so the swatch is a real picture of that sky and
// it runs no animation at all. Eighteen live layers become one.
//
// IT EDITS A DRAFT AND SAVES ONCE — see the note at the top of this file.

const INK = '#080A11'
/** Chosen. ONE selection colour on the screen: it used to be cyan for rooms and
 *  green for skies, which made the user check whether those meant different
 *  things. Green is now the commit lever and nothing else. */
const LIVE = '#8FE0FF'
/** Edited, not committed. */
const PEND = '#FFCE6B'

// Which pixel icon stands for which window.
const ROOM_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  home: IconHouse, feed: IconMeat, play: IconYarn, sleep: IconMoon,
  wash: IconBath, chemistry: IconFlask, talk: IconSpeech,
}

/** The real shape of that room's glass, so the preview is not a letterbox. */
function apertureAspect(room: string): number {
  const w = ROOM_WINDOWS[room]
  if (!w) return 0.8
  return (w.box.w * w.art.w) / (w.box.h * w.art.h)
}

const PANE_H = 128

/** The eighth target: all seven windows at once. It used to be a full-width
 *  blue button sitting beside the save lever, which made the most far-reaching
 *  control on the screen look like a second primary action — and made "every
 *  window" an ACTION you fire rather than a PLACE you are pointing at. As a
 *  target it is self-describing (EVERY WINDOW + SNOWFALL), it cannot be fired
 *  by accident because you still have to pick a sky afterwards, and it fills
 *  the eighth cell of a 2x4 grid that otherwise ends on a hole. */
const ALL = '*'

/** Four little panes. Not an icon file, because this is not a room. */
function AllWindowsGlyph({ size = 16, tone }: { size?: number; tone: string }) {
  const c = Math.floor((size - 2) / 2)
  return (
    <span aria-hidden className="grid flex-shrink-0" style={{
      width: c * 2 + 2, height: c * 2 + 2,
      gridTemplateColumns: 'repeat(2, ' + c + 'px)', gap: 2,
    }}>
      {[0, 1, 2, 3].map(i => (
        <span key={i} style={{ width: c, height: c, background: tone, border: '1px solid ' + INK }} />
      ))}
    </span>
  )
}

/** What a window is actually showing, with a sky it cannot hold read as clear. */
function effectiveSky(map: Record<string, string>, room: string): WeatherId {
  const v = (map[room] ?? 'clear') as WeatherId
  return skyBlockedIn(room, v) ? 'clear' : v
}

/**
 * The one sky every window is showing, or null if they disagree.
 *
 * A window that CANNOT hold the candidate is allowed to differ — otherwise
 * putting a sunrise in all seven would come back reading "mixed" forever, on
 * account of the one window the rule says must not have it.
 */
function commonSky(map: Record<string, string>): WeatherId | null {
  const seen = Array.from(new Set(WEATHER_ROOMS.map(r => effectiveSky(map, r.room))))
  if (seen.length === 1) return seen[0]
  for (const cand of seen) {
    if (WEATHER_ROOMS.every(r =>
      effectiveSky(map, r.room) === cand || skyBlockedIn(r.room, cand))) return cand
  }
  return null
}

function PickerScreen() {
  const cos = useTrophyCosmetics()
  const reduced = useReducedMotion()
  // The lever WRITES THE WHOLE MAP, and `weather` falls back to {} on a row
  // that has not answered — which is indistinguishable from "every window is
  // clear". A panel opened during a slow or 503-ing read would show seven clear
  // windows, and one tap would commit that fiction over whatever the household
  // actually had. Same rule the machine's own gate follows: no verdict, and no
  // write, on a read that has not landed.
  if (!cos.weatherLoaded) return <WarmingUp />
  return <PickerView weather={cos.weather} onSave={cos.saveWeather} reduced={reduced} />
}

// The picker with its two dependencies handed to it rather than read from
// Supabase, so a throwaway preview route can render it at any state without a
// session — same reason BuildScreen is exported.
export function PickerView({ weather: live, onSave, reduced }: {
  weather: Record<string, string>
  onSave(next: Record<string, string>): Promise<boolean>
  reduced?: boolean
}) {
  const dark = useIsDark()
  const [room, setRoom] = useState<string>(WEATHER_ROOMS[0].room)
  // null = following the household. Non-null = my unsaved edit of it.
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  // Why the last tap did nothing. A dead key that says nothing reads as a bug.
  const [refused, setRefused] = useState<string | null>(null)

  const map = draft ?? live
  const dirty = draft !== null && !sameMap(draft, live)

  const isAll = room === ALL
  const nightOnly = !isAll && roomIsNightOnly(room)
  // A map saved before the night-only rule can still name a sunset for the
  // bedroom, and RoomWeather already refuses to draw one. Read it as clear here
  // too, or the panel shows this window a sky it does not have.
  const current = isAll ? commonSky(map) : effectiveSky(map, room)
  const def = weatherDef(current ?? 'clear')!
  const label = isAll
    ? 'EVERY WINDOW'
    : WEATHER_ROOMS.find(r => r.room === room)?.label ?? ''
  // The rooms this sky is refused by, named, so "every window" can say what it
  // is actually about to do instead of quietly skipping one.
  const spared = current
    ? WEATHER_ROOMS.filter(r => skyBlockedIn(r.room, current))
    : []

  function edit(next: Record<string, string>) {
    setDraft(next)
    setSave('idle')
    setRefused(null)
  }

  function goRoom(next: string) {
    playSound('ui_tap')
    setRoom(next)
    setRefused(null)
  }

  function pick(id: WeatherId) {
    if (isAll) {
      playSound('ui_select')
      const next: Record<string, string> = {}
      for (const r of WEATHER_ROOMS) {
        // A window that cannot hold this sky KEEPS ITS OWN rather than being
        // emptied — "every window" must never be a way to wipe the bedroom.
        if (skyBlockedIn(r.room, id)) {
          const had = map[r.room]
          if (had && !skyBlockedIn(r.room, had)) next[r.room] = had
          continue
        }
        if (id !== 'clear') next[r.room] = id
      }
      edit(next)
      return
    }
    const why = skyBlockedIn(room, id)
    if (why) {
      // Not a padlock — nothing here is for sale, the machine is already built.
      // This window simply cannot hold this one, and it says so in words.
      playSound('ui_back')
      setRefused(why)
      return
    }
    playSound('ui_select')
    const next = { ...map }
    if (id === 'clear') delete next[room]
    else next[room] = id
    edit(next)
  }

  async function commit() {
    if (!dirty || save === 'saving') return
    setSave('saving')
    const ok = await onSave(draft ?? {})
    if (ok) {
      playSound('level_up')
      setDraft(null)
      setSave('saved')
    } else {
      playSound('ui_back')
      setSave('failed')
    }
  }

  // Pointing at all seven, the bay shows the living room's glass — it is the
  // biggest window in the house and the one the picker opens on.
  const paneW = Math.max(36, Math.round(PANE_H * apertureAspect(isAll ? WEATHER_ROOMS[0].room : room)))
  const RoomIcon = ROOM_ICON[room]
  // The compound form, matching RoomWeather's own `lit={!dark}`. A room that is
  // always night is one reason for an unlit sky; the app being after dark is the
  // other, and the picker used to know about neither — so aurora and fireflies
  // previewed as midnight and then hung as an evening.
  const lit = !(dark || nightOnly)

  return (
    <>
      {/* ── THE WINDOW ── pinned, so the one thing that says which room you are
          editing can never scroll away from the taps that change it. */}
      <div className="relative flex-shrink-0 px-3 pt-3 pb-2">
        <div style={{
          background: 'linear-gradient(180deg, #46506B 0%, #2A3145 44%, #1B2131 100%)',
          border: '3px solid ' + INK,
          boxShadow: '3px 3px 0 rgba(0,0,0,0.55)',
          padding: 8,
        }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
            {isAll
              ? <AllWindowsGlyph size={15} tone="#8FE0FF" />
              : RoomIcon && <RoomIcon size={15} />}
            <span className="font-pixel flex-1 truncate" style={{
              fontSize: 9, letterSpacing: 1.5, color: '#EAF6FF',
            }}>{label}</span>
            {nightOnly && (
              <span className="flex items-center gap-1 flex-shrink-0 px-1.5 py-1" style={{
                border: '1px solid rgba(143,224,255,0.28)',
                background: 'rgba(143,224,255,0.08)',
              }}>
                <IconMoon size={9} />
                <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#9FC4DE' }}>
                  ALWAYS NIGHT
                </span>
              </span>
            )}
          </div>

          <div className="mx-auto relative overflow-hidden" style={{
            width: paneW, height: PANE_H,
            containerType: 'size',
            background: '#070B16',
            border: '2px solid ' + INK,
            boxShadow: 'inset 0 0 8px rgba(0,0,0,0.9), 0 0 8px rgba(120,200,255,0.25)',
          }}>
            <WeatherFx id={def.id} still={reduced} lit={lit} plate />
            <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
              background: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.11) 3px 4px)',
            }} />
          </div>

          {/* The sentence weather.ts already wrote for every sky — and the one
              place a refusal can land in words. */}
          <div style={{
            marginTop: 7, padding: '5px 7px', minHeight: 44,
            background: 'rgba(6,10,20,0.55)',
            border: '1px solid ' + (refused ? 'rgba(255,206,107,0.4)' : 'rgba(143,224,255,0.16)'),
          }}>
            <span className="font-pixel block truncate" style={{
              fontSize: 7, letterSpacing: 1,
              color: refused ? PEND : current === null ? '#9FC4DE' : def.tone,
            }}>{(refused ? 'not in here'
              : current === null ? 'mixed' : def.name).toUpperCase()}</span>
            <span className="block text-[11px] leading-snug" style={{
              color: refused ? '#FFDFA6' : '#93A7BE', marginTop: 3,
            }}>{refused
              ?? (current === null
                ? 'The seven windows are not all showing the same thing. Pick one and they will.'
                : isAll && spared.length
                  // Say what it is about to do to the window it cannot do it to,
                  // rather than skipping one quietly and never mentioning it.
                  ? skyBlurbIn(room, def.id) + ' Every window except the '
                    + spared.map(r => r.label.toLowerCase()).join(' and the ') + '.'
                  : skyBlurbIn(room, def.id))}</span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">

        {/* ── Which window ── a fixed grid, not a scroll strip. The strip cut
            the per-room unsaved mark in half against its own overflow box, and
            that mark is the only ledger of what has not been committed yet —
            and on a 640px-tall phone the whole strip collapsed to 4px, because
            a flex child in a column shrinks by default. */}
        <span className="font-pixel flex-shrink-0" style={{
          fontSize: 6, letterSpacing: 1.5, color: '#8FAECB',
        }}>WHICH WINDOW</span>

        <div className="grid flex-shrink-0" style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6,
        }}>
          {WEATHER_ROOMS.map(r => {
            const on = r.room === room
            const changed = (map[r.room] ?? '') !== (live[r.room] ?? '')
            const Icon = ROOM_ICON[r.room]
            return (
              <button key={r.room} onClick={() => goRoom(r.room)} aria-pressed={on}
                className="relative flex flex-col items-center gap-1 py-1.5 px-1 active:translate-y-[1px] transition-transform"
                style={{
                  background: on ? 'rgba(143,224,255,0.14)' : 'rgba(255,255,255,0.04)',
                  border: '2px solid ' + (on ? LIVE : 'rgba(255,255,255,0.12)'),
                  boxShadow: on
                    ? '2px 2px 0 ' + INK + ', 0 0 9px rgba(143,224,255,0.3)'
                    : '2px 2px 0 rgba(0,0,0,0.45)',
                }}>
                {Icon && <Icon size={16} />}
                <span className="font-pixel block w-full truncate text-center" style={{
                  fontSize: 5, letterSpacing: 0.5, color: on ? '#EAF6FF' : '#8CA0B8',
                }}>{r.label}</span>
                {/* INSIDE the button: the old mark hung outside its own box and
                    the strip's overflow sliced four of its seven pixels off. */}
                {changed && (
                  <span aria-label="unsaved" className="absolute" style={{
                    top: 3, right: 3, width: 6, height: 6,
                    background: PEND, border: '1px solid ' + INK,
                  }} />
                )}
              </button>
            )
          })}

          <button onClick={() => goRoom(ALL)} aria-pressed={isAll}
            className="relative flex flex-col items-center gap-1 py-1.5 px-1 active:translate-y-[1px] transition-transform"
            style={{
              background: isAll ? 'rgba(143,224,255,0.14)' : 'rgba(255,255,255,0.04)',
              border: '2px solid ' + (isAll ? LIVE : 'rgba(255,255,255,0.12)'),
              boxShadow: isAll
                ? '2px 2px 0 ' + INK + ', 0 0 9px rgba(143,224,255,0.3)'
                : '2px 2px 0 rgba(0,0,0,0.45)',
            }}>
            <AllWindowsGlyph size={16} tone={isAll ? '#EAF6FF' : '#8CA0B8'} />
            <span className="font-pixel block w-full truncate text-center" style={{
              fontSize: 5, letterSpacing: 0.5, color: isAll ? '#EAF6FF' : '#8CA0B8',
            }}>ALL 7</span>
          </button>
        </div>

        <span className="font-pixel flex-shrink-0" style={{
          fontSize: 6, letterSpacing: 1.5, color: '#8FAECB', marginTop: 4,
        }}>WHAT IT IS DOING OUT THERE</span>

        {/* Clear is pulled out of the grid on purpose. It is the only choice
            that REMOVES a layer rather than adding one — it IS the painting —
            and taking it out also takes the eleventh tile out of a two-column
            grid that could never end evenly. */}
        <SkyKey w={WEATHER_BY_ID.clear} wide on={current === 'clear'}
          blurb={skyBlurbIn(room, 'clear')}
          blocked={null} lit={lit} onPick={() => pick('clear')} />

        <div className="grid gap-2 flex-shrink-0" style={{
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}>
          {WEATHER.filter(w => w.id !== 'clear').map(w => (
            <SkyKey key={w.id} w={w} on={current === w.id}
              blocked={skyBlockedIn(room, w.id)} lit={lit}
              onPick={() => pick(w.id)} />
          ))}
        </div>
      </div>

      {/* ── The lever ── nothing reaches a window until this is pulled. */}
      <SaveBar dirty={dirty} state={save} onSave={commit} />
    </>
  )
}

// One choice. The swatch is a REAL picture of that sky — every effect already
// has a reduced-motion resting frame, so `still` costs no animation and is not
// a placeholder. `lit` matters here: aurora and fireflies paint an evening in a
// daylit room and a midnight in the bedroom, and showing the wrong one of those
// two was the old tile's own doing.
function SkyKey({ w, on, blocked, lit, wide, blurb, onPick }: {
  w: WeatherDef
  on: boolean
  /** Overrides the sky's own line when the window changes what it means. */
  blurb?: string
  /** Why this sky cannot hang in the selected window, or null. */
  blocked: string | null
  lit: boolean
  wide?: boolean
  onPick(): void
}) {
  const shape = wide
    ? 'flex-row items-center gap-2 p-1.5'
    : 'flex-col gap-1 p-1.5'
  return (
    <button onClick={onPick} aria-pressed={on} aria-disabled={!!blocked}
      className={'relative flex text-left flex-shrink-0 active:translate-y-[1px] transition-transform ' + shape}
      style={{
        background: on ? 'rgba(143,224,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: '2px solid ' + (on ? LIVE : 'rgba(255,255,255,0.12)'),
        // A key that is already DOWN cannot travel. Pressed in reads as refused
        // at every size, where "a paler rectangle" only reads as refused next
        // to one that is not.
        boxShadow: blocked
          ? 'inset 0 2px 0 rgba(0,0,0,0.75)'
          : on
            ? '2px 2px 0 ' + INK + ', 0 0 10px rgba(143,224,255,0.26)'
            : '2px 2px 0 rgba(0,0,0,0.45)',
        opacity: blocked ? 0.62 : 1,
      }}>
      <span className="relative block overflow-hidden flex-shrink-0" style={{
        width: wide ? 62 : '100%', height: wide ? 30 : 46,
        containerType: 'size',
        background: '#0A0F1E', border: '1px solid ' + INK,
        filter: blocked ? 'grayscale(1) brightness(0.55)' : undefined,
      }}>
        <WeatherFx id={w.id} still lit={lit} plate />
      </span>

      <span className={wide ? 'flex-1 min-w-0' : 'block w-full min-w-0'}>
        <span className="font-pixel block truncate" style={{
          fontSize: 6, letterSpacing: 0.5,
          color: blocked ? '#6E7E92' : on ? '#EAF6FF' : w.tone,
        }}>{w.name.toUpperCase()}</span>
        {wide && (
          <span className="block text-[10px] truncate" style={{ color: '#7E90A8', marginTop: 2 }}>
            {blurb ?? w.blurb}
          </span>
        )}
      </span>

      {/* A moon, not a padlock: this window is night, not locked. */}
      {blocked && (
        <span className="absolute flex items-center justify-center" style={{
          top: 3, right: 3, width: 15, height: 15,
          background: 'rgba(8,10,17,0.85)', border: '1px solid ' + INK,
        }}>
          <IconMoon size={9} />
        </span>
      )}
    </button>
  )
}

function SaveBar({ dirty, state, onSave }: {
  dirty: boolean; state: SaveState; onSave(): void
}) {
  const enabled = dirty && state !== 'saving'
  const label = state === 'saving' ? 'SAVING...'
    : state === 'failed' ? 'DID NOT SAVE - TRY AGAIN'
    : dirty ? 'SAVE CHANGES'
    : state === 'saved' ? 'SAVED' : 'NOTHING TO SAVE'

  const tone = state === 'failed'
    ? { a: '#B4453F', b: '#6E211D', text: '#FFE0DC' }
    : state === 'saved' && !dirty
      ? { a: '#3E8C5E', b: '#1F5238', text: '#DFFBE9' }
      : enabled
        ? { a: '#63F094', b: '#1E9A5A', text: '#04220F' }
        : { a: '#2A3145', b: '#171C29', text: '#5E6E86' }

  return (
    <div className="relative flex-shrink-0 px-3 pt-2" style={{
      paddingBottom: 'calc(var(--safe-bottom) + 10px)',
      borderTop: '2px solid ' + INK,
      background: 'linear-gradient(0deg, rgba(10,16,28,0.96), rgba(16,26,44,0.8))',
    }}>
      {/* The row is reserved whether or not it is showing, so the lever does not
          jump 11px out from under the thumb the instant the first edit lands. */}
      <span className="font-pixel block text-center" style={{
        fontSize: 5, letterSpacing: 1, color: PEND,
        height: 11, opacity: dirty ? 1 : 0,
      }}>UNSAVED - THE WINDOWS HAVE NOT CHANGED YET</span>
      <button onClick={onSave} disabled={!enabled}
        className="w-full flex items-center justify-center gap-2 py-3 active:translate-y-[1px] transition-transform"
        style={{
          background: 'linear-gradient(180deg, ' + tone.a + ' 0%, ' + tone.b + ' 100%)',
          border: '2px solid ' + INK,
          boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
        }}>
        {state === 'saved' && !dirty && <IconCheck size={12} />}
        <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, color: tone.text }}>
          {label}
        </span>
      </button>
    </div>
  )
}
