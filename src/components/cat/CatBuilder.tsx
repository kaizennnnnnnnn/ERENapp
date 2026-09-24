'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { CheckDisc, M, RADIUS, RoundButton, Segmented, SpeechBubble, TYPE } from '@/components/meadow'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import {
  CAT_PARTS, EYE_COLOURS, FUR_COLOURS, NOSE_COLOURS, PART_LABELS, PATTERN_LABELS, PRESETS,
  coatLabel, presetLook,
  type CatLook, type CatPart, type CatPattern, type CoatKey,
} from '@/lib/catIdentity'
import { lookKey } from '@/lib/catRecolour'
import CatPortrait from './CatPortrait'
import CatStage from './CatStage'

// ─── CatBuilder ──────────────────────────────────────────────────────────────
// "Build your cat": the Meadow O2 (Build) and O3 (Fine-tune) boards, live. The
// preview is the real recolour of the material maps, so every tap repaints the
// actual cat the household will get — nothing here is a picture of a preset.
//
// Two views:
//   build  the big stage, the coat's name, the litter of 17 coats, Shuffle
//   tune   a small stage, part tabs, 18 furs for the part, pattern, eyes, nose
// Onboarding owns its header (back button, "Fine-tune colours" link, primary
// button) and drives the view with `view` / `onViewChange`. In `compact` mode
// (Settings' "Edit {name}'s look" sheet) the builder carries its own Coats /
// Fine-tune switch, a shorter stage and no bubble, since the sheet's title
// already asks the question.
//
// Render it full-width (no side padding around it): like the boards it keeps
// 20px margins for blocks and lets the litter and the part tabs scroll edge to
// edge. Heights, for a page that pins its button under it: build ~568px, tune
// ~562px (the boards put it at y 160 with the button at y 756).

export type BuilderView = 'build' | 'tune'

interface Props {
  value: CatLook
  onChange: (next: CatLook) => void
  /** Controlled view (onboarding). Omit to let the builder keep its own. */
  view?: BuilderView
  onViewChange?: (view: BuilderView) => void
  /** Settings sheet: shorter stage, own Coats / Fine-tune switch, no bubble. */
  compact?: boolean
  /** The cat's name, for the preview's accessible label. */
  catName?: string
}

const RING_ON = `0 0 0 3px ${M.ground}, 0 0 0 5px ${M.leaf}`
const TILE_W = 76
const TILE_GAP = 8
const ROW_PAD = 20
// "Tortoiseshell" is the one coat name wider than a tile; let it break.
const SOFT_HYPHEN = String.fromCharCode(0xad)

const VIEW_OPTIONS = [
  { value: 'build' as const, label: 'Coats' },
  { value: 'tune' as const, label: 'Fine-tune' },
]

// Which of the 17 coats a look IS (same colours), if any. Fine-tuning keeps
// the preset key on the look, so the key alone would leave the ring on a coat
// the cat no longer wears.
function coatIndexOf(look: CatLook): number {
  const key = lookKey(look)
  const byKey = look.preset ? PRESETS.findIndex(p => p.key === look.preset) : -1
  if (byKey >= 0 && lookKey(PRESETS[byKey].look) === key) return byKey
  return PRESETS.findIndex(p => lookKey(p.look) === key)
}

export default function CatBuilder({ value, onChange, view: viewProp, onViewChange, compact = false, catName }: Props) {
  const [ownView, setOwnView] = useState<BuilderView>('build')
  const view = viewProp ?? ownView
  const setView = (v: BuilderView) => {
    if (viewProp === undefined) setOwnView(v)
    onViewChange?.(v)
  }
  const label = coatLabel(value)
  const alt = `${catName?.trim() || 'Your cat'}, ${label === 'Custom coat' ? 'custom coat' : `${label} coat`}`

  return (
    <div className="meadow-root" style={{ width: '100%' }}>
      {compact && (
        <Segmented
          ariaLabel="Builder view"
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
          style={{ margin: '0 20px 16px' }}
        />
      )}
      {view === 'build'
        ? <BuildView value={value} onChange={onChange} compact={compact} alt={alt} label={label} />
        : <TuneView value={value} onChange={onChange} alt={alt} />}
    </div>
  )
}

// ─── Build ───────────────────────────────────────────────────────────────────

function BuildView({ value, onChange, compact, alt, label }: {
  value: CatLook; onChange: (l: CatLook) => void; compact: boolean; alt: string; label: string
}) {
  const index = coatIndexOf(value)
  const reducedMotion = useReducedMotion()
  const rowRef = useRef<HTMLDivElement>(null)
  // Set by Shuffle so the new coat's tile is brought into view; a tap needs
  // no scroll, the tapped tile is already under the finger.
  const revealRef = useRef(false)

  // Centre a tile in the row without scrolling anything else (scrollIntoView
  // would also scroll the page or the sheet the builder sits in).
  const centre = (i: number, smooth: boolean) => {
    const row = rowRef.current
    if (!row || i < 0) return
    const left = ROW_PAD + i * (TILE_W + TILE_GAP) + TILE_W / 2 - row.clientWidth / 2
    row.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' })
  }

  // Opening the builder (or coming back from Fine-tune) lands on the chosen coat.
  useEffect(() => { centre(index, false) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!revealRef.current) return
    revealRef.current = false
    centre(index, !reducedMotion)
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (key: CoatKey) => onChange(presetLook(key))
  const shuffle = () => {
    const others = PRESETS.filter((_, i) => i !== index)
    revealRef.current = true
    pick(others[Math.floor(Math.random() * others.length)].key)
  }

  return (
    <div>
      <CatStage variant={compact ? 'compact' : 'build'} look={value} alt={alt}>
        {!compact && (
          <SpeechBubble tailOffset={96} style={{ position: 'absolute', left: 'calc(50% - 111px)', top: 18, width: 200 }}>
            What do I look like?
          </SpeechBubble>
        )}
        <RoundButton ariaLabel="Shuffle coat" surface="stage" onClick={shuffle} style={{ position: 'absolute', right: 14, top: 14 }}>
          <MeadowIcon name="dice" />
        </RoundButton>
      </CatStage>

      {/* The coat's name gets a row of its own: the long names ("Black with
          White Tail") don't fit beside anything at 22px. */}
      <div aria-live="polite" style={{
        margin: '14px 24px 0', height: 40, display: 'flex', alignItems: 'baseline', gap: 10, overflow: 'hidden',
      }}>
        <span style={{ fontSize: 22, lineHeight: '40px', fontWeight: 800, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {index >= 0 && (
          <span style={{ fontSize: 13, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {index + 1} of {PRESETS.length}
          </span>
        )}
      </div>

      <div ref={rowRef} className="scrollbar-hide" style={{ marginTop: 6, overflowX: 'auto', overflowY: 'hidden' }}>
        <div role="group" aria-label="Coats" style={{
          display: 'flex', gap: TILE_GAP, padding: `10px ${ROW_PAD}px`, width: 'max-content',
        }}>
          {PRESETS.map((p, i) => (
            <CoatTile key={p.key} label={p.label} look={p.look} on={i === index} onPick={() => pick(p.key)} />
          ))}
          <span aria-hidden style={{ flex: '0 0 auto', width: 4 }} />
        </div>
      </div>
    </div>
  )
}

function CoatTile({ label, look, on, onPick }: { label: string; look: CatLook; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onPick}
      className="m-press m-focus"
      style={{
        position: 'relative', flex: '0 0 auto', width: TILE_W, height: 108, boxSizing: 'border-box',
        padding: '8px 4px 0', border: `2px solid ${on ? M.leaf : M.hairline}`, borderRadius: RADIUS.tile,
        background: M.ground, display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {/* Thumbnails are the live recolour too, from the half-size map. */}
      <CatPortrait look={look} width={45} height={60} quality="thumb" style={{ marginLeft: 5, flex: '0 0 auto' }} />
      <span style={{
        marginTop: 5, fontSize: 11, lineHeight: 1.2, fontWeight: on ? 800 : 700,
        color: on ? M.text : M.text2, textAlign: 'center',
      }}>
        {label.replace('Tortoiseshell', `Tortoise${SOFT_HYPHEN}shell`)}
      </span>
      {on && <CheckDisc corner />}
    </button>
  )
}

// ─── Fine-tune ───────────────────────────────────────────────────────────────

function TuneView({ value, onChange, alt }: { value: CatLook; onChange: (l: CatLook) => void; alt: string }) {
  const [part, setPart] = useState<CatPart>('body')
  const fur = value.parts[part]
  const furLabel = FUR_COLOURS.find(f => f.key === fur)?.label ?? ''
  const partLabel = PART_LABELS[part]
  const pattern = value.pattern ?? 'none'
  // Eyes (4) and nose (3) share one row, 330px of swatches on the board. A
  // 360px phone has 320 inside the margins, so there the swatches step down
  // to 36 rather than pushing the nose onto a line of its own.
  const rootRef = useRef<HTMLDivElement>(null)
  const narrow = useNarrowerThan(rootRef, 370)
  const sw = narrow ? 36 : 40
  const gap = narrow ? 8 : 10

  return (
    <div ref={rootRef}>
      <CatStage variant="tune" look={value} alt={alt}>
        <SpeechBubble tail="left" tailOffset={20} style={{
          position: 'absolute', left: 150, right: 20, top: 30, maxWidth: 180, textAlign: 'left',
        }}>
          Paint me however you like.
        </SpeechBubble>
      </CatStage>

      <div className="scrollbar-hide" style={{ marginTop: 12, overflowX: 'auto', overflowY: 'hidden' }}>
        <div role="tablist" aria-label="Part to paint" style={{ display: 'flex', gap: 8, padding: '2px 20px', width: 'max-content' }}>
          {CAT_PARTS.map(p => {
            const on = p === part
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPart(p)}
                className="m-press m-focus"
                style={{
                  flex: '0 0 auto', height: 40, boxSizing: 'border-box', padding: '0 16px',
                  border: `2px solid ${on ? M.leaf : M.hairline}`, borderRadius: RADIUS.pill,
                  background: on ? M.leafTint : M.ground, fontSize: 14, fontWeight: on ? 800 : 700,
                  color: on ? M.leafInk : M.text, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {PART_LABELS[p]}
              </button>
            )
          })}
          <span aria-hidden style={{ flex: '0 0 auto', width: 12 }} />
        </div>
      </div>

      <div style={{ margin: '14px 24px 0', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...TYPE.label, color: M.label }}>{partLabel} colour</span>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{furLabel}</span>
      </div>
      <div role="radiogroup" aria-label={`${partLabel} colour`} style={{
        margin: '8px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(6, 40px)',
        justifyContent: 'space-between', rowGap: 10,
      }}>
        {FUR_COLOURS.map(f => (
          <Swatch
            key={f.key}
            label={f.label}
            on={f.key === fur}
            onPick={() => onChange({ ...value, parts: { ...value.parts, [part]: f.key } })}
            style={{ background: f.swatch }}
          />
        ))}
      </div>

      <GroupLabel style={{ margin: '16px 24px 0' }}>Pattern</GroupLabel>
      <PatternPicker
        value={pattern}
        onPick={k => onChange({ ...value, pattern: k === 'none' ? null : k })}
      />

      <div style={{ margin: '18px 20px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupLabel style={{ paddingLeft: 4 }}>Eyes</GroupLabel>
          <div role="radiogroup" aria-label="Eyes" style={{ display: 'flex', gap }}>
            {EYE_COLOURS.map(e => (
              <Swatch
                key={e.key}
                label={e.label}
                on={e.key === value.eyes}
                onPick={() => onChange({ ...value, eyes: e.key })}
                style={{ width: sw, height: sw, background: e.swatch }}
              >
                {/* A slit pupil with its catchlight, so the row reads as eyes. */}
                <span style={{ position: 'relative', width: 8, height: 24, borderRadius: RADIUS.pill, background: M.text }}>
                  <span style={{ position: 'absolute', left: 5, top: 3, width: 5, height: 5, borderRadius: RADIUS.pill, background: M.ground }} />
                </span>
              </Swatch>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupLabel style={{ paddingLeft: 4 }}>Nose</GroupLabel>
          <div role="radiogroup" aria-label="Nose" style={{ display: 'flex', gap }}>
            {NOSE_COLOURS.map(n => (
              <Swatch
                key={n.key}
                label={n.label}
                on={n.key === value.nose}
                onPick={() => onChange({ ...value, nose: n.key })}
                style={{ width: sw, height: sw, background: M.ground, border: `2px solid ${M.hairline}` }}
              >
                <MeadowIcon name="nose" size={sw - 12} color={n.swatch} />
              </Swatch>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

// Measured before paint, so a narrow phone never flashes the wide row first.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Whether the element is narrower than `px` (tracked, so a rotating phone or
 *  a resizing sheet updates it). */
function useNarrowerThan(ref: RefObject<HTMLElement>, px: number): boolean {
  const [narrow, setNarrow] = useState(false)
  useBeforePaint(() => {
    const el = ref.current
    if (!el) return
    const check = () => setNarrow(el.clientWidth < px)
    check()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, px])
  return narrow
}

// The kit's Swatch is a bare colour; eyes and noses draw a pupil or a nose
// inside theirs, so the builder keeps one swatch for all three rows.
function Swatch({ label, on, onPick, style, children }: {
  label: string; on: boolean; onPick: () => void; style: CSSProperties; children?: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-label={label}
      aria-checked={on}
      onClick={onPick}
      className="m-focus"
      style={{
        position: 'relative', width: 40, height: 40, padding: 0, boxSizing: 'border-box',
        border: '2px solid rgba(47, 43, 40, 0.10)', borderRadius: RADIUS.pill,
        boxShadow: on ? RING_ON : 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// The O3 board sizes the pattern segments to their words (the kit's
// Segmented splits evenly), so "Tortoiseshell" gets the room it needs and
// "None" doesn't sit in a slab of empty white.
function PatternPicker({ value, onPick }: { value: 'none' | CatPattern; onPick: (k: 'none' | CatPattern) => void }) {
  return (
    <div role="radiogroup" aria-label="Pattern" style={{
      margin: '8px 20px 0', display: 'flex', height: 44, boxSizing: 'border-box', padding: 4,
      borderRadius: RADIUS.segment, background: M.soft, gap: 4,
    }}>
      {(['none', 'tabby', 'tortie'] as const).map(k => {
        const on = k === value
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(k)}
            className="m-focus"
            style={{
              flex: '1 1 auto', padding: '0 10px', border: 0, borderRadius: RADIUS.segmentInner,
              background: on ? M.ground : 'transparent', boxShadow: on ? `0 2px 0 ${M.softLip}` : 'none',
              fontSize: 15, fontWeight: on ? 800 : 700, color: on ? M.text : M.text2,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}
          >
            {PATTERN_LABELS[k]}
          </button>
        )
      })}
    </div>
  )
}

// The O3 group labels sit on fixed rows, not the kit SectionLabel's 24px-above
// rhythm (that one spaces in-app card groups).
function GroupLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ height: 18, display: 'flex', alignItems: 'center', ...TYPE.label, color: M.label, ...style }}>
      {children}
    </div>
  )
}
