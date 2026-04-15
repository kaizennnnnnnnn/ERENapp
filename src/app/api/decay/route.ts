/**
 * GET /api/decay
 * Call this from a Vercel Cron Job (vercel.json) every hour.
 * Slowly decreases Eren's stats and sends push notifications
 * when stats drop below warning (50%) or critical (10%) thresholds.
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { clampStat, computeErenMood, shouldBecomeSick } from '@/lib/utils'
import { sendPush, getStatNotifications } from '@/lib/serverPush'

const DECAY_PER_HOUR = {
  hunger:        -4,
  happiness:     -2,
  energy:        -3,
  sleep_quality: -2.5,
  cleanliness:   -1.5,
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = request.headers.get('authorization')
    const url = new URL(request.url)
    const querySecret = url.searchParams.get('secret')
    if (authHeader !== `Bearer ${secret}` && querySecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = await createClient()

  const { data: allStats, error } = await supabase
    .from('eren_stats')
    .select('*')

  if (error || !allStats) {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }

  let pushesSent = 0

  const updates = allStats.map(async stat => {
    const lastDecay = stat.last_decay_at ? new Date(stat.last_decay_at) : new Date(stat.updated_at)
    const hoursElapsed = Math.min(24, (Date.now() - lastDecay.getTime()) / 3600000)

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

    const newIsSick = stat.is_sick
      ? true
      : shouldBecomeSick({ cleanliness: newCleanliness, sleep_quality: newSleep, weight: stat.weight ?? 4 })

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

    const notifs = getStatNotifications(oldStats, newStats)
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
