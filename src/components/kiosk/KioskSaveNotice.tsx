'use client'

import { PrimaryButton, MeadowIcon } from '@/components/meadow'
import { KIOSK as K, kioskPanel } from './kioskTheme'

export default function KioskSaveNotice({ busy, error, onRetry, inline = false }: { busy: boolean; error: string | null; onRetry: () => void; inline?: boolean }) {
  return <div className="meadow-root kiosk-theme" role="status" aria-live="polite" style={{ ...(inline ? {} : kioskPanel), padding: inline ? 0 : 14, color: K.text }}>
    <div style={{ fontSize: 15, fontWeight: 800 }}>{busy ? 'Saving your shift...' : 'Your shift needs confirmation'}</div>
    {error && <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, marginTop: 5, color: K.muted }}>{error}</div>}
    {!busy && <PrimaryButton size="sm" full onClick={onRetry} icon={<MeadowIcon name="replay" size={16} mono color="#FFFFFF" />} style={{ marginTop: 10 }}>Retry save</PrimaryButton>}
  </div>
}
