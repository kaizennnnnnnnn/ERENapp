// ═════════════════════════════════════════════════════════════════════════════
// /api/notify-favorite — Phase 3 follow-up (was de-scoped from PR 9/10)
//
// Weekly pg_cron ping (Monday morning). Crowns the household's "favourite" —
// the partner who logged the most care actions over the trailing 7 days — and
// tells both of them, playfully, in Eren's voice:
//   • the champion   → "Eren says YOU were his favourite this week"
//   • the other      → "Eren's favourite this week was <name>"
//   • a dead heat    → "you're both Eren's favourites"
//
// Idempotency: profiles.last_phase3_notify['favorite'] stores the ISO week key,
// so a double cron run in the same week can't double-send. Honours the global
// quiet_eren_optin mute. A household with zero care this week is skipped.
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, heartForEmail } from '@/lib/serverPush'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Member {
  id: string
  name: string | null
  email: string | null
  quiet_eren_optin: boolean | null
  last_phase3_notify: Record<string, string> | null
}
interface Sub { id: string; endpoint: string; p256dh: string; auth: string }

/** ISO-8601 week key, e.g. '2026-W24' (UTC). Weeks belong to the year holding
 *  their Thursday. */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7              // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3)        // shift to the week's Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(
    ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  )
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export async function GET() {
  const supabase = createAdminClient()
  const now = new Date()
  const weekKey = isoWeekKey(now)
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Every care action in the trailing week, bucketed household → user → count.
  const { data: rows } = await supabase
    .from('interactions')
    .select('household_id, user_id, created_at')
    .gte('created_at', since)
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, households: 0, weekKey })
  }

  type Row = { household_id: string | null; user_id: string | null }
  const byHousehold = new Map<string, Map<string, number>>()
  for (const r of rows as Row[]) {
    if (!r.household_id || !r.user_id) continue
    if (!byHousehold.has(r.household_id)) byHousehold.set(r.household_id, new Map())
    const c = byHousehold.get(r.household_id)!
    c.set(r.user_id, (c.get(r.user_id) ?? 0) + 1)
  }

  let pushesSent = 0
  let households = 0

  for (const [householdId, counts] of Array.from(byHousehold.entries())) {
    const { data: memberRows } = await supabase
      .from('profiles')
      .select('id, name, email, quiet_eren_optin, last_phase3_notify')
      .eq('household_id', householdId)
    const members = (memberRows ?? []) as Member[]
    if (members.length === 0) continue

    const tally = members.map(m => ({ m, n: counts.get(m.id) ?? 0 }))
    const maxN = Math.max(...tally.map(t => t.n))
    if (maxN === 0) continue                            // nobody cared this week
    const top = tally.filter(t => t.n === maxN)
    const tie = top.length > 1
    const champion = top[0].m
    households++

    for (const { m } of tally) {
      if (m.quiet_eren_optin === true) continue
      const map = { ...(m.last_phase3_notify ?? {}) }
      if (map['favorite'] === weekKey) continue         // already crowned this week

      let title: string
      let body: string
      if (tie) {
        title = '💞 Pocket Eren'
        body = `It's a tie — you're both Eren's favourites this week. 🤎🩷`
      } else if (m.id === champion.id) {
        title = `${heartForEmail(m.email)} Pocket Eren`
        body = `Eren says YOU were his favourite this week — ${maxN} moments together.`
      } else {
        const champName = champion.name?.trim() || 'your partner'
        title = `${heartForEmail(champion.email)} Pocket Eren`
        body = `Eren's favourite this week was ${champName}. Your turn next week?`
      }

      const { data: subData } = await supabase
        .from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', m.id)
      const subs = (subData ?? []) as Sub[]
      if (subs.length === 0) continue

      const expired: string[] = []
      for (const sub of subs) {
        const ok = await sendPush(sub, title, body, 'favorite', '/home')
        if (ok) pushesSent++
        else expired.push(sub.id)
      }
      if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired)

      map['favorite'] = weekKey
      await supabase.from('profiles').update({ last_phase3_notify: map }).eq('id', m.id)
    }
  }

  return NextResponse.json({ ok: true, households, pushesSent, weekKey })
}
