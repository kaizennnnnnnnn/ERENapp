'use client'

// ─── Settings ────────────────────────────────────────────────────────────────
// The Meadow A4 board, pushed from Me (the gear, and the cat card's Edit).
// This file is the data half: it reads the household row, keeps the switches'
// state, and turns every action into a checked write that resolves to an
// Outcome. SettingsView draws it.
//
// Every setting the old Profile page had lives here now: your name, the
// invite code (copy + replace), special days, mood alerts, the three push
// opt-ins, the accent, sign out, report / block, leave, delete, privacy and
// terms. New with the redesign: the cat's name, boy or girl, birthday and
// look, and an "Enable notifications" switch that actually asks.
//
// Writes that set absolute values retry (writeWithRetry); the ones that can't
// be repeated safely (a new invite code, leave, block, delete) run once. Each
// one's error reaches the screen: the old toggles fired and forgot, so a
// refused write looked saved until the next reload.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withRetry, writeWithRetry } from '@/lib/supabaseRetry'
import { PROFILE_UPDATED_EVENT, useAuth, type ProfileUpdatedDetail } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { useCare } from '@/contexts/CareContext'
import { useTheme } from '@/contexts/ThemeContext'
import { usePageReady } from '@/hooks/usePageReady'
import { blockUser } from '@/lib/reporting'
import { registerSW } from '@/lib/reminders'
import { requestNotificationPermission } from '@/lib/statNotifications'
import { subscribeToPush } from '@/lib/pushSubscription'
import { playSound } from '@/lib/sounds'
import { catIdentityFromStats, saveCatIdentity, validateCatName, type CatIdentity } from '@/lib/catIdentity'
import { MeadowPage, personColor } from '@/components/meadow'
import SettingsView, {
  type NotifState, type Outcome, type PrefKey, type Prefs, type SettingsActions, type SettingsCat,
} from './SettingsView'

const OK: Outcome = { ok: true }
const OFFLINE: Outcome = { ok: false, message: 'Could not save. Check your connection and try again.' }
const NO_HOME: Outcome = { ok: false, message: 'This account is not in a home yet.' }

const PREF_COLUMN: Record<PrefKey, 'mood_alert_optin' | 'wish_push_optin' | 'memory_push_optin' | 'quiet_eren_optin'> = {
  moodAlerts: 'mood_alert_optin',
  wishPush: 'wish_push_optin',
  memoryPush: 'memory_push_optin',
  quietEren: 'quiet_eren_optin',
}

/** How long to wait for the push service before calling the switch failed. */
const SUBSCRIBE_TIMEOUT_MS = 15000

interface HouseholdRow {
  inviteCode: string | null
  catBirthday: string | null
  anniversary: string | null
}

function without<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const { [key]: _drop, ...rest } = obj // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest
}

/** This phone's push state, read once the page is in the browser. */
async function readNotifState(): Promise<NotifState> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  try {
    // getRegistration, not .ready: .ready never settles when no worker is registered.
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { user, profile, loading, signOut } = useAuth()
  const { setHideStats } = useCare()
  const { partner, isSolo } = useCouple()
  const householdId = profile?.household_id ?? null
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useErenStats(householdId ?? undefined)
  const { theme, setTheme } = useTheme()

  // The Meadow pages carry their own header; the old HUD steps aside here.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  // ── The households row: invite code + the two household dates ──
  const [household, setHousehold] = useState<HouseholdRow | null>(null)
  const [householdFailed, setHouseholdFailed] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!householdId) return
    let live = true
    setHouseholdFailed(false)
    void withRetry(() => supabase
      .from('households')
      .select('invite_code, eren_birthday, couple_anniversary')
      .eq('id', householdId)
      .maybeSingle())
      .then(({ data, error }) => {
        if (!live) return
        // No row for a household this profile points at is not "empty":
        // the read did not reach it. Say so rather than show blank dates.
        if (error || !data) { setHouseholdFailed(true); return }
        setHousehold({
          inviteCode: (data.invite_code as string | null) ?? null,
          catBirthday: (data.eren_birthday as string | null) ?? null,
          anniversary: (data.couple_anniversary as string | null) ?? null,
        })
      })
    return () => { live = false }
  }, [supabase, householdId, reload])

  // ── My own row: the switches, my birthday ──
  // Seeded once from the profile, then this page's copy is the truth: useAuth
  // doesn't refetch, so re-seeding would undo a switch the moment it saved.
  // (My name is the exception: saveMyName patches every useAuth copy.)
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [myBirthday, setMyBirthday] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (!profile || prefs) return
    setPrefs({
      moodAlerts: profile.mood_alert_optin ?? true,
      wishPush: profile.wish_push_optin ?? true,
      memoryPush: profile.memory_push_optin ?? true,
      quietEren: profile.quiet_eren_optin ?? false,
    })
  }, [profile, prefs])

  // ── This phone's notifications ──
  const [notif, setNotif] = useState<NotifState>('checking')
  useEffect(() => {
    let live = true
    void readNotifState().then(s => { if (live) setNotif(s) })
    return () => { live = false }
  }, [])

  // ── The cat, with the value being saved shown straight away ──
  // saveCatIdentity's realtime echo lands a moment after the write; until then
  // the override holds the new value, so a rename doesn't flick back. Each
  // override clears as soon as the row itself moves (the echo, or the partner
  // changing it after us).
  const base = catIdentityFromStats(stats)
  const [catOverride, setCatOverride] = useState<Partial<CatIdentity>>({})
  const baseLookSig = base.look ? JSON.stringify(base.look) : 'classic'
  useEffect(() => { setCatOverride(o => ('name' in o ? without(o, 'name') : o)) }, [base.name])
  useEffect(() => { setCatOverride(o => ('sex' in o ? without(o, 'sex') : o)) }, [base.sex])
  useEffect(() => { setCatOverride(o => ('look' in o ? without(o, 'look') : o)) }, [baseLookSig])
  const cat: CatIdentity = { ...base, ...catOverride }

  // With no stats row in hand, `base` is the default cat, not this one: shown
  // as real, and handed to the look editor, a save from it would overwrite
  // the household's own look. `stats` is asked first because the provider
  // doesn't clear `error` when a later read succeeds.
  const settingsCat: SettingsCat | null = !householdId ? null
    : stats ? { status: 'ready', name: cat.name, sex: cat.sex, look: cat.look }
      : { status: statsError && !statsLoading ? 'failed' : 'loading' }

  const saveCat = useCallback(async <K extends keyof CatIdentity>(key: K, value: CatIdentity[K]): Promise<Outcome> => {
    if (!householdId) return NO_HOME
    setCatOverride(o => ({ ...o, [key]: value }))
    const r = await saveCatIdentity(householdId, { [key]: value })
    if (r.ok) return OK
    setCatOverride(o => without(o, key))
    return { ok: false, message: r.message }
  }, [householdId])

  /** An absolute-value update to one row, retried, and counted: 0 rows back means RLS said no. */
  const updateRow = useCallback(async (
    table: 'profiles' | 'households', id: string, values: Record<string, unknown>,
  ): Promise<boolean> => {
    const { data, error } = await writeWithRetry(signal => supabase
      .from(table).update(values).eq('id', id).select('id').abortSignal(signal))
    if (error) console.warn(`[settings] ${table} update failed`, error.message)
    return !error && Array.isArray(data) && data.length > 0
  }, [supabase])

  usePageReady(!loading && !!profile)

  // Every hook is above this line: `loading` is true on the first render of
  // every visit, and a hook below an early return crashes the page.
  if (loading || !profile || !user) {
    return <MeadowPage ground="settings" title="Settings" back={{ href: '/profile', label: 'Back to Me' }} withNav={false}><span /></MeadowPage>
  }

  const actions: SettingsActions = {
    renameCat: async name => {
      const check = validateCatName(name)
      if (!check.ok) return { ok: false, message: check.error }
      return saveCat('name', check.name)
    },
    setCatSex: sex => saveCat('sex', sex),
    saveCatLook: look => saveCat('look', look),

    saveCatBirthday: async date => {
      if (!householdId) return NO_HOME
      if (!await updateRow('households', householdId, { eren_birthday: date })) return OFFLINE
      setHousehold(h => (h ? { ...h, catBirthday: date } : h))
      return OK
    },

    // The layout's providers put my name in the partner's pushes, the love
    // meter and the battle; they only hear about the new one through this
    // event (the old page reloaded the whole app for it).
    saveMyName: async name => {
      if (!await updateRow('profiles', user.id, { name })) return OFFLINE
      window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, {
        detail: { id: user.id, patch: { name } },
      }))
      return OK
    },

    saveSpecialDays: async ({ birthday, anniversary }) => {
      const failed: string[] = []
      if (birthday !== undefined) {
        if (await updateRow('profiles', user.id, { birthday })) setMyBirthday(birthday)
        else failed.push('your birthday')
      }
      if (anniversary !== undefined) {
        if (!householdId) failed.push('your anniversary')
        else if (await updateRow('households', householdId, { couple_anniversary: anniversary })) {
          setHousehold(h => (h ? { ...h, anniversary } : h))
        } else failed.push('your anniversary')
      }
      if (failed.length === 0) return OK
      return { ok: false, message: `Could not save ${failed.join(' or ')}. Check your connection and try again.` }
    },

    // Not retried: every call mints a different code, so a retry after an
    // ambiguous failure would silently replace the one we just showed.
    rotateInviteCode: async () => {
      const { data, error } = await supabase.rpc('rotate_invite_code')
      if (error || typeof data !== 'string' || !data) {
        return { ok: false, message: 'Could not make a new code just now. Try again in a moment.' }
      }
      setHousehold(h => (h ? { ...h, inviteCode: data } : h))
      return OK
    },

    setPref: async (key, next) => {
      const prev = prefs?.[key]
      setPrefs(p => (p ? { ...p, [key]: next } : p))
      playSound('ui_toggle')
      if (await updateRow('profiles', user.id, { [PREF_COLUMN[key]]: next })) return OK
      setPrefs(p => (p && prev !== undefined ? { ...p, [key]: prev } : p))
      return { ok: false, message: 'That switch did not save. Check your connection and try again.' }
    },

    // Called straight from the switch's tap: the permission prompt has to be
    // asked inside the gesture, so nothing is awaited before it.
    enableNotifications: async () => {
      if (notif === 'unsupported') return { ok: false, message: 'Add Eren to your Home Screen first, then turn this on.' }
      if (!householdId) return NO_HOME
      void registerSW()
      const granted = await requestNotificationPermission()
      if (!granted) {
        const blocked = 'Notification' in window && Notification.permission === 'denied'
        setNotif(blocked ? 'blocked' : 'off')
        return {
          ok: false,
          message: blocked
            ? "Notifications are blocked. Allow them for Eren in your phone's settings."
            : 'Notifications were not turned on.',
        }
      }
      // subscribeToPush waits on the service worker, which can take a while
      // on a first install; it must not leave the switch spinning forever.
      const subscribed = await Promise.race([
        subscribeToPush(user.id, householdId),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), SUBSCRIBE_TIMEOUT_MS)),
      ])
      if (!subscribed) {
        setNotif('off')
        return { ok: false, message: 'Allowed, but this phone could not sign up for them. Try again in a moment.' }
      }
      setNotif('on')
      playSound('quest_complete')
      return OK
    },

    setTheme: t => {
      playSound('ui_toggle')
      setTheme(t)
    },

    signOut: async () => {
      await signOut()
      router.push('/auth/login')
    },

    // block_user() records the block and detaches this account in one
    // transaction. A hard navigation, like leaving: every context below is
    // built on a profile that still says we live here, and a reload is the
    // honest way to drop all of it at once.
    blockPartner: async () => {
      if (!partner?.id) return { ok: false, message: 'Your partner could not be found. Try again in a moment.' }
      const res = await blockUser(partner.id)
      if (!res.ok) return { ok: false, message: res.message }
      window.location.href = '/onboarding'
      return OK
    },

    // leave_household() detaches this account and replaces the code behind
    // it. Shared history stays with the household: "move out", not "delete
    // our life together".
    leaveHome: async () => {
      const { error } = await supabase.rpc('leave_household')
      if (error) return { ok: false, message: "Couldn't leave just now. Try again in a moment." }
      window.location.href = '/onboarding'
      return OK
    },

    // delete_my_account() erases personal data, severs co-authored content
    // from this user and drops the auth row last. The session is dead once it
    // returns, so sign out locally rather than keep a token for no one.
    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) return { ok: false, message: "Couldn't delete the account just now. Try again in a moment." }
      await signOut()
      router.replace('/auth/login')
      return OK
    },
  }

  return (
    <SettingsView
      cat={settingsCat}
      onRetryCat={() => { void refetchStats() }}
      me={{
        name: profile.name,
        email: user.email ?? null,
        color: personColor(profile.heart),
        birthday: myBirthday !== undefined ? myBirthday : profile.birthday ?? null,
      }}
      partner={partner ? {
        id: partner.id,
        name: partner.name,
        color: personColor(partner.heart),
        birthday: partner.birthday ?? null,
      } : null}
      isSolo={isSolo}
      household={household}
      householdFailed={householdFailed}
      onRetryHousehold={() => setReload(n => n + 1)}
      prefs={prefs}
      notif={notif}
      theme={theme}
      actions={actions}
    />
  )
}
