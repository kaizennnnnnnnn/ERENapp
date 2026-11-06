'use client'

// The machine's two pull buttons, in Meadow: Pull 1 on the soft face, Pull 10
// on the leaf one (the screen's one primary, and the better value). Each says
// what it costs under its name, so the price is read before the tap rather
// than found out after it. The daily food offer comes first, then held tickets,
// then coins.

import { M, MeadowIcon, PrimaryButton, SecondaryButton } from '@/components/meadow'

interface Props {
  tier: 'single' | 'ten'
  /** Coin price, shown under the name. */
  cost: number
  disabled?: boolean
  /** Single only: a ticket is held, so this pull is free. */
  showTicket?: boolean
  showFree?: boolean
  onClick: () => void
}

export default function GachaPullButton({ tier, cost, disabled, showTicket, showFree, onClick }: Props) {
  const ten = tier === 'ten'
  const free = showFree && !ten
  const ticket = !free && showTicket && !ten
  const Button = ten ? PrimaryButton : SecondaryButton
  return (
    <Button onClick={onClick} disabled={disabled} full={false}
      ariaLabel={ten ? `Pull ten times for ${cost} coins` : free ? 'Claim free food pull' : ticket ? 'Pull once with a ticket' : `Pull once for ${cost} coins`}
      style={{ flex: '1 1 0', minWidth: 0, height: 60, padding: '0 12px' }}>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, lineHeight: 1.1 }}>
        {ten ? 'Pull 10' : 'Pull 1'}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700,
          color: ten ? 'rgba(255,255,255,0.88)' : M.text2, fontVariantNumeric: 'tabular-nums',
        }}>
          <MeadowIcon name={free ? 'gift' : ticket ? 'ticket' : 'coin'} size={16} />
          {free ? 'Free food pull' : ticket ? 'Free with a ticket' : cost}
        </span>
      </span>
    </Button>
  )
}
