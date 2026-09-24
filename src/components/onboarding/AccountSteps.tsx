'use client'

// ─── The people steps: Say hello, Save, Your account, Enter your code ────────
// Boards O5, O6 and the joiner's code screen from the prototype. "Your
// account" (email + password) is the one screen the boards don't draw: they
// stop at "Continue with email". It is a plain white step like the others,
// not a sheet, so the phone keyboard can scroll the fields into view.

import Link from 'next/link'
import { useId, type ReactNode } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { CheckDisc, M, PrimaryButton, TextButton, TextField } from '@/components/meadow'
import { INVITE_CODE_INPUT_MAX } from '@/lib/onboarding'
import type { CatLook } from '@/lib/catIdentity'
import OnbScreen, { ErrorLine, FieldLabel, ImplicitSubmit, Note } from './OnbScreen'
import OnbStage, { StageBubble } from './OnbStage'
import { PasswordField } from './PasswordField'

const NAME_MAX = 24

// ─── Say hello ───────────────────────────────────────────────────────────────

export function YouScreen({ userName, onUserName, catName, look, error, onBack, onNext }: {
  userName: string
  onUserName: (n: string) => void
  /** The creator's cat; null for a joiner, who hasn't met theirs yet. */
  catName: string | null
  look: CatLook | null
  error: string | null
  onBack: () => void
  onNext: () => void
}) {
  const id = useId()
  const joiner = catName === null
  return (
    <OnbScreen onBack={onBack} title="Say hello" footer={<PrimaryButton onClick={onNext}>Nice to meet you</PrimaryButton>}>
      <form onSubmit={e => { e.preventDefault(); onNext() }}>
        <OnbStage kind="std" look={look} silhouette={joiner} alt={joiner ? 'A cat you have not met yet, in shadow' : `${catName}, your cat`}>
          <StageBubble top={18} minWidth={210}>
            {joiner ? 'Hello!\nWhat\'s your name?' : `I'm ${catName}.\nWhat's your name?`}
          </StageBubble>
        </OnbStage>
        <div style={{ margin: '26px 20px 0' }}>
          <FieldLabel htmlFor={id}>Your name</FieldLabel>
          <TextField
            id={id}
            value={userName}
            onChange={e => onUserName(e.target.value)}
            maxLength={NAME_MAX}
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Your name"
            error={error}
            trailing={userName.trim() ? <CheckDisc /> : undefined}
          />
        </div>
        {!error && (
          <Note style={{ margin: '14px 24px 0' }}>
            {joiner ? 'Your cat and your person will see this name.' : `${catName} will call you this.`}
          </Note>
        )}
      </form>
    </OnbScreen>
  )
}

// ─── Save {cat} ──────────────────────────────────────────────────────────────

export function SaveScreen({
  title, subtitle, bubble, look, silhouette, onBack,
  mode, agree, onAgree, agreeError, onContinue,
  signedInAs, error, primaryLabel, onPrimary, secondary, busy,
}: {
  title: string
  subtitle: string
  bubble: string
  look: CatLook | null
  silhouette?: boolean
  onBack?: () => void
  /** 'new' = no account yet: the terms box and "Continue with email".
   *  'finish' = signed in already: one button that builds or joins the home. */
  mode: 'new' | 'finish'
  agree?: boolean
  onAgree?: (v: boolean) => void
  agreeError?: boolean
  onContinue?: () => void
  signedInAs?: string | null
  error?: string | null
  primaryLabel?: string
  onPrimary?: () => void
  secondary?: { label: string; onClick: () => void }
  busy?: boolean
}) {
  const boxId = useId()
  // The terms box sits under the stage, where the Save board has it; the
  // board's second button (Continue with Apple) is left out until the Apple
  // provider is configured, so email is the one green button.
  const consent: ReactNode = mode === 'new' ? (
    <div style={{ margin: '44px 24px 0 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <button
          id={boxId}
          type="button"
          role="checkbox"
          aria-checked={!!agree}
          aria-invalid={agreeError || undefined}
          onClick={() => onAgree?.(!agree)}
          className="m-focus"
          style={{
            flex: '0 0 auto', width: 44, height: 44, padding: 0, border: 0, background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <span aria-hidden style={{
            width: 26, height: 26, boxSizing: 'border-box', borderRadius: 8,
            border: `2px solid ${agree ? M.leaf : agreeError ? M.danger : '#CFC9C0'}`,
            background: agree ? M.leaf : M.ground, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {agree && <MeadowIcon name="check8" size={14} />}
          </span>
        </button>
        {/* Consent gate. The stores require agreement to the content rules,
            and the 18+ floor has to be stated where someone actually sees it,
            not only inside the document. Unticked by default (the board drew
            it ticked; a pre-ticked box is not consent), and the button won't
            go on until it is ticked. The links open in a new tab so reading
            them doesn't throw away the flow. */}
        <label htmlFor={boxId} style={{
          margin: 0, paddingTop: 3, fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text2, cursor: 'pointer',
        }}>
          I&apos;m 18 or over and agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: M.leaf, fontWeight: 800, textDecoration: 'none' }}>Terms</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: M.leaf, fontWeight: 800, textDecoration: 'none' }}>Privacy Policy</a>.
        </label>
      </div>
      {agreeError && <ErrorLine style={{ margin: '4px 0 0 10px' }}>Tick the box to carry on.</ErrorLine>}
    </div>
  ) : null

  const footer: ReactNode = mode === 'new' ? (
    <PrimaryButton
      onClick={onContinue}
      icon={<MeadowIcon name="envelope" color="#FFFFFF" />}
      style={{ opacity: agree ? 1 : 0.45 }}
    >
      Continue with email
    </PrimaryButton>
  ) : (
    <>
      {error && <ErrorLine center style={{ marginBottom: 10 }}>{error}</ErrorLine>}
      {signedInAs && !error && (
        <Note center style={{ marginBottom: 6 }}>Signed in as <b style={{ color: M.text }}>{signedInAs}</b></Note>
      )}
      {secondary && (
        <TextButton tone="muted" onClick={secondary.onClick} disabled={busy} style={{ height: 44 }}>{secondary.label}</TextButton>
      )}
      <PrimaryButton onClick={onPrimary} busy={busy} style={{ marginTop: secondary ? 8 : 4 }}>
        {busy ? 'One moment...' : primaryLabel}
      </PrimaryButton>
    </>
  )

  return (
    <OnbScreen
      onBack={busy ? undefined : onBack}
      title={title}
      subtitle={subtitle}
      topRight={mode === 'new' ? (
        <Link href="/auth/login" className="m-press m-focus" style={{
          height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 800,
          color: M.leaf, textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          Log in instead
        </Link>
      ) : undefined}
      footer={footer}
    >
      <OnbStage kind="build" look={look} silhouette={silhouette} alt={silhouette ? 'A cat you have not met yet, in shadow' : 'Your cat'}>
        <StageBubble top={18} minWidth={230}>{bubble}</StageBubble>
      </OnbStage>
      {consent}
    </OnbScreen>
  )
}

// ─── Your account (email + password) ─────────────────────────────────────────

export interface EmailError { field: 'email' | 'password' | 'form'; message: string; duplicate?: boolean }

export function EmailScreen({ email, password, onEmail, onPassword, error, busy, primaryLabel, onSubmit, onBack }: {
  email: string
  password: string
  onEmail: (v: string) => void
  onPassword: (v: string) => void
  error: EmailError | null
  busy: boolean
  primaryLabel: string
  onSubmit: () => void
  onBack: () => void
}) {
  return (
    <OnbScreen
      onBack={busy ? undefined : onBack}
      title="Your account"
      subtitle="It's how you log back in on any phone."
      footer={<PrimaryButton onClick={onSubmit} busy={busy}>{busy ? 'One moment...' : primaryLabel}</PrimaryButton>}
    >
      <form
        onSubmit={e => { e.preventDefault(); onSubmit() }}
        style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="next"
          value={email}
          onChange={e => onEmail(e.target.value)}
          placeholder="you@example.com"
          error={error?.field === 'email' ? error.message : null}
          disabled={busy}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          enterKeyHint="go"
          value={password}
          onChange={e => onPassword(e.target.value)}
          placeholder="Pick a password"
          hint="At least 6 characters."
          error={error?.field === 'password' ? error.message : null}
          disabled={busy}
        />
        {error?.field === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, margin: '0 4px' }}>
            <ErrorLine>{error.message}</ErrorLine>
            {error.duplicate && <TextButton href="/auth/login" style={{ marginLeft: -8 }}>Log in instead</TextButton>}
          </div>
        )}
        <ImplicitSubmit />
      </form>
    </OnbScreen>
  )
}

// ─── Enter your code (joiner) ────────────────────────────────────────────────

export function CodeScreen({ code, onCode, error, busy, onBack, onNext }: {
  code: string
  onCode: (v: string) => void
  error: string | null
  busy: boolean
  onBack: () => void
  onNext: () => void
}) {
  const id = useId()
  return (
    <OnbScreen
      onBack={busy ? undefined : onBack}
      title="Enter your code"
      footer={<PrimaryButton onClick={onNext} busy={busy}>{busy ? 'Finding it...' : 'Find my home'}</PrimaryButton>}
    >
      <form onSubmit={e => { e.preventDefault(); onNext() }}>
        <OnbStage kind="std" look={null} silhouette alt="A cat waiting, still in shadow">
          <StageBubble top={40}>Who&apos;s there?</StageBubble>
        </OnbStage>
        <div style={{ margin: '26px 20px 0' }}>
          <FieldLabel htmlFor={id}>House key</FieldLabel>
          <div style={{ position: 'relative' }}>
            <TextField
              id={id}
              value={code}
              onChange={e => onCode(e.target.value.toUpperCase())}
              maxLength={INVITE_CODE_INPUT_MAX}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="ABCD 1234"
              error={error}
              disabled={busy}
              inputStyle={{
                paddingLeft: 54, fontSize: 22, fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums',
              }}
            />
            <MeadowIcon name="houseKey" style={{ position: 'absolute', left: 18, top: 16, pointerEvents: 'none' }} />
          </div>
        </div>
        {!error && <Note style={{ margin: '14px 24px 0' }}>It&apos;s in the invite your person sent you.</Note>}
      </form>
    </OnbScreen>
  )
}
