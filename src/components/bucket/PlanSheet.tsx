'use client'

// ─── PlanSheet ───────────────────────────────────────────────────────────────
// Add a plan to the bucket list, or edit one: what it is, what kind, and
// optionally by when and a note. The kind picks where it sits on the list.

import { useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import {
  KINDS, NOTE_MAX, TARGET_MAX, TITLE_MAX, cleanPlan, type PlanInput, type PlanKind, type PlanRow,
} from '@/lib/bucketList'
import { Chip, M, MeadowIcon, PrimaryButton, Sheet, TextField, TYPE } from '@/components/meadow'

const EMPTY: PlanInput = { title: '', kind: 'travel', target: null, note: null }

export default function PlanSheet({ open, editing, onClose, onSave }: {
  open: boolean
  /** The plan being edited; null adds a new one. */
  editing: PlanRow | null
  onClose: () => void
  /** Resolves false when the write failed (the sheet stays open to retry). */
  onSave: (input: PlanInput) => Promise<boolean>
}) {
  const [form, setForm] = useState<PlanInput>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // Each opening starts from the plan being edited, or blank.
  useEffect(() => {
    if (!open) return
    setForm(editing
      ? { title: editing.title, kind: editing.kind, target: editing.target, note: editing.note }
      : EMPTY)
    setError(null)
    setBusy(false)
  }, [open, editing])

  const ready = !!cleanPlan(form)

  async function save() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    const ok = await onSave(form)
    setBusy(false)
    if (!ok) setError("Couldn't save it. Check the connection and try again.")
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit plan' : 'Add a plan'}
      initialFocus={titleRef}
      footer={
        <PrimaryButton busy={busy} disabled={!ready} onClick={() => { void save() }}
          icon={editing ? undefined : <MeadowIcon name="plus" size={18} mono color="#FFFFFF" />}>
          {editing ? 'Save' : 'Add to the list'}
        </PrimaryButton>
      }
    >
      <form onSubmit={e => { e.preventDefault(); void save() }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <TextField
          ref={titleRef}
          id="plan-title"
          label="What do you want to do?"
          placeholder="See the northern lights"
          value={form.title}
          maxLength={TITLE_MAX}
          enterKeyHint="done"
          autoComplete="off"
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          error={error}
        />

        <div role="group" aria-label="Kind" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ ...TYPE.label, color: M.label }}>Kind</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {KINDS.map(k => (
              <Chip
                key={k.id}
                selected={form.kind === k.id}
                onClick={() => { playSound('ui_select'); setForm(f => ({ ...f, kind: k.id as PlanKind })) }}
                icon={<MeadowIcon name={k.icon} size={18} />}
              >
                {k.label}
              </Chip>
            ))}
          </div>
        </div>

        <TextField
          id="plan-target"
          size="md"
          label="By when"
          placeholder="Summer 2027"
          hint="Optional"
          value={form.target ?? ''}
          maxLength={TARGET_MAX}
          autoComplete="off"
          onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
          inputStyle={{ fontSize: 17, fontWeight: 700 }}
        />
        <TextField
          id="plan-note"
          size="md"
          label="Note"
          placeholder="Where, who with, anything"
          hint="Optional"
          value={form.note ?? ''}
          maxLength={NOTE_MAX}
          autoComplete="off"
          onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          inputStyle={{ fontSize: 17, fontWeight: 600 }}
        />
        {/* Enter in a field submits, like the button. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  )
}
