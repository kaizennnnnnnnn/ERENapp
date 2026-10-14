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
//
// In the Meadow look: a white page on the sky tint, white cards and tiles, the
// leaf ring for what is chosen, an amber dot for what is not saved yet, and
// one leaf button at the foot. The skies themselves (WeatherFx) and the
// machine are art, and stay exactly as they are.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { createPortal } from 'react-dom'
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
import { PriceChip } from '@/components/trophies/TrophyShopView'
import {
  IconMoon, IconHouse, IconMeat, IconYarn, IconBath, IconFlask, IconSpeech,
} from '@/components/PixelIcons'
import {
  Card, CheckDisc, DangerButton, FONT_ROUNDED, M, MeadowIcon, PrimaryButton, RoundButton,
  SecondaryButton, Tag, TINT, TYPE,
} from '@/components/meadow'
import { playSound } from '@/lib/sounds'

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

/** The page ground: the sky tint, because this is a page about skies. */
const GROUND = TINT.sky

/** The small uppercase group label, as every Meadow page sets it. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex-shrink-0" style={{ ...TYPE.label, color: M.label, margin: '8px 0 0', padding: '0 4px' }}>
      {children}
    </h2>
  )
}

export function WeatherMachinePanel({ onClose }: { onClose(): void }) {
  const trophies = useTrophies()
  const machine = useWeatherMachine()
  // Owned HERE, not inside the workbench: fitting the fourth part swaps the
  // workbench for the picker, and a sheet rendered inside the workbench would
  // be torn out mid-confirmation — losing the one beat the whole build was for.
  const [buying, setBuying] = useState<MachinePart | null>(null)

  return createPortal(
    <div className="meadow-root fixed inset-0 z-[150] flex flex-col"
      style={{ background: GROUND, color: M.text, fontFamily: FONT_ROUNDED }}>

      {/* ── Header ── */}
      <div className="relative flex items-center flex-shrink-0" style={{
        gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 8px',
      }}>
        {/* One line, always: with the catnip pill and the close circle beside
            it, a two-line title shoved the whole page down. */}
        <h1 className="flex-1 min-w-0" style={{
          margin: '0 0 0 4px', fontSize: 22, lineHeight: 1.2, fontWeight: 800,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          Weather machine
        </h1>
        {/* The wallet belongs to the WORKBENCH, where the four parts have
            prices. On the picker nothing costs anything — that is what
            finishing the machine bought — so a running balance in the corner is
            a number with no question attached to it. */}
        {machine.loaded && !machine.built && (
          <span role="img" aria-label={trophies.loaded ? `${trophies.balance} catnip` : 'Catnip loading'} style={{
            height: 36, boxSizing: 'border-box', padding: '0 12px 0 6px', borderRadius: 999, background: '#FFFFFF',
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 15, ...TYPE.number,
          }}>
            <MeadowIcon name="catnip" size={22} />
            {trophies.loaded ? trophies.balance : '-'}
          </span>
        )}
        <RoundButton surface="ground" size={40} ariaLabel="Close" onClick={() => { playSound('ui_modal_close'); onClose() }}>
          <MeadowIcon name="close" size={20} color={M.text} />
        </RoundButton>
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
    <div className="relative flex-1 flex flex-col items-center justify-center" style={{ gap: 12 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        {MACHINE_PARTS.map((p, i) => (
          <span key={p.id} className="wx-lamp" style={{
            width: 10, height: 10, borderRadius: '50%', background: M.faint,
            animationDelay: `${i * 0.26}s`,
          }} />
        ))}
      </div>
      <span role="status" style={{ fontSize: 14, fontWeight: 700, color: M.text2 }}>
        Reading the dials
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
      <div className="relative flex-1 overflow-y-auto flex flex-col" style={{ gap: 10, padding: '6px 16px 16px' }}>

        {/* The machine as it actually stands right now, blown up. Seeing the
            thing you are paying for is the whole pitch. */}
        <Card padding="0 16px 16px">
          {/* TAG_ROOM is not padding-for-looks. The prop hangs its WEATHER n/4
              tag ABOVE its own box — up to 26px, once a dish pushes it clear —
              and without room reserved here the tag is simply sliced off. */}
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
          <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
            Somebody left it in the corner of the Lab with four pieces missing.
            Put them all back and every sky in the game is yours, for good, in
            any window.
          </p>
        </Card>

        <GroupLabel>The four parts</GroupLabel>

        <div className="flex flex-col" style={{ gap: 8 }}>
          {MACHINE_PARTS.map(p => (
            <PartSlot key={p.id} part={p} machine={machine} onBuy={() => onBuy(p)} />
          ))}
        </div>

        <Card href="/trophies" padding="12px 14px 12px 12px" onClick={() => playSound('ui_tap')}>
          <span className="flex items-center" style={{ gap: 12 }}>
            <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{
              width: 44, height: 44, borderRadius: 14, background: TINT.leaf,
            }}>
              <MeadowIcon name="catnip" size={26} />
            </span>
            <span className="flex-1 min-w-0">
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: M.text }}>Where catnip comes from</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
                Win a day of the Care Battle. The parts are in the Catnip shop too.
              </span>
            </span>
            <MeadowIcon name="chevronRight" size={22} color={M.faint} />
          </span>
        </Card>
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
  const BuyButton = affordable ? PrimaryButton : SecondaryButton

  return (
    <div className="flex items-center" style={{
      gap: 12, padding: '10px 12px 10px 10px', borderRadius: 20, background: '#FFFFFF',
    }}>
      <span className="flex items-center justify-center flex-shrink-0" style={{
        width: 48, height: 48, borderRadius: 16, background: fitted ? M.leafTint : M.soft,
      }}>
        <PartGlyph part={part} lit={fitted} size={28} />
      </span>

      <span className="flex-1 min-w-0">
        <span style={{ display: 'block', fontSize: 16, lineHeight: 1.25, fontWeight: 800, color: M.text }}>
          {part.name}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 13, lineHeight: 1.4, fontWeight: fitted ? 700 : 500, color: fitted ? M.leafInk : M.text2 }}>
          {fitted ? `Fitted by ${who}` : part.blurb}
        </span>
      </span>

      {fitted ? (
        <CheckDisc size={28} />
      ) : (
        /* Never disabled: short of catnip, the buy card says how short. */
        <BuyButton size="sm" onClick={() => { playSound('ui_select'); onBuy() }}
          ariaLabel={`Buy the ${part.name} for ${part.price} catnip`}
          style={{ flexShrink: 0, height: 40, gap: 6, padding: '0 6px 0 12px' }}>
          Buy<PriceChip price={part.price} />
        </BuyButton>
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
    <div className="relative flex-shrink-0" style={{
      padding: '12px 16px calc(var(--safe-bottom) + 12px)', background: '#FFFFFF',
    }}>
      <div className="flex items-center" style={{ gap: 4, marginBottom: 10 }}>
        {MACHINE_PARTS.map(p => (
          <span key={p.id} className="flex-1" style={{
            height: 8, borderRadius: 4, background: machine.has(p.id) ? M.leaf : M.track,
          }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 15, fontWeight: 800, color: M.text, fontVariantNumeric: 'tabular-nums' }}>
          {machine.installed} of {machine.total} fitted
        </span>
        <span className="flex items-center" style={{ gap: 5, fontSize: 14, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>
          <MeadowIcon name="catnip" size={20} />
          {machine.remaining} to go
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

/** Chosen: the kit's leaf ring, one selection colour for rooms and skies. */
const CHOSEN: React.CSSProperties = { boxShadow: `inset 0 0 0 2px ${M.leaf}`, background: M.leafTint }
/** Edited, not committed. */
const PEND = M.coin

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
        <span key={i} style={{ width: c, height: c, background: tone, borderRadius: 2 }} />
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
    ? 'Every window'
    : roomName(WEATHER_ROOMS.find(r => r.room === room)?.label ?? '')
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
      <div className="relative flex-shrink-0" style={{ padding: '6px 16px 10px' }}>
        <Card padding="12px 12px 12px">
          <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
            <span aria-hidden className="flex items-center justify-center flex-shrink-0" style={{
              width: 32, height: 32, borderRadius: 11, background: TINT.sky,
            }}>
              {isAll
                ? <AllWindowsGlyph size={16} tone={M.text2} />
                : RoomIcon && <RoomIcon size={18} />}
            </span>
            <span className="flex-1 truncate" style={{ fontSize: 17, fontWeight: 800, color: M.text }}>{label}</span>
            {nightOnly && (
              <Tag size="sm" tone="soft" icon={<IconMoon size={12} />}>Always night</Tag>
            )}
          </div>

          <div className="mx-auto relative overflow-hidden" style={{
            width: paneW, height: PANE_H,
            containerType: 'size',
            background: '#070B16',
            borderRadius: 14,
          }}>
            <WeatherFx id={def.id} still={reduced} lit={lit} plate />
          </div>

          {/* The sentence weather.ts already wrote for every sky — and the one
              place a refusal can land in words. */}
          <div style={{
            marginTop: 10, padding: '8px 12px', minHeight: 48, borderRadius: 14,
            background: refused ? M.energyTint : M.soft,
          }}>
            <span className="block truncate" style={{
              fontSize: 15, fontWeight: 800, color: refused ? '#8A5A12' : M.text,
            }}>{refused ? 'Not in here' : current === null ? 'Mixed' : def.name}</span>
            <span className="block" style={{
              fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: refused ? '#8A5A12' : M.text2, marginTop: 2,
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
        </Card>
      </div>

      <div className="relative flex-1 overflow-y-auto flex flex-col" style={{ gap: 8, padding: '0 16px 16px' }}>

        {/* ── Which window ── a fixed grid, not a scroll strip. The strip cut
            the per-room unsaved mark in half against its own overflow box, and
            that mark is the only ledger of what has not been committed yet —
            and on a 640px-tall phone the whole strip collapsed to 4px, because
            a flex child in a column shrinks by default. */}
        <GroupLabel>Which window</GroupLabel>

        <div className="grid flex-shrink-0" style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6,
        }}>
          {WEATHER_ROOMS.map(r => {
            const on = r.room === room
            const changed = (map[r.room] ?? '') !== (live[r.room] ?? '')
            const Icon = ROOM_ICON[r.room]
            return (
              <button key={r.room} type="button" onClick={() => goRoom(r.room)} aria-pressed={on}
                className="m-press m-focus relative flex flex-col items-center"
                style={{
                  gap: 4, padding: '9px 2px 7px', border: 0, borderRadius: 16, background: '#FFFFFF',
                  fontFamily: 'inherit', cursor: 'pointer', ...(on ? CHOSEN : {}),
                }}>
                {Icon && <Icon size={20} />}
                <span className="block w-full truncate text-center" style={{
                  fontSize: 12, fontWeight: on ? 800 : 700, color: on ? M.leafInk : M.text,
                }}>{roomName(r.label)}</span>
                {/* INSIDE the button: the old mark hung outside its own box and
                    the strip's overflow sliced it in half. */}
                {changed && (
                  <span aria-label="unsaved" className="absolute" style={{
                    top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: PEND,
                  }} />
                )}
              </button>
            )
          })}

          <button type="button" onClick={() => goRoom(ALL)} aria-pressed={isAll}
            className="m-press m-focus relative flex flex-col items-center"
            style={{
              gap: 4, padding: '9px 2px 7px', border: 0, borderRadius: 16, background: '#FFFFFF',
              fontFamily: 'inherit', cursor: 'pointer', ...(isAll ? CHOSEN : {}),
            }}>
            <span className="flex items-center justify-center" style={{ height: 20 }}>
              <AllWindowsGlyph size={18} tone={isAll ? M.leaf : M.text2} />
            </span>
            <span className="block w-full truncate text-center" style={{
              fontSize: 12, fontWeight: isAll ? 800 : 700, color: isAll ? M.leafInk : M.text,
            }}>All 7</span>
          </button>
        </div>

        <GroupLabel>Pick a sky</GroupLabel>

        {/* Clear is pulled out of the grid on purpose. It is the only choice
            that REMOVES a layer rather than adding one — it IS the painting —
            and taking it out also takes the eleventh tile out of a two-column
            grid that could never end evenly. */}
        <SkyKey w={WEATHER_BY_ID.clear} wide on={current === 'clear'}
          blurb={skyBlurbIn(room, 'clear')}
          blocked={null} lit={lit} onPick={() => pick('clear')} />

        <div className="grid flex-shrink-0" style={{
          gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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

/** 'LIVING ROOM' -> 'Living room': the room labels are stored in caps. */
function roomName(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase()
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
  return (
    <button type="button" onClick={onPick} aria-pressed={on} aria-disabled={!!blocked}
      className={'m-press m-focus relative flex text-left flex-shrink-0 ' + (wide ? 'flex-row items-center' : 'flex-col')}
      style={{
        gap: wide ? 12 : 6, padding: 8, border: 0, borderRadius: 18, background: '#FFFFFF',
        fontFamily: 'inherit', cursor: 'pointer',
        ...(on ? CHOSEN : {}),
        opacity: blocked ? 0.55 : 1,
      }}>
      <span className="relative block overflow-hidden flex-shrink-0" style={{
        width: wide ? 72 : '100%', height: wide ? 40 : 56,
        containerType: 'size',
        background: '#0A0F1E', borderRadius: 12,
        filter: blocked ? 'grayscale(1) brightness(0.7)' : undefined,
      }}>
        <WeatherFx id={w.id} still lit={lit} plate />
      </span>

      <span className={wide ? 'flex-1 min-w-0' : 'block w-full min-w-0'} style={{ padding: wide ? 0 : '0 4px 2px' }}>
        <span className="block truncate" style={{
          fontSize: 14, fontWeight: 800, color: on ? M.leafInk : M.text,
        }}>{w.name}</span>
        {wide && (
          <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: M.text2, marginTop: 1 }}>
            {blurb ?? w.blurb}
          </span>
        )}
      </span>

      {/* A moon, not a padlock: this window is night, not locked. */}
      {blocked && (
        <span className="absolute flex items-center justify-center" style={{
          top: 12, right: 12, width: 22, height: 22, borderRadius: 999, background: '#FFFFFF',
        }}>
          <IconMoon size={12} />
        </span>
      )}
    </button>
  )
}

function SaveBar({ dirty, state, onSave }: {
  dirty: boolean; state: SaveState; onSave(): void
}) {
  return (
    <div className="relative flex-shrink-0" style={{
      padding: '8px 16px calc(var(--safe-bottom) + 12px)', background: '#FFFFFF',
    }}>
      {/* The row is reserved whether or not it is showing, so the button does
          not jump out from under the thumb the instant the first edit lands. */}
      <span className="flex items-center justify-center" style={{
        gap: 6, height: 22, marginBottom: 6, fontSize: 13, fontWeight: 700, color: '#8A5A12',
        opacity: dirty ? 1 : 0,
      }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: PEND }} />
        Not saved yet. The windows haven&apos;t changed.
      </span>
      {state === 'failed' ? (
        <DangerButton onClick={onSave}>Didn&apos;t save. Try again</DangerButton>
      ) : state === 'saved' && !dirty ? (
        <SecondaryButton disabled icon={<CheckDisc size={22} />} style={{ opacity: 1 }}>Saved</SecondaryButton>
      ) : (
        <PrimaryButton onClick={onSave} disabled={!dirty} busy={state === 'saving'}>
          {state === 'saving' ? 'Saving' : dirty ? 'Save changes' : 'Nothing to save'}
        </PrimaryButton>
      )}
    </div>
  )
}
