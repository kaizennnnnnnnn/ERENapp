'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePageReady } from '@/hooks/usePageReady'
import SketchEren from '@/components/SketchEren'
import { pinkText } from '@/components/obsidian'
import { IconEye, IconEyeOff, IconPaw } from '@/components/PixelIcons'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import { PixelButton, PixelInput, PixelError, PixelLink } from '@/components/onboarding/pixelForm'

export default function LoginPage() {
  const supabase = createClient()
  usePageReady(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    console.log('LOGIN RESULT:', JSON.stringify({ error, hasSession: !!data?.session, userId: data?.user?.id }))

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setError('No session — your email may not be confirmed. Run the SQL fix in Supabase.')
      setLoading(false)
      return
    }

    // Small delay so cookie is written before navigation
    await new Promise(r => setTimeout(r, 300))
    window.location.href = '/home'
  }

  return (
    <OnboardingShell stage={null}>
      <div className="flex flex-col items-center text-center" style={{ gap: 6, marginBottom: 18 }}>
        <SketchEren state="wave" size={130} transparent noSpeech />
        <h1 className="font-pixel" style={{ ...pinkText, fontSize: 20, letterSpacing: 3 }}>
          EREN
        </h1>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: '#C9B8E8', margin: 0 }}>
          Welcome back. He noticed you were gone.
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col" style={{ gap: 16 }}>
        <PixelInput label="EMAIL" type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com" required autoComplete="email" />
        <PixelInput label="PASSWORD" type={showPw ? 'text' : 'password'} value={password}
          onChange={e => setPassword(e.target.value)} placeholder="Your password" required
          autoComplete="current-password"
          suffix={
            <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password visibility"
              style={{ background: 'none', display: 'flex', padding: 4 }}>
              {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          } />

        {error && <PixelError>{error}</PixelError>}

        <PixelButton variant="gold" type="submit" disabled={loading}>
          {loading ? '...' : 'LOG IN'}
        </PixelButton>
      </form>

      <div className="flex flex-col items-center" style={{ gap: 14, marginTop: 20 }}>
        <PixelLink href="/onboarding">NEW HERE? → MEET EREN</PixelLink>
        <span className="inline-flex items-center" style={{ gap: 6 }}>
          <IconPaw size={11} />
          <span className="font-pixel" style={{ fontSize: 5.5, letterSpacing: 1, color: '#7A6F96' }}>
            FOR EREN THE RAGDOLL
          </span>
        </span>
      </div>
    </OnboardingShell>
  )
}
