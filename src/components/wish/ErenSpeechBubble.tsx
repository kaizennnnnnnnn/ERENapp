'use client'

// ═════════════════════════════════════════════════════════════════════════════
// ErenSpeechBubble — Phase 3 PR 5
//
// Ambient flavor bubble that pops above-left of the cat on home, in the same
// white HomeBubble as the wish (its higher-priority sibling, which takes the
// anchor while it is up). Purely presentational; useFlavorBubble decides when
// it appears and what it says.
// ═════════════════════════════════════════════════════════════════════════════

import type { FlavorBubble } from '@/hooks/useFlavorBubble'
import { useCat } from '@/hooks/useCat'
import HomeBubble from './HomeBubble'

interface Props {
  bubble: FlavorBubble
  onDismiss?: () => void
}

export default function ErenSpeechBubble({ bubble, onDismiss }: Props) {
  const cat = useCat()
  return (
    <div
      key={bubble.id}
      className="meadow-root fixed"
      style={{
        bottom: '38%',
        // The wish bubble's anchor: centred on 22%, never within 16px of the edge.
        left: 'max(16px, calc(22% - 75px))',
        zIndex: 3,
        // Keyframe re-runs on key change so every new line gets a fresh
        // pop-in. Out keyframe lands just before useFlavorBubble unmounts
        // the component at BUBBLE_VISIBLE_MS so the disappearance reads
        // as a fade, not a hard cut.
        animation:
          'flavorBubbleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both,' +
          'flavorBubbleOut 0.4s ease-in 5.1s forwards',
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label={cat.t("Dismiss {name}'s thought")}
        className="m-focus"
        style={{ display: 'block', background: 'transparent', border: 'none', padding: 0, borderRadius: 20, cursor: onDismiss ? 'pointer' : 'default' }}
      >
        <HomeBubble>{bubble.text}</HomeBubble>
      </button>

      <style>{`
        @keyframes flavorBubbleIn {
          0%   { transform: translateY(4px) scale(0.85); opacity: 0; }
          100% { transform: translateY(0)   scale(1);    opacity: 1; }
        }
        @keyframes flavorBubbleOut {
          0%   { transform: translateY(0)   scale(1);    opacity: 1; }
          100% { transform: translateY(6px) scale(0.92); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
