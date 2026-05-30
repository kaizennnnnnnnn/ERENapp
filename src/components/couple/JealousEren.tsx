'use client'

// JealousEren — a very-rare floating speech bubble that pops above
// Eren when one partner has clearly out-cared the other today. It's
// the same line for both viewers: it names whoever is in the lead so
// the partners get a shared "leaderboard" moment. Fires at most once
// every six hours per device and even then only ~12% of opens, so it
// stays a surprise instead of a nag.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { playSound } from '@/lib/sounds'

const COOLDOWN_MS    = 6 * 60 * 60 * 1000  // at most once per 6h
const ROLL_THRESHOLD = 0.12                // ~12% of eligible opens
const DELTA_FLOOR    = 2                   // partner must lead by ≥ this many actions
const VISIBLE_MS     = 7000                // how long the bubble stays
const Z_INDEX        = 45                  // sits below modals (popups are 70+)

// Message bank. `{leader}` is the name of whichever partner did more
// care today — the SAME name for both viewers, since it's a shared
// leaderboard moment, not a personal callout. Gender-neutral wording
// so the line reads cleanly for any name.
const LINES = [
  'today\'s MVP is {leader}!',
  '{leader} is currently my favourite human, just saying.',
  'I think {leader} loves me more.',
  'Do you care about me?',
  '{leader} fed me more.',
  '{leader} has more points than you, hehe.',
  'I guess {leader} cares more about me today.',
  'I love you both!',
  'I\'m so happy!',
  'I\'m watching you (betta feed me), {leader}.',
  'I think {leader} loves you.',
]

export default function JealousEren() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { partner } = useCouple()
  const [line, setLine] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id || !profile?.household_id || !partner?.id || !partner?.name) return

    let cancelled = false

    async function maybeShow() {
      // Cooldown gate (per device).
      const key = `eren_jealous_last_${user!.id}`
      const lastIso = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      const lastMs = lastIso ? new Date(lastIso).getTime() : 0
      if (Date.now() - lastMs < COOLDOWN_MS) return

      // Rare even when eligible.
      if (Math.random() > ROLL_THRESHOLD) return

      // Today's care interactions, per user.
      const since = new Date()
      since.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('interactions')
        .select('user_id, action_type')
        .eq('household_id', profile!.household_id!)
        .gte('created_at', since.toISOString())

      if (!data || cancelled) return

      let mine = 0
      let theirs = 0
      for (const row of data as { user_id: string }[]) {
        if (row.user_id === user!.id) mine++
        else if (row.user_id === partner!.id) theirs++
      }
      // Trigger whenever EITHER partner is clearly ahead today.
      // Both viewers see the same line naming whoever leads, so it
      // reads as a shared scoreboard moment rather than a personal
      // jab.
      const diff = Math.abs(mine - theirs)
      if (diff < DELTA_FLOOR) return

      const leaderProfile = mine > theirs ? profile! : partner!
      const leaderFirst = (leaderProfile.name ?? '').split(' ')[0] || 'they'

      // Stamp the cooldown only when we actually show — so a roll
      // that didn't fire can be rolled again later.
      try { localStorage.setItem(key, new Date().toISOString()) } catch { /* ignore */ }

      const template = LINES[Math.floor(Math.random() * LINES.length)]
      setLine(template.replaceAll('{leader}', leaderFirst))

      playSound('ui_modal_open')
      setTimeout(() => { if (!cancelled) setLine(null) }, VISIBLE_MS)
    }

    // Wait a beat after mount so the home screen has finished its
    // entrance animation before the bubble appears.
    const t = setTimeout(maybeShow, 1800)
    return () => { cancelled = true; clearTimeout(t) }
  }, [user?.id, profile?.household_id, partner?.id, partner?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!line) return null

  return (
    <div
      className="fixed flex flex-col items-center pointer-events-auto"
      style={{
        // Sits just above Eren on the right-hand side, mirroring
        // where the ThoughtCloud anchors so the two don't fight for
        // the same airspace.
        bottom: '38%',
        left: '32%',
        transform: 'translateX(-50%)',
        zIndex: Z_INDEX,
        animation: 'jeIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        maxWidth: '70vw',
      }}
      onClick={() => { playSound('ui_modal_close'); setLine(null) }}
    >
      {/* Speech bubble */}
      <div
        style={{
          background: '#FFFFFF',
          border: '3px solid #1F1F2E',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.35)',
          padding: '8px 10px',
          imageRendering: 'pixelated',
        }}
      >
        <p className="font-pixel" style={{
          fontSize: 6, color: '#A78BFA', letterSpacing: 1.5, marginBottom: 4,
        }}>EREN WHISPERS</p>
        <p className="text-[11px] leading-snug" style={{ color: '#1F1F2E' }}>{line}</p>
      </div>
      {/* Pixel tail pointing down to Eren */}
      <div style={{
        marginTop: -2,
        width: 0, height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '10px solid #1F1F2E',
      }} />
      <div style={{
        marginTop: -12,
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '6px solid #FFFFFF',
      }} />

      <style jsx>{`
        @keyframes jeIn {
          0%   { transform: translate(-50%, 16px) scale(0.6); opacity: 0; }
          60%  { transform: translate(-50%, -4px) scale(1.06); opacity: 1; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
