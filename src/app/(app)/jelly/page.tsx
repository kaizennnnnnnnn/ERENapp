'use client'

export const dynamic = 'force-dynamic'

// Container for the Jelly Parlour hub. Owns today's tray, both duel boards, and
// the Super Jelly feed; ParlourView does the rendering.
//
// The feed is a two-step hand-off on purpose: feedSuper() runs the RPC FIRST
// and only then mounts the scene with the numbers it returned. The animation is
// never what decides whether the feed counted, so closing the tab mid-scene
// can't eat a jelly for nothing — and when the fifth feed grants the skin, the
// unlock cinematic is queued behind the feed scene rather than racing it.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import { useJellies, type FeedResult } from '@/hooks/useJellies'
import { useJellyDuel } from '@/hooks/useJellyDuel'
import { GACHA_SKINS } from '@/lib/skins'
import { JELLY_SKIN_ID } from '@/lib/jellies'
import { wearSkinEverywhere } from '@/lib/skinGrant'
import ParlourView, { type ParlourGame } from '@/components/jelly/ParlourView'
import SuperJellyFeed from '@/components/jelly/SuperJellyFeed'
import SkinUnlockCinematic from '@/components/care/SkinUnlockCinematic'

export default function JellyParlourPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const { setHideStats } = useCare()
  const jellies = useJellies()
  const run = useJellyDuel('run')
  const jump = useJellyDuel('jump')

  // The feed scene, holding the RPC's own numbers.
  const [feedScene, setFeedScene] = useState<FeedResult | null>(null)
  // Queued behind it: the fifth feed earned the coat.
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  const onFeed = useCallback(async () => {
    const res = await jellies.feedSuper()
    if (res.ok) setFeedScene(res)
  }, [jellies])

  const games: ParlourGame[] = [
    {
      id: 'run',
      title: 'JELLY RUN',
      blurb: 'Outrun the jelly tide. Tap to jump, hold for height, swipe down to drop into the cellar.',
      best: run.best, mineToday: run.mineToday, theirsToday: run.theirsToday, theirName: run.theirName,
    },
    {
      id: 'jump',
      title: 'JELLY JUMP',
      blurb: 'Bounce him up the shelves. Every jelly melts after one hop, so keep climbing.',
      best: jump.best, mineToday: jump.mineToday, theirsToday: jump.theirsToday, theirName: jump.theirName,
    },
  ]

  const jellySkin = GACHA_SKINS.find(s => s.id === JELLY_SKIN_ID)

  return (
    <>
      <ParlourView
        tray={jellies.tray}
        trayCount={jellies.trayCount}
        traySize={jellies.traySize}
        supers={jellies.supers}
        fed={jellies.fed}
        feedGoal={jellies.feedGoal}
        ownsSkin={jellies.ownsSkin}
        feeding={jellies.feeding}
        blocked={jellies.blocked}
        // Gate on the progress row AND the inventory: a tray drawn from an
        // unconfirmed fetch would show five empty slots to someone who filled
        // four this morning.
        loaded={jellies.loaded}
        games={games}
        onPlay={id => router.push(`/jelly/${id}`)}
        onFeed={onFeed}
        onOpenCloset={() => router.push('/closet')}
        onBack={() => router.push('/home')}
      />

      {feedScene && (
        <SuperJellyFeed
          fed={feedScene.fed}
          goal={jellies.feedGoal}
          supersLeft={feedScene.supers}
          onClose={() => {
            const earned = feedScene.skinGranted
            setFeedScene(null)
            if (earned) setUnlocking(true)
          }}
        />
      )}

      {unlocking && jellySkin && (
        <SkinUnlockCinematic
          skin={jellySkin}
          variant="jelly"
          earnedLine="He ate five Super Jellies and set like one."
          onWear={async () => {
            if (profile?.household_id) await wearSkinEverywhere(profile.household_id, JELLY_SKIN_ID)
            setUnlocking(false)
          }}
          onClose={() => setUnlocking(false)}
        />
      )}
    </>
  )
}
