/**
 * GET /api/push-test
 * Debug endpoint — checks if push notifications are configured correctly
 * and sends a test push to all subscribed devices.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/serverPush'
import { NextResponse } from 'next/server'

export async function GET() {
  const checks: Record<string, unknown> = {}

  // 1. Check env vars
  checks.VAPID_PUBLIC = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  checks.VAPID_PRIVATE = !!process.env.VAPID_PRIVATE_KEY
  checks.SERVICE_ROLE = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!checks.SERVICE_ROLE) {
    return NextResponse.json({ ...checks, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' })
  }

  // 2. Check push subscriptions in DB
  const supabase = createAdminClient()
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, household_id, endpoint')

  checks.subscriptions_error = subErr?.message ?? null
  checks.subscriptions_count = subs?.length ?? 0
  checks.subscriptions = subs?.map(s => ({
    id: s.id,
    user_id: s.user_id.substring(0, 8) + '...',
    endpoint: s.endpoint.substring(0, 60) + '...',
  })) ?? []

  // 3. Check eren_stats
  const { data: stats } = await supabase.from('eren_stats').select('household_id, hunger, happiness, energy, sleep_quality, cleanliness, is_sick')
  checks.stats = stats

  // 4. Try sending a test push to all subscriptions
  if (subs && subs.length > 0 && checks.VAPID_PUBLIC && checks.VAPID_PRIVATE) {
    const results: { endpoint: string; success: boolean }[] = []
    for (const sub of subs) {
      const { data: full } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('id', sub.id)
        .single()
      if (full) {
        const ok = await sendPush(
          { endpoint: full.endpoint, p256dh: full.p256dh, auth: full.auth },
          '🐱 Push Test',
          'If you see this, background notifications work!',
          'test-push',
        )
        results.push({ endpoint: full.endpoint.substring(0, 50) + '...', success: ok })
      }
    }
    checks.push_results = results
  }

  return NextResponse.json(checks)
}
