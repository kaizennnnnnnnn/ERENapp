'use client'

// ─── JellyPrize ─────────────────────────────────────────────────────────────
// The card both Parlour games end on. One component, because the two games
// differ in how you score and in nothing about how you're paid.
//
// Order matters here and is deliberate: the JELLY lands first and biggest,
// because it's the thing you were playing for; the score and the duel line sit
// under it as context. A results screen that leads with a number and buries the
// prize teaches the player that the number is the point.
//
// A round can pay out two jellies — the round prize and the duel bonus for
// taking today's lead — so `wins` is a list and the card stacks them.
//
// The meter under the prize is TODAY'S TRAY, not a permanent collection. It
// resets every night, and filling it is what mints a Super Jelly — so when a
// win completes it, that is the headline of the card, above the score.

import { useEffect, useState } from 'react'
import { IconSparkles, IconJelly } from '@/components/PixelIcons'
import SuperJelly from './SuperJelly'
import type { JellyWin } from '@/hooks/useJellies'
import { playSound } from '@/lib/sounds'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const INK = '#2C4A38'
const CREAM = '#FFFDF6'

export interface DuelLine {
  theirName: string | null
  theirsToday: number
  tookLead: boolean
}

interface Props {
  score: number
  best: number
  isBest: boolean
  /** How the score is spoken about — "240 PTS" vs "240 M". */
  unit: string
  /** Score needed to earn a jelly at all; shown when the round fell short. */
  threshold: number
  duel: DuelLine | null
  wins: JellyWin[]
  /** The round DID clear the threshold, but the jelly could not be saved. */
  awardFailed: boolean
  /** Slots filled on today's tray, after this round. */
  trayCount: number
  traySize: number
  onPlayAgain: () => void
  onExit: () => void
}

export default function JellyPrize({
  score, best, isBest, unit, threshold, duel, wins, awardFailed, trayCount, traySize, onPlayAgain, onExit,
}: Props) {
  const reduced = useReducedMotion()
  const mintedSuper = wins.some(w => w.mintedSuper)
  // Reveal the jellies one at a time so a double payout reads as two events.
  const [shown, setShown] = useState(reduced ? wins.length : 0)

  useEffect(() => {
    if (reduced || wins.length === 0) return
    const timers = wins.map((_, i) =>
      setTimeout(() => { setShown(i + 1); playSound('gift_open') }, 260 + i * 620))
    return () => timers.forEach(clearTimeout)
  }, [reduced, wins.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 flex items-center justify-center px-5" role="dialog" aria-modal="true"
      style={{ zIndex: 80, background: 'rgba(20,40,30,0.62)', backdropFilter: 'blur(3px)' }}>
      <div className="relative w-full flex flex-col items-center" style={{
        maxWidth: 320, padding: 16, borderRadius: 16,
        background: 'linear-gradient(180deg, #FFFDF6 0%, #EAFBF1 100%)',
        border: `3px solid ${INK}`, boxShadow: `0 6px 0 ${INK}, 0 18px 40px rgba(0,0,0,0.4)`,
      }}>
        {/* ── The prize ── */}
        {wins.length > 0 ? (
          <div className="w-full flex flex-col items-center gap-2 mb-3">
            {wins.slice(0, shown).map((w, i) => (
              <div key={w.jelly.id + i} className="w-full flex items-center gap-3 px-3 py-2.5" style={{
                borderRadius: 12,
                background: `linear-gradient(180deg, ${w.jelly.colour}22, ${w.jelly.colour}0D)`,
                border: `2.5px solid ${w.jelly.colour}`,
                animation: reduced ? undefined : 'jellyPrizeIn 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
              }}>
                <img src={w.jelly.art} alt="" draggable={false} style={{
                  width: 54, height: 54, objectFit: 'contain', imageRendering: 'auto', flexShrink: 0,
                  animation: reduced ? undefined : 'parlourJiggle 2.2s ease-in-out infinite',
                }} />
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="font-pixel" style={{ fontSize: 8, color: INK }}>{w.jelly.name.toUpperCase()}</span>
                    {w.isNew && (
                      <span className="font-pixel px-1 py-0.5" style={{
                        fontSize: 5, color: '#fff', background: '#FF1D5E', borderRadius: 4,
                      }}>NEW</span>
                    )}
                  </div>
                  <p style={{ fontSize: 9.5, lineHeight: 1.4, color: '#4A6B58' }}>{w.effect.label}</p>
                  {i === 1 && (
                    <p className="font-pixel" style={{ fontSize: 5, color: '#2FA765', marginTop: 3 }}>
                      DUEL BONUS
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-1.5 mb-3 px-3 py-3" style={{
            borderRadius: 12, background: 'rgba(44,74,56,0.05)', border: '2px dashed rgba(44,74,56,0.28)',
          }}>
            <IconJelly size={20} />
            {/* Two very different failures. Telling a player who scored 300 that
                they need 120 is worse than telling them nothing. */}
            <p className="text-center" style={{ fontSize: 10, lineHeight: 1.5, color: '#4A6B58' }}>
              {awardFailed
                ? <>That jelly couldn&apos;t be saved, so the tray didn&apos;t move. Nothing else was lost — check the Parlour.</>
                : <>No jelly this time — reach <strong style={{ color: INK }}>{threshold} {unit}</strong> to win one.</>}
            </p>
          </div>
        )}

        {/* ── Today's tray ── */}
        <div className="w-full flex items-center gap-1.5 mb-3">
          <span className="font-pixel" style={{ fontSize: 5.5, color: '#6E9781' }}>TRAY</span>
          <div className="flex-1 flex gap-1">
            {Array.from({ length: traySize }).map((_, i) => (
              <span key={i} style={{
                flex: 1, height: 9, borderRadius: 3,
                background: i < trayCount ? 'linear-gradient(180deg, #6FE0A0, #2FA765)' : 'rgba(44,74,56,0.12)',
                border: `2px solid ${i < trayCount ? INK : 'transparent'}`,
                transition: 'background 300ms ease-out',
              }} />
            ))}
          </div>
          <span className="font-pixel" style={{ fontSize: 6, color: INK }}>{trayCount}/{traySize}</span>
        </div>

        {mintedSuper && (
          <div className="w-full flex items-center gap-2.5 mb-3 px-3 py-2.5" style={{
            borderRadius: 12, background: 'linear-gradient(180deg, #FFE9A8, #F5C842)',
            border: `2.5px solid ${INK}`,
            animation: reduced ? undefined : 'jellyPrizeIn 460ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}>
            <SuperJelly size={38} />
            <p style={{ fontSize: 10, lineHeight: 1.4, color: '#5A3208' }}>
              <strong>Tray complete!</strong> A Super Jelly is waiting on the stand — feed it to him.
            </p>
          </div>
        )}

        {/* ── Score + duel ── */}
        <div className="w-full flex items-center justify-between mb-1">
          <span className="font-pixel" style={{ fontSize: 6, color: '#6E9781' }}>YOUR RUN</span>
          <span className="font-pixel" style={{ fontSize: 13, color: INK }}>{score} <span style={{ fontSize: 7 }}>{unit}</span></span>
        </div>
        <div className="w-full flex items-center justify-between mb-3">
          <span className="font-pixel" style={{ fontSize: 6, color: '#6E9781' }}>
            {isBest ? 'NEW PERSONAL BEST' : 'BEST'}
          </span>
          <span className="inline-flex items-center gap-1">
            {isBest && <IconSparkles size={11} />}
            <span className="font-pixel" style={{ fontSize: 8, color: isBest ? '#E14C7C' : '#4A6B58' }}>{best}</span>
          </span>
        </div>

        {duel && duel.theirName && duel.theirsToday > 0 && (
          <div className="w-full mb-3 px-2.5 py-2" style={{
            borderRadius: 10,
            background: duel.tookLead ? 'rgba(47,167,101,0.14)' : 'rgba(196,69,63,0.10)',
            border: `2px solid ${duel.tookLead ? '#2FA765' : 'rgba(196,69,63,0.4)'}`,
          }}>
            <p className="text-center" style={{ fontSize: 9.5, lineHeight: 1.45, color: INK }}>
              {duel.tookLead
                ? <>You&apos;re ahead of <strong>{duel.theirName}</strong> today.</>
                : <><strong>{duel.theirName}</strong> leads today with {duel.theirsToday}. Beat it for a bonus jelly.</>}
            </p>
          </div>
        )}

        {/* ── Buttons ── */}
        <button onClick={() => { playSound('ui_select'); onPlayAgain() }}
          className="w-full py-3 mb-2 active:translate-y-[1px] transition-transform"
          style={{
            borderRadius: 12, background: 'linear-gradient(180deg, #4FD68A, #2FA765)',
            border: `3px solid ${INK}`, boxShadow: `0 4px 0 ${INK}`,
          }}>
          <span className="font-pixel" style={{ fontSize: 9, color: CREAM, letterSpacing: 0.5 }}>PLAY AGAIN</span>
        </button>
        <button onClick={() => { playSound('ui_back'); onExit() }}
          className="w-full py-2.5 active:translate-y-[1px] transition-transform"
          style={{ borderRadius: 12, background: 'rgba(44,74,56,0.07)', border: '2px solid rgba(44,74,56,0.25)' }}>
          <span className="font-pixel" style={{ fontSize: 8, color: '#4A6B58', letterSpacing: 0.5 }}>BACK TO PARLOUR</span>
        </button>
      </div>
    </div>
  )
}
