'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE WEATHER MACHINE — a console on the Lab bench with a dial per room.
//
// Buying a sky and deciding where it hangs are deliberately different places.
// The shop is a list of things you do not own; this is a machine with eight
// windows on it, and it only shows skies you already have. Putting the picker
// in the shop would have made the shop a settings screen.
//
// Everything it writes is household-wide (eren_stats.room_weather), same as
// the skins: there is one house, and the storm she put over the bath should
// still be there when you open the door.
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
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyCosmetics, sameMap } from '@/hooks/useTrophyCosmetics'
import { WEATHER, weatherItemId, WEATHER_ALL_UNLOCKED, type WeatherId } from '@/lib/weather'
import { WEATHER_ROOMS } from '@/lib/roomWindows'
import WeatherFx from './WeatherFx'
import { IconClose, IconLock, IconChevronRight, IconCheck } from '@/components/PixelIcons'
import TrophyCup from '@/components/trophies/TrophyCup'
import { playSound } from '@/lib/sounds'

// ─── The console on the bench ────────────────────────────────────────────────

export function WeatherMachineButton({ onOpen }: { onOpen(): void }) {
  const cos = useTrophyCosmetics()
  const here = (cos.weather.chemistry ?? 'clear') as WeatherId

  return (
    <button
      onClick={() => { playSound('ui_select'); onOpen() }}
      aria-label="Weather machine"
      className="w-full flex items-center gap-2.5 px-3 py-2 active:translate-y-[1px] transition-transform"
      style={{
        maxWidth: 300,
        background: 'linear-gradient(180deg, #4A5570 0%, #2A3145 62%, #171C29 100%)',
        border: '2px solid #0B0E16',
        borderRadius: 4,
        boxShadow: '0 3px 0 rgba(0,0,0,0.55), inset 0 1px 0 rgba(190,210,255,0.35)',
      }}
    >
      {/* the little screen, showing what this room's own window is doing */}
      <span className="relative block flex-shrink-0 overflow-hidden" style={{
        width: 44, height: 30,
        containerType: 'size',
        background: '#0A0F1E',
        border: '1.5px solid #05070E',
        boxShadow: 'inset 0 0 5px rgba(0,0,0,0.9), 0 0 6px rgba(120,200,255,0.35)',
      }}>
        <WeatherFx id={here} />
        <span aria-hidden className="absolute inset-0" style={{
          background: 'repeating-linear-gradient(0deg, transparent 0 1px, rgba(0,0,0,0.3) 1px 2px)',
        }} />
      </span>

      <span className="flex-1 text-left">
        <span className="font-pixel block" style={{
          fontSize: 8, letterSpacing: 1.5, color: '#CFE8FF',
          textShadow: '0 0 6px rgba(120,200,255,0.5)',
        }}>WEATHER</span>
        <span className="font-pixel block" style={{
          fontSize: 5, letterSpacing: 1, color: '#7E96B4', marginTop: 2,
        }}>SET EVERY WINDOW</span>
      </span>

      {/* three dials and a lamp, so it reads as equipment */}
      <span className="flex items-center gap-1.5 flex-shrink-0">
        {['#8FE0FF', '#FFCE6B', '#FF8FB8'].map(c => (
          <span key={c} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: `radial-gradient(circle at 34% 30%, #fff, ${c} 55%, #1B2130 100%)`,
            border: '1px solid #05070E',
          }} />
        ))}
        <span className="wmLamp" style={{
          width: 5, height: 5, borderRadius: '50%',
          background: '#63F094', boxShadow: '0 0 5px #63F094',
        }} />
      </span>

      <style>{`
        @keyframes wmBlink { 0%, 62%, 100% { opacity: 1; } 72% { opacity: 0.25; } }
        .wmLamp { animation: wmBlink 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .wmLamp { animation: none; } }
      `}</style>
    </button>
  )
}

// ─── The panel ───────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export function WeatherMachinePanel({ onClose }: { onClose(): void }) {
  const trophies = useTrophies()
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

  return createPortal(
    <div className="fixed inset-0 z-[150] flex flex-col" style={{
      background: 'radial-gradient(120% 70% at 50% 0%, #16233A 0%, #0B1120 55%, #05070E 100%)',
    }}>
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

        {/* ── Which sky ── */}
        <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#6E86A8' }}>
          WHAT IT IS DOING OUT THERE
        </span>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {WEATHER.map(w => {
            const owned = w.id === 'clear' || WEATHER_ALL_UNLOCKED
              || trophies.mine(weatherItemId(w.id))
            const on = current === w.id
            return (
              <button key={w.id}
                onClick={() => { if (owned) pick(w.id); else playSound('ui_tap') }}
                aria-pressed={on}
                className="relative flex flex-col gap-1 p-1.5 text-left active:translate-y-[1px] transition-transform"
                style={{
                  background: on ? 'rgba(99,240,148,0.1)' : 'rgba(255,255,255,0.035)',
                  border: `1.5px solid ${on ? '#63F094' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 4,
                  boxShadow: on ? '0 0 10px rgba(99,240,148,0.25)' : undefined,
                  opacity: owned ? 1 : 0.55,
                }}>
                <span className="relative block w-full overflow-hidden" style={{
                  height: 52, containerType: 'size',
                  background: '#0A0F1E', border: '1px solid #05070E', borderRadius: 2,
                }}>
                  {owned
                    ? <WeatherFx id={w.id} />
                    : <span className="absolute inset-0 flex items-center justify-center">
                        <IconLock size={16} />
                      </span>}
                </span>
                <span className="font-pixel truncate" style={{
                  fontSize: 6, letterSpacing: 0.5, color: owned ? w.tone : '#5E6E86',
                }}>{w.name.toUpperCase()}</span>
                {!owned && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1 py-0.5" style={{
                    background: '#2A1B08', border: '1.5px solid #7A4F00', borderRadius: 5,
                  }}>
                    <TrophyCup tier="gold" size={9} shine={false} />
                    <span className="font-pixel" style={{ fontSize: 5.5, color: '#FDE68A' }}>{w.price}</span>
                  </span>
                )}
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

        <Link href="/trophies" onClick={() => playSound('ui_tap')}
          className="flex items-center gap-2 px-3 py-2.5"
          style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px dashed rgba(255,255,255,0.16)', borderRadius: 4,
          }}>
          <TrophyCup tier="gold" size={14} shine={false} />
          <span className="flex-1">
            <span className="font-pixel block" style={{ fontSize: 6, letterSpacing: 1, color: '#D6CBE2' }}>
              MORE SKIES
            </span>
            <span className="text-[10px]" style={{ color: '#7E90A8' }}>
              Bought with trophies in the Trophy Room.
            </span>
          </span>
          <IconChevronRight size={11} />
        </Link>
      </div>

      {/* ── The lever ── nothing reaches a window until this is pulled. */}
      <SaveBar dirty={dirty} state={save} onSave={commit} />
    </div>,
    document.body,
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
