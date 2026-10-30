'use client'

import { MeadowIcon, PrimaryButton } from '@/components/meadow'

export default function PeriodicTableButton({ onClick }: { onClick: () => void }) {
  return (
    <PrimaryButton className="meadow-root" size="md" full onClick={onClick}
      ariaLabel="Open the periodic table" icon={<MeadowIcon name="book" size={22} />}>
      Study
    </PrimaryButton>
  )
}
