'use client'

// ─── After the home exists: Invite your person, Hear from {cat} ──────────────
// Boards O7 and O8. Presentational: the flow does the sharing, the copying,
// the permission prompt and the push subscription, and passes the state in.

import type { CSSProperties } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { CheckDisc, M, PrimaryButton, RADIUS, TextButton, TYPE } from '@/components/meadow'
import CatFigure from './CatFigure'
import { formatInviteCode } from '@/lib/onboarding'
import type { CatLook } from '@/lib/catIdentity'
import OnbScreen, { ErrorLine, Note } from './OnbScreen'
import OnbStage, { SideBubble, StageBubble } from './OnbStage'

// ─── Invite your person ──────────────────────────────────────────────────────

export function PartnerScreen({
  catName, look, userName, myColor, inviteCode, copied, linkCopied, onCopy, onShare, onSolo, onNext, onBack, error,
}: {
  catName: string
  look: CatLook | null
  userName: string
  myColor: string
  inviteCode: string
  /** The house key was copied. */
  copied: boolean
  /** No share sheet on this phone, so the invite link went to the clipboard instead. */
  linkCopied: boolean
  onCopy: () => void
  onShare: () => void
  onSolo: () => void
  /** After the link went to the clipboard: carry on as invited. */
  onNext: () => void
  onBack?: () => void
  error?: string | null
}) {
  const initial = userName.trim().charAt(0).toUpperCase()
  const note = copied
    ? 'Copied. Paste it anywhere your person will see it.'
    : linkCopied
      ? 'Invite link copied. Paste it to your person.'
      : 'You can invite someone later from Settings.'
  return (
    <OnbScreen
      onBack={onBack}
      title="Invite your person"
      footer={(
        <>
          {error
            ? <ErrorLine center style={{ marginBottom: 10 }}>{error}</ErrorLine>
            : <Note center role="status" style={{ marginBottom: 10 }}>{note}</Note>}
          <TextButton tone="muted" onClick={onSolo} style={{ height: 44 }}>Just me for now</TextButton>
          <PrimaryButton
            onClick={linkCopied ? onNext : onShare}
            icon={linkCopied ? undefined : <MeadowIcon name="share" size={22} />}
            style={{ marginTop: 8 }}
          >
            {linkCopied ? 'Next' : 'Share invite link'}
          </PrimaryButton>
        </>
      )}
    >
      <OnbStage kind="partner" look={look} alt={`${catName}, your cat`}>
        <SideBubble left={190} top={34} maxWidth={144}>Who else is going to look after me?</SideBubble>
      </OnbStage>

      <div style={{
        margin: '16px 20px 0', boxSizing: 'border-box', padding: 18, border: `2px solid ${M.hairline}`,
        borderRadius: RADIUS.card, background: M.ground,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span aria-hidden style={{ position: 'relative', flex: '0 0 auto', width: 96, height: 44 }}>
            <span style={{ ...seat, left: 0, background: myColor, fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>
              {initial || <MeadowIcon name="person" size={22} color="#FFFFFF" />}
            </span>
            <span style={{ ...seat, left: 52, border: '2px dashed #CFC9C0', background: M.ground }}>
              <MeadowIcon name="person" size={20} color={M.faint} />
            </span>
            <span style={{
              position: 'absolute', left: 36, top: 12, width: 24, height: 20, borderRadius: 999, background: M.ground,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MeadowIcon name="heart" size={16} />
            </span>
          </span>
          <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 17, lineHeight: 1.25, fontWeight: 800 }}>Send your person a link</span>
            <span style={{ fontSize: 14, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>One tap and they move in.</span>
          </span>
        </div>
        <div style={{ height: 1, margin: '16px 0 14px', background: M.divider }} />
        <div style={{ ...TYPE.label, color: M.label }}>Or share your house key</div>
        <div style={{
          marginTop: 8, height: 56, boxSizing: 'border-box', padding: '0 6px 0 14px', borderRadius: RADIUS.input,
          background: M.soft, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <MeadowIcon name="houseKey" />
          <span style={{
            flex: '1 1 auto', minWidth: 0, fontSize: 24, lineHeight: 1, fontWeight: 800, letterSpacing: '0.14em',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', userSelect: 'text',
          }}>
            {formatInviteCode(inviteCode)}
          </span>
          <button
            type="button"
            aria-label={copied ? 'House key copied' : 'Copy house key'}
            onClick={onCopy}
            className="m-lip m-focus"
            style={{
              ['--m-lip' as string]: M.softLip, ['--m-lip-h' as string]: '3px',
              flex: '0 0 auto', width: 44, height: 44, padding: 0, border: 0, borderRadius: 12, background: M.ground,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {copied ? <CheckDisc /> : <MeadowIcon name="copy" />}
          </button>
        </div>
      </div>
    </OnbScreen>
  )
}

const seat: CSSProperties = {
  position: 'absolute', top: 0, width: 44, height: 44, boxSizing: 'border-box', borderRadius: 999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

// ─── Hear from {cat} ─────────────────────────────────────────────────────────

export type NotifyState = 'idle' | 'asking' | 'denied' | 'unsupported' | 'failed'

const NOTIFY_NOTE: Record<NotifyState, string> = {
  idle: 'You can change this anytime in Settings.',
  asking: 'You can change this anytime in Settings.',
  denied: 'Notifications are off for now. You can turn them on later in Settings.',
  unsupported: "Notifications need Eren on your home screen. Add it from your browser's share menu, then turn them on in Settings.",
  failed: "We couldn't finish turning them on. Try again, or do it later in Settings.",
}

export function NotifyScreen({ catName, look, state, onYes, onNotNow, onContinue, onBack }: {
  catName: string
  look: CatLook | null
  state: NotifyState
  onYes: () => void
  onNotNow: () => void
  onContinue: () => void
  onBack?: () => void
}) {
  const settled = state === 'denied' || state === 'unsupported'
  const asking = state === 'asking'
  return (
    <OnbScreen
      onBack={asking ? undefined : onBack}
      title={`Hear from ${catName}`}
      titleSize={catName.length > 11 ? 22 : 26}
      footer={settled ? (
        <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
      ) : (
        <>
          <TextButton tone="muted" onClick={onNotNow} disabled={asking} style={{ height: 44 }}>Not now</TextButton>
          <PrimaryButton
            onClick={onYes}
            busy={asking}
            icon={<MeadowIcon name="bell" size={22} color="#FFFFFF" />}
            style={{ marginTop: 8 }}
          >
            {state === 'failed' ? 'Try again' : 'Yes, tell me'}
          </PrimaryButton>
        </>
      )}
    >
      <OnbStage kind="std" look={look} alt={`${catName}, your cat`}>
        <StageBubble top={18} width={200}>{'Can I tap you\nwhen I\'m hungry?'}</StageBubble>
      </OnbStage>

      <div
        role="img"
        aria-label={`Example notification from ${catName}: I'm a little hungry. Snack?`}
        style={{
          margin: '22px 20px 0', boxSizing: 'border-box', padding: '14px 16px 14px 14px',
          border: `2px solid ${M.hairline}`, borderRadius: RADIUS.card, background: M.ground,
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'mgTileIn 360ms cubic-bezier(0.2, 0.8, 0.2, 1) 340ms both',
        }}
      >
        <span style={{
          position: 'relative', flex: '0 0 auto', width: 44, height: 44, borderRadius: 11, background: '#F7EACB', overflow: 'hidden',
        }}>
          <CatFigure look={look} width={56} height={75} quality="thumb" alt="" style={{ position: 'absolute', left: -2, top: 5 }} />
        </span>
        <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              flex: '1 1 auto', minWidth: 0, fontSize: 15, lineHeight: 1.25, fontWeight: 800,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {catName}
            </span>
            <span style={{ flex: '0 0 auto', fontSize: 13, fontWeight: 500, color: M.text2 }}>now</span>
          </span>
          <span style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 500 }}>I&apos;m a little hungry. Snack?</span>
        </span>
      </div>

      {state === 'failed'
        ? <ErrorLine center style={{ margin: '24px 24px 0' }}>{NOTIFY_NOTE.failed}</ErrorLine>
        : <Note center role="status" style={{ margin: '24px 24px 0' }}>{NOTIFY_NOTE[state]}</Note>}
    </OnbScreen>
  )
}
