'use client'

// ─── BucketListView ──────────────────────────────────────────────────────────
// The bucket list page, from plain props (the /bucket-list route wires the
// data): how much of it you've done and the "Add a plan" button, then the open
// plans grouped by kind, then the done ones. Each row has a tick circle on the
// left and the adder's dot on the right; tapping the row opens the plan.

import { useMemo, useState } from 'react'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { KINDS, kindMeta, planDate, type PlanInput, type PlanRow } from '@/lib/bucketList'
import {
  Card, IconTile, M, MeadowIcon, MeadowPage, Meter, PrimaryButton, SectionLabel, TINT, personColor,
} from '@/components/meadow'
import PlanSheet from './PlanSheet'
import PlanDetailSheet, { type PlanPeople } from './PlanDetailSheet'
import TickCelebration from './TickCelebration'

export interface BucketListViewProps {
  plans: PlanRow[]
  loading: boolean
  /** The table isn't there yet. */
  missing: boolean
  isSolo: boolean
  people: PlanPeople
  onBack: () => void
  onAdd: (input: PlanInput) => Promise<boolean>
  onEdit: (id: string, input: PlanInput) => Promise<boolean>
  onSetDone: (id: string, done: boolean) => Promise<boolean>
  onRemove: (id: string) => Promise<boolean>
}

export default function BucketListView({
  plans, loading, missing, isSolo, people, onBack, onAdd, onEdit, onSetDone, onRemove,
}: BucketListViewProps) {
  const cat = useCat()
  const [sheet, setSheet] = useState<{ open: boolean; editing: PlanRow | null }>({ open: false, editing: null })
  // `openId` is what's open; `shownId` outlives it so the sheet closes with its plan in it.
  const [openId, setOpenId] = useState<string | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cheer, setCheer] = useState<string | null>(null)

  const { groups, done } = useMemo(() => {
    const open = plans.filter(p => !p.done_at)
    const groups = KINDS
      .map(k => ({ kind: k, plans: open.filter(p => p.kind === k.id) }))
      .filter(g => g.plans.length > 0)
    const done = plans.filter(p => p.done_at)
      .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))
    return { groups, done }
  }, [plans])

  const total = plans.length
  const shown = shownId ? plans.find(p => p.id === shownId) ?? null : null

  function openPlan(id: string) {
    playSound('ui_modal_open')
    setOpenId(id)
    setShownId(id)
  }

  async function toggle(plan: PlanRow) {
    if (busyId) return
    const nowDone = !plan.done_at
    setBusyId(plan.id)
    playSound(nowDone ? 'quest_complete' : 'ui_tap')
    const ok = await onSetDone(plan.id, nowDone)
    setBusyId(null)
    if (ok && nowDone) { setOpenId(null); setCheer(plan.title) }
  }

  async function remove(plan: PlanRow) {
    setBusyId(plan.id)
    const ok = await onRemove(plan.id)
    setBusyId(null)
    if (ok) { playSound('chat_poof'); setOpenId(null) }
  }

  function startAdd() {
    playSound('ui_modal_open')
    setSheet({ open: true, editing: null })
  }

  const title = isSolo ? 'My bucket list' : 'Our bucket list'
  const blurb = isSolo
    ? cat.t('Everything you want to do one day. {name} would like to come along.')
    : cat.t('Everything you two want to do one day. {name} would like to come along.')

  return (
    <MeadowPage ground={TINT.sky} title={title} back={{ onClick: onBack, label: 'Back to home' }} withNav={false}>
      {/* ── How much of it you've done ── */}
      <Card padding="16px 18px" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <IconTile icon="checklist" size={52} bg={TINT.amber} iconSize={30} />
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {loading ? 'Reading the list…' : missing ? 'Almost ready' : total === 0 ? 'Nothing on it yet' : `${done.length} of ${total} done`}
            </div>
            <Meter value={loading || !total ? 0 : done.length / total} label="Plans done" />
          </div>
        </div>
        <p style={{ margin: '12px 0 14px', fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
          {missing ? 'The bucket list opens once the latest update is in. Check back soon.' : blurb}
        </p>
        <PrimaryButton onClick={startAdd} disabled={missing || loading}
          icon={<MeadowIcon name="plus" size={18} mono color="#FFFFFF" />}>
          Add a plan
        </PrimaryButton>
      </Card>

      {!loading && !missing && total === 0 && (
        <Card padding="20px 18px" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/erenGood.png" alt="" draggable={false}
              style={{ width: 64, height: 64, objectFit: 'contain', imageRendering: 'auto', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, fontWeight: 600, color: M.text }}>
              {isSolo
                ? 'Start with one thing you’ve always wanted to do. A trip, a dish, a someday.'
                : 'Start with one thing you’ve always wanted to do together. A trip, a dish, a someday.'}
            </p>
          </div>
        </Card>
      )}

      {groups.map(g => (
        <section key={g.kind.id} aria-label={g.kind.label}>
          <SectionLabel trailing={String(g.plans.length)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <MeadowIcon name={g.kind.icon} size={18} />
              {g.kind.label}
            </span>
          </SectionLabel>
          <Card padding="4px 0">
            {g.plans.map((p, i) => (
              <PlanLine key={p.id} plan={p} first={i === 0} people={people} busy={busyId === p.id}
                onTick={() => { void toggle(p) }} onOpen={() => openPlan(p.id)} />
            ))}
          </Card>
        </section>
      ))}

      {done.length > 0 && (
        <section aria-label="Done">
          <SectionLabel trailing={String(done.length)}>Done</SectionLabel>
          <Card padding="4px 0">
            {done.map((p, i) => (
              <PlanLine key={p.id} plan={p} first={i === 0} people={people} busy={busyId === p.id}
                onTick={() => openPlan(p.id)} onOpen={() => openPlan(p.id)} />
            ))}
          </Card>
        </section>
      )}

      <div style={{ height: 32 }} />

      <PlanSheet
        open={sheet.open}
        editing={sheet.editing}
        onClose={() => { playSound('ui_modal_close'); setSheet(s => ({ ...s, open: false })) }}
        onSave={async input => {
          const ok = sheet.editing ? await onEdit(sheet.editing.id, input) : await onAdd(input)
          if (ok) { playSound(sheet.editing ? 'ui_select' : 'chat_send'); setSheet(s => ({ ...s, open: false })) }
          return ok
        }}
      />

      <PlanDetailSheet
        open={openId !== null && !!shown}
        plan={shown}
        people={people}
        busy={!!shown && busyId === shown.id}
        onClose={() => { playSound('ui_modal_close'); setOpenId(null) }}
        onToggleDone={() => { if (shown) void toggle(shown) }}
        onEdit={() => {
          if (!shown) return
          setOpenId(null)
          setSheet({ open: true, editing: shown })
        }}
        onRemove={() => { if (shown) void remove(shown) }}
      />

      <TickCelebration title={cheer} onClose={() => { playSound('ui_tap'); setCheer(null) }} />
    </MeadowPage>
  )
}

/** One plan on the list. */
function PlanLine({ plan, first, people, busy, onTick, onOpen }: {
  plan: PlanRow
  first: boolean
  people: PlanPeople
  busy: boolean
  onTick: () => void
  onOpen: () => void
}) {
  const done = !!plan.done_at
  const adder = people.nameOf(plan.created_by)
  const doneBy = people.nameOf(plan.done_by)
  const sub = done && plan.done_at
    ? `${planDate(plan.done_at)}${doneBy ? ` · ${doneBy}` : ''}`
    : plan.target ?? plan.note ?? null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '0 14px 0 8px',
      borderTop: first ? 'none' : `1px solid ${M.divider}`,
    }}>
      <button
        type="button"
        onClick={onTick}
        disabled={busy}
        aria-label={done ? `${plan.title}, done` : `Tick off ${plan.title}`}
        className="m-press m-focus"
        style={{
          width: 44, height: 56, flexShrink: 0, border: 0, background: 'transparent', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: busy ? 0.5 : 1,
        }}
      >
        {done ? (
          <span style={{
            width: 28, height: 28, borderRadius: 999, background: M.leaf,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MeadowIcon name="check" size={14} mono color="#FFFFFF" />
          </span>
        ) : (
          <span style={{
            width: 28, height: 28, boxSizing: 'border-box', borderRadius: 999,
            border: `2.5px solid ${M.softLip}`, background: '#FFFFFF',
          }} />
        )}
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="m-press m-focus"
        style={{
          flex: '1 1 auto', minWidth: 0, minHeight: 60, border: 0, background: 'transparent', cursor: 'pointer',
          padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
          fontFamily: 'inherit', color: M.text,
        }}
      >
        <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{
            fontSize: 16, lineHeight: 1.3, fontWeight: 700, color: done ? M.text2 : M.text,
            overflowWrap: 'anywhere',
          }}>{plan.title}</span>
          {sub && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: M.text2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {done
                ? <MeadowIcon name={kindMeta(plan.kind).icon} size={14} />
                : plan.target ? <MeadowIcon name="calendar" size={14} /> : null}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
            </span>
          )}
        </span>
        {/* Who put it on the list, in their colour. */}
        <span role="img" aria-label={adder ? `Added by ${adder}` : 'Added'} style={{
          width: 10, height: 10, borderRadius: 999, flexShrink: 0,
          background: personColor(people.heartOf(plan.created_by)),
        }} />
      </button>
    </div>
  )
}
