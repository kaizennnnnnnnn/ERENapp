// ═════════════════════════════════════════════════════════════════════════════
// /api/notify-anniversary — Phase 3 follow-up (was de-scoped from PR 9/10)
//
// Daily pg_cron ping. For every household it checks, in each partner's local
// day (households.tz), whether today / tomorrow lands on a celebratory date:
//   • Eren's birthday      (households.eren_birthday)    → both partners, day-of
//   • Couple anniversary   (households.couple_anniversary)→ both, eve + day-of
//   • A partner's birthday (profiles.birthday)           → the OTHER partner,
//                                                           eve + day-of
//
// The 4-countdown profile strip + ErenPartyHat already cover the in-app
// surface; this is the "even with the PWA closed" half.
//
// Idempotency: profiles.last_phase3_notify jsonb (spine migration). Each event
// stores the local day-key it fired for under its own tag, so a double cron
// run can't double-send and next year's occurrence still fires. Honours the
// global quiet_eren_optin mute.
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
  birthday: string | null
  quiet_eren_optin: boolean | null
  last_phase3_notify: Record<string, string> | null
}
interface Household {
  id: string
  tz: string | null
  eren_birthday: string | null
  couple_anniversary: string | null
}
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

/** The local calendar day AFTER `today`, by pure calendar arithmetic. Doing it
 *  this way (rather than localYmd(tz, now + 24h)) is immune to DST-short days:
 *  a fixed now+24h overshoots the local clock on a 23-hour spring-forward day
 *  and can skip a calendar date entirely. Date.UTC normalises month/year rollover. */
function nextLocalDay(today: { y: number; mmdd: string }): { y: number; mmdd: string } {
  const m = Number(today.mmdd.slice(0, 2))
  const d = Number(today.mmdd.slice(3, 5))
  const dt = new Date(Date.UTC(today.y, m - 1, d + 1))
  return {
    y: dt.getUTCFullYear(),
    mmdd: `${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
  }
}

/** Does a stored 'YYYY-MM-DD' anchor fall on (year y, mmdd)? Feb-29 anchors
 *  snap to Feb-28 in non-leap years so they still celebrate. */
function anchorHits(anchor: string | null, y: number, mmdd: string): boolean {
  if (!anchor) return false
  let am = anchor.slice(5)
  if (am === '02-29') {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
    if (!leap) am = '02-28'
  }
  return am === mmdd
}

interface Ev { recipients: Member[]; tag: string; title: string; body: string }

export async function GET() {
  const supabase = createAdminClient()

  const { data: households } = await supabase
    .from('households')
    .select('id, tz, eren_birthday, couple_anniversary')
  if (!households || households.length === 0) {
    return NextResponse.json({ ok: true, households: 0 })
  }

  const now = new Date()

  let pushesSent = 0
  let eventsFired = 0

  for (const hh of households as Household[]) {
    const tz = hh.tz || 'UTC'
    const today = localYmd(tz, now)
    const tom = nextLocalDay(today)
    const dayKey = `${today.y}-${today.mmdd}`   // stored value: the local day we fired

    const { data: memberRows } = await supabase
      .from('profiles')
      .select('id, name, email, birthday, quiet_eren_optin, last_phase3_notify')
      .eq('household_id', hh.id)
    const members = (memberRows ?? []) as Member[]
    if (members.length === 0) continue

    const events: Ev[] = []

    // Eren's birthday — both partners, day-of only.
    if (anchorHits(hh.eren_birthday, today.y, today.mmdd)) {
      events.push({ recipients: members, tag: 'anniv-eren', title: '🎂 Pocket Eren',
        body: `Today is Eren's birthday! Spoil him a little.` })
    }
    // Couple anniversary — eve heads-up, then day-of. Both partners.
    if (anchorHits(hh.couple_anniversary, tom.y, tom.mmdd)) {
      events.push({ recipients: members, tag: 'anniv-couple-eve', title: '💛 Pocket Eren',
        body: `Your anniversary is tomorrow — plan a little surprise.` })
    }
    if (anchorHits(hh.couple_anniversary, today.y, today.mmdd)) {
      events.push({ recipients: members, tag: 'anniv-couple', title: '💛 Pocket Eren',
        body: `Happy anniversary! Eren's parents have been together another year.` })
    }
    // Each partner's own birthday — notify the OTHER partner, eve + day-of.
    for (const m of members) {
      const others = members.filter(o => o.id !== m.id)
      if (others.length === 0) continue
      const heart = heartForEmail(m.email)
      const who = m.name?.trim() || 'your partner'
      if (anchorHits(m.birthday, tom.y, tom.mmdd)) {
        events.push({ recipients: others, tag: `bday-eve-${m.id}`, title: `${heart} Pocket Eren`,
          body: `${who}'s birthday is tomorrow — get ready!` })
      }
      if (anchorHits(m.birthday, today.y, today.mmdd)) {
        events.push({ recipients: others, tag: `bday-${m.id}`, title: `${heart} Pocket Eren`,
          body: `Today is ${who}'s birthday! ${heart}` })
      }
    }

    if (events.length === 0) continue

    // Working copies so a member targeted by several events writes once.
    const notifyMap = new Map<string, Record<string, string>>()
    const dirty = new Set<string>()
    for (const m of members) notifyMap.set(m.id, { ...(m.last_phase3_notify ?? {}) })

    const subsCache = new Map<string, Sub[]>()
    const subsFor = async (uid: string): Promise<Sub[]> => {
      const cached = subsCache.get(uid)
      if (cached) return cached
      const { data } = await supabase.from('push_subscriptions')
        .select('id, endpoint, p256dh, auth').eq('user_id', uid)
      const subs = (data ?? []) as Sub[]
      subsCache.set(uid, subs)
      return subs
    }

    for (const ev of events) {
      for (const r of ev.recipients) {
        if (r.quiet_eren_optin === true) continue
        const map = notifyMap.get(r.id)!
        if (map[ev.tag] === dayKey) continue        // already fired this occurrence
        const subs = await subsFor(r.id)
        if (subs.length === 0) continue             // no device — let a later subscribe catch it
        const expired: string[] = []
        let any = false
        for (const sub of subs) {
          const ok = await sendPush(sub, ev.title, ev.body, ev.tag, '/home')
          if (ok) { pushesSent++; any = true } else expired.push(sub.id)
        }
        if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired)
        map[ev.tag] = dayKey
        dirty.add(r.id)
        if (any) eventsFired++
      }
    }

    for (const id of Array.from(dirty)) {
      await supabase.from('profiles').update({ last_phase3_notify: notifyMap.get(id) }).eq('id', id)
    }
  }

  return NextResponse.json({ ok: true, households: households.length, pushesSent, eventsFired })
}
