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
import { WEATHER, type WeatherId } from '@/lib/weather'
import { MACHINE_PARTS, type MachinePart } from '@/lib/weatherMachine'
import { WEATHER_ROOMS } from '@/lib/roomWindows'
import { shopItem } from '@/lib/trophyShop'
import WeatherFx from './WeatherFx'
import { MachineArt, MACHINE_W, MACHINE_H } from './WeatherMachineProp'
import TrophyBuySheet from '@/components/trophies/TrophyBuySheet'
import { IconClose, IconChevronRight, IconCheck } from '@/components/PixelIcons'
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
        <span className="flex items-center gap-1.5 px-2 py-1" style={{
          border: '1.5px solid rgba(245,200,66,0.5)', borderRadius: 3,
          background: 'rgba(245,200,66,0.1)',
        }}>
          <TrophyCup tier="gold" size={13} shine={false} />
          <span className="font-pixel" style={{ fontSize: 9, color: '#FDE68A' }}>
            {trophies.loaded ? trophies.balance : '—'}
          </span>
        </span>
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

  return (
    <>
      <div className="relative flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4">

        {/* The machine as it actually stands right now, blown up. Seeing the
            thing you are paying for is the whole pitch. */}
        <div className="relative mx-auto flex-shrink-0" style={{
          width: MACHINE_W * scale, height: MACHINE_H * scale,
        }}>
          <div style={{
            position: 'absolute', left: '50%', top: 0,
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
          any window, for both of you.
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
          background: 'linear-gradient(180deg, #FFD79A 0%, #FF9E3D 55%, #C2521A 100%)',
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
          <span style={{
            position: 'absolute', left: s(1), top: s(4), width: s(24), height: s(13),
            background: 'linear-gradient(180deg, #8FA6C4 0%, #55668A 60%, #2B3550 100%)',
            border: `2px solid ${ink}`,
            borderRadius: '50% 50% 12% 12% / 78% 78% 22% 22%',
          }} />
          <span style={{
            position: 'absolute', left: '50%', top: s(15), marginLeft: -2,
            width: 4, height: s(9), background: '#2A3145', border: `1px solid ${ink}`,
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

function PickerScreen() {
  const cos = useTrophyCosmetics()
  const [room, setRoom] = useState<string>(WEATHER_ROOMS[0].room)

  // null = following the household. Non-null = my unsaved edit of it.
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [save, setSave] = useState<SaveState>('idle')

  const map = draft ?? cos.weather
  const dirty = draft !== null && !sameMap(draft, cos.weather)
  const current = (map[room] ?? 'clear') as WeatherId

  function edit(next: Record<string, string>) {
    setDraft(next)
    setSave('idle')
  }

  function pick(id: WeatherId) {
    playSound('ui_select')
    const next = { ...map }
    if (id === 'clear') delete next[room]
    else next[room] = id
    edit(next)
  }

  function everywhere() {
    playSound('ui_select')
    const next: Record<string, string> = {}
    if (current !== 'clear') for (const r of WEATHER_ROOMS) next[r.room] = current
    edit(next)
  }

  async function commit() {
    if (!dirty || save === 'saving') return
    setSave('saving')
    const ok = await cos.saveWeather(draft ?? {})
    if (ok) {
      playSound('level_up')
      setDraft(null)
      setSave('saved')
    } else {
      playSound('ui_back')
      setSave('failed')
    }
  }

  return (
    <>
      <div className="relative flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">

        {/* ── Which window ── */}
        <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#6E86A8' }}>
          WHICH WINDOW
        </span>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {WEATHER_ROOMS.map(r => {
            const on = r.room === room
            const sky = (map[r.room] ?? 'clear') as WeatherId
            const changed = (map[r.room] ?? '') !== (cos.weather[r.room] ?? '')
            return (
              <button key={r.room}
                onClick={() => { playSound('ui_tap'); setRoom(r.room) }}
                aria-pressed={on}
                className="relative flex-shrink-0 flex flex-col items-center gap-1 px-1.5 py-1.5 active:translate-y-[1px] transition-transform"
                style={{
                  minWidth: 60,
                  background: on ? 'rgba(120,200,255,0.14)' : 'rgba(255,255,255,0.035)',
                  border: `1.5px solid ${on ? '#8FE0FF' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 4,
                  boxShadow: on ? '0 0 10px rgba(120,200,255,0.3)' : undefined,
                }}>
                <span className="relative block w-full overflow-hidden" style={{
                  height: 26, containerType: 'size',
                  background: '#0A0F1E', border: '1px solid #05070E',
                }}>
                  <WeatherFx id={sky} />
                </span>
                <span className="font-pixel truncate max-w-[64px]" style={{
                  fontSize: 5, letterSpacing: 0.5, color: on ? '#DCEEFF' : '#7E90A8',
                }}>{r.label}</span>
                {/* an unsaved window wears a dot, so nothing is lost quietly */}
                {changed && (
                  <span aria-label="unsaved" className="absolute -top-1 -right-1" style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#FFCE6B', border: '1.5px solid #0B1120',
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Which sky ── every one of them, because the machine is built ── */}
        <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#6E86A8' }}>
          WHAT IT IS DOING OUT THERE
        </span>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {WEATHER.map(w => {
            const on = current === w.id
            return (
              <button key={w.id}
                onClick={() => pick(w.id)}
                aria-pressed={on}
                className="relative flex flex-col gap-1 p-1.5 text-left active:translate-y-[1px] transition-transform"
                style={{
                  background: on ? 'rgba(99,240,148,0.1)' : 'rgba(255,255,255,0.035)',
                  border: `1.5px solid ${on ? '#63F094' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 4,
                  boxShadow: on ? '0 0 10px rgba(99,240,148,0.25)' : undefined,
                }}>
                <span className="relative block w-full overflow-hidden" style={{
                  height: 52, containerType: 'size',
                  background: '#0A0F1E', border: '1px solid #05070E', borderRadius: 2,
                }}>
                  <WeatherFx id={w.id} />
                </span>
                <span className="font-pixel truncate" style={{
                  fontSize: 6, letterSpacing: 0.5, color: w.tone,
                }}>{w.name.toUpperCase()}</span>
              </button>
            )
          })}
        </div>

        <button onClick={everywhere}
          className="w-full flex items-center justify-center gap-2 py-2.5 active:translate-y-[1px] transition-transform"
          style={{
            background: 'linear-gradient(180deg, #4FA8E0 0%, #2A6BA8 100%)',
            border: '2px solid #14324E', borderRadius: 5,
            boxShadow: '0 2px 0 rgba(0,0,0,0.5), 0 0 12px rgba(79,168,224,0.35)',
          }}>
          <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#EAF6FF' }}>
            THIS SKY IN EVERY WINDOW
          </span>
        </button>
      </div>

      {/* ── The lever ── nothing reaches a window until this is pulled. */}
      <SaveBar dirty={dirty} state={save} onSave={commit} />
    </>
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
    ? { a: '#B4453F', b: '#6E211D', edge: '#3A0E0C', text: '#FFE0DC' }
    : state === 'saved' && !dirty
      ? { a: '#3E8C5E', b: '#1F5238', edge: '#0E2A1C', text: '#DFFBE9' }
      : enabled
        ? { a: '#63F094', b: '#1E9A5A', edge: '#0B3A22', text: '#04220F' }
        : { a: '#2A3145', b: '#171C29', edge: '#0B0E16', text: '#5E6E86' }

  return (
    <div className="relative flex-shrink-0 px-3 pt-2" style={{
      paddingBottom: 'calc(var(--safe-bottom) + 10px)',
      borderTop: '2px solid rgba(120,200,255,0.28)',
      background: 'linear-gradient(0deg, rgba(10,16,28,0.96), rgba(16,26,44,0.8))',
    }}>
      <button onClick={onSave} disabled={!enabled}
        className="w-full flex items-center justify-center gap-2 py-3 active:translate-y-[1px] transition-transform"
        style={{
          background: `linear-gradient(180deg, ${tone.a} 0%, ${tone.b} 100%)`,
          border: `2px solid ${tone.edge}`,
          borderRadius: 5,
          boxShadow: enabled
            ? `0 3px 0 ${tone.edge}, 0 0 14px rgba(99,240,148,0.35)`
            : `0 3px 0 ${tone.edge}`,
        }}>
        {state === 'saved' && !dirty && <IconCheck size={12} />}
        <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, color: tone.text }}>
          {label}
        </span>
      </button>
      {dirty && (
        <span className="font-pixel block text-center" style={{
          fontSize: 5, letterSpacing: 1, color: '#FFCE6B', marginTop: 6,
        }}>
          UNSAVED - THE WINDOWS HAVE NOT CHANGED YET
        </span>
      )}
    </div>
  )
}
