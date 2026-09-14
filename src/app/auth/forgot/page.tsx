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
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import ErenHero from '@/components/onboarding/ErenHero'
import { PixelButton, PixelInput, PixelError, PixelLink } from '@/components/onboarding/pixelForm'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  usePageReady(true)

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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
      setError('Too many tries. Wait a minute, then ask again.')
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
      setError('Something went wrong on our end. Try again in a minute.')
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
    <OnboardingShell stage={null}>
      <div style={{ marginBottom: 18 }}>
        <ErenHero
          size={124}
          titleSize={20}
          tagline={
            <p style={{ fontSize: 12, lineHeight: 1.6, color: '#C9B8E8', margin: 0 }}>
              {sent
                ? 'Check your email. He waited this long, he can wait a bit more.'
                : 'Forgot it? Happens. Tell us where to send the link.'}
            </p>
          }
        />
      </div>

      {sent ? (
        <div className="flex flex-col" style={{ gap: 16 }}>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: '#C9B8E8', margin: 0, textAlign: 'center' }}>
            If that address has an account, a reset link is on its way. The link
            expires, so use it soon — and check spam before asking again.
          </p>
          <PixelButton variant="gold" type="button" onClick={() => { setSent(false); setEmail('') }}>
            SEND ANOTHER
          </PixelButton>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex flex-col" style={{ gap: 16 }}>
          <PixelInput
            label="EMAIL"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          {error && <PixelError>{error}</PixelError>}

          <PixelButton variant="gold" type="submit" disabled={loading || !email.trim()}>
            {loading ? '...' : 'SEND RESET LINK'}
          </PixelButton>
        </form>
      )}

      <div className="flex flex-col items-center" style={{ gap: 14, marginTop: 20 }}>
        <PixelLink href="/auth/login">← BACK TO LOG IN</PixelLink>
      </div>
    </OnboardingShell>
  )
}
