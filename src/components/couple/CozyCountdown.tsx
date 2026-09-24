'use client'

// ═════════════════════════════════════════════════════════════════════════════
// CozyCountdown — advent-style calendar of 12 doors covering the 12 days that
// END on the couple's anniversary. One door per real local day (household tz);
// EITHER partner opens today's door once for the household via the
// zero-argument open_countdown_door() RPC (server derives day + reward, so
// races and double-taps resolve to one clean winner). Missed doors stay sealed.
//
// Renders null outside the window — the card "appears" when the countdown
// begins. Coins are credited server-side inside the RPC; we only show the +N
// (the HUD catches up on the next profile fetch, same as wish grants).
//
// Two halves: this default export owns the data (household row, the window's
// doors, realtime, the RPC); CozyCountdownCard below only draws, in the Meadow
// look of the Us page, so it can also be rendered outside the auth gate.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { dateKey } from '@/lib/wishes'
import { countdownWindow, promptText, DOOR_COUNT } from '@/lib/countdown'
import { playSound } from '@/lib/sounds'
import {
  Card, FONT_ROUNDED, IconTile, M, MeadowIcon, SecondaryButton, TINT, TYPE,
} from '@/components/meadow'

export interface DoorRow {
  period_key: string
  door_no: number
  opened_at: string
  opened_by: string | null
  reward_kind: 'coins' | 'prompt'
  coins_paid: number
  prompt_id: string | null
}

interface OpenDoorResult {
  ok: boolean
  reason?: string
  door_no?: number
  period_key?: string
  opened_by?: string
  reward_kind?: 'coins' | 'prompt'
  coins_paid?: number
  prompt_id?: string | null
}

type Props = {
  householdId: string
  userId: string
  partnerFirstName: string | null
}

// Realtime channels silently fail to subscribe on duplicate names — unique
// suffix per mount, same as useErenStats/useDailyWish.
let _channelCounter = 0

export default function CozyCountdown({ householdId, userId, partnerFirstName }: Props) {
  const supabase = createClient()
  const channelSuffix = useRef(`${++_channelCounter}`)

  const [anniversary, setAnniversary] = useState<string | null>(null)
  const [tz, setTz] = useState<string | null>(null)
  const [hhLoaded, setHhLoaded] = useState(false)
  const [doors, setDoors] = useState<Record<string, DoorRow>>({})
  // The window (its first day) the doors above were read for. The card waits
  // for it: drawn from an empty or failed read, every past door would show as
  // missed and an already-opened today as still shut.
  const [doorsFor, setDoorsFor] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState(false)
  // The reveal/detail overlay: `fresh` = just opened by me (celebration copy).
  const [viewing, setViewing] = useState<{ row: DoorRow; fresh: boolean } | null>(null)

  // Household anniversary + tz. tz must match what the RPC uses (households.tz),
  // NOT the device tz, so both sides agree on which day "today" is.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await withRetry(() => supabase
        .from('households').select('couple_anniversary, tz').eq('id', householdId).maybeSingle())
      if (cancelled || error) return // error ≠ "no anniversary" — stay hidden, retry next mount
      setAnniversary((data?.couple_anniversary as string | null) ?? null)
      setTz((data?.tz as string | null) ?? null)
      setHhLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayKey = hhLoaded ? dateKey(new Date(), tz) : null
  const win = anniversary && todayKey ? countdownWindow(anniversary, todayKey) : null

  // Load this window's opened doors + subscribe to the partner's opens.
  const windowStart = win?.days[0] ?? null
  useEffect(() => {
    if (!windowStart || !anniversary || !todayKey) return
    const w = countdownWindow(anniversary, todayKey)
    if (!w) return
    let cancelled = false

    async function load() {
      const { data, error } = await withRetry(() => supabase
        .from('countdown_doors')
        .select('period_key, door_no, opened_at, opened_by, reward_kind, coins_paid, prompt_id')
        .eq('household_id', householdId)
        .in('period_key', w!.days))
      if (cancelled) return
      if (error || !data) {
        // error ≠ "no doors opened": stay hidden, retry on the next mount.
        console.error('[CozyCountdown] doors read failed', error)
        return
      }
      const next: Record<string, DoorRow> = {}
      for (const r of data as DoorRow[]) next[r.period_key] = r
      // Merge under anything realtime already delivered while the read ran.
      setDoors(prev => ({ ...next, ...prev }))
      setDoorsFor(w!.days[0])
    }
    load()

    const ch = supabase
      .channel(`countdown:${householdId}:${channelSuffix.current}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'countdown_doors',
        filter: `household_id=eq.${householdId}`,
      }, payload => {
        const row = payload.new as DoorRow
        if (!w!.days.includes(row.period_key)) return
        setDoors(prev => ({ ...prev, [row.period_key]: row }))
      })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId, windowStart, anniversary, todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpen = useCallback(async () => {
    if (opening) return
    setOpening(true)
    setOpenError(false)
    playSound('ui_tap')
    const { data, error } = await supabase.rpc('open_countdown_door')
    setOpening(false)
    if (error || !data) {
      // A failed open is said out loud: the door stays shut and can be tried again.
      console.error('[CozyCountdown] open_countdown_door failed', error)
      setOpenError(true)
      return
    }
    const res = data as OpenDoorResult
    if ((res.ok || res.reason === 'already_opened') && res.period_key) {
      const row: DoorRow = {
        period_key: res.period_key,
        door_no: res.door_no ?? 0,
        opened_at: new Date().toISOString(),
        opened_by: res.opened_by ?? null,
        reward_kind: res.reward_kind ?? 'coins',
        coins_paid: res.coins_paid ?? 0,
        prompt_id: res.prompt_id ?? null,
      }
      setDoors(prev => ({ ...prev, [row.period_key]: row }))
      if (res.ok) {
        playSound('gift_open')
        setViewing({ row, fresh: true })
        try {
          window.dispatchEvent(new CustomEvent('eren:countdown-opened', { detail: row }))
        } catch { /* SSR/no-window */ }
      } else {
        // Partner won the race — show them who beat you to it.
        setViewing({ row, fresh: false })
      }
    }
    // outside_window / no_anniversary: next render recomputes and hides/moves the card.
  }, [opening]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!win || doorsFor !== win.days[0]) return null

  return (
    <CozyCountdownCard
      days={win.days}
      todayIndex={win.todayIndex}
      doors={doors}
      userId={userId}
      partnerName={partnerFirstName}
      opening={opening}
      openError={openError}
      onOpen={handleOpen}
      viewing={viewing}
      onView={row => { playSound(row ? 'ui_tap' : 'ui_modal_close'); setViewing(row ? { row, fresh: false } : null) }}
    />
  )
}

// ─── The card (presentational) ───────────────────────────────────────────────

export interface CozyCountdownCardProps {
  /** The window's 12 day keys; the last is the anniversary. */
  days: string[]
  todayIndex: number
  doors: Record<string, DoorRow>
  userId: string
  partnerName: string | null
  opening: boolean
  openError?: boolean
  onOpen: () => void
  viewing: { row: DoorRow; fresh: boolean } | null
  /** Show an opened door's contents, or null to close the reveal. */
  onView: (row: DoorRow | null) => void
}

const TILE = {
  aspectRatio: '1 / 1', borderRadius: 16, boxSizing: 'border-box', padding: 0, border: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
  fontFamily: FONT_ROUNDED, color: M.text,
} as const
const SMALL = { fontSize: 11, lineHeight: 1.1, fontWeight: 700, color: M.text2 } as const

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function CozyCountdownCard({
  days, todayIndex, doors, userId, partnerName, opening, openError, onOpen, viewing, onView,
}: CozyCountdownCardProps) {
  const daysLeft = DOOR_COUNT - 1 - todayIndex
  const partner = partnerName ?? 'your partner'
  const who = (row: DoorRow) => (row.opened_by === userId ? 'you' : partner)

  return (
    <Card padding={18} style={{ position: 'relative', marginTop: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <IconTile icon="calendar" size={48} bg={TINT.amber} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.2, fontWeight: 800 }}>Cozy countdown</h2>
          <span style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>
            {daysLeft === 0
              ? "It's your anniversary today"
              : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to your anniversary`}
          </span>
        </span>
      </div>

      {/* 12 doors, 4 x 3 */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {days.map((day, i) => {
          const row = doors[day]
          const isToday = i === todayIndex
          const isFinal = i === DOOR_COUNT - 1

          if (row) {
            // Opened: what was inside, and who opened it. Tap to read it again.
            return (
              <button key={day} type="button" onClick={() => onView(row)}
                aria-label={`Door ${i + 1}, opened by ${who(row)}`}
                className="m-press m-focus"
                style={{ ...TILE, background: row.reward_kind === 'coins' ? TINT.amber : TINT.love, cursor: 'pointer' }}>
                {row.reward_kind === 'coins' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, ...TYPE.number }}>
                    <MeadowIcon name="coin" size={18} />+{row.coins_paid}
                  </span>
                ) : <MeadowIcon name="hearts" size={22} />}
                <span style={SMALL}>{capitalise(who(row))}</span>
              </button>
            )
          }
          if (isToday) {
            // Today's door: the one leaf button on the card.
            return (
              <button key={day} type="button" onClick={onOpen} disabled={opening}
                aria-label={`Open door ${i + 1}`} aria-busy={opening || undefined}
                className="m-lip m-focus"
                style={{
                  ...TILE, '--m-lip': M.leafLip, '--m-lip-h': '4px',
                  background: M.leaf, color: '#FFFFFF', cursor: opening ? 'default' : 'pointer', opacity: opening ? 0.75 : 1,
                } as CSSProperties}>
                <MeadowIcon name={isFinal ? 'hearts' : 'door'} mono color="#FFFFFF" size={22} />
                <span style={{ fontSize: 12, lineHeight: 1.1, fontWeight: 800 }}>{opening ? 'Opening' : 'Open'}</span>
              </button>
            )
          }
          if (day < days[todayIndex]) {
            // Missed: sealed for good (the RPC only ever opens today's door).
            return (
              <div key={day} role="img" aria-label={`Door ${i + 1}, missed`}
                style={{ ...TILE, background: M.soft, opacity: 0.6 }}>
                <MeadowIcon name="lock" size={18} color={M.faint} />
                <span style={SMALL}>Missed</span>
              </div>
            )
          }
          // Still to come: numbered, waiting. The last one is the day itself.
          return (
            <div key={day} role="img" aria-label={isFinal ? 'The anniversary door' : `Door ${i + 1}, not yet`}
              style={{ ...TILE, background: '#FFFFFF', border: `2px solid ${M.hairline}` }}>
              {isFinal
                ? <MeadowIcon name="hearts" size={22} />
                : <span style={{ fontSize: 17, lineHeight: 1, color: M.text2, ...TYPE.number }}>{i + 1}</span>}
            </div>
          )
        })}
      </div>

      {openError && (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: M.danger, textAlign: 'center' }}>
          The door is stuck. Try again in a moment.
        </p>
      )}

      {/* The reveal sits over the card, white on white: a page turned, not a popup. */}
      {viewing && (
        <div role="dialog" aria-label={`Door ${viewing.row.door_no}`} style={{
          position: 'absolute', inset: 0, background: '#FFFFFF', padding: 24, textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <span style={{ ...TYPE.label, color: M.label }}>
            Door {viewing.row.door_no}{viewing.fresh ? '' : ` · by ${who(viewing.row)}`}
          </span>
          {viewing.row.reward_kind === 'coins' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, lineHeight: 1.1, ...TYPE.number }}>
              <MeadowIcon name="coin" size={28} />+{viewing.row.coins_paid} coins
            </span>
          ) : (
            <>
              <MeadowIcon name="hearts" size={36} />
              <p style={{ margin: 0, maxWidth: 260, fontSize: 16, lineHeight: 1.4, fontWeight: 700 }}>
                {capitalise(promptText(viewing.row.prompt_id) ?? 'a little something for you two.')}
              </p>
            </>
          )}
          <SecondaryButton size="md" onClick={() => onView(null)} style={{ marginTop: 6 }}>
            {viewing.fresh ? 'Cozy' : 'Close'}
          </SecondaryButton>
        </div>
      )}
    </Card>
  )
}
