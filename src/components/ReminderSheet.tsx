'use client'

// ─── Reminders ───────────────────────────────────────────────────────────────
// The bell in home's row opens this: a Meadow sheet with two faces.
//
// The list: a nudge to turn notifications on while they're off, anything that
// went off while the phone was away, then every reminder in the household,
// each with its icon on a soft tint, when it goes off and when it's next.
// Your own carry a switch and a bin; your partner's shared ones are marked as
// theirs. Its one button adds a reminder.
//
// The form: what, how often (every day, chosen days, or once), when, and for a
// couple whether it's yours alone. Its one button saves it.

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCat } from '@/hooks/useCat'
import { useNotifyStep } from '@/components/onboarding/useNotifyStep'
import {
  type Reminder, type ReminderFire,
  getReminders, createReminder, updateReminder, deleteReminder,
  scheduleAll, nextFireAt,
  getRecentFires, dismissFire, pingFireReminders,
} from '@/lib/reminders'
import { playSound } from '@/lib/sounds'
import {
  Card, Divider, IconTile, ListGroup, ListRow, MeadowIcon, PrimaryButton, RoundButton, SecondaryButton,
  Segmented, Sheet, Tag, TextButton, TextField, Toggle,
  FONT_ROUNDED, M, PERSON, TINT, TYPE, personColor, type MeadowIconName,
} from '@/components/meadow'

interface Props { onClose: () => void }

type RepeatType = Reminder['type']
type View = 'list' | 'new'
/** This phone's notifications, as far as reminders care. */
type Notif = 'on' | 'off' | 'blocked' | 'unsupported'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** Days are stored 0 = Sunday, but shown Monday to Sunday. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

/** Each kind's icon and the tint behind it. */
const TYPE_LOOK: Record<RepeatType, { icon: MeadowIconName; tint: string }> = {
  daily:  { icon: 'clock',        tint: TINT.leaf },
  weekly: { icon: 'calendarWeek', tint: TINT.orange },
  once:   { icon: 'calendar',     tint: TINT.sky },
}

/** A new reminder's starting time. */
const DEFAULT_TIME = '08:00'

/** The sheet's drop-away before the parent unmounts it (Sheet's EXIT_MS). */
const EXIT_MS = 180

const LABEL: CSSProperties = { ...TYPE.label, color: M.label, display: 'block' }
const ERROR: CSSProperties = { margin: '0 0 12px', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.danger, textAlign: 'center' }

/** Permission alone isn't "on": a phone that allowed notifications but never
 *  signed up for push still hears nothing with the app closed (Settings reads
 *  it the same way). */
async function readNotif(): Promise<Notif> {
  // iOS Safari has none of these until the app is on the home screen.
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  try {
    // getRegistration, not .ready: .ready never settles when no worker is registered.
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** The next day this time is still ahead, on the phone's own calendar (UTC's
 *  is a different day near midnight). */
function nextDateFor(hhmm: string): string {
  const d = new Date()
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isFinite(h) && Number.isFinite(m)) {
    d.setHours(h, m, 0, 0)
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1)
  }
  return format(d, 'yyyy-MM-dd')
}

/** "08:00" in this phone's own clock style. */
function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function daysLabel(days: number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Every day'
  if (set.size === 5 && [1, 2, 3, 4, 5].every(d => set.has(d))) return 'Weekdays'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends'
  return WEEK.filter(d => set.has(d)).map(d => DAY_SHORT[d]).join(', ')
}

/** When it goes off: "Every day at 08:00", "Mon, Thu at 08:00", "Sat, 12 Oct at 08:00". */
function scheduleLabel(r: Reminder): string {
  const at = clockLabel(r.time)
  if (r.type === 'weekly') return `${r.week_days?.length ? daysLabel(r.week_days) : 'No days picked'} at ${at}`
  if (r.type === 'once' && r.date) {
    const day = new Date(`${r.date}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
    return `${day} at ${at}`
  }
  return `Every day at ${at}`
}

/** "Next: today" / "tomorrow" / "Friday". A one-time reminder's own line
 *  already names its day, so past tomorrow it says nothing more. */
function nextLabel(r: Reminder): string | null {
  const ts = nextFireAt(r)
  if (!ts) return null
  const day = new Date(ts).toDateString()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (day === new Date().toDateString()) return 'Next: today'
  if (day === tomorrow.toDateString()) return 'Next: tomorrow'
  return r.type === 'weekly' ? `Next: ${DAY_FULL[new Date(ts).getDay()]}` : null
}

function agoLabel(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hr / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export default function ReminderSheet({ onClose }: Props) {
  const { isSolo, partner } = useCouple()
  const cat = useCat()
  const supabase = createClient()
  const { user, profile } = useAuth()

  const [open, setOpen]             = useState(true)
  const [view, setView]             = useState<View>('list')
  const [reminders, setReminders]   = useState<Reminder[]>([])
  const [loading, setLoading]       = useState(true)
  const [fires, setFires]           = useState<ReminderFire[]>([])
  const [notif, setNotif]           = useState<Notif>('on')
  const [listError, setListError]   = useState<string | null>(null)

  // Form state
  const [text,      setText]      = useState('')
  const [type,      setType]      = useState<RepeatType>('daily')
  const [time,      setTime]      = useState(DEFAULT_TIME)
  const [weekDays,  setWeekDays]  = useState<number[]>([1])
  const [date,      setDate]      = useState('')
  // Until the date is picked by hand it follows the time (see nextDateFor).
  const [dateTouched, setDateTouched] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const notify = useNotifyStep({
    userId: user?.id ?? null,
    householdId: profile?.household_id ?? null,
    demo: false,
    onDone: () => {},
  })

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Switching faces removes the button that had focus; put it somewhere
  // useful instead of letting it fall to the page: the first field of the
  // form, or the list's Add button on the way back.
  const whatRef = useRef<HTMLInputElement>(null)
  const listFooterRef = useRef<HTMLDivElement>(null)
  const shownView = useRef(view)
  useEffect(() => {
    if (shownView.current === view) return
    shownView.current = view
    if (view === 'new') whatRef.current?.focus()
    else listFooterRef.current?.querySelector('button')?.focus()
  }, [view])

  useEffect(() => {
    readNotif().then(setNotif)
    // Ping the server scheduler so anything queued in the current minute
    // surfaces immediately when the sheet opens — useful if the phone
    // just came back online.
    pingFireReminders()
  }, [])

  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    getReminders(supabase, profile.household_id).then(list => {
      // null = load failed (Supabase outage). Stay in the loading state —
      // a false "No reminders yet" invites duplicate re-creation.
      if (!list) return
      // A private reminder is its maker's alone ("won't see it"), so the
      // partner's private ones are neither listed nor scheduled on this
      // phone, the way getRecentFires already drops their firings.
      const mine = list.filter(r => !r.is_private || r.created_by === user.id)
      // Merged, not replaced: a reminder saved while this was in flight
      // may not be in it.
      setReminders(prev => [...mine, ...prev.filter(p => !mine.some(m => m.id === p.id))])
      scheduleAll(mine)
      setLoading(false)
    })
    getRecentFires(supabase, profile.household_id, user.id).then(setFires)
  }, [profile?.household_id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close in two steps so the sheet can drop away before the parent
  // unmounts it.
  function close() {
    if (!open) return
    playSound('ui_modal_close')
    setOpen(false)
    timers.current.push(setTimeout(onClose, EXIT_MS))
  }

  async function turnOnNotifications() {
    playSound('ui_tap')
    await notify.enable()
    setNotif(await readNotif())
  }

  // The switch moves at once and moves back if the write doesn't land.
  async function handleToggle(r: Reminder, next: boolean) {
    playSound('ui_toggle')
    setListError(null)
    const flip = (active: boolean) => {
      setReminders(prev => prev.map(x => x.id === r.id ? { ...x, active } : x))
      scheduleAll([{ ...r, active }])
    }
    flip(next)
    if (!(await updateReminder(supabase, r.id, { active: next }))) {
      flip(!next)
      setListError("That didn't save. Check your connection and try again.")
    }
  }

  async function handleDelete(r: Reminder) {
    playSound('ui_tap')
    setListError(null)
    if (!(await deleteReminder(supabase, r.id))) {
      setListError("That didn't delete. Check your connection and try again.")
      return
    }
    setReminders(prev => prev.filter(x => x.id !== r.id))
    // The phone's own timer for it too, or it still goes off.
    scheduleAll([{ ...r, active: false }])
  }

  async function handleDismissFire(fireId: string) {
    if (!user?.id) return
    playSound('ui_tap')
    setFires(prev => prev.filter(f => f.id !== fireId))
    await dismissFire(supabase, fireId, user.id)
  }

  function openForm() {
    playSound('ui_tap')
    setText(''); setType('daily'); setTime(DEFAULT_TIME); setWeekDays([1]); setIsPrivate(false)
    setDate(nextDateFor(DEFAULT_TIME))
    setDateTouched(false)
    setError(null)
    setListError(null)
    setView('new')
  }

  function backToList() {
    playSound('ui_tap')
    setView('list')
  }

  async function handleSave(e?: FormEvent) {
    e?.preventDefault()
    if (saving || !text.trim() || !user?.id || !profile?.household_id) return
    if (!time) { setError('Pick a time.'); return }
    if (type === 'weekly' && weekDays.length === 0) { setError('Pick at least one day.'); return }
    if (type === 'once' && !date) { setError('Pick a date.'); return }
    // `> now` rather than `<= now` so an unreadable date fails too (NaN).
    if (type === 'once' && !(new Date(`${date}T${time}:00`).getTime() > Date.now())) {
      setError("Pick a time that hasn't passed yet.")
      return
    }
    playSound('ui_tap')
    setSaving(true)
    setError(null)
    const created = await createReminder(supabase, {
      household_id: profile.household_id,
      created_by:   user.id,
      text:         text.trim(),
      type,
      time,
      week_days:    type === 'weekly' ? weekDays : [],
      date:         type === 'once'   ? date     : null,
      active:       true,
      is_private:   isPrivate,
    })
    setSaving(false)
    if (!created) { setError("That didn't save. Check your connection and try again."); return }
    setReminders(prev => [...prev, created])
    scheduleAll([created])
    setView('list')
  }

  function toggleDay(d: number) {
    playSound('ui_tap')
    setError(null)
    setWeekDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const partnerFirst = partner?.name?.split(' ')[0] ?? null
  // The partner's dot, in their household colour; a profile from before the
  // colours were stamped is the other one of the pair (the verdict's rule).
  const partnerColor = partner?.heart
    ? personColor(partner.heart)
    : profile?.heart === 'brown_heart' ? PERSON.pink : PERSON.brown
  // A retry after a failed sign-up still counts as failed until it lands, so
  // the card stays (its button busy) instead of vanishing mid-retry.
  const subscribeFailed = notify.state === 'failed' || (notif === 'on' && notify.state === 'asking')
  const showNotif = notif !== 'on' || subscribeFailed
  const showMissed = fires.length > 0

  const listFooter = (
    <div ref={listFooterRef}>
      {listError && <p role="alert" style={ERROR}>{listError}</p>}
      <PrimaryButton icon={<MeadowIcon name="plus" size={20} color="#FFFFFF" />} onClick={openForm}>
        Add a reminder
      </PrimaryButton>
    </div>
  )

  const formFooter = (
    <div>
      {error && <p role="alert" style={ERROR}>{error}</p>}
      <PrimaryButton busy={saving} disabled={!text.trim()} onClick={() => handleSave()}>
        {saving ? 'Saving...' : 'Save reminder'}
      </PrimaryButton>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
        <TextButton tone="muted" disabled={saving} onClick={backToList}>Cancel</TextButton>
      </div>
    </div>
  )

  return (
    <Sheet
      open={open}
      onClose={close}
      title={view === 'list' ? 'Reminders' : 'New reminder'}
      dismissible={!saving}
      // The form keeps its height while Weekly / Once add a row, so the
      // control under the finger stays put; the list hugs what it holds.
      height={view === 'new' ? 'calc(100% - 56px)' : undefined}
      footer={view === 'list' ? listFooter : formFooter}
    >
      {view === 'list' ? (
        <div style={{ margin: '4px 4px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showNotif && (
            <NotificationsOff
              notif={notif}
              failed={subscribeFailed}
              asking={notify.state === 'asking'}
              onTurnOn={turnOnNotifications}
            />
          )}

          {/* Missed: anything that went off in the last 48h and hasn't been
              seen, so a phone that was off can catch up. */}
          {showMissed && (
            <Card outlined padding="14px 16px 4px">
              <section aria-label="Missed reminders">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IconTile icon="bell" size={36} bg={TINT.love} color={M.love} iconSize={20} />
                  <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 16, fontWeight: 800 }}>
                    Missed while away
                  </span>
                  <Tag tone="love" size="sm" style={TYPE.number}>{fires.length}</Tag>
                </div>
                <div role="list" style={{ marginTop: 6 }}>
                  {fires.slice(0, 6).map((f, i) => (
                    <div key={f.id} role="listitem">
                      {i > 0 && <Divider />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                        <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, overflowWrap: 'anywhere' }}>{f.text}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: M.text2 }}>{agoLabel(f.fired_at)}</span>
                        </span>
                        <TextButton onClick={() => handleDismissFire(f.id)} ariaLabel={`Got it: ${f.text}`}>
                          Got it
                        </TextButton>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </Card>
          )}

          {/* Up for as long as the list hasn't loaded, rows or not: one saved
              meanwhile must not pass for the whole list. */}
          {loading && (
            <p role="status" style={{ margin: 0, padding: reminders.length ? '8px 0 0' : '28px 0', textAlign: 'center', fontSize: 15, fontWeight: 700, color: M.text2 }}>
              Loading reminders...
            </p>
          )}
          {reminders.length === 0 ? (!loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 12px 12px', textAlign: 'center' }}>
              <IconTile icon="bell" size={68} bg={TINT.amber} color={M.energy} />
              <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800 }}>No reminders yet</p>
              <p style={{ margin: 0, ...TYPE.body, color: M.text2, maxWidth: 280 }}>
                {cat.t("Set one for feeding {name}, medicine or a vet visit, and you'll get a nudge when it's time.")}
              </p>
            </div>
          )) : (
            <div>
              {(showNotif || showMissed) && (
                <span style={{ ...LABEL, margin: '12px 4px 0' }}>Your reminders</span>
              )}
              <div role="list">
                {reminders.map((r, i) => (
                  <div key={r.id}>
                    {i > 0 && <Divider inset={58} />}
                    <ReminderRow
                      reminder={r}
                      isOwn={r.created_by === user?.id}
                      // Named only when it IS the partner's: a deleted
                      // account's reminders keep a null maker.
                      partner={partnerFirst && r.created_by === partner?.id ? { name: partnerFirst, color: partnerColor } : null}
                      onToggle={next => handleToggle(r, next)}
                      onDelete={() => handleDelete(r)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ margin: '4px 4px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TextField
            ref={whatRef}
            label="What"
            value={text}
            onChange={e => { setText(e.target.value); if (error) setError(null) }}
            placeholder={cat.t('e.g. Feed {name}')}
            enterKeyHint="done"
            autoComplete="off"
          />

          <div>
            <span style={{ ...LABEL, marginBottom: 8 }}>Repeat</span>
            <Segmented<RepeatType>
              ariaLabel="Repeat"
              value={type}
              onChange={t => { playSound('ui_tap'); setType(t); setError(null) }}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'once', label: 'Once' },
              ]}
            />
          </div>

          {type === 'weekly' && (
            <div>
              <span style={{ ...LABEL, marginBottom: 8 }}>Days</span>
              <div role="group" aria-label="Days" style={{ display: 'flex', gap: 6 }}>
                {WEEK.map(d => {
                  const on = weekDays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_FULL[d]}
                      onClick={() => toggleDay(d)}
                      className="m-press m-focus"
                      style={{
                        flex: '1 1 0', minWidth: 0, height: 44, padding: 0, borderRadius: 12,
                        border: `2px solid ${on ? M.leaf : M.hairline}`,
                        background: on ? M.leafTint : '#FFFFFF',
                        fontFamily: FONT_ROUNDED, fontSize: 14, fontWeight: on ? 800 : 700,
                        color: on ? M.leafInk : M.text2, cursor: 'pointer',
                      }}
                    >
                      {DAY_SHORT[d].slice(0, 2)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {type === 'once' && (
            <TextField label="Date" type="date" value={date} min={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => { setDate(e.target.value); setDateTouched(true); if (error) setError(null) }}
              inputStyle={{ colorScheme: 'light' }} />
          )}

          <TextField label="Time" type="time" value={time}
            onChange={e => {
              const t = e.target.value
              setTime(t)
              // "Once at 16:30" set at noon means today, not tomorrow.
              if (t && !dateTouched) setDate(nextDateFor(t))
              if (error) setError(null)
            }}
            inputStyle={{ colorScheme: 'light' }} />

          {/* Hidden for a household of one: the whole control is "who else
              sees this". `isPrivate` then stays false, which is what a lone
              household wants anyway — the row is saved shared and becomes
              visible if someone ever joins. */}
          {!isSolo && (
            <ListGroup style={{ border: `2px solid ${M.hairline}` }}>
              <ListRow
                icon="lock"
                label="Only me"
                sublabel={isPrivate
                  ? `${partnerFirst ?? 'Your partner'} won't see it`
                  : 'You both see it'}
                toggle={{ checked: isPrivate, onChange: v => { playSound('ui_toggle'); setIsPrivate(v) } }}
              />
            </ListGroup>
          )}
        </form>
      )}
    </Sheet>
  )
}

// ─── One reminder ────────────────────────────────────────────────────────────

function ReminderRow({ reminder: r, isOwn, partner, onToggle, onDelete }: {
  reminder: Reminder
  isOwn: boolean
  /** Who set it, when that's the partner: their first name and colour. */
  partner: { name: string; color: string } | null
  onToggle: (next: boolean) => void
  onDelete: () => void
}) {
  const look = TYPE_LOOK[r.type] ?? TYPE_LOOK.daily
  const passed = r.type === 'once' && nextFireAt(r) === null
  const next = r.active ? nextLabel(r) : null
  const dim = r.active ? 1 : 0.5

  return (
    <div role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
      <IconTile icon={look.icon} size={44} bg={look.tint} iconSize={26} style={{ opacity: dim }} />

      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, opacity: dim }}>
        <span style={{ fontSize: 16, fontWeight: 800, overflowWrap: 'anywhere' }}>{r.text}</span>
        <span style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{scheduleLabel(r)}</span>
        {(passed || next || r.is_private || !isOwn) && (
          <span style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {passed ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>Already passed</span>
            ) : next && (
              <span style={{ fontSize: 13, fontWeight: 700, color: M.leafInk }}>{next}</span>
            )}
            {r.is_private && (
              <Tag size="sm" icon={<MeadowIcon name="lock" size={12} />}>Only you</Tag>
            )}
            {!isOwn && (
              <Tag size="sm" icon={partner ? <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: partner.color }} /> : undefined}>
                {partner ? `From ${partner.name}` : 'Shared'}
              </Tag>
            )}
          </span>
        )}
      </span>

      {isOwn && (
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle checked={r.active} onChange={onToggle} ariaLabel={r.text} />
          <RoundButton ariaLabel={`Delete ${r.text}`} surface="white" size={40} onClick={onDelete}>
            <MeadowIcon name="trash" size={18} />
          </RoundButton>
        </span>
      )}
    </div>
  )
}

// ─── Notifications are off ───────────────────────────────────────────────────

function NotificationsOff({ notif, failed, asking, onTurnOn }: {
  notif: Notif
  failed: boolean
  asking: boolean
  onTurnOn: () => void
}) {
  const title = notif === 'blocked' ? 'Notifications are blocked' : 'Notifications are off'
  const body = notif === 'unsupported'
    ? 'Add Eren to your Home Screen first, then reminders can reach you.'
    : notif === 'blocked'
      ? "Allow them for Eren in your phone's settings so reminders can reach you."
      : failed
        ? "Allowed, but this phone couldn't sign up for them. Try again in a moment."
        : 'Turn them on so reminders reach you, even with the app closed.'
  const canAsk = notif === 'off' || (notif === 'on' && failed)

  return (
    <div role="status" style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 20, background: M.energyTint }}>
      <IconTile icon="bell" size={40} bg="#FFFFFF" color={M.energy} iconSize={22} />
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>{body}</span>
        {canAsk && (
          <SecondaryButton size="sm" busy={asking} onClick={onTurnOn}
            style={{ marginTop: 10, background: '#FFFFFF' }}>
            {failed ? 'Try again' : 'Turn on'}
          </SecondaryButton>
        )}
      </div>
    </div>
  )
}
