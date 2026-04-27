/**
 * POST /api/notify-stats
 * Fires web-push when one or more stats are below their warning/critical
 * thresholds. State-based + per-tag 2-hour cooldown (last_notified_at jsonb
 * on eren_stats), so the same alert tag can't be re-sent within 2h even if
 * the client calls this every tick.
 *
 * Used as a backup to the /api/decay cron — primarily fires when the app is
 * hidden (the client checks document.visibilityState before posting).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, getStatNotifications } from '@/lib/serverPush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface StatValues {
  happiness: number
  hunger: number
  energy: number
  sleep_quality: number
  cleanliness: number
  is_sick: boolean
}

interface Body {
  household_id?: string
  // Either pass current stats explicitly, or omit and we'll read from DB.
  stats?: StatValues
  // Legacy field — accepted for back-compat but ignored.
  oldStats?: StatValues
  newStats?: StatValues
}

const NOTIFY_COOLDOWN_MS = 2 * 60 * 60 * 1000

export async function POST(request: Request) {
  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const { household_id } = body
  if (!household_id) {
    return NextResponse.json({ error: 'missing household_id' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Load the current stat row (also need last_notified_at for the cooldown).
  const { data: stat } = await supabase
    .from('eren_stats')
    .select('id, happiness, hunger, energy, sleep_quality, cleanliness, is_sick, last_notified_at')
    .eq('household_id', household_id)
    .single()

  if (!stat) {
    return NextResponse.json({ error: 'no stat row' }, { status: 404 })
  }

  const stats: StatValues = body.stats ?? body.newStats ?? {
    happiness:     stat.happiness,
    hunger:        stat.hunger,
    energy:        stat.energy,
    sleep_quality: stat.sleep_quality,
    cleanliness:   stat.cleanliness ?? 100,
    is_sick:       stat.is_sick,
  }

  const allNotifs = getStatNotifications(stats)
  if (allNotifs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no thresholds' })
  }

  // Cooldown filter — same 2h window as /api/decay
  const now = Date.now()
  const lastNotified = ((stat as { last_notified_at?: Record<string, string> }).last_notified_at ?? {}) as Record<string, string>
  const notifs = allNotifs.filter(n => {
    const prev = lastNotified[n.tag] ? new Date(lastNotified[n.tag]).getTime() : 0
    return now - prev > NOTIFY_COOLDOWN_MS
  })

  if (notifs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'cooldown' })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('household_id', household_id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no subs' })
  }

  const expired: string[] = []
  let sent = 0

  for (const notif of notifs) {
    for (const sub of subs) {
      const ok = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        notif.title,
        notif.body,
        notif.tag,
      )
      if (ok) sent++
      else expired.push(sub.id)
    }
  }

  // Stamp the cooldown for every tag we attempted (success or 410/404).
  const updatedNotified: Record<string, string> = { ...lastNotified }
  for (const n of notifs) updatedNotified[n.tag] = new Date(now).toISOString()
  await supabase.from('eren_stats').update({
    last_notified_at: updatedNotified,
  }).eq('id', stat.id)

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return NextResponse.json({ ok: true, sent })
}
