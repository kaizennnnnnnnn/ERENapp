'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /hallway — the Memory Wall
//
// A Meadow page like Us and Me: a back button to home, the title, a card with
// how much of the wall is filled, then the pictures (MemoryWall). Reached from
// the photo button in home's row, the catch-up carousel, and the memory push
// notification.
// ═════════════════════════════════════════════════════════════════════════════

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCat } from '@/hooks/useCat'
import { useMemoryFrames } from '@/hooks/useMemoryFrames'
import { useCare } from '@/contexts/CareContext'
import { MEMORY_FRAMES, needsPartner } from '@/lib/memoryCatalogue'
import MemoryWall from '@/components/care/MemoryWall'
import { playSound } from '@/lib/sounds'
import { useEffect, useMemo } from 'react'
import { usePageReady } from '@/hooks/usePageReady'
import { Card, IconTile, MeadowPage, Meter, M, TINT } from '@/components/meadow'

export default function HallwayPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const { partner, isSolo, loading: coupleLoading } = useCouple()
  const { setHideStats } = useCare()
  const cat = useCat()
  const { frames, loading, applyReaction } = useMemoryFrames(profile?.household_id ?? null)

  const unlockedCount = frames.length
  // Nine frames need a second person. Counting them in the denominator for a
  // household of one caps the wall at 51/60 forever, which reads as a
  // collection they failed rather than one that was never theirs. Frames they
  // already hold still count on both sides, so the total can never come out
  // below what is on the wall.
  const totalCount = useMemo(() => {
    if (!isSolo) return MEMORY_FRAMES.length
    const held = new Set(frames.map(f => f.frame_id))
    return MEMORY_FRAMES.filter(f => !needsPartner(f) || held.has(f.id)).length
  }, [isSolo, frames])

  // The page wears its own title row; the floating StatsHeader would sit on it.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  // Drop the splash once the shell can render; the wall streams in after.
  usePageReady(!authLoading)

  function exit() {
    playSound('ui_swipe_room')
    // The Hallway is a leaf view. It's normally reached from /home, but it's
    // ALSO opened cold by the memory push notification (sw.js notificationclick
    // → clients.openWindow / navigate('/hallway')), which lands here with no
    // in-app history. In that case router.back() silently no-ops and the exit
    // looks dead. Navigate home explicitly so exit always works — and replace
    // (not push) so it doesn't bounce back into the hallway on the device back
    // gesture.
    router.replace('/home')
  }

  const back = { onClick: exit, label: 'Back to home' }
  if (authLoading) {
    return <MeadowPage ground="us" title="Hallway" back={back} withNav={false}><span /></MeadowPage>
  }

  const counting = loading || coupleLoading
  const left = Math.max(0, totalCount - unlockedCount)

  return (
    <MeadowPage ground="us" title="Hallway" back={back} withNav={false}>
      {/* ── How much of the wall is filled ── */}
      <Card padding="16px 18px" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <IconTile icon="photo" size={52} bg={TINT.love} iconSize={30} />
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {counting ? 'Counting the pictures…' : `${unlockedCount} of ${totalCount} memories`}
            </div>
            <Meter value={counting || !totalCount ? 0 : unlockedCount / totalCount} color={M.love} label="Memories found" />
          </div>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
          {!counting && left === 0
            ? cat.t('Every memory with {name} is on the wall.')
            : cat.t('Moments with {name}, hung here the day they happen.')}
        </p>
      </Card>

      {loading ? (
        <Card padding="28px 18px" style={{ marginTop: 24 }}>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 600, color: M.text2 }}>Loading the wall…</p>
        </Card>
      ) : (
        <MemoryWall
          rows={frames}
          partnerId={partner?.id ?? null}
          partnerName={partner?.name ?? null}
          isSolo={isSolo}
          onReactionChange={applyReaction}
        />
      )}
    </MeadowPage>
  )
}
