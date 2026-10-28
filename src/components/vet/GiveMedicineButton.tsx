'use client'

import { Card, M, MeadowIcon, PrimaryButton } from '@/components/meadow'
import { useCat } from '@/hooks/useCat'

interface Props {
  state: 'give' | 'giving'
  onClick: () => void
  disabled?: boolean
}

export default function GiveMedicineButton({ state, onClick, disabled }: Props) {
  const cat = useCat()
  const giving = state === 'giving'
  return (
    <PrimaryButton className="meadow-root" full onClick={onClick} disabled={disabled} busy={giving}
      ariaLabel={cat.t('Give {name} medicine')}
      icon={<MeadowIcon name="pill" size={24} mono color="#FFFFFF" />}
      style={{ maxWidth: 340 }}>
      {giving ? 'Giving medicine...' : 'Give medicine'}
    </PrimaryButton>
  )
}

export function MedicineResultBanner({ healthy }: { healthy: boolean }) {
  return (
    <div role="status" className="meadow-root" style={{ width: '100%', maxWidth: 340 }}>
      <Card padding="14px 18px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 3px 0 ${M.overArtLip}` }}>
        <MeadowIcon name={healthy ? 'check' : 'pill'} size={22} color={M.leaf} />
        <span style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 800 }}>{healthy ? 'All good' : 'Medicine given'}</span>
      </Card>
    </div>
  )
}
