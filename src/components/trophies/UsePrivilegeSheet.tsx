'use client'

// Spending a privilege. Every one of them changes something the OTHER person
// will notice, so each gets a sentence saying exactly what is about to happen
// before the button is armed — and Eren Says gets a text box, because the
// whole item is the sentence.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyEffects } from '@/hooks/useTrophyEffects'
import { useDailyBattle } from '@/hooks/useDailyBattle'
import { EREN_SAYS_MAX } from '@/lib/trophyEffects'
import type { PrivilegeItem } from '@/lib/trophyShop'
import { IconLightning } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import type { StreakData } from '@/types'

const MAX_FREEZE_TOKENS = 2

export default function UsePrivilegeSheet({
  item, onClose,
}: { item: PrivilegeItem; onClose(): void }) {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { partner } = useCouple()
  const trophies = useTrophies()
  const effects = useTrophyEffects()
  const battle = useDailyBattle()

  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const them = partner?.name?.split(' ')[0] ?? 'them'
  const leaderIsPartner = battle.leader === 'partner'
  const leaderIsMe = battle.leader === 'me'

  // What is about to happen, said plainly.
  const consequence: Record<PrivilegeItem['privilege'], string> = {
    eren_says: `Eren will say this to ${them} for the next day, in his own bubble.`,
    double_hour: 'Your care actions count double for the next hour. Starting now.',
    point_steal: leaderIsPartner
      ? `Takes one point off ${them}, who is currently ahead.`
      : leaderIsMe
        ? 'You are already ahead — this would take a point off YOU. Wait until you are behind.'
        : 'Nobody is ahead right now, so there is nothing to take.',
    streak_shield: 'Banks a freeze token. The next missed day will not break your care streak.',
    decay_freeze: 'Eren\'s stats hold still for three hours. Good before a long shift.',
  }

  const blocked = item.privilege === 'point_steal' && !leaderIsPartner
  const needsText = item.privilege === 'eren_says'
  const trimmed = text.trim()
  const ready = !blocked && (!needsText || trimmed.length > 0)

  async function use() {
    if (busy || !ready || !user?.id) return
    setBusy(true)
    setError(null)

    // Burn the consumable FIRST. If the effect then fails to write, the player
    // has lost a use — but the alternative order lets a flaky connection fire
    // the same Double Hour three times, which is worse and unfixable.
    const spent = await trophies.spendOne(item.id)
    if (!spent) {
      setBusy(false)
      setError('You do not have one of these to spend.')
      return
    }

    let ok = false
    if (item.privilege === 'streak_shield') {
      ok = await bankFreezeToken()
    } else {
      const payload: Record<string, unknown> =
        item.privilege === 'eren_says' ? { text: trimmed.slice(0, EREN_SAYS_MAX) }
        : item.privilege === 'point_steal' ? { target: partner?.id ?? null }
        : {}
      ok = await effects.fire(item.privilege, item.minutes, payload)
    }

    setBusy(false)
    if (!ok) {
      setError('Could not fire that. Your trophy item has been spent — sorry.')
      return
    }
    playSound('ui_modal_open')
    setDone(true)
    setTimeout(onClose, 900)
  }

  /**
   * The streak shield does not need an effect row at all: the care streak
   * already has freeze tokens, so this just tops one up. Reusing the existing
   * mechanic beats inventing a parallel one that has to be taught to the same
   * three code paths.
   */
  async function bankFreezeToken(): Promise<boolean> {
    if (!user?.id) return false
    const streak = (profile?.streak ?? {}) as StreakData
    const next: StreakData = {
      ...streak,
      current: streak.current ?? 0,
      best: streak.best ?? 0,
      lastDate: streak.lastDate ?? null,
      freezeTokens: Math.min(MAX_FREEZE_TOKENS, (streak.freezeTokens ?? 0) + 1),
    }
    const { error } = await supabase.from('profiles').update({ streak: next }).eq('id', user.id)
    return !error
  }

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.74)' }}
      onClick={() => { if (!busy) onClose() }}>
      <div onClick={e => e.stopPropagation()}
        className="relative w-full p-4 flex flex-col items-center gap-3"
        style={{
          maxWidth: 300,
          background: 'radial-gradient(120% 90% at 50% 0%, #14321F 0%, #0C1E14 60%, #06110B 100%)',
          border: '2px solid #63F094',
          borderRadius: 12,
          boxShadow: '0 0 22px rgba(99,240,148,0.32), 0 10px 30px rgba(0,0,0,0.6)',
        }}>

        <IconLightning size={30} />
        <p className="font-pixel text-center" style={{ fontSize: 9, letterSpacing: 1.5, color: '#A7F3C0' }}>
          {item.name.toUpperCase()}
        </p>
        <p className="text-center text-[11px]" style={{ color: blocked ? '#FFB4A1' : '#9FD8B5' }}>
          {consequence[item.privilege]}
        </p>

        {needsText && (
          <div className="w-full">
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, EREN_SAYS_MAX))}
              rows={3}
              placeholder={`Something for ${them}…`}
              className="w-full px-2.5 py-2 text-[12px]"
              style={{
                background: 'rgba(0,0,0,0.45)',
                border: '1.5px solid rgba(99,240,148,0.4)',
                borderRadius: 4,
                color: '#E4FFEE',
                resize: 'none',
                outline: 'none',
              }}
            />
            <p className="text-right font-pixel" style={{ fontSize: 5, color: '#6E8F7C', marginTop: 2 }}>
              {text.length}/{EREN_SAYS_MAX}
            </p>
          </div>
        )}

        {error && <p className="text-center text-[11px]" style={{ color: '#FF8DA1' }}>{error}</p>}

        <button
          onClick={use}
          disabled={!ready || busy || done}
          className="w-full px-4 py-3 active:translate-y-[1px] transition-transform"
          style={{
            background: done
              ? 'linear-gradient(180deg, #A7F3B0 0%, #34D399 55%, #065F46 100%)'
              : ready
                ? 'linear-gradient(180deg, #A7F3C0 0%, #34D399 55%, #0B6B45 100%)'
                : 'rgba(255,255,255,0.05)',
            border: `2px solid ${ready || done ? '#0B4C33' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 6,
            opacity: busy ? 0.6 : 1,
          }}>
          <span className="font-pixel" style={{
            fontSize: 9, letterSpacing: 1, color: ready || done ? '#04231A' : '#7A8686',
          }}>
            {done ? 'DONE' : busy ? '...' : blocked ? 'NOT NOW' : 'SPEND ONE'}
          </span>
        </button>

        <p className="text-center font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#6E8F7C' }}>
          YOU HAVE {trophies.qty(item.id)}
        </p>
      </div>
    </div>,
    document.body,
  )
}
