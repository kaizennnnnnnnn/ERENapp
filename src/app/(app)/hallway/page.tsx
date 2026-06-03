'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /hallway — Phase 3 PR 8.5
//
// The Memory Wall as a real Next.js page rather than a swipe-room scene. Has
// its own scroll surface, an exit chevron in the top-left, and breathing room
// for many frames without competing with the home HUD.
//
// Layout: pixel-art gallery aesthetic — dark wall with a faint paneling
// pattern, gold ceiling light glow, ornate header.
// ═════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useMemoryFrames } from '@/hooks/useMemoryFrames'
import { useCare } from '@/contexts/CareContext'
import { MEMORY_FRAMES } from '@/lib/memoryCatalogue'
import MemoryWall from '@/components/care/MemoryWall'
import PageLoader from '@/components/PageLoader'
import { playSound } from '@/lib/sounds'
import { useEffect } from 'react'
import { IconDoor } from '@/components/PixelIcons'

export default function HallwayPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const { partner } = useCouple()
  const { setHideStats } = useCare()
  const { frames, loading, applyReaction } = useMemoryFrames(profile?.household_id ?? null)

  const unlockedCount = frames.length
  const totalCount = MEMORY_FRAMES.length

  // Hide the floating StatsHeader on the Hallway — the page has its own top
  // ornamentation and the bar would clash with it.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  if (authLoading) return <PageLoader label="LOADING THE HALLWAY" />

  function exit() {
    playSound('ui_swipe_room')
    router.back()
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(245,200,66,0.14) 0%, transparent 50%),
          linear-gradient(180deg, #1A0E24 0%, #100818 60%, #06030A 100%)
        `,
      }}
    >
      {/* CRT scanlines */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.22) 3px, rgba(0,0,0,0.22) 4px)',
        opacity: 0.5,
      }} />

      {/* Wall paneling — vertical strokes that read as wood planks behind the
          frames. Subtle so the frames pop. */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.022) 0 1px, transparent 1px 48px)',
      }} />

      {/* Soft diagonal texture so the bg never reads totally flat */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.014) 0 2px, transparent 2px 8px)',
      }} />

      {/* ── Top bar: exit chevron + counter ── */}
      <div className="relative px-4 pt-3 flex items-center justify-between" style={{
        zIndex: 5,
        paddingTop: 'calc(var(--safe-top, 0px) + 14px)',
      }}>
        <button
          type="button"
          onClick={exit}
          aria-label="Exit Hallway"
          className="active:scale-90 transition-transform flex items-center justify-center"
          style={{
            width: 36, height: 36,
            background: 'linear-gradient(180deg, rgba(40,28,60,0.92) 0%, rgba(20,12,32,0.92) 100%)',
            border: '2px solid #5C3A7A',
            boxShadow: '2px 2px 0 #050507, 0 0 8px rgba(167,139,250,0.25)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          <span style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 10, color: '#E8DCFA',
            lineHeight: 1,
          }}>&lt;</span>
        </button>

        <div className="flex flex-col items-center">
          <span style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 9,
            color: '#F5C842', letterSpacing: 2,
            textShadow: '0 0 10px rgba(245,200,66,0.6)',
          }}>THE HALLWAY</span>
          <span style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 5,
            color: '#A78BFA', letterSpacing: 1, marginTop: 4,
          }}>
            {loading ? 'LOADING…' : `${unlockedCount} / ${totalCount} MEMORIES`}
          </span>
        </div>

        {/* Right-side placeholder for layout symmetry */}
        <div style={{ width: 36 }} />
      </div>

      {/* Hairline ribbon under header */}
      <div className="relative" style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(245,200,66,0.6), transparent)',
        margin: '12px 18px 0',
        zIndex: 2,
      }} />

      {/* ── Scrollable wall ── */}
      <div className="relative flex-1 overflow-y-auto" style={{ zIndex: 2 }}>
        <div className="mx-auto" style={{ maxWidth: 460, padding: '20px 16px 60px' }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ minHeight: 240 }}>
              <span style={{
                fontFamily: '"Press Start 2P", monospace', fontSize: 7,
                color: '#9A8EBE', letterSpacing: 1,
              }}>LOADING THE WALL…</span>
            </div>
          ) : (
            <MemoryWall
              rows={frames}
              partnerId={partner?.id ?? null}
              onReactionChange={applyReaction}
            />
          )}
        </div>
      </div>

      {/* Bottom exit pill (mirrors top chevron for accessibility on long
          scrolls — tap either to leave). */}
      <button
        type="button"
        onClick={exit}
        aria-label="Exit Hallway"
        className="absolute active:scale-95 transition-transform flex items-center gap-2"
        style={{
          left: '50%',
          bottom: 'calc(var(--safe-bottom, 0px) + 16px)',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(180deg, rgba(40,28,60,0.92) 0%, rgba(20,12,32,0.92) 100%)',
          border: '2px solid #5C3A7A',
          boxShadow: '2px 2px 0 #050507, 0 0 10px rgba(167,139,250,0.3)',
          padding: '8px 14px',
          borderRadius: 4,
          cursor: 'pointer',
          zIndex: 5,
        }}
      >
        <IconDoor size={14} />
        <span style={{
          fontFamily: '"Press Start 2P", monospace', fontSize: 6,
          color: '#E8DCFA', letterSpacing: 1.5,
        }}>EXIT</span>
      </button>
    </div>
  )
}
