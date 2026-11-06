'use client'

import { M, MeadowIcon, TextButton, TYPE } from '@/components/meadow'

export default function GameSaveNotice({ pending, busy, error, onRetry }: {
  pending: number; busy: boolean; error: string | null; onRetry: () => void
}) {
  if (!pending) return null
  return <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', color: M.text2 }}>
    <MeadowIcon name="pad" size={24} />
    <div style={{ flex: 1, minWidth: 0, ...TYPE.body, fontSize: 13, overflowWrap: 'anywhere' }}>
      {busy ? 'Saving game results...' : error ?? `${pending} game ${pending === 1 ? 'result' : 'results'} waiting to save.`}
    </div>
    <TextButton disabled={busy} onClick={onRetry}><MeadowIcon name="replay" size={16} /> Retry</TextButton>
  </div>
}
