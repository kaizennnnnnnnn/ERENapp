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

export const dynamic = 'force-dynamic'

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

    // Rate limiting is the one failure worth naming. Left silent, someone sits
    // there re-sending into a wall and concludes the feature is broken.
    if (error && /rate|too many|seconds|limit/i.test(error.message)) {
      setError('Too many tries. Wait a minute, then ask again.')
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
