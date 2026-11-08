'use client'

import { M, MeadowIcon, PrimaryButton, TextButton } from '@/components/meadow'
import { playSound } from '@/lib/sounds'

export default function JellyRoundRecovery({ saving, error, onRetry, onExit }: { saving: boolean; error: string | null; onRetry: () => void; onExit: () => void }) {
  return <div className="meadow-root fixed inset-0 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Jelly round save"
    style={{ zIndex: 85, padding: 20, background: 'rgba(47,43,40,0.48)', boxSizing: 'border-box' }}>
    <div style={{ width: '100%', maxWidth: 320, padding: 22, borderRadius: 24, background: '#FFFFFF', boxSizing: 'border-box', textAlign: 'center' }}>
      <MeadowIcon name={saving ? 'clock' : 'replay'} size={30} color={M.leaf} />
      <h2 style={{ margin: '12px 0 8px', fontSize: 21, fontWeight: 800, color: M.text }}>{saving ? 'Saving your round' : 'Your round is waiting'}</h2>
      <p role={error ? 'alert' : 'status'} style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
        {saving ? 'Confirming your score and Jelly rewards.' : error ?? 'Recover your last round before starting another.'}
      </p>
      <PrimaryButton busy={saving} disabled={saving} ariaLabel="Recover Jelly round" icon={<MeadowIcon name="replay" size={20} color="#FFFFFF" mono />}
        onClick={() => { playSound('ui_tap'); onRetry() }}>{saving ? 'Confirming...' : 'Recover round'}</PrimaryButton>
      <TextButton disabled={saving} onClick={() => { playSound('ui_back'); onExit() }} style={{ marginTop: 10 }}>Back to Parlour</TextButton>
    </div>
  </div>
}
