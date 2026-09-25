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
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import MemoryFrameCanvas from './MemoryFrameCanvas'
import { frameById, hintSentence, type MemoryFrame } from '@/lib/memoryCatalogue'
import { IconTile, M, PrimaryButton, TextButton, TINT } from '@/components/meadow'

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
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
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
    <div className="meadow-root fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: 'rgba(47, 43, 40, 0.36)', padding: '0 16px' }}
      onClick={() => { /* outside click is no-op — must use buttons */ }}>

      <div role="dialog" aria-modal="true" aria-label="Your memory wall" style={{
        width: '100%', maxWidth: 340, boxSizing: 'border-box',
        background: '#FFFFFF', borderRadius: 28, padding: '28px 20px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        color: M.text, animation: 'modalPop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}>
        <SlideBody slide={slide} />

        {/* Dot row — manual jump */}
        <div className="flex items-center" style={{ gap: 6 }}>
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1} of ${slides.length}`}
              aria-current={i === idx ? 'step' : undefined}
              onClick={() => { playSound('ui_tap'); setIdx(i) }}
              style={{
                width: i === idx ? 18 : 8, height: 8, borderRadius: 999,
                background: i === idx ? M.leaf : M.toggleOff,
                border: 'none', padding: 0, cursor: 'pointer',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Action row — back / next */}
        <div className="flex items-center justify-between w-full" style={{ gap: 10 }}>
          <TextButton tone="muted" onClick={prev} disabled={idx === 0}>Back</TextButton>
          <PrimaryButton size="md" onClick={next} busy={dismissing}>
            {isLast ? 'Open the hallway' : 'Next'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

// ─── Per-slide body ──────────────────────────────────────────────────────────

const HEAD: React.CSSProperties = { margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em', textAlign: 'center', overflowWrap: 'anywhere' }
const BODY: React.CSSProperties = { margin: 0, maxWidth: 270, fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center' }

function SlideBody({ slide }: { slide: Slide }) {
  const cat = useCat()
  switch (slide.kind) {
    case 'intro': {
      return (
        <div className="flex flex-col items-center" style={{ gap: 12 }}>
          {/* A wall of pictures, so a picture: the household's however many
              people are in it. */}
          <IconTile icon="photo" size={68} bg={TINT.love} />
          <p style={HEAD}>Your wall is caught up</p>
          <p style={BODY}>
            {slide.count > 0
              ? `We found ${slide.count} ${slide.count === 1 ? 'memory' : 'memories'} of you and ${cat.name}.`
              : 'Your wall is ready to fill up.'}
          </p>
        </div>
      )
    }
    case 'frame': {
      return (
        <div className="flex flex-col items-center" style={{ gap: 10 }}>
          <MemoryFrameCanvas frame={slide.frame} size={112} />
          <p style={{ ...HEAD, marginTop: 6, fontSize: 20 }}>{cat.t(slide.frame.title)}</p>
          <p style={BODY}>{hintSentence(cat.t(slide.frame.hint))}</p>
          <span style={{ fontSize: 13, fontWeight: 700, color: M.label }}>Found {formatDate(slide.unlockedAt)}</span>
        </div>
      )
    }
    case 'more': {
      return (
        <div className="flex flex-col items-center" style={{ gap: 12 }}>
          <IconTile icon="sparkle" size={68} bg={TINT.amber} />
          <p style={HEAD}>+{slide.moreCount} more</p>
          <p style={BODY}>Waiting on the wall for you to find.</p>
        </div>
      )
    }
    case 'outro': {
      return (
        <div className="flex flex-col items-center" style={{ gap: 12 }}>
          <IconTile icon="heart" size={68} bg={TINT.love} />
          <p style={HEAD}>Welcome to the wall</p>
          <p style={BODY}>
            {slide.count > 0
              ? `${slide.count} ${slide.count === 1 ? 'memory' : 'memories'} in the hallway. More will appear as you take care of ${cat.p.him}.`
              : cat.t('Memories will appear here as you take care of {him}.')}
          </p>
        </div>
      )
    }
  }
}
