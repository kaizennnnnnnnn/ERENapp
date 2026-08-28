/**
 * GET /api/fire-reminders
 *
 * Pinged every minute by Supabase pg_cron (see
 * supabase/migration_reminder_fires.sql). For every active
 * household_reminders row whose scheduled time falls inside the
 * current minute, this:
 *
 *   1. Checks that the same reminder hasn't already fired in the
 *      last 30 minutes (so the cron can run liberally without
 *      double-buzzing).
 *   2. Inserts a reminder_fires log row — that's what powers the
 *      "missed reminders" list the client shows when the phone
 *      comes back online.
 *   3. Sends a web-push to every push_subscription belonging to
 *      the relevant user(s) — the partner sees the reminder too,
 *      unless the reminder is_private.
 *
 * The client safety-net (home page focus → fetch this endpoint)
 * makes it self-healing if the cron is paused or behind.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'
import { authorizeRequest } from '@/lib/apiAuth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Fire a reminder if its scheduled time is now, or up to N minutes ago.
//
// This MUST be at least as long as the cron period or most reminders can
// never fire at all. The job runs every 15 minutes (migration_cron_io_
// reduction.sql), so a 2-minute window only ever caught reminders set within
// 2 minutes of :00/:15/:30/:45 — 8 of 60 possible minutes, meaning ~87% of
// reminder times produced nothing, silently. 16 minutes covers the full
// period plus a minute of cron jitter; DEDUP_MS below is what stops the
// wider window from re-firing the same reminder on the next run.
const WINDOW_MIN = 16
// Don't double-fire the same reminder within this window even if the
// schedule check repeatedly matches (it will for the full WINDOW_MIN).
const DEDUP_MS  = 30 * 60 * 1000

/** Wall-clock parts for an instant, as seen in a specific IANA timezone. */
function tzParts(at: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).formatToParts(at)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')),
    weekday: DOW[get('weekday')] ?? 0,
    date: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

interface Reminder {
  id: string
  household_id: string
  created_by: string
  text: string
  type: 'daily' | 'weekly' | 'once'
  time: string                  // "HH:MM"
  week_days: number[] | null
  date: string | null           // "YYYY-MM-DD" for once
  active: boolean
  is_private: boolean
}

/**
 * `tz` is the household's IANA zone. The reminder's HH:MM is what the user
 * typed on their phone, so it only means anything in their local time — this
 * used to call target.setHours() on the server clock, which is UTC on Vercel,
 * so every reminder fired at the wrong hour (2 h late for Europe/Budapest).
 */
function shouldFire(r: Reminder, now: Date, tz: string): boolean {
  const parts = r.time?.split(':').map(Number)
  if (!parts || parts.length < 2) return false
  const [h, m] = parts
  if (Number.isNaN(h) || Number.isNaN(m)) return false

  const local = tzParts(now, tz)
  const targetMin = h * 60 + m

  // Minutes since the target, allowing for the local-midnight wrap: a 23:55
  // reminder checked at 00:05 is 10 minutes late, not 1430 minutes early.
  let delta = local.minutes - targetMin
  let firedOn = local.date
  let firedDow = local.weekday
  if (delta < 0 && delta + 1440 <= WINDOW_MIN) {
    delta += 1440
    const yesterday = tzParts(new Date(now.getTime() - 86_400_000), tz)
    firedOn = yesterday.date
    firedDow = yesterday.weekday
  }
  if (delta < 0 || delta > WINDOW_MIN) return false

  if (r.type === 'once')   return r.date === firedOn
  if (r.type === 'daily')  return true
  if (r.type === 'weekly') return r.week_days?.includes(firedDow) ?? false
  return false
}

export async function GET(request: Request) {
  // Service-role sweep: pg_cron proves itself with x-cron-secret, the in-app
  // safety-net ping proves itself with the session cookie it already sends.
  const auth = await authorizeRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  const supabase = createAdminClient()
  const now = new Date()

  const { data: reminders, error: remErr } = await supabase
    .from('household_reminders')
    .select('*')
    .eq('active', true)

  if (remErr) {
    return NextResponse.json({ ok: false, error: remErr.message }, { status: 500 })
  }
  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ ok: true, fired: 0, reason: 'no active reminders' })
  }

  // Each reminder's HH:MM is wall-clock time in its household's zone, so we
  // need the zone before we can decide whether it's due. households.tz is set
  // from the browser on first authenticated mount and defaults to 'UTC'.
  const { data: households } = await supabase.from('households').select('id, tz')
  const tzOf = new Map((households ?? []).map(h => [h.id as string, (h.tz as string) || 'UTC']))

  const dueNow = (reminders as Reminder[]).filter(r =>
    shouldFire(r, now, tzOf.get(r.household_id) ?? 'UTC'))
  if (dueNow.length === 0) {
    return NextResponse.json({ ok: true, fired: 0 })
  }

  const dedupCutoff = new Date(now.getTime() - DEDUP_MS).toISOString()
  let firedCount = 0

  for (const r of dueNow) {
    // Dedup — has this reminder already fired recently?
    const { data: recent } = await supabase
      .from('reminder_fires')
      .select('id')
      .eq('reminder_id', r.id)
      .gte('fired_at', dedupCutoff)
      .limit(1)
    if (recent && recent.length > 0) continue

    // Log the fire so missed-reminders UI can pick it up later.
    const { error: fireErr } = await supabase
      .from('reminder_fires')
      .insert({
        reminder_id:  r.id,
        household_id: r.household_id,
        user_id:      r.is_private ? r.created_by : null,
        text:         r.text,
      })
    if (fireErr) continue

    // Resolve push targets.
    let targetUserIds: string[]
    if (r.is_private) {
      targetUserIds = [r.created_by]
    } else {
      const { data: members } = await supabase
        .from('profiles')
        .select('id')
        .eq('household_id', r.household_id)
      targetUserIds = (members ?? []).map(m => m.id)
    }

    // Push to every subscription owned by each target user. Expired
    // endpoints get cleaned up here too so the table doesn't grow
    // stale.
    const expired: string[] = []
    for (const uid of targetUserIds) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', uid)
      for (const sub of subs ?? []) {
        const ok = await sendPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          '⏰ Reminder',
          r.text,
          'reminder-' + r.id,
          '/',
        )
        if (!ok) expired.push(sub.id)
      }
    }
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired)
    }

    firedCount++
  }

  return NextResponse.json({ ok: true, fired: firedCount })
}
