/**
 * GET /api/decay
 * Call this from a Vercel Cron Job (vercel.json) every hour.
 * Slowly decreases Eren's stats to simulate real time passing.
 *
 * Vercel cron schedule: "0 * * * *"  (every hour)
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { clampStat, computeErenMood, shouldBecomeSick } from '@/lib/utils'

// How much each stat decays per hour
// hunger:       full depletion ~25h
// happiness:    full depletion ~50h
// energy:       full depletion ~33h
// sleep_quality:full depletion ~40h
// cleanliness:  full depletion ~67h (~3 days)
const DECAY_PER_HOUR = {
  hunger:        -4,
  happiness:     -2,
  energy:        -3,
  sleep_quality: -2.5,
  cleanliness:   -1.5,
}

export async function GET(request: Request) {
  // Protect with CRON_SECRET if set, otherwise allow (Vercel cron calls without secret if not configured)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = await createClient()

  // Load all active households' stats
  const { data: allStats, error } = await supabase
    .from('eren_stats')
    .select('*')

  if (error || !allStats) {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }

  // Decay each household based on hours elapsed since last decay
  const updates = allStats.map(async stat => {
    const lastDecay = stat.last_decay_at ? new Date(stat.last_decay_at) : new Date(stat.updated_at)
    const hoursElapsed = Math.min(24, (Date.now() - lastDecay.getTime()) / 3600000)

    const newHappiness    = clampStat(stat.happiness    + DECAY_PER_HOUR.happiness    * hoursElapsed)
    const newHunger       = clampStat(stat.hunger       + DECAY_PER_HOUR.hunger       * hoursElapsed)
    const newEnergy       = clampStat(stat.energy       + DECAY_PER_HOUR.energy       * hoursElapsed)
    const newSleep        = clampStat(stat.sleep_quality + DECAY_PER_HOUR.sleep_quality * hoursElapsed)
    const newCleanliness  = clampStat((stat.cleanliness ?? 100) + DECAY_PER_HOUR.cleanliness * hoursElapsed)

    // Become sick if bad conditions persist (unless already sick)
    const newIsSick = stat.is_sick
      ? true  // once sick, stay sick until medicine is given
      : shouldBecomeSick({ cleanliness: newCleanliness, sleep_quality: newSleep, weight: stat.weight ?? 4 })

    const newMood = computeErenMood({
      happiness:     newHappiness,
      hunger:        newHunger,
      energy:        newEnergy,
      sleep_quality: newSleep,
      cleanliness:   newCleanliness,
    })

    return supabase
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
  })

  await Promise.all(updates)

  return NextResponse.json({
    ok: true,
    processed: allStats.length,
    timestamp: new Date().toISOString(),
  })
}
