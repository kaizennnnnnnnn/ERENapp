/**
 * POST /api/notify-stats
 * Fires web-push notifications when stat thresholds are crossed.
 * Called by the client after applying decay or an action, since the cron
 * that used to fire pushes from /api/decay is no longer running on Hobby.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, getStatNotifications } from '@/lib/serverPush'
import { NextResponse } from 'next/server'

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
  oldStats?: StatValues
  newStats?: StatValues
}

export async function POST(request: Request) {
  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const { household_id, oldStats, newStats } = body
  if (!household_id || !oldStats || !newStats) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const notifs = getStatNotifications(oldStats, newStats)
  if (notifs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const supabase = createAdminClient()
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

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return NextResponse.json({ ok: true, sent })
}
