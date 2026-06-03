'use client'

// ═════════════════════════════════════════════════════════════════════════════
// ErenSpeechBubble — Phase 3 PR 5
//
// Ambient flavor bubble that pops above-left of Eren on home. Sized smaller
// than WishCloud (its higher-priority sibling) so it reads as inner monologue
// rather than a task. Purely presentational; useFlavorBubble decides when
// it appears and what it says.
// ═════════════════════════════════════════════════════════════════════════════

import type { FlavorBubble } from '@/hooks/useFlavorBubble'

interface Props {
  bubble: FlavorBubble
  onDismiss?: () => void
}

export default function ErenSpeechBubble({ bubble, onDismiss }: Props) {
  return (
    <div
      key={bubble.id}
      className="fixed"
      style={{
        bottom: '38%',
        left: '22%',
        transform: 'translate(-50%, 0)',
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
        aria-label="Dismiss Eren's thought"
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: onDismiss ? 'pointer' : 'default' }}
      >
        <div
          style={{
            position: 'relative',
            background: '#FFFFFF',
            border: '2px solid #2A2A3A',
            borderRadius: 4,
            boxShadow: '3px 3px 0 #2A2A3A',
            padding: '6px 10px',
            maxWidth: 140,
            minWidth: 80,
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 7,
            lineHeight: 1.5,
            color: '#1A1A1A',
            textAlign: 'center',
            imageRendering: 'pixelated',
          }}
        >
          {bubble.text}

          {/* Speech tail — pixel triangle pointing down-right toward Eren,
              mirrors WishCloud's tail so the two surfaces feel like siblings. */}
          <div style={{
            position: 'absolute',
            bottom: -8, right: 22,
            width: 0, height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '8px solid #2A2A3A',
          }} />
          <div style={{
            position: 'absolute',
            bottom: -5, right: 24,
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '3px solid transparent',
            borderTop: '5px solid #FFFFFF',
          }} />
        </div>
      </button>

      <style jsx global>{`
        @keyframes flavorBubbleIn {
          0%   { transform: translate(-50%, 4px) scale(0.85); opacity: 0; }
          100% { transform: translate(-50%, 0)   scale(1);    opacity: 1; }
        }
        @keyframes flavorBubbleOut {
          0%   { transform: translate(-50%, 0)  scale(1);    opacity: 1; }
          100% { transform: translate(-50%, 6px) scale(0.92); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
