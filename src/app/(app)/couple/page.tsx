'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { timeUntilWeekReset } from '@/lib/couple'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCare } from '@/contexts/CareContext'
import { format } from 'date-fns'
import {
  IconHeartDuo, IconSwords, IconEnvelope, IconCrown, IconPaw, IconHeart, IconStar,
  IconFire, IconTrophy, IconCoin,
} from '@/components/PixelIcons'
import { useTasks } from '@/contexts/TaskContext'
import WeeklyChampionPopup from '@/components/couple/WeeklyChampionPopup'
import { playSound } from '@/lib/sounds'
import {
  PINK, PINK_HI, PINK_LO,
  OBSIDIAN_FACE, OBSIDIAN_BTN, OBSIDIAN_ORB,
  Rivets, ObsidianChip, pinkText, accentA,
} from '@/components/obsidian'
import PageLoader from '@/components/PageLoader'
import SendErenSheet from '@/components/couple/SendErenSheet'
import SketchEren from '@/components/SketchEren'
import { MOOD_SKETCH, MOOD_THEME, LOW_MOODS } from '@/lib/moods'
import { MOOD_CONFIGS } from '@/types'

export default function CouplePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { setHideStats } = useCare()
  const {
    partner, partnerStreak,
    loveMeter, anniversary, journal,
    partnerMood, partnerMoodWeek,
    lifetimeWLT, weeklyChampion, claimWeeklyChampion,
    sendMessage, sendNudge, markAllRead, loading,
  } = useCouple()
  const { streak: myStreak } = useTasks()
  const [showSend, setShowSend] = useState(false)
  // Local "user has closed the weekly popup this session" flag — hides
  // the popup instantly on backdrop tap even before the server ack lands.
  const [weeklyDismissed, setWeeklyDismissed] = useState(false)
  // Hide the persistent StatsHeader on this subpage and put it back on
  // unmount, so the user gets the full screen for the couple panel.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])
  useEffect(() => { markAllRead() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  // Live countdown to next Monday 00:00 — re-renders every 60s so the
  // "resets in 2d 14h" label stays current without polling Supabase.
  const [reset, setReset] = useState(() => timeUntilWeekReset())
  useEffect(() => {
    const t = setInterval(() => setReset(timeUntilWeekReset()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Pulse the score numbers when they change. Keyed off the score
  // value so an in-session care action visibly bumps the digit
  // before the bar finishes its width transition.
  const prevS1 = useRef<number>(0)
  const prevS2 = useRef<number>(0)
  const [pulse1, setPulse1] = useState(0)
  const [pulse2, setPulse2] = useState(0)
  useEffect(() => {
    if (!loveMeter) return
    if (loveMeter.user1.score !== prevS1.current) {
      prevS1.current = loveMeter.user1.score
      setPulse1(p => p + 1)
    }
    if (loveMeter.user2.score !== prevS2.current) {
      prevS2.current = loveMeter.user2.score
      setPulse2(p => p + 1)
    }
  }, [loveMeter?.user1.score, loveMeter?.user2.score]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!msg.trim() || sending) return
    setSending(true)
    await sendMessage(msg)
    setMsg('')
    setSending(false)
  }

  // Dark page surface that overlays the global cream background. We
  // override the page-scroll's 120 px top padding (which exists to clear
  // the StatsHeader) since this page hides the header.
  const pageStyle: React.CSSProperties = {
    background: 'radial-gradient(ellipse at top, #1a1320 0%, #0a0a0c 60%, #050507 100%)',
    minHeight: '100vh',
    color: '#E8E0D0',
    paddingTop: 'calc(var(--safe-top) + 16px)',
  }

  if (loading) return <PageLoader label="LOADING" />

  return (
    <div className="page-scroll" style={pageStyle}>
      {/* ── Header row ── */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:translate-y-[1px] transition-transform relative"
          style={{ width: 32, height: 32, ...OBSIDIAN_BTN }}>
          <Rivets inset={2} />
          <ChevronLeft size={16} style={{ color: PINK_HI }} />
        </button>
        <ObsidianChip accentRgb="255,107,157">
          <IconHeartDuo size={14} />
          <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>US</span>
        </ObsidianChip>
      </div>
      <p className="text-sm mb-5" style={{ color: '#9A8C70' }}>You &amp; your partner</p>

      {/* ── Anniversary ── */}
      {anniversary && (
        <div className="mb-4 p-5 text-center relative overflow-hidden" style={OBSIDIAN_FACE}>
          <Rivets inset={4} />
          {/* Subtle hairline gold accent across the top */}
          <div aria-hidden style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
            background: `linear-gradient(90deg, transparent, ${accentA(0.4)}, transparent)`,
          }} />
          {/* Soft starfield */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: `radial-gradient(circle, ${PINK} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />

          <div className="relative">
            <div className="flex items-center justify-center gap-2 mb-2">
              <IconHeart size={10} />
              <p className="font-pixel" style={{ fontSize: 6, letterSpacing: 2.5, color: PINK_HI, textShadow: `0 0 3px ${accentA(0.4)}` }}>TOGETHER FOR</p>
              <IconHeart size={10} />
            </div>
            <p className="font-pixel" style={{ fontSize: 36, lineHeight: 1, ...pinkText, marginBottom: 4 }}>{anniversary.days}</p>
            <p className="font-pixel mb-3" style={{ fontSize: 8, letterSpacing: 3, color: PINK_LO }}>DAYS</p>
            {anniversary.milestone && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-2 relative" style={OBSIDIAN_BTN}>
                <Rivets inset={2} />
                <IconStar size={12} />
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, ...pinkText }}>{anniversary.milestone}</span>
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

      {/* ── Send Eren nudge ── */}
      {partner && (
        <button
          onClick={() => { playSound('ui_modal_open'); setShowSend(true) }}
          className="w-full mb-4 px-4 py-3 flex items-center gap-3 relative active:translate-y-[1px] transition-transform"
          style={{
            ...OBSIDIAN_FACE,
            border: '1.5px solid rgba(255,107,157,0.45)',
            boxShadow: `0 0 14px rgba(255,107,157,0.25), ${OBSIDIAN_FACE.boxShadow}`,
          }}
        >
          <Rivets inset={4} />
          <div className="flex-shrink-0" style={{ filter: 'drop-shadow(0 0 5px rgba(255,107,157,0.5))' }}>
            <IconHeartDuo size={22} />
          </div>
          <div className="flex-1 text-left">
            <span className="font-pixel block" style={{ fontSize: 8, letterSpacing: 1, ...pinkText }}>
              SEND EREN TO {partner.name.split(' ')[0].toUpperCase()}
            </span>
            <span className="text-xs" style={{ color: '#9A8C70' }}>
              A hug, a kiss, or a little hello
            </span>
          </div>
          <span className="font-pixel flex-shrink-0" style={{ fontSize: 11, color: PINK, textShadow: `0 0 6px ${accentA(0.6)}` }}>▶</span>
        </button>
      )}

      {/* ── Partner mood today ── */}
      {partner && (() => {
        const first = partner.name.split(' ')[0]
        const theme = partnerMood ? MOOD_THEME[partnerMood] : null
        const isLow = partnerMood ? LOW_MOODS.includes(partnerMood) : false
        return (
          <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
            <Rivets inset={4} />
            <div className="flex items-center gap-2 mb-3">
              <ObsidianChip accentRgb="255,107,157">
                <IconHeart size={12} />
                <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>
                  {first.toUpperCase()} TODAY
                </span>
              </ObsidianChip>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-shrink-0" style={{
                width: 64, height: 64,
                filter: theme ? `drop-shadow(0 0 6px ${theme.glow})` : 'grayscale(0.5) brightness(0.7)',
              }}>
                <SketchEren state={partnerMood ? MOOD_SKETCH[partnerMood] : 'idle'} size={64} transparent noSpeech />
              </div>
              <div className="flex-1 min-w-0">
                {partnerMood ? (
                  <p className="font-pixel" style={{ fontSize: 9, lineHeight: 1.5, color: theme!.main, textShadow: `0 0 6px ${theme!.glow}` }}>
                    {first} is feeling {MOOD_CONFIGS[partnerMood].label.toLowerCase()} today
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: '#9A8C70' }}>
                    {first} hasn&apos;t checked in yet today
                  </p>
                )}
              </div>
            </div>

            {/* 7-day strip */}
            <div className="flex justify-between mt-4">
              {partnerMoodWeek.map(d => {
                const dt = MOOD_THEME[d.mood ?? 'good']
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: d.mood ? `linear-gradient(180deg, ${dt.main}, ${dt.dark})` : '#1a1a22',
                      border: `1px solid ${d.mood ? dt.dark : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: d.mood ? `0 0 5px ${dt.glow}` : 'inset 0 1px 2px rgba(0,0,0,0.6)',
                    }} />
                    <span className="font-pixel" style={{ fontSize: 6, color: '#7A6A50' }}>
                      {format(new Date(d.date + 'T12:00:00'), 'EEEEE')}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Response CTA */}
            {partnerMood && (
              <button
                onClick={() => { playSound('ui_modal_open'); setShowSend(true) }}
                className="w-full mt-4 px-4 py-2.5 flex items-center justify-center gap-2 relative active:translate-y-[1px] transition-transform"
                style={{
                  ...OBSIDIAN_BTN,
                  border: isLow ? '1.5px solid rgba(255,107,157,0.5)' : `1px solid ${accentA(0.3)}`,
                  boxShadow: isLow ? `0 0 12px rgba(255,107,157,0.25), ${OBSIDIAN_BTN.boxShadow}` : OBSIDIAN_BTN.boxShadow as string,
                }}
              >
                <IconHeart size={12} />
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, ...pinkText }}>
                  {isLow ? `SEND ${first.toUpperCase()} SOME LOVE` : 'SEND A LITTLE LOVE'}
                </span>
                <span className="font-pixel" style={{ fontSize: 9, color: PINK }}>▶</span>
              </button>
            )}
          </div>
        )
      })()}

      {/* ── Love Meter (Care Battle) ── */}
      {loveMeter && partner && (() => {
        const u1Leading = loveMeter.leader === loveMeter.user1.id
        const u2Leading = loveMeter.leader === loveMeter.user2.id
        const diff = Math.abs(loveMeter.user1.score - loveMeter.user2.score)
        const leaderName = u1Leading
          ? (loveMeter.user1.id === user?.id ? 'YOU' : loveMeter.user1.name.split(' ')[0].toUpperCase())
          : u2Leading
            ? (loveMeter.user2.id === user?.id ? 'YOU' : loveMeter.user2.name.split(' ')[0].toUpperCase())
            : null
        return (
        <div className="mb-4 p-4 relative overflow-hidden" style={OBSIDIAN_FACE}>
          <Rivets inset={4} />
          {/* Battle-y diagonal scanlines */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: `repeating-linear-gradient(45deg, ${PINK} 0, ${PINK} 2px, transparent 2px, transparent 8px)` }} />

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <ObsidianChip accentRgb="245,200,66">
                <IconSwords size={14} />
                <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>CARE BATTLE</span>
              </ObsidianChip>
              <span className="font-pixel" style={{ fontSize: 6, color: '#9A8A60', letterSpacing: 1 }}>
                THIS WEEK · RESETS IN {reset.days}D {reset.hours}H
              </span>
            </div>

            {/* VS display */}
            <div className="flex items-center gap-3 mb-3">
              {/* User 1 */}
              <div className="flex-1 text-center">
                <p className="font-pixel mb-1" style={{ fontSize: 7, letterSpacing: 1.5, color: PINK_HI, opacity: 0.85 }}>
                  {loveMeter.user1.id === user?.id ? 'YOU' : loveMeter.user1.name.split(' ')[0].toUpperCase()}
                </p>
                <p
                  key={`u1-${pulse1}`}
                  className="font-pixel"
                  style={{
                    fontSize: 26, lineHeight: 1,
                    animation: 'cbPopScore 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
                    ...(u1Leading ? pinkText : { color: '#5A5A5A' }),
                  }}>
                  {loveMeter.user1.score}
                </p>
                {u1Leading && (
                  <div className="flex justify-center mt-1" style={{ animation: 'cbCrownBob 1.8s ease-in-out infinite' }}>
                    <IconCrown size={18} />
                  </div>
                )}
              </div>

              {/* VS orb */}
              <div className="flex items-center justify-center relative" style={{
                width: 40, height: 40, ...OBSIDIAN_ORB,
              }}>
                <span className="font-pixel" style={{ fontSize: 9, ...pinkText }}>VS</span>
              </div>

              {/* User 2 */}
              <div className="flex-1 text-center">
                <p className="font-pixel mb-1" style={{ fontSize: 7, letterSpacing: 1.5, color: PINK_HI, opacity: 0.85 }}>
                  {loveMeter.user2.id === user?.id ? 'YOU' : loveMeter.user2.name.split(' ')[0].toUpperCase()}
                </p>
                <p
                  key={`u2-${pulse2}`}
                  className="font-pixel"
                  style={{
                    fontSize: 26, lineHeight: 1,
                    animation: 'cbPopScore 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
                    ...(u2Leading ? pinkText : { color: '#5A5A5A' }),
                  }}>
                  {loveMeter.user2.score}
                </p>
                {u2Leading && (
                  <div className="flex justify-center mt-1" style={{ animation: 'cbCrownBob 1.8s ease-in-out infinite' }}>
                    <IconCrown size={18} />
                  </div>
                )}
              </div>
            </div>

            {/* Competition bar — taller, animated flow on each side,
                glowing split-line at the boundary, pulse on the
                leader's section. */}
            <div className="relative h-6 overflow-hidden" style={{
              border: `2px solid ${accentA(0.6)}`,
              background: 'linear-gradient(180deg, #000 0%, #050507 100%)',
              boxShadow: `inset 0 2px 4px rgba(0,0,0,0.95), 0 0 12px ${accentA(0.4)}`,
            }}>
              {/* User 1 section */}
              <div className="absolute left-0 top-0 h-full"
                style={{
                  width: `${loveMeter.user1.pct}%`,
                  background: 'linear-gradient(180deg, #FF8DB8 0%, #FF4D87 50%, #C8265F 100%)',
                  boxShadow: u1Leading
                    ? 'inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.4), 0 0 12px rgba(255,109,157,0.7)'
                    : 'inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.4)',
                  transition: 'width 700ms cubic-bezier(0.34,1.4,0.55,1)',
                  animation: u1Leading ? 'cbBarPulseL 1.6s ease-in-out infinite' : undefined,
                }}>
                {/* Flowing diagonal streaks moving toward the split */}
                <div className="absolute inset-0" style={{
                  backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 5px, rgba(255,255,255,0.22) 5px 7px)',
                  backgroundSize: '11px 11px',
                  animation: 'cbFlowR 1.1s linear infinite',
                  mixBlendMode: 'screen',
                }} />
              </div>
              {/* User 2 section */}
              <div className="absolute top-0 h-full"
                style={{
                  left: `${loveMeter.user1.pct}%`,
                  width: `${loveMeter.user2.pct}%`,
                  background: 'linear-gradient(180deg, #C9B4FF 0%, #8A6CFF 50%, #5C2FE0 100%)',
                  boxShadow: u2Leading
                    ? 'inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.4), 0 0 12px rgba(167,139,250,0.7)'
                    : 'inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.4)',
                  transition: 'left 700ms cubic-bezier(0.34,1.4,0.55,1), width 700ms cubic-bezier(0.34,1.4,0.55,1)',
                  animation: u2Leading ? 'cbBarPulseR 1.6s ease-in-out infinite' : undefined,
                }}>
                {/* Streaks flow the other way so the two halves visibly
                    press against each other at the split. */}
                <div className="absolute inset-0" style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(255,255,255,0.22) 5px 7px)',
                  backgroundSize: '11px 11px',
                  animation: 'cbFlowL 1.1s linear infinite',
                  mixBlendMode: 'screen',
                }} />
              </div>
              {/* Glowing split-line */}
              <div className="absolute top-0 bottom-0" style={{
                left: `${loveMeter.user1.pct}%`,
                width: 2,
                background: '#fff',
                boxShadow: '0 0 6px #fff, 0 0 14px rgba(255,255,255,0.7)',
                transform: 'translateX(-1px)',
                transition: 'left 700ms cubic-bezier(0.34,1.4,0.55,1)',
              }} />
            </div>

            <div className="flex justify-between mt-1.5">
              <span className="font-pixel" style={{
                fontSize: 7, color: '#FF6B9D',
                textShadow: u1Leading ? '0 0 6px rgba(255,107,157,0.7)' : 'none',
              }}>{loveMeter.user1.pct}%</span>
              <span className="font-pixel" style={{
                fontSize: 7, color: '#A78BFA',
                textShadow: u2Leading ? '0 0 6px rgba(167,139,250,0.7)' : 'none',
              }}>{loveMeter.user2.pct}%</span>
            </div>

            {/* Verdict line */}
            {leaderName && diff > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-3 px-3 py-1.5 relative"
                style={{
                  ...OBSIDIAN_BTN,
                  width: 'fit-content',
                  margin: '12px auto 0',
                }}>
                <IconCrown size={11} />
                <span className="font-pixel" style={{
                  fontSize: 7, letterSpacing: 1.5, ...pinkText,
                }}>
                  {leaderName} LEADS BY {diff}
                </span>
              </div>
            )}

            {!loveMeter.leader && (
              <p className="text-center font-pixel mt-3" style={{ fontSize: 7, color: PINK_LO, letterSpacing: 1.5 }}>
                IT&apos;S A TIE!
              </p>
            )}
          </div>

          <style jsx>{`
            @keyframes cbFlowR {
              from { background-position: 0 0; }
              to   { background-position: 11px 0; }
            }
            @keyframes cbFlowL {
              from { background-position: 0 0; }
              to   { background-position: -11px 0; }
            }
            @keyframes cbBarPulseL {
              0%, 100% { filter: brightness(1); }
              50%      { filter: brightness(1.18); }
            }
            @keyframes cbBarPulseR {
              0%, 100% { filter: brightness(1); }
              50%      { filter: brightness(1.18); }
            }
            @keyframes cbPopScore {
              0%   { transform: scale(0.6); opacity: 0.4; }
              60%  { transform: scale(1.18); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes cbCrownBob {
              0%, 100% { transform: translateY(0)    rotate(-2deg); }
              50%      { transform: translateY(-2px) rotate(2deg); }
            }
          `}</style>
        </div>
        )
      })()}

      {/* ── Lifetime Battle Record (W-L-T) ── */}
      {lifetimeWLT && partner && (lifetimeWLT.days > 0) && (() => {
        const first = partner.name.split(' ')[0]
        const youLead = lifetimeWLT.myWins > lifetimeWLT.partnerWins
        const partnerLeads = lifetimeWLT.partnerWins > lifetimeWLT.myWins
        return (
          <div className="mb-4 p-4 relative overflow-hidden" style={OBSIDIAN_FACE}>
            <Rivets inset={4} />
            <div className="flex items-center justify-between mb-3">
              <ObsidianChip accentRgb="245,200,66">
                <IconTrophy size={14} />
                <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>BATTLE RECORD</span>
              </ObsidianChip>
              <span className="font-pixel" style={{ fontSize: 6, color: '#9A8A60', letterSpacing: 1 }}>
                LAST {lifetimeWLT.days} {lifetimeWLT.days === 1 ? 'DAY' : 'DAYS'}
              </span>
            </div>

            {/* Triple-column W-L-T */}
            <div className="flex items-stretch gap-2">
              {/* My wins */}
              <div className="flex-1 text-center px-2 py-2 relative" style={{
                ...OBSIDIAN_BTN,
                border: youLead ? '1.5px solid rgba(255,107,157,0.5)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: youLead
                  ? `0 0 10px rgba(255,107,157,0.25), ${OBSIDIAN_BTN.boxShadow}`
                  : OBSIDIAN_BTN.boxShadow as string,
              }}>
                <p className="font-pixel" style={{ fontSize: 6, color: PINK_HI, letterSpacing: 1.5, marginBottom: 4 }}>YOU</p>
                <p className="font-pixel" style={{
                  fontSize: 22, lineHeight: 1, ...pinkText,
                  textShadow: youLead ? `0 0 8px ${accentA(0.6)}` : 'none',
                }}>{lifetimeWLT.myWins}</p>
                <p className="font-pixel" style={{ fontSize: 5, color: '#7A6A75', letterSpacing: 1, marginTop: 3 }}>WINS</p>
                {lifetimeWLT.myStreak >= 2 && (
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <IconFire size={9} />
                    <span className="font-pixel" style={{ fontSize: 6, color: '#FF6B00', letterSpacing: 1 }}>
                      {lifetimeWLT.myStreak}
                    </span>
                  </div>
                )}
              </div>

              {/* Ties */}
              <div className="text-center px-2 py-2" style={{ ...OBSIDIAN_BTN, minWidth: 56 }}>
                <p className="font-pixel" style={{ fontSize: 6, color: '#9A8A60', letterSpacing: 1.5, marginBottom: 4 }}>TIES</p>
                <p className="font-pixel" style={{ fontSize: 22, lineHeight: 1, color: '#7A6A75' }}>{lifetimeWLT.ties}</p>
                <p className="font-pixel" style={{ fontSize: 5, color: '#5A4A55', letterSpacing: 1, marginTop: 3 }}>EVEN</p>
              </div>

              {/* Partner wins */}
              <div className="flex-1 text-center px-2 py-2 relative" style={{
                ...OBSIDIAN_BTN,
                border: partnerLeads ? '1.5px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: partnerLeads
                  ? '0 0 10px rgba(167,139,250,0.25), ' + (OBSIDIAN_BTN.boxShadow as string)
                  : OBSIDIAN_BTN.boxShadow as string,
              }}>
                <p className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', letterSpacing: 1.5, marginBottom: 4 }}>
                  {first.toUpperCase()}
                </p>
                <p className="font-pixel" style={{
                  fontSize: 22, lineHeight: 1, color: '#D8B4FE',
                  textShadow: partnerLeads ? '0 0 8px rgba(167,139,250,0.5)' : 'none',
                }}>{lifetimeWLT.partnerWins}</p>
                <p className="font-pixel" style={{ fontSize: 5, color: '#7A6A75', letterSpacing: 1, marginTop: 3 }}>WINS</p>
                {lifetimeWLT.partnerStreak >= 2 && (
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <IconFire size={9} />
                    <span className="font-pixel" style={{ fontSize: 6, color: '#FF6B00', letterSpacing: 1 }}>
                      {lifetimeWLT.partnerStreak}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Verdict line — only when one side actually leads */}
            {(youLead || partnerLeads) && (
              <div className="flex items-center justify-center gap-1.5 mt-3 px-3 py-1.5 relative" style={{
                ...OBSIDIAN_BTN, width: 'fit-content', margin: '12px auto 0',
              }}>
                <IconCrown size={11} />
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, ...pinkText }}>
                  {youLead ? 'YOU' : first.toUpperCase()} LEADS BY {Math.abs(lifetimeWLT.myWins - lifetimeWLT.partnerWins)}
                </span>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Dual streak: torch-bearer marker on the longer current streak ── */}
      {partner && ((myStreak.current ?? 0) > 0 || (partnerStreak?.current ?? 0) > 0) && (() => {
        const first = partner.name.split(' ')[0]
        const mine = myStreak.current ?? 0
        const theirs = partnerStreak?.current ?? 0
        const myBest = myStreak.best ?? 0
        const theirBest = partnerStreak?.best ?? 0
        const iLead = mine > theirs
        const theyLead = theirs > mine
        return (
          <div className="mb-4 p-4 relative overflow-hidden" style={OBSIDIAN_FACE}>
            <Rivets inset={4} />
            <div className="flex items-center gap-2 mb-3">
              <ObsidianChip accentRgb="255,107,0">
                <IconFire size={14} />
                <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>CARE STREAKS</span>
              </ObsidianChip>
            </div>

            <div className="flex items-stretch gap-3">
              {/* Me */}
              <div className="flex-1 text-center px-2 py-2 relative" style={{
                ...OBSIDIAN_BTN,
                border: iLead ? '1.5px solid rgba(255,107,0,0.45)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: iLead
                  ? '0 0 10px rgba(255,107,0,0.25), ' + (OBSIDIAN_BTN.boxShadow as string)
                  : OBSIDIAN_BTN.boxShadow as string,
              }}>
                {iLead && (
                  <div className="absolute" style={{ top: -10, left: '50%', transform: 'translateX(-50%)' }}>
                    <IconCrown size={14} />
                  </div>
                )}
                <p className="font-pixel" style={{ fontSize: 6, color: PINK_HI, letterSpacing: 1.5, marginBottom: 6 }}>YOU</p>
                <div className="flex items-center justify-center gap-1.5">
                  <IconFire size={16} />
                  <span className="font-pixel" style={{
                    fontSize: 22, lineHeight: 1, color: '#FFB347',
                    textShadow: iLead ? '0 0 8px rgba(255,107,0,0.6)' : 'none',
                  }}>{mine}</span>
                </div>
                <p className="font-pixel" style={{ fontSize: 5, color: '#7A6A75', letterSpacing: 1, marginTop: 5 }}>
                  BEST {myBest}
                </p>
              </div>

              {/* Partner */}
              <div className="flex-1 text-center px-2 py-2 relative" style={{
                ...OBSIDIAN_BTN,
                border: theyLead ? '1.5px solid rgba(255,107,0,0.45)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: theyLead
                  ? '0 0 10px rgba(255,107,0,0.25), ' + (OBSIDIAN_BTN.boxShadow as string)
                  : OBSIDIAN_BTN.boxShadow as string,
              }}>
                {theyLead && (
                  <div className="absolute" style={{ top: -10, left: '50%', transform: 'translateX(-50%)' }}>
                    <IconCrown size={14} />
                  </div>
                )}
                <p className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', letterSpacing: 1.5, marginBottom: 6 }}>
                  {first.toUpperCase()}
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <IconFire size={16} />
                  <span className="font-pixel" style={{
                    fontSize: 22, lineHeight: 1, color: '#FFB347',
                    textShadow: theyLead ? '0 0 8px rgba(255,107,0,0.6)' : 'none',
                  }}>{theirs}</span>
                </div>
                <p className="font-pixel" style={{ fontSize: 5, color: '#7A6A75', letterSpacing: 1, marginTop: 5 }}>
                  BEST {theirBest}
                </p>
              </div>
            </div>

            {(iLead || theyLead) && (
              <p className="text-center font-pixel mt-3" style={{ fontSize: 6, color: '#9A8A60', letterSpacing: 1 }}>
                TORCH-BEARER: {iLead ? 'YOU' : first.toUpperCase()}
              </p>
            )}
            {mine > 0 && theirs > 0 && mine === theirs && (
              <p className="text-center font-pixel mt-3" style={{ fontSize: 6, color: '#9A8A60', letterSpacing: 1 }}>
                BOTH ON {mine} — KEEP IT UP!
              </p>
            )}
          </div>
        )
      })()}

      {/* ── Shared Journal ── */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ObsidianChip accentRgb="167,139,250">
            <IconEnvelope size={14} />
            <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>EREN&apos;S JOURNAL</span>
          </ObsidianChip>
        </div>

        {/* Compose */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative" style={{ ...OBSIDIAN_BTN, padding: 0 }}>
            <Rivets inset={3} />
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
            <Rivets inset={2} />
            <Send size={16} style={{ color: PINK_HI, filter: `drop-shadow(0 0 3px ${accentA(0.67)})` }} />
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
                    style={OBSIDIAN_ORB}>
                    <img src="/erenGood.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain', imageRendering: 'pixelated' }} />
                  </div>
                )}
                <div className="max-w-[75%] px-3 py-2 relative" style={{
                  ...OBSIDIAN_FACE,
                  // Subtle border tint difference so "me" vs partner reads at
                  // a glance — purple-bright vs cool lavender — alongside the
                  // mirrored bottom border-radius.
                  borderColor: isMe ? `${accentA(0.47)}` : '#C4B5FD55',
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

      {showSend && partner && (
        <SendErenSheet
          partnerName={partner.name}
          onSend={sendNudge}
          onClose={() => setShowSend(false)}
        />
      )}

      {/* Weekly Champion popup — fires once per ISO week per user. The
          local dismissed flag hides it instantly; the server ack call
          fires fire-and-forget so it doesn't return on next page load. */}
      {weeklyChampion && !weeklyChampion.acknowledged && !weeklyDismissed && partner && (
        <WeeklyChampionPopup
          row={weeklyChampion}
          partnerFirstName={partner.name.split(' ')[0]}
          onClaim={claimWeeklyChampion}
          onClose={() => {
            setWeeklyDismissed(true)
            void claimWeeklyChampion()
          }}
        />
      )}
    </div>
  )
}
