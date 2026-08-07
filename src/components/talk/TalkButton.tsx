'use client'

// The attic's bottom action button. Every other room's button starts a chore;
// this one starts a conversation, so it's dressed as the room rather than as a
// tool — walnut beam and lantern amber, cream pixel type, gold rivets at the
// inner corners like the rest of the "premium card" surfaces.
//
// The three dots on the right are the same stepping dots Eren types with
// inside the chat. Pressing the button is meant to look like joining them.

import { IconSpeech } from '@/components/PixelIcons'

// Lantern-lit walnut — reads warm against the attic art without competing
// with the fairy lights behind it.
const AMBER_HI = '#F0C173'
const AMBER_MID = '#D9974A'
const AMBER_LO = '#B4712F'
const INK = '#3A2210'   // walnut — border + hard drop shadow
const CREAM = '#FFF6E2'
const RIVET = '#FCD34D'

const PIXEL_FONT = '"Press Start 2P", monospace'

const RIVETS = [
  { left: 6, top: 6 },
  { right: 6, top: 6 },
  { left: 6, bottom: 6 },
  { right: 6, bottom: 6 },
]

interface Props {
  onClick: () => void
}

export default function TalkButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Talk to Eren"
      className="relative w-full max-w-xs active:translate-y-[2px] transition-transform duration-100"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        background: `linear-gradient(180deg, ${AMBER_HI} 0%, ${AMBER_MID} 48%, ${AMBER_LO} 100%)`,
        border: `3px solid ${INK}`,
        borderRadius: 9,
        boxShadow: `3px 3px 0 ${INK}`,
        color: CREAM,
      }}
    >
      {RIVETS.map((p, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', ...p, width: 3, height: 3,
          background: RIVET, boxShadow: `1px 1px 0 ${INK}`,
        }} />
      ))}

      {/* Speech bubble on a paper tile — the notebook he keeps you in. */}
      <span aria-hidden style={{
        position: 'relative', flexShrink: 0,
        width: 36, height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #FFFBF1 0%, #F3E3C2 100%)',
        border: `2px solid ${INK}`,
        borderRadius: 3,
        boxShadow: `2px 2px 0 ${INK}`,
        animation: 'talkTileBob 2.6s ease-in-out infinite',
      }}>
        <span style={{ position: 'absolute', top: 2, left: 2, right: 2, height: 3, background: 'rgba(255,255,255,0.7)' }} />
        <IconSpeech size={22} />
      </span>

      <span style={{
        flex: 1, textAlign: 'center',
        fontFamily: PIXEL_FONT, fontSize: 9, lineHeight: 1.6, letterSpacing: 1,
        textShadow: `0 2px 0 ${INK}`,
      }}>
        TALK TO
        <br />
        EREN
      </span>

      {/* His typing dots, in a recessed slot. Loose on the amber they read as
          three specks of dirt; a dark inset gives them something to glow
          against, the way the wall switch's lever sits in its slot. */}
      <span aria-hidden className="flex items-center justify-center gap-1.5" style={{
        flexShrink: 0, width: 34, height: 20,
        background: INK, borderRadius: 3,
        boxShadow: `inset 0 2px 0 rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.28)`,
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 4, height: 4, background: CREAM,
            animation: `talkBtnDot 900ms steps(1,end) ${i * 300}ms infinite`,
          }} />
        ))}
      </span>

      <style>{`
        @keyframes talkTileBob {
          0%, 100% { transform: rotate(-3deg) translateY(0); }
          50%      { transform: rotate(-3deg) translateY(-2px); }
        }
        @keyframes talkBtnDot {
          0%, 32%   { opacity: 1;    transform: translateY(-2px); }
          33%, 100% { opacity: 0.28; transform: translateY(0); }
        }
      `}</style>
    </button>
  )
}
