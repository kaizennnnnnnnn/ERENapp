// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING OPS — the account + household plumbing the onboarding flow runs:
// sign up, build a home (creator) or move into one (joiner), and read back the
// household's cat for the joiner's "Meet {cat}" screen. Every call returns a
// typed result instead of throwing, so each screen can render the right copy.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { catIdentityFromStats, type CatIdentity } from '@/lib/catIdentity'

/** 'already_home' = the account already lives in a home other than the one this call would build or open. */
export type OnbError = 'duplicate_email' | 'invalid_code' | 'already_home' | 'network' | 'unknown'

export type OnbResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: OnbError; message: string }

const NETWORK_MSG = "We couldn't reach the cloud. Check your connection and try again."
const ALREADY_HOME = {
  ok: false as const,
  code: 'already_home' as const,
  message: "You're already in a home. Leave it first from Settings.",
}

export async function signUpAccount(args: {
  name: string
  email: string
  password: string
}): Promise<OnbResult<{ userId: string; hasSession: boolean }>> {
  const supabase = createClient()
  try {
    const { data, error } = await supabase.auth.signUp({
      email: args.email,
      password: args.password,
      options: { data: { name: args.name } },
    })
    if (error || !data.user) {
      if (error && /already (registered|exists)/i.test(error.message)) {
        return { ok: false, code: 'duplicate_email', message: 'That email already has an account. Log in instead?' }
      }
      return { ok: false, code: 'unknown', message: error?.message ?? 'Sign up failed. Try again?' }
    }

    // Record the acceptance the signup checkbox represents. The timestamp is
    // set server-side by the RPC, so it is evidence rather than a value the
    // client asserted.
    //
    // Best-effort on purpose, and the result is deliberately unchecked: if
    // Supabase email confirmation is ever switched on there is no session
    // here yet and this no-ops. TermsGate re-asks anyone whose acceptance is
    // missing or older than the current terms, so the guarantee lives there
    // — this only spares most people from meeting the gate at all.
    if (data.session) await supabase.rpc('accept_terms')

    // No session = email confirmation is on and the address is unconfirmed.
    // The flow cannot create or join a home without one, so it says so
    // instead of failing the next RPC with "not authenticated".
    return { ok: true, value: { userId: data.user.id, hasSession: !!data.session } }
  } catch {
    return { ok: false, code: 'network', message: NETWORK_MSG }
  }
}

/** The signed-in user's household id, read fresh. null = none (or a failed read: see `error`). */
async function readOwnHousehold(userId: string): Promise<{ householdId: string | null; error: boolean }> {
  const supabase = createClient()
  const { data, error } = await withRetry(() => supabase
    .from('profiles').select('household_id').eq('id', userId).maybeSingle())
  if (error) return { householdId: null, error: true }
  return { householdId: (data?.household_id as string | null) ?? null, error: false }
}

// create_household is deliberately NOT wrapped in withRetry: it isn't
// idempotent. A retry after a lost response would hit the RPC's "already in a
// household" guard, so that answer is treated as "the first try landed" and
// the home it made is read back instead.
export async function createHousehold(args: {
  userId: string
  name: string
  householdName: string
}): Promise<OnbResult<{ householdId: string; inviteCode: string }>> {
  const supabase = createClient()
  const failed = { ok: false as const, code: 'network' as const, message: "Couldn't build the home. Try again?" }
  try {
    // One round trip, server-side. The client can no longer write
    // profiles.household_id (revoked in migration_household_takeover_fix.sql
    // so an account can't relocate itself into someone else's household), so
    // creating the household, linking the profile, stamping the creator's
    // heart colour and seeding the cat's stats all happen inside the RPC —
    // which also makes them atomic instead of three writes that could
    // half-fail and strand a user with a household but no cat.
    const { data, error: rpcError } = await supabase.rpc('create_household', {
      p_household_name: args.householdName,
      p_display_name:   args.name,
    })
    if (rpcError) {
      if (/already in a household/i.test(rpcError.message ?? '')) return recoverCreated(args.userId)
      return failed
    }

    // RETURNS TABLE comes back as a one-row array.
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.household_id) return failed

    return { ok: true, value: { householdId: row.household_id as string, inviteCode: row.invite_code as string } }
  } catch {
    return { ok: false, code: 'network', message: NETWORK_MSG }
  }
}

async function recoverCreated(userId: string): Promise<OnbResult<{ householdId: string; inviteCode: string }>> {
  const own = await readOwnHousehold(userId)
  if (own.error || !own.householdId) return { ok: false, code: 'network', message: NETWORK_MSG }
  // "Already in a household" only means the first try landed if the home is
  // one this create could have made, and those have one person in them. With
  // someone else there it's a home the account was already in (a join whose
  // answer got lost), and accepting it would paint the cat built here over
  // their person's cat and hand out their key as "yours".
  const alone = await livesAlone(own.householdId, userId)
  if (!alone.ok) return alone
  if (!alone.value) return ALREADY_HOME
  const code = await readInviteCode(own.householdId)
  if (!code.ok) return code
  return { ok: true, value: { householdId: own.householdId, inviteCode: code.value } }
}

export async function readInviteCode(householdId: string): Promise<OnbResult<string>> {
  const supabase = createClient()
  const { data, error } = await withRetry(() => supabase
    .from('households').select('invite_code').eq('id', householdId).maybeSingle())
  if (error || !data?.invite_code) return { ok: false, code: 'network', message: NETWORK_MSG }
  return { ok: true, value: data.invite_code as string }
}

/**
 * Whether this account is the only one in the household: true for every home
 * create_household has just made, which is how "the home I built" is told
 * apart from one the account was already in. Members can read each other's
 * profiles (the same read the Meet screen does), and a failed read is an
 * error, never "alone".
 */
export async function livesAlone(householdId: string, userId: string): Promise<OnbResult<boolean>> {
  const supabase = createClient()
  const { data, error } = await withRetry(() => supabase
    .from('profiles').select('id').eq('household_id', householdId).neq('id', userId).limit(1))
  if (error) return { ok: false, code: 'network', message: NETWORK_MSG }
  return { ok: true, value: (data ?? []).length === 0 }
}

export async function joinHousehold(args: {
  userId: string
  name: string
  inviteCode: string
}): Promise<OnbResult<{ householdId: string }>> {
  const supabase = createClient()
  try {
    // This used to SELECT households by invite_code straight from the client,
    // which could never work: the only SELECT policy on households is
    // `id = my_household_id()`, and that is NULL for someone who hasn't joined
    // yet — so every valid code came back as "Code not found". It also relied
    // on the client being able to write profiles.household_id, which was the
    // same permission that let any account relocate into any household.
    //
    // join_household() does both server-side: resolves the code with the RLS
    // bypass it needs, and sets household_id, which the client can no longer
    // write. It returns the household id, or NULL for a genuinely bad code.
    //
    // Not retried automatically: a retry after a lost response would come back
    // as already_in_household. That answer is instead read as "the first try
    // landed", and the household it joined is read back. The Meet screen then
    // shows whose home it is, with a way out if it's the wrong one.
    const { data: householdId, error: joinErr } = await supabase.rpc('join_household', { p_invite_code: args.inviteCode })
    if (joinErr) {
      // The RPC raises named exceptions for the states that are the user's
      // problem rather than the network's, so they get real copy instead of
      // "check your connection".
      const raised = joinErr.message ?? ''
      if (raised.includes('household_full')) {
        return { ok: false, code: 'invalid_code', message: 'That home already has two people in it.' }
      }
      if (raised.includes('already_in_household')) {
        // Only "the first try landed" if the home this account is in is the
        // one this code opens (joining doesn't rotate codes). Any other home,
        // like the creator's own from a create whose answer was lost, is the
        // old refusal: reading it as joined put them in the wrong home alone.
        const own = await readOwnHousehold(args.userId)
        if (!own.householdId) return { ok: false, code: 'network', message: NETWORK_MSG }
        const code = await readInviteCode(own.householdId)
        if (!code.ok) return code
        if (normalizeInviteCode(code.value) !== normalizeInviteCode(args.inviteCode)) return ALREADY_HOME
        return saveJoinerName(args, own.householdId)
      }
      // Someone in that household blocked this account, or this account
      // blocked someone in it. Deliberately vague about which: naming the
      // person would tell a blocked ex exactly whose code they just tried.
      if (raised.includes('blocked')) {
        return { ok: false, code: 'invalid_code', message: 'That code cannot be used with this account.' }
      }
      return { ok: false, code: 'network', message: NETWORK_MSG }
    }
    if (!householdId) {
      return { ok: false, code: 'invalid_code', message: 'Code not found. Check it with whoever invited you.' }
    }
    return saveJoinerName(args, householdId as string)
  } catch {
    return { ok: false, code: 'network', message: NETWORK_MSG }
  }
}

// The joiner's display name. Absolute value, so safe to send again.
async function saveJoinerName(
  args: { userId: string; name: string },
  householdId: string,
): Promise<OnbResult<{ householdId: string }>> {
  const name = args.name.trim()
  if (name) {
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ name }).eq('id', args.userId)
    if (error) return { ok: false, code: 'network', message: NETWORK_MSG }
  }
  return { ok: true, value: { householdId } }
}

/**
 * "That's not my code": undo a join. leave_household() detaches the caller
 * and rotates the home's invite code, so a code that reached the wrong person
 * stops working. Idempotent (a second call finds no household and returns),
 * so it is safe to retry.
 */
export async function leaveHousehold(): Promise<OnbResult<null>> {
  const supabase = createClient()
  const { error } = await withRetry(() => supabase.rpc('leave_household'))
  if (error) return { ok: false, code: 'network', message: "Couldn't leave that home. Try again?" }
  return { ok: true, value: null }
}

// ─── Invite codes ─────────────────────────────────────────────────────────────
// Codes are 8 characters (create_household takes 8 hex from a uuid). People
// type them with spaces or dashes, or paste "K7M2 QX9P" as shown; the RPC
// upper-cases, so the client only has to strip the separators.

export const INVITE_CODE_INPUT_MAX = 9 // 8 + one space

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase()
}

/** "K7M2QX9P" -> "K7M2 QX9P", for display only. */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code)
  return c.length > 4 ? `${c.slice(0, 4)} ${c.slice(4)}` : c
}

// ─── The household a joiner just moved into ──────────────────────────────────

export interface HouseholdIntro {
  cat: CatIdentity
  /** The person already living there, or null in a home of one. */
  partner: { name: string; heart: 'brown_heart' | 'pink_heart' | 'sparkle' | null } | null
  /** households.created_at, the day the cat came home. */
  homeSince: string | null
}

/**
 * Everything the Meet screen shows. Reads only, all retried, and a failure is
 * an error, never "no cat": defaulting to Eren here would introduce the joiner
 * to the wrong cat.
 */
export async function loadHouseholdIntro(householdId: string, userId: string): Promise<OnbResult<HouseholdIntro>> {
  const supabase = createClient()
  // select('*') on eren_stats, not the three cat columns by name: before
  // migration_cat_identity.sql is pasted they don't exist, and naming them
  // would fail the whole read. catIdentityFromStats defaults what's missing.
  const [statsRes, homeRes, partnerRes] = await Promise.all([
    withRetry(() => supabase.from('eren_stats').select('*').eq('household_id', householdId).maybeSingle()),
    withRetry(() => supabase.from('households').select('created_at').eq('id', householdId).maybeSingle()),
    withRetry(() => supabase.from('profiles').select('name, heart')
      .eq('household_id', householdId).neq('id', userId).limit(1)),
  ])
  if (statsRes.error || homeRes.error || partnerRes.error) {
    return { ok: false, code: 'network', message: NETWORK_MSG }
  }
  const p = (partnerRes.data ?? [])[0] as { name?: string | null; heart?: string | null } | undefined
  const heart = p?.heart === 'brown_heart' || p?.heart === 'pink_heart' || p?.heart === 'sparkle' ? p.heart : null
  return {
    ok: true,
    value: {
      cat: catIdentityFromStats(statsRes.data),
      partner: p ? { name: (p.name ?? '').trim() || 'Your person', heart } : null,
      homeSince: (homeRes.data?.created_at as string | undefined) ?? null,
    },
  }
}

/** The household's cat alone (resume after a refresh mid-flow). */
export async function loadHouseholdCat(householdId: string): Promise<OnbResult<CatIdentity>> {
  const supabase = createClient()
  const { data, error } = await withRetry(() => supabase
    .from('eren_stats').select('*').eq('household_id', householdId).maybeSingle())
  if (error) return { ok: false, code: 'network', message: NETWORK_MSG }
  return { ok: true, value: catIdentityFromStats(data) }
}
