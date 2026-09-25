'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoryDetailSheet — tap a picture on the Hallway wall
//
// A Meadow bottom sheet: the picture large, its rarity, the line that goes
// with it, the day it was found and who found it, and the household's hearts
// on it (tap yours to love it or take it back; the other person's shows beside
// it). A locked picture opens to a quiet "still to find" instead.
//
// Hearts are the household's own colours (profiles.heart): brown, pink, or
// the cat's gold sparkle for a household of one.
//
// `frame` stays set while `open` goes false, so the sheet can drop away with
// its picture still in it.
// ═════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import MemoryFrameCanvas from './MemoryFrameCanvas'
import { setMemoryReaction, heartOf } from '@/lib/memoryReactions'
import type { MemoryFrameRow, ReactionEmoji } from '@/hooks/useMemoryFrames'
import { hintSentence, type MemoryFrame } from '@/lib/memoryCatalogue'
import { Chip, Divider, MeadowIcon, Sheet, Tag, M, personColor } from '@/components/meadow'

interface Props {
  open: boolean
  frame: MemoryFrame | null
  row: MemoryFrameRow | null
  partnerId: string | null
  /** For "found by Ana" and "Ana loved it". */
  partnerName: string | null
  onClose: () => void
  onReactionChange: (frameId: string, reaction: Record<string, ReactionEmoji>) => void
}

function formatFoundDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return '' }
}

/** A reaction as the heart it stands for, in its owner's colour. */
function ReactionHeart({ reaction, size = 20 }: { reaction: ReactionEmoji; size?: number }) {
  if (reaction === 'sparkle') return <MeadowIcon name="sparkle" size={size} />
  return <MeadowIcon name="heart" size={size} color={personColor(reaction)} mono />
}

export default function MemoryDetailSheet({ open, frame, row, partnerId, partnerName, onClose, onReactionChange }: Props) {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const cat = useCat()

  if (!frame) return null

  // ── Not found yet: the lock, and a nudge ─────────────────────────────────
  if (!row) {
    return (
      <Sheet open={open} onClose={onClose} title="Still to find">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0 4px', textAlign: 'center' }}>
          <MemoryFrameCanvas frame={frame} size={112} locked />
          <p style={{ margin: 0, maxWidth: 280, fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
            {cat.t('Keep caring for {him} and this one will turn up on the wall.')}
          </p>
        </div>
      </Sheet>
    )
  }

  const myReaction = (user?.id && row.reaction[user.id]) || null
  const partnerReaction = (partnerId && row.reaction[partnerId]) || null
  const myHeart = heartOf(profile?.heart)

  async function toggleReaction() {
    if (!user?.id || !row || busy) return
    setBusy(true)
    playSound('ui_tap')
    const next: ReactionEmoji | null = myReaction === myHeart ? null : myHeart
    const merged = await setMemoryReaction(supabase, {
      householdId: row.household_id,
      frameId:     row.frame_id,
      userId:      user.id,
      reaction:    next,
      current:     row.reaction,
    })
    if (merged) onReactionChange(row.frame_id, merged)
    setBusy(false)
  }

  const foundBy = !row.unlocked_by ? null
    : row.unlocked_by === user?.id ? 'you'
    : row.unlocked_by === partnerId && partnerName ? partnerName
    : null

  return (
    <Sheet open={open} onClose={onClose} title={cat.t(frame.title)}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0 0', textAlign: 'center' }}>
        <MemoryFrameCanvas frame={frame} size={128} />
        <Tag tone={frame.rarity} size="sm" caps style={{ marginTop: 4 }}>{frame.rarity}</Tag>
        <p style={{ margin: 0, maxWidth: 300, fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
          {hintSentence(cat.t(frame.hint))}
        </p>
      </div>

      <Divider style={{ margin: '20px 0 14px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: M.text2 }}>
        <MeadowIcon name="calendar" size={18} />
        <span>
          Found {formatFoundDate(row.unlocked_at)}
          {foundBy && <> by <span style={{ color: M.text, fontWeight: 800 }}>{foundBy}</span></>}
        </span>
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Chip
          selected={!!myReaction}
          onClick={toggleReaction}
          disabled={!user?.id}
          icon={<ReactionHeart reaction={myReaction ?? myHeart} />}
        >
          {myReaction ? 'Loved' : 'Love it'}
        </Chip>
        {partnerReaction && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: M.text2 }}>
            <ReactionHeart reaction={partnerReaction} />
            {partnerName ? `${partnerName} loved it` : 'Loved'}
          </span>
        )}
      </div>
    </Sheet>
  )
}
