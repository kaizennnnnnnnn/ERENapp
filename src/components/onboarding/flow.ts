// ─── Onboarding flow: steps, the draft, the resume marker ────────────────────
// The cat is built BEFORE there is an account, so what the person has chosen
// so far (coat, boy/girl, name, their own name, an invite code) lives in a
// draft in localStorage. A refresh, a trip to the Terms, or an app switch in
// the middle of the flow brings them back to the same screen with the same
// cat. It holds no email and no password.
//
// Storage can be missing or throw (private windows, blocked site data), so
// every access is guarded and the flow works without it; it just forgets.

import {
  DEFAULT_CAT_NAME, parseCatLook, presetLook, DEFAULT_COAT,
  type CatLook, type CatSex,
} from '@/lib/catIdentity'

export type Step =
  | 'welcome' | 'build' | 'tune' | 'sex' | 'name' | 'you' | 'save' | 'email'
  | 'partner' | 'notify' | 'finale' | 'code' | 'meet'

export type Path = 'creator' | 'joiner'

/** Steps that exist before an account does: the only ones a draft can resume at. */
export const PRE_ACCOUNT_STEPS: readonly Step[] = ['build', 'tune', 'sex', 'name', 'you', 'save', 'email', 'code']

/** Steps after the home exists ('partner' is marked as the home is built). A refresh here resumes via PENDING_KEY. */
export type AfterStep = 'partner' | 'notify' | 'finale' | 'meet'
const AFTER_STEPS: readonly AfterStep[] = ['partner', 'notify', 'finale', 'meet']

export interface Draft {
  path: Path
  step: Step
  hist: Step[]
  look: CatLook
  sex: CatSex
  catName: string
  userName: string
  code: string
  /** The cat's identity reached eren_stats (creator). */
  catSaved: boolean
  /** "Just me for now" on the invite screen. */
  solo: boolean
}

export function freshDraft(path: Path = 'creator'): Draft {
  return {
    path,
    step: 'welcome',
    hist: [],
    look: presetLook(DEFAULT_COAT),
    // The Build board's flow starts on Girl; the name box starts filled with
    // the app's own cat's name, selected, so typing replaces it.
    sex: 'female',
    catName: DEFAULT_CAT_NAME,
    userName: '',
    code: '',
    catSaved: false,
    solo: false,
  }
}

const DRAFT_KEY = 'eren_onboarding_draft'
const STEPS: readonly Step[] = [
  'welcome', 'build', 'tune', 'sex', 'name', 'you', 'save', 'email', 'partner', 'notify', 'finale', 'code', 'meet',
]
const isStep = (v: unknown): v is Step => typeof v === 'string' && (STEPS as readonly string[]).includes(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** The saved draft, validated field by field (it is only ever our own JSON, but a stale shape must not crash the flow). */
export function loadDraft(): Draft | null {
  let raw: string | null = null
  try { raw = localStorage.getItem(DRAFT_KEY) } catch { return null }
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Record<string, unknown>
    const base = freshDraft(d.path === 'joiner' ? 'joiner' : 'creator')
    return {
      ...base,
      step: isStep(d.step) ? d.step : 'welcome',
      hist: Array.isArray(d.hist) ? d.hist.filter(isStep).slice(-12) : [],
      look: parseCatLook(d.look) ?? base.look,
      sex: d.sex === 'male' ? 'male' : 'female',
      catName: typeof d.catName === 'string' ? d.catName.slice(0, 40) : base.catName,
      userName: str(d.userName, 40),
      code: str(d.code, 16),
      catSaved: d.catSaved === true,
      solo: d.solo === true,
    }
  } catch {
    return null
  }
}

export function saveDraft(d: Draft): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* storage off: the flow just won't resume */ }
}

export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* nothing to clear */ }
}

// Written just before create_household (its answer can be lost after it
// commits) and once a join succeeds, cleared at launch. Holds the step to
// resume at, so a refresh after the home exists lands on the invite, the
// notification ask or the adoption card instead of bouncing to /home half
// introduced. AppGuard reads it too: the installed app starts at /home, so a
// cold start mid-move-in is sent back here.
//
// Stored as "step:userId" and only read back for that account. Unkeyed, a
// marker one account left behind would pull whoever signs in next on the
// same phone into this flow, and could resume the draft's cat onto their home.
// The old flow stored '1' (its intro slides); that maps to the notification
// ask, the one thing those slides still owed, and never saves a cat.
export const PENDING_KEY = 'eren_onboarding_pending'

export function readPending(userId: string): AfterStep | null {
  let v: string | null = null
  try { v = localStorage.getItem(PENDING_KEY) } catch { return null }
  if (v === '1') return 'notify'
  const [step, owner] = (v ?? '').split(':')
  return owner === userId && (AFTER_STEPS as readonly string[]).includes(step) ? step as AfterStep : null
}

export function writePending(step: AfterStep, userId: string): void {
  try { localStorage.setItem(PENDING_KEY, `${step}:${userId}`) } catch { /* resume just lands on /home */ }
}

export function clearPending(): void {
  try { localStorage.removeItem(PENDING_KEY) } catch { /* nothing to clear */ }
}
