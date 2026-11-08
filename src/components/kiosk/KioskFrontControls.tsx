'use client'

import { PrimaryButton, MeadowIcon, TYPE } from '@/components/meadow'
import { GRADE_WORD, NIGHT_GOAL } from './kioskEconomy'
import type { KioskRecord } from './useKioskRecord'
import { KIOSK as K, kioskPanel, kioskLabel } from './kioskTheme'
import KioskSpecialBoard from './KioskSpecialBoard'
import type { NightlySpecial } from './kioskSpecials'
import KioskNightPanel from './KioskNightPanel'
import KioskWeeklyStamps from './KioskWeeklyStamps'

export default function KioskFrontControls({ record, mine, practiceReason, disabled, onEnter, special }: {
  record: KioskRecord; mine: boolean; practiceReason: string | null; disabled: boolean; onEnter: () => void; special?: NightlySpecial | null
}) {
  const last = record.lastShift
  const collectingBonus = Boolean(record.night && (record.night.bonus_due > 0 || record.bonusPending || record.bonusError))
  return <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
    zIndex: 25, display: 'grid', gap: 12, maxWidth: 380, margin: '0 auto' }}>
    {special && !collectingBonus && <KioskSpecialBoard special={special} />}
    {record.night && <KioskNightPanel record={record} practiceReason={practiceReason} />}
    {(last || record.stamps) && <details name="kiosk-front-panel" className="kiosk-shift-book" style={{ ...kioskPanel, padding: '0 14px' }}>
      <summary className="m-focus" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 54, cursor: 'pointer', listStyle: 'none' }}>
        <MeadowIcon name="scroll" size={22} mono color={K.leaf} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>
          {record.stamps ? <>Your kiosk week <span style={{ display: 'block', color: K.muted, fontSize: 12, fontWeight: 500 }}>{record.stamps.mine}/7 nights stamped</span></>
            : <>Last shift <span style={{ color: K.muted, fontWeight: 500 }}>/ {last!.served} served</span></>}
        </div>
        {last && <strong aria-label={`Last shift grade ${last.grade}`} style={{ ...TYPE.number, fontSize: 20, color: K.leaf }}>{last.grade}</strong>}
        <span className="kiosk-book-chevron" style={{ display: 'flex' }}><MeadowIcon name="chevronRight" size={16} mono color={K.muted} /></span>
      </summary>
      <div className="m-focus" tabIndex={0} aria-label="Shift book" style={{ padding: '0 0 14px', display: 'grid', gap: 12, fontSize: 14, color: K.muted,
        maxHeight: 'min(32dvh, 240px)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', scrollbarColor: `${K.line} ${K.surface}` }}>
        {record.stamps && <KioskWeeklyStamps week={record.stamps} />}
        {last && <div>Last shift: {mine ? 'you' : 'them'}, {last.served} served / {GRADE_WORD[last.grade]}</div>}
        {last?.note && <p style={{ margin: 0, lineHeight: 1.45, color: K.text }}>{last.note}</p>}
        <div style={{ borderTop: `1px solid ${K.line}`, paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Together tonight</span><strong style={{ color: K.text, ...TYPE.number }}>{record.tonight} / {NIGHT_GOAL}</strong></div>
          <div style={{ height: 5, marginTop: 9, background: K.raised, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(1, record.tonight / NIGHT_GOAL) * 100}%`, background: K.leaf }} />
          </div>
        </div>
        {record.week.mine + record.week.theirs > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>You <strong style={{ color: K.text, ...TYPE.number }}>{record.week.mine}</strong></span>
          <span style={kioskLabel}>Last 7 nights</span><span>Them <strong style={{ color: K.text, ...TYPE.number }}>{record.week.theirs}</strong></span>
        </div>}
      </div>
    </details>}
    {record.loaded && practiceReason && !record.night && <div style={{ ...kioskPanel, padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, lineHeight: 1.4 }}>
      <MeadowIcon name="moon" size={20} mono color={K.muted} /><span><strong>Practice shift</strong><span style={{ color: K.muted, display: 'block' }}>{practiceReason}</span></span>
    </div>}
    <PrimaryButton onClick={onEnter} busy={record.starting} disabled={disabled} icon={<MeadowIcon name="shawarma" size={22} mono color="#FFFFFF" />}>
      {record.starting ? 'Opening shift...' : record.pending > 0 ? 'Recover your shift first' : practiceReason ? 'Start practice shift' : 'Start shift'}
    </PrimaryButton>
  </div>
}
