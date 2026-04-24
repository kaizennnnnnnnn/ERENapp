/**
 * GET /api/decay
 * Call this from a Vercel Cron Job (vercel.json) every hour.
 * Slowly decreases Eren's stats and sends push notifications
 * when stats drop below warning (50%) or critical (10%) thresholds.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { clampStat, computeErenMood, shouldBecomeSick } from '@/lib/utils'
import { sendPush, getStatNotifications } from '@/lib/serverPush'

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
  // No auth — this endpoint just applies hourly stat decay.
  // Safe to call publicly since it only applies time-based decay
  // and rate-limits naturally (decay is based on hours elapsed).

  const supabase = createAdminClient()

  const { data: allStats, error } = await supabase
    .from('eren_stats')
    .select('*')

  if (error || !allStats) {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }

  let pushesSent = 0

  const updates = allStats.map(async stat => {
    // If last_decay_at is missing or old, just set to now and skip decay this run.
    // Cron runs hourly, so we should never apply more than ~1 hour of decay at a time.
    // Capping higher caused stats to zero out when last_decay_at was stale.
    const lastDecay = stat.last_decay_at ? new Date(stat.last_decay_at) : null
    if (!lastDecay) {
      // Initialize last_decay_at to now, apply zero decay this run
      await supabase.from('eren_stats').update({
        last_decay_at: new Date().toISOString(),
      }).eq('id', stat.id)
      return
    }
    const hoursElapsed = Math.min(1.5, (Date.now() - lastDecay.getTime()) / 3600000)
    if (hoursElapsed < 0.5) return // skip — not enough time passed

    // Save old values for notification comparison
    const oldStats = {
      happiness:     stat.happiness,
      hunger:        stat.hunger,
      energy:        stat.energy,
      sleep_quality: stat.sleep_quality,
      cleanliness:   stat.cleanliness ?? 100,
      is_sick:       stat.is_sick,
    }

    const newHappiness   = clampStat(stat.happiness    + DECAY_PER_HOUR.happiness    * hoursElapsed)
    const newHunger      = clampStat(stat.hunger       + DECAY_PER_HOUR.hunger       * hoursElapsed)
    const newEnergy      = clampStat(stat.energy       + DECAY_PER_HOUR.energy       * hoursElapsed)
    const newSleep       = clampStat(stat.sleep_quality + DECAY_PER_HOUR.sleep_quality * hoursElapsed)
    const newCleanliness = clampStat((stat.cleanliness ?? 100) + DECAY_PER_HOUR.cleanliness * hoursElapsed)

    // Passive weight loss (metabolism) — cat naturally loses weight over time
    // Loses more if underfed, keeps weight if well-fed
    const weightLossRate = stat.hunger < 40 ? -0.04 : -0.02
    const newWeight = Math.max(2, Math.min(10, (stat.weight ?? 4) + weightLossRate * hoursElapsed))

    const newIsSick = stat.is_sick
      ? true
      : shouldBecomeSick({ cleanliness: newCleanliness, sleep_quality: newSleep, weight: newWeight })

    const newMood = computeErenMood({
      happiness:     newHappiness,
      hunger:        newHunger,
      energy:        newEnergy,
      sleep_quality: newSleep,
      cleanliness:   newCleanliness,
    })

    // Update stats
    await supabase
      .from('eren_stats')
      .update({
        happiness:     newHappiness,
        hunger:        newHunger,
        energy:        newEnergy,
        sleep_quality: newSleep,
        cleanliness:   newCleanliness,
        weight:        Math.round(newWeight * 100) / 100,
        is_sick:       newIsSick,
        mood:          newMood,
        last_decay_at: new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      })
      .eq('id', stat.id)

    // ── Check for notification triggers ──
    const newStats = {
      happiness: newHappiness, hunger: newHunger, energy: newEnergy,
      sleep_quality: newSleep, cleanliness: newCleanliness, is_sick: newIsSick,
    }

    const allNotifs = getStatNotifications(oldStats, newStats)
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
  })

  await Promise.all(updates)

  return NextResponse.json({
    ok: true,
    processed: allStats.length,
    pushesSent,
    timestamp: new Date().toISOString(),
  })
}
