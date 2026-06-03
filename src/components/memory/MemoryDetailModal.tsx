'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoryDetailModal — Phase 3 PR 7
//
// Tap a frame on the wall → this opens. Shows the full art at 144px, the
// title, the hint, the unlock date + who unlocked it, and a single "react"
// button that toggles the viewer's heart on the frame. Locked frames open
// to a teasing placeholder instead of a real detail card.
// ═════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { playSound } from '@/lib/sounds'
import MemoryFrameCanvas from './MemoryFrameCanvas'
import { setMemoryReaction, heartForEmail, HEART_GLYPH } from '@/lib/memoryReactions'
import type { MemoryFrameRow, ReactionEmoji } from '@/hooks/useMemoryFrames'
import type { MemoryFrame } from '@/lib/memoryCatalogue'

interface Props {
  frame: MemoryFrame
  row: MemoryFrameRow | null
  partnerId: string | null
  onClose: () => void
  onReactionChange: (frameId: string, reaction: Record<string, ReactionEmoji>) => void
}

function formatUnlockDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '' }
}

export default function MemoryDetailModal({ frame, row, partnerId, onClose, onReactionChange }: Props) {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const [busy, setBusy] = useState(false)

  const locked = !row
  const myReaction = (user?.id && row?.reaction[user.id]) || null
  const partnerReaction = (partnerId && row?.reaction[partnerId]) || null
  const myHeart = heartForEmail(user?.email)

  async function toggleReaction() {
    if (!user?.id || !row || busy) return
    setBusy(true)
    playSound('ui_tap')
    const nextEmoji: ReactionEmoji | null = myReaction === myHeart ? null : myHeart
    const merged = await setMemoryReaction(supabase, {
      householdId: row.household_id,
      frameId:     row.frame_id,
      userId:      user.id,
      reaction:    nextEmoji,
      current:     row.reaction,
    })
    if (merged) onReactionChange(row.frame_id, merged)
    setBusy(false)
  }

  // ── Locked state — simple teaser, no react button ────────────────────────
  if (locked) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={() => { playSound('ui_modal_close'); onClose() }}>
        <div onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(180deg, #15102A 0%, #0A0716 100%)',
            border: '3px solid #2A2A3E',
            boxShadow: '4px 4px 0 #050507',
            padding: '20px 22px',
            maxWidth: 280,
            imageRendering: 'pixelated',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
          <MemoryFrameCanvas frame={frame} size={120} locked />
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 7, lineHeight: 1.6,
            color: '#7A6E8E', textAlign: 'center', letterSpacing: 1,
          }}>NOT YET UNLOCKED</p>
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 6, lineHeight: 1.7,
            color: '#9A8EBE', textAlign: 'center',
          }}>keep caring for him.</p>
        </div>
      </div>
    )
  }

  // ── Unlocked detail ──────────────────────────────────────────────────────
  const unlockedByMe = row.unlocked_by === user?.id
  const unlockedBySomeone = !!row.unlocked_by
  const youText = unlockedByMe ? 'YOU' : (profile?.name ?? '').toUpperCase()
  const partnerText = (row.unlocked_by !== user?.id && row.unlocked_by != null && partnerId === row.unlocked_by)
    ? 'PARTNER' : null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={() => { playSound('ui_modal_close'); onClose() }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #2A1A36 0%, #1A0E22 100%)',
          border: '3px solid #5C3A7A',
          boxShadow: '4px 4px 0 #050507, 0 0 20px rgba(167,139,250,0.25)',
          padding: '20px 22px',
          maxWidth: 300,
          imageRendering: 'pixelated',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>

        <MemoryFrameCanvas frame={frame} size={144} />

        <p style={{
          fontFamily: '"Press Start 2P", monospace', fontSize: 9, lineHeight: 1.4,
          color: frame.rarity === 'epic' ? '#F5C842' : frame.rarity === 'rare' ? '#D8D8D8' : '#FFFFFF',
          textAlign: 'center', letterSpacing: 1, marginTop: 4,
        }}>{frame.title.toUpperCase()}</p>

        <p style={{
          fontFamily: '"Press Start 2P", monospace', fontSize: 6, lineHeight: 1.7,
          color: '#C8B8E8', textAlign: 'center', maxWidth: 240,
        }}>{frame.hint}</p>

        <div style={{
          fontFamily: '"Press Start 2P", monospace', fontSize: 5,
          color: '#8E7EAA', letterSpacing: 1, marginTop: 6, textAlign: 'center',
        }}>
          {formatUnlockDate(row.unlocked_at).toUpperCase()}
          {unlockedBySomeone && (
            <>
              {' · '}
              {partnerText ?? youText}
            </>
          )}
        </div>

        {/* Reaction row — viewer's heart toggles, partner's shows next to it */}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={toggleReaction}
            disabled={busy}
            aria-label={myReaction ? 'Remove your heart' : 'React with your heart'}
            style={{
              fontSize: 24,
              background: myReaction ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.05)',
              border: myReaction ? '2px solid #A78BFA' : '2px solid rgba(167,139,250,0.3)',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: busy ? 'wait' : 'pointer',
              transition: 'transform 0.1s ease',
              boxShadow: myReaction ? '0 0 8px rgba(167,139,250,0.4)' : 'none',
            }}
          >
            {myReaction ? HEART_GLYPH[myReaction] : HEART_GLYPH[myHeart]}
          </button>
          {partnerReaction && (
            <div style={{
              fontSize: 24, padding: '4px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '2px solid rgba(167,139,250,0.3)',
              borderRadius: 6,
              opacity: 0.95,
            }}>{HEART_GLYPH[partnerReaction]}</div>
          )}
        </div>
        <span style={{
          fontFamily: '"Press Start 2P", monospace', fontSize: 5,
          color: '#8E7EAA', letterSpacing: 1,
        }}>{myReaction ? 'TAP TO UNDO' : 'TAP TO REACT'}</span>
      </div>
    </div>
  )
}
