'use client'

// ─── Welcome (Main board) ────────────────────────────────────────────────────
// The front door. The classic cat stands on a full-bleed stage with rounded
// bottom corners; under it the app's name, one line of what it is, and the two
// ways in: adopt a cat, or move into someone's home with their code.
//
// The stage gives up height on a short phone (never below 280) so the words
// and both buttons stay on the first screen; the cat shrinks with it, feet
// staying on the meadow.

import Link from 'next/link'
import { useRef, type CSSProperties } from 'react'
import { MeadowIcon, type MeadowIconName } from '@/components/PixelIcons'
import { M, PrimaryButton, TextButton } from '@/components/meadow'
import CatFigure from './CatFigure'
import { useBoxSize } from './useBoxSize'

const TOP = 'max(56px, calc(var(--safe-top, 0px) + 12px))'
const BOTTOM = 'max(34px, env(safe-area-inset-bottom, 0px))'
const CAT_ASPECT = 252 / 341

interface Props {
  /** Signed in but not moved in yet (left a home, or came back mid-flow). */
  signedInAs?: string | null
  onAdopt: () => void
  onInvite: () => void
  onLogOut?: () => void
  busy?: boolean
  /** A failed log out. */
  errorNote?: string | null
}

export default function WelcomeScreen({ signedInAs, onAdopt, onInvite, onLogOut, busy, errorNote }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const { h: H } = useBoxSize(stageRef, { w: 390, h: 500 })
  // Feet 26px above the stage's bottom edge at every height, like the board.
  const catH = Math.max(120, H - 159)
  const catW = Math.round(catH * CAT_ASPECT)
  const decor: Array<{ icon: MeadowIconName; side: 'left' | 'right'; x: number; top: number }> = [
    { icon: 'daisy', side: 'left', x: 26, top: H - 74 },
    { icon: 'tuft', side: 'left', x: 60, top: H - 58 },
    { icon: 'tuft', side: 'right', x: 60, top: H - 58 },
    { icon: 'daisy', side: 'right', x: 26, top: H - 78 },
  ]
  const pill: CSSProperties = {
    position: 'absolute', right: 16, top: TOP, height: 44, boxSizing: 'border-box', padding: '0 16px',
    border: 0, borderRadius: 999, background: '#FFFFFF', display: 'flex', alignItems: 'center',
    fontFamily: 'inherit', fontSize: 15, fontWeight: 800, color: M.text, textDecoration: 'none',
    whiteSpace: 'nowrap', cursor: 'pointer',
    ['--m-lip' as string]: M.softLip, ['--m-lip-h' as string]: '3px',
  }

  return (
    <div className="meadow-page" style={{ padding: 0, background: M.ground, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '1 0 auto' }}>
        <div ref={stageRef} style={{
          position: 'relative', height: 'clamp(280px, calc(100dvh - 344px), 500px)', overflow: 'hidden',
          borderRadius: '0 0 28px 28px', background: M.soft,
        }}>
          <div aria-hidden style={{
            position: 'absolute', left: 'calc(50% - 320px)', top: H - 80, width: 640, height: 260,
            borderRadius: '50%', background: M.hill,
          }} />
          {decor.map((d, i) => (
            <span key={i} aria-hidden style={{ position: 'absolute', top: d.top, [d.side]: d.x }}>
              <MeadowIcon name={d.icon} size={36} />
            </span>
          ))}
          <div aria-hidden style={{
            position: 'absolute', left: 'calc(50% - 91px)', top: H - 38, width: 180, height: 18,
            borderRadius: '50%', background: M.hillShadow,
          }} />
          <CatFigure
            look={null}
            width={catW}
            height={catH}
            alt="Eren, a white and grey cat, sitting on the grass"
            style={{ position: 'absolute', left: `calc(50% + 2px - ${(0.43 * catW).toFixed(1)}px)`, top: H - 26 - catH }}
          />
          {onLogOut ? (
            <button type="button" onClick={onLogOut} disabled={busy} className="m-lip m-focus" style={pill}>
              Log out
            </button>
          ) : (
            <Link href="/auth/login" className="m-lip m-focus" style={pill}>Log in</Link>
          )}
        </div>

        <h1 style={{
          margin: '28px 24px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 44, lineHeight: 1.1,
          fontWeight: 800, letterSpacing: '-0.02em', color: M.text,
        }}>
          Eren
          <MeadowIcon name="paw" size={28} color={M.leaf} style={{ marginTop: 4 }} />
        </h1>
        <p style={{
          margin: '10px 24px 0', maxWidth: 320, fontSize: 17, lineHeight: 1.4, fontWeight: 500, color: M.text2,
        }}>
          A cat of your own.
          <br />
          Look after them together.
        </p>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, flexShrink: 0, background: M.ground, padding: `20px 24px ${BOTTOM}`,
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      }}>
        {errorNote && (
          <p role="alert" style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.danger, textAlign: 'center' }}>
            {errorNote}
          </p>
        )}
        {signedInAs ? (
          <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
            Signed in as <b style={{ color: M.text, fontWeight: 700 }}>{signedInAs}</b>
          </p>
        ) : (
          <p style={{ margin: '0 0 12px', fontSize: 11, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
            By continuing you agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={legalLink}>Terms</a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={legalLink}>Privacy Policy</a>.
          </p>
        )}
        <TextButton onClick={onInvite} disabled={busy} style={{ height: 44 }}>I have an invite code</TextButton>
        <PrimaryButton onClick={onAdopt} busy={busy} style={{ marginTop: 8 }}>Adopt your cat</PrimaryButton>
      </div>
    </div>
  )
}

const legalLink: CSSProperties = { color: M.text, fontWeight: 700, textDecoration: 'underline' }
