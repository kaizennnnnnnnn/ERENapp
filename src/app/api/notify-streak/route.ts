// ═════════════════════════════════════════════════════════════════════════════
// /api/notify-streak — Streak SOS + milestone partner notify.
//
// GET  (pg_cron, evenings 16/18/20 UTC): for every household member whose
//      daily-quest streak is AT RISK today — profiles.streak.lastDate was
//      yesterday and current >= 3 — send one gentle push. The route only acts
//      when the household's LOCAL hour is 17–23 (absorbs the UTC cron spread,
//      DST, and stray daytime GETs) and stamps profiles.last_phase3_notify
//      ['streak-sos'] with the local dayKey so re-runs the same evening no-op.
//
// POST (client, fire-and-forget from TaskContext when eren:streak-milestone
//      fires): pushes the PARTNER "X just hit a N-day streak!". Milestone list
//      is server-authoritative; dedup tag streak-mile-<senderId>-<N>.
//
// Streak semantics note: streak.lastDate is written client-side in the
// device's local date while our keys use households.tz — the same tz in
// practice (spine §8 sets households.tz from the device). Accepted drift.
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SOS_MIN_STREAK = 3
const EVENING_START = 17
const EVENING_END = 23
const MILESTONES = [7, 14, 30, 60, 100]

interface StreakBlob { current?: number; lastDate?: string | null }
interface Member {
  id: string
  name: string | null
  household_id: string
  streak: StreakBlob | null
  quiet_eren_optin: boolean | null
  last_phase3_notify: Record<string, string> | null
}
interface Household { id: string; tz: string | null }
interface Sub { id: string; endpoint: string; p256dh: string; auth: string }

/** The calendar year + MM-DD of `d` as seen in time zone `tz`. */
function localYmd(tz: string, d: Date): { y: number; mmdd: string } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  }
  const get = (t: string) => parts.find(p => p.type === t)!.value
  return { y: Number(get('year')), mmdd: `${get('month')}-${get('day')}` }
}

/** The local calendar day BEFORE `today` — pure calendar arithmetic, so
 *  month/year rollover and DST-odd days can't skip a date (see the
 *  nextLocalDay note in notify-anniversary). */
function prevLocalDay(today: { y: number; mmdd: string }): { y: number; mmdd: string } {
  const m = Number(today.mmdd.slice(0, 2))
  const d = Number(today.mmdd.slice(3, 5))
  const dt = new Date(Date.UTC(today.y, m - 1, d - 1))
  return {
    y: dt.getUTCFullYear(),
    mmdd: `${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
  }
}

/** Local hour (0–23) in `tz`. Some ICU builds emit '24' at midnight → 0. */
function localHour(tz: string, d: Date): number {
  try {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(d))
    return Number.isFinite(h) ? h % 24 : d.getUTCHours()
  } catch {
    return d.getUTCHours()
  }
}

async function subsFor(supabase: ReturnType<typeof createAdminClient>, uid: string): Promise<Sub[]> {
  const { data } = await supabase.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth').eq('user_id', uid)
  return (data ?? []) as Sub[]
}

async function pushAll(
  supabase: ReturnType<typeof createAdminClient>,
  subs: Sub[], title: string, body: string, tag: string, url: string,
): Promise<number> {
  const expired: string[] = []
  let sent = 0
  for (const sub of subs) {
    const ok = await sendPush(sub, title, body, tag, url)
    if (ok) sent++
    else expired.push(sub.id)
  }
  if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired)
  return sent
}

// ── GET: evening SOS sweep ───────────────────────────────────────────────────
export async function GET(req: Request) {
  const supabase = createAdminClient()

  // Dev-only hour override so the evening gate is testable without editing it.
  const hourParam = new URL(req.url).searchParams.get('hour')
  const hourOverride = process.env.NODE_ENV !== 'production' && hourParam !== null
    ? Number(hourParam) : null

  const { data: hhRows } = await supabase.from('households').select('id, tz')
  const households = (hhRows ?? []) as Household[]
  if (households.length === 0) return NextResponse.json({ ok: true, households: 0 })

  const { data: memberRows } = await supabase
    .from('profiles')
    .select('id, name, household_id, streak, quiet_eren_optin, last_phase3_notify')
    .not('household_id', 'is', null)
  const byHousehold = new Map<string, Member[]>()
  for (const m of (memberRows ?? []) as Member[]) {
    const list = byHousehold.get(m.household_id) ?? []
    list.push(m)
    byHousehold.set(m.household_id, list)
  }

  const now = new Date()
  let pushesSent = 0
  let usersAtRisk = 0

  for (const hh of households) {
    const tz = hh.tz || 'UTC'
    const hour = hourOverride ?? localHour(tz, now)
    if (hour < EVENING_START || hour > EVENING_END) continue

    const today = localYmd(tz, now)
    const dayKey = `${today.y}-${today.mmdd}`
    const yest = prevLocalDay(today)
    const yestKey = `${yest.y}-${yest.mmdd}`

    for (const member of byHousehold.get(hh.id) ?? []) {
      const s = member.streak
      if (!s?.lastDate || (s.current ?? 0) < SOS_MIN_STREAK) continue
      if (s.lastDate !== yestKey) continue          // secured today, broken, or brand new
      if (member.quiet_eren_optin === true) continue

      const map = { ...(member.last_phase3_notify ?? {}) }
      if (map['streak-sos'] === dayKey) continue    // already nudged this evening

      const subs = await subsFor(supabase, member.id)
      if (subs.length === 0) continue               // no device — later run may catch a fresh subscribe

      usersAtRisk++
      pushesSent += await pushAll(
        supabase, subs, '🔥 Eren',
        `day ${s.current} slips at midnight — one little quest saves it.`,
        'streak-sos', '/home',
      )
      map['streak-sos'] = dayKey
      await supabase.from('profiles').update({ last_phase3_notify: map }).eq('id', member.id)
    }
  }

  return NextResponse.json({ ok: true, households: households.length, usersAtRisk, pushesSent })
}

// ── POST: milestone partner notify ───────────────────────────────────────────
export async function POST(req: Request) {
  let body: { household_id?: string; sender_id?: string; sender_name?: string; milestone?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad json' }, { status: 400 })
  }
  const { household_id, sender_id, milestone } = body
  if (!household_id || !sender_id || typeof milestone !== 'number') {
    return NextResponse.json({ ok: false, reason: 'missing fields' }, { status: 400 })
  }
  // Server-authoritative milestone list — the client can't inject arbitrary N.
  if (!MILESTONES.includes(milestone)) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'bad milestone' })
  }

  const supabase = createAdminClient()

  const { data: partnerRow } = await supabase
    .from('profiles')
    .select('id, quiet_eren_optin, last_phase3_notify')
    .eq('household_id', household_id)
    .neq('id', sender_id)
    .limit(1)
    .maybeSingle()
  if (!partnerRow) return NextResponse.json({ ok: true, sent: 0, reason: 'no partner' })
  const partner = partnerRow as Pick<Member, 'id' | 'quiet_eren_optin' | 'last_phase3_notify'>
  if (partner.quiet_eren_optin === true) return NextResponse.json({ ok: true, sent: 0, reason: 'muted' })

  const { data: hh } = await supabase.from('households').select('tz').eq('id', household_id).maybeSingle()
  const today = localYmd((hh?.tz as string | null) || 'UTC', new Date())
  const dayKey = `${today.y}-${today.mmdd}`

  const tag = `streak-mile-${sender_id}-${milestone}`
  const map = { ...(partner.last_phase3_notify ?? {}) }
  if (map[tag] === dayKey) return NextResponse.json({ ok: true, sent: 0, reason: 'dedup' })

  const subs = await subsFor(supabase, partner.id)
  if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: 'no subs' })

  const name = String(body.sender_name ?? '').trim().slice(0, 32) || 'your partner'
  const sent = await pushAll(
    supabase, subs, '🔥 Eren',
    `${name} just hit a ${milestone}-day streak! send them something nice.`,
    tag, '/couple',
  )
  if (sent > 0) {
    map[tag] = dayKey
    await supabase.from('profiles').update({ last_phase3_notify: map }).eq('id', partner.id)
  }
  return NextResponse.json({ ok: true, sent })
}
