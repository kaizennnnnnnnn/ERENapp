'use client'

import { MeadowIcon, PrimaryButton } from '@/components/meadow'

type PlayState = 'locked' | 'ready' | 'saving' | 'done'
const LABEL: Record<PlayState, string> = {
  locked: 'Done playing', ready: 'Done playing', saving: 'Saving...', done: 'Great session!',
}

export default function DonePlayingButton({ state, onClick, disabled }: {
  state: PlayState; onClick: () => void; disabled?: boolean
}) {
  return (
    <PrimaryButton size="md" full onClick={onClick} disabled={disabled || state !== 'ready'} busy={state === 'saving'}
      ariaLabel={state === 'done' ? 'Play session complete' : 'Finish the play session'}
      icon={<MeadowIcon name={state === 'done' ? 'check' : 'paw'} size={20} color="#FFFFFF" />}
      style={{ maxWidth: 320, padding: '0 14px', gap: 10, ...(state === 'done' ? { opacity: 1 } : {}) }}>
      <span style={{ flex: '1 1 0', minWidth: 0 }}>{LABEL[state]}</span>
      <BouncingBall />
    </PrimaryButton>
  )
}

function BouncingBall() {
  return (
    <span aria-hidden style={{ position: 'relative', flexShrink: 0, width: 24, height: 32 }}>
      <span className="playroom-ball-shadow" style={{ position: 'absolute', bottom: 3, left: '50%', width: 16, height: 4, marginLeft: -8,
        borderRadius: '50%', background: 'rgba(0,0,0,.2)', animation: 'playShadow 1.1s ease-in-out infinite' }} />
      <span className="playroom-button-ball" style={{ position: 'absolute', bottom: 7, left: '50%', width: 15, height: 15, marginLeft: -7.5,
        borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FF9EC8, #FF3E80)', border: '1.5px solid #CC1A55',
        transformOrigin: 'bottom center', animation: 'playBounce 1.1s ease-in-out infinite' }} />
      <style>{`@media (prefers-reduced-motion: reduce) { .playroom-button-ball, .playroom-ball-shadow { animation: none !important; } }`}</style>
    </span>
  )
}
