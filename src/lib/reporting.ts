// ═══════════════════════════════════════════════════════════════════════════
// REPORTING AND BLOCKING
//
// Google Play's UGC policy requires an in-app way to report content and users
// and an in-app way to block a user. /terms §4 defines what may not be posted;
// §5 promises these controls. This is the client half.
//
// Everything that matters happens server-side in report_content() and
// block_user() (supabase/migration_reports_blocks.sql). The client picks a
// reason and names a target; it never supplies the evidence, because a
// client-supplied snapshot could be fabricated.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client'

/** What can be reported. Matches the target_kind CHECK in the migration. */
export type ReportTarget = 'message' | 'memory' | 'profile' | 'household' | 'ai_reply'

/** Reason codes, matching the reason CHECK in the migration. */
export type ReportReason =
  | 'csam' | 'ncii' | 'harassment' | 'threats' | 'hate'
  | 'self_harm' | 'illegal' | 'privacy' | 'impersonation'
  | 'spam' | 'other'

/**
 * The list shown in the report sheet, in the order it is shown.
 *
 * Ordered by severity rather than alphabetically or by likelihood: the two
 * that need immediate action sit at the top where someone in distress will
 * find them without reading the whole list. Each label is written as the
 * reporter would describe it, not as the policy names it — a person reporting
 * an ex does not think "non-consensual intimate imagery".
 *
 * Every entry corresponds to a bullet in /terms §4, so the categories someone
 * reports under are the same ones the rules are written in.
 */
export const REPORT_REASONS: { code: ReportReason; label: string }[] = [
  { code: 'csam',          label: 'Sexual content involving a minor' },
  { code: 'ncii',          label: 'An intimate photo shared without consent' },
  { code: 'threats',       label: 'Threats or intimidation' },
  { code: 'harassment',    label: 'Harassment or bullying' },
  { code: 'self_harm',     label: 'Encouraging self-harm' },
  { code: 'hate',          label: 'Hate speech' },
  { code: 'privacy',       label: "Someone's private information" },
  { code: 'impersonation', label: 'Pretending to be someone else' },
  { code: 'illegal',       label: 'Something illegal' },
  { code: 'spam',          label: 'Spam or a scam' },
  { code: 'other',         label: 'Something else' },
]

/** Reasons we tell the reporter to contact emergency services about too. */
export const URGENT_REASONS: ReportReason[] = ['csam', 'ncii', 'threats', 'self_harm']

export type ReportOutcome =
  | { ok: true }
  | { ok: false; message: string }

/**
 * File a report. The server reads the target row itself and stores a copy, so
 * the report survives the content being deleted afterwards — which people can
 * now do to their own messages.
 */
export async function reportContent(args: {
  target: ReportTarget
  targetId: string
  reason: ReportReason
  detail?: string
}): Promise<ReportOutcome> {
  const supabase = createClient()
  const { error } = await supabase.rpc('report_content', {
    p_target_kind: args.target,
    p_target_id:   args.targetId,
    p_reason:      args.reason,
    p_detail:      args.detail?.trim() || null,
  })

  if (!error) return { ok: true }

  // 'not_visible' means the row is gone or was never in this household. Both
  // read the same to the caller by design — the RPC will not confirm whether
  // a guessed id exists elsewhere.
  if (error.message?.includes('not_visible')) {
    return { ok: false, message: 'That is no longer here — it may have been deleted.' }
  }
  return { ok: false, message: "Couldn't send that report. Check your connection and try again." }
}

/**
 * Block someone. In a two-person household this ends the shared home: the
 * caller leaves, the invite code rotates, and join_household() will refuse to
 * put these two accounts together again in either direction.
 *
 * The caller is the one who leaves. Ejecting the other person instead would
 * let either member evict the other from a shared history and keep it, which
 * turns a safety control into a weapon.
 */
export async function blockUser(blockedId: string): Promise<ReportOutcome> {
  const supabase = createClient()
  const { error } = await supabase.rpc('block_user', { p_blocked_id: blockedId })

  if (!error) return { ok: true }
  if (error.message?.includes('not_visible')) {
    return { ok: false, message: 'That person is not in your home.' }
  }
  return { ok: false, message: "Couldn't block just now. Try again in a moment." }
}
