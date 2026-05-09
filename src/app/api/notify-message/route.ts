/**
 * POST /api/notify-message
 * Fires a web-push notification to the recipient(s) when one partner sends
 * a journal message. The sender's client calls this fire-and-forget right
 * after the couple_journal insert succeeds — this is the only path that
 * works when the recipient's PWA is fully closed (the in-app realtime
 * channel only delivers when the recipient has the app running).
 *
 * Body: { household_id, sender_id, sender_name, message }
 *
 * Sends to every push_subscription in the household where user_id !== sender_id,
 * so the sender never gets pushed their own message.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Body {
  household_id?: string
  sender_id?: string
  sender_name?: string
  message?: string
}

export async function POST(request: Request) {
  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const { household_id, sender_id, sender_name, message } = body
  if (!household_id || !sender_id) {
    return NextResponse.json({ error: 'missing household_id or sender_id' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('household_id', household_id)
    .neq('user_id', sender_id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no partner subs' })
  }

  const name = (sender_name?.trim() || 'Your partner').slice(0, 32)
  const snippet = (message?.trim() || 'sent you a message through Eren').slice(0, 140)

  const expired: string[] = []
  let sent = 0

  for (const sub of subs) {
    const ok = await sendPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      `💌 ${name}`,
      snippet,
      'partner-msg',
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
