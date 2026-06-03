'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoriesScene — Phase 3 PR 7
//
// The "Hallway" — 7th swipe-room slotted between bedroom and bathroom in
// CareSceneHost. A dark, contemplative wall covered in picture frames; each
// frame is an unlocked memory, locked frames show as dim silhouettes so the
// catalogue size feels real even on day one.
//
// Background is CSS-rendered (no PNG asset yet) — dark purple wall with a
// CRT scanline overlay + a subtle gold ceiling glow so the room reads as
// distinct from the care scenes without needing an image.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useMemoryFrames } from '@/hooks/useMemoryFrames'
import { MEMORY_FRAMES } from '@/lib/memoryCatalogue'
import MemoryWall from './MemoryWall'

interface Props { onClose: () => void }

export default function MemoriesScene({ }: Props) {
  const { profile } = useAuth()
  const { partner } = useCouple()
  const { frames, loading, applyReaction } = useMemoryFrames(profile?.household_id ?? null)

  // Stamp memory_last_seen_at when the user enters the hallway — PR 9 push
  // routes use this to suppress new-memory pushes for partners who just
  // looked at the wall.
  useEffect(() => {
    // Implementation lands in PR 9 alongside the push routes that read it.
    // For now we just rely on the realtime channel keeping the UI fresh.
  }, [])

  const unlockedCount = frames.length
  const totalCount = MEMORY_FRAMES.length

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden"
      style={{
        // Dark wall — deep purple gradient with a soft gold ceiling glow.
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(245,200,66,0.10) 0%, transparent 45%),
          linear-gradient(180deg, #1A0E24 0%, #100818 60%, #0A0512 100%)
        `,
      }}
    >
      {/* CRT scanlines — same trick as the leaderboards / rewards panels */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.20) 3px, rgba(0,0,0,0.20) 4px)',
        opacity: 0.5,
      }} />

      {/* Wall texture — faint diagonal noise so it doesn't read as flat. */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 8px)',
      }} />

      {/* Header — title + counter + Eren-room visual quirk */}
      <div className="relative pt-16 px-5 pb-4 flex flex-col items-center" style={{ zIndex: 2 }}>
        <span style={{
          fontFamily: '"Press Start 2P", monospace', fontSize: 9,
          color: '#F5C842', letterSpacing: 2,
          textShadow: '0 0 8px rgba(245,200,66,0.5)',
        }}>THE HALLWAY</span>
        <span className="mt-2" style={{
          fontFamily: '"Press Start 2P", monospace', fontSize: 6,
          color: '#A78BFA', letterSpacing: 1,
        }}>
          {loading ? 'LOADING…' : `${unlockedCount} / ${totalCount} MEMORIES`}
        </span>
      </div>

      {/* Hairline gold ribbon under the header to anchor the wall visually */}
      <div className="relative" style={{
        height: 1, background: 'linear-gradient(90deg, transparent, rgba(245,200,66,0.5), transparent)',
        zIndex: 2,
      }} />

      {/* Scrollable wall area */}
      <div className="relative flex-1 overflow-y-auto" style={{ zIndex: 2 }}>
        <div className="mx-auto" style={{ maxWidth: 420, padding: '16px 14px 0' }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
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
    </div>
  )
}
