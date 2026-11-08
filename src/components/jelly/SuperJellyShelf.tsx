'use client'

import SuperJelly from './SuperJelly'
import { M, MeadowIcon, PrimaryButton, Tag } from '@/components/meadow'
import { useCat } from '@/hooks/useCat'

interface Props {
  count: number
  fed: number
  goal: number
  loaded: boolean
  busy: boolean
  pending: boolean
  error: string | null
  disabled: boolean
  sleeping: boolean
  onFeed: () => void
}

export default function SuperJellyShelf({ count, fed, goal, loaded, busy, pending, error, disabled, sleeping, onFeed }: Props) {
  const cat = useCat()
  if (loaded && count < 1 && !pending && !error) return null
  return (
    <section aria-label="Super Jelly shelf" style={{ padding: '4px 0 18px', marginBottom: 16, borderBottom: `1px solid ${M.divider}` }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <SuperJelly size={88} glow={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between" style={{ gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: M.text }}>Super Jelly</h2>
            <Tag tone="love">{loaded ? `x${count}` : 'Checking'}</Tag>
          </div>
          <p style={{ margin: '4px 0 0', color: M.text2, fontSize: 13, lineHeight: 1.4 }}>Five flavours, one rainbow treat.</p>
          <p style={{ margin: '4px 0 0', color: M.leaf, fontWeight: 800, fontSize: 13 }}>{Math.min(fed, goal)}/{goal} fed for the Jelly coat</p>
        </div>
      </div>
      <div className="flex flex-wrap" style={{ gap: 5, margin: '10px 0 12px' }}>
        {['Hunger +35', 'Joy +45', 'Energy full', 'Sleep +25', 'Clean +20', 'Cures illness', '+120 coins'].map(label => <Tag key={label} size="sm" tone="soft">{label}</Tag>)}
      </div>
      {pending && <p role="status" style={{ color: M.text2, fontSize: 13, lineHeight: 1.4 }}>Confirm your last feed, even if no Jelly is left.</p>}
      {error && <p role="alert" style={{ color: M.danger, fontSize: 13, lineHeight: 1.4 }}>{error}</p>}
      <PrimaryButton busy={busy} disabled={disabled || (!pending && (sleeping || !loaded || count < 1))}
        ariaLabel={pending ? 'Recover Super Jelly feed' : `Feed Super Jelly to ${cat.name}`}
        icon={<MeadowIcon name={pending ? 'replay' : 'sparkle'} size={20} color="#FFFFFF" mono />}
        onClick={onFeed}>
        {busy ? 'Confirming...' : pending ? 'Recover feed' : sleeping ? `${cat.name} is asleep` : `Feed ${cat.name}`}
      </PrimaryButton>
    </section>
  )
}
