'use client'

// /auth/login — for people who already have an account. The Welcome
// (/onboarding) is the front door; this is its "Log in" button. Meadow, like
// the rest of onboarding: the classic cat on a short stage, two fields, one
// green button.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePageReady } from '@/hooks/usePageReady'
import { M, PrimaryButton, TextButton, TextField } from '@/components/meadow'
import OnbScreen, { ErrorLine, ImplicitSubmit } from '@/components/onboarding/OnbScreen'
import OnbStage, { SideBubble } from '@/components/onboarding/OnbStage'
import { PasswordField } from '@/components/onboarding/PasswordField'

export default function LoginPage() {
  const supabase = createClient()
  usePageReady(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ field: 'email' | 'password' | 'form'; message: string } | null>(null)

  // /auth/callback sends a link that failed to exchange here with ?error=callback.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'callback') {
      setError({ field: 'form', message: "That link didn't work. It may have expired: log in, or ask for a new one." })
    }
  }, [])

  async function handleLogin() {
    if (loading) return
    const e = email.trim()
    if (!e) { setError({ field: 'email', message: 'Enter your email.' }); return }
    if (!password) { setError({ field: 'password', message: 'Enter your password.' }); return }
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email: e, password })

    if (error) {
      setError({ field: 'form', message: /invalid login credentials/i.test(error.message)
        ? "That email and password don't match. Try again?"
        : error.message })
      setLoading(false)
      return
    }

    if (!data.session) {
      // This used to read "No session — your email may not be confirmed. Run
      // the SQL fix in Supabase." — a note to the developer, shipped to every
      // user who hit it. Signing in without a session means the address is
      // registered but unconfirmed, which is a thing the person reading this
      // can act on, so say that instead.
      console.error('[eren] signInWithPassword returned no session for a valid credential')
      setError({ field: 'form', message: 'Your email address has not been confirmed yet. Check your inbox for the confirmation link.' })
      setLoading(false)
      return
    }

    // Small delay so cookie is written before navigation
    await new Promise(r => setTimeout(r, 300))
    window.location.href = '/home'
  }

  return (
    <OnbScreen
      backHref="/onboarding"
      backLabel="Back to the welcome"
      title="Welcome back"
      footer={(
        <>
          <TextButton tone="muted" href="/onboarding" style={{ height: 44 }}>New here? Adopt your cat</TextButton>
          <PrimaryButton onClick={() => void handleLogin()} busy={loading} style={{ marginTop: 8 }}>
            {loading ? 'Logging in...' : 'Log in'}
          </PrimaryButton>
        </>
      )}
    >
      <form
        onSubmit={e => { e.preventDefault(); void handleLogin() }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <OnbStage kind="partner" look={null} alt="Eren, waiting for you">
          <SideBubble left={190} top={52} maxWidth={144}>There you are. I missed you.</SideBubble>
        </OnbStage>
        <div style={{ margin: '22px 20px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="next"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null) }}
            placeholder="you@example.com"
            error={error?.field === 'email' ? error.message : null}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            enterKeyHint="go"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null) }}
            placeholder="Your password"
            error={error?.field === 'password' ? error.message : null}
          />
          {error?.field === 'form' && <ErrorLine style={{ margin: '0 4px' }}>{error.message}</ErrorLine>}
        </div>
        <TextButton href="/auth/forgot" style={{ alignSelf: 'flex-start', margin: '6px 16px 0', color: M.leaf }}>
          Forgot your password?
        </TextButton>
        <ImplicitSubmit />
      </form>
    </OnbScreen>
  )
}
