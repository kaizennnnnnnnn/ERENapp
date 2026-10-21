// ─── The bucket list ─────────────────────────────────────────────────────────
// The household's plans for later (supabase/migration_bucket_list.sql). Kinds
// here must match the table's CHECK.

import type { MeadowIconName } from '@/components/PixelIcons'
import { TINT } from '@/components/meadow/tokens'

export type PlanKind = 'travel' | 'food' | 'adventure' | 'home' | 'someday'

export interface PlanRow {
  id: string
  household_id: string
  created_by: string | null
  title: string
  kind: PlanKind
  target: string | null
  note: string | null
  done_at: string | null
  done_by: string | null
  created_at: string
}

export interface PlanInput {
  title: string
  kind: PlanKind
  target: string | null
  note: string | null
}

export const TITLE_MAX = 80
export const TARGET_MAX = 40
export const NOTE_MAX = 280

/** In list order: the order the page groups plans in. */
export const KINDS: ReadonlyArray<{ id: PlanKind; label: string; icon: MeadowIconName; tint: string }> = [
  { id: 'travel',    label: 'Travel',    icon: 'plane',    tint: TINT.sky },
  { id: 'food',      label: 'Food',      icon: 'bowl',     tint: TINT.orange },
  { id: 'adventure', label: 'Adventure', icon: 'mountain', tint: TINT.leaf },
  { id: 'home',      label: 'Home',      icon: 'home',     tint: TINT.amber },
  { id: 'someday',   label: 'Someday',   icon: 'star',     tint: TINT.lilac },
]

export function kindMeta(kind: PlanKind) {
  return KINDS.find(k => k.id === kind) ?? KINDS[KINDS.length - 1]
}

/** Trim and bound what the sheet collects; null when there is no title. */
export function cleanPlan(input: PlanInput): PlanInput | null {
  const title = input.title.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX)
  if (!title) return null
  const target = input.target?.replace(/\s+/g, ' ').trim().slice(0, TARGET_MAX) || null
  const note = input.note?.trim().slice(0, NOTE_MAX) || null
  return { title, kind: input.kind, target, note }
}

/** The Hallway frame a ticked-off plan hangs as (the migration's trigger writes it). */
export const BUCKET_FRAME_PREFIX = 'bucket:'

/** "12 Oct 2026". */
export function planDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

/** A plan's title short enough to sit inside one of Eren's lines. */
export function planSnippet(title: string, max = 34): string {
  return title.length <= max ? title : `${title.slice(0, max - 1).trimEnd()}…`
}

// ── "New on the list" badge ──────────────────────────────────────────────────
// Per phone: when this person last opened the list. Plans the partner added
// after that count on home's button.

const seenKey = (userId: string) => `eren_bucket_seen_${userId}`

export function readBucketSeen(userId: string): number {
  try { return Number(localStorage.getItem(seenKey(userId)) ?? 0) || 0 } catch { return 0 }
}

export function markBucketSeen(userId: string): void {
  try { localStorage.setItem(seenKey(userId), String(Date.now())) } catch { /* private mode */ }
}

/** Open plans the partner added since this phone last looked. */
export function newFromPartner(plans: readonly PlanRow[], userId: string, seenAt: number): number {
  return plans.filter(p => p.created_by && p.created_by !== userId && !p.done_at
    && new Date(p.created_at).getTime() > seenAt).length
}
