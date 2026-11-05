'use client'

import { Card, M, MeadowIcon, PrimaryButton, ROOM_HEADER_CLEARANCE } from '@/components/meadow'

export default function FoodSaveRecovery({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  return (
    <div className="meadow-root absolute inset-x-0 z-[70] px-4" style={{ top: `calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE}px)` }}>
      <Card padding="14px" style={{ maxWidth: 360, margin: '0 auto', boxShadow: `0 3px 0 ${M.overArtLip}` }}>
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.4, fontWeight: 700, color: M.text }}>
          Your last food save needs confirmation.
        </p>
        <PrimaryButton disabled={busy} onClick={onRetry} icon={<MeadowIcon name="clock" size={20} />}>
          {busy ? 'Confirming...' : 'Recover save'}
        </PrimaryButton>
      </Card>
    </div>
  )
}
