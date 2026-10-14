'use client'

// Spending a privilege. Every one of them changes something the OTHER person
// will notice, so each gets a sentence saying exactly what is about to happen
// before the button is armed — and Eren Says gets a text box, because the
// whole item is the sentence.
//
// A white Meadow card like the buy confirm: the power's drawing on a soft
// stage, what it will do, and one leaf button that spends it.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCat } from '@/hooks/useCat'
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyEffects } from '@/hooks/useTrophyEffects'
import { useDailyBattle } from '@/hooks/useDailyBattle'
import { EREN_SAYS_MAX } from '@/lib/trophyEffects'
import type { PrivilegeItem } from '@/lib/trophyShop'
import PowerArt from './PowerArt'
import { M, PrimaryButton, Tag, TextButton, TYPE } from '@/components/meadow'
import { playSound } from '@/lib/sounds'
import type { StreakData } from '@/types'

const MAX_FREEZE_TOKENS = 2

export default function UsePrivilegeSheet({
  item, onClose,
}: { item: PrivilegeItem; onClose(): void }) {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { partner } = useCouple()
  const cat = useCat()
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
    eren_says: `${cat.name} will say this to ${them} for the next day, in ${cat.p.his} own bubble.`,
    double_hour: 'Your care actions count double for the next hour. Starting now.',
    point_steal: leaderIsPartner
      ? `Takes one point off ${them}, who is currently ahead.`
      : leaderIsMe
        ? 'You are already ahead — this would take a point off YOU. Wait until you are behind.'
        : 'Nobody is ahead right now, so there is nothing to take.',
    streak_shield: 'Banks a freeze token. The next missed day will not break your care streak.',
    decay_freeze: cat.t("{name}'s stats hold still for three hours. Good before a long shift."),
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
      setError('Could not fire that. Your power has been spent — sorry.')
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
    // Re-read immediately before writing. useAuth's `profile` is fetched once
    // per session and never refreshed, so a read-modify-write of the whole
    // jsonb from it would happily post a days-old `current`/`lastDate` back
    // over a streak that has since advanced — a paid item that silently
    // rewinds your care streak is the worst possible outcome here.
    const { data, error: readErr } = await supabase
      .from('profiles').select('streak').eq('id', user.id).maybeSingle()
    if (readErr) return false
    const streak = ((data?.streak ?? profile?.streak ?? {}) as StreakData)
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

  const close = () => { if (!busy) { playSound('ui_modal_close'); onClose() } }
  const have = trophies.qty(item.id)

  return createPortal(
    <div className="meadow-root fixed inset-0 z-[140] flex items-center justify-center"
      style={{ padding: '0 20px', background: 'rgba(47, 43, 40, 0.36)' }}
      onClick={close}>
      <div onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={`Use ${cat.t(item.name)}`}
        className="trophy-card w-full flex flex-col items-center"
        style={{
          maxWidth: 340, boxSizing: 'border-box', padding: '20px 20px 14px',
          borderRadius: 28, background: '#FFFFFF',
          animation: 'trophyCardPop 0.26s cubic-bezier(0.34, 1.4, 0.64, 1) both',
        }}>
        <div className="w-full flex items-center justify-center" style={{
          position: 'relative', minHeight: 104, borderRadius: 22, background: M.soft,
        }}>
          <Tag size="sm" tone="soft" style={{ position: 'absolute', top: 10, right: 10, fontVariantNumeric: 'tabular-nums' }}>
            You have {have}
          </Tag>
          <PowerArt id={item.privilege} width={62} />
        </div>

        <h2 style={{ margin: '16px 0 0', fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: M.text, textAlign: 'center' }}>
          {cat.t(item.name)}
        </h2>
        <p style={{
          margin: '8px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 600, textAlign: 'center',
          ...(blocked
            ? { padding: '8px 12px', borderRadius: 14, background: M.dangerTint, color: M.danger }
            : { color: M.text2 }),
        }}>
          {consequence[item.privilege]}
        </p>

        {needsText && (
          <div className="w-full" style={{ marginTop: 14 }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, EREN_SAYS_MAX))}
              rows={3}
              aria-label={`What ${cat.name} will say`}
              placeholder={`Something for ${them}…`}
              className="trophy-say w-full"
              style={{
                display: 'block', boxSizing: 'border-box', padding: '12px 14px',
                background: M.soft, border: `2px solid ${M.hairline}`, borderRadius: 16,
                color: M.text, fontFamily: 'inherit', fontSize: 16, lineHeight: 1.4, fontWeight: 600,
                resize: 'none', outline: 'none',
              }}
            />
            <p style={{ margin: '4px 4px 0', textAlign: 'right', ...TYPE.tiny, fontWeight: 700, color: M.faint, fontVariantNumeric: 'tabular-nums' }}>
              {text.length}/{EREN_SAYS_MAX}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" style={{
            margin: '12px 0 0', padding: '8px 12px', borderRadius: 14, width: '100%', boxSizing: 'border-box',
            background: M.dangerTint, color: M.danger, fontSize: 14, fontWeight: 700, textAlign: 'center',
          }}>{error}</p>
        )}

        <PrimaryButton
          onClick={use}
          disabled={!ready && !done}
          busy={busy || done}
          style={{ marginTop: 16 }}>
          {done ? 'Done' : 'Spend one'}
        </PrimaryButton>

        <TextButton tone="muted" onClick={close} disabled={busy}>Not now</TextButton>
      </div>

      {/* A plain <style>: the name comes from an inline style, which only
          reaches global keyframes. */}
      <style>{`
        @keyframes trophyCardPop {
          0%   { transform: scale(0.94) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .trophy-say:focus { border-color: ${M.leaf} !important; background: #FFFFFF !important; }
        @media (prefers-reduced-motion: reduce) { .trophy-card { animation: none !important; } }
      `}</style>
    </div>,
    document.body,
  )
}
