'use client'

import { Card, M, MeadowIcon, PrimaryButton } from '@/components/meadow'
import { useCat } from '@/hooks/useCat'

interface Props {
  state: 'give' | 'giving'
  onClick: () => void
  disabled?: boolean
}

export default function GiveLolipopButton({ state, onClick, disabled }: Props) {
  const cat = useCat()
  const giving = state === 'giving'
  return (
    <PrimaryButton className="meadow-root" full onClick={onClick} disabled={disabled} busy={giving}
      ariaLabel={cat.t('Give {name} a lollipop')}
      icon={<MeadowIcon name="lollipop" size={24} mono color="#FFFFFF" />}
      style={{ maxWidth: 340 }}>
      {giving ? 'Unwrapping...' : 'Give lollipop'}
    </PrimaryButton>
  )
}

export function LolipopBanner({ waitLabel }: { waitLabel: string | null }) {
  return (
    <div role="status" className="meadow-root" style={{ width: '100%', maxWidth: 340 }}>
      <Card padding="14px 18px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 3px 0 ${M.overArtLip}` }}>
        <MeadowIcon name={waitLabel === null ? 'heart' : 'clock'} size={22} color={waitLabel === null ? M.love : M.leaf} />
        <span style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {waitLabel === null ? 'Lollipop given' : `Another in ${waitLabel}`}
        </span>
      </Card>
    </div>
  )
}
