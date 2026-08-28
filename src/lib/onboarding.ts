// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING OPS — account + household plumbing extracted from the old
// register page so the multi-step onboarding flow can run signUp at the
// account step (enabling refresh-resume) and create/join at the household
// step. Same Supabase calls and semantics as before, plus a typed error
// taxonomy so each screen can render the right message.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'

export type OnbError = 'duplicate_email' | 'invalid_code' | 'network' | 'unknown'

export type OnbResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: OnbError; message: string }

const NETWORK_MSG = "Eren couldn't reach the cloud. Try again?"

export async function signUpAccount(args: {
  name: string
  email: string
  password: string
}): Promise<OnbResult<{ userId: string }>> {
  const supabase = createClient()
  try {
    const { data, error } = await supabase.auth.signUp({
      email: args.email,
      password: args.password,
      options: { data: { name: args.name } },
    })
    if (error || !data.user) {
      if (error && /already (registered|exists)/i.test(error.message)) {
        return { ok: false, code: 'duplicate_email', message: 'That email already lives here. Log in instead?' }
      }
      return { ok: false, code: 'unknown', message: error?.message ?? 'Sign up failed' }
    }
    return { ok: true, value: { userId: data.user.id } }
  } catch {
    return { ok: false, code: 'network', message: NETWORK_MSG }
  }
}

// Writes are deliberately NOT wrapped in withRetry: they aren't idempotent,
// and a retry after a lost response could mint a second household.
export async function createHousehold(args: {
  userId: string
  name: string
  householdName: string
}): Promise<OnbResult<{ householdId: string; inviteCode: string }>> {
  const supabase = createClient()
  try {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    const { data: household, error: hhError } = await supabase
      .from('households')
      .insert({ name: args.householdName, invite_code: code })
      .select()
      .single()
    if (hhError || !household) {
      return { ok: false, code: 'network', message: 'Could not build the home. Try again?' }
    }

    // Link profile to household. This is the critical link — surface the
    // error instead of silently ignoring it like the old register page did.
    const { error: linkError } = await supabase
      .from('profiles')
      .update({ household_id: household.id, name: args.name })
      .eq('id', args.userId)
    if (linkError) {
      return { ok: false, code: 'network', message: NETWORK_MSG }
    }

    // Seed Eren's stats. Non-fatal if it races a partner's insert.
    await supabase.from('eren_stats').insert({ household_id: household.id })

    return { ok: true, value: { householdId: household.id, inviteCode: household.invite_code as string } }
  } catch {
    return { ok: false, code: 'network', message: NETWORK_MSG }
  }
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
    // write. It returns the household id, or NULL for a genuinely bad code —
    // so a transient 503 still reads as retryable rather than as "bad code".
    const { data: householdId, error: joinErr } = await withRetry(() =>
      supabase.rpc('join_household', { p_invite_code: args.inviteCode }))
    if (joinErr) {
      return { ok: false, code: 'network', message: NETWORK_MSG }
    }
    if (!householdId) {
      return { ok: false, code: 'invalid_code', message: 'Code not found. Ask your partner for it!' }
    }

    const { error: nameError } = await supabase
      .from('profiles')
      .update({ name: args.name })
      .eq('id', args.userId)
    if (nameError) {
      return { ok: false, code: 'network', message: NETWORK_MSG }
    }

    return { ok: true, value: { householdId: householdId as string } }
  } catch {
    return { ok: false, code: 'network', message: NETWORK_MSG }
  }
}
