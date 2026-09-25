'use client'

// ─── Settings (presentational) ───────────────────────────────────────────────
// The Meadow A4 board, fed plain props. page.tsx owns every read and write and
// hands them in as `actions` that resolve to an Outcome; this file owns only
// UI state (which sheet is open, what is in flight, what failed), so the
// preview route can render it with the board's example data.
//
// Order, top to bottom: your cat (the board's card), household (you, the
// invite code, your partner, special days), notifications, appearance,
// account, legal, the version line. Everything the old Profile page could
// change lives somewhere in here: the rows the board did not draw (your own
// name, mood alerts, a fresh invite code, report / block) sit in the groups
// they belong to, drawn the same way.

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Avatar, Card, IconTile, ListGroup, ListRow, MeadowIcon, MeadowPage, PrimaryButton, RoundButton,
  SectionLabel, Segmented, Stage, TextButton, TextField,
  FONT_ROUNDED, M, TYPE, type MeadowIconName,
} from '@/components/meadow'
import CatPortrait from '@/components/cat/CatPortrait'
import ReportSheet from '@/components/safety/ReportSheet'
import { CAT_NAME_MAX, SEX_LABELS, ownCoatLabel, type CatLook, type CatSex } from '@/lib/catIdentity'
import { THEMES, type ThemeKey } from '@/contexts/ThemeContext'
import {
  BirthdaySheet, DeleteSheet, InviteSheet, LeaveSheet, LookSheet, NameSheet, PartnerSheet, SpecialDaysSheet,
} from './SettingsSheets'

export type Outcome = { ok: true } | { ok: false; message: string }

export type PrefKey = 'moodAlerts' | 'wishPush' | 'memoryPush' | 'quietEren'
export type Prefs = Record<PrefKey, boolean>

/**
 * This phone's push state. `unsupported` = no Notification / push API (iOS
 * Safari before "Add to Home Screen"); `blocked` = the person said no, and
 * only the phone's own settings can undo that.
 */
export type NotifState = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on'

export interface SettingsPerson {
  name: string
  color: string
  /** yyyy-mm-dd, or null when not set. */
  birthday: string | null
}

export interface SettingsActions {
  renameCat: (name: string) => Promise<Outcome>
  setCatSex: (sex: CatSex) => Promise<Outcome>
  saveCatLook: (look: CatLook) => Promise<Outcome>
  saveCatBirthday: (date: string | null) => Promise<Outcome>
  saveMyName: (name: string) => Promise<Outcome>
  saveSpecialDays: (v: { birthday?: string | null; anniversary?: string | null }) => Promise<Outcome>
  rotateInviteCode: () => Promise<Outcome>
  setPref: (key: PrefKey, next: boolean) => Promise<Outcome>
  enableNotifications: () => Promise<Outcome>
  setTheme: (t: ThemeKey) => void
  signOut: () => Promise<void>
  blockPartner: () => Promise<Outcome>
  leaveHome: () => Promise<Outcome>
  deleteAccount: () => Promise<Outcome>
}

/**
 * The household's cat. `loading` / `failed` until its row has been read: the
 * default cat must not stand in for it, or its look editor would open on
 * Eren Classic and a save would overwrite the real look.
 */
export type SettingsCat =
  | { status: 'ready'; name: string; sex: CatSex; look: CatLook | null }
  | { status: 'loading' | 'failed' }

export interface SettingsViewProps {
  /** null when the account has no home yet: the cat card and household rows drop out. */
  cat: SettingsCat | null
  onRetryCat: () => void
  me: SettingsPerson & { email: string | null }
  /** The partner's profile row id (report / block target) and how to show them. */
  partner: (SettingsPerson & { id: string }) | null
  isSolo: boolean
  /** The households row. null while loading (or when the read failed: see householdFailed). */
  household: { inviteCode: string | null; catBirthday: string | null; anniversary: string | null } | null
  householdFailed: boolean
  onRetryHousehold: () => void
  /** null until the profile has loaded. */
  prefs: Prefs | null
  notif: NotifState
  theme: ThemeKey
  actions: SettingsActions
}

type SheetName = 'look' | 'birthday' | 'name' | 'days' | 'invite' | 'partner' | 'leave' | 'delete' | null

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

/** "K7M2QX9P" reads as "K7M2 QX9P", the way the board sets it. Copying uses the raw code. */
const spacedCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code)

export function formatDay(iso: string | null): string | null {
  if (!iso) return null
  try { return format(parseISO(iso), 'd MMM yyyy') } catch { return null }
}

const ERROR_LINE: CSSProperties = { margin: '8px 8px 0', fontSize: 13, lineHeight: 1.4, fontWeight: 700, color: M.danger }
const NOTE_LINE: CSSProperties = { margin: '8px 8px 0', fontSize: 13, lineHeight: 1.4, fontWeight: 700, color: M.text2 }

/** About the loaded cat card's height, held while its row loads so the page doesn't jump. */
const CAT_CARD_HEIGHT = 300

// ─── The page ────────────────────────────────────────────────────────────────

export default function SettingsView(props: SettingsViewProps) {
  const { cat, onRetryCat, me, partner, isSolo, household, householdFailed, onRetryHousehold, prefs, notif, theme, actions } = props
  const [sheet, setSheet] = useState<SheetName>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const close = () => setSheet(null)

  // Invite code: copy feedback, and the note after a fresh code.
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [freshCode, setFreshCode] = useState(false)
  useEffect(() => {
    if (copied === 'idle') return
    const t = setTimeout(() => setCopied('idle'), 2400)
    return () => clearTimeout(t)
  }, [copied])

  const copyCode = async () => {
    const code = household?.inviteCode
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied('copied')
    } catch {
      setCopied('failed')
    }
  }

  // Notification switches: each switch holds its own write (different
  // columns, so two can run at once), and they share one error line.
  const [busyKeys, setBusyKeys] = useState<BusyKeys>({})
  const markBusy = (key: PrefKey | 'notif', on: boolean) => setBusyKeys(b => {
    const next = { ...b }
    if (on) next[key] = true
    else delete next[key]
    return next
  })
  const [notifError, setNotifError] = useState<string | null>(null)
  const [notifNote, setNotifNote] = useState<string | null>(null)

  const flipPref = async (key: PrefKey, next: boolean) => {
    if (busyKeys[key]) return
    markBusy(key, true)
    setNotifError(null)
    const r = await actions.setPref(key, next)
    markBusy(key, false)
    if (!r.ok) setNotifError(r.message)
  }

  const flipNotifications = async (next: boolean) => {
    if (busyKeys.notif) return
    setNotifError(null)
    // A site can't take a permission back; the phone owns that switch. Say so
    // instead of pretending, and point at the switches that do work.
    if (!next) {
      setNotifNote("To stop them, turn notifications off for Eren in your phone's settings. The switches below pick which ones you get.")
      return
    }
    setNotifNote(null)
    markBusy('notif', true)
    const r = await actions.enableNotifications()
    markBusy('notif', false)
    if (!r.ok) setNotifError(r.message)
  }

  const partnerFirst = partner ? firstName(partner.name) : null
  const knownCat = cat?.status === 'ready' ? cat : null
  // Only ever a label: with no home, or the cat's row still unread, the app's
  // own name stands in, as it does everywhere else.
  const catName = knownCat?.name ?? 'Eren'

  const notifSub =
    notif === 'unsupported' ? 'Add Eren to your Home Screen first, then turn this on.'
      : notif === 'blocked' ? "Blocked. Allow notifications for Eren in your phone's settings."
        : undefined

  return (
    <MeadowPage ground="settings" title="Settings" back={{ href: '/profile', label: 'Back to Me' }} withNav={false}>
      {householdFailed && (
        <Card style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }} padding="12px 12px 12px 18px">
          <span role="alert" style={{ flex: '1 1 auto', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.text }}>
            Some of your settings could not load.
          </span>
          <TextButton onClick={onRetryHousehold}>Try again</TextButton>
        </Card>
      )}

      {cat && (
        <>
          <SectionLabel>Your cat</SectionLabel>
          {knownCat ? (
            <CatCard
              cat={knownCat}
              birthday={household ? household.catBirthday : undefined}
              onRename={actions.renameCat}
              onSex={actions.setCatSex}
              onBirthday={() => setSheet('birthday')}
              onLook={() => setSheet('look')}
            />
          ) : cat.status === 'failed' ? (
            <Card style={{ display: 'flex', alignItems: 'center', gap: 12 }} padding="12px 12px 12px 18px">
              <span role="alert" style={{ flex: '1 1 auto', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.text }}>
                Your cat could not load.
              </span>
              <TextButton onClick={onRetryCat}>Try again</TextButton>
            </Card>
          ) : (
            <Card padding={16} style={{ minHeight: CAT_CARD_HEIGHT }}><span /></Card>
          )}
        </>
      )}

      {/* ── Household ── */}
      <SectionLabel>{cat ? 'Household' : 'You'}</SectionLabel>
      <ListGroup>
        <ListRow
          icon={<Avatar name={me.name} color={me.color} size={36} fontSize={15} />}
          label={me.name}
          value="You"
          onClick={() => setSheet('name')}
          ariaLabel={`Your name, ${me.name}. Change it`}
        />
        {cat && (
          <ListRow
            icon="key"
            label="Invite code"
            sublabel={isSolo ? 'Share it so your person can join' : undefined}
            trailing={household?.inviteCode ? (
              <>
                <span style={{ flexShrink: 0, fontSize: 15, letterSpacing: '0.08em', ...TYPE.number, color: M.text, userSelect: 'all' }}>
                  {spacedCode(household.inviteCode)}
                </span>
                <RoundButton
                  ariaLabel={copied === 'copied' ? 'Invite code copied' : 'Copy invite code'}
                  surface="white"
                  onClick={copyCode}
                  style={{ background: 'transparent' }}
                >
                  <MeadowIcon name={copied === 'copied' ? 'check' : 'copy'} color={M.leaf} />
                </RoundButton>
              </>
            ) : (
              <span style={{ flexShrink: 0, paddingRight: 12, fontSize: 15, fontWeight: 500, color: M.text2 }}>
                {householdFailed ? 'Could not load' : '–'}
              </span>
            )}
          />
        )}
        {cat && household?.inviteCode && (
          <ListRow icon="replay" label="New invite code" onClick={() => { setFreshCode(false); setSheet('invite') }} />
        )}
        {partner && (
          <ListRow
            icon={<Avatar name={partner.name} color={partner.color} size={36} fontSize={15} />}
            label={partner.name}
            value="Partner"
            onClick={() => setSheet('partner')}
          />
        )}
        {cat && (
          <ListRow icon="calendar" label="Special days" disabled={!household} onClick={() => setSheet('days')} />
        )}
      </ListGroup>
      <div aria-live="polite">
        {copied === 'copied' && <p style={{ ...NOTE_LINE, color: M.leafInk }}>Copied. Send it to your person.</p>}
        {copied === 'failed' && <p style={ERROR_LINE}>Could not copy. Press and hold the code to copy it.</p>}
        {freshCode && copied === 'idle' && <p style={{ ...NOTE_LINE, color: M.leafInk }}>New code ready. The old one no longer works.</p>}
      </div>

      {/* ── Notifications ── */}
      <SectionLabel>Notifications</SectionLabel>
      <ListGroup>
        <ListRow
          icon="bell"
          label="Enable notifications"
          sublabel={notifSub}
          toggle={{
            checked: notif === 'on',
            onChange: flipNotifications,
            busy: !!busyKeys.notif || notif === 'checking',
            disabled: notif === 'unsupported' || notif === 'blocked',
          }}
        />
        {!isSolo && (
          <ListRow
            icon="star"
            label={`When ${partnerFirst ?? 'your partner'} grants a wish`}
            toggle={prefToggle(prefs, 'wishPush', busyKeys, flipPref)}
          />
        )}
        {partner && (
          <ListRow
            icon="cloudRain"
            label={`When ${partnerFirst} has a tough day`}
            toggle={prefToggle(prefs, 'moodAlerts', busyKeys, flipPref)}
          />
        )}
        <ListRow icon="photo" label="New memories" toggle={prefToggle(prefs, 'memoryPush', busyKeys, flipPref)} />
        <ListRow
          icon="moon"
          label={`Quieter ${catName}`}
          sublabel="Half the chatter, no memory pushes"
          toggle={prefToggle(prefs, 'quietEren', busyKeys, flipPref)}
        />
      </ListGroup>
      <div aria-live="polite">
        {notifError && <p role="alert" style={ERROR_LINE}>{notifError}</p>}
        {!notifError && notifNote && <p style={NOTE_LINE}>{notifNote}</p>}
      </div>

      {/* ── Appearance ── */}
      <SectionLabel>Appearance</SectionLabel>
      <Card padding="0 12px 0 16px" style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span id="accent-label" style={{ flex: '1 1 auto', fontSize: 16, fontWeight: 700 }}>Accent</span>
        <AccentPicker theme={theme} onPick={actions.setTheme} />
      </Card>

      {/* ── Account ── */}
      <SectionLabel>Account</SectionLabel>
      <ListGroup>
        <ListRow icon="door" label="Sign out" sublabel={me.email ?? undefined} chevron={false} onClick={() => { void actions.signOut() }} />
        {cat && <ListRow icon="home" label="Leave this home" onClick={() => setSheet('leave')} />}
        <ListRow icon="trash" label="Delete account" destructive onClick={() => setSheet('delete')} />
      </ListGroup>

      {/* ── Legal ──
          Plain <a>, not next/link: /privacy and /terms sit outside the (app)
          group and render without the app shell. Play wants them reachable
          from inside the app, not only from sign-up and the terms gate. */}
      <SectionLabel>Legal</SectionLabel>
      <ListGroup>
        <AnchorRow icon="lock" label="Privacy" href="/privacy" />
        <AnchorRow icon="doc" label="Terms" href="/terms" />
      </ListGroup>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: M.label }}>
        <MeadowIcon name="paw" size={16} color={M.faint} />
        Eren 1.0
      </div>

      {/* ── Sheets ── */}
      {knownCat && (
        <>
          <LookSheet
            open={sheet === 'look'}
            onClose={close}
            catName={knownCat.name}
            look={knownCat.look}
            onSave={actions.saveCatLook}
          />
          <BirthdaySheet
            open={sheet === 'birthday'}
            onClose={close}
            catName={knownCat.name}
            value={household?.catBirthday ?? null}
            onSave={actions.saveCatBirthday}
          />
        </>
      )}
      {cat && (
        <>
          <SpecialDaysSheet
            open={sheet === 'days'}
            onClose={close}
            catName={catName}
            me={me}
            partner={isSolo ? null : partner}
            catBirthday={household?.catBirthday ?? null}
            anniversary={household?.anniversary ?? null}
            onSave={actions.saveSpecialDays}
          />
          <InviteSheet
            open={sheet === 'invite'}
            onClose={close}
            code={household?.inviteCode ?? null}
            onRotate={async () => {
              const r = await actions.rotateInviteCode()
              if (r.ok) { setCopied('idle'); setFreshCode(true) }
              return r
            }}
          />
          <LeaveSheet
            open={sheet === 'leave'}
            onClose={close}
            catName={catName}
            partnerName={partnerFirst}
            isSolo={isSolo}
            onLeave={actions.leaveHome}
          />
        </>
      )}
      <NameSheet open={sheet === 'name'} onClose={close} name={me.name} email={me.email} onSave={actions.saveMyName} />
      {partner && (
        <PartnerSheet
          open={sheet === 'partner'}
          onClose={close}
          partner={partner}
          catName={catName}
          onReport={() => { setSheet(null); setReportOpen(true) }}
          onBlock={actions.blockPartner}
        />
      )}
      <DeleteSheet
        open={sheet === 'delete'}
        onClose={close}
        home={!cat ? 'none' : partner ? 'couple' : isSolo ? 'solo' : 'unknown'}
        catName={catName}
        onDelete={actions.deleteAccount}
      />

      {reportOpen && partner && (
        <ReportSheet target="profile" targetId={partner.id} what={firstName(partner.name)} onClose={() => setReportOpen(false)} />
      )}
    </MeadowPage>
  )
}

type BusyKeys = Partial<Record<PrefKey | 'notif', true>>

function prefToggle(
  prefs: Prefs | null,
  key: PrefKey,
  busy: BusyKeys,
  flip: (key: PrefKey, next: boolean) => void,
) {
  return {
    checked: prefs ? prefs[key] : false,
    onChange: (next: boolean) => { void flip(key, next) },
    busy: !!busy[key],
    disabled: !prefs,
  }
}

/**
 * The accent swatches. The board rings the chosen one in its OWN colour (the
 * kit Swatch rings in leaf, which reads wrong around pink). A real radio
 * group: one tab stop, arrow keys move the choice.
 */
function AccentPicker({ theme, onPick }: { theme: ThemeKey; onPick: (t: ThemeKey) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + THEMES.length) % THEMES.length
    onPick(THEMES[next].key)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-labelledby="accent-label" style={{ display: 'flex', gap: 8 }}>
      {THEMES.map((t, i) => {
        const on = theme === t.key
        return (
          <button
            key={t.key}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t.label}
            tabIndex={on ? 0 : -1}
            onClick={() => { if (!on) onPick(t.key) }}
            onKeyDown={e => onKey(e, i)}
            className="m-focus"
            style={{
              width: 34, height: 34, flexShrink: 0, padding: 0, border: 0, borderRadius: 999, background: t.swatch,
              boxShadow: on ? `0 0 0 3px #FFFFFF, 0 0 0 5px ${t.swatch}` : 'none', cursor: 'pointer',
            }}
          />
        )
      })}
    </div>
  )
}

/** A list row that is a plain <a> (see the Legal comment). ListGroup reads `icon` for its divider inset. */
function AnchorRow({ icon, label, href }: { icon: MeadowIconName; label: string; href: string }) {
  return (
    <a href={href} className="m-focus" style={{
      minHeight: 52, boxSizing: 'border-box', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: FONT_ROUNDED, fontSize: 16, fontWeight: 700, color: M.text, textDecoration: 'none',
    }}>
      <IconTile icon={icon} color={M.text2} />
      <span style={{ flex: '1 1 auto' }}>{label}</span>
      <MeadowIcon name="chevronRight" size={20} color={M.faint} />
    </a>
  )
}

// ─── Your cat ────────────────────────────────────────────────────────────────

const SEX_OPTIONS = [
  { value: 'male' as const, label: SEX_LABELS.male },
  { value: 'female' as const, label: SEX_LABELS.female },
]

function CatCard({ cat, birthday, onRename, onSex, onBirthday, onLook }: {
  cat: { name: string; sex: CatSex; look: CatLook | null }
  /** undefined while the household row loads. */
  birthday: string | null | undefined
  onRename: (name: string) => Promise<Outcome>
  onSex: (sex: CatSex) => Promise<Outcome>
  onBirthday: () => void
  onLook: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cat.name)
  const [busy, setBusy] = useState<'name' | 'sex' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const renameRef = useRef<HTMLButtonElement>(null)
  const errorId = 'cat-card-error'

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const startRename = () => {
    setDraft(cat.name)
    setError(null)
    setEditing(true)
  }
  const cancelRename = () => {
    setEditing(false)
    setError(null)
    requestAnimationFrame(() => renameRef.current?.focus())
  }
  const saveName = async () => {
    if (busy) return
    if (draft.trim() === cat.name) { cancelRename(); return }
    setBusy('name')
    setError(null)
    const r = await onRename(draft)
    setBusy(null)
    if (!r.ok) { setError(r.message); inputRef.current?.focus(); return }
    setEditing(false)
    requestAnimationFrame(() => renameRef.current?.focus())
  }
  const pickSex = async (sex: CatSex) => {
    if (busy) return
    setBusy('sex')
    setError(null)
    const r = await onSex(sex)
    setBusy(null)
    if (!r.ok) setError(r.message)
  }

  const coat = ownCoatLabel(cat.look, cat.name)
  const day = formatDay(birthday ?? null)
  const linkButton: CSSProperties = {
    flex: '0 0 auto', height: 44, margin: '-13px -8px -13px 0', padding: '0 8px', border: 0,
    background: 'transparent', display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT_ROUNDED,
    fontSize: 14, fontWeight: 800, color: M.leaf, cursor: 'pointer',
  }

  return (
    <Card padding={16}>
      <div style={{ display: 'flex', gap: 16 }}>
        <Stage width={128} height={140} variant="portrait">
          <CatPortrait look={cat.look} width={92} height={124} alt={`${cat.name}, ${coat}`}
            style={{ position: 'absolute', left: 25, top: 4 }} />
        </Stage>
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label htmlFor="cat-name" style={{ ...TYPE.label, color: M.label }}>Name</label>
            {editing ? (
              <button type="button" onClick={saveName} disabled={busy === 'name'} className="m-press m-focus"
                style={{ ...linkButton, opacity: busy === 'name' ? 0.6 : 1 }}>
                <MeadowIcon name="check" size={16} color={M.leaf} />
                {busy === 'name' ? 'Saving' : 'Done'}
              </button>
            ) : (
              <button ref={renameRef} type="button" onClick={startRename} aria-label={`Rename ${cat.name}`}
                className="m-press m-focus" style={linkButton}>
                <MeadowIcon name="pencil" size={16} color={M.leaf} />
                Rename
              </button>
            )}
          </div>
          {editing ? (
            <TextField
              ref={inputRef}
              id="cat-name"
              size="md"
              value={draft}
              maxLength={CAT_NAME_MAX}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); void saveName() }
                if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
              }}
              style={{ marginTop: 4 }}
            />
          ) : (
            <span style={{ marginTop: 2, ...TYPE.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cat.name}
            </span>
          )}
          <span style={{ marginTop: 2, fontSize: 14, fontWeight: 700, color: M.text2 }}>{coat}</span>
          <Segmented
            ariaLabel={`Is ${cat.name} a boy or a girl?`}
            options={SEX_OPTIONS}
            value={cat.sex}
            onChange={pickSex}
            style={{ marginTop: 'auto' }}
          />
        </div>
      </div>
      {error && <p id={errorId} role="alert" style={{ ...ERROR_LINE, margin: '12px 2px 0' }}>{error}</p>}

      <div aria-hidden style={{ height: 1, marginTop: 14, background: M.divider }} />
      <button
        type="button"
        onClick={onBirthday}
        disabled={birthday === undefined}
        aria-label={day ? `${cat.name}'s birthday, ${day}. Change it` : `Add ${cat.name}'s birthday`}
        className="m-focus"
        style={{
          width: '100%', height: 52, boxSizing: 'border-box', padding: '0 2px', border: 0, background: 'transparent',
          display: 'flex', alignItems: 'center', gap: 12, fontFamily: FONT_ROUNDED, fontSize: 16, fontWeight: 700,
          color: M.text, textAlign: 'left', cursor: birthday === undefined ? 'default' : 'pointer',
        }}
      >
        <span style={{ flex: '1 1 auto' }}>Birthday</span>
        {birthday === undefined ? (
          <span style={{ fontSize: 15, fontWeight: 500, color: M.faint }}>–</span>
        ) : day ? (
          <>
            <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>{day}</span>
            <MeadowIcon name="chevronRight" size={20} color={M.faint} />
          </>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 800, color: M.leaf }}>
            <MeadowIcon name="plus" size={20} color={M.leaf} />
            Add
          </span>
        )}
      </button>
      <PrimaryButton
        onClick={onLook}
        icon={<MeadowIcon name="edit" color="#FFFFFF" />}
        style={{ marginTop: 6 }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>Edit {cat.name}&apos;s look</span>
      </PrimaryButton>
    </Card>
  )
}
