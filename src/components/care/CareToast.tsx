'use client'

import { Card, M, MeadowIcon, ROOM_HEADER_CLEARANCE } from '@/components/meadow'

interface Props {
  msg: string
  ok?: boolean
  tone?: string
  top?: number | string
}

export default function CareToast({ msg, ok = true, tone = M.leaf, top = `calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE}px)` }: Props) {
  return (
    <div role={ok ? 'status' : 'alert'} aria-atomic="true" className="meadow-root absolute inset-x-0 z-50 flex justify-center px-4 pointer-events-none" style={{ top }}>
      <Card className="care-toast-panel" padding="12px 14px" style={{ width: '100%', maxWidth: 360, display: 'flex', alignItems: 'flex-start', gap: 8,
        boxShadow: `0 3px 0 ${M.overArtLip}`, fontSize: 15, lineHeight: 1.4, fontWeight: 700 }}>
        <MeadowIcon name={ok ? 'check' : 'close'} size={20} color={ok ? tone : M.danger} />
        <span style={{ flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' }}>{msg}</span>
      </Card>
      <style>{`
        .care-toast-panel { animation: careToastIn 160ms ease-out both; }
        @keyframes careToastIn { from { transform: translateY(-6px); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .care-toast-panel { animation: none; } }
      `}</style>
    </div>
  )
}
