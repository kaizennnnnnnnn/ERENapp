'use client'

import { Card, M, MeadowIcon, PrimaryButton, ROOM_HEADER_CLEARANCE, Tag, TextButton } from '@/components/meadow'
import { useCat } from '@/hooks/useCat'

export type ClinicPhase = 'loading' | 'sick' | 'giving' | 'recover' | 'recovering' | 'treated' | 'healthy'

export default function ClinicControls({ phase, reasons, weight, onGive, onClose, saveError, disabled = false }: {
  phase: ClinicPhase
  reasons: string[]
  weight: number
  onGive: () => void
  onClose: () => void
  saveError?: string | null
  disabled?: boolean
}) {
  const cat = useCat()
  const finished = phase === 'treated' || phase === 'healthy'
  const giving = phase === 'giving' || phase === 'recovering'
  const recover = phase === 'recover' || phase === 'recovering'
  const label = phase === 'loading' ? 'Loading' : recover ? 'Confirm treatment' : giving ? 'Treating' : phase === 'sick' ? 'Needs care' : phase === 'treated' ? 'Medicine given' : 'Healthy'
  const message = phase === 'loading' ? cat.t('Checking on {name}...')
    : recover ? giving ? 'Checking the saved treatment...' : saveError ?? 'Your last treatment needs confirmation. Retry checks the same dose.'
    : giving ? 'Saving the treatment...'
    : phase === 'treated' ? (reasons.length > 0 ? 'Medicine saved. Keep up the care.' : cat.t('{name} is feeling better.'))
    : phase === 'healthy' ? cat.t('{name} is feeling well.')
    : cat.t('{name} is feeling unwell.')
  return <>
    <section aria-label="Clinic care notes" className="meadow-root absolute inset-x-4 z-30" style={{ top: `calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE}px)`, maxWidth: 340, marginInline: 'auto' }}>
      <Card padding={14} style={{ boxShadow: `0 3px 0 ${M.overArtLip}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, lineHeight: 1.3, fontWeight: 800 }}>
            <MeadowIcon name="stethoscope" size={22} />Vet clinic
          </h2>
          <Tag tone={finished ? 'leaf' : 'amber'}>{label}</Tag>
        </div>
        <p role="status" aria-atomic="true" style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 500, lineHeight: 1.4, color: M.text2, overflowWrap: 'anywhere' }}>{message}</p>
        {phase !== 'loading' && (reasons.length > 0 || weight > 6.5) && <ul aria-label="Care needs" style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
          {reasons.map(reason => <li key={reason} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, lineHeight: 1.4, fontWeight: 700 }}>
            <MeadowIcon name="plus" size={12} color={M.energy} />{reason}
          </li>)}
          {weight > 6.5 && <li style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 700, color: M.text2 }}>Weight: {weight.toFixed(1)} kg</li>}
        </ul>}
      </Card>
    </section>

    <div className="meadow-root absolute inset-x-4 z-30" style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', maxWidth: 340, marginInline: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <PrimaryButton full onClick={finished ? onClose : onGive} disabled={!finished && (disabled || phase === 'loading' || giving)} busy={giving}
        ariaLabel={finished ? 'Back home' : recover ? 'Retry treatment save' : cat.t('Give {name} medicine')}
        icon={<MeadowIcon name={finished ? 'home' : 'pill'} size={22} mono color="#FFFFFF" />}>
        {finished ? 'Back home' : recover ? giving ? 'Checking treatment...' : 'Retry treatment save' : giving ? 'Giving medicine...' : 'Give medicine'}
      </PrimaryButton>
      {!finished && <TextButton onClick={onClose} style={{ color: M.text, background: '#FFFFFF', borderRadius: 999, padding: '0 18px', boxShadow: `0 3px 0 ${M.overArtLip}` }}>Back home</TextButton>}
    </div>
  </>
}
