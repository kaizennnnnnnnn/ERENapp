'use client'

import { useCare } from '@/contexts/CareContext'
import FeedScene from './FeedScene'
import PlayScene from './PlayScene'
import SleepScene from './SleepScene'
import WashScene from './WashScene'
import HospitalScene from './HospitalScene'

export default function CareSceneHost() {
  const { activeScene, closeScene } = useCare()

  if (!activeScene) return null

  const props = { onClose: closeScene }

  return (
    <>
      {activeScene === 'feed'     && <FeedScene     {...props} />}
      {activeScene === 'play'     && <PlayScene     {...props} />}
      {activeScene === 'sleep'    && <SleepScene    {...props} />}
      {activeScene === 'wash'     && <WashScene     {...props} />}
      {activeScene === 'hospital' && <HospitalScene {...props} />}
    </>
  )
}
