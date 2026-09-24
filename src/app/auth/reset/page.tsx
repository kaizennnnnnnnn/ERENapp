'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /auth/reset — set a new password.
//
// You only arrive here via /auth/callback, which has already traded the emailed
// PKCE code for a real session. So "is there a session" IS the check that the
// link was genuine and hasn't expired — there is nothing else to validate, and
// without that check this page would show a form whose only outcome is failure.
//
// Sits outside the (app) route group, so the client-side auth gate in
// (app)/layout.tsx never sees it. Middleware is a no-op, so nothing redirects a
// freshly-recovered session away before the password is actually changed.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePageReady } from '@/hooks/usePageReady'
import { PrimaryButton } from '@/components/meadow'
import OnbScreen, { ErrorLine, ImplicitSubmit, Note } from '@/components/onboarding/OnbScreen'
import OnbStage, { SideBubble } from '@/components/onboarding/OnbStage'
import { PasswordField } from '@/components/onboarding/PasswordField'

/** Matches the minimum the signup step enforces. Demanding more here than the
 *  account needed in the first place is just a second, contradictory rule. */
const MIN_PASSWORD = 6

export default function ResetPasswordPage() {
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ field: 'password' | 'confirm' | 'form'; message: string } | null>(null)

  usePageReady(!checking)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setHasSession(!!data.session)
      setChecking(false)
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReset() {
    if (loading) return
    if (password.length < MIN_PASSWORD) {
      setError({ field: 'password', message: `Use at least ${MIN_PASSWORD} characters.` })
      return
    }
    if (password !== confirm) {
      setError({ field: 'confirm', message: 'Those two do not match.' })
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError({ field: 'form', message: error.message })
      setLoading(false)
      return
    }

    // End every OTHER session for this account. A password change that leaves
    // existing sessions signed in does not actually take access away from
    // anyone, and in a two-person app the commonest reason to reset is that
    // someone else has it — a shared device, an ex-partner still signed in on
    // their phone. `scope: 'others'` keeps the session we just refreshed here.
    //
    // Best-effort: the password is already changed, so failing this must not
    // strand the user on a form that looks like it did not work.
    try { await supabase.auth.signOut({ scope: 'others' }) } catch { /* not fatal */ }

    // Full navigation, not router.push — the same reason the login page does
    // it: the refreshed auth cookie has to be written before the gated layout
    // reads it.
    window.location.href = '/home'
  }

  const expired = !checking && !hasSession
  const title = checking ? 'One moment' : hasSession ? 'Pick a new password' : 'That link has expired'

  return (
    <OnbScreen
      backHref="/auth/login"
      backLabel="Back to log in"
      title={title}
      footer={checking ? undefined : expired ? (
        <PrimaryButton href="/auth/forgot">Ask for a new link</PrimaryButton>
      ) : (
        <PrimaryButton onClick={() => void handleReset()} busy={loading}>
          {loading ? 'Saving...' : 'Set password'}
        </PrimaryButton>
      )}
    >
      <OnbStage kind="partner" look={null} alt="Eren">
        {!checking && (
          <SideBubble left={190} top={52} maxWidth={144}>
            {hasSession ? "Pick a new one. I won't tell." : 'That link is no longer any good.'}
          </SideBubble>
        )}
      </OnbStage>
      {expired && (
        <Note style={{ margin: '22px 24px 0', fontSize: 15, lineHeight: 1.45 }}>
          Reset links expire, and each one only works once. Ask for a fresh one and it will land in a moment.
        </Note>
      )}
      {!checking && hasSession && (
        <form
          onSubmit={e => { e.preventDefault(); void handleReset() }}
          style={{ margin: '22px 20px 0', display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <PasswordField
            label="New password"
            autoComplete="new-password"
            enterKeyHint="next"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null) }}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            error={error?.field === 'password' ? error.message : null}
          />
          <PasswordField
            label="Again"
            autoComplete="new-password"
            enterKeyHint="go"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(null) }}
            placeholder="The same one"
            error={error?.field === 'confirm' ? error.message : null}
          />
          {error?.field === 'form' && <ErrorLine style={{ margin: '0 4px' }}>{error.message}</ErrorLine>}
          <ImplicitSubmit />
        </form>
      )}
    </OnbScreen>
  )
}
