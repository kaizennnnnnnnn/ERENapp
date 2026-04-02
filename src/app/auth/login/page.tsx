'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Cat } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-pink-50 via-purple-50 to-[#FDF6FF]">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#FF6B9D] to-[#A78BFA] flex items-center justify-center shadow-pink">
          <Cat className="w-10 h-10 text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl font-bold text-[#1F1F2E]">Pocket Eren</h1>
        <p className="text-gray-500 text-sm text-center">Welcome back! Eren is waiting for you 🐾</p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-sm card shadow-card">
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="input pr-12"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                onClick={() => setShowPw(v => !v)}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-500">
          New here?{' '}
          <Link href="/auth/register" className="text-[#FF6B9D] font-semibold">
            Create account
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        Made with 💕 for Eren the Ragdoll
      </p>
    </div>
  )
}
