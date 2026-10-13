'use client'

// ═════════════════════════════════════════════════════════════════════════════
// WishCloud — Phase 3 daily wish surface on home.
//
// A white Meadow speech bubble anchored above-left of the cat (opposite
// ThoughtCloud's above-right position), its tail pointing at him. Shows
// today's wish; when the wish lands it turns leaf-tinted with a tick and a
// gold sparkle burst. Tappable to open a card with the room hint.
//
// Pure presentational — the caller (home page) decides when this is on
// screen via useWishLinger, which owns the per-viewer two-minute post-grant
// window and persists it across reopens. The StatsHeader gold chip remains
// the permanent "granted today" indicator.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useId, useRef, useState } from 'react'
import { M, MeadowIcon, PrimaryButton, TINT, TYPE } from '@/components/meadow'
import HomeBubble from './HomeBubble'
import { playSound } from '@/lib/sounds'
import type { Wish } from '@/lib/wishes'
import { wishHintRoom } from '@/lib/wishes'
import { useCat } from '@/hooks/useCat'

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
  const cat = useCat()

  const hintRoom = wishHintRoom(wish)
  const hintLabel = hintRoom ? HINT_ROOM_LABEL[hintRoom] : null
  const isGranted = status === 'granted'

  return (
    <>
      <div
        className="meadow-root fixed pointer-events-auto"
        style={{
          bottom: '38%',
          // Centred on 22% of the width like before, but never closer than
          // 16px to the screen's edge.
          left: 'max(16px, calc(22% - 75px))',
          zIndex: 4,
          // Spawn animation — drift in once on mount.
          animation: 'wishCloudIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <button
          type="button"
          onClick={() => { playSound('ui_tap'); setExpanded(true) }}
          aria-label={cat.t(isGranted ? "{name}'s wish today, granted" : "{name}'s wish today")}
          className="m-press m-focus"
          style={{ display: 'block', background: 'transparent', border: 'none', padding: 0, borderRadius: 20, cursor: 'pointer' }}
        >
          <HomeBubble icon={isGranted ? 'check' : 'star'} tint={isGranted ? TINT.leaf : undefined}>
            {text}
          </HomeBubble>
        </button>

        {/* Sparkle burst — mounts fresh when the grant flips isGranted */}
        {isGranted && <SparkleBurst />}
      </div>

      {expanded && (
        <WishCard
          title={isGranted ? 'Wish granted' : cat.t("{name}'s wish")}
          text={text}
          granted={isGranted}
          by={grantedByMe ? 'You listened.' : `${grantedByName ?? 'Your partner'} listened.`}
          coinsPaid={coinsPaid}
          hint={hintLabel}
          onClose={() => { playSound('ui_modal_close'); setExpanded(false) }}
        />
      )}

      <style>{`
        @keyframes wishCloudIn {
          0%   { transform: translateY(4px) scale(0.85); opacity: 0; }
          100% { transform: translateY(0)   scale(1);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ─── The wish, opened ────────────────────────────────────────────────────────
// A white card like the home's other popups: the wish, then either who granted
// it and what it paid, or the room to try.
function WishCard({ title, text, granted, by, coinsPaid, hint, onClose }: {
  title: string
  text: string
  granted: boolean
  by: string
  coinsPaid: number
  hint: string | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="meadow-root" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 70, padding: '0 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(47, 43, 40, 0.36)',
    }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 320, boxSizing: 'border-box', borderRadius: 28, background: '#FFFFFF',
          padding: '24px 22px 20px', textAlign: 'center', outline: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
        <span style={{
          width: 56, height: 56, borderRadius: 18, background: granted ? TINT.leaf : TINT.amber,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MeadowIcon name={granted ? 'check' : 'star'} size={30} color={granted ? M.leaf : undefined} />
        </span>
        <span id={titleId} style={{ marginTop: 14, ...TYPE.label, color: M.label }}>{title}</span>
        <p style={{ margin: '6px 0 0', fontSize: 20, lineHeight: 1.3, fontWeight: 800, color: M.text }}>{text}</p>
        {granted ? (
          <p style={{ margin: '10px 0 0', fontSize: 15, fontWeight: 600, color: M.text2 }}>
            {by}{' '}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, color: M.text, verticalAlign: 'middle' }}>
              <MeadowIcon name="coin" size={16} />+{coinsPaid}
            </span>
          </p>
        ) : hint ? (
          <p style={{ margin: '10px 0 0', fontSize: 15, fontWeight: 600, color: M.text2 }}>{hint}</p>
        ) : null}
        <PrimaryButton onClick={onClose} style={{ marginTop: 20 }}>{granted ? 'Nice' : 'Got it'}</PrimaryButton>
      </div>
    </div>
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
