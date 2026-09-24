'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /auth/forgot — ask for a reset link.
//
// There was no way back into an account before this: no reset anywhere in the
// app, so a forgotten password meant a dead account and a support email that
// goes nowhere.
//
// No new server code. The emailed link points at the EXISTING /auth/callback,
// which already exchanges a PKCE code for a session, and rides its `next` param
// to forward on to /auth/reset once that session exists.
// ═════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePageReady } from '@/hooks/usePageReady'
import { PrimaryButton, TextButton, TextField } from '@/components/meadow'
import OnbScreen, { ErrorLine, Note } from '@/components/onboarding/OnbScreen'
import OnbStage, { SideBubble } from '@/components/onboarding/OnbStage'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  usePageReady(true)

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<{ field: 'email' | 'form'; message: string } | null>(null)

  async function handleSend() {
    if (loading) return
    const e = email.trim()
    if (!e) { setError({ field: 'email', message: 'Enter the email you signed up with.' }); return }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    })

    // Log every failure, always. Nothing else in the app records this, and
    // the whole feature can be dead — with no custom SMTP, Supabase's mailer
    // refuses any address that is not on the project team — while this screen
    // reports success to everyone. A silent, total failure that looks like it
    // worked is the worst state for a recovery flow to be in.
    if (error) console.error('[eren] password reset failed:', error)

    // Rate limiting is the one failure worth naming. Left silent, someone sits
    // there re-sending into a wall and concludes the feature is broken.
    if (error && /rate|too many|seconds|limit/i.test(error.message)) {
      setError({ field: 'form', message: 'Too many tries. Wait a minute, then ask again.' })
      setLoading(false)
      return
    }

    // A server-side failure is OURS, not a fact about this address, so saying
    // so leaks nothing and stops someone waiting for mail that was never sent.
    // This is the branch that catches an unconfigured SMTP.
    //
    // Deliberately narrow. Any error that is NOT clearly server-side still
    // falls through to the success screen below, because Supabase's own
    // enumeration protection is what the neutral copy depends on: if it ever
    // did return a per-address error, reporting it here would turn this form
    // into the exact oracle the next comment exists to prevent.
    const status = (error as { status?: number } | null)?.status ?? 0
    if (error && (status >= 500 || /not authoriz|smtp|configur|server/i.test(error.message))) {
      setError({ field: 'form', message: 'Something went wrong on our end. Try again in a minute.' })
      setLoading(false)
      return
    }

    // EVERY other outcome reports the same thing, whether or not that address
    // has an account. Telling a stranger which emails are registered hands
    // anyone with a list a way to enumerate your users.
    setSent(true)
    setLoading(false)
  }

  return (
    <OnbScreen
      backHref="/auth/login"
      backLabel="Back to log in"
      title={sent ? 'Check your email' : 'Forgot your password?'}
      footer={sent ? (
        <>
          <TextButton tone="muted" onClick={() => { setSent(false); setEmail('') }} style={{ height: 44 }}>
            Send another
          </TextButton>
          <PrimaryButton href="/auth/login" style={{ marginTop: 8 }}>Back to log in</PrimaryButton>
        </>
      ) : (
        <PrimaryButton onClick={() => void handleSend()} busy={loading}>
          {loading ? 'Sending...' : 'Send reset link'}
        </PrimaryButton>
      )}
    >
      <OnbStage kind="partner" look={null} alt="Eren">
        <SideBubble left={190} top={52} maxWidth={144}>
          {sent ? 'I waited this long. I can wait a bit more.' : 'Happens to everyone.'}
        </SideBubble>
      </OnbStage>
      {sent ? (
        <Note role="status" style={{ margin: '22px 24px 0', fontSize: 15, lineHeight: 1.45 }}>
          If that address has an account, a reset link is on its way. The link expires, so use it soon, and
          check spam before asking again.
        </Note>
      ) : (
        <form
          onSubmit={e => { e.preventDefault(); void handleSend() }}
          style={{ margin: '22px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Note style={{ margin: '0 4px', fontSize: 15, lineHeight: 1.45 }}>
            Tell us your email and we&apos;ll send a link to pick a new password.
          </Note>
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null) }}
            placeholder="you@example.com"
            error={error?.field === 'email' ? error.message : null}
          />
          {error?.field === 'form' && <ErrorLine style={{ margin: '0 4px' }}>{error.message}</ErrorLine>}
        </form>
      )}
    </OnbScreen>
  )
}
