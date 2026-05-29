/**
 * POST /api/notify-mood
 * Fires a soft web-push to the partner when a user logs a low mood
 * (sad/angry) at the MoodGate, so they know their partner could use some
 * love. Called fire-and-forget from MoodGate.handleSelect.
 *
 * Body: { household_id, sender_id, sender_name, mood }
 *
 * Respects the RECIPIENT's opt-in: profiles.mood_alert_optin. If the
 * partner turned mood alerts off, nothing is sent.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'
import { PUSH_MOODS } from '@/lib/moods'
import type { UserMood } from '@/types'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Body {
  household_id?: string
  sender_id?: string
  sender_name?: string
  mood?: UserMood
}

export async function POST(request: Request) {
  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const { household_id, sender_id, sender_name, mood } = body
  if (!household_id || !sender_id || !mood) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (!PUSH_MOODS.includes(mood)) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'not a low mood' })
  }

  const supabase = createAdminClient()

  // Recipient = the other household member. Honour their opt-in.
  const { data: recipient } = await supabase
    .from('profiles')
    .select('id, mood_alert_optin')
    .eq('household_id', household_id)
    .neq('id', sender_id)
    .limit(1)
    .single()

  if (!recipient) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no partner' })
  }
  if (recipient.mood_alert_optin === false) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'optout' })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', recipient.id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no subs' })
  }

  const name = (sender_name?.trim() || 'Your partner').slice(0, 32)
  const title = '💜 Pocket Eren'
  const snippet = `${name} is having a tough day — maybe send Eren?`

  const expired: string[] = []
  let sent = 0

  for (const sub of subs) {
    const ok = await sendPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      title,
      snippet,
      'mood-alert',
      '/couple',
    )
    if (ok) sent++
    else expired.push(sub.id)
  }

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return NextResponse.json({ ok: true, sent })
}
