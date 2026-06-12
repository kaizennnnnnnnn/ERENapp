'use client'

import { useState } from 'react'
import SketchEren from '@/components/SketchEren'
import { IconEye, IconEyeOff } from '@/components/PixelIcons'
import { signUpAccount } from '@/lib/onboarding'
import { PixelButton, PixelInput, PixelError, PixelLink } from './pixelForm'

export default function AccountStep({
  onDone,
  demo = false,
}: {
  onDone: (v: { userId: string; name: string; email: string }) => void
  demo?: boolean
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // Preview walkthrough — advance without creating a real account.
    if (demo) {
      onDone({ userId: 'demo-user', name: name.trim() || 'Alex', email: email.trim() || 'demo@example.com' })
      return
    }
    if (!name.trim() || !email.trim() || password.length < 6 || loading) {
      if (password.length > 0 && password.length < 6) {
        setError({ code: 'unknown', message: 'Password needs 6+ characters.' })
      }
      return
    }
    setLoading(true)
    setError(null)
    const res = await signUpAccount({ name: name.trim(), email: email.trim(), password })
    setLoading(false)
    if (!res.ok) {
      setError(res)
      return
    }
    onDone({ userId: res.value.userId, name: name.trim(), email: email.trim() })
  }

  return (
    <form onSubmit={submit} className="flex flex-col" style={{ gap: 16 }}>
      <div className="flex items-center" style={{ gap: 12 }}>
        <SketchEren state="point" size={84} transparent noSpeech />
        <h1 className="font-pixel" style={{ fontSize: 12, letterSpacing: 1.5, color: '#F4EDFF', lineHeight: 1.6 }}>
          WHO ARE
          <br />
          YOU?
        </h1>
      </div>

      <PixelInput label="NAME" value={name} onChange={e => setName(e.target.value)}
        placeholder="What Eren should call you" autoComplete="given-name" />
      <PixelInput label="EMAIL" type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com" autoComplete="email" />
      <PixelInput label="PASSWORD" type={showPw ? 'text' : 'password'} value={password}
        onChange={e => setPassword(e.target.value)} placeholder="6+ characters" autoComplete="new-password"
        suffix={
          <button type="button" onClick={() => setShowPw(s => !s)} aria-label="Toggle password visibility"
            style={{ background: 'none', display: 'flex', padding: 4 }}>
            {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        } />

      {error && (
        <PixelError>
          {error.message}
          {error.code === 'duplicate_email' && (
            <span style={{ display: 'block', marginTop: 8 }}>
              <PixelLink href="/auth/login">LOG IN</PixelLink>
            </span>
          )}
        </PixelError>
      )}

      <PixelButton variant="gold" type="submit" disabled={loading}>
        {loading ? '...' : 'CONTINUE'}
      </PixelButton>
    </form>
  )
}
