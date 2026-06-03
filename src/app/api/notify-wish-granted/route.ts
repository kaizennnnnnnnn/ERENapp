// ═════════════════════════════════════════════════════════════════════════════
// /api/notify-wish-granted — Phase 3 PR 9
//
// Fires once the grant_wish RPC succeeds. Pushes a notification to the
// OTHER partner ("Jovan listened to Eren's wish today 🤎") so the granted
// state is visible even with the PWA closed.
//
// Idempotent via eren_wishes.granted_pushed_at — if a row already has a
// non-null granted_pushed_at, we skip. The wish-granted realtime event still
// updates the UI for any open client.
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, heartForEmail } from '@/lib/serverPush'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Body {
  household_id: string
  period_key:   string
  granter_id:   string
}

export async function POST(req: Request) {
  let body: Body
  try { body = await req.json() as Body } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  if (!body.household_id || !body.period_key || !body.granter_id) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Pull the wish row + the granter's profile in parallel.
  const [wRes, gRes] = await Promise.all([
    supabase.from('eren_wishes')
      .select('granted_pushed_at, granted_at')
      .eq('household_id', body.household_id)
      .eq('period_key', body.period_key)
      .maybeSingle(),
    supabase.from('profiles')
      .select('id, name, email')
      .eq('id', body.granter_id)
      .maybeSingle(),
  ])

  if (!wRes.data || wRes.data.granted_pushed_at || !wRes.data.granted_at) {
    return NextResponse.json({ ok: true, skipped: true })
  }
  const granter = (gRes.data as { id: string, name: string, email: string } | null)
  const granterName = granter?.name ?? 'your partner'
  const granterHeart = heartForEmail(granter?.email)

  // Recipient = the other household member.
  const { data: recipient } = await supabase
    .from('profiles')
    .select('id, email, wish_push_optin, quiet_eren_optin')
    .eq('household_id', body.household_id)
    .neq('id', body.granter_id)
    .maybeSingle()

  if (!recipient || recipient.wish_push_optin === false) {
    await supabase.from('eren_wishes')
      .update({ granted_pushed_at: new Date().toISOString() })
      .eq('household_id', body.household_id)
      .eq('period_key', body.period_key)
    return NextResponse.json({ ok: true, sent: 0, reason: 'optout-or-solo' })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', recipient.id)
  if (!subs || subs.length === 0) {
    await supabase.from('eren_wishes')
      .update({ granted_pushed_at: new Date().toISOString() })
      .eq('household_id', body.household_id)
      .eq('period_key', body.period_key)
    return NextResponse.json({ ok: true, sent: 0, reason: 'no-subs' })
  }

  const title = `${granterHeart} Pocket Eren`
  const bodyText = `${granterName} just listened to Eren's wish today.`
  let sent = 0
  const expired: string[] = []
  for (const sub of subs) {
    const ok = await sendPush(sub, title, bodyText, 'wish-granted', '/home')
    if (ok) sent++
    else expired.push(sub.id)
  }
  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  await supabase.from('eren_wishes')
    .update({ granted_pushed_at: new Date().toISOString() })
    .eq('household_id', body.household_id)
    .eq('period_key', body.period_key)

  return NextResponse.json({ ok: true, sent })
}
