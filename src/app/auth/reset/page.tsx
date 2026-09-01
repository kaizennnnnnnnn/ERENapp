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

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePageReady } from '@/hooks/usePageReady'
import { IconEye, IconEyeOff } from '@/components/PixelIcons'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import ErenHero from '@/components/onboarding/ErenHero'
import { PixelButton, PixelInput, PixelError, PixelLink } from '@/components/onboarding/pixelForm'

/** Matches the minimum the signup step enforces. Demanding more here than the
 *  account needed in the first place is just a second, contradictory rule. */
const MIN_PASSWORD = 6

export default function ResetPasswordPage() {
  const supabase = createClient()
  usePageReady(true)

  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setHasSession(!!data.session)
      setChecking(false)
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setError(`At least ${MIN_PASSWORD} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Those two do not match.')
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Full navigation, not router.push — the same reason the login page does
    // it: the refreshed auth cookie has to be written before the gated layout
    // reads it.
    window.location.href = '/home'
  }

  const tagline = checking
    ? 'One moment.'
    : hasSession
      ? 'Pick a new one. He will not be told what it is.'
      : 'That link is no longer any good.'

  return (
    <OnboardingShell stage={null}>
      <div style={{ marginBottom: 18 }}>
        <ErenHero
          size={124}
          titleSize={20}
          tagline={
            <p style={{ fontSize: 12, lineHeight: 1.6, color: '#C9B8E8', margin: 0 }}>
              {tagline}
            </p>
          }
        />
      </div>

      {checking ? null : !hasSession ? (
        <div className="flex flex-col" style={{ gap: 16 }}>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: '#C9B8E8', margin: 0, textAlign: 'center' }}>
            Reset links expire, and each one only works once. Ask for a fresh
            one and it will land in a moment.
          </p>
          <PixelLink href="/auth/forgot">ASK FOR A NEW LINK</PixelLink>
        </div>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col" style={{ gap: 16 }}>
          <PixelInput
            label="NEW PASSWORD"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            required
            autoComplete="new-password"
            suffix={
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label="Toggle password visibility"
                style={{ background: 'none', display: 'flex', padding: 4 }}
              >
                {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            }
          />
          <PixelInput
            label="AGAIN"
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="The same one"
            required
            autoComplete="new-password"
          />

          {error && <PixelError>{error}</PixelError>}

          <PixelButton variant="gold" type="submit" disabled={loading}>
            {loading ? '...' : 'SET PASSWORD'}
          </PixelButton>
        </form>
      )}

      <div className="flex flex-col items-center" style={{ gap: 14, marginTop: 20 }}>
        <PixelLink href="/auth/login">← BACK TO LOG IN</PixelLink>
      </div>
    </OnboardingShell>
  )
}
