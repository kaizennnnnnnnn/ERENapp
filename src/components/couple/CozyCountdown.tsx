'use client'

// ═════════════════════════════════════════════════════════════════════════════
// CozyCountdown — advent-style calendar of 12 pixel doors covering the 12 days
// that END on the couple's anniversary. One door per real local day (household
// tz); EITHER partner opens today's door once for the household via the
// zero-argument open_countdown_door() RPC (server derives day + reward, so
// races and double-taps resolve to one clean winner). Missed doors stay sealed.
//
// Renders null outside the window — the card "appears" when the countdown
// begins. Coins are credited server-side inside the RPC; we only show the +N
// (the HUD catches up on the next profile fetch, same as wish grants).
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { dateKey } from '@/lib/wishes'
import { countdownWindow, promptText, DOOR_COUNT } from '@/lib/countdown'
import { playSound } from '@/lib/sounds'
import { OBSIDIAN_FACE, OBSIDIAN_BTN, Rivets, ObsidianChip, pinkText } from '@/components/obsidian'
import { IconDoor, IconLock, IconCoin, IconHeartDuo, IconCake } from '@/components/PixelIcons'

const GOLD = '245,200,66'

interface DoorRow {
  period_key: string
  door_no: number
  opened_at: string
  opened_by: string | null
  reward_kind: 'coins' | 'prompt'
  coins_paid: number
  prompt_id: string | null
}

interface OpenDoorResult {
  ok: boolean
  reason?: string
  door_no?: number
  period_key?: string
  opened_by?: string
  reward_kind?: 'coins' | 'prompt'
  coins_paid?: number
  prompt_id?: string | null
}

type Props = {
  householdId: string
  userId: string
  partnerFirstName: string | null
}

// Realtime channels silently fail to subscribe on duplicate names — unique
// suffix per mount, same as useErenStats/useDailyWish.
let _channelCounter = 0

export default function CozyCountdown({ householdId, userId, partnerFirstName }: Props) {
  const supabase = createClient()
  const channelSuffix = useRef(`${++_channelCounter}`)

  const [anniversary, setAnniversary] = useState<string | null>(null)
  const [tz, setTz] = useState<string | null>(null)
  const [hhLoaded, setHhLoaded] = useState(false)
  const [doors, setDoors] = useState<Record<string, DoorRow>>({})
  const [opening, setOpening] = useState(false)
  // The reveal/detail overlay: `fresh` = just opened by me (celebration copy).
  const [viewing, setViewing] = useState<{ row: DoorRow; fresh: boolean } | null>(null)

  // Household anniversary + tz. tz must match what the RPC uses (households.tz),
  // NOT the device tz, so both sides agree on which day "today" is.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await withRetry(() => supabase
        .from('households').select('couple_anniversary, tz').eq('id', householdId).maybeSingle())
      if (cancelled || error) return // error ≠ "no anniversary" — stay hidden, retry next mount
      setAnniversary((data?.couple_anniversary as string | null) ?? null)
      setTz((data?.tz as string | null) ?? null)
      setHhLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayKey = hhLoaded ? dateKey(new Date(), tz) : null
  const win = anniversary && todayKey ? countdownWindow(anniversary, todayKey) : null

  // Load this window's opened doors + subscribe to the partner's opens.
  const windowStart = win?.days[0] ?? null
  useEffect(() => {
    if (!windowStart || !anniversary || !todayKey) return
    const w = countdownWindow(anniversary, todayKey)
    if (!w) return
    let cancelled = false

    async function load() {
      const { data } = await withRetry(() => supabase
        .from('countdown_doors')
        .select('period_key, door_no, opened_at, opened_by, reward_kind, coins_paid, prompt_id')
        .eq('household_id', householdId)
        .in('period_key', w!.days))
      if (cancelled || !data) return
      const next: Record<string, DoorRow> = {}
      for (const r of data as DoorRow[]) next[r.period_key] = r
      setDoors(next)
    }
    load()

    const ch = supabase
      .channel(`countdown:${householdId}:${channelSuffix.current}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'countdown_doors',
        filter: `household_id=eq.${householdId}`,
      }, payload => {
        const row = payload.new as DoorRow
        if (!w!.days.includes(row.period_key)) return
        setDoors(prev => ({ ...prev, [row.period_key]: row }))
      })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [householdId, windowStart, anniversary, todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpen = useCallback(async () => {
    if (opening) return
    setOpening(true)
    playSound('ui_tap')
    const { data, error } = await supabase.rpc('open_countdown_door')
    setOpening(false)
    if (error || !data) return
    const res = data as OpenDoorResult
    if ((res.ok || res.reason === 'already_opened') && res.period_key) {
      const row: DoorRow = {
        period_key: res.period_key,
        door_no: res.door_no ?? 0,
        opened_at: new Date().toISOString(),
        opened_by: res.opened_by ?? null,
        reward_kind: res.reward_kind ?? 'coins',
        coins_paid: res.coins_paid ?? 0,
        prompt_id: res.prompt_id ?? null,
      }
      setDoors(prev => ({ ...prev, [row.period_key]: row }))
      if (res.ok) {
        playSound('gift_open')
        setViewing({ row, fresh: true })
        try {
          window.dispatchEvent(new CustomEvent('eren:countdown-opened', { detail: row }))
        } catch { /* SSR/no-window */ }
      } else {
        // Partner won the race — show them who beat you to it.
        setViewing({ row, fresh: false })
      }
    }
    // outside_window / no_anniversary: next render recomputes and hides/moves the card.
  }, [opening]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!win) return null

  const daysLeft = DOOR_COUNT - 1 - win.todayIndex
  const partnerLabel = partnerFirstName ? partnerFirstName.toUpperCase() : 'PARTNER'

  return (
    <div className="mb-4 p-4 relative overflow-hidden" style={OBSIDIAN_FACE}>
      <Rivets inset={4} />

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <ObsidianChip accentRgb={GOLD}>
          <IconCake size={12} />
          <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>COZY COUNTDOWN</span>
        </ObsidianChip>
      </div>
      <p className="font-pixel mb-3" style={{ fontSize: 6, letterSpacing: 1.5, color: '#9A8A60' }}>
        {daysLeft === 0 ? "IT'S TODAY" : `${daysLeft} DAY${daysLeft === 1 ? '' : 'S'} TO YOUR ANNIVERSARY`}
      </p>

      {/* 12 doors, 4 × 3 */}
      <div className="grid grid-cols-4 gap-2">
        {win.days.map((day, i) => {
          const row = doors[day]
          const isToday = i === win.todayIndex
          const isFinal = i === DOOR_COUNT - 1

          if (row) {
            // Opened — warm-lit tile showing what was inside + who opened it.
            const mine = row.opened_by === userId
            return (
              <button
                key={day}
                onClick={() => { playSound('ui_tap'); setViewing({ row, fresh: false }) }}
                className="relative flex flex-col items-center justify-center gap-1 active:translate-y-[1px] transition-transform"
                style={{
                  ...OBSIDIAN_BTN,
                  aspectRatio: '1 / 1',
                  border: isToday ? `1.5px solid rgba(${GOLD},0.6)` : `1px solid rgba(${GOLD},0.3)`,
                  background: 'linear-gradient(180deg, #1d1a12 0%, #0a0805 100%)',
                }}
              >
                {row.reward_kind === 'coins'
                  ? <><IconCoin size={14} /><span className="font-pixel" style={{ fontSize: 6, color: '#F5C842' }}>+{row.coins_paid}</span></>
                  : <IconHeartDuo size={16} />}
                <span className="font-pixel" style={{ fontSize: 5, color: '#8A7A50', letterSpacing: 0.5 }}>
                  BY {mine ? 'YOU' : partnerLabel}
                </span>
              </button>
            )
          }
          if (isToday) {
            // Today's door — glowing and tappable.
            return (
              <button
                key={day}
                onClick={handleOpen}
                disabled={opening}
                className="relative flex flex-col items-center justify-center gap-1 active:translate-y-[1px] transition-transform"
                style={{
                  ...OBSIDIAN_BTN,
                  aspectRatio: '1 / 1',
                  border: `1.5px solid rgba(${GOLD},0.6)`,
                  animation: 'cdDoorPulse 2s ease-in-out infinite',
                  opacity: opening ? 0.6 : 1,
                }}
              >
                {isFinal ? <IconCake size={18} /> : <IconDoor size={18} />}
                <span className="font-pixel" style={{ fontSize: 5, color: '#F5C842', letterSpacing: 1 }}>
                  {opening ? '...' : 'OPEN'}
                </span>
              </button>
            )
          }
          if (day < win.days[win.todayIndex]) {
            // Missed — sealed forever (the RPC only ever opens today's door).
            return (
              <div
                key={day}
                className="relative flex flex-col items-center justify-center gap-1"
                style={{ ...OBSIDIAN_BTN, aspectRatio: '1 / 1', opacity: 0.4 }}
              >
                <IconLock size={12} />
                <span className="font-pixel" style={{ fontSize: 5, color: '#5A5A5A', letterSpacing: 1 }}>SEALED</span>
              </div>
            )
          }
          // Future door — numbered, waiting.
          return (
            <div
              key={day}
              className="relative flex flex-col items-center justify-center gap-1"
              style={{
                ...OBSIDIAN_BTN,
                aspectRatio: '1 / 1',
                opacity: 0.75,
                border: isFinal ? `1px solid rgba(${GOLD},0.45)` : (OBSIDIAN_BTN.border as string),
              }}
            >
              {isFinal
                ? <IconCake size={16} />
                : <span className="font-pixel" style={{ fontSize: 11, ...pinkText }}>{i + 1}</span>}
              <IconLock size={9} />
            </div>
          )
        })}
      </div>

      {/* Reveal / detail overlay — inside the card, obsidian scrim. */}
      {viewing && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-5 text-center"
          style={{ background: 'rgba(5,5,7,0.92)', animation: 'cdRevealIn 220ms cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          <Rivets inset={4} />
          <p className="font-pixel" style={{ fontSize: 7, letterSpacing: 2, color: '#9A8A60' }}>
            DOOR {viewing.row.door_no}
            {viewing.fresh ? '' : ` · BY ${viewing.row.opened_by === userId ? 'YOU' : partnerLabel}`}
          </p>
          {viewing.row.reward_kind === 'coins' ? (
            <div className="flex items-center gap-2">
              <IconCoin size={20} />
              <span className="font-pixel" style={{ fontSize: 16, ...pinkText }}>+{viewing.row.coins_paid} COINS</span>
            </div>
          ) : (
            <>
              <IconHeartDuo size={22} />
              <p style={{ fontSize: 12, lineHeight: 1.6, color: '#E8E0D0', maxWidth: 240 }}>
                {promptText(viewing.row.prompt_id) ?? 'a little something for you two.'}
              </p>
            </>
          )}
          <button
            onClick={() => { playSound('ui_modal_close'); setViewing(null) }}
            className="mt-2 px-4 py-2 relative active:translate-y-[1px] transition-transform"
            style={OBSIDIAN_BTN}
          >
            <Rivets inset={2} size={2} />
            <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, color: '#E8E0D0' }}>
              {viewing.fresh ? 'COZY' : 'CLOSE'}
            </span>
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes cdDoorPulse {
          0%, 100% { box-shadow: 0 0 4px rgba(${GOLD}, 0.25); }
          50%      { box-shadow: 0 0 14px rgba(${GOLD}, 0.55); }
        }
        @keyframes cdRevealIn {
          0%   { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
