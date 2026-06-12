'use client'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING — the front door. welcome → account → move in (create/join a
// household) → house-key reveal (creators) → meet-Eren slides → rainbow
// clouds into /home. This flow IS registration: it only ever runs for
// accounts that haven't finished moving in, so there's no "seen it" flag —
// fully set-up users get bounced to /home by the resume check.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { usePageReady } from '@/hooks/usePageReady'
import { playSound } from '@/lib/sounds'
import { requestCloudNav } from '@/components/CloudTransition'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import WelcomeStep from '@/components/onboarding/WelcomeStep'
import AccountStep from '@/components/onboarding/AccountStep'
import HouseholdStep, { CodeReveal } from '@/components/onboarding/HouseholdStep'
import IntroSlides from '@/components/onboarding/IntroSlides'
import { PixelButton, PixelError } from '@/components/onboarding/pixelForm'

type Step = 'resolving' | 'welcome' | 'account' | 'household' | 'code' | 'slides'

// Written once create/join succeeds, cleared at launch — lets a mid-slides
// refresh resume at the slides instead of bouncing to /home half-introduced.
const PENDING_KEY = 'eren_onboarding_pending'

const STAGE: Record<Step, number | null> = {
  resolving: null, welcome: null, account: 0, household: 1, code: 1, slides: 2,
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('resolving')
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [resumed, setResumed] = useState(false)
  const [demo, setDemo] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  usePageReady(step !== 'resolving' || loadError)

  const go = useCallback((next: Step) => {
    playSound('ui_select')
    setStep(next)
  }, [])

  // Resume: figure out where in the flow this visitor belongs.
  useEffect(() => {
    let cancelled = false
    async function resolve() {
      // Demo / preview mode: ?demo=1 (or ?demo=welcome) walks the whole flow
      // with fake ids and writes NOTHING to the database — so an already
      // moved-in user can experience onboarding without being bounced to
      // /home. Steps short-circuit their Supabase calls when `demo` is set.
      // Any other value (account/household/code/slides) jumps to that step.
      const demoParam = new URLSearchParams(window.location.search).get('demo')
      if (demoParam) {
        const STEPS: Step[] = ['welcome', 'account', 'household', 'code', 'slides']
        const start: Step = STEPS.includes(demoParam as Step) ? demoParam as Step : 'welcome'
        setDemo(true)
        setUserId('demo-user')
        setUserName('ALEX')
        setUserEmail('demo@example.com')
        setHouseholdId('demo-household')
        if (start === 'code' || start === 'slides') setInviteCode('CAT4EVER')
        setStep(start)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setStep('welcome')
        return
      }

      const { data: prof, error } = await withRetry(() => supabase
        .from('profiles')
        .select('household_id, name')
        .eq('id', user.id)
        .maybeSingle())
      if (cancelled) return
      if (error) {
        // Transient outage — never assume "no household" on a failed read.
        setLoadError(true)
        return
      }

      setUserId(user.id)
      setUserEmail(user.email ?? null)
      setUserName(prof?.name ?? user.email?.split('@')[0] ?? '')

      if (!prof?.household_id) {
        // Signed up but never moved in (refresh mid-flow, or sent here by
        // home's no-household redirect).
        setResumed(true)
        setStep('household')
      } else if (localStorage.getItem(PENDING_KEY) === '1') {
        setHouseholdId(prof.household_id)
        setStep('slides')
      } else {
        router.replace('/home')
      }
    }
    setLoadError(false)
    resolve()
    return () => { cancelled = true }
  }, [retryNonce]) // eslint-disable-line react-hooks/exhaustive-deps

  function launch() {
    localStorage.removeItem(PENDING_KEY)
    requestCloudNav('/home', 'rainbow')
  }

  if (loadError) {
    return (
      <OnboardingShell stage={null}>
        <div className="flex flex-col items-center text-center" style={{ gap: 16 }}>
          <PixelError>Eren couldn&apos;t reach the cloud. Check your connection?</PixelError>
          <PixelButton variant="gold" onClick={() => setRetryNonce(n => n + 1)}>RETRY</PixelButton>
        </div>
      </OnboardingShell>
    )
  }

  if (step === 'resolving') {
    // SplashScreen is still covering us (usePageReady hasn't fired) — keep
    // the backdrop consistent for the brief gap on slow networks.
    return <OnboardingShell stage={null} panel={false}><div /></OnboardingShell>
  }

  return (
    <OnboardingShell stage={STAGE[step]} panel={step !== 'welcome'}>
      <div key={step} style={{ animation: 'onbPop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
        {step === 'welcome' && (
          <WelcomeStep onStart={() => go('account')} />
        )}
        {step === 'account' && (
          <AccountStep demo={demo} onDone={({ userId: id, name, email }) => {
            setUserId(id)
            setUserName(name)
            setUserEmail(email)
            go('household')
          }} />
        )}
        {step === 'household' && userId && (
          <HouseholdStep
            userId={userId}
            userName={userName}
            userEmail={userEmail}
            resumed={resumed}
            demo={demo}
            onCreated={({ householdId: hh, inviteCode: code }) => {
              localStorage.setItem(PENDING_KEY, '1')
              setHouseholdId(hh)
              setInviteCode(code)
              playSound('quest_complete')
              setStep('code')
            }}
            onJoined={({ householdId: hh }) => {
              localStorage.setItem(PENDING_KEY, '1')
              setHouseholdId(hh)
              go('slides')
            }}
          />
        )}
        {step === 'code' && inviteCode && (
          <CodeReveal code={inviteCode} onNext={() => go('slides')} />
        )}
        {step === 'slides' && userId && householdId && (
          <IntroSlides
            userId={userId}
            householdId={householdId}
            inviteCode={inviteCode}
            demo={demo}
            onLaunch={launch}
          />
        )}
      </div>
    </OnboardingShell>
  )
}
