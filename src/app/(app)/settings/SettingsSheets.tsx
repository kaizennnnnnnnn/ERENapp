'use client'

// ─── Settings sheets ─────────────────────────────────────────────────────────
// Every Settings action that needs more than one tap opens one of these Meadow
// sheets. Each owns its draft, its busy flag and its error; the write itself
// is a prop that resolves to an Outcome, so a failure keeps the sheet open
// with the reason on screen instead of closing as if it had worked. While a
// write is in flight the sheet can't be dismissed.

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  Avatar, DangerButton, ListGroup, ListRow, MeadowIcon, PrimaryButton, Sheet, TextButton, TextField,
  M, TYPE,
} from '@/components/meadow'
import CatBuilder from '@/components/cat/CatBuilder'
import { presetLook, type CatLook } from '@/lib/catIdentity'
import type { Outcome, SettingsPerson } from './SettingsView'

const NAME_MAX = 24

const BODY: CSSProperties = { margin: '0 4px 12px', ...TYPE.body, color: M.text }
const ERROR: CSSProperties = { margin: '0 0 12px', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.danger, textAlign: 'center' }

/** The busy / error pair every sheet here needs, reset each time it opens. */
function useWrite(open: boolean) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) { setBusy(false); setError(null) }
  }, [open])
  const run = async (write: () => Promise<Outcome>, onDone?: () => void) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const r = await write()
    setBusy(false)
    if (!r.ok) { setError(r.message); return }
    onDone?.()
  }
  return { busy, error, setError, run }
}

/** Primary action with the quieter way out under it. */
function Actions({ error, children, secondary }: { error: string | null; children: ReactNode; secondary?: ReactNode }) {
  return (
    <div>
      {error && <p role="alert" style={ERROR}>{error}</p>}
      {children}
      {secondary && <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>{secondary}</div>}
    </div>
  )
}

// ─── The cat's look ──────────────────────────────────────────────────────────

export function LookSheet({ open, onClose, catName, look, onSave }: {
  open: boolean
  onClose: () => void
  catName: string
  look: CatLook | null
  onSave: (look: CatLook) => Promise<Outcome>
}) {
  // null (never customised) is the classic art, which is the Eren Classic coat.
  const [draft, setDraft] = useState<CatLook>(() => look ?? presetLook('eren'))
  const { busy, error, run } = useWrite(open)
  // Each opening starts from the saved look; closing without saving drops the draft.
  useEffect(() => {
    if (open) setDraft(look ?? presetLook('eren'))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${catName}'s look`}
      dismissible={!busy}
      bodyStyle={{ paddingLeft: 0, paddingRight: 0 }}
      footer={
        <Actions error={error}>
          <PrimaryButton busy={busy} onClick={() => run(() => onSave(draft), onClose)}>
            {busy ? 'Saving...' : 'Save this look'}
          </PrimaryButton>
        </Actions>
      }
    >
      <CatBuilder value={draft} onChange={setDraft} compact catName={catName} />
    </Sheet>
  )
}

// ─── One date ────────────────────────────────────────────────────────────────

export function BirthdaySheet({ open, onClose, catName, value, onSave }: {
  open: boolean
  onClose: () => void
  catName: string
  value: string | null
  onSave: (date: string | null) => Promise<Outcome>
}) {
  const [draft, setDraft] = useState(value ?? '')
  const { busy, error, run } = useWrite(open)
  useEffect(() => {
    if (open) setDraft(value ?? '')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const changed = draft !== (value ?? '')
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!draft || !changed) return
    void run(() => onSave(draft), onClose)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${catName}'s birthday`}
      dismissible={!busy}
      footer={
        <Actions
          error={error}
          secondary={value ? (
            <TextButton tone="danger" disabled={busy} onClick={() => run(() => onSave(null), onClose)}>
              Remove birthday
            </TextButton>
          ) : undefined}
        >
          <PrimaryButton busy={busy} disabled={!draft || !changed} onClick={() => submit()}>
            {busy ? 'Saving...' : 'Save'}
          </PrimaryButton>
        </Actions>
      }
    >
      <form onSubmit={submit} style={{ padding: '4px 4px 8px' }}>
        <p style={BODY}>You both get a reminder on the day.</p>
        <TextField label="Birthday" type="date" value={draft} onChange={e => setDraft(e.target.value)} />
      </form>
    </Sheet>
  )
}

// ─── Your name ───────────────────────────────────────────────────────────────

export function NameSheet({ open, onClose, name, email, onSave }: {
  open: boolean
  onClose: () => void
  name: string
  email: string | null
  onSave: (name: string) => Promise<Outcome>
}) {
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)
  const { busy, error, setError, run } = useWrite(open)
  useEffect(() => {
    if (open) setDraft(name)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const clean = draft.replace(/\s+/g, ' ').trim()
    if (!clean) { setError("Your name can't be empty."); return }
    if (Array.from(clean).length > NAME_MAX) { setError(`Keep it to ${NAME_MAX} letters or fewer.`); return }
    if (clean === name) { onClose(); return }
    void run(() => onSave(clean), onClose)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your name"
      dismissible={!busy}
      initialFocus={inputRef}
      footer={
        <PrimaryButton busy={busy} onClick={() => submit()}>{busy ? 'Saving...' : 'Save'}</PrimaryButton>
      }
    >
      <form onSubmit={submit} style={{ padding: '4px 4px 8px' }}>
        <TextField
          ref={inputRef}
          label="Your name"
          value={draft}
          maxLength={NAME_MAX}
          autoComplete="given-name"
          enterKeyHint="done"
          error={error}
          hint={email ? `Signed in as ${email}` : undefined}
          onChange={e => { setDraft(e.target.value); if (error) setError(null) }}
        />
      </form>
    </Sheet>
  )
}

// ─── Special days ────────────────────────────────────────────────────────────

/** Whole days until the next time this month-and-day comes round (0 = today). */
function daysUntil(iso: string | null, today: Date): number | null {
  if (!iso || iso.length < 10) return null
  const month = Number(iso.slice(5, 7)) - 1
  const day = Number(iso.slice(8, 10))
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const next = new Date(start.getFullYear(), month, day)
  if (next < start) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next.getTime() - start.getTime()) / 86400000)
}

function Countdown({ icon, label, iso, today }: { icon: ReactNode; label: string; iso: string | null; today: Date }) {
  const d = daysUntil(iso, today)
  const text = d === null ? 'Not set' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`
  return (
    <div role="listitem" style={{
      minWidth: 0, borderRadius: 18, background: M.soft, padding: '12px 6px 12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center',
    }}>
      {icon}
      <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: M.text2 }}>
        {label}
      </span>
      <span style={{ fontSize: 15, ...TYPE.number, color: d === null ? M.faint : M.text }}>{text}</span>
    </div>
  )
}

export function SpecialDaysSheet({ open, onClose, catName, me, partner, catBirthday, anniversary, onSave }: {
  open: boolean
  onClose: () => void
  catName: string
  me: SettingsPerson
  /** null for a household of one: their tile drops out. */
  partner: SettingsPerson | null
  catBirthday: string | null
  anniversary: string | null
  onSave: (v: { birthday?: string | null; anniversary?: string | null }) => Promise<Outcome>
}) {
  const [birthday, setBirthday] = useState(me.birthday ?? '')
  const [together, setTogether] = useState(anniversary ?? '')
  // "Today" is a clock read; taken when the sheet opens, never during a server render.
  const [today, setToday] = useState<Date | null>(null)
  const { busy, error, run } = useWrite(open)
  useEffect(() => {
    if (!open) return
    setBirthday(me.birthday ?? '')
    setTogether(anniversary ?? '')
    setToday(new Date())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const changes: { birthday?: string | null; anniversary?: string | null } = {}
  if (birthday !== (me.birthday ?? '')) changes.birthday = birthday || null
  if (together !== (anniversary ?? '')) changes.anniversary = together || null
  const dirty = Object.keys(changes).length > 0

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!dirty) return
    void run(() => onSave(changes), onClose)
  }

  const partnerFirst = partner?.name.trim().split(/\s+/)[0] ?? null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Special days"
      dismissible={!busy}
      footer={
        <Actions error={error}>
          <PrimaryButton busy={busy} disabled={!dirty} onClick={() => submit()}>
            {busy ? 'Saving...' : 'Save'}
          </PrimaryButton>
        </Actions>
      }
    >
      {today && (
        <div role="list" aria-label="Coming up" style={{
          display: 'grid', gridTemplateColumns: `repeat(${partner ? 4 : 3}, 1fr)`, gap: 8, margin: '4px 0 20px',
        }}>
          <Countdown label="You" iso={birthday || null} today={today}
            icon={<Avatar name={me.name} color={me.color} size={32} fontSize={14} />} />
          {partner && (
            <Countdown label={partnerFirst ?? ''} iso={partner.birthday} today={today}
              icon={<Avatar name={partner.name} color={partner.color} size={32} fontSize={14} />} />
          )}
          <Countdown label={catName} iso={catBirthday} today={today}
            icon={<span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MeadowIcon name="paw" color={M.text2} /></span>} />
          <Countdown label="Us" iso={together || null} today={today}
            icon={<span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MeadowIcon name="hearts" color={M.love} /></span>} />
        </div>
      )}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px 8px' }}>
        <TextField label="Your birthday" type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
        <TextField label="Your anniversary" type="date" value={together} onChange={e => setTogether(e.target.value)} />
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
          {partnerFirst ? `${partnerFirst} sets their own birthday. ` : ''}
          {catName}&apos;s birthday is on the Your cat card.
        </p>
      </form>
    </Sheet>
  )
}

// ─── A new invite code ───────────────────────────────────────────────────────

export function InviteSheet({ open, onClose, code, onRotate }: {
  open: boolean
  onClose: () => void
  code: string | null
  onRotate: () => Promise<Outcome>
}) {
  const { busy, error, run } = useWrite(open)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Make a new invite code?"
      dismissible={!busy}
      footer={
        <Actions error={error} secondary={
          <TextButton tone="muted" disabled={busy} onClick={onClose}>Keep this code</TextButton>
        }>
          <PrimaryButton busy={busy} onClick={() => run(onRotate, onClose)}>
            {busy ? 'Making one...' : 'Make a new code'}
          </PrimaryButton>
        </Actions>
      }
    >
      <p style={BODY}>
        {code ? <>The code <b style={{ fontWeight: 800, letterSpacing: '0.06em' }}>{code}</b> stops working straight away, </> : 'The old code stops working straight away, '}
        and anyone still holding it can no longer join.
      </p>
      <p style={BODY}>If your person is typing it in right now, let them finish first.</p>
    </Sheet>
  )
}

// ─── Your partner: report, block ─────────────────────────────────────────────
// Separate on purpose: reporting is for us to act on and changes nothing for
// the reporter, while blocking ends the shared home at once. Someone
// frightened should be able to block without reporting, and someone who only
// wants it looked at shouldn't have to leave to say so.

export function PartnerSheet({ open, onClose, partner, catName, onReport, onBlock }: {
  open: boolean
  onClose: () => void
  partner: SettingsPerson & { id: string }
  catName: string
  onReport: () => void
  onBlock: () => Promise<Outcome>
}) {
  const [step, setStep] = useState<'menu' | 'block'>('menu')
  const { busy, error, run } = useWrite(open)
  useEffect(() => {
    if (open) setStep('menu')
  }, [open])
  const first = partner.name.trim().split(/\s+/)[0] || partner.name

  if (step === 'block') {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={`Block ${first}?`}
        dismissible={!busy}
        footer={
          <Actions error={error} secondary={
            <TextButton tone="muted" disabled={busy} onClick={() => setStep('menu')}>Cancel</TextButton>
          }>
            {/* Blocking navigates away on success, so the button stays busy until the page goes. */}
            <DangerButton size="lg" full busy={busy} onClick={() => run(onBlock)}>
              {busy ? 'Blocking...' : `Block ${first}`}
            </DangerButton>
          </Actions>
        }
      >
        <p style={BODY}>
          You leave this home right now, and {first} can never share a home with you again, not even with a new invite code.
        </p>
        <p style={BODY}>
          {catName} and everything you wrote together stay with them. Your account is untouched, and you can start a new home straight after.
        </p>
        {/* A report reads what you shared out of this home, so once you have
            left there is nothing left for it to point at. Say so before, not after. */}
        <div style={{ marginTop: 4, borderRadius: 18, background: M.soft, padding: '12px 14px' }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.text }}>
            Want us to look at what they did? Report first: you can&apos;t once you have left.
          </p>
          <TextButton disabled={busy} onClick={onReport} style={{ marginLeft: -8, paddingLeft: 8 }}>
            Report {first}
          </TextButton>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your partner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '4px 4px 20px' }}>
        <Avatar name={partner.name} color={partner.color} size={56} fontSize={22} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: M.text2 }}>{catName}&apos;s other human</div>
        </div>
      </div>
      <ListGroup style={{ border: `2px solid ${M.hairline}` }}>
        <ListRow icon="flag" label={`Report ${first}`} onClick={onReport} />
        <ListRow icon="lock" label={`Block ${first}`} destructive onClick={() => setStep('block')} />
      </ListGroup>
    </Sheet>
  )
}

// ─── Leave this home ─────────────────────────────────────────────────────────
// Leave and Delete say what happens to the home, and that turns on who else
// lives here. No partner is not the same as alone: while the partner read is
// in flight or failing, partner is null but isSolo is false, and telling a
// couple their home is about to be deleted would be false. In that case both
// outcomes are spelled out: the person reading knows which one is theirs.

export function LeaveSheet({ open, onClose, catName, partnerName, isSolo, onLeave }: {
  open: boolean
  onClose: () => void
  catName: string
  partnerName: string | null
  isSolo: boolean
  onLeave: () => Promise<Outcome>
}) {
  const { busy, error, run } = useWrite(open)
  const [what, after] = partnerName
    ? [
        `${catName} and everything you two wrote together stay with ${partnerName}. You keep your account, but you lose access to this home.`,
        'The invite code is replaced on your way out, so coming back needs a new one.',
      ]
    : isSolo
      ? [
          `You are the only one here, so this home, ${catName}, and every note, memory and photo in it are deleted with you. Your account stays.`,
          'You can start a new home or join one straight after.',
        ]
      : [
          `If someone else lives here, ${catName} and everything you wrote together stay with them. If it is only you, this home, ${catName}, and every note, memory and photo in it are deleted with you.`,
          'Either way your account stays, and you can start a new home or join one straight after.',
        ]
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Leave this home?"
      dismissible={!busy}
      footer={
        <Actions error={error} secondary={
          <TextButton tone="muted" disabled={busy} onClick={onClose}>Stay</TextButton>
        }>
          <DangerButton size="lg" full busy={busy} onClick={() => run(onLeave)}>
            {busy ? 'Leaving...' : 'Leave this home'}
          </DangerButton>
        </Actions>
      }
    >
      <p style={BODY}>{what}</p>
      <p style={BODY}>{after}</p>
    </Sheet>
  )
}

// ─── Delete account ──────────────────────────────────────────────────────────
// Two steps because deletion can't be undone, and the second step is where we
// say that shared notes stay with the partner without a name on them.

export function DeleteSheet({ open, onClose, home, catName, onDelete }: {
  open: boolean
  onClose: () => void
  /** Who shares the home, if there is one. `unknown`: see the Leave comment. */
  home: 'none' | 'couple' | 'solo' | 'unknown'
  catName: string
  onDelete: () => Promise<Outcome>
}) {
  const { busy, error, run } = useWrite(open)
  const shared = {
    none: null,
    couple: 'Notes and memories you added stay in your shared home so your partner keeps their history, but your name comes off them.',
    solo: `You are the only one here, so the home, ${catName}, and every photo you added are deleted too.`,
    unknown: `If someone else lives here, the notes and memories you added stay so they keep their history, but your name comes off them. If it is only you, the home, ${catName}, and every photo you added are deleted too.`,
  }[home]
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Delete your account?"
      dismissible={!busy}
      footer={
        <Actions error={error} secondary={
          <TextButton tone="muted" disabled={busy} onClick={onClose}>Keep it</TextButton>
        }>
          <DangerButton size="lg" full busy={busy} onClick={() => run(onDelete)}>
            {busy ? 'Deleting...' : 'Delete my account'}
          </DangerButton>
        </Actions>
      }
    >
      <p style={BODY}>
        This erases your login, your chats with {catName}, your items, scores and moods. It cannot be undone.
      </p>
      {shared && <p style={BODY}>{shared}</p>}
    </Sheet>
  )
}
