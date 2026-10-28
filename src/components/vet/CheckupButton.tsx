'use client'

import { MeadowIcon, PrimaryButton } from '@/components/meadow'
import { useCat } from '@/hooks/useCat'

interface Props {
  state: 'check' | 'checking'
  onClick: () => void
  disabled?: boolean
}

export default function CheckupButton({ state, onClick, disabled }: Props) {
  const cat = useCat()
  const checking = state === 'checking'
  return (
    <PrimaryButton className="meadow-root" full onClick={onClick} disabled={disabled} busy={checking}
      ariaLabel={checking ? cat.t('Examining {name}') : cat.t('Give {name} a check-up')}
      icon={<MeadowIcon name="stethoscope" size={24} mono color="#FFFFFF" />}
      style={{ maxWidth: 340 }}>
      {checking ? 'Examining...' : 'Check-up'}
    </PrimaryButton>
  )
}
