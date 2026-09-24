// ─── Cat identity ────────────────────────────────────────────────────────────
// Every household raises ONE cat, and since the Meadow redesign it is their
// cat: a name, boy or girl, and a look (any fur per part, a pattern, eyes, a
// nose). It lives on the household's eren_stats row (see
// supabase/migration_cat_identity.sql) because that row is already loaded on
// every screen and realtime-synced to both phones, so a rename on one phone
// lands on the other without a reload.
//
// Until the owner pastes the migration the three columns do not exist. Every
// reader therefore goes through catIdentityFromStats(), which falls back to the
// classic cat (Eren, a boy, the original art), and every writer goes through
// saveCatIdentity(), which reports "not migrated" instead of throwing so an
// onboarding or settings flow can log it and carry on.
//
// The look is data the partner's phone writes into a jsonb column: treat it as
// untrusted. parseCatLook() accepts only known keys and rebuilds the object.

import { createClient } from '@/lib/supabase/client'
import { lookKey, type RecolourSpec } from '@/lib/catRecolour'
import { writeWithRetry } from '@/lib/supabaseRetry'
import type { ErenStats } from '@/types'

// ─── Vocabulary (mirrors public/cat/eren_material.json) ─────────────────────

export type CatSex = 'male' | 'female'

/** The seven colourable parts, in the material map's order. */
export const CAT_PARTS = ['body', 'ears', 'tail', 'face', 'bib', 'legs', 'socks'] as const
export type CatPart = typeof CAT_PARTS[number]

export type FurKey =
  | 'black' | 'charcoal' | 'smoke' | 'grey' | 'bluegrey' | 'silver' | 'white'
  | 'lilac' | 'fawn' | 'cream' | 'chocolate' | 'cinnamon' | 'brown' | 'caramel'
  | 'marmalade' | 'ginger' | 'apricot' | 'yellow'
export type CatPattern = 'tabby' | 'tortie'
export type EyeKey = 'blue' | 'green' | 'gold' | 'copper'
export type NoseKey = 'pink' | 'brick' | 'slate'

export interface CatLook {
  /** The coat the look was built from, or null when it was painted from scratch.
   *  Fine-tuning keeps the key; coatLabel() notices the look has drifted. */
  preset: CoatKey | null
  parts: Record<CatPart, FurKey>
  pattern: CatPattern | null
  eyes: EyeKey
  nose: NoseKey
}

// Swatch colours are the flat faces the builder shows (the O3 board); the
// recolour itself uses the dark->light ramps in the material json.
export const FUR_COLOURS: ReadonlyArray<{ key: FurKey; label: string; swatch: string }> = [
  { key: 'black',     label: 'Black',      swatch: '#1B1A1D' },
  { key: 'charcoal',  label: 'Charcoal',   swatch: '#4E4B4B' },
  { key: 'smoke',     label: 'Smoke',      swatch: '#5C585E' },
  { key: 'grey',      label: 'Grey',       swatch: '#8A9096' },
  { key: 'bluegrey',  label: 'Blue grey',  swatch: '#6E7C8A' },
  { key: 'silver',    label: 'Silver',     swatch: '#C9CCD0' },
  { key: 'white',     label: 'White',      swatch: '#F2F3F5' },
  { key: 'lilac',     label: 'Lilac',      swatch: '#B7A5A8' },
  { key: 'fawn',      label: 'Fawn',       swatch: '#C9AE92' },
  { key: 'cream',     label: 'Cream',      swatch: '#E6DCCB' },
  { key: 'chocolate', label: 'Chocolate',  swatch: '#7A4B33' },
  { key: 'cinnamon',  label: 'Cinnamon',   swatch: '#9C5B3A' },
  { key: 'brown',     label: 'Brown',      swatch: '#6E4A2E' },
  { key: 'caramel',   label: 'Caramel',    swatch: '#C9914F' },
  { key: 'marmalade', label: 'Marmalade',  swatch: '#D9772E' },
  { key: 'ginger',    label: 'Ginger',     swatch: '#E0934A' },
  { key: 'apricot',   label: 'Apricot',    swatch: '#E9B48A' },
  { key: 'yellow',    label: 'Yellow',     swatch: '#E3C170' },
]

export const EYE_COLOURS: ReadonlyArray<{ key: EyeKey; label: string; swatch: string }> = [
  { key: 'blue',   label: 'Blue',   swatch: '#5894BE' },
  { key: 'green',  label: 'Green',  swatch: '#74BA7E' },
  { key: 'gold',   label: 'Gold',   swatch: '#E8AE31' },
  { key: 'copper', label: 'Copper', swatch: '#C4702C' },
]

export const NOSE_COLOURS: ReadonlyArray<{ key: NoseKey; label: string; swatch: string }> = [
  { key: 'pink',  label: 'Pink',  swatch: '#E697C0' },
  { key: 'brick', label: 'Brick', swatch: '#DE8C72' },
  { key: 'slate', label: 'Slate', swatch: '#8E8E99' },
]

export const PART_LABELS: Record<CatPart, string> = {
  body: 'Body', ears: 'Ears', tail: 'Tail', face: 'Face', bib: 'Chest', legs: 'Legs', socks: 'Paws',
}

export const PATTERN_LABELS: Record<'none' | CatPattern, string> = {
  none: 'None', tabby: 'Tabby', tortie: 'Tortoiseshell',
}

// ─── The 17 coats ────────────────────────────────────────────────────────────
// Specs are the material json's presets; the order and the friendly names are
// the ones the owner approved on the Build-your-cat board.

export type CoatKey =
  | 'eren' | 'tuxedo' | 'orangewh' | 'gingertab' | 'black' | 'white' | 'blacktail'
  | 'greytab' | 'silvertab' | 'siamese' | 'calico' | 'tortie' | 'tuxcinn'
  | 'bluecream' | 'smoketab' | 'browntab' | 'yellow'

export interface CoatPreset {
  key: CoatKey
  label: string
  look: CatLook
}

const allParts = (fur: FurKey): Record<CatPart, FurKey> =>
  ({ body: fur, ears: fur, tail: fur, face: fur, bib: fur, legs: fur, socks: fur })

function coat(
  key: CoatKey, label: string, parts: Record<CatPart, FurKey>,
  pattern: CatPattern | null, eyes: EyeKey, nose: NoseKey = 'pink',
): CoatPreset {
  return { key, label, look: { preset: key, parts, pattern, eyes, nose } }
}

export const PRESETS: readonly CoatPreset[] = [
  coat('eren',      'Eren Classic',
    { body: 'cream', ears: 'cream', tail: 'cream', face: 'white', bib: 'white', legs: 'white', socks: 'white' }, null, 'blue'),
  coat('tuxedo',    'Tuxedo',
    { body: 'black', ears: 'black', tail: 'black', face: 'white', bib: 'white', legs: 'white', socks: 'white' }, null, 'gold'),
  coat('orangewh',  'Ginger & White',
    { body: 'marmalade', ears: 'marmalade', tail: 'marmalade', face: 'white', bib: 'white', legs: 'white', socks: 'white' }, 'tabby', 'green'),
  coat('gingertab', 'Ginger Tabby', allParts('ginger'), 'tabby', 'gold'),
  coat('black',     'All Black', allParts('black'), null, 'gold'),
  coat('white',     'All White', allParts('white'), null, 'blue'),
  coat('blacktail', 'Black with White Tail',
    { body: 'black', ears: 'black', tail: 'white', face: 'black', bib: 'black', legs: 'black', socks: 'white' }, null, 'gold'),
  coat('greytab',   'Grey Tabby', allParts('grey'), 'tabby', 'green'),
  coat('silvertab', 'Silver Tabby', allParts('silver'), 'tabby', 'green'),
  coat('siamese',   'Siamese',
    { body: 'cream', ears: 'chocolate', tail: 'chocolate', face: 'chocolate', bib: 'cream', legs: 'cream', socks: 'chocolate' }, null, 'blue'),
  coat('calico',    'Calico',
    { body: 'black', ears: 'black', tail: 'ginger', face: 'white', bib: 'white', legs: 'white', socks: 'white' }, 'tortie', 'gold'),
  coat('tortie',    'Tortoiseshell', allParts('black'), 'tortie', 'copper'),
  coat('tuxcinn',   'Cinnamon Tuxedo',
    { body: 'cinnamon', ears: 'cinnamon', tail: 'cinnamon', face: 'white', bib: 'white', legs: 'white', socks: 'white' }, null, 'copper'),
  coat('bluecream', 'Blue & Cream',
    { body: 'bluegrey', ears: 'bluegrey', tail: 'bluegrey', face: 'cream', bib: 'cream', legs: 'cream', socks: 'bluegrey' }, null, 'gold'),
  coat('smoketab',  'Smoke Tabby', allParts('smoke'), 'tabby', 'copper'),
  coat('browntab',  'Brown Tabby',
    { body: 'brown', ears: 'brown', tail: 'brown', face: 'white', bib: 'white', legs: 'brown', socks: 'white' }, 'tabby', 'green'),
  coat('yellow',    'Butter Yellow', allParts('yellow'), null, 'green'),
]

const PRESET_BY_KEY = new Map<CoatKey, CoatPreset>(PRESETS.map(p => [p.key, p]))

export function presetByKey(key: CoatKey): CoatPreset | undefined {
  return PRESET_BY_KEY.get(key)
}

/** A fresh copy of a coat's look, safe to edit. */
export function presetLook(key: CoatKey): CatLook {
  const p = PRESET_BY_KEY.get(key) ?? PRESETS[0]
  return { ...p.look, parts: { ...p.look.parts } }
}

/** The coat the onboarding builder starts on (the Build board's default). */
export const DEFAULT_COAT: CoatKey = 'tuxedo'

// A look that paints exactly classic Eren's colours IS the classic cat, and
// the classic cat is best drawn from its own art (exact, already cached, no
// decode). The "Eren Classic" recolour is not a stand-in for it: its ears and
// tail come out far paler than the painting's. Keyed on colours alone, like
// the sprite cache, so a fine-tuned look that lands back on these colours
// counts too.
const CLASSIC_KEY = lookKey(presetLook('eren'))

/**
 * Whether a look should be drawn as the classic art rather than recoloured:
 * no look at all, or one whose colours are the classic's. Every surface that
 * shows the household's cat asks this one question, so Home and the
 * portraits can't disagree about which cat that is.
 */
export function isClassicLook(look: RecolourSpec | null | undefined): boolean {
  return !look || lookKey(look) === CLASSIC_KEY
}

function sameLook(a: CatLook, b: CatLook): boolean {
  return a.pattern === b.pattern && a.eyes === b.eyes && a.nose === b.nose
    && CAT_PARTS.every(part => a.parts[part] === b.parts[part])
}

/**
 * What to call a look in the UI: the coat's friendly name, or "Custom coat"
 * once fine-tuning has moved it off its preset. null (no look saved) is the
 * classic art, which is the Eren Classic coat.
 */
export function coatLabel(look: CatLook | null): string {
  if (!look) return PRESETS[0].label
  const base = look.preset ? PRESET_BY_KEY.get(look.preset) : undefined
  if (base && sameLook(base.look, look)) return base.label
  const match = PRESETS.find(p => sameLook(p.look, look))
  return match ? match.label : 'Custom coat'
}

// ─── Name ────────────────────────────────────────────────────────────────────

export const DEFAULT_CAT_NAME = 'Eren'
export const DEFAULT_CAT_SEX: CatSex = 'male'
/** Matches the check in migration_cat_identity.sql. Counted in characters. */
export const CAT_NAME_MAX = 24

export const NAME_SUGGESTIONS: readonly string[] = [
  'Mochi', 'Luna', 'Miso', 'Pixel', 'Biscuit', 'Tofu',
  'Pumpkin', 'Nori', 'Olive', 'Bean', 'Clementine', 'Oreo',
]

export type NameCheck = { ok: true; name: string } | { ok: false; error: string }

/**
 * Clean a typed name and say whether it can be saved. Whitespace runs collapse
 * to one space and the ends are trimmed, so " Mochi  Bun " saves as
 * "Mochi Bun". Control characters are dropped (a pasted newline would break
 * every sentence the name is spliced into).
 */
export function validateCatName(raw: string): NameCheck {
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, error: 'Your cat needs a name.' }
  if (Array.from(name).length > CAT_NAME_MAX) {
    return { ok: false, error: `Keep it to ${CAT_NAME_MAX} letters or fewer.` }
  }
  return { ok: true, name }
}

// ─── Pronouns ────────────────────────────────────────────────────────────────

export interface CatPronouns {
  he: string
  him: string
  his: string
  He: string
  His: string
}

export function catPronouns(sex: CatSex): CatPronouns {
  return sex === 'female'
    ? { he: 'she', him: 'her', his: 'her', He: 'She', His: 'Her' }
    : { he: 'he', him: 'him', his: 'his', He: 'He', His: 'His' }
}

export const SEX_LABELS: Record<CatSex, string> = { male: 'Boy', female: 'Girl' }

// ─── Reading ─────────────────────────────────────────────────────────────────

const FUR_KEYS = new Set<string>(FUR_COLOURS.map(f => f.key))
const EYE_KEYS = new Set<string>(EYE_COLOURS.map(e => e.key))
const NOSE_KEYS = new Set<string>(NOSE_COLOURS.map(n => n.key))

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * A stored look, validated. Anything malformed (an unknown fur, a missing part,
 * a string where an object belongs) yields null, which every screen draws as
 * the classic cat rather than half-recoloured.
 */
export function parseCatLook(raw: unknown): CatLook | null {
  if (!isRecord(raw) || !isRecord(raw.parts)) return null
  const rawParts = raw.parts
  const parts = {} as Record<CatPart, FurKey>
  for (const part of CAT_PARTS) {
    const fur = rawParts[part]
    if (typeof fur !== 'string' || !FUR_KEYS.has(fur)) return null
    parts[part] = fur as FurKey
  }
  const pattern = raw.pattern === 'tabby' || raw.pattern === 'tortie' ? raw.pattern : null
  if (typeof raw.eyes !== 'string' || !EYE_KEYS.has(raw.eyes)) return null
  if (typeof raw.nose !== 'string' || !NOSE_KEYS.has(raw.nose)) return null
  const preset = typeof raw.preset === 'string' && PRESET_BY_KEY.has(raw.preset as CoatKey)
    ? raw.preset as CoatKey
    : null
  return { preset, parts, pattern, eyes: raw.eyes as EyeKey, nose: raw.nose as NoseKey }
}

export interface CatIdentity {
  name: string
  sex: CatSex
  /** null = the classic Eren art (no recolour). */
  look: CatLook | null
}

/**
 * The household's cat as the UI should show it. Defaults cover both a row
 * that has not loaded yet and a database the migration has not reached.
 */
export function catIdentityFromStats(stats: Pick<ErenStats, 'cat_name' | 'cat_sex' | 'cat_look'> | null | undefined): CatIdentity {
  const named = stats?.cat_name ? validateCatName(stats.cat_name) : null
  return {
    name: named?.ok ? named.name : DEFAULT_CAT_NAME,
    sex: stats?.cat_sex === 'female' ? 'female' : DEFAULT_CAT_SEX,
    look: parseCatLook(stats?.cat_look),
  }
}

// ─── Writing ─────────────────────────────────────────────────────────────────

export type SaveCatResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'not-migrated' | 'failed'; message: string }

// PostgREST answers PGRST204 when an update names a column its schema cache
// doesn't have; Postgres itself says 42703. Either one means the migration
// hasn't been pasted yet, which is a setup gap, not a failed save.
function isMissingColumn(err: { code?: string; message?: string }): boolean {
  const msg = err.message ?? ''
  return err.code === 'PGRST204' || err.code === '42703'
    || (/cat_(name|sex|look)/.test(msg) && /column/i.test(msg))
}

/**
 * Save any of name / sex / look for a household. Values are validated first;
 * the write sets absolute values, so it is safe to retry. The realtime echo
 * carries the change to both phones (useErenStats merges these three columns).
 *
 * Never throws. Callers decide what a failure means for their flow: onboarding
 * logs 'not-migrated' and moves on, Settings shows the message.
 */
export async function saveCatIdentity(
  householdId: string,
  partial: { name?: string; sex?: CatSex; look?: CatLook | null },
): Promise<SaveCatResult> {
  const row: { cat_name?: string; cat_sex?: CatSex; cat_look?: CatLook | null } = {}
  if (partial.name !== undefined) {
    const check = validateCatName(partial.name)
    if (!check.ok) return { ok: false, reason: 'invalid', message: check.error }
    row.cat_name = check.name
  }
  if (partial.sex !== undefined) {
    if (partial.sex !== 'male' && partial.sex !== 'female') {
      return { ok: false, reason: 'invalid', message: 'Pick boy or girl.' }
    }
    row.cat_sex = partial.sex
  }
  if (partial.look !== undefined) {
    // Round-trip through the parser so only known keys ever reach the column.
    const look = partial.look === null ? null : parseCatLook(partial.look)
    if (partial.look !== null && !look) {
      return { ok: false, reason: 'invalid', message: 'That look could not be saved.' }
    }
    row.cat_look = look
  }
  if (Object.keys(row).length === 0) return { ok: true }

  const supabase = createClient()
  // A missing column is permanent until the migration is pasted, so it is not
  // retried: retrying it only held the Save button for ~3s of backoff before
  // reporting the same answer.
  const { error } = await writeWithRetry(
    signal => supabase.from('eren_stats').update(row).eq('household_id', householdId).abortSignal(signal),
    2,
    err => !isMissingColumn(err),
  )
  if (!error) return { ok: true }
  if (isMissingColumn(error)) {
    console.warn('[catIdentity] cat columns missing: paste supabase/migration_cat_identity.sql', error.message)
    return { ok: false, reason: 'not-migrated', message: 'Not saved yet: the app needs one more update first.' }
  }
  console.warn('[catIdentity] save failed', error.message)
  return { ok: false, reason: 'failed', message: 'Could not save. Check your connection and try again.' }
}
