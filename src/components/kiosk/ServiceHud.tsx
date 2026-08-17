'use client'

// The strip along the bottom of every wall: the tortilla you're building on,
// the bin, and the button that moves the wrap along. It has to be readable
// from any wall, because you build the wrap by walking between three of them.
//
// The tortilla is the whole point — every ingredient you pick up lands on it
// where you can see it, so the wrap is a thing you assembled rather than a
// list you accumulated. Rolling it shut is deliberate and one-way.

import { IconTrash, IconCoin } from '@/components/PixelIcons'
import {
  TOPPING_BY_ID, PEPSI_SPRITE, TORTILLA_SPOTS, MEAT_ON_TORTILLA, SHAVED_MEAT,
  type Build,
} from './kioskShift'
import type { Nudge } from './useKioskShift'

interface Props {
  build: Build
  rolled: boolean
  earned: number
  nudge: Nudge
  canRoll: boolean
  canServe: boolean
  onTrash: () => void
  onRoll: () => void
  onServe: () => void
}

/** Diameter of the tortilla on screen. Everything on it is sized off this. */
const DISC = 86

/**
 * One ingredient sitting on the bread. Three nested elements on purpose:
 * the outer one places it, the middle one gives it its hand-dropped tilt, and
 * only the image animates — a forwards-filling animation on the image itself
 * would otherwise wipe out the tilt the moment it landed.
 */
function Laid({ src, label, spot }: {
  src: string
  label: string
  spot: { x: number; y: number; size: number; rot: number }
}) {
  return (
    <span style={{
      position: 'absolute',
      left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.size}%`,
      transform: 'translate(-50%, -50%)',
    }}>
      <span style={{ display: 'block', transform: `rotate(${spot.rot}deg)` }}>
        <img src={src} alt={label} draggable={false} style={{
          width: '100%', height: 'auto', display: 'block',
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))',
          animation: 'kioskDropOn 320ms cubic-bezier(0.32, 0.72, 0, 1) both',
        }} />
      </span>
    </span>
  )
}

export default function ServiceHud({
  build, rolled, earned, nudge, canRoll, canServe, onTrash, onRoll, onServe,
}: Props) {
  const empty = !build.meat && build.toppings.length === 0 && !build.pepsi
  const action = rolled
    ? { label: 'GIVE', on: onServe, live: canServe }
    : { label: 'ROLL', on: onRoll, live: canRoll }

  return (
    <div className="absolute left-0 right-0 pointer-events-none" style={{
      bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
      zIndex: 56,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '0 12px', gap: 8,
    }}>
      {/* Bin — the only way out of a wrap you've built wrong. */}
      <button
        type="button"
        aria-label="Scrap this wrap"
        onClick={onTrash}
        disabled={empty}
        className="flex items-center justify-center active:scale-90 transition-transform pointer-events-auto"
        style={{
          width: 40, height: 40, borderRadius: 8, flex: '0 0 auto',
          background: 'rgba(16,12,10,0.78)',
          border: '2px solid rgba(200,190,205,0.35)',
          boxShadow: '0 3px 0 rgba(0,0,0,0.5)',
          opacity: empty ? 0.35 : 1,
        }}>
        <IconTrash size={18} />
      </button>

      {/* The prep board. */}
      <div style={{
        flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        {nudge && (
          <div key={nudge.id} className="font-pixel" style={{
            fontSize: 6.5, letterSpacing: 0.5, color: '#FFD2A8',
            background: 'rgba(0,0,0,0.6)', padding: '5px 9px', borderRadius: 8,
            whiteSpace: 'nowrap',
            animation: 'kioskNudge 2.4s ease-out both',
          }}>
            {nudge.text}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '6px 12px',
          background: 'rgba(14,10,8,0.72)',
          border: '2px solid rgba(245,156,69,0.4)',
          borderRadius: 12,
          boxShadow: '0 3px 0 rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
        }}>
          {/* The bread, and whatever is on it. */}
          <div style={{ position: 'relative', width: DISC, height: DISC, flex: '0 0 auto' }}>
            <img
              key={rolled ? 'wrap' : 'flat'}
              src={rolled ? '/wrap_rolled.webp' : '/tortilla.webp'}
              alt={rolled ? 'Rolled wrap' : 'Tortilla'}
              draggable={false}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'contain',
                filter: 'brightness(0.94) saturate(0.96) drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
                animation: rolled
                  ? 'kioskRollShut 420ms cubic-bezier(0.32, 0.72, 0, 1) both'
                  : undefined,
              }}
            />

            {/* Fillings only show while it's open. Once it's rolled they're
                inside, which is exactly the tension. */}
            {!rolled && build.meat && (
              <Laid src={SHAVED_MEAT} label="Meat" spot={MEAT_ON_TORTILLA} />
            )}
            {!rolled && build.toppings.map(t => (
              <Laid key={t} src={TOPPING_BY_ID[t].sprite} label={TOPPING_BY_ID[t].label}
                spot={TORTILLA_SPOTS[t]} />
            ))}
          </div>

          {/* The drink rides alongside — it never goes on the bread. */}
          <div style={{
            width: 26, height: DISC - 18, flex: '0 0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 7,
            border: `2px dashed ${build.pepsi ? 'transparent' : 'rgba(245,156,69,0.22)'}`,
          }}>
            {build.pepsi && (
              <img src={PEPSI_SPRITE} alt="Pepsi" draggable={false} style={{
                width: '100%', height: 'auto', objectFit: 'contain',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                animation: 'kioskDropOn 320ms cubic-bezier(0.32, 0.72, 0, 1) both',
              }} />
            )}
          </div>
        </div>
      </div>

      {/* Roll it, then hand it over. Same button, two jobs — there's only ever
          one thing the wrap is waiting for. */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        {earned > 0 && (
          <span className="font-pixel" style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 7, color: '#FFD98A',
          }}>
            <IconCoin size={11} />{earned}
          </span>
        )}
        <button
          type="button"
          onClick={action.on}
          disabled={!action.live}
          className="font-pixel active:translate-y-[2px] transition-transform pointer-events-auto"
          style={{
            fontSize: 7.5, letterSpacing: 1, color: action.live ? '#3A1B08' : 'rgba(255,231,196,0.45)',
            background: action.live ? '#F59C45' : 'rgba(30,22,18,0.8)',
            padding: '11px 12px 10px',
            border: `2px solid ${action.live ? '#5A2E12' : 'rgba(245,156,69,0.25)'}`,
            borderRadius: 8,
            boxShadow: action.live ? '0 3px 0 #DC772A, 0 0 16px rgba(245,156,69,0.28)' : '0 3px 0 rgba(0,0,0,0.5)',
          }}>
          {action.label}
        </button>
      </div>
    </div>
  )
}
