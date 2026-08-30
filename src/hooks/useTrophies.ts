'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useTrophies — the trophy wallet.
//
// One provider for the whole app so the header counter, the shop and the
// verdict screen all read the same balance and all see a purchase land at the
// same moment. Same shape as DailyBattleProvider, and for the same reason: the
// home screen mounts half a dozen consumers.
//
// The balance lives on `profiles.trophies`, but this hook keeps its own copy
// rather than reading through useAuth, because useAuth has no refresh and a
// purchase has to move the number NOW.
//
// Every mutation goes through an RPC. There is deliberately no "add trophies"
// path — the only mint is claim_daily_trophy, exactly as the gacha deliberately
// has no add_stardust.
// ═══════════════════════════════════════════════════════════════════════════

import {
  useState, useEffect, useCallback, useRef,
  createContext, useContext, createElement, type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import { useCouple } from './useCouple'
import { shopItem } from '@/lib/trophyShop'

export interface OwnedTrophyItem {
  userId: string
  itemId: string
  quantity: number
}

export type BuyResult =
  | { ok: true; balance: number }
  | { ok: false; reason: 'insufficient' | 'already_owned' | 'unknown_item' | 'offline' }

export interface TrophiesState {
  /** False until the first successful read. Never treat 0 as "no trophies"
   *  before this flips — an outage reads exactly like a poor player. */
  loaded: boolean
  balance: number
  /** Everything either of us owns. Ownership is per-user; visibility is
   *  household, so the shop can show "she already has this". */
  owned: OwnedTrophyItem[]
  /** Quantity I own of one item. 0 = not owned. */
  qty(itemId: string): number
  mine(itemId: string): boolean
  buy(itemId: string): Promise<BuyResult>
  /** Consume one of a stackable item I own. Returns false if I had none. */
  spendOne(itemId: string): Promise<boolean>
  refresh(): Promise<void>
}

const TrophiesContext = createContext<TrophiesState | null>(null)

function useTrophiesImpl(): TrophiesState {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { partner } = useCouple()

  const [balance, setBalance] = useState(0)
  const [owned, setOwned] = useState<OwnedTrophyItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const failedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    const ids = [user.id, partner?.id].filter(Boolean) as string[]

    const [bal, items] = await Promise.all([
      withRetry(() => supabase
        .from('profiles')
        .select('trophies')
        .eq('id', user.id)
        .maybeSingle()),
      withRetry(() => supabase
        .from('user_trophy_items')
        .select('user_id, item_id, quantity')
        .in('user_id', ids)),
    ])

    // A 503 must not read as a zeroed wallet — keep what we had and let the
    // foreground listener try again.
    if (bal.error || items.error) { failedRef.current = true; return }
    failedRef.current = false

    setBalance(Number((bal.data as { trophies?: number } | null)?.trophies ?? 0))
    setOwned(((items.data ?? []) as { user_id: string; item_id: string; quantity: number }[])
      .map(r => ({ userId: r.user_id, itemId: r.item_id, quantity: r.quantity })))
    setLoaded(true)
  }, [user?.id, partner?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])

  // Seed from the profile we already have so the header shows a number before
  // the dedicated read lands. Deliberately does NOT set `loaded` — the profile
  // may itself predate the migration and report undefined.
  useEffect(() => {
    if (loaded || profile?.trophies == null) return
    setBalance(profile.trophies)
  }, [profile?.trophies, loaded])

  useEffect(() => onForeground(() => { if (failedRef.current || !loaded) refresh() }), [refresh, loaded])

  // A trophy mint happens in the verdict screen, which is a different subtree.
  useEffect(() => {
    const bump = (e: Event) => {
      const d = (e as CustomEvent<{ balance?: number }>).detail
      if (typeof d?.balance === 'number') setBalance(d.balance)
      else void refresh()
    }
    window.addEventListener('eren:trophy-payout', bump)
    return () => window.removeEventListener('eren:trophy-payout', bump)
  }, [refresh])

  const qty = useCallback((itemId: string) => {
    if (!user?.id) return 0
    return owned.find(o => o.userId === user.id && o.itemId === itemId)?.quantity ?? 0
  }, [owned, user?.id])

  const mine = useCallback((itemId: string) => qty(itemId) > 0, [qty])

  const buy = useCallback(async (itemId: string): Promise<BuyResult> => {
    if (!user?.id) return { ok: false, reason: 'offline' }
    const { data, error } = await supabase.rpc('purchase_trophy_item', { p_item_id: itemId })
    if (error || !data) return { ok: false, reason: 'offline' }
    const r = data as { ok?: boolean; reason?: string; balance?: number }
    if (!r.ok) {
      if (typeof r.balance === 'number') setBalance(r.balance)
      const reason = r.reason
      return {
        ok: false,
        reason: reason === 'insufficient' || reason === 'already_owned' || reason === 'unknown_item'
          ? reason : 'offline',
      }
    }
    const next = Number(r.balance ?? 0)
    setBalance(next)
    // Optimistic ownership so the card flips without a round-trip. The
    // authoritative list still refreshes underneath.
    setOwned(prev => {
      const i = prev.findIndex(o => o.userId === user.id && o.itemId === itemId)
      if (i === -1) return [...prev, { userId: user.id, itemId, quantity: 1 }]
      const copy = [...prev]
      copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 }
      return copy
    })
    void refresh()
    return { ok: true, balance: next }
  }, [user?.id, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Burn one of a consumable. Plain UPDATE rather than an RPC: the row is
   * mine, the guard `quantity >= 1` is in the WHERE clause, and the worst a
   * lost race can do is refuse a use I actually had — never grant a free one.
   */
  const spendOne = useCallback(async (itemId: string): Promise<boolean> => {
    if (!user?.id) return false
    const have = qty(itemId)
    if (have < 1) return false
    const { data } = await supabase
      .from('user_trophy_items')
      .update({ quantity: have - 1 })
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .eq('quantity', have)
      .select('item_id')
    if (!data || data.length === 0) { void refresh(); return false }
    setOwned(prev => prev.map(o =>
      o.userId === user.id && o.itemId === itemId ? { ...o, quantity: o.quantity - 1 } : o))
    return true
  }, [user?.id, qty, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  return { loaded, balance, owned, qty, mine, buy, spendOne, refresh }
}

export function TrophiesProvider({ children }: { children: ReactNode }) {
  const value = useTrophiesImpl()
  return createElement(TrophiesContext.Provider, { value }, children)
}

export function useTrophies(): TrophiesState {
  const ctx = useContext(TrophiesContext)
  if (!ctx) throw new Error('useTrophies must be used inside <TrophiesProvider>')
  return ctx
}

/** Items of a kind that I own, in catalogue order. */
export function ownedOfKind(state: TrophiesState, userId: string, kind: string): string[] {
  return state.owned
    .filter(o => o.userId === userId && o.quantity > 0)
    .map(o => o.itemId)
    .filter(id => shopItem(id)?.kind === kind)
}
