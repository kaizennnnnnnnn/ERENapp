'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING — the front door, in Meadow (the owner-approved Proto board).
//
//   creator  Welcome -> Build your cat (+ Fine-tune) -> Boy or girl -> Name ->
//            Say hello -> Save -> Your account -> [create_household + the cat's
//            identity] -> Invite your person -> Hear from {cat} -> {cat} is
//            home. -> /home
//   joiner   Welcome -> Enter your code -> Say hello -> Save -> Your account ->
//            [join_household] -> Meet {cat} -> Hear from {cat} -> /home
//
// The cat is built before there is an account, so it lives in a local draft
// (flow.ts) until create_household returns, then goes to eren_stats. This flow
// IS registration: it only ever runs for accounts that haven't finished moving
// in, so there's no "seen it" flag. A signed-in visitor without a home (left
// one, or came back mid-flow) gets the same flow minus the account steps; one
// with a home is bounced to /home unless a refresh caught them mid-way
// (PENDING_KEY), or they opened an invite link, which gets a screen saying
// why it can't open yet.
//
// ?demo=1 (or ?demo=<step>) walks the flow with fake ids and writes NOTHING,
// so a moved-in user can see onboarding without being bounced. ?code=XXXX
// (the invite link) opens the joiner's code screen with the key filled in.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { usePageReady } from '@/hooks/usePageReady'
import { playSound } from '@/lib/sounds'
import { requestCloudNav } from '@/components/CloudTransition'
import { PrimaryButton, TextButton, personColor } from '@/components/meadow'
import {
  DEFAULT_CAT_NAME, catPronouns, presetLook, saveCatIdentity, validateCatName,
  type CatIdentity, type CatLook,
} from '@/lib/catIdentity'
import {
  createHousehold, formatInviteCode, joinHousehold, leaveHousehold, livesAlone, loadHouseholdCat, loadHouseholdIntro,
  normalizeInviteCode, readInviteCode, signUpAccount, type HouseholdIntro,
} from '@/lib/onboarding'
import {
  PRE_ACCOUNT_STEPS, clearDraft, clearPending, freshDraft, loadDraft, readPending, saveDraft, writePending,
  type AfterStep, type Draft, type Step,
} from '@/components/onboarding/flow'
import { useNotifyStep } from '@/components/onboarding/useNotifyStep'
import { useInviteShare } from '@/components/onboarding/useInviteShare'
import OnbScreen, { Note } from '@/components/onboarding/OnbScreen'
import OnbStage, { StageBubble } from '@/components/onboarding/OnbStage'
import WelcomeScreen from '@/components/onboarding/WelcomeScreen'
import { BuildScreen, NameScreen, SexScreen } from '@/components/onboarding/CatSteps'
import { CodeScreen, EmailScreen, SaveScreen, YouScreen, type EmailError } from '@/components/onboarding/AccountSteps'
import { NotifyScreen, PartnerScreen } from '@/components/onboarding/HomeSteps'
import { FinaleScreen, MeetScreen } from '@/components/onboarding/RoomScreens'

interface Account { userId: string; email: string | null; name: string }
interface Home { id: string; inviteCode: string | null }

const DEMO_ACCOUNT: Account = { userId: 'demo-user', email: 'demo@example.com', name: 'Alex' }
const DEMO_HOME: Home = { id: 'demo-household', inviteCode: 'CAT4EVER' }
const STEP_NAMES: readonly Step[] = [
  'welcome', 'build', 'tune', 'sex', 'name', 'you', 'save', 'email', 'partner', 'notify', 'finale', 'code', 'meet',
]
const JOINER_STEPS: readonly Step[] = ['code', 'meet']
const AFTER_HOME: readonly Step[] = ['partner', 'notify', 'finale', 'meet']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * 'email' goes back to 'save'. The 18+/terms tick lives only in this page's
 * state, never in the draft, so anything that lands on 'email' without it (a
 * resumed draft) has to show the box again before an account is made.
 */
const toConsent = (d: Draft): Draft => (d.step !== 'email' ? d : {
  ...d, step: 'save', hist: d.hist[d.hist.length - 1] === 'save' ? d.hist.slice(0, -1) : d.hist,
})

/**
 * The invite link's ?code= has been read into the draft (or answered): drop it
 * so a reload resumes where the person is instead of restarting at the code
 * screen. Next 14.2 keeps its router in step with a native replaceState.
 */
function dropCodeParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [resolved, setResolved] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [demo, setDemo] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => freshDraft())
  const [account, setAccount] = useState<Account | null>(null)
  const [home, setHome] = useState<Home | null>(null)
  /** The household's cat as saved. Until then the draft is the cat. */
  const [homeCat, setHomeCat] = useState<CatIdentity | null>(null)

  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [userNameError, setUserNameError] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [agreeError, setAgreeError] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<EmailError | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  /** The home exists but the cat's identity didn't reach it. */
  const [catPending, setCatPending] = useState(false)
  const [welcomeError, setWelcomeError] = useState<string | null>(null)
  const [intro, setIntro] = useState<HouseholdIntro | null>(null)
  const [introError, setIntroError] = useState<string | null>(null)
  const [introNonce, setIntroNonce] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  /** An invite link opened by someone who already has a home of their own. */
  const [alreadyHome, setAlreadyHome] = useState(false)
  const [today, setToday] = useState('')
  // A second tap can land before the busy button re-renders. sign-up and
  // create_household are not idempotent, so the guard is a ref, not state.
  const inFlight = useRef(false)

  const step = draft.step
  usePageReady(resolved || loadError)

  // ─── Resume: where in the flow does this visitor belong? ──────────────────
  useEffect(() => {
    let cancelled = false
    async function resolve() {
      const params = new URLSearchParams(window.location.search)
      const demoParam = params.get('demo')
      const codeParam = params.get('code')

      if (demoParam) {
        const start: Step = (STEP_NAMES as readonly string[]).includes(demoParam) ? demoParam as Step : 'welcome'
        const joiner = JOINER_STEPS.includes(start)
        setDemo(true)
        setDraft({ ...freshDraft(joiner ? 'joiner' : 'creator'), step: start, userName: start === 'welcome' ? '' : 'Alex' })
        if (AFTER_HOME.includes(start)) {
          setAccount(DEMO_ACCOUNT)
          setHome(DEMO_HOME)
          if (!joiner) setHomeCat({ name: DEFAULT_CAT_NAME, sex: 'female', look: presetLook('tuxedo') })
        }
        setResolved(true)
        return
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (cancelled) return
      // Offline is not "signed out": showing the Welcome to someone who is
      // signed in would send them into a sign-up that can only fail.
      if (!user && authError?.name === 'AuthRetryableFetchError') {
        setLoadError(true)
        return
      }
      const saved = loadDraft()
      // catSaved and solo describe a home that existed. With no home to resume
      // into, a draft kept from an earlier run (left on Invite, then signed
      // out, left or was blocked; or someone else on this phone) must not
      // carry them over: a stale catSaved skipped writing the new home's cat,
      // and it came home as the classic Eren with no error anywhere.
      const preHome: Draft | null = saved && { ...saved, catSaved: false, solo: false }
      const joinerFromLink = (base: Draft | null): Draft => ({
        ...(base ?? freshDraft('joiner')), path: 'joiner', step: 'code', hist: ['welcome'], code: formatInviteCode(codeParam ?? ''),
      })

      if (!user) {
        if (codeParam) { setDraft(joinerFromLink(preHome)); dropCodeParam() }
        else if (preHome && PRE_ACCOUNT_STEPS.includes(preHome.step)) setDraft(toConsent(preHome))
        else if (preHome) setDraft({ ...preHome, step: 'welcome', hist: [] })
        setResolved(true)
        return
      }

      const { data: prof, error } = await withRetry(() => supabase
        .from('profiles').select('household_id, name').eq('id', user.id).maybeSingle())
      if (cancelled) return
      if (error) {
        // Transient outage: never assume "no household" on a failed read.
        setLoadError(true)
        return
      }
      const profileName = (prof?.name as string | null)?.trim() || ''
      const acct: Account = {
        userId: user.id,
        email: user.email ?? null,
        name: profileName || user.email?.split('@')[0] || '',
      }
      setAccount(acct)

      if (!prof?.household_id) {
        // Signed up but never moved in: a refresh after sign-up, a home they
        // left, or home's no-household redirect. The account steps are done.
        // The account's own name wins over the draft's: the draft may be an
        // earlier run's (or another person's), and create_household and the
        // joiner's name save write this one onto the profile.
        const base = preHome
          ? { ...preHome, userName: profileName || preHome.userName || acct.name }
          : { ...freshDraft(), userName: acct.name }
        if (codeParam) { setDraft(joinerFromLink(base)); dropCodeParam() }
        else if (base.path === 'creator' && (base.step === 'save' || base.step === 'email' || base.step === 'you')) {
          setDraft({ ...base, step: 'save', hist: ['name'] })
        } else if (base.path === 'creator' && PRE_ACCOUNT_STEPS.includes(base.step)) setDraft(base)
        else if (base.path === 'joiner' && PRE_ACCOUNT_STEPS.includes(base.step)) {
          setDraft({ ...base, step: 'code', hist: ['welcome'] })
        } else setDraft({ ...base, step: 'welcome', hist: [] })
        setResolved(true)
        return
      }

      const hh = prof.household_id as string
      const pending = readPending(acct.userId)
      if (!pending) {
        if (codeParam) {
          // An invite link opened by someone who already has a home. Bouncing
          // them to /home dropped the link without a word, so it looked broken:
          // say why it can't open and where to go. The key is kept in a joiner
          // draft, so after leaving from Settings (which lands back here) the
          // code screen opens with it filled in.
          const cat = await loadHouseholdCat(hh)
          if (cancelled) return
          if (cat.ok) setHomeCat(cat.value)
          setDraft(joinerFromLink(null))
          dropCodeParam()
          setAlreadyHome(true)
          setResolved(true)
          return
        }
        router.replace('/home')
        return
      }
      const resumed = await resumeAfterHome(hh, acct.userId, pending, saved)
      if (cancelled) return
      if (resumed === 'failed') { setLoadError(true); return }
      if (resumed === 'not-ours') {
        // The marker outlived a create that never built this home: there is
        // nothing to finish, and AppGuard must stop sending them back here.
        clearPending()
        clearDraft()
        router.replace('/home')
        return
      }
      setResolved(true)
    }
    setLoadError(false)
    resolve()
    return () => { cancelled = true }
  }, [retryNonce]) // eslint-disable-line react-hooks/exhaustive-deps

  // A refresh after the home exists: pick the flow up at the saved step with
  // the household's real cat (and finish saving it if the draft never did).
  // 'not-ours' = the marker doesn't belong to this home, so nothing resumes.
  async function resumeAfterHome(
    hh: string, userId: string, pending: AfterStep, saved: Draft | null,
  ): Promise<'ok' | 'failed' | 'not-ours'> {
    const path = pending === 'meet' || saved?.path === 'joiner' ? 'joiner' : 'creator'
    const base: Draft = { ...(saved ?? freshDraft(path)), path, step: pending, hist: [] }
    let inviteCode: string | null = null
    if (pending !== 'meet') {
      // The cat built before sign-up never reached the home (the save failed,
      // or create_household's answer was lost, and the page was reloaded).
      // Try again; if it still fails, go back to the Save screen and say so,
      // rather than quietly swapping the cat the person built for the classic
      // one. Only 'partner' can owe the cat: it is marked as the home is
      // built, and every later step is reached only once the cat saved or
      // was skipped.
      let catFailed: string | null = null
      if (pending === 'partner' && path === 'creator' && saved && !saved.catSaved) {
        // ...and only onto a home this person lives in alone, as every home
        // create_household just made is. Someone else living there means the
        // marker outlived a create that never happened (they were already in
        // that home), and saving would replace their person's cat.
        const alone = await livesAlone(hh, userId)
        if (!alone.ok) return 'failed'
        if (!alone.value) return 'not-ours'
        const r = await saveCatIdentity(hh, { name: saved.catName, sex: saved.sex, look: saved.look })
        if (r.ok || r.reason === 'not-migrated') base.catSaved = true
        else catFailed = r.message
        if (!r.ok) console.warn('[onboarding] cat identity not saved on resume:', r.reason, r.message)
      }
      if (catFailed && saved) {
        setCatPending(true)
        setFinishError(`${saved.catName}'s look didn't save. Check your connection and try again.`)
        base.step = 'save'
      } else {
        const cat = await loadHouseholdCat(hh)
        if (!cat.ok) return 'failed'
        setHomeCat(cat.value)
      }
      if (pending === 'partner' || catFailed) {
        const code = await readInviteCode(hh)
        if (!code.ok) return 'failed'
        inviteCode = code.value
      }
    }
    setHome({ id: hh, inviteCode })
    setDraft(base)
    return 'ok'
  }

  // Keep the draft (never in demo: it must not leak into a real run).
  useEffect(() => {
    if (resolved && !demo) saveDraft(draft)
  }, [draft, resolved, demo])

  // Each step starts at the top of the page.
  useEffect(() => { window.scrollTo(0, 0) }, [step])

  // The adoption date is the device's today, resolved after mount.
  useEffect(() => { setToday(longDate(new Date())) }, [])

  // ─── Navigation ───────────────────────────────────────────────────────────
  const go = useCallback((to: Step, patch?: Partial<Draft>) => {
    playSound('ui_select')
    setDraft(d => ({ ...d, ...patch, step: to, hist: [...d.hist, d.step].slice(-12) }))
  }, [])
  /** Replace the history: nothing before this step can be revisited. */
  const jump = useCallback((to: Step, hist: Step[] = []) => {
    setDraft(d => ({ ...d, step: to, hist }))
  }, [])
  const back = useCallback(() => {
    setDraft(d => (d.hist.length ? { ...d, step: d.hist[d.hist.length - 1], hist: d.hist.slice(0, -1) } : d))
  }, [])
  const patchDraft = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }))

  function launch() {
    if (!demo) { clearPending(); clearDraft() }
    requestCloudNav('/home', 'rainbow')
  }

  // ─── The cat on screen ────────────────────────────────────────────────────
  const typedName = validateCatName(draft.catName)
  const catName = homeCat?.name ?? (typedName.ok ? typedName.name : DEFAULT_CAT_NAME)
  const catLook: CatLook | null = homeCat ? homeCat.look : draft.look
  const catSex = homeCat?.sex ?? draft.sex
  const pr = catPronouns(catSex)
  const userName = (draft.userName.trim() || account?.name || '').trim()

  // ─── Creator: build the home, then give it the cat ────────────────────────
  async function finishCreator(acct: Account) {
    if (inFlight.current) return
    inFlight.current = true
    try { await createThenSaveCat(acct) } finally { inFlight.current = false }
  }
  async function createThenSaveCat(acct: Account) {
    setBusy(true)
    setFinishError(null)
    let hh = home
    // A home this call builds starts with the default cat, so it always gets
    // the one built here, whatever the draft's catSaved says.
    const created = !hh
    if (!hh) {
      // Marked BEFORE the RPC: create_household can commit and its answer
      // still never arrive (a hung request, a wifi-to-cellular switch). The
      // reload that follows then finds the home and this marker, and
      // resumeAfterHome saves the cat; marked after, it found a home and no
      // marker, went to /home, and the cat was never saved.
      if (!demo) writePending('partner', acct.userId)
      const res = demo
        ? { ok: true as const, value: { householdId: DEMO_HOME.id, inviteCode: DEMO_HOME.inviteCode as string } }
        : await createHousehold({ userId: acct.userId, name: userName || acct.name, householdName: `${catName}'s Home` })
      if (!res.ok) {
        // Already in someone else's home: nothing was built, so a reload must
        // not "resume" this cat onto theirs. Any other failure may still have
        // committed, so its marker stays.
        if (!demo && res.code === 'already_home') clearPending()
        setBusy(false)
        setFinishError(res.message)
        jump('save', ['name'])
        return
      }
      hh = { id: res.value.householdId, inviteCode: res.value.inviteCode }
      setHome(hh)
      playSound('quest_complete')
    }
    if (created || !draft.catSaved) {
      const r = demo ? { ok: true as const } : await saveCatIdentity(hh.id, { name: catName, sex: draft.sex, look: draft.look })
      // Not migrated yet = a setup gap the owner closes by pasting the SQL,
      // not something the new user can fix: log it and carry on as Eren.
      if (!r.ok && r.reason !== 'not-migrated') {
        setBusy(false)
        setCatPending(true)
        setFinishError(r.reason === 'invalid' ? r.message : `${catName}'s look didn't save. Check your connection and try again.`)
        jump('save', ['name'])
        return
      }
      if (!r.ok) console.warn('[onboarding] cat identity not saved:', r.message)
      patchDraft({ catSaved: true })
    }
    setHomeCat({ name: catName, sex: draft.sex, look: draft.look })
    setCatPending(false)
    setBusy(false)
    jump('partner')
  }

  // The home exists; the person chose to go on without the look saved. The
  // household keeps the classic cat, and Settings can paint it later.
  function skipCat() {
    patchDraft({ catSaved: true })
    setHomeCat({ name: DEFAULT_CAT_NAME, sex: 'male', look: null })
    setCatPending(false)
    setFinishError(null)
    jump('partner')
  }

  // ─── Joiner: move into the home the code opens ────────────────────────────
  async function finishJoiner(acct: Account) {
    if (inFlight.current) return
    inFlight.current = true
    try { await joinWithCode(acct) } finally { inFlight.current = false }
  }
  async function joinWithCode(acct: Account) {
    setBusy(true)
    setCodeError(null)
    const res = demo
      ? { ok: true as const, value: { householdId: DEMO_HOME.id } }
      : await joinHousehold({ userId: acct.userId, name: userName || acct.name, inviteCode: normalizeInviteCode(draft.code) })
    setBusy(false)
    if (!res.ok) {
      // The account exists now either way, so the code screen is where this
      // gets fixed: "Find my home" there joins directly.
      setCodeError(res.message)
      jump('code', ['welcome'])
      return
    }
    setHome({ id: res.value.householdId, inviteCode: null })
    setIntro(null)
    setIntroError(null)
    if (!demo) writePending('meet', acct.userId)
    playSound('quest_complete')
    jump('meet')
  }

  // ─── Your account ─────────────────────────────────────────────────────────
  async function submitAccount() {
    if (busy || inFlight.current) return
    // Sign-up records the 18+/terms acceptance, so no account is made without
    // the box ticked in this session. Only a resumed draft gets here without
    // it (the tick is never stored), and it goes back to the box.
    if (!demo && !agreed) {
      setAgreeError(true)
      setDraft(toConsent)
      return
    }
    const e = email.trim()
    if (!e) { setEmailError({ field: 'email', message: 'Enter your email.' }); return }
    if (!EMAIL_RE.test(e)) { setEmailError({ field: 'email', message: "That email doesn't look right." }); return }
    if (password.length < 6) { setEmailError({ field: 'password', message: 'Use at least 6 characters.' }); return }
    setEmailError(null)
    let acct: Account
    if (demo) {
      acct = { ...DEMO_ACCOUNT, name: userName || DEMO_ACCOUNT.name }
    } else {
      setBusy(true)
      inFlight.current = true
      const res = await signUpAccount({ name: userName, email: e, password })
      inFlight.current = false
      setBusy(false)
      if (!res.ok) {
        setEmailError({ field: 'form', message: res.message, duplicate: res.code === 'duplicate_email' })
        return
      }
      if (!res.value.hasSession) {
        setEmailError({ field: 'form', message: 'Check your inbox and open the link we sent to confirm your email, then log in to finish.' })
        return
      }
      acct = { userId: res.value.userId, email: e, name: userName }
    }
    setAccount(acct)
    setPassword('')
    if (draft.path === 'creator') await finishCreator(acct)
    else await finishJoiner(acct)
  }

  // ─── Code ─────────────────────────────────────────────────────────────────
  function submitCode() {
    if (busy) return
    if (normalizeInviteCode(draft.code).length < 4) {
      setCodeError('That code looks too short. House keys have 8 letters and numbers.')
      return
    }
    setCodeError(null)
    if (account) void finishJoiner(account)
    else go('you')
  }

  // ─── Meet: read the household the joiner just moved into ──────────────────
  useEffect(() => {
    if (step !== 'meet' || !home || intro) return
    if (demo) {
      setIntro({
        cat: { name: 'Mochi', sex: 'female', look: presetLook('calico') },
        partner: { name: 'Sam', heart: 'brown_heart' },
        homeSince: new Date(Date.now() - 90 * 86400000).toISOString(),
      })
      return
    }
    if (!account) return
    let live = true
    setIntroError(null)
    loadHouseholdIntro(home.id, account.userId).then(res => {
      if (!live) return
      if (res.ok) { setIntro(res.value); setHomeCat(res.value.cat) }
      else setIntroError(res.message)
    })
    return () => { live = false }
  }, [step, home, intro, account, demo, introNonce])

  async function leaveWrongHome() {
    if (leaving) return
    setLeaving(true)
    setLeaveError(null)
    const r = demo ? { ok: true as const } : await leaveHousehold()
    setLeaving(false)
    if (!r.ok) { setLeaveError(r.message); return }
    if (!demo) clearPending()
    setHome(null)
    setIntro(null)
    setHomeCat(null)
    setCodeError(null)
    setDraft(d => ({ ...d, step: 'code', hist: ['welcome'], code: '' }))
  }

  // ─── Invite + notifications (their own hooks) ─────────────────────────────
  const invite = useInviteShare({ code: home?.inviteCode ?? '', catName })
  // The home exists on these steps, so the account does too.
  const markPending = (s: AfterStep) => { if (!demo && account) writePending(s, account.userId) }
  const toNotify = (solo: boolean) => {
    markPending('notify')
    go('notify', { solo })
  }
  const afterNotify = () => {
    if (draft.path === 'joiner') { launch(); return }
    markPending('finale')
    jump('finale')
  }
  const notify = useNotifyStep({
    userId: account?.userId ?? null,
    householdId: home?.id ?? null,
    demo,
    onDone: afterNotify,
  })

  async function logOut() {
    setBusy(true)
    const { error } = await supabase.auth.signOut()
    setBusy(false)
    if (error) { setWelcomeError("Couldn't log out. Try again?"); return }
    clearDraft()
    setAccount(null)
    setDraft(freshDraft())
    setWelcomeError(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <OnbScreen title="Hmm, no signal" footer={<PrimaryButton onClick={() => setRetryNonce(n => n + 1)}>Try again</PrimaryButton>}>
        <OnbStage kind="std" look={null} alt="Eren, waiting">
          <StageBubble top={40}>Hello? Anyone there?</StageBubble>
        </OnbStage>
        <Note center role="alert" style={{ margin: '18px 24px 0' }}>
          We couldn&apos;t reach the cloud. Check your connection, then try again.
        </Note>
      </OnbScreen>
    )
  }

  // The splash covers this until the resume check settles.
  if (!resolved) return <div className="meadow-page" style={{ padding: 0, background: '#FFFFFF' }} />

  if (alreadyHome) {
    // homeCat is null only if reading their cat failed: the classic cat and
    // no name, rather than an error screen in front of an explanation.
    const ownCat = homeCat?.name ?? null
    return (
      <OnbScreen
        title="One home at a time"
        footer={(
          <>
            <TextButton
              tone="muted"
              onClick={() => { clearDraft(); router.replace('/home') }}
              style={{ height: 44 }}
            >
              {ownCat ? `Back to ${ownCat}` : 'Back home'}
            </TextButton>
            <PrimaryButton href="/settings" style={{ marginTop: 8 }}>Open Settings</PrimaryButton>
          </>
        )}
      >
        <OnbStage kind="std" look={homeCat?.look ?? null} alt={ownCat ? `${ownCat}, your cat` : 'Your cat'}>
          <StageBubble top={40}>We live here!</StageBubble>
        </OnbStage>
        <Note center style={{ margin: '18px 24px 0' }}>
          {ownCat ? `You already live with ${ownCat}.` : 'You already live in a home.'} To move into
          the one this invite opens, leave yours in Settings first.
        </Note>
      </OnbScreen>
    )
  }

  const onBack = draft.hist.length ? back : undefined
  const myColor = personColor('brown_heart')

  switch (step) {
    case 'welcome':
      return (
        <WelcomeScreen
          signedInAs={account ? (account.email ?? account.name) : null}
          onAdopt={() => go('build', { path: 'creator' })}
          onInvite={() => go('code', { path: 'joiner' })}
          onLogOut={account && !demo ? logOut : undefined}
          busy={busy}
          errorNote={welcomeError}
        />
      )
    case 'build':
    case 'tune':
      return (
        <BuildScreen
          view={step === 'tune' ? 'tune' : 'build'}
          look={draft.look}
          onLook={look => patchDraft({ look })}
          onView={v => (v === 'tune' ? go('tune') : back())}
          onBack={back}
          onNext={() => go('sex')}
        />
      )
    case 'sex':
      return <SexScreen sex={draft.sex} onSex={sex => patchDraft({ sex })} look={draft.look} onBack={back} onNext={() => go('name')} />
    case 'name':
      return (
        <NameScreen
          name={draft.catName}
          onName={n => { patchDraft({ catName: n }); setNameError(null) }}
          sex={draft.sex}
          look={draft.look}
          error={nameError}
          onBack={back}
          onNext={() => {
            const check = validateCatName(draft.catName)
            if (!check.ok) { setNameError(check.error); return }
            go(account ? 'save' : 'you', { catName: check.name })
          }}
        />
      )
    case 'you':
      return (
        <YouScreen
          userName={draft.userName}
          onUserName={n => { patchDraft({ userName: n }); setUserNameError(null) }}
          catName={draft.path === 'joiner' ? null : catName}
          look={draft.path === 'joiner' ? null : draft.look}
          error={userNameError}
          onBack={back}
          onNext={() => {
            const n = draft.userName.replace(/\s+/g, ' ').trim()
            if (!n) { setUserNameError(draft.path === 'joiner' ? 'Tell us your name.' : `Tell ${catName} your name.`); return }
            go('save', { userName: n })
          }}
        />
      )
    case 'save': {
      const joiner = draft.path === 'joiner'
      if (account) {
        return (
          <SaveScreen
            mode="finish"
            title={`Save ${catName}`}
            subtitle={`So ${pr.he} remembers you on every phone.`}
            bubble={userName ? `Keep me safe, ${userName}?` : 'Keep me safe?'}
            look={draft.look}
            onBack={catPending ? undefined : onBack}
            signedInAs={account.email}
            error={finishError}
            primaryLabel={catPending ? 'Try again' : `Bring ${catName} home`}
            onPrimary={() => void finishCreator(account)}
            secondary={catPending
              ? { label: 'Skip for now', onClick: skipCat }
              : demo ? undefined : { label: 'Not you? Log out', onClick: () => void logOut() }}
            busy={busy}
          />
        )
      }
      return (
        <SaveScreen
          mode="new"
          title={joiner ? 'Save your spot' : `Save ${catName}`}
          subtitle={joiner ? 'So your cat remembers you on every phone.' : `So ${pr.he} remembers you on every phone.`}
          bubble={joiner
            ? (userName ? `Almost home, ${userName}.` : 'Almost home.')
            : (userName ? `Keep me safe, ${userName}?` : 'Keep me safe?')}
          look={joiner ? null : draft.look}
          silhouette={joiner}
          onBack={back}
          agree={agreed}
          onAgree={v => { setAgreed(v); setAgreeError(false) }}
          agreeError={agreeError}
          onContinue={() => {
            if (!agreed) { setAgreeError(true); return }
            go('email')
          }}
        />
      )
    }
    case 'email':
      return (
        <EmailScreen
          email={email}
          password={password}
          onEmail={v => { setEmail(v); if (emailError?.field !== 'form') setEmailError(null) }}
          onPassword={v => { setPassword(v); if (emailError?.field === 'password') setEmailError(null) }}
          error={emailError}
          busy={busy}
          primaryLabel={draft.path === 'joiner' ? 'Create account' : `Save ${catName}`}
          onSubmit={() => void submitAccount()}
          onBack={back}
        />
      )
    case 'code':
      return (
        <CodeScreen
          code={draft.code}
          onCode={v => { patchDraft({ code: v }); setCodeError(null) }}
          error={codeError}
          busy={busy}
          onBack={back}
          onNext={submitCode}
        />
      )
    case 'partner':
      return (
        <PartnerScreen
          catName={catName}
          look={catLook}
          userName={userName}
          myColor={myColor}
          inviteCode={home?.inviteCode ?? ''}
          copied={invite.copied}
          linkCopied={invite.linkCopied}
          error={invite.error}
          onCopy={invite.copy}
          onShare={() => void invite.share().then(shared => { if (shared) toNotify(false) })}
          onSolo={() => toNotify(true)}
          onNext={() => toNotify(false)}
        />
      )
    case 'notify':
      return (
        <NotifyScreen
          catName={catName}
          look={catLook}
          state={notify.state}
          onYes={() => void notify.enable()}
          onNotNow={afterNotify}
          onContinue={afterNotify}
          onBack={onBack}
        />
      )
    case 'finale':
      return (
        <FinaleScreen
          catName={catName}
          look={catLook}
          sex={catSex}
          userName={userName}
          myColor={myColor}
          solo={draft.solo}
          dateLabel={today}
          onHome={launch}
        />
      )
    case 'meet':
      return (
        <MeetScreen
          intro={intro}
          homeSinceLabel={intro?.homeSince ? shortDate(intro.homeSince) : null}
          error={introError}
          onRetry={() => { setIntroError(null); setIntroNonce(n => n + 1) }}
          onMoveIn={() => { markPending('notify'); go('notify') }}
          onLeave={() => void leaveWrongHome()}
          leaving={leaving}
          leaveError={leaveError}
        />
      )
  }
}
