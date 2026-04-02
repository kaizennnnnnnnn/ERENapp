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
const DECAY = {
  hunger:        -4,   // gets hungry over time
  happiness:     -2,   // needs interaction
  energy:        -1,   // slowly drains
  sleep_quality: -2,   // needs rest
  cleanliness:   -3,   // gets dirty over time (every ~33 hours fully dirty)
}

export async function GET(request: Request) {
  // Protect the endpoint — only callable by Vercel Cron or your own secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Load all active households' stats
  const { data: allStats, error } = await supabase
    .from('eren_stats')
    .select('*')

  if (error || !allStats) {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }

  // Decay each household
  const updates = allStats.map(async stat => {
    const newHappiness    = clampStat(stat.happiness    + DECAY.happiness)
    const newHunger       = clampStat(stat.hunger       + DECAY.hunger)
    const newEnergy       = clampStat(stat.energy       + DECAY.energy)
    const newSleep        = clampStat(stat.sleep_quality + DECAY.sleep_quality)
    const newCleanliness  = clampStat((stat.cleanliness ?? 100) + DECAY.cleanliness)

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
