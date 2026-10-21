// ─── /api/notify-bucket ──────────────────────────────────────────────────────
// Tells the partner about a bucket-list plan: one you just added, or one you
// just ticked off. Fired by the writer's own client (useBucketList) right after
// the write, so it is session-only, like /api/notify-message.
//
// The body names only the plan. Who did it and what it says are read from the
// stored row, and the caller must be that person: the creator for 'added', the
// one the table's trigger stamped as done_by for 'done'. Both must be fresh, so
// an old plan can't be re-announced.
//
// No preference check, the same as notes and messages: it is your partner
// writing to you, not Eren.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'
import { authorizeRequest } from '@/lib/apiAuth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** How long after the write it may still be announced. */
const FRESH_MS = 10 * 60 * 1000

interface Body {
  item_id?: string
  event?: 'added' | 'done'
}

export async function POST(request: Request) {
  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const { item_id, event } = body
  if (!item_id || (event !== 'added' && event !== 'done')) {
    return NextResponse.json({ error: 'missing item_id or event' }, { status: 400 })
  }

  const auth = await authorizeRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })
  if (!auth.userId) return NextResponse.json({ error: 'session required' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: plan } = await supabase
    .from('bucket_list')
    .select('id, household_id, created_by, title, target, done_at, done_by, created_at')
    .eq('id', item_id)
    .maybeSingle()
  if (!plan) return NextResponse.json({ error: 'no such plan' }, { status: 404 })

  const actor = event === 'added' ? plan.created_by : plan.done_by
  const at = event === 'added' ? plan.created_at : plan.done_at
  if (actor !== auth.userId) return NextResponse.json({ error: 'not yours to announce' }, { status: 403 })
  if (!at || Date.now() - new Date(at).getTime() > FRESH_MS) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'stale' })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('household_id', plan.household_id)
    .neq('user_id', auth.userId)
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no partner subs' })
  }

  const { data: sender } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', auth.userId)
    .maybeSingle()
  const name = (sender?.name?.trim().split(/\s+/)[0] || 'Your partner').slice(0, 32)
  const what = String(plan.title).slice(0, 80)

  const title = event === 'added' ? `${name} added to your bucket list` : `${name} ticked one off`
  const text = event === 'added'
    ? (plan.target ? `${what} · ${String(plan.target).slice(0, 40)}` : what)
    : `${what}. It's on the Hallway wall now.`

  const expired: string[] = []
  let sent = 0
  for (const sub of subs) {
    const ok = await sendPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      title,
      text,
      `bucket-${plan.id}`,
      '/bucket-list',
    )
    if (ok) sent++
    else expired.push(sub.id)
  }
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return NextResponse.json({ ok: true, sent })
}
