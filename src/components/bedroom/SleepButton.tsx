'use client'

import { useCat } from '@/hooks/useCat'
import { MeadowIcon, PrimaryButton } from '@/components/meadow'

type SleepState = 'tuck' | 'tucking' | 'wake' | 'waking'
const LABEL: Record<SleepState, string> = {
  tuck: 'Tuck in', tucking: 'Tucking in...', wake: 'Wake up', waking: 'Waking up...',
}

export default function SleepButton({ state, onClick, disabled }: {
  state: SleepState; onClick: () => void; disabled?: boolean
}) {
  const cat = useCat()
  const night = state === 'tuck' || state === 'tucking'
  const busy = state === 'tucking' || state === 'waking'
  return (
    <PrimaryButton size="md" full onClick={onClick} disabled={disabled || busy} busy={busy}
      ariaLabel={cat.t(night ? 'Tuck {name} into bed' : 'Wake {name} up')}
      icon={<MeadowIcon name={night ? 'moon' : 'sun'} size={20} color="#FFFFFF" />}
      style={{ maxWidth: 320, padding: '0 14px', gap: 10 }}>
      <span style={{ flex: '1 1 0', minWidth: 0 }}>{LABEL[state]}</span>
      <span aria-hidden style={{ position: 'relative', width: 32, height: 30, flexShrink: 0 }}>
        {night ? [0, 1, 2].map(i => <span key={i} className="sleep-button-motif" style={{ position: 'absolute', bottom: 0, left: i * 10,
          fontSize: 11 + i * 2, fontWeight: 700, color: '#FFFFFF', animation: `sleepZ 2.4s ease-in-out ${i * .55}s infinite` }}>z</span>)
          : [0, 1, 2].map(i => <MeadowIcon key={i} name="star" size={i === 0 ? 12 : 8} color="#FFFFFF" className="sleep-button-motif"
            style={{ position: 'absolute', top: i * 9, left: i === 1 ? 19 : 4, animation: `sleepTwinkle 2.2s ease-in-out ${i * .6}s infinite` }} />)}
      </span>
      <style>{`@media (prefers-reduced-motion: reduce) { .sleep-button-motif { animation: none !important; } }`}</style>
    </PrimaryButton>
  )
}
