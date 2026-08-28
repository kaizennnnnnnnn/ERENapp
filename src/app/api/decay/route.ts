/**
 * GET /api/decay
 * Call this from a Vercel Cron Job (vercel.json) every hour.
 * Slowly decreases Eren's stats and sends push notifications
 * when stats drop below warning (50%) or critical (10%) thresholds.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeRequest } from '@/lib/apiAuth'
import { NextResponse } from 'next/server'
import { clampStat, computeErenMood, shouldBecomeSick } from '@/lib/utils'
import { sendPush, getStatNotifications } from '@/lib/serverPush'
import { runMemorySweep } from '@/lib/memoryChecks'

// Critical: GET route handlers are statically cached by Next.js / Vercel by
// default. Without this opt-out the first response gets memoized and every
// subsequent ping (the client scheduler, pg_cron, anything) returns the same
// JSON without re-running — so decay stops advancing and push never fires.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const DECAY_PER_HOUR = {
  hunger:        -10,   // empties in 10h
  happiness:     -7,    // empties in ~14h
  energy:        -8,    // empties in ~12h
  sleep_quality: -7,    // empties in ~14h
  cleanliness:   -4,    // empties in 25h
}

// Don't re-fire the same push tag for 2 hours even if the condition still
// holds — otherwise the cron spams the user every time a tick crosses a
// threshold.
const NOTIFY_COOLDOWN_MS = 2 * 60 * 60 * 1000

export async function GET(request: Request) {
  // Service-role sweep: pg_cron proves itself with x-cron-secret, the in-app
  // safety-net ping proves itself with the session cookie it already sends.
  const auth = await authorizeRequest(request)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  const supabase = createAdminClient()

  // Scope follows how the caller proved itself. pg_cron sweeps every
  // household; a signed-in caller (the client's tab-focus safety-net ping)
  // gets its OWN household and nothing else.
  //
  // Without this the ping was O(all tenants): one person opening the app ran
  // every household's decay and push fan-out inside their own request, and
  // any account could do it on demand. It also kept the sweep unbounded —
  // PostgREST caps a select at 1000 rows by default, so past 1000 households
  // the tail would silently stop decaying.
  let query = supabase.from('eren_stats').select('*')
  if (auth.via === 'session') {
    if (!auth.householdId) {
      return NextResponse.json({ ok: true, households: 0, reason: 'no household' })
    }
    query = query.eq('household_id', auth.householdId)
  }

  const { data: allStats, error } = await query

  if (error || !allStats) {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }

  let pushesSent = 0

  const updates = allStats.map(async stat => {
    // If last_decay_at is missing, set to now and skip decay this run (but
    // we still let the notification block below evaluate current state).
    const lastDecay = stat.last_decay_at ? new Date(stat.last_decay_at) : null
    if (!lastDecay) {
      await supabase.from('eren_stats').update({
        last_decay_at: new Date().toISOString(),
      }).eq('id', stat.id)
    }

    let currentStats = {
      happiness:     stat.happiness,
      hunger:        stat.hunger,
      energy:        stat.energy,
      sleep_quality: stat.sleep_quality,
      cleanliness:   stat.cleanliness ?? 100,
      is_sick:       stat.is_sick,
    }

    const hoursElapsed = lastDecay
      ? Math.min(1.5, (Date.now() - lastDecay.getTime()) / 3600000)
      : 0

    // ── Decay block — only run if enough time has passed since last_decay_at.
    if (hoursElapsed >= 0.5) {
      const newHappiness   = clampStat(stat.happiness    + DECAY_PER_HOUR.happiness    * hoursElapsed)
      const newHunger      = clampStat(stat.hunger       + DECAY_PER_HOUR.hunger       * hoursElapsed)
      const newEnergy      = clampStat(stat.energy       + DECAY_PER_HOUR.energy       * hoursElapsed)
      const newSleep       = clampStat(stat.sleep_quality + DECAY_PER_HOUR.sleep_quality * hoursElapsed)
      const newCleanliness = clampStat((stat.cleanliness ?? 100) + DECAY_PER_HOUR.cleanliness * hoursElapsed)

      const weightLossRate = stat.hunger < 40 ? -0.04 : -0.02
      const newWeight = Math.max(2, Math.min(10, (stat.weight ?? 4) + weightLossRate * hoursElapsed))

      const newIsSick = stat.is_sick
        ? true
        : shouldBecomeSick({ cleanliness: newCleanliness, sleep_quality: newSleep, weight: newWeight })

      const newMood = computeErenMood({
        happiness: newHappiness, hunger: newHunger, energy: newEnergy,
        sleep_quality: newSleep, cleanliness: newCleanliness,
      })

      await supabase
        .from('eren_stats')
        .update({
          // happiness/hunger/energy/sleep_quality are integer columns — the
          // fractional decay result must be rounded or Postgres rejects it
          // (22P02 "invalid input syntax for type integer"). Mirrors the client
          // hook (useErenStats). cleanliness is numeric, so it stays fractional.
          happiness:     Math.round(newHappiness),
          hunger:        Math.round(newHunger),
          energy:        Math.round(newEnergy),
          sleep_quality: Math.round(newSleep),
          cleanliness:   newCleanliness,
          weight:        Math.round(newWeight * 100) / 100,
          is_sick:       newIsSick,
          mood:          newMood,
          last_decay_at: new Date().toISOString(),
          updated_at:    new Date().toISOString(),
        })
        .eq('id', stat.id)

      currentStats = {
        happiness: newHappiness, hunger: newHunger, energy: newEnergy,
        sleep_quality: newSleep, cleanliness: newCleanliness, is_sick: newIsSick,
      }
    }

    // ── Notification block — ALWAYS runs, regardless of whether decay was
    // applied this tick. State-based: if a stat is currently in warning/
    // critical, the corresponding tag is a candidate. The cooldown filter
    // below stops us from re-firing within 2h.
    const allNotifs = getStatNotifications(currentStats)
    if (allNotifs.length === 0) return

    // Apply per-tag cooldown so we don't re-fire the same alert every cron
    // tick. last_notified_at is a jsonb { [tag]: iso_timestamp }.
    const now = Date.now()
    const lastNotified = (stat.last_notified_at ?? {}) as Record<string, string>
    const notifs = allNotifs.filter(n => {
      const prev = lastNotified[n.tag] ? new Date(lastNotified[n.tag]).getTime() : 0
      return now - prev > NOTIFY_COOLDOWN_MS
    })
    if (notifs.length === 0) return

    // Get all push subscriptions for this household
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('household_id', stat.household_id)

    if (!subs || subs.length === 0) return

    // Send notifications to all subscribed devices
    const expired: string[] = []

    for (const notif of notifs) {
      for (const sub of subs) {
        const ok = await sendPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          notif.title,
          notif.body,
          notif.tag,
        )
        if (!ok) expired.push(sub.id)
        else pushesSent++
      }
    }

    // Persist the cooldown timestamps for every tag we just attempted.
    const updatedNotified: Record<string, string> = { ...lastNotified }
    for (const n of notifs) updatedNotified[n.tag] = new Date(now).toISOString()
    await supabase.from('eren_stats').update({
      last_notified_at: updatedNotified,
    }).eq('id', stat.id)

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired)
    }

    // Memory Wall sweep — date-based + streak + rare frames. Idempotent via
    // CAS on memory_frames PK, so safe to run every tick. PR 9's notify-memory
    // cron drains the trigger-queued memory_unlocks rows.
    try {
      await runMemorySweep(supabase, stat.household_id)
    } catch { /* best-effort; sweep swallows its own errors */ }
  })

  await Promise.all(updates)

  return NextResponse.json({
    ok: true,
    processed: allStats.length,
    pushesSent,
    timestamp: new Date().toISOString(),
  })
}
