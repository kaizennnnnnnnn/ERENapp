'use client'

/**
 * Blocks the app until this account has accepted the current terms.
 *
 * The signup checkbox covers people who sign up from now on. This covers the
 * two cases it cannot: accounts that existed before the gate did, and any
 * signup where the acceptance write did not land (no session yet, a 503).
 * Together they are what makes "every user has accepted the content rules"
 * true rather than aspirational — which is the claim Play's UGC policy is
 * actually checking.
 *
 * It is also the mechanism §15 of the terms promises: publish a new version,
 * move TERMS_LAST_UPDATED, and everyone is asked again on next launch.
 */

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

/**
 * The "Last updated" date at the top of src/app/terms/terms.md, as an
 * ISO date. An acceptance older than this is stale and gets re-asked.
 *
 * MOVE THIS whenever the terms change materially — and only then. Bumping it
 * puts a blocking sheet in front of every user on their next launch, so it is
 * a deliberate act, not routine maintenance.
 */
export const TERMS_LAST_UPDATED = '2026-01-01'

export default function TermsGate() {
  const { user, profile, loading } = useAuth()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [done, setDone] = useState(false)

  // Say nothing until we actually know. Flashing a legal demand at someone
  // while their profile is still loading — or during a Supabase wobble, where
  // profile is null but the account is fine — would be worse than being late.
  if (loading || !user || !profile || done) return null

  // Compared as numbers, not as strings. Supabase timestamptz formatting
  // drifts (offset suffix, fractional-second digits) and a lexicographic
  // compare against a bare date has bitten this codebase before.
  const accepted = profile.terms_accepted_at
  const isCurrent = accepted != null &&
    new Date(accepted).getTime() >= new Date(TERMS_LAST_UPDATED).getTime()
  if (isCurrent) return null

  async function accept() {
    if (busy) return
    setBusy(true)
    setFailed(false)
    const { error } = await supabase.rpc('accept_terms')
    if (error) {
      setBusy(false)
      setFailed(true)
      return
    }
    // Dismiss locally rather than waiting for useAuth to refetch — the write
    // succeeded, and leaving the sheet up would read as if it had not.
    setDone(true)
  }

  const returning = accepted != null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5"
         style={{ background: 'rgba(5,5,7,0.9)' }}
         role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
      <div style={{
        maxWidth: 360, width: '100%', padding: 22,
        background: 'linear-gradient(180deg, #17131F 0%, #0B0910 100%)',
        border: '2px solid rgba(167,139,250,0.45)',
        boxShadow: '4px 4px 0 #050507',
        borderRadius: 5,
      }}>
        <p id="terms-gate-title" className="font-pixel"
           style={{ fontSize: 9, letterSpacing: 1, color: '#C4B5FD', marginBottom: 14 }}>
          {returning ? 'THE RULES CHANGED' : 'BEFORE YOU CARRY ON'}
        </p>

        <p style={{ fontSize: 13, lineHeight: 1.65, color: '#C9BFC5', marginBottom: 12 }}>
          {returning
            ? 'We have updated the terms and content rules. Please read them and agree to carry on using Eren.'
            : 'Eren now has published terms and content rules covering what may be posted here. Please read them and agree to carry on.'}
        </p>

        <p style={{ fontSize: 13, lineHeight: 1.65, color: '#C9BFC5', marginBottom: 18 }}>
          Eren is for people aged 18 and over.
        </p>

        <div className="flex flex-col" style={{ gap: 8, marginBottom: 18 }}>
          <a href="/terms"
             style={{ fontSize: 13, color: '#f0a5c0' }}>
            Read the terms and content rules →
          </a>
          <a href="/privacy"
             style={{ fontSize: 13, color: '#f0a5c0' }}>
            Read the privacy policy →
          </a>
        </div>

        {failed && (
          <p style={{ fontSize: 12, color: '#fca5a5', marginBottom: 12 }}>
            Couldn&apos;t save that. Check your connection and try again.
          </p>
        )}

        <button
          onClick={accept}
          disabled={busy}
          className="w-full py-3 active:translate-y-[1px] transition-transform"
          style={{
            background: 'linear-gradient(180deg, #FFE08A 0%, #F5B73B 45%, #C77E16 100%)',
            border: '2px solid #050507',
            boxShadow: '3px 3px 0 #050507, inset 0 1px 0 rgba(255,255,255,0.35)',
            borderRadius: 5,
            opacity: busy ? 0.55 : 1,
          }}>
          <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1, color: '#2A1A05' }}>
            {busy ? 'SAVING…' : 'I AM 18+ AND I AGREE'}
          </span>
        </button>

        {/* No decline button. Declining means not using the app, and the
            honest way to say that is to point at the exits rather than a
            "Decline" that would have to bounce them back here anyway. */}
        <p style={{ fontSize: 11, lineHeight: 1.6, color: '#6A5A65', marginTop: 14 }}>
          If you do not agree, you can{' '}
          <a href="/delete-account" style={{ color: '#8A7A85' }}>delete your account</a>.
        </p>
      </div>
    </div>
  )
}
