'use client'

import { useCat } from '@/hooks/useCat'
import { MeadowIcon, PrimaryButton } from '@/components/meadow'

export default function TalkButton({ onClick }: { onClick: () => void }) {
  const cat = useCat()
  return (
    <PrimaryButton
      size="md"
      full
      onClick={onClick}
      ariaLabel={cat.t('Talk to {name}')}
      icon={<MeadowIcon name="speech" size={22} color="#FFFFFF" />}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.t('Talk to {name}')}</span>
    </PrimaryButton>
  )
}
