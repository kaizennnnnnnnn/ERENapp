'use client'

// ─── The reward road ─────────────────────────────────────────────────────────
// One reward per level, 100 of them (lib/levelRewards). The level circle in
// the top bar opens it.
//
// Top: your level, how far into it you are, and the one leaf button, "Claim",
// while anything is waiting. Then the road from the first level you haven't
// claimed: what's waiting, the cat standing at the level you're heading for,
// and what's ahead, in tens. The tens close to you are open; the far ones are
// folded to their highlights until you open them (100 rows of real art is a
// lot of pictures to fetch for a list nobody scrolls to the end of).
//
// Claimed levels fold into one line. The table was renewed on 2026-10-06, so
// a level claimed before that paid the old reward, and listing the new one
// with a tick would show something the player never got.
//
// A claim pays the whole run from the first unclaimed level up to the one
// tapped (claimed_level is one high-water mark), checks every write, and
// lands the coins and the new claimed_level together in one write at the
// end, so a failure leaves the levels claimable.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withRetry, writeWithRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { PROFILE_UPDATED_EVENT, useAuth, type ProfileUpdatedDetail } from '@/hooks/useAuth'
import { useCat } from '@/hooks/useCat'
import { useErenStats } from '@/hooks/useErenStats'
import { useCare } from '@/contexts/CareContext'
import { usePageReady } from '@/hooks/usePageReady'
import { LEVEL_REWARDS, MAX_LEVEL, type SkinBoxRarity } from '@/lib/levelRewards'
import { batchFor, pickSkin, readHouseholdSkins } from '@/lib/rewardClaim'
import { grantSkin } from '@/lib/skinGrant'
import { SKIN_STARDUST_PRICE, type SkinDef } from '@/lib/skins'
import { getLevelTitle, totalXpForLevel, xpForNextLevel } from '@/lib/tasks'
import { playSound } from '@/lib/sounds'
import AnimatedEren from '@/components/AnimatedEren'
import RoadRow from '@/components/rewards/RoadRow'
import ClaimedSheet, { type ClaimResult } from '@/components/rewards/ClaimedSheet'
import { fmt, itemTitle } from '@/components/rewards/rewardDisplay'
import {
  Card, CheckDisc, Divider, LevelRing, MeadowIcon, MeadowPage, PrimaryButton, SectionLabel, Tag,
  M, TYPE,
} from '@/components/meadow'

const TIER = 10
const tierOf = (level: number) => Math.floor((level - 1) / TIER)
const tierId = (t: number) => `reward-tier-${t}`

const OFFLINE = "That didn't go through. Check your connection and try again."

export default function RewardsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const cat = useCat()
  const { stats, addManyToMyFood, refetch } = useErenStats(profile?.household_id ?? null)
  const { setHideStats } = useCare()
  // The page carries its own level; the top bar would only repeat it.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  // From the page's own fresh profile read, not TaskContext, which flashed
  // "level 1" on entry while it synced.
  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0

  const [claimedLevel, setClaimedLevel] = useState(0)
  // False until the claimed_level read succeeds. A 503 that read as 0 would
  // make every level claimable again, and claiming would pay them twice.
  const [claimedLoaded, setClaimedLoaded] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [result, setResult] = useState<ClaimResult | null>(null)
  const [openedTiers, setOpenedTiers] = useState<ReadonlySet<number>>(new Set())
  const [focusTier, setFocusTier] = useState<number | null>(null)
  // Where focus goes after a claim: the row that was tapped folds away into
  // "claimed", and the sheet hands focus back to whatever held it.
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.id) return
    let loaded = false
    const load = () => {
      withRetry(() => supabase.from('profiles').select('claimed_level').eq('id', user.id).maybeSingle())
        .then(({ data, error }) => {
          if (error) return // outage: stay unloaded; coming back to the app retries
          loaded = true
          setClaimedLevel(typeof data?.claimed_level === 'number' ? data.claimed_level : 0)
          setClaimedLoaded(true)
        })
    }
    load()
    return onForeground(() => { if (!loaded) load() })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // A failure shows where you are on the page, then goes.
  useEffect(() => {
    if (!claimError) return
    const t = setTimeout(() => setClaimError(null), 5000)
    return () => clearTimeout(t)
  }, [claimError])

  // A ten you open replaces the button you pressed; carry focus into it.
  useEffect(() => {
    if (focusTier === null) return
    document.getElementById(tierId(focusTier))?.focus()
    setFocusTier(null)
  }, [focusTier])

  usePageReady(!!user && !!profile)

  const exit = () => {
    playSound('ui_back')
    // replace, not back(): a page opened with no history has nothing to go back to.
    router.replace('/home')
  }

  if (!user || !profile) {
    return (
      <MeadowPage ground="me" title="Reward road" back={{ onClick: exit, label: 'Back to home' }} withNav={false}>
        <p role="status" style={{ margin: '18px 8px 0', fontSize: 15, fontWeight: 600, color: M.text2 }}>Loading your level...</p>
      </MeadowPage>
    )
  }

  const reachable = Math.min(level, MAX_LEVEL)
  const waiting = claimedLoaded ? Math.max(0, reachable - claimedLevel) : 0
  const xpInto = Math.max(0, xp - totalXpForLevel(level))
  const xpNeeded = xpForNextLevel(level)
  const allClaimed = claimedLoaded && claimedLevel >= MAX_LEVEL

  // A claim that can't finish says so and leaves its levels claimable; a
  // silent return reads as a dead button.
  function failClaim(message = OFFLINE) {
    setClaimError(message)
  }

  async function claimUpTo(target: number) {
    if (!user?.id || !profile?.household_id || claiming || !claimedLoaded) return
    if (target <= claimedLevel || target > reachable) return
    playSound('gift_open')
    setClaimError(null)
    setClaiming(true)
    try {
      const from = claimedLevel + 1
      const batch = batchFor(from, target)

      // The fridge write can't land before the household's stats have, so a
      // claim with food stops here, before anything is paid, not after.
      if (batch.foods.length > 0 && !stats) return failClaim('Your fridge is still loading. Try again in a moment.')

      // ── Reads, every one checked: a 503 must never read as "nothing there".
      // The profile is read fresh rather than taken from memory: the coins are
      // written from it, and another device may have claimed in the meantime.
      const { data: fresh, error: freshError } = await withRetry(() => supabase
        .from('profiles').select('claimed_level, coins').eq('id', user.id).maybeSingle())
      if (freshError || !fresh) return failClaim()
      const freshClaimed = typeof fresh.claimed_level === 'number' ? fresh.claimed_level : 0
      if (freshClaimed !== claimedLevel) {
        // Claimed somewhere else since this page loaded: show the road as it is.
        setClaimedLevel(freshClaimed)
        return
      }
      let owned: Set<string> | null = null
      if (batch.skinBoxes.length > 0) {
        owned = await readHouseholdSkins(supabase, profile.household_id)
        if (!owned) return failClaim()
      }
      let gacha: { stardust?: number; gacha_tickets?: number } | null = null
      const touchesGacha = batch.stardust > 0 || batch.tickets > 0 || batch.skinBoxes.length > 0
      if (touchesGacha) {
        const { data, error } = await withRetry(() => supabase
          .from('user_gacha_state').select('stardust, gacha_tickets').eq('user_id', user.id).maybeSingle())
        if (error) return failClaim()
        gacha = data
      }

      // ── Writes. Every one is checked, and claimed_level moves only in the
      // last one, so a level's rewards are minted once and a failure leaves
      // it claimable. The cost: a failure BETWEEN two writes can pay the
      // earlier one twice on a retry (a box opens to a second look). A rare
      // over-payment in the player's favour beats a silent loss they can
      // never get back.
      //
      // Food first, into the claimer's own pile like the shop and the gacha
      // (the old road filled the shared legacy pool, which wishes and gifts
      // can't see).
      if (batch.foods.length > 0 && !(await addManyToMyFood(user.id, batch.foods))) {
        // The fridge already shows them on this phone. Put it back to what the
        // database holds, or a retry would stack the same food on top.
        await refetch()
        return failClaim()
      }

      // Looks: the insert is idempotent, and a box whose rarity the household
      // already owns every look of pays that look's stardust price instead.
      const skins: SkinDef[] = []
      const converted: SkinBoxRarity[] = []
      for (const rarity of batch.skinBoxes) {
        const pick = owned ? pickSkin(rarity, owned) : null
        if (!pick) { converted.push(rarity); continue }
        if (await grantSkin(user.id, pick.id) === 'failed') return failClaim()
        owned?.add(pick.id)
        skins.push(pick)
      }
      const boxDust = converted.reduce((sum, r) => sum + SKIN_STARDUST_PRICE[r], 0)

      const stardust = batch.stardust + boxDust
      if (stardust > 0 || batch.tickets > 0) {
        const { error } = gacha
          ? await writeWithRetry(signal => supabase.from('user_gacha_state').update({
              stardust: (gacha?.stardust ?? 0) + stardust,
              gacha_tickets: (gacha?.gacha_tickets ?? 0) + batch.tickets,
            }).eq('user_id', user.id).abortSignal(signal))
          // Genuinely no row yet (no rows, not an error).
          : await writeWithRetry(signal => supabase.from('user_gacha_state').insert({
              user_id: user.id, stardust, gacha_tickets: batch.tickets,
              pulls_since_epic: 0, pulls_since_legendary: 0, total_pulls: 0,
            }).abortSignal(signal))
        if (error) return failClaim()
      }

      // Coins and the new mark in one write, and only if claimed_level is
      // still where this claim started: two phones claiming at once can't
      // both pay, and the mark never moves backwards.
      const coins = (typeof fresh.coins === 'number' ? fresh.coins : 0) + batch.coins
      const { data: stamped, error: stampError } = await writeWithRetry(signal => supabase
        .from('profiles').update({ coins, claimed_level: target })
        .eq('id', user.id).eq('claimed_level', claimedLevel).select('id').abortSignal(signal))
      if (stampError) return failClaim()
      if (!stamped?.length) {
        // Nothing matched. Either a retry of this write already landed (the
        // first answer was lost) or another device claimed first.
        const { data: now } = await withRetry(() => supabase
          .from('profiles').select('claimed_level').eq('id', user.id).maybeSingle())
        if (now?.claimed_level !== target) {
          if (typeof now?.claimed_level === 'number') setClaimedLevel(now.claimed_level)
          return failClaim('These were just claimed on another device.')
        }
      }

      // Every copy of the profile (the top bar's coins, TaskContext) takes
      // the new balance, and the top bar's waiting badge recounts.
      try {
        window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, {
          detail: { id: user.id, patch: { coins, claimed_level: target } },
        }))
        window.dispatchEvent(new Event('eren:rewards-claimed'))
      } catch { /* ignore */ }
      statusRef.current?.focus({ preventScroll: true })
      setClaimedLevel(target)
      playSound('quest_complete')
      setResult({ from, to: target, coins: batch.coins, stardust, tickets: batch.tickets, foods: batch.foods, skins, boxDust, converted })
    } finally {
      setClaiming(false)
    }
  }

  // ── The road, from the first unclaimed level ─────────────────────────────
  const start = Math.min(claimedLevel + 1, MAX_LEVEL)
  const nextLevel = level + 1
  const lastTier = tierOf(MAX_LEVEL)
  // Open: from the first unclaimed ten to one past the ten the cat is in.
  const openUntil = Math.min(lastTier, tierOf(Math.min(nextLevel, MAX_LEVEL)) + 1)
  const tiers: number[] = []
  for (let t = tierOf(start); t <= lastTier; t++) tiers.push(t)

  const span = (a: number, b: number) => (a === b ? `Level ${a}` : `Levels ${a}–${b}`)

  return (
    <MeadowPage ground="me" title="Reward road" back={{ onClick: exit, label: 'Back to home' }} withNav={false}>
      {/* ── Your level and the one button ── */}
      <Card style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LevelRing level={level} progress={xpInto / xpNeeded} size={64} surface="white"
            ariaLabel={`Level ${level}, ${xpInto} of ${xpNeeded} XP`} />
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Level {level}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: M.text2 }}>{getLevelTitle(level)}</div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(xpInto)} / {fmt(xpNeeded)} XP
            </div>
          </div>
        </div>

        <Divider style={{ margin: '16px 0 14px' }} />

        <div ref={statusRef} tabIndex={-1} style={{ outline: 'none' }}>
          {!claimedLoaded ? (
            <p role="status" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: M.text2 }}>Loading your rewards...</p>
          ) : allClaimed ? (
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: M.leafInk }}>Every reward on the road is yours.</p>
          ) : waiting > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>
                  <span style={{ color: M.text, ...TYPE.number }}>{claimedLevel}</span> of {MAX_LEVEL} claimed
                </span>
                <Tag tone="love">{waiting} waiting</Tag>
              </div>
              <PrimaryButton size="md" full busy={claiming} onClick={() => claimUpTo(reachable)}
                icon={<MeadowIcon name="gift" size={20} color="#FFFFFF" />}>
                {claiming ? 'Claiming...' : waiting === 1 ? 'Claim your reward' : `Claim all ${waiting}`}
              </PrimaryButton>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: M.text2 }}>
              <span style={{ color: M.text, ...TYPE.number }}>{claimedLevel}</span> of {MAX_LEVEL} claimed.
              {' '}The next one is at level {Math.min(nextLevel, MAX_LEVEL)}.
            </p>
          )}
        </div>
      </Card>

      {/* ── The road ── */}
      {claimedLoaded && (allClaimed ? (
        <Card style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
          <AnimatedEren px={3} glow={false} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>{cat.t('{name} walked the whole road with you.')}</span>
        </Card>
      ) : (
        <>
          {claimedLevel > 0 && (
            <Card style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckDisc />
              <span style={{ fontSize: 16, fontWeight: 800 }}>{span(1, claimedLevel)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600, color: M.text2 }}>Claimed</span>
            </Card>
          )}

          {tiers.map(t => {
            const a = Math.max(start, t * TIER + 1)
            const b = Math.min(MAX_LEVEL, t * TIER + TIER)
            const rewards = LEVEL_REWARDS.slice(a - 1, b)
            const open = t <= openUntil || openedTiers.has(t)
            if (!open) {
              const highlights = rewards.filter(r => r.milestone)
                .map(r => `${itemTitle(r.items[0])} at ${r.level}`).join(' · ')
              return (
                <Card key={t}
                  onClick={() => { playSound('ui_tap'); setOpenedTiers(s => new Set(s).add(t)); setFocusTier(t) }}
                  ariaLabel={`Show ${span(a, b)}: ${highlights}`}
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{span(a, b)}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{highlights}</span>
                  </span>
                  <MeadowIcon name="chevronRight" size={20} color={M.faint} style={{ transform: 'rotate(90deg)' }} />
                </Card>
              )
            }
            return (
              <section key={t} id={tierId(t)} tabIndex={-1} aria-label={span(a, b)} style={{ outline: 'none' }}>
                <SectionLabel>{span(a, b)}</SectionLabel>
                <Card padding="2px 14px">
                  <div role="list">
                    {rewards.map((r, i) => {
                      const state = r.level <= reachable ? 'claimable' : r.level === nextLevel ? 'next' : 'locked'
                      return (
                        <RoadRow
                          key={r.level}
                          reward={r}
                          state={state}
                          first={i === 0}
                          last={i === rewards.length - 1}
                          travelledAbove={r.level <= nextLevel}
                          travelledBelow={r.level <= level}
                          progress={state === 'next' ? { into: xpInto, needed: xpNeeded } : undefined}
                          cat={cat}
                          busy={claiming}
                          onClaim={state === 'claimable' ? () => claimUpTo(r.level) : undefined}
                        />
                      )
                    })}
                  </div>
                </Card>
              </section>
            )
          })}
        </>
      ))}

      {/* A failed claim, shown wherever you are on the road, not in the card
          at the top that may be a screen away. */}
      {claimError && (
        <div role="alert" style={{
          position: 'fixed', left: 16, right: 16, bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          zIndex: 70, maxWidth: 420, margin: '0 auto', padding: '12px 16px', borderRadius: 16,
          background: '#FFFFFF', boxShadow: `0 3px 0 ${M.overArtLip}`,
          fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.danger, textAlign: 'center',
        }}>
          {claimError}
        </div>
      )}

      <ClaimedSheet result={result} onClose={() => { playSound('ui_modal_close'); setResult(null) }} />
    </MeadowPage>
  )
}
