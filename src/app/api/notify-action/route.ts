/**
 * POST /api/notify-action
 * Fires a web-push notification to the partner when one user takes a care
 * action (feed/play/sleep/wash/medicine). The caring user's client calls
 * this fire-and-forget after `interactions.insert` succeeds. Without this
 * endpoint the partner only sees the toast when their app is open — closed
 * PWAs miss it entirely.
 *
 * Body: { household_id, sender_id, sender_name, action_type }
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
  action_type?: string
}

// Cooldown so an active partner doing 10 feeds in a row only buzzes the
// other phone once per action-type per window.
const COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

const LABELS: Record<string, { icon: string; verb: string }> = {
  feed:     { icon: '🍗', verb: 'fed Eren' },
  play:     { icon: '🧶', verb: 'played with Eren' },
  sleep:    { icon: '💤', verb: 'put Eren to sleep' },
  wash:     { icon: '🛁', verb: 'gave Eren a bath' },
  medicine: { icon: '💊', verb: 'gave Eren medicine' },
}

export async function POST(request: Request) {
  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const { household_id, sender_id, sender_name, action_type } = body
  if (!household_id || !sender_id || !action_type) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const label = LABELS[action_type]
  if (!label) return NextResponse.json({ ok: true, sent: 0, reason: 'unknown action' })

  const supabase = createAdminClient()

  // Per-tag cooldown lives on profiles.last_action_notify (jsonb). Tolerate
  // the column missing — if migration_partner_action_notify hasn't been
  // applied, the push still fires; we just skip the cooldown guard.
  const recipientQuery = await supabase
    .from('profiles')
    .select('id, last_action_notify')
    .eq('household_id', household_id)
    .neq('id', sender_id)
    .single<{ id: string; last_action_notify: Record<string, string> | null }>()

  let recipient: { id: string; last_action_notify: Record<string, string> | null } | null
    = recipientQuery.data
  let cooldownSupported = true
  if (!recipient && recipientQuery.error?.message?.toLowerCase().includes('last_action_notify')) {
    cooldownSupported = false
    const fallback = await supabase
      .from('profiles')
      .select('id')
      .eq('household_id', household_id)
      .neq('id', sender_id)
      .single<{ id: string }>()
    if (fallback.data) recipient = { id: fallback.data.id, last_action_notify: null }
  }
  if (!recipient) return NextResponse.json({ ok: true, sent: 0, reason: 'no partner' })

  const tag = `partner-${action_type}`
  const lastMap = recipient.last_action_notify ?? {}
  if (cooldownSupported) {
    const lastIso = lastMap[tag]
    if (lastIso) {
      const age = Date.now() - new Date(lastIso).getTime()
      if (age < COOLDOWN_MS) {
        return NextResponse.json({ ok: true, sent: 0, reason: 'cooldown' })
      }
    }
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', recipient.id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no subs' })
  }

  const name = (sender_name?.trim() || 'Your partner').slice(0, 32)
  const title = `${label.icon} Eren`
  const snippet = `${name} ${label.verb}!`

  const expired: string[] = []
  let sent = 0
  for (const sub of subs) {
    const ok = await sendPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      title, snippet, tag, '/home',
    )
    if (ok) sent++
    else expired.push(sub.id)
  }
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  // Stamp the cooldown only when at least one push went out.
  if (sent > 0 && cooldownSupported) {
    lastMap[tag] = new Date().toISOString()
    await supabase.from('profiles').update({ last_action_notify: lastMap }).eq('id', recipient.id)
  }

  return NextResponse.json({ ok: true, sent })
}
