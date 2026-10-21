'use client'

// ─── PlanDetailSheet ─────────────────────────────────────────────────────────
// Tap a plan: everything about it (kind, by when, the note, who added it and
// who ticked it off), and what you can do with it: tick it off or take the
// tick back, edit it, remove it. Remove asks once more.
//
// `plan` stays set while `open` goes false, so the sheet drops away with the
// plan still in it.

import { useEffect, useState } from 'react'
import { kindMeta, planDate, type PlanRow } from '@/lib/bucketList'
import {
  DangerButton, M, MeadowIcon, PrimaryButton, SecondaryButton, Sheet, Tag, personColor,
} from '@/components/meadow'

export interface PlanPeople {
  /** "you", the partner's first name, or null when unknown. */
  nameOf: (id: string | null) => string | null
  heartOf: (id: string | null) => 'brown_heart' | 'pink_heart' | 'sparkle' | undefined
}

export default function PlanDetailSheet({ open, plan, people, busy, onClose, onToggleDone, onEdit, onRemove }: {
  open: boolean
  plan: PlanRow | null
  people: PlanPeople
  /** A write for this plan is in flight. */
  busy: boolean
  onClose: () => void
  onToggleDone: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  useEffect(() => { if (open) setConfirming(false) }, [open, plan?.id])

  if (!plan) return null
  const kind = kindMeta(plan.kind)
  const done = !!plan.done_at
  const addedBy = people.nameOf(plan.created_by)
  const doneBy = people.nameOf(plan.done_by)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={plan.title}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {done ? (
            <SecondaryButton busy={busy} onClick={onToggleDone}>Not done yet</SecondaryButton>
          ) : (
            <PrimaryButton busy={busy} onClick={onToggleDone}
              icon={<MeadowIcon name="check" size={18} mono color="#FFFFFF" />}>
              Tick it off
            </PrimaryButton>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <SecondaryButton full onClick={onEdit} disabled={busy} style={{ flex: 1 }}>Edit</SecondaryButton>
            <DangerButton full disabled={busy} style={{ flex: 1 }}
              onClick={() => { if (confirming) onRemove(); else setConfirming(true) }}>
              {confirming ? 'Sure?' : 'Remove'}
            </DangerButton>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Tag icon={<MeadowIcon name={kind.icon} size={16} />}>{kind.label}</Tag>
        {plan.target && (
          <Tag tone="amber" icon={<MeadowIcon name="calendar" size={16} />}>{plan.target}</Tag>
        )}
        {done && <Tag tone="leaf" icon={<MeadowIcon name="check" size={14} color={M.leafInk} mono />}>Done</Tag>}
      </div>

      {plan.note && (
        <p style={{
          margin: '16px 0 0', padding: '12px 14px', borderRadius: 16, background: M.soft,
          fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        }}>{plan.note}</p>
      )}

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Line color={personColor(people.heartOf(plan.created_by))}>
          Added {planDate(plan.created_at)}
          {addedBy && <> by <b style={{ color: M.text }}>{addedBy}</b></>}
        </Line>
        {done && plan.done_at && (
          <Line color={personColor(people.heartOf(plan.done_by))}>
            Ticked off {planDate(plan.done_at)}
            {doneBy && <> by <b style={{ color: M.text }}>{doneBy}</b></>}
          </Line>
        )}
      </div>
    </Sheet>
  )
}

/** A line about who did what, led by that person's dot. */
function Line({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, color: M.text2 }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  )
}
