// ═════════════════════════════════════════════════════════════════════════════
// /api/notify-memory — Phase 3 PR 9
//
// Drains memory_unlocks queue in batches. The queue_memory_unlock trigger
// (PR 6) inserts a row each time memory_frames gets a new entry. This route
// is invoked by pg_cron every 6h to:
//   1. Find all households with pending (pushed_at IS NULL) unlocks
//   2. For each household, send ONE push summarising the batch
//      ("3 new memories on your wall")
//   3. Stamp pushed_at on the rows that landed in the batch
//
// Respects each recipient's memory_push_optin + quiet_eren_optin (the latter
// silences the whole channel).
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const supabase = createAdminClient()

  // Pull pending unlocks grouped logically by household — we read flat then
  // bucket in JS since the queue is small.
  const { data: pending } = await supabase
    .from('memory_unlocks')
    .select('id, household_id, frame_id, rarity, unlocked_at')
    .is('pushed_at', null)
    .order('unlocked_at', { ascending: true })
    .limit(500)

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  type Row = { id: number, household_id: string, frame_id: string, rarity: string, unlocked_at: string }
  const byHousehold = new Map<string, Row[]>()
  for (const r of pending as Row[]) {
    if (!byHousehold.has(r.household_id)) byHousehold.set(r.household_id, [])
    byHousehold.get(r.household_id)!.push(r)
  }

  let pushesSent = 0
  let rowsStamped = 0
  const households = Array.from(byHousehold.entries())

  for (const [householdId, rows] of households) {
    // Pull both partners' push prefs once.
    const { data: members } = await supabase
      .from('profiles')
      .select('id, memory_push_optin, quiet_eren_optin')
      .eq('household_id', householdId)
    const targets = (members ?? []).filter(m => m.memory_push_optin !== false && m.quiet_eren_optin !== true)

    const ids = rows.map(r => r.id)
    if (targets.length === 0) {
      // Nothing to send — still mark rows as drained so we don't keep retrying.
      await supabase.from('memory_unlocks')
        .update({ pushed_at: new Date().toISOString() })
        .in('id', ids)
      rowsStamped += ids.length
      continue
    }

    const epic = rows.some(r => r.rarity === 'epic')
    const count = rows.length
    const noun = count === 1 ? 'memory' : 'memories'
    const title = epic ? '✨ Pocket Eren' : '🩷 Pocket Eren'
    const body = epic
      ? `${count} new ${noun} on your wall — including a rare one.`
      : `${count} new ${noun} on your wall.`

    for (const m of targets) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', m.id)
      if (!subs || subs.length === 0) continue
      const expired: string[] = []
      for (const sub of subs) {
        const ok = await sendPush(sub, title, body, 'memory-unlock', '/hallway')
        if (ok) pushesSent++
        else expired.push(sub.id)
      }
      if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired)
    }

    await supabase.from('memory_unlocks')
      .update({ pushed_at: new Date().toISOString() })
      .in('id', ids)
    rowsStamped += ids.length
  }

  return NextResponse.json({ ok: true, households: households.length, pushesSent, rowsStamped })
}
