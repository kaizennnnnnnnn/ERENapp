'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { PrimaryButton, MeadowIcon, TYPE } from '@/components/meadow'
import { playSound } from '@/lib/sounds'
import { WEATHER_BY_ID } from './kioskShift'
import { GRADE_WORD, NIGHT_GOAL, GOAL_BONUS } from './kioskEconomy'
import type { ShiftReport as Report } from './useKioskShift'
import KioskSaveNotice from './KioskSaveNotice'
import { KIOSK as K, KIOSK_CSS, kioskLabel } from './kioskTheme'

interface Props {
  report: Report
  practiceReason: string | null
  banked: boolean
  saving: boolean
  saveError: string | null
  onRetry: () => void
  canNote: boolean
  onSaveNote: (note: string) => Promise<boolean>
  onDone: () => void
}
const GRADE_INK = { S: K.coin, A: K.leaf, B: '#B8D3EC', C: '#E9C490', D: K.danger }

function Row({ label, value }: { label: string; value: number }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
    <span style={{ color: K.muted }}>{label}</span><span style={{ ...TYPE.number, color: K.text }}>{value}</span>
  </div>
}

export default function ShiftReport({ report, practiceReason, banked, saving, saveError, onRetry, canNote, onSaveNote, onDone }: Props) {
  const { takings: t, grade, coins, weather, early, unlock, nightTotal, goalMet } = report
  const paidOut = report.paid && banked
  const [note, setNote] = useState(''), [saved, setSaved] = useState(false)
  const [pinning, setPinning] = useState(false), [pinError, setPinError] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => before?.focus({ preventScroll: true })
  }, [])
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.stopPropagation(); onDone(); return }
    if (event.key !== 'Tab') return
    const targets = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')
    if (!targets?.length) return
    const first = targets[0], last = targets[targets.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() }
  }
  async function pinNote() {
    if (!note.trim() || pinning || saved) return
    setPinning(true); setPinError(false)
    try { const ok = await onSaveNote(note.trim()); setSaved(ok); setPinError(!ok); if (ok) playSound('ui_select') }
    catch { setPinError(true) }
    finally { setPinning(false) }
  }
  return <div className="meadow-root kiosk-theme fixed inset-0 z-[80] overflow-y-auto" style={{ background: K.scrim,
    display: 'flex', padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(20px, env(safe-area-inset-bottom, 0px))' }}>
    <style dangerouslySetInnerHTML={{ __html: KIOSK_CSS }} />
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="kiosk-shift-title" tabIndex={-1} onKeyDown={onKey}
      style={{ width: '100%', maxWidth: 350, margin: 'auto', padding: 22, boxSizing: 'border-box', outline: 'none',
        borderRadius: 22, background: K.surface, border: `1px solid ${K.line}`, boxShadow: `0 5px 0 ${K.lip}`,
        animation: 'kioskReceiptIn 380ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
      <header style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div aria-label={`Grade ${grade}`} style={{ width: 52, height: 52, flexShrink: 0, display: 'grid', placeItems: 'center',
          borderRadius: 14, background: K.raised, color: GRADE_INK[grade], fontSize: 30, fontWeight: 800 }}>{grade}</div>
        <div style={{ minWidth: 0 }}><h1 id="kiosk-shift-title" style={{ margin: 0, fontSize: 23, fontWeight: 800, lineHeight: 1.2 }}>Shift complete</h1>
          <p style={{ margin: '5px 0 0', color: K.muted, fontSize: 14, lineHeight: 1.35 }}>{GRADE_WORD[grade]}</p></div>
      </header>
      <div style={{ ...kioskLabel, marginTop: 16, display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
        <MeadowIcon name={early ? 'clock' : 'moon'} size={15} mono color={K.muted} />
        <span>{early ? 'Closed early' : 'Full shift'}</span>
        {WEATHER_BY_ID[weather].note && <><span aria-hidden>/</span><span>{WEATHER_BY_ID[weather].label.toLowerCase()}</span></>}
      </div>
      <section style={{ marginTop: 20, padding: '18px 0', borderTop: `1px solid ${K.line}`, borderBottom: `1px solid ${K.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: K.muted, fontSize: 14 }}>{banked ? 'Taken home' : 'Awaiting confirmation'}</span>
          <div aria-live="polite" aria-label={banked ? `${coins} coins received` : 'Earnings awaiting confirmation'}
            style={{ display: 'flex', alignItems: 'center', gap: 8, color: banked ? K.coin : K.muted, fontSize: 34, lineHeight: 1, ...TYPE.number }}>
            <MeadowIcon name="coin" size={25} />{banked ? coins : '...'}</div>
        </div>
        {practiceReason && <p style={{ fontSize: 13, lineHeight: 1.45, color: K.muted, margin: '12px 0 0' }}>{practiceReason}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 17 }}>
          <Row label="Base" value={t.base} /><Row label="Tips" value={t.tips} />
        </div>
        {early && t.tips === 0 && <p style={{ fontSize: 13, lineHeight: 1.45, color: K.muted, margin: '10px 0 0' }}>Tips stay in the till when you close early.</p>}
      </section>
      {!banked && <div style={{ marginTop: 16 }}><KioskSaveNotice inline busy={saving} error={saveError} onRetry={onRetry} /></div>}
      <section aria-label="Shift results" style={{ display: 'grid', gap: 9, marginTop: 17 }}>
        <Row label="Orders served" value={t.served} /><Row label="Best run" value={t.bestStreak} />
        {t.wrong > 0 && <Row label="Handed back" value={t.wrong} />}
        {t.walked > 0 && <Row label="Walked away" value={t.walked} />}
        {t.inDark > 0 && <Row label="Served in the dark" value={t.inDark} />}
        {t.missedCalls > 0 && <Row label="Missed calls" value={t.missedCalls} />}
      </section>
      <section aria-label="Shared nightly progress" style={{ borderTop: `1px solid ${K.line}`, marginTop: 17, paddingTop: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
          <span style={{ color: K.muted }}>Together tonight</span><strong style={TYPE.number}>{nightTotal}<span style={{ color: K.muted, fontWeight: 500 }}> / {NIGHT_GOAL}</span></strong>
        </div>
        <div role="progressbar" aria-label="Shared nightly orders" aria-valuemin={0} aria-valuemax={NIGHT_GOAL} aria-valuenow={Math.min(NIGHT_GOAL, nightTotal)}
          style={{ height: 6, borderRadius: 4, background: K.raised, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(1, nightTotal / NIGHT_GOAL) * 100}%`, background: K.leaf, borderRadius: 4 }} />
        </div>
        {goalMet && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 9, color: K.leaf, fontSize: 13 }}>
          <span>Nightly goal complete</span>{paidOut && (report.nightBonus ?? GOAL_BONUS) > 0 && <strong>+{report.nightBonus ?? GOAL_BONUS} coins</strong>}</div>}
      </section>
      {banked && unlock && <div style={{ marginTop: 15, color: K.leaf, fontSize: 14, lineHeight: 1.4 }}>
        <strong>{unlock.kind === 'menu' ? 'New on the menu' : 'Milestone reached'}: {unlock.label.toLowerCase()}</strong>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: K.muted }}>{unlock.blurb}</p>
      </div>}
      {canNote && <form onSubmit={event => { event.preventDefault(); void pinNote() }} style={{ marginTop: 18 }}>
        <label htmlFor="kiosk-till-note" style={{ ...kioskLabel, display: 'block', marginBottom: 8 }}>Leave a note at the till</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id="kiosk-till-note" className="kiosk-note-input" value={note} onChange={e => { setNote(e.target.value); setSaved(false); setPinError(false) }}
            maxLength={60} placeholder="Anything for the next shift?" aria-label="A note for whoever works next"
            style={{ width: '100%', minWidth: 0, height: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 8,
              background: K.ground, border: `1px solid ${K.line}`, color: K.text, fontSize: 14, fontWeight: 500 }} />
          <button type="submit" className="m-focus kiosk-icon-tool" title={saved ? 'Note pinned' : 'Pin note'} aria-label={saved ? 'Note pinned' : 'Pin note'}
            disabled={!note.trim() || saved || pinning} aria-busy={pinning || undefined} style={{ position: 'relative', display: 'grid', placeItems: 'center',
              width: 44, height: 44, flexShrink: 0, border: 0, borderRadius: 8, background: saved ? K.raised : K.leafFace,
              color: K.text, opacity: !note.trim() || pinning ? 0.5 : 1 }}>
            <MeadowIcon name={saved ? 'check' : 'pin'} size={19} mono color={saved ? K.leaf : '#FFFFFF'} />
            <span className="kiosk-action-tooltip">{saved ? 'Note pinned' : 'Pin note'}</span>
          </button>
        </div>
        <div role="status" style={{ minHeight: saved || pinError ? 20 : 0, marginTop: saved || pinError ? 6 : 0, fontSize: 13, color: pinError ? K.danger : K.leaf }}>
          {pinError ? 'Could not pin the note. Try again.' : saved ? 'Pinned for the next shift.' : null}
        </div>
      </form>}
      <PrimaryButton onClick={() => { playSound('ui_back'); onDone() }} icon={<MeadowIcon name="chevronLeft" size={18} mono color="#FFFFFF" />}
        style={{ marginTop: 20 }} size="md" full>Back to the street</PrimaryButton>
    </div>
  </div>
}
