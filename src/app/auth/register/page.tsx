'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Cat, Eye, EyeOff } from 'lucide-react'

type Step = 'account' | 'household'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('account')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [householdMode, setHouseholdMode] = useState<'create' | 'join'>('create')
  const [householdName, setHouseholdName] = useState("Eren's Home")
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccountStep(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !password) return
    setStep('household')
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // 1. Sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Sign up failed')
      setLoading(false)
      return
    }

    const userId = authData.user.id

    // 2. Create or join household
    if (householdMode === 'create') {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()
      const { data: household, error: hhError } = await supabase
        .from('households')
        .insert({ name: householdName, invite_code: code })
        .select()
        .single()

      if (hhError || !household) {
        setError('Could not create household')
        setLoading(false)
        return
      }

      // Link profile to household
      await supabase
        .from('profiles')
        .update({ household_id: household.id, name })
        .eq('id', userId)

      // Seed Eren's stats
      await supabase
        .from('eren_stats')
        .insert({ household_id: household.id })

    } else {
      // Join existing household
      const { data: household, error: findErr } = await supabase
        .from('households')
        .select()
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

      if (findErr || !household) {
        setError('Invite code not found. Ask your partner for the code!')
        setLoading(false)
        return
      }

      await supabase
        .from('profiles')
        .update({ household_id: household.id, name })
        .eq('id', userId)
    }

    window.location.href = '/home'
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-pink-50 via-purple-50 to-[#FDF6FF]">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#FF6B9D] to-[#A78BFA] flex items-center justify-center shadow-pink">
          <Cat className="w-10 h-10 text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl font-bold text-[#1F1F2E]">Join Pocket Eren</h1>
        <p className="text-gray-500 text-sm text-center">
          {step === 'account' ? 'Create your account' : 'Set up your household'}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'account' ? 'bg-[#FF6B9D] text-white' : 'bg-green-400 text-white'}`}>
          {step === 'account' ? '1' : '✓'}
        </div>
        <div className="w-8 h-0.5 bg-gray-200" />
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'household' ? 'bg-[#FF6B9D] text-white' : 'bg-gray-200 text-gray-400'}`}>
          2
        </div>
      </div>

      <div className="w-full max-w-sm card shadow-card">
        {/* ── Step 1: Account ── */}
        {step === 'account' && (
          <form onSubmit={handleAccountStep} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input className="input" placeholder="e.g. Alex" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pr-12"
                  placeholder="min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full mt-2">Continue →</button>
          </form>
        )}

        {/* ── Step 2: Household ── */}
        {step === 'household' && (
          <form onSubmit={handleFinish} className="flex flex-col gap-4">
            {/* Toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${householdMode === 'create' ? 'bg-white shadow-sm text-[#FF6B9D]' : 'text-gray-500'}`}
                onClick={() => setHouseholdMode('create')}
              >
                Create home
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${householdMode === 'join' ? 'bg-white shadow-sm text-[#FF6B9D]' : 'text-gray-500'}`}
                onClick={() => setHouseholdMode('join')}
              >
                Join home
              </button>
            </div>

            {householdMode === 'create' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Home name</label>
                <input className="input" value={householdName} onChange={e => setHouseholdName(e.target.value)} placeholder="e.g. Eren's Home" required />
                <p className="text-xs text-gray-400 mt-1">After creating, share your invite code with your partner</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invite code</label>
                <input className="input uppercase tracking-widest" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="XXXXXXXX" required maxLength={8} />
                <p className="text-xs text-gray-400 mt-1">Ask your partner for the 8-letter code from their Profile page</p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 mt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep('account')}>← Back</button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Let\'s go! 🐾'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-5 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#FF6B9D] font-semibold">Log in</Link>
        </div>
      </div>
    </div>
  )
}
