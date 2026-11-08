'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'
import { useJellies } from '@/hooks/useJellies'
import { useJellyDuel } from '@/hooks/useJellyDuel'
import { useCat } from '@/hooks/useCat'
import ParlourView, { type ParlourGame } from '@/components/jelly/ParlourView'
import { M, PrimaryButton, MeadowIcon } from '@/components/meadow'

export default function JellyParlourPage() {
  const router = useRouter()
  const { setHideStats, openScene } = useCare()
  const jellies = useJellies()
  const run = useJellyDuel('run')
  const jump = useJellyDuel('jump')
  const cat = useCat()

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  const games: ParlourGame[] = [
    { id: 'run', title: 'Jelly Run', blurb: 'Outrun the jelly tide.', best: run.best, mineToday: run.mineToday, theirsToday: run.theirsToday, theirName: run.theirName },
    { id: 'jump', title: 'Jelly Jump', blurb: cat.t('Bounce {him} up the shelves.'), best: jump.best, mineToday: jump.mineToday, theirsToday: jump.theirsToday, theirName: jump.theirName },
  ]

  return <ParlourView recovery={jellies.roundsPending.length > 0 && <section style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${M.divider}` }}>
    <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: M.text }}>Your last Jelly round is waiting</p>
    {(['run', 'jump'] as const).filter(game => jellies.roundsPending.some(r => r.args.p_game === game)).map(game => <div key={game} style={{ marginTop: 8 }}>
      <PrimaryButton icon={<MeadowIcon name="replay" size={20} color="#FFFFFF" mono />} onClick={() => router.push(`/jelly/${game}`)}>Recover Jelly {game === 'run' ? 'Run' : 'Jump'}</PrimaryButton>
    </div>)}
  </section>}
    tray={jellies.tray} trayCount={jellies.trayCount} traySize={jellies.traySize}
    supers={jellies.supers} fed={jellies.fed} feedGoal={jellies.feedGoal} ownsSkin={jellies.ownsSkin}
    feeding={false} feedPending={jellies.feedPending} feedError={null}
    blocked={jellies.blocked} loaded={jellies.loaded} games={games}
    onPlay={id => router.push(`/jelly/${id}`)}
    onFeed={() => { openScene('feed'); router.push('/home') }}
    onOpenCloset={() => router.push('/closet')} onBack={() => router.push('/home')}
  />
}
