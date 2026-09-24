'use client'

// ─── The cat steps: Build (+ Fine-tune), Boy or girl, Name ───────────────────
// Boards O2, O3, O4, O4b. Presentational: the flow owns the draft and passes
// the values and the callbacks in.

import { useId, useRef, type KeyboardEvent } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { CheckDisc, Chip, M, PrimaryButton, RADIUS, TextField } from '@/components/meadow'
import CatBuilder, { type BuilderView } from '@/components/cat/CatBuilder'
import {
  CAT_NAME_MAX, NAME_SUGGESTIONS, catPronouns, validateCatName,
  type CatLook, type CatSex,
} from '@/lib/catIdentity'
import OnbScreen, { FieldLabel, Note } from './OnbScreen'
import OnbStage, { StageBubble } from './OnbStage'

// ─── Build your cat / Fine-tune ──────────────────────────────────────────────

export function BuildScreen({ view, look, onLook, onView, onBack, onNext }: {
  view: BuilderView
  look: CatLook
  onLook: (l: CatLook) => void
  onView: (v: BuilderView) => void
  onBack: () => void
  onNext: () => void
}) {
  const tune = view === 'tune'
  return (
    <OnbScreen
      onBack={tune ? () => onView('build') : onBack}
      backLabel={tune ? 'Back to the coats' : 'Back'}
      title={tune ? 'Fine-tune' : 'Build your cat'}
      topRight={tune ? undefined : (
        <button type="button" onClick={() => onView('tune')} className="m-press m-focus" style={{
          height: 44, padding: '0 8px', border: 0, background: 'transparent', display: 'flex', alignItems: 'center',
          gap: 7, fontFamily: 'inherit', fontSize: 15, fontWeight: 800, color: M.leaf, whiteSpace: 'nowrap', cursor: 'pointer',
        }}>
          <MeadowIcon name="brush" size={20} />
          Fine-tune colours
        </button>
      )}
      footer={<PrimaryButton onClick={onNext}>{tune ? 'Done' : 'This is my cat'}</PrimaryButton>}
    >
      <CatBuilder value={look} onChange={onLook} view={view} onViewChange={onView} />
    </OnbScreen>
  )
}

// ─── Boy or girl? ────────────────────────────────────────────────────────────

const SEXES: ReadonlyArray<{ value: CatSex; label: string; icon: 'male' | 'female' }> = [
  { value: 'male', label: 'Boy', icon: 'male' },
  { value: 'female', label: 'Girl', icon: 'female' },
]

export function SexScreen({ sex, onSex, look, onBack, onNext }: {
  sex: CatSex
  onSex: (s: CatSex) => void
  look: CatLook
  onBack: () => void
  onNext: () => void
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  // Arrow keys move the choice, like native radios.
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + SEXES.length) % SEXES.length
    onSex(SEXES[next].value)
    refs.current[next]?.focus()
  }
  return (
    <OnbScreen
      onBack={onBack}
      title="Boy or girl?"
      footer={<PrimaryButton onClick={onNext}>Next</PrimaryButton>}
    >
      <OnbStage kind="std" look={look} alt="Your cat, waiting to hear">
        <StageBubble top={40} width={224}>Am I a boy or a girl?</StageBubble>
      </OnbStage>
      <div role="radiogroup" aria-label="Boy or girl" style={{ margin: '20px 20px 0', display: 'flex', gap: 14 }}>
        {SEXES.map((s, i) => {
          const on = s.value === sex
          return (
            <button
              key={s.value}
              ref={el => { refs.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onSex(s.value)}
              onKeyDown={e => onKey(e, i)}
              className="m-press m-focus"
              style={{
                position: 'relative', flex: '1 1 0', height: 152, boxSizing: 'border-box', padding: 0,
                border: `2px solid ${on ? M.leaf : M.hairline}`, borderRadius: RADIUS.card,
                background: on ? M.leafTint : M.ground, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <MeadowIcon name={s.icon} size={64} color={on ? M.leaf : M.text} />
              <span style={{ fontSize: 20, lineHeight: 1.2, fontWeight: on ? 800 : 700, color: on ? M.leafInk : M.text }}>
                {s.label}
              </span>
              {on && <CheckDisc corner />}
            </button>
          )
        })}
      </div>
      <Note center style={{ margin: '18px 24px 0' }}>You can change this anytime in Settings.</Note>
    </OnbScreen>
  )
}

// ─── Name your cat ───────────────────────────────────────────────────────────

const NAME_CHIPS = ['Mochi', 'Luna', 'Miso', 'Biscuit'] as const

export function NameScreen({ name, onName, sex, look, error, onBack, onNext }: {
  name: string
  onName: (n: string) => void
  sex: CatSex
  look: CatLook
  /** Shown after a tap on the button with an unusable name. */
  error: string | null
  onBack: () => void
  onNext: () => void
}) {
  const id = useId()
  const valid = validateCatName(name).ok
  const low = name.trim().toLowerCase()
  const shuffle = () => {
    const i = NAME_SUGGESTIONS.findIndex(n => n.toLowerCase() === low)
    onName(NAME_SUGGESTIONS[(i + 1) % NAME_SUGGESTIONS.length])
  }
  return (
    <OnbScreen
      onBack={onBack}
      title="Name your cat"
      footer={(
        <PrimaryButton onClick={onNext} style={{ opacity: valid ? 1 : 0.45 }}>That&apos;s my name</PrimaryButton>
      )}
    >
      <form onSubmit={e => { e.preventDefault(); onNext() }}>
        <OnbStage kind="std" look={look} alt="Your cat, waiting for a name">
          <StageBubble top={40} width={190}>What&apos;s my name?</StageBubble>
        </OnbStage>
        <div style={{ margin: '26px 20px 0' }}>
          <FieldLabel htmlFor={id}>{catPronouns(sex).His} name</FieldLabel>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <TextField
              id={id}
              value={name}
              onChange={e => onName(e.target.value)}
              // Tapping the pre-filled name selects it, so typing replaces the suggestion.
              onFocus={e => e.currentTarget.select()}
              maxLength={CAT_NAME_MAX}
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="Type a name"
              error={error}
              trailing={valid ? <CheckDisc /> : undefined}
              style={{ flex: '1 1 auto', minWidth: 0 }}
            />
            <button
              type="button"
              aria-label="Shuffle name"
              onClick={shuffle}
              className="m-lip m-focus"
              style={{
                ['--m-lip' as string]: M.softLip, ['--m-lip-h' as string]: '4px',
                flex: '0 0 auto', width: 56, height: 56, padding: 0, border: 0, borderRadius: RADIUS.button,
                background: M.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <MeadowIcon name="dice" size={28} />
            </button>
          </div>
        </div>
        <div role="group" aria-label="Name ideas" style={{ margin: '18px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {NAME_CHIPS.map(n => (
            <Chip key={n} selected={n.toLowerCase() === low} onClick={() => onName(n)} style={{ fontWeight: 700 }}>{n}</Chip>
          ))}
        </div>
        <Note style={{ margin: '18px 24px 0' }}>You can change this anytime in Settings.</Note>
      </form>
    </OnbScreen>
  )
}
