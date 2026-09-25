'use client'

import { useMemo } from 'react'
import { useOptionalErenStats } from '@/hooks/useErenStats'
import { catIdentityFromStats, type CatIdentity } from '@/lib/catIdentity'
import { catPronouns, catText, type CatPronouns } from '@/lib/catWords'

// ─── useCat ──────────────────────────────────────────────────────────────────
// The household's cat for anything on screen that names it or says he / she:
//
//     const cat = useCat()
//     <p>{cat.t('{name} is sleepy. Tuck {him} in?')}</p>
//     aria-label={cat.t('Pet {name}')}
//
// Reads the shared eren_stats row (no fetch of its own), so a rename on the
// partner's phone re-renders every line over realtime. Outside the signed-in
// app, and until the row loads, it is the classic cat: Eren, a boy.

export interface Cat extends CatIdentity {
  /** he / she, him / her, ... (lib/catWords). */
  p: CatPronouns
  /** Fill a template written with lib/catWords tokens: {name}, {he}, {his}, ... */
  t: (template: string) => string
  /** False until the household's row is in: the name shown is still the default. */
  known: boolean
}

export function useCat(): Cat {
  const stats = useOptionalErenStats()?.stats ?? null
  const known = stats !== null
  const name = stats?.cat_name
  const sex = stats?.cat_sex
  const look = stats?.cat_look
  return useMemo(() => {
    const id = catIdentityFromStats(known ? { cat_name: name, cat_sex: sex, cat_look: look } : null)
    return { ...id, p: catPronouns(id.sex), t: (template: string) => catText(template, id), known }
  }, [known, name, sex, look])
}
