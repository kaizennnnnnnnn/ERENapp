'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useGarden — the household's garden, live on both phones.
//
// One read of the household's garden_plants rows (beds, baskets, vases and
// the book are all derived from it), refetched whenever a row changes —
// your partner watering shows up while you are standing there. Every write
// is an RPC (supabase/migration_garden.sql) that decides the day, the growth
// and the colours itself.
//
// Opening the garden calls garden_tend(false): it learns the household's
// "today" and lets any rain in, and writes nothing on a dry day.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { BEDS, wateredToday, type GardenPlant, type Species } from '@/lib/garden'

let _gardenChannelCounter = 0

/** How long a flower stays in a vase. */
const VASE_DAYS = 7

export type GardenResult = { ok: true } | { ok: false; reason: string }

export interface GardenState {
  loading: boolean
  /** The table is missing (migration not run) or the read failed. */
  failed: boolean
  /** The household's local day, as the server counts it. */
  today: string
  raining: boolean
  /** Bed index -> what is growing there. */
  beds: (GardenPlant | null)[]
  /** Flowers I picked and have not put in a vase yet. */
  basket: GardenPlant[]
  /** Flowers in my vase this week (mine, or given to me). */
  vase: GardenPlant[]
  /** `${species}:${colour}` -> how many have ever bloomed here. */
  book: Map<string, number>
  plantedToday: boolean
  /** Every growing plant already has my watering today (true when nothing is growing). */
  wateredToday: boolean
  growing: number
  plant: (slot: number, species: Species) => Promise<GardenResult>
  water: () => Promise<GardenResult & { bloomed?: number }>
  pick: (id: string) => Promise<GardenResult>
  place: (ids: string[], to: string) => Promise<GardenResult>
}

const localDay = () => format(new Date(), 'yyyy-MM-dd')

export function useGarden(householdId: string | null, userId: string | null): GardenState {
  const supabase = useMemo(() => createClient(), [])
  const channelSuffix = useRef(`${++_gardenChannelCounter}_${Math.random().toString(36).slice(2, 8)}`)

  const [rows, setRows] = useState<GardenPlant[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [today, setToday] = useState(localDay)
  const [raining, setRaining] = useState(false)
  const failedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    if (!householdId) { setRows([]); setLoading(false); return }
    const { data, error } = await withRetry(() => supabase
      .from('garden_plants')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1000))
    failedRef.current = !!error
    setFailed(!!error)
    // Keep what we had on a failed read: an outage must not empty the beds.
    if (!error) setRows((data as GardenPlant[] | null) ?? [])
    setLoading(false)
  }, [householdId, supabase])

  type TendReply = { ok: boolean; today?: string; raining?: boolean; bloomed?: number; reason?: string }
  const tend = useCallback(async (water: boolean): Promise<TendReply> => {
    const { data, error } = await supabase.rpc('garden_tend', { p_water: water })
    if (error) return { ok: false, reason: 'offline' }
    const r = data as TendReply
    if (r.today) setToday(r.today)
    if (typeof r.raining === 'boolean') setRaining(r.raining)
    return r
  }, [supabase])

  // Open: let the rain in and learn "today", then read.
  useEffect(() => {
    let dead = false
    ;(async () => {
      await tend(false)
      if (!dead) await fetchAll()
    })()
    return () => { dead = true }
  }, [tend, fetchAll])

  useEffect(() => onForeground(() => { if (failedRef.current) void fetchAll() }), [fetchAll])

  // Live: any change to this household's garden refetches (debounced, so a
  // watering that touches six beds is one read, not six).
  useEffect(() => {
    if (!householdId) return
    let t: ReturnType<typeof setTimeout> | null = null
    const ch = supabase.channel(`garden_plants:${householdId}:${channelSuffix.current}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'garden_plants', filter: `household_id=eq.${householdId}` },
        () => {
          if (t) clearTimeout(t)
          t = setTimeout(() => { void fetchAll() }, 250)
        })
      .subscribe()
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch) }
  }, [householdId, supabase, fetchAll])

  const derived = useMemo(() => {
    const beds: (GardenPlant | null)[] = Array.from({ length: BEDS }, () => null)
    const basket: GardenPlant[] = []
    const vase: GardenPlant[] = []
    const book = new Map<string, number>()
    const vaseFrom = Date.now() - VASE_DAYS * 86_400_000
    let plantedToday = false
    for (const p of rows) {
      if (!p.picked_at && p.slot >= 0 && p.slot < BEDS) beds[p.slot] = p
      if (p.picked_at && p.picked_by === userId && !p.placed_at) basket.push(p)
      if (p.placed_at && p.vase_of === userId && new Date(p.placed_at).getTime() >= vaseFrom) vase.push(p)
      if (p.bloomed_at && p.color) {
        const k = `${p.species}:${p.color}`
        book.set(k, (book.get(k) ?? 0) + 1)
      }
      if (p.planted_by === userId && p.planted_day === today) plantedToday = true
    }
    const growingPlants = beds.filter((p): p is GardenPlant => !!p && !p.bloomed_at)
    const watered = growingPlants.every(p => !!userId && wateredToday(p, today).includes(userId))
    vase.sort((a, b) => (b.placed_at ?? '').localeCompare(a.placed_at ?? ''))
    return { beds, basket, vase, book, plantedToday, wateredToday: watered, growing: growingPlants.length }
  }, [rows, userId, today])

  const call = useCallback(async (fn: string, args: Record<string, unknown>): Promise<GardenResult> => {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) return { ok: false, reason: 'offline' }
    const r = data as { ok: boolean; reason?: string }
    await fetchAll()
    return r.ok ? { ok: true } : { ok: false, reason: r.reason ?? 'failed' }
  }, [supabase, fetchAll])

  const plant = useCallback((slot: number, species: Species) =>
    call('garden_plant', { p_slot: slot, p_species: species }), [call])
  const pick = useCallback((id: string) => call('garden_pick', { p_id: id }), [call])
  const place = useCallback((ids: string[], to: string) =>
    call('garden_place', { p_ids: ids, p_to: to }), [call])
  const water = useCallback(async () => {
    const r = await tend(true)
    await fetchAll()
    return r.ok ? { ok: true as const, bloomed: r.bloomed ?? 0 } : { ok: false as const, reason: r.reason ?? 'failed' }
  }, [tend, fetchAll])

  return { loading, failed, today, raining, ...derived, plant, water, pick, place }
}
