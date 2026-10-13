'use client'

// ─── HomeBubble ──────────────────────────────────────────────────────────────
// The bubble the cat speaks in over the home room: Meadow's speech bubble at
// 14px so a line fits beside him, with the over-art lip like every white
// piece on the room art. The wish (WishCloud) and his passing thoughts
// (ErenSpeechBubble) both sit above-left of him, so the tail sits near the
// bubble's right end, pointing his way; the whisper and comeback bubbles
// float straight above him and centre theirs.

import type { CSSProperties, ReactNode } from 'react'
import { M, SpeechBubble, type MeadowIconName } from '@/components/meadow'

export default function HomeBubble({ children, icon, tint, tail = 'right', style }: {
  children: ReactNode
  icon?: MeadowIconName
  /** A tinted bubble (the granted wish); white otherwise. */
  tint?: string
  /** 'right' for the bubbles beside the cat, 'centre' for the ones above him. */
  tail?: 'right' | 'centre'
  style?: CSSProperties
}) {
  return (
    <SpeechBubble
      size="md"
      icon={icon}
      tailOffset={tail === 'right' ? 'calc(100% - 38px)' : 'calc(50% - 7px)'}
      tailColor={tint}
      style={{
        maxWidth: 150, minWidth: 80, padding: '8px 12px 9px', gap: 6,
        fontSize: 14, lineHeight: 1.3, textAlign: 'left',
        boxShadow: `0 3px 0 ${M.overArtLip}`,
        ...(tint ? { background: tint } : {}),
        ...style,
      }}
    >
      {children}
    </SpeechBubble>
  )
}
