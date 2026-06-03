'use client'

// ═════════════════════════════════════════════════════════════════════════════
// CatchupCarousel — Phase 3 PR 8
//
// One-shot fullscreen modal that plays the first time a user visits home after
// the catchup endpoint backfills their wall. Slides through up to 6 of the
// newly-revealed frames + an intro and outro slide. Manual swipe; tap dot to
// jump. On dismiss it stamps profiles.memory_caught_up = true so it never
// reappears.
//
// Lives in the Memory namespace because it's purely about the wall — the host
// (home/page.tsx) decides whether to mount it via useCatchupGate.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { playSound } from '@/lib/sounds'
import MemoryFrameCanvas from './MemoryFrameCanvas'
import { frameById, type MemoryFrame } from '@/lib/memoryCatalogue'

const FRAMES_TO_SHOW = 6

interface CatchupFrame { frame_id: string, unlocked_at: string }

interface Props {
  frames: CatchupFrame[]
  /** Called when the user taps OPEN HALLWAY on the final slide. Parent
   *  should openScene('memory') here. */
  onOpenHallway?: () => void
  onClose: () => void
}

type Slide =
  | { kind: 'intro',  count: number }
  | { kind: 'frame',  frame: MemoryFrame, unlockedAt: string }
  | { kind: 'more',   moreCount: number }
  | { kind: 'outro',  count: number }

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '' }
}

export default function CatchupCarousel({ frames, onOpenHallway, onClose }: Props) {
  const supabase = createClient()
  const { user } = useAuth()
  const [idx, setIdx] = useState(0)
  const [dismissing, setDismissing] = useState(false)
  const stampedRef = useRef(false)

  // Stamp memory_caught_up the moment the carousel is on screen — not on
  // dismiss. Browser back, app kill, pull-to-refresh, or just closing the tab
  // are all valid ways to leave the modal, and we shouldn't re-show the
  // carousel next session over any of them. The user saw it; that's the
  // contract. The frames themselves are already on the wall regardless.
  useEffect(() => {
    if (stampedRef.current || !user?.id) return
    stampedRef.current = true
    void (async () => {
      try {
        await supabase
          .from('profiles')
          .update({ memory_caught_up: true })
          .eq('id', user.id)
      } catch { /* network err — gate will re-fire next mount, harmless */ }
    })()
  }, [user?.id, supabase])

  // Pre-resolve catalogue frames; drop any unknown ids (catalogue edits over
  // time can leave orphans in the DB).
  const resolved = useMemo(() => {
    return frames
      .map(f => ({ ...f, def: frameById(f.frame_id) }))
      .filter((r): r is CatchupFrame & { def: MemoryFrame } => !!r.def)
      .sort((a, b) => (a.unlocked_at < b.unlocked_at ? -1 : 1))   // oldest first — chronological tour
  }, [frames])

  const slides: Slide[] = useMemo(() => {
    const out: Slide[] = [{ kind: 'intro', count: resolved.length }]
    const shown = resolved.slice(0, FRAMES_TO_SHOW)
    const rest = resolved.length - shown.length
    for (const r of shown) out.push({ kind: 'frame', frame: r.def, unlockedAt: r.unlocked_at })
    if (rest > 0) out.push({ kind: 'more', moreCount: rest })
    out.push({ kind: 'outro', count: resolved.length })
    return out
  }, [resolved])

  const slide = slides[idx]
  const isLast = idx === slides.length - 1

  function finish() {
    if (dismissing) return
    setDismissing(true)
    playSound('ui_modal_close')
    // memory_caught_up was stamped on mount; the OPEN HALLWAY button is
    // about navigation, not acknowledgement. Parent decides what scene to
    // route into next.
    if (onOpenHallway) onOpenHallway()
    onClose()
  }

  function next() {
    if (isLast) return finish()
    playSound('ui_tap')
    setIdx(i => i + 1)
  }
  function prev() {
    if (idx === 0) return
    playSound('ui_tap')
    setIdx(i => i - 1)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, rgba(167,139,250,0.18) 0%, rgba(0,0,0,0.92) 70%)',
      }}
      onClick={() => { /* outside click is no-op — must use buttons */ }}>

      {/* Scanlines for the panel vibe */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)',
      }} />

      <div className="relative flex flex-col items-center" style={{
        width: 'min(86vw, 320px)',
        background: 'linear-gradient(180deg, #2A1A36 0%, #160C20 100%)',
        border: '3px solid #5C3A7A',
        boxShadow: '4px 4px 0 #050507, 0 0 30px rgba(167,139,250,0.35)',
        padding: '24px 20px 18px',
        imageRendering: 'pixelated',
        gap: 14,
        zIndex: 1,
      }}>
        <SlideBody slide={slide} />

        {/* Dot row — manual jump */}
        <div className="flex items-center gap-1.5 mt-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => { playSound('ui_tap'); setIdx(i) }}
              style={{
                width: i === idx ? 12 : 6, height: 6, borderRadius: 3,
                background: i === idx ? '#A78BFA' : 'rgba(167,139,250,0.3)',
                boxShadow: i === idx ? '0 0 6px rgba(167,139,250,0.7)' : 'none',
                border: 'none', padding: 0, cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Action row — prev / next */}
        <div className="flex items-center justify-between w-full mt-1" style={{ gap: 10 }}>
          <button
            type="button"
            onClick={prev}
            disabled={idx === 0}
            style={{
              fontFamily: '"Press Start 2P", monospace', fontSize: 6, letterSpacing: 1,
              color: idx === 0 ? '#3A2E50' : '#C8B8E8',
              background: 'transparent', border: 'none', padding: '6px 4px',
              cursor: idx === 0 ? 'default' : 'pointer',
            }}
          >&lt; BACK</button>

          <button
            type="button"
            onClick={next}
            disabled={dismissing}
            style={{
              fontFamily: '"Press Start 2P", monospace', fontSize: 7, letterSpacing: 1,
              color: '#FFFBEB',
              background: 'linear-gradient(180deg, #8B5A00 0%, #5A3700 100%)',
              border: '2px solid #F5C842',
              boxShadow: '2px 2px 0 #050507, 0 0 10px rgba(245,200,66,0.4)',
              padding: '8px 14px',
              cursor: dismissing ? 'wait' : 'pointer',
            }}
          >{isLast ? 'OPEN HALLWAY' : 'NEXT >'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Per-slide body ──────────────────────────────────────────────────────────

function SlideBody({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case 'intro': {
      return (
        <div className="flex flex-col items-center" style={{ gap: 12 }}>
          <div style={{ fontSize: 32 }}>🩷🤎</div>
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 10, color: '#F5C842',
            letterSpacing: 2, textAlign: 'center', textShadow: '0 0 10px rgba(245,200,66,0.5)',
          }}>YOUR WALL<br/>CAUGHT UP</p>
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 6, color: '#C8B8E8',
            lineHeight: 1.7, textAlign: 'center', maxWidth: 240,
          }}>
            {slide.count > 0
              ? `we found ${slide.count} ${slide.count === 1 ? 'memory' : 'memories'} of you and Eren.`
              : 'your wall is ready to fill up.'}
          </p>
        </div>
      )
    }
    case 'frame': {
      return (
        <div className="flex flex-col items-center" style={{ gap: 10 }}>
          <MemoryFrameCanvas frame={slide.frame} size={120} />
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 9, color: '#FFFFFF',
            letterSpacing: 1, textAlign: 'center',
          }}>{slide.frame.title.toUpperCase()}</p>
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 6, color: '#C8B8E8',
            lineHeight: 1.7, textAlign: 'center', maxWidth: 230,
          }}>{slide.frame.hint}</p>
          <span style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 5,
            color: '#8E7EAA', letterSpacing: 1,
          }}>{formatDate(slide.unlockedAt).toUpperCase()}</span>
        </div>
      )
    }
    case 'more': {
      return (
        <div className="flex flex-col items-center" style={{ gap: 12 }}>
          <p style={{ fontSize: 28 }}>✨</p>
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 9, color: '#FFFFFF',
            letterSpacing: 1, textAlign: 'center',
          }}>+{slide.moreCount} MORE</p>
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 6, color: '#C8B8E8',
            lineHeight: 1.7, textAlign: 'center', maxWidth: 230,
          }}>waiting on the wall for you to find.</p>
        </div>
      )
    }
    case 'outro': {
      return (
        <div className="flex flex-col items-center" style={{ gap: 12 }}>
          <p style={{ fontSize: 24 }}>🩷</p>
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 9, color: '#FFFFFF',
            letterSpacing: 1, textAlign: 'center',
          }}>WELCOME<br/>TO THE WALL</p>
          <p style={{
            fontFamily: '"Press Start 2P", monospace', fontSize: 6, color: '#C8B8E8',
            lineHeight: 1.7, textAlign: 'center', maxWidth: 230,
          }}>
            {slide.count > 0
              ? `${slide.count} ${slide.count === 1 ? 'memory' : 'memories'} on the hallway. more will appear as you take care of him.`
              : 'memories will appear here as you take care of him.'}
          </p>
        </div>
      )
    }
  }
}
