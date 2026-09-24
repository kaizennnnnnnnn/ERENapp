'use client'

// ─── {cat} is home. (creator)  /  Meet {cat}, your cat. (joiner) ─────────────
// Boards O9 and J1, both set in the living room (RoomScene).

import { useState, type CSSProperties } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { DangerButton, M, PrimaryButton, Sheet, SpeechBubble, TextButton, TYPE, personColor } from '@/components/meadow'
import CatFigure from './CatFigure'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { catPronouns, coatLabel, SEX_LABELS, type CatLook, type CatSex } from '@/lib/catIdentity'
import type { HouseholdIntro } from '@/lib/onboarding'
import RoomScene, { at } from './RoomScene'
import { ErrorLine } from './OnbScreen'

const bubblePop = (reduced: boolean): CSSProperties =>
  reduced ? {} : { animation: 'modalPop 240ms cubic-bezier(0.2, 0.8, 0.2, 1) 360ms both', transformOrigin: '50% 100%' }

// ─── {cat} is home. ──────────────────────────────────────────────────────────

const SPARKLES = [
  { left: 104, top: 234, size: 30, delay: 0 },
  { left: 300, top: 212, size: 22, delay: 1 },
  { left: 288, top: 300, size: 30, delay: 0.5 },
]

export function FinaleScreen({ catName, look, sex, userName, myColor, solo, dateLabel, onHome, busy }: {
  catName: string
  look: CatLook | null
  sex: CatSex
  userName: string
  myColor: string
  /** "Just me for now" was chosen on the invite screen. */
  solo: boolean
  /** Today, e.g. "24 September 2026" (resolved on the client). */
  dateLabel: string
  onHome: () => void
  busy?: boolean
}) {
  const reduced = useReducedMotion()
  const user = userName.trim()
  const long = catName.length > 11
  const sig = user || 'You'
  const sigSize = sig.length <= 6 ? 22 : sig.length <= 8 ? 19 : sig.length <= 11 ? 16 : 14
  const p = catPronouns(sex)
  return (
    <RoomScene
      label={`${catName} is home`}
      sceneReach={352}
      scene={(
        <>
          <div aria-hidden style={at(153, 434, { width: 123, height: 14, borderRadius: '50%', background: M.floorShadow })} />
          <CatFigure
            look={look}
            width={164}
            height={221}
            alt={`${catName}, your cat, sitting on the living room rug`}
            style={{
              ...at(144, 223),
              animation: reduced ? undefined : 'erenGoodHop 640ms cubic-bezier(0.2, 0.8, 0.2, 1) 900ms 2 both',
              transformOrigin: '50% 100%',
            }}
          />
          {SPARKLES.map((s, i) => (
            <span key={i} aria-hidden style={at(s.left, s.top, {
              width: s.size, height: s.size,
              animation: reduced ? undefined : `mgTwinkle 2s ease-in-out ${s.delay}s infinite`,
            })}>
              <MeadowIcon name="shine" size={s.size} />
            </span>
          ))}
          <SpeechBubble tailOffset={111} style={{ ...at(89, 134), width: 250, ...bubblePop(reduced) }}>
            {user ? `Thank you for bringing me home, ${user}.` : 'Thank you for bringing me home.'}
          </SpeechBubble>
        </>
      )}
      sheet={(
        <div style={{ padding: '26px 24px 0' }}>
          <div style={{ ...TYPE.label, color: M.label }}>Adoption day</div>
          <h1 style={{
            margin: '6px 0 0', fontSize: long ? 23 : 30, lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.015em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {catName} is home.
          </h1>
          <div style={{
            position: 'relative', marginTop: 18, boxSizing: 'border-box', padding: 16, paddingLeft: 18, paddingRight: 18,
            border: `2px solid ${M.hairline}`, borderRadius: 22, background: M.ground,
          }}>
            <div role="img" aria-label={`${catName}'s paw print, stamped on the card`} style={{
              position: 'absolute', right: 18, top: -20, width: 60, height: 60, boxSizing: 'border-box', borderRadius: 999,
              border: `2px solid ${M.leaf}`, background: M.leafTint, display: 'flex', alignItems: 'center',
              justifyContent: 'center', transform: 'rotate(-12deg)',
            }}>
              <span aria-hidden style={{ position: 'absolute', inset: 4, borderRadius: 999, border: '2px dashed #9CC5A6' }} />
              <MeadowIcon name="paw" size={26} color={M.leaf} />
            </div>
            <div style={{ paddingRight: 70, fontSize: 14, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
              Adopted <span style={{ fontWeight: 800, color: M.text, whiteSpace: 'nowrap' }}>{dateLabel}</span> by
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <span style={{
                flex: '1 1 0', minWidth: 0, height: 38, boxSizing: 'border-box', borderBottom: `2px solid ${M.text}`,
                display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 7,
              }}>
                <span style={{
                  minWidth: 0, fontSize: sigSize, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {sig}
                </span>
                <MeadowIcon name="heart" size={16} color={myColor} mono style={{ marginBottom: 2 }} />
              </span>
              <span style={{ flex: '0 0 auto', paddingBottom: 9, fontSize: 14, lineHeight: 1, fontWeight: 700, color: M.text2 }}>and</span>
              <span style={{ flex: '1 1 0', minWidth: 0, height: 38, boxSizing: 'border-box', borderBottom: '2px dashed #CFC9C0' }} />
            </div>
            <div style={{ marginTop: 7, display: 'flex', gap: 12 }}>
              <span style={{ flex: '1 1 0' }} />
              <span style={{ flex: '0 0 auto', width: 25 }} />
              <span style={{ flex: '1 1 0', fontSize: 12, lineHeight: 1.3, fontWeight: 700, color: M.text2 }}>
                {solo ? 'for your person' : 'waiting for them'}
              </span>
            </div>
          </div>
        </div>
      )}
      footer={(
        <PrimaryButton onClick={onHome} busy={busy} icon={<MeadowIcon name="bowl" color="#FFFFFF" />}>
          Give {p.him} breakfast
        </PrimaryButton>
      )}
    />
  )
}

// ─── Meet {cat}, your cat. ───────────────────────────────────────────────────

const FACT_LABEL: CSSProperties = { fontSize: 13, lineHeight: 1.2, fontWeight: 700, color: M.text2 }
const FACT_VALUE: CSSProperties = { fontSize: 16, lineHeight: 1.25, fontWeight: 800, whiteSpace: 'nowrap' }

export function MeetScreen({
  intro, homeSinceLabel, error, onRetry, onMoveIn, onLeave, leaving, leaveError,
}: {
  /** null while it loads (or failed: see `error`). */
  intro: HouseholdIntro | null
  /** households.created_at, formatted on the client ("31 Mar 2026"). */
  homeSinceLabel: string | null
  error: string | null
  onRetry: () => void
  onMoveIn: () => void
  /** "That's not my code": leave this home and go back to the code. */
  onLeave: () => void
  leaving: boolean
  leaveError: string | null
}) {
  const reduced = useReducedMotion()
  const [confirm, setConfirm] = useState(false)
  const cat = intro?.cat
  const partner = intro?.partner ?? null
  const name = cat?.name ?? ''
  const p = catPronouns(cat?.sex ?? 'male')
  return (
    <>
      <RoomScene
        label={cat ? `Meet ${name}` : 'Your new home'}
        sceneReach={326}
        scene={(
          <>
            <div aria-hidden style={at(154, 436, { width: 120, height: 14, borderRadius: '50%', background: M.floorShadow })} />
            <CatFigure
              look={cat ? cat.look : null}
              width={150}
              height={202}
              alt={cat ? `${name}, your cat, on the living room rug` : 'Your cat, still in shadow'}
              silhouette={!cat}
              style={at(148, 242)}
            />
            {cat && (
              <SpeechBubble tailOffset={106} style={{ ...at(94, 160), width: 240, ...bubblePop(reduced) }}>
                {partner ? `${partner.name} has been waiting for you.` : "I've been waiting for you."}
              </SpeechBubble>
            )}
          </>
        )}
        sheet={(
          <div style={{ padding: '28px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
              {partner && (
                <span aria-hidden style={{
                  flex: '0 0 auto', width: 28, height: 28, borderRadius: 999, background: personColor(partner.heart),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#FFFFFF',
                }}>
                  {partner.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span style={{ ...TYPE.label, color: M.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {partner ? `Invited by ${partner.name}` : 'Your new home'}
              </span>
            </div>
            <h1 style={{
              ...TYPE.heading, margin: '10px 0 0', fontSize: name.length > 11 ? 22 : 26,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {cat ? `Meet ${name}, your cat.` : error ? 'Almost there.' : 'Finding your cat...'}
            </h1>
            {error ? (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <ErrorLine>{error}</ErrorLine>
                <TextButton onClick={onRetry} style={{ marginLeft: -8 }}>Try again</TextButton>
              </div>
            ) : (
              <div style={{
                marginTop: 18, height: 72, borderRadius: 20, background: M.soft, display: 'flex', alignItems: 'stretch',
              }}>
                <Fact flex="0.8 1 0" label={cat ? `${p.He}'s a` : 'Your cat'} value={cat ? SEX_LABELS[cat.sex] : '-'} />
                <FactRule />
                <Fact flex="1.25 1 0" label="Coat" value={cat ? coatLabel(cat.look) : '-'} />
                <FactRule />
                <Fact flex="1.25 1 0" label="Home since" value={homeSinceLabel ?? '-'} numeric />
              </div>
            )}
          </div>
        )}
        footer={(
          <>
            <TextButton tone="muted" onClick={() => setConfirm(true)} disabled={leaving} style={{ height: 44 }}>
              That&apos;s not my code
            </TextButton>
            <PrimaryButton
              onClick={onMoveIn}
              disabled={leaving}
              icon={<MeadowIcon name="home" size={22} color="#FFFFFF" />}
              style={{ marginTop: 8 }}
            >
              Move in
            </PrimaryButton>
          </>
        )}
      />
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        dismissible={!leaving}
        title="Wrong home?"
        footer={(
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            {leaveError && <ErrorLine center>{leaveError}</ErrorLine>}
            <DangerButton onClick={onLeave} busy={leaving}>{leaving ? 'Leaving...' : 'Leave this home'}</DangerButton>
            <TextButton tone="muted" onClick={() => setConfirm(false)} disabled={leaving}>Stay here</TextButton>
          </div>
        )}
      >
        <p style={{ ...TYPE.body, margin: '0 4px', color: M.text2 }}>
          If this isn&apos;t the home you were invited to, leave it now and enter your code again.
          {partner ? ` ${partner.name}'s house key will change, so they'll need to send you the new one.` : ''}
        </p>
      </Sheet>
    </>
  )
}

function Fact({ label, value, flex, numeric }: { label: string; value: string; flex: string; numeric?: boolean }) {
  return (
    <div style={{
      flex, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
      padding: '0 6px',
    }}>
      <span style={FACT_LABEL}>{label}</span>
      <span style={{
        ...FACT_VALUE, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
        fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
      }}>
        {value}
      </span>
    </div>
  )
}

function FactRule() {
  return <div aria-hidden style={{ flex: '0 0 auto', width: 1, margin: '16px 0', background: '#E3DED6' }} />
}
