'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /bucket-list — the household's plans for later
//
// Reached from the checklist button in home's row and from the bucket-list
// push ("Lidija added to your bucket list"). The page is BucketListView; this
// wires it to useBucketList and the couple, and stamps the list as seen so
// home's badge clears.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useBucketList } from '@/hooks/useBucketList'
import { useCare } from '@/contexts/CareContext'
import { usePageReady } from '@/hooks/usePageReady'
import { playSound } from '@/lib/sounds'
import { markBucketSeen } from '@/lib/bucketList'
import BucketListView from '@/components/bucket/BucketListView'
import type { PlanPeople } from '@/components/bucket/PlanDetailSheet'

export default function BucketListPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const { partner, isSolo } = useCouple()
  const { setHideStats } = useCare()
  const list = useBucketList(profile?.household_id ?? null, user?.id ?? null)

  // The page wears its own title row; the floating StatsHeader would sit on it.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  usePageReady(!authLoading)

  // Seen on the way in, and again on the way out so plans that arrived while
  // the page was open don't badge home either.
  useEffect(() => {
    if (!user?.id) return
    const id = user.id
    markBucketSeen(id)
    return () => markBucketSeen(id)
  }, [user?.id])

  const people = useMemo<PlanPeople>(() => ({
    nameOf: id => !id ? null
      : id === user?.id ? 'you'
      : id === partner?.id ? partner?.name?.split(' ')[0] ?? null
      : null,
    heartOf: id => id === user?.id ? profile?.heart : id === partner?.id ? partner?.heart : undefined,
  }), [user?.id, profile?.heart, partner?.id, partner?.name, partner?.heart])

  // A push opens this page cold, with no history to go back to.
  const exit = useCallback(() => {
    playSound('ui_back')
    router.replace('/home')
  }, [router])

  return (
    <BucketListView
      plans={list.plans}
      loading={authLoading || list.loading}
      missing={list.missing}
      isSolo={isSolo}
      people={people}
      onBack={exit}
      onAdd={async input => (await list.add(input)).ok}
      onEdit={async (id, input) => (await list.edit(id, input)).ok}
      onSetDone={async (id, done) => (await list.setDone(id, done)).ok}
      onRemove={async id => (await list.remove(id)).ok}
    />
  )
}
