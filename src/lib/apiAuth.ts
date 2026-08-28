import { timingSafeEqual } from 'crypto'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth guard for the /api/notify-* family, /api/decay and /api/fire-reminders.
 *
 * Every one of these routes runs on the SERVICE ROLE client, which bypasses
 * RLS entirely. They shipped with no auth at all, so anyone who learned a
 * household UUID could POST arbitrary text to /api/notify-message and have it
 * delivered to both partners' phones as `💌 <partner name>: <anything>` — a
 * convincing phishing surface on a trusted device — or hammer the endpoints to
 * drain the push quota.
 *
 * Two legitimate caller shapes have to keep working, and most of these routes
 * genuinely have both:
 *
 *   • pg_cron, which has no session. It proves itself with the shared secret
 *     in `x-cron-secret` (already provisioned as CRON_SECRET and, until now,
 *     read by nothing).
 *   • the app itself. Browser fetches to a same-origin /api path send the
 *     Supabase session cookie automatically, so these need no call-site
 *     change — the cookie is already on the wire.
 *
 * Pass `householdId` whenever the request body names one. Without it a signed-in
 * stranger could still aim a push at someone else's household; with it we
 * require the caller to actually be a member.
 */

type Ok = { ok: true; via: 'cron' | 'session'; userId: string | null }
type Denied = { ok: false; status: 401 | 403; reason: string }
export type AuthResult = Ok | Denied

function secretMatches(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function authorizeRequest(
  request: Request,
  householdId?: string | null,
): Promise<AuthResult> {
  if (secretMatches(request.headers.get('x-cron-secret'))) {
    return { ok: true, via: 'cron', userId: null }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, reason: 'unauthorized' }

  if (householdId) {
    const { data: profile } = await supabase
      .from('profiles').select('household_id').eq('id', user.id).single()
    if (!profile || profile.household_id !== householdId) {
      return { ok: false, status: 403, reason: 'not a member of that household' }
    }
  }

  return { ok: true, via: 'session', userId: user.id }
}
