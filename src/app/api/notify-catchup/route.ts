// ═════════════════════════════════════════════════════════════════════════════
// /api/notify-catchup — Phase 3 follow-up (was de-scoped from PR 9)
//
// Fired by the client (useCatchupGate) the first time a partner runs the
// memory-wall backfill and it actually unlocks frames. Pings the OTHER partner
// so they know the wall just filled up with the household's history:
//   "<name> started filling Eren's memory wall — come see your memories."
//
// One-time per recipient: profiles.last_phase3_notify['catchup'] is stamped, so
// the partner never gets a second catchup ping (the backfill is a once-per-
// household event anyway). Honours the global quiet_eren_optin mute.
//
// The stamp is a non-atomic read-modify-write (like notify-wish-granted's
// granted_pushed_at). Two same-runner tabs racing this once-per-household event
// could in theory double-buzz the partner; tag:'catchup' coalesces them into a
// single tray entry and the event fires at most once in a household's lifetime,
// so a distributed CAS would be over-engineering for a two-person app.
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, heartForEmail } from '@/lib/serverPush'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Body { user_id?: string; household_id?: string }
interface Sub { id: string; endpoint: string; p256dh: string; auth: string }

export async function POST(req: Request) {
  let body: Body
  try { body = await req.json() as Body } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  if (!body.user_id || !body.household_id) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Runner must belong to the household (admin client bypasses RLS, so re-check).
  const { data: runner } = await supabase
    .from('profiles').select('id, name, email, household_id')
    .eq('id', body.user_id).maybeSingle()
  if (!runner || runner.household_id !== body.household_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Recipient = the other household member.
  const { data: partner } = await supabase
    .from('profiles')
    .select('id, quiet_eren_optin, last_phase3_notify')
    .eq('household_id', body.household_id)
    .neq('id', body.user_id)
    .maybeSingle()
  if (!partner) return NextResponse.json({ ok: true, sent: 0, reason: 'solo' })

  const map = { ...((partner.last_phase3_notify ?? {}) as Record<string, string>) }
  if (map['catchup']) return NextResponse.json({ ok: true, sent: 0, reason: 'already' })

  const stamp = async () => {
    map['catchup'] = new Date().toISOString()
    await supabase.from('profiles').update({ last_phase3_notify: map }).eq('id', partner.id)
  }

  if (partner.quiet_eren_optin === true) {
    await stamp()    // it's a one-time welcome; don't reconsider on later catchups
    return NextResponse.json({ ok: true, sent: 0, reason: 'quiet' })
  }

  const { data: subData } = await supabase
    .from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', partner.id)
  const subs = (subData ?? []) as Sub[]
  if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: 'no-subs' })

  const heart = heartForEmail(runner.email)
  const who = (runner.name?.trim() || 'Your partner').slice(0, 32)
  const title = `${heart} Pocket Eren`
  const text = `${who} started filling Eren's memory wall — come see your memories.`

  let sent = 0
  const expired: string[] = []
  for (const sub of subs) {
    const ok = await sendPush(sub, title, text, 'catchup', '/hallway')
    if (ok) sent++
    else expired.push(sub.id)
  }
  if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired)

  await stamp()
  return NextResponse.json({ ok: true, sent })
}
