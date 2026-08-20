'use client'

export const dynamic = 'force-dynamic'

// Container for the Jelly Parlour hub. Owns the collection and both duel
// boards; ParlourView does the rendering.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'
import { useJellies } from '@/hooks/useJellies'
import { useJellyDuel } from '@/hooks/useJellyDuel'
import ParlourView, { type ParlourGame } from '@/components/jelly/ParlourView'

export default function JellyParlourPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const jellies = useJellies()
  const slice = useJellyDuel('slice')
  const jump = useJellyDuel('jump')

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  const games: ParlourGame[] = [
    {
      id: 'slice',
      title: 'JELLY SLICE',
      blurb: 'Swipe to cut the jellies out of the air. Catch a few in one stroke for a combo — miss three and the round is over.',
      best: slice.best, mineToday: slice.mineToday, theirsToday: slice.theirsToday, theirName: slice.theirName,
    },
    {
      id: 'jump',
      title: 'JELLY JUMP',
      blurb: 'Bounce Eren up the wobbling jellies. They squish once and melt, so keep climbing — the higher he gets, the better.',
      best: jump.best, mineToday: jump.mineToday, theirsToday: jump.theirsToday, theirName: jump.theirName,
    },
  ]

  return (
    <ParlourView
      shelf={jellies.shelf}
      ownedCount={jellies.ownedCount}
      total={jellies.total}
      complete={jellies.complete}
      ownsSkin={jellies.ownsSkin}
      // Gate on the inventory, not the duels: a shelf drawn from an unconfirmed
      // fetch would show every jelly locked to someone who owns them all.
      loaded={jellies.loaded}
      games={games}
      onPlay={id => router.push(`/jelly/${id}`)}
      onOpenCloset={() => router.push('/closet')}
      onBack={() => router.push('/home')}
    />
  )
}
