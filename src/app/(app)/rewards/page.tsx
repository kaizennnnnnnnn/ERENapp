'use client'

import { SkeletonContent, SkeletonBlock } from '@/components/loading/LoadingSkeleton'

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
// A claim saves the whole reward pack and its high-water mark in one
// transaction. A saved request survives a lost reply and recovers that pack.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { pendingRewardSaves, rewardSaveError } from '@/lib/rewardSaves'
import { useCat } from '@/hooks/useCat'
import { useErenStats } from '@/hooks/useErenStats'
import { useCare } from '@/contexts/CareContext'
import { usePageReady } from '@/hooks/usePageReady'
import { LEVEL_REWARDS, MAX_LEVEL } from '@/lib/levelRewards'
import { getSkin, type SkinDef } from '@/lib/skins'
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
  const { refetch } = useErenStats(profile?.household_id ?? null)
  const { claimLevelRewards } = useTasks()
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
  // An outage must not present old levels as newly claimable.
  const [claimedLoaded, setClaimedLoaded] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [result, setResult] = useState<ClaimResult | null>(null)
  const [openedTiers, setOpenedTiers] = useState<ReadonlySet<number>>(new Set())
  const [focusTier, setFocusTier] = useState<number | null>(null)
  // Where focus goes after a claim: the row that was tapped folds away into
  // "claimed", and the sheet hands focus back to whatever held it.
  const statusRef = useRef<HTMLDivElement>(null)
  const claimLock = useRef(false)
  const actorRef = useRef(user?.id)
  const householdRef = useRef(profile?.household_id)
  const live = useRef(true)
  const [pendingTarget, setPendingTarget] = useState<number | null>(null)
  actorRef.current = user?.id
  householdRef.current = profile?.household_id
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  useEffect(() => {
    setClaimedLoaded(false)
    setClaimError(null)
    setResult(null)
    setPendingTarget(null)
    if (!user?.id) return
    let cancelled = false, loaded = false
    const pending = () => {
      const request = pendingRewardSaves(user.id).find(item => item.args.p_kind === 'road'
        && (item.args.p_input as Record<string, unknown>).householdId === profile?.household_id)
      const target = (request?.args.p_input as Record<string, unknown> | undefined)?.target
      setPendingTarget(typeof target === 'number' ? target : null)
    }
    const load = async () => {
      const { data, error } = await withRetry(() => supabase.from('profiles').select('claimed_level').eq('id', user.id).maybeSingle())
      if (cancelled || actorRef.current !== user.id || householdRef.current !== profile?.household_id || error || !data) return
      loaded = true
      setClaimedLevel(typeof data.claimed_level === 'number' ? data.claimed_level : 0)
      setClaimedLoaded(true)
    }
    pending()
    void load()
    const stop = onForeground(() => { pending(); if (!loaded) void load() })
    return () => { cancelled = true; stop() }
  }, [user?.id, profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

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
<SkeletonContent layout="rewards" label="Loading your level" />
      </MeadowPage>
    )
  }

  const reachable = Math.min(level, MAX_LEVEL)
  const waiting = claimedLoaded ? Math.max(0, reachable - claimedLevel) : 0
  const xpInto = Math.max(0, xp - totalXpForLevel(level))
  const xpNeeded = xpForNextLevel(level)
  const allClaimed = claimedLoaded && claimedLevel >= MAX_LEVEL

  async function claimUpTo(target: number) {
    if (!user?.id || !profile?.household_id || claimLock.current || !claimedLoaded) return
    if (pendingTarget === null && (target <= claimedLevel || target > reachable)) return
    const actor = user.id
    const household = profile.household_id
    const active = () => live.current && actorRef.current === actor && householdRef.current === household
    claimLock.current = true
    setClaiming(true)
    setClaimError(null)
    playSound('gift_open')
    try {
      // The journal retains the original target, including after another device
      // advances the road or the original reply is lost.
      const saved = await claimLevelRewards(pendingTarget ?? target, profile.household_id)
      if (!active()) return
      if (!saved.ok || !saved.profile) {
        setClaimError(rewardSaveError(saved.reason))
        return
      }
      setClaimedLevel(saved.profile.claimed_level ?? 0)
      statusRef.current?.focus({ preventScroll: true })
      const road = saved.outcome?.road
      if (road) {
        playSound('quest_complete')
        setResult({ ...road, skins: road.skinIds.map(getSkin).filter((skin): skin is SkinDef => !!skin) })
        void refetch()
      }
    } catch {
      if (active()) setClaimError(OFFLINE)
    } finally {
      claimLock.current = false
      if (live.current) {
        setClaiming(false)
        if (active()) {
          const pending = pendingRewardSaves(actor).find(item => item.args.p_kind === 'road'
            && (item.args.p_input as Record<string, unknown>).householdId === profile?.household_id)
          const target = (pending?.args.p_input as Record<string, unknown> | undefined)?.target
          setPendingTarget(typeof target === 'number' ? target : null)
        }
      }
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
            <div role="status" aria-label="Loading your rewards" aria-busy="true">
              <SkeletonBlock height={44} />
            </div>
          ) : pendingTarget !== null ? (
            <PrimaryButton size="md" full busy={claiming} onClick={() => claimUpTo(pendingTarget)}
              icon={<MeadowIcon name="gift" size={20} color="#FFFFFF" />}>
              {claiming ? 'Recovering...' : 'Recover your rewards'}
            </PrimaryButton>
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
                          busy={claiming || pendingTarget !== null}
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
