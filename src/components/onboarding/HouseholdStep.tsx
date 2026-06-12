'use client'

// ═══════════════════════════════════════════════════════════════════════════
// HOUSEHOLD STEP — "move in": build a new home (generates the invite code)
// or join the partner's with their code. Also exports CodeReveal, the
// follow-up screen creators see with their shiny new house key.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import SketchEren from '@/components/SketchEren'
import { IconHouse, IconDoor, IconStar } from '@/components/PixelIcons'
import { ObsidianChip, pinkText } from '@/components/obsidian'
import { playSound } from '@/lib/sounds'
import { createHousehold, joinHousehold } from '@/lib/onboarding'
import { PixelButton, PixelInput, PixelError, dockBtnGloss, dockBtnLabel, dockBtnBase } from './pixelForm'

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} style={{
      ...dockBtnBase,
      height: 42,
      background: active
        ? 'linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 55%, var(--accent-lo) 100%)'
        : 'linear-gradient(180deg, #2A2438 0%, #161222 100%)',
      opacity: active ? 1 : 0.75,
    }}>
      <div style={dockBtnGloss} />
      <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}>{icon}</span>
      <span style={{ ...dockBtnLabel, fontSize: 7 }}>{children}</span>
    </button>
  )
}

export default function HouseholdStep({
  userId,
  userName,
  userEmail,
  resumed,
  onCreated,
  onJoined,
}: {
  userId: string
  userName: string
  userEmail: string | null
  /** true when the flow resumed here after a refresh — show a welcome-back chip */
  resumed: boolean
  onCreated: (v: { householdId: string; inviteCode: string }) => void
  onJoined: (v: { householdId: string }) => void
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [householdName, setHouseholdName] = useState("Eren's Home")
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    if (mode === 'create') {
      if (!householdName.trim()) return
      setLoading(true)
      const res = await createHousehold({ userId, name: userName, householdName: householdName.trim() })
      setLoading(false)
      if (!res.ok) { setError(res.message); return }
      onCreated(res.value)
    } else {
      if (inviteCode.trim().length < 4) return
      setLoading(true)
      const res = await joinHousehold({ userId, name: userName, inviteCode: inviteCode.trim() })
      setLoading(false)
      if (!res.ok) { setError(res.message); return }
      onJoined(res.value)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col" style={{ gap: 16 }}>
      {resumed && (
        <div className="flex justify-center">
          <ObsidianChip>
            <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: 'var(--accent-hi)' }}>
              WELCOME BACK{userName ? `, ${userName.toUpperCase()}` : ''}
            </span>
          </ObsidianChip>
        </div>
      )}

      <div className="flex items-center" style={{ gap: 12 }}>
        <SketchEren state={loading ? 'magic' : 'thinking'} size={84} transparent noSpeech />
        <h1 className="font-pixel" style={{ fontSize: 13, letterSpacing: 2, color: '#F4EDFF' }}>
          MOVE IN
        </h1>
      </div>

      <div className="flex" style={{ gap: 10 }}>
        <ModeButton active={mode === 'create'} onClick={() => { playSound('ui_toggle'); setMode('create') }}
          icon={<IconHouse size={16} />}>
          BUILD A HOME
        </ModeButton>
        <ModeButton active={mode === 'join'} onClick={() => { playSound('ui_toggle'); setMode('join') }}
          icon={<IconDoor size={16} />}>
          JOIN A HOME
        </ModeButton>
      </div>

      {mode === 'create' ? (
        <>
          <PixelInput label="HOME NAME" value={householdName}
            onChange={e => setHouseholdName(e.target.value)} placeholder="Eren's Home" />
          <p style={{ fontSize: 12, lineHeight: 1.6, color: '#9C8FBC', margin: 0 }}>
            You&apos;ll get a code to invite your partner.
          </p>
        </>
      ) : (
        <>
          <PixelInput label="INVITE CODE" value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="8 CHARACTERS" maxLength={8} autoCapitalize="characters" autoCorrect="off"
            style={{ fontFamily: '"Press Start 2P"', fontSize: 16, letterSpacing: 3 }} />
          <p style={{ fontSize: 12, lineHeight: 1.6, color: '#9C8FBC', margin: 0 }}>
            Ask your partner — it&apos;s on their profile.
          </p>
        </>
      )}

      {error && <PixelError>{error}</PixelError>}

      <PixelButton variant="gold" type="submit" disabled={loading}>
        {loading ? '...' : 'MOVE IN'}
      </PixelButton>

      {userEmail && (
        <p className="font-pixel text-center" style={{ fontSize: 5.5, letterSpacing: 1, color: '#7A6F96', margin: 0 }}>
          SIGNED IN AS {userEmail.toUpperCase()}
        </p>
      )}
    </form>
  )
}

// ── Invite-code reveal (creators only) ──────────────────────────────────────

export function CodeReveal({ code, onNext }: { code: string; onNext: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard?.writeText(code).catch(() => {})
    playSound('coin_pickup')
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex flex-col items-center text-center" style={{ gap: 16 }}>
      <SketchEren state="proud" size={120} transparent noSpeech />
      <h1 className="font-pixel" style={{ fontSize: 12, letterSpacing: 2, color: '#F4EDFF' }}>
        YOUR HOUSE KEY
      </h1>

      <div className="relative w-full" style={{
        background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
        border: '2px solid #050507',
        boxShadow: '2px 2px 0 #050507, inset 0 2px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--accent-rgb), 0.35)',
        borderRadius: 4,
        padding: '18px 10px',
      }}>
        <span className="font-pixel" style={{ ...pinkText, fontSize: 17, letterSpacing: 4 }}>
          {code}
        </span>
      </div>

      <PixelButton variant="dark" onClick={copy} style={{ height: 40 }}>
        <span className="inline-flex items-center" style={{ gap: 6 }}>
          <IconStar size={12} />
          {copied ? 'COPIED!' : 'COPY CODE'}
        </span>
      </PixelButton>

      <p style={{ fontSize: 12, lineHeight: 1.7, color: '#C9B8E8', margin: 0, maxWidth: 240 }}>
        Send this to your partner so they can move in too. It also lives on your profile.
      </p>

      <PixelButton variant="gold" onClick={onNext}>NEXT</PixelButton>
    </div>
  )
}
