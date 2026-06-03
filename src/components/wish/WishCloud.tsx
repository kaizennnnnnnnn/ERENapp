'use client'

// ═════════════════════════════════════════════════════════════════════════════
// WishCloud — Phase 3 daily wish surface on home.
//
// A pixel speech bubble anchored above-left of Eren (opposite ThoughtCloud's
// above-right position). Shows today's wish text, switches to a granted state
// with gold sparkle + checkmark when the wish lands. Tappable to expand into
// a detail card with the room hint.
//
// Pure presentational — caller wires it up with the data from useDailyWish.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { IconWish } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import type { Wish } from '@/lib/wishes'
import { wishHintRoom } from '@/lib/wishes'

interface Props {
  wish: Wish
  text: string
  status: 'pending' | 'granted'
  grantedByMe: boolean
  grantedByName: string | null
  coinsPaid: number
}

const HINT_ROOM_LABEL: Record<NonNullable<ReturnType<typeof wishHintRoom>>, string> = {
  feed: 'Try the Kitchen',
  wash: 'Try the Bathroom',
  sleep: 'Try the Bedroom',
  play: 'Try the Playroom or a minigame',
  medicine: 'Try the Vet',
}

export default function WishCloud({ wish, text, status, grantedByMe, grantedByName, coinsPaid }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [sparkleKey, setSparkleKey] = useState(0)

  // Bump the sparkle on grant transitions so the burst animation re-fires.
  useEffect(() => {
    if (status === 'granted') {
      setSparkleKey(k => k + 1)
    }
  }, [status])

  const hintRoom = wishHintRoom(wish)
  const hintLabel = hintRoom ? HINT_ROOM_LABEL[hintRoom] : null

  // Color tokens — pending = warm cream, granted = soft gold.
  const isGranted = status === 'granted'
  const fill   = isGranted ? '#FFF5C8' : '#FFFFFF'
  const border = isGranted ? '#8B5A00' : '#1A1A1A'
  const shadow = isGranted ? '3px 3px 0 #8B5A00' : '3px 3px 0 #1A1A1A'

  return (
    <>
      <div
        className="fixed pointer-events-auto"
        style={{
          bottom: '38%',
          left: '22%',
          transform: 'translate(-50%, 0)',
          zIndex: 4,
          // Spawn animation — drift in once on mount.
          animation: 'wishCloudIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <button
          onClick={() => { playSound('ui_tap'); setExpanded(true) }}
          aria-label="Eren's wish today"
          style={{
            background: 'transparent', border: 'none', padding: 0,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              position: 'relative',
              background: fill,
              border: `2px solid ${border}`,
              borderRadius: 4,
              boxShadow: shadow,
              padding: '6px 10px',
              maxWidth: 140,
              minWidth: 90,
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 7,
              lineHeight: 1.5,
              color: '#1A1A1A',
              textAlign: 'center',
              imageRendering: 'pixelated',
            }}
          >
            {/* Tiny wish-star prefix */}
            <div style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4, marginTop: -2 }}>
              <IconWish size={10} />
            </div>
            <span style={{
              verticalAlign: 'middle',
              textDecoration: isGranted ? 'line-through' : 'none',
              opacity: isGranted ? 0.65 : 1,
            }}>{text}</span>

            {/* Granted checkmark in the corner */}
            {isGranted && (
              <span style={{
                position: 'absolute', top: -8, right: -8,
                width: 16, height: 16, borderRadius: '50%',
                background: '#22C55E', color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontFamily: 'sans-serif', fontWeight: 'bold',
                border: '2px solid #15803D',
                boxShadow: '0 0 6px rgba(34,197,94,0.6)',
              }}>✓</span>
            )}

            {/* Speech tail — small pixel triangle pointing down-right toward Eren */}
            <div style={{
              position: 'absolute',
              bottom: -8, right: 22,
              width: 0, height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: `8px solid ${border}`,
            }} />
            <div style={{
              position: 'absolute',
              bottom: -5, right: 24,
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '3px solid transparent',
              borderTop: `5px solid ${fill}`,
            }} />
          </div>
        </button>

        {/* Sparkle burst — re-rendered on each grant via key change */}
        {isGranted && <SparkleBurst key={sparkleKey} />}
      </div>

      {/* Detail modal — opens on tap */}
      {expanded && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => { playSound('ui_modal_close'); setExpanded(false) }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: fill,
              border: `3px solid ${border}`,
              boxShadow: `4px 4px 0 ${border}`,
              padding: '16px 18px',
              maxWidth: 280,
              imageRendering: 'pixelated',
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <IconWish size={14} />
              <span style={{
                fontFamily: '"Press Start 2P", monospace', fontSize: 7,
                color: isGranted ? '#8B5A00' : '#1A1A1A', letterSpacing: 1,
              }}>
                {isGranted ? "WISH GRANTED" : "EREN'S WISH"}
              </span>
            </div>
            <p style={{
              fontFamily: '"Press Start 2P", monospace', fontSize: 8, lineHeight: 1.5,
              color: '#1A1A1A', textAlign: 'center', marginBottom: 10,
              textDecoration: isGranted ? 'line-through' : 'none',
              opacity: isGranted ? 0.7 : 1,
            }}>{text}</p>

            {isGranted ? (
              <div className="flex flex-col items-center gap-1">
                <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 6, color: '#22C55E' }}>
                  {grantedByMe ? 'YOU LISTENED.' : `${(grantedByName ?? 'YOUR PARTNER').toUpperCase()} LISTENED.`}
                </p>
                <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 6, color: '#8B5A00' }}>
                  +{coinsPaid} COINS
                </p>
              </div>
            ) : hintLabel ? (
              <p style={{
                fontFamily: '"Press Start 2P", monospace', fontSize: 5,
                color: '#5A4A55', textAlign: 'center', letterSpacing: 1,
              }}>{hintLabel.toUpperCase()}</p>
            ) : null}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes wishCloudIn {
          0%   { transform: translate(-50%, 4px) scale(0.85); opacity: 0; }
          100% { transform: translate(-50%, 0)   scale(1);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ─── SparkleBurst — 8 chunky pixel-plus sprites radiate from the cloud ───────
function SparkleBurst() {
  const N = 8
  const sparks = Array.from({ length: N }, (_, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2
    const radius = 50
    return {
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      delay: i * 35,
    }
  })
  return (
    <>
      {sparks.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 10, height: 10,
            transform: 'translate(-50%, -50%) scale(0)',
            animation: `wishSpark 0.8s ease-out ${s.delay}ms forwards`,
            ['--tx' as string]: `${s.dx}px`,
            ['--ty' as string]: `${s.dy}px`,
            pointerEvents: 'none',
          } as React.CSSProperties}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges">
            <rect x="4" y="0" width="2" height="2" fill="#F5C842" />
            <rect x="0" y="4" width="2" height="2" fill="#F5C842" />
            <rect x="8" y="4" width="2" height="2" fill="#F5C842" />
            <rect x="4" y="8" width="2" height="2" fill="#F5C842" />
            <rect x="4" y="4" width="2" height="2" fill="#FFFBEB" />
          </svg>
        </div>
      ))}
      <style jsx global>{`
        @keyframes wishSpark {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          15%  { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          55%  { transform: translate(
                   calc(-50% + var(--tx) * 0.7),
                   calc(-50% + var(--ty) * 0.7)
                 ) scale(1.4); opacity: 1; }
          100% { transform: translate(
                   calc(-50% + var(--tx)),
                   calc(-50% + var(--ty))
                 ) scale(0); opacity: 0; }
        }
      `}</style>
    </>
  )
}
