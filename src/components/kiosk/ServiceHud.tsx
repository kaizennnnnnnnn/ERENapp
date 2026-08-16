'use client'

// The strip along the bottom of every wall: what's in your hands right now,
// the bin, and the hand-it-over button. It has to be readable from any wall,
// because you build the wrap by walking between three of them.

import { IconTrash, IconCoin } from '@/components/PixelIcons'
import { TOPPING_BY_ID, PEPSI_SPRITE, type Build } from './kioskShift'
import type { Nudge } from './useKioskShift'

interface Props {
  build: Build
  earned: number
  nudge: Nudge
  canServe: boolean
  onTrash: () => void
  onServe: () => void
}

export default function ServiceHud({ build, earned, nudge, canServe, onTrash, onServe }: Props) {
  const empty = !build.meat && build.toppings.length === 0 && !build.pepsi

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

      {/* The wrap in progress. Empty slots are drawn as dashes so you can see
          at a glance that nothing's on it yet. */}
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
          display: 'flex', alignItems: 'center', gap: 6,
          minHeight: 40, padding: '6px 10px',
          background: 'rgba(14,10,8,0.78)',
          border: '2px solid rgba(245,156,69,0.4)',
          borderRadius: 10,
          boxShadow: '0 3px 0 rgba(0,0,0,0.5)',
        }}>
          {empty ? (
            <span className="font-pixel" style={{ fontSize: 6.5, letterSpacing: 1, color: 'rgba(255,231,196,0.5)' }}>
              NOTHING ON THE BOARD
            </span>
          ) : (
            <>
              {build.meat && (
                <img src="/meat5.webp" alt="Meat" style={{ width: 12, height: 26, objectFit: 'contain' }} />
              )}
              {build.toppings.map(t => (
                <img key={t} src={TOPPING_BY_ID[t].sprite} alt={TOPPING_BY_ID[t].label}
                  style={{ width: 24, height: 24, objectFit: 'contain' }} />
              ))}
              {build.pepsi && (
                <img src={PEPSI_SPRITE} alt="Pepsi" style={{ width: 17, height: 24, objectFit: 'contain' }} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Serve, plus the shift's takings under it. */}
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
          onClick={onServe}
          disabled={!canServe}
          className="font-pixel active:translate-y-[2px] transition-transform pointer-events-auto"
          style={{
            fontSize: 7.5, letterSpacing: 1, color: canServe ? '#3A1B08' : 'rgba(255,231,196,0.45)',
            background: canServe ? '#F59C45' : 'rgba(30,22,18,0.8)',
            padding: '11px 12px 10px',
            border: `2px solid ${canServe ? '#5A2E12' : 'rgba(245,156,69,0.25)'}`,
            borderRadius: 8,
            boxShadow: canServe ? '0 3px 0 #DC772A, 0 0 16px rgba(245,156,69,0.28)' : '0 3px 0 rgba(0,0,0,0.5)',
          }}>
          SERVE
        </button>
      </div>
    </div>
  )
}
