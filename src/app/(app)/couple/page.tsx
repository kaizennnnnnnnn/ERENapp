'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCare } from '@/contexts/CareContext'
import { format } from 'date-fns'
import {
  IconHeartDuo, IconSwords, IconEnvelope, IconCrown, IconPaw, IconHeart, IconStar,
} from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

// ── Obsidian palette / chrome (matches home + StatsHeader) ──
const GOLD    = '#D4AF37'
const GOLD_HI = '#F2D77A'
const GOLD_LO = '#7A5C18'

const OBSIDIAN_FACE: React.CSSProperties = {
  background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
  border: `1px solid ${GOLD}55`,
  boxShadow: [
    '0 4px 14px rgba(0,0,0,0.6)',
    'inset 0 1px 0 rgba(255,255,255,0.06)',
    'inset 0 -1px 0 rgba(0,0,0,0.6)',
    'inset 0 0 0 1px rgba(255,255,255,0.02)',
  ].join(','),
  borderRadius: 4,
}

const OBSIDIAN_BTN: React.CSSProperties = {
  background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
  border: `1px solid ${GOLD}88`,
  boxShadow: [
    '0 3px 10px rgba(0,0,0,0.55)',
    'inset 0 1px 0 rgba(255,255,255,0.07)',
    'inset 0 -1px 0 rgba(0,0,0,0.6)',
  ].join(','),
  borderRadius: 4,
}

function GoldRivets({ inset = 4 }: { inset?: number }) {
  const dot: React.CSSProperties = {
    position: 'absolute',
    width: 3,
    height: 3,
    background: `radial-gradient(circle at 30% 30%, ${GOLD_HI}, ${GOLD} 60%, ${GOLD_LO})`,
    boxShadow: `0 0 3px ${GOLD}aa`,
    pointerEvents: 'none',
  }
  return (
    <>
      <span style={{ ...dot, top: inset, left: inset }} />
      <span style={{ ...dot, top: inset, right: inset }} />
      <span style={{ ...dot, bottom: inset, left: inset }} />
      <span style={{ ...dot, bottom: inset, right: inset }} />
    </>
  )
}

const goldText: React.CSSProperties = {
  background: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 50%, ${GOLD_LO} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: `drop-shadow(0 0 2px ${GOLD}55)`,
}

function ObsidianChip({ children, accentRgb = '212,175,55' }: { children: React.ReactNode; accentRgb?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 relative" style={{
      padding: '5px 10px 5px 8px',
      ...OBSIDIAN_BTN,
    }}>
      <GoldRivets inset={2} />
      <span style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.08), transparent)`,
        pointerEvents: 'none',
        borderRadius: 4,
      }} />
      {children}
    </span>
  )
}

export default function CouplePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { setHideStats } = useCare()
  const { partner, loveMeter, anniversary, journal, sendMessage, markAllRead, loading } = useCouple()
  useEffect(() => { setHideStats(false) }, [setHideStats])
  useEffect(() => { markAllRead() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!msg.trim() || sending) return
    setSending(true)
    await sendMessage(msg)
    setMsg('')
    setSending(false)
  }

  // Dark page surface that overlays the global cream background.
  const pageStyle: React.CSSProperties = {
    background: 'radial-gradient(ellipse at top, #1a1320 0%, #0a0a0c 60%, #050507 100%)',
    minHeight: '100vh',
    color: '#E8E0D0',
  }

  if (loading) {
    return (
      <div className="page-scroll flex items-center justify-center min-h-[60vh]" style={pageStyle}>
        <span className="font-pixel animate-pulse-soft" style={{ fontSize: 8, color: GOLD_HI, textShadow: `0 0 4px ${GOLD}66` }}>
          LOADING<span className="animate-cursor">_</span>
        </span>
      </div>
    )
  }

  return (
    <div className="page-scroll" style={pageStyle}>
      {/* ── Header row ── */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:translate-y-[1px] transition-transform relative"
          style={{ width: 32, height: 32, ...OBSIDIAN_BTN }}>
          <GoldRivets inset={2} />
          <ChevronLeft size={16} style={{ color: GOLD_HI }} />
        </button>
        <ObsidianChip accentRgb="255,107,157">
          <IconHeartDuo size={14} />
          <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...goldText }}>US</span>
        </ObsidianChip>
      </div>
      <p className="text-sm mb-5" style={{ color: '#9A8C70' }}>You &amp; your partner</p>

      {/* ── Anniversary ── */}
      {anniversary && (
        <div className="mb-4 p-5 text-center relative overflow-hidden" style={OBSIDIAN_FACE}>
          <GoldRivets inset={4} />
          {/* Subtle hairline gold accent across the top */}
          <div aria-hidden style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
            background: `linear-gradient(90deg, transparent, ${GOLD}66, transparent)`,
          }} />
          {/* Soft starfield */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: `radial-gradient(circle, ${GOLD} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />

          <div className="relative">
            <div className="flex items-center justify-center gap-2 mb-2">
              <IconHeart size={10} />
              <p className="font-pixel" style={{ fontSize: 6, letterSpacing: 2.5, color: GOLD_HI, textShadow: `0 0 3px ${GOLD}66` }}>TOGETHER FOR</p>
              <IconHeart size={10} />
            </div>
            <p className="font-pixel" style={{ fontSize: 36, lineHeight: 1, ...goldText, marginBottom: 4 }}>{anniversary.days}</p>
            <p className="font-pixel mb-3" style={{ fontSize: 8, letterSpacing: 3, color: GOLD_LO }}>DAYS</p>
            {anniversary.milestone && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-2 relative" style={OBSIDIAN_BTN}>
                <GoldRivets inset={2} />
                <IconStar size={12} />
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, ...goldText }}>{anniversary.milestone}</span>
              </div>
            )}
            {anniversary.nextMilestone && (
              <p className="text-xs" style={{ color: '#7A6A50' }}>
                Next: {anniversary.nextMilestone.name} in {anniversary.nextMilestone.daysLeft} days
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Love Meter (Care Battle) ── */}
      {loveMeter && partner && (
        <div className="mb-4 p-4 relative overflow-hidden" style={OBSIDIAN_FACE}>
          <GoldRivets inset={4} />
          {/* Battle-y diagonal scanlines */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: `repeating-linear-gradient(45deg, ${GOLD} 0, ${GOLD} 2px, transparent 2px, transparent 8px)` }} />

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <ObsidianChip accentRgb="245,200,66">
                <IconSwords size={14} />
                <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...goldText }}>CARE BATTLE</span>
              </ObsidianChip>
              <span className="text-[10px]" style={{ color: '#7A6A50' }}>Last 30 days</span>
            </div>

            {/* VS display */}
            <div className="flex items-center gap-3 mb-3">
              {/* User 1 */}
              <div className="flex-1 text-center">
                <p className="font-pixel mb-1" style={{ fontSize: 7, letterSpacing: 1.5, color: GOLD_HI, opacity: 0.85 }}>
                  {loveMeter.user1.id === user?.id ? 'YOU' : loveMeter.user1.name.split(' ')[0].toUpperCase()}
                </p>
                <p className="font-pixel" style={{
                  fontSize: 26, lineHeight: 1,
                  ...(loveMeter.leader === loveMeter.user1.id
                    ? goldText
                    : { color: '#5A5A5A' }),
                }}>
                  {loveMeter.user1.score}
                </p>
                {loveMeter.leader === loveMeter.user1.id && (
                  <div className="flex justify-center mt-1"><IconCrown size={18} /></div>
                )}
              </div>

              {/* VS orb */}
              <div className="flex items-center justify-center relative" style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 28%, #2a2a2e 0%, #0a0a0c 50%, #000 100%)',
                boxShadow: [
                  `0 0 0 1.5px ${GOLD}`,
                  '0 0 0 3px #000',
                  `0 0 0 4px ${GOLD}55`,
                  '0 4px 14px rgba(0,0,0,0.7)',
                ].join(','),
              }}>
                <span className="font-pixel" style={{ fontSize: 9, ...goldText }}>VS</span>
              </div>

              {/* User 2 */}
              <div className="flex-1 text-center">
                <p className="font-pixel mb-1" style={{ fontSize: 7, letterSpacing: 1.5, color: GOLD_HI, opacity: 0.85 }}>
                  {loveMeter.user2.id === user?.id ? 'YOU' : loveMeter.user2.name.split(' ')[0].toUpperCase()}
                </p>
                <p className="font-pixel" style={{
                  fontSize: 26, lineHeight: 1,
                  ...(loveMeter.leader === loveMeter.user2.id
                    ? goldText
                    : { color: '#5A5A5A' }),
                }}>
                  {loveMeter.user2.score}
                </p>
                {loveMeter.leader === loveMeter.user2.id && (
                  <div className="flex justify-center mt-1"><IconCrown size={18} /></div>
                )}
              </div>
            </div>

            {/* Competition bar — gold gradient on each side, neutral split */}
            <div className="flex h-3 overflow-hidden" style={{
              border: `1px solid ${GOLD}66`,
              background: '#000',
              boxShadow: `inset 0 1px 3px rgba(0,0,0,0.9)`,
            }}>
              <div style={{
                width: `${loveMeter.user1.pct}%`,
                background: `linear-gradient(90deg, #FF6B9D 0%, ${GOLD} 100%)`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                transition: 'width 0.5s',
              }} />
              <div style={{
                width: `${loveMeter.user2.pct}%`,
                background: `linear-gradient(90deg, ${GOLD} 0%, #A78BFA 100%)`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                transition: 'width 0.5s',
              }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="font-pixel" style={{ fontSize: 7, color: '#FF6B9D' }}>{loveMeter.user1.pct}%</span>
              <span className="font-pixel" style={{ fontSize: 7, color: '#A78BFA' }}>{loveMeter.user2.pct}%</span>
            </div>

            {!loveMeter.leader && (
              <p className="text-center text-xs mt-2" style={{ color: '#7A6A50' }}>It&apos;s a tie!</p>
            )}
          </div>
        </div>
      )}

      {/* ── Shared Journal ── */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ObsidianChip accentRgb="167,139,250">
            <IconEnvelope size={14} />
            <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...goldText }}>EREN&apos;S JOURNAL</span>
          </ObsidianChip>
        </div>

        {/* Compose */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative" style={{ ...OBSIDIAN_BTN, padding: 0 }}>
            <GoldRivets inset={3} />
            <input
              className="w-full px-3 py-2.5 text-sm bg-transparent outline-none"
              style={{ color: '#E8E0D0' }}
              placeholder="Write a message for your partner..."
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              maxLength={500}
            />
          </div>
          <button onClick={() => { playSound('ui_tap'); handleSend() }} disabled={!msg.trim() || sending}
            className="flex items-center justify-center active:translate-y-[1px] transition-all disabled:opacity-40 relative"
            style={{ width: 42, height: 42, ...OBSIDIAN_BTN }}>
            <GoldRivets inset={2} />
            <Send size={16} style={{ color: GOLD_HI, filter: `drop-shadow(0 0 3px ${GOLD}aa)` }} />
          </button>
        </div>

        <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: '#7A6A50' }}>
          Eren will deliver your message to your partner
          <IconPaw size={12} />
        </p>

        {/* Messages */}
        <div className="flex flex-col gap-2">
          {journal.length === 0 && (
            <p className="text-center text-sm py-4" style={{ color: '#7A6A50' }}>No messages yet. Send the first one!</p>
          )}
          {journal.map(m => {
            const isMe = m.sender_id === user?.id
            return (
              <div key={m.id} className="flex gap-2"
                style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                {!isMe && (
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center relative"
                    style={{
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 35% 28%, #2a2a2e 0%, #0a0a0c 50%, #000 100%)',
                      boxShadow: `0 0 0 1.5px ${GOLD}, 0 0 0 3px #000, 0 0 0 4px ${GOLD}55`,
                    }}>
                    <img src="/erenGood.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain', imageRendering: 'pixelated' }} />
                  </div>
                )}
                <div className="max-w-[75%] px-3 py-2 relative" style={{
                  ...OBSIDIAN_FACE,
                  // Soft warm tint for "me", cool tint for partner — reuses the
                  // bottom border-radius asymmetry as a subtle direction cue.
                  borderColor: isMe ? `${GOLD}55` : '#A78BFA55',
                  borderRadius: isMe ? '6px 6px 2px 6px' : '6px 6px 6px 2px',
                }}>
                  <p className="text-sm" style={{ color: '#E8E0D0' }}>{m.message}</p>
                  <p className="text-[9px] mt-1" style={{ color: '#7A6A50' }}>
                    {format(new Date(m.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
