// ─── Cat words ───────────────────────────────────────────────────────────────
// The household's cat as SENTENCES need it: a name and boy-or-girl pronouns.
// Pure, with no browser imports, so the push routes and the chat route can use
// the same code as the screens. The look, the builder and saving live in
// lib/catIdentity (which re-exports everything here); screens read the cat
// through hooks/useCat.
//
// Copy about the cat is written ONCE, as a template, and filled per household:
//
//     catText('{name} is hungry! Feed {him} now!', cat)
//       -> 'Luna is hungry! Feed her now!'
//
// Tokens (anything else in braces is left alone, so user text survives):
//     {name} {NAME}                     the name as typed, and in capitals
//     {he} {him} {his} {himself}        he / she, him / her, his / her, himself / herself
//     {He} {Him} {His} {Himself}        the same, capitalised for a sentence start
//     {HE} {HIM} {HIS}                  capitals, for pixel-font labels
// A possessive is the name plus 's ("{name}'s wish"), whatever the name ends in.

import type { SupabaseClient } from '@supabase/supabase-js'

export type CatSex = 'male' | 'female'

export const DEFAULT_CAT_NAME = 'Eren'
export const DEFAULT_CAT_SEX: CatSex = 'male'
/** Matches the check in migration_cat_identity.sql. Counted in characters. */
export const CAT_NAME_MAX = 24

/** Just what a sentence about the cat needs. CatIdentity is one of these. */
export interface CatWords {
  name: string
  sex: CatSex
}

/** The cat every household had before cats had names: every existing row's default. */
export const CLASSIC_CAT_WORDS: CatWords = { name: DEFAULT_CAT_NAME, sex: DEFAULT_CAT_SEX }

// ─── Name ────────────────────────────────────────────────────────────────────

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
  himself: string
  He: string
  Him: string
  His: string
  Himself: string
}

const HE: CatPronouns = { he: 'he', him: 'him', his: 'his', himself: 'himself', He: 'He', Him: 'Him', His: 'His', Himself: 'Himself' }
const SHE: CatPronouns = { he: 'she', him: 'her', his: 'her', himself: 'herself', He: 'She', Him: 'Her', His: 'Her', Himself: 'Herself' }

export function catPronouns(sex: CatSex): CatPronouns {
  return sex === 'female' ? SHE : HE
}

// ─── Filling copy ────────────────────────────────────────────────────────────

const TOKEN = /\{(name|NAME|he|him|his|himself|He|Him|His|Himself|HE|HIM|HIS)\}/g

/** Fill a line written about the cat (see the token table at the top). */
export function catText(template: string, cat: CatWords): string {
  const p = catPronouns(cat.sex)
  return template.replace(TOKEN, (_, key: string) => {
    switch (key) {
      case 'name': return cat.name
      case 'NAME': return cat.name.toUpperCase()
      case 'HE': return p.he.toUpperCase()
      case 'HIM': return p.him.toUpperCase()
      case 'HIS': return p.his.toUpperCase()
      default: return p[key as keyof CatPronouns]
    }
  })
}

/**
 * For text that must keep the literal classic name because it is generated or
 * stored (the skin catalogue's "Fox Eren", "Golden Eren"): swap the whole word
 * Eren (or EREN) for this household's cat. Use catText for anything you write.
 */
export function swapCatName(text: string, cat: CatWords): string {
  if (cat.name === DEFAULT_CAT_NAME) return text
  // Function replacers: a name is typed by a person, and a replacement STRING
  // would read "$&" or "$$" in it as a pattern ("Bo$&" -> "BoEren").
  return text
    .replace(/\bEREN\b/g, () => cat.name.toUpperCase())
    .replace(/\bEren\b/g, () => cat.name)
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/**
 * Name and sex off a raw eren_stats row (or any object carrying the two
 * columns). A row from before the migration, or with a bad value, reads as
 * the classic cat.
 */
export function catWordsFromRow(row: { cat_name?: unknown; cat_sex?: unknown } | null | undefined): CatWords {
  const named = typeof row?.cat_name === 'string' ? validateCatName(row.cat_name) : null
  return {
    name: named?.ok ? named.name : DEFAULT_CAT_NAME,
    sex: row?.cat_sex === 'female' ? 'female' : DEFAULT_CAT_SEX,
  }
}

/**
 * Server side: the household's cat, for push copy and the chat persona. Never
 * throws and never blocks a send. Any failure, including the cat columns not
 * existing yet (the migration unpasted) or the row missing, reads as the
 * classic cat. Select only these two columns: adding cat_name to a query that
 * other work depends on would fail that query too until the migration lands.
 */
export async function fetchCatWords(supabase: SupabaseClient, householdId: string): Promise<CatWords> {
  try {
    const { data, error } = await supabase
      .from('eren_stats')
      .select('cat_name, cat_sex')
      .eq('household_id', householdId)
      .maybeSingle()
    if (error || !data) return CLASSIC_CAT_WORDS
    return catWordsFromRow(data as { cat_name?: unknown; cat_sex?: unknown })
  } catch {
    return CLASSIC_CAT_WORDS
  }
}
