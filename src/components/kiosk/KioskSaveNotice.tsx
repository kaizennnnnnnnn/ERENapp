'use client'

import { M, PrimaryButton, MeadowIcon } from '@/components/meadow'

export default function KioskSaveNotice({ busy, error, onRetry, inline = false }: { busy: boolean; error: string | null; onRetry: () => void; inline?: boolean }) {
  return <div className="meadow-root" role="status" aria-live="polite" style={{ padding: inline ? 0 : 12, borderRadius: 8,
    background: inline ? undefined : '#FFFFFF', color: M.text, boxShadow: inline ? undefined : `0 3px 0 ${M.overArtLip}` }}>
    <div style={{ fontSize: 15, fontWeight: 800 }}>{busy ? 'Saving your shift...' : 'Your shift needs confirmation'}</div>
    {error && <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, marginTop: 5, color: M.text2 }}>{error}</div>}
    {!busy && <PrimaryButton size="sm" full onClick={onRetry} icon={<MeadowIcon name="replay" size={16} mono color="#FFFFFF" />} style={{ marginTop: 10 }}>Retry save</PrimaryButton>}
  </div>
}
