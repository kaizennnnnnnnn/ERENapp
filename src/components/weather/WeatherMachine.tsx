'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE WEATHER MACHINE — a console on the Lab bench with a dial per room.
//
// Buying a sky and deciding where it hangs are deliberately different places.
// The shop is a list of things you do not own; this is a machine with seven
// windows on it, and it only shows skies you already have. Putting the picker
// in the shop would have made the shop a settings screen.
//
// Everything it writes is household-wide (eren_stats.room_weather), same as
// the skins: there is one house, and the storm she put over the bath should
// still be there when you open the door.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyCosmetics } from '@/hooks/useTrophyCosmetics'
import { WEATHER, weatherItemId, WEATHER_ALL_UNLOCKED, type WeatherId } from '@/lib/weather'
import { WEATHER_ROOMS } from '@/lib/roomWindows'
import WeatherFx from './WeatherFx'
import { IconClose, IconLock, IconChevronRight } from '@/components/PixelIcons'
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

export function WeatherMachinePanel({ onClose }: { onClose(): void }) {
  const trophies = useTrophies()
  const cos = useTrophyCosmetics()
  const [room, setRoom] = useState<string>(WEATHER_ROOMS[0].room)

  const current = (cos.weather[room] ?? 'clear') as WeatherId

  function set(id: WeatherId) {
    playSound('ui_select')
    cos.setWeather(room, id === 'clear' ? null : id)
  }

  function setEverywhere() {
    playSound('level_up')
    for (const r of WEATHER_ROOMS) {
      cos.setWeather(r.room, current === 'clear' ? null : current)
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

      <div className="relative flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>

        {/* ── Which window ── */}
        <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#6E86A8' }}>
          WHICH WINDOW
        </span>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {WEATHER_ROOMS.map(r => {
            const on = r.room === room
            const sky = (cos.weather[r.room] ?? 'clear') as WeatherId
            return (
              <button key={r.room}
                onClick={() => { playSound('ui_tap'); setRoom(r.room) }}
                aria-pressed={on}
                className="flex-shrink-0 flex flex-col items-center gap-1 px-1.5 py-1.5 active:translate-y-[1px] transition-transform"
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
                <span className="font-pixel" style={{
                  fontSize: 5, letterSpacing: 0.5, color: on ? '#DCEEFF' : '#7E90A8',
                }}>{r.label}</span>
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
                onClick={() => { if (owned) set(w.id); else playSound('ui_tap') }}
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

        <button onClick={setEverywhere}
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
    </div>,
    document.body,
  )
}
