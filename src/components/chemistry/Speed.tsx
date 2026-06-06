'use client'

// Speed — 60-second sprint. Pulls random elements from the catalogue,
// generates a question, accepts an answer (auto-advances on tap or
// keyboard 1-4), score = correct count. Persists best score in the
// chem store (history bucket — we don't have a dedicated bests slot yet
// so it's surfaced via state via a localStorage key local to this mode).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Timer as TimerIcon, Trophy } from 'lucide-react'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { useChemistryTheme, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import { playSound } from '@/lib/sounds'
import { speedPool, makeQuestion, type Question } from '@/lib/chemistry/questions'

const DURATION = 60
const BEST_KEY = 'eren_chem_speed_best'

interface Props { onExit: () => void }

type Status = 'idle' | 'running' | 'done'

export default function Speed({ onExit }: Props) {
  const { palette } = useChemistryTheme()
  const { rateCard } = useChemistryStore()
  const [status, setStatus] = useState<Status>('idle')
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [score, setScore] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null)
  const [best, setBest] = useState(0)

  const deck = useRef<ReturnType<typeof speedPool>>([])
  const ptr = useRef(0)

  // Load best score on mount.
  useEffect(() => {
    try {
      const v = localStorage.getItem(BEST_KEY)
      if (v) setBest(parseInt(v, 10) || 0)
    } catch { /* ignore */ }
  }, [])

  function nextQuestion() {
    if (ptr.current >= deck.current.length) {
      deck.current = speedPool()
      ptr.current = 0
    }
    const el = deck.current[ptr.current++]
    setQuestion(makeQuestion(el))
  }

  function start() {
    deck.current = speedPool()
    ptr.current = 0
    setScore(0)
    setTimeLeft(DURATION)
    setStatus('running')
    nextQuestion()
  }

  function answer(opt: string) {
    if (!question || status !== 'running') return
    const correct = opt === question.answer
    rateCard(elementCardId(question.el.atomicNumber), correct)
    if (correct) {
      setScore(s => s + 1)
      setFlash('ok')
    } else {
      setFlash('no')
    }
    playSound('ui_tap')
    setTimeout(() => setFlash(null), 140)
    nextQuestion()
  }

  // Countdown timer.
  useEffect(() => {
    if (status !== 'running') return
    if (timeLeft <= 0) {
      setStatus('done')
      try {
        if (score > best) {
          localStorage.setItem(BEST_KEY, String(score))
          setBest(score)
        }
      } catch { /* ignore */ }
      return
    }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [status, timeLeft, score, best])

  // Keyboard 1–4 during running.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (status !== 'running' || !question) return
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= question.options.length) {
        e.preventDefault()
        answer(question.options[n - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, question]) // eslint-disable-line react-hooks/exhaustive-deps

  const headerRow = useMemo(() => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    }}>
      <span style={{
        padding: '4px 10px', borderRadius: 999,
        background: palette.cardMuted, color: palette.fg,
        fontSize: 11, fontWeight: 700,
      }}>
        Best · {best}
      </span>
      <span style={{
        padding: '4px 10px', borderRadius: 999,
        background: palette.cardMuted, color: palette.fg,
        fontSize: 11, fontWeight: 700,
      }}>
        Score · {score}
      </span>
      <span style={{
        fontSize: 20, fontWeight: 900,
        color: timeLeft <= 10 ? palette.red : palette.fg,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {timeLeft}s
      </span>
    </div>
  ), [palette, score, timeLeft, best])

  if (status === 'idle') {
    return (
      <Center palette={palette}>
        <Zap size={48} strokeWidth={2.2} color={palette.sunDark} />
        <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.fg }}>Speed Round</h2>
        <p style={{ fontSize: 13, color: palette.fgMuted, maxWidth: 320, textAlign: 'center' }}>
          60 seconds. Answer as many as you can. Keyboard 1–4 or tap.
        </p>
        {best > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999,
            background: palette.sunLight, color: palette.ink,
            fontSize: 12, fontWeight: 800,
          }}>
            <Trophy size={13} strokeWidth={2.4} />
            Best · {best}
          </div>
        )}
        <button onClick={start} type="button" style={primaryBtn(palette)}>
          Start
        </button>
        <button onClick={onExit} type="button" style={ghostBtn(palette)}>
          Back
        </button>
      </Center>
    )
  }

  if (status === 'done') {
    const newBest = score > 0 && score === best
    return (
      <Center palette={palette}>
        <TimerIcon size={48} strokeWidth={2.2} color={palette.grapeDark} />
        <h2 style={{ fontSize: 22, fontWeight: 900, color: palette.fg }}>Time!</h2>
        <div style={{ fontSize: 48, fontWeight: 900, color: palette.fg }}>{score}</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: palette.fgMuted,
        }}>
          {newBest && <Trophy size={13} strokeWidth={2.4} color={palette.sunDark} />}
          {newBest ? 'New personal best!' : `Best · ${best}`}
        </div>
        <button onClick={start} type="button" style={primaryBtn(palette)}>
          Play again
        </button>
        <button onClick={onExit} type="button" style={ghostBtn(palette)}>
          Back
        </button>
      </Center>
    )
  }

  return (
    <div style={{
      padding: '0 14px 22px',
      display: 'flex', flexDirection: 'column', gap: 12,
      fontFamily: CHEM_FONT,
    }}>
      {headerRow}
      <div style={{
        borderRadius: 22, padding: 22,
        background: flash === 'ok' ? palette.greenLight
                  : flash === 'no' ? palette.redLight
                  :                  palette.grapeLight,
        color: palette.ink,
        transition: 'background 120ms ease',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: palette.grapeDark }}>
          SYMBOL ↔ NAME
        </div>
        <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
          {question?.prompt}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        {question?.options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => answer(opt)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 14px',
              borderRadius: 16, border: 'none',
              background: palette.card, color: palette.fg,
              textAlign: 'left', fontFamily: CHEM_FONT,
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <span style={{
              flexShrink: 0,
              width: 26, height: 26, borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: palette.sun, color: palette.ink,
              fontSize: 13, fontWeight: 900,
            }}>{i + 1}</span>
            <span>{opt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Center({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '40px 22px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      textAlign: 'center', fontFamily: CHEM_FONT, color: palette.fg,
    }}>
      {children}
    </div>
  )
}

function primaryBtn(palette: Palette): React.CSSProperties {
  return {
    marginTop: 6,
    padding: '10px 22px', borderRadius: 999,
    border: 'none', background: palette.grapeDark, color: '#FFF',
    fontFamily: CHEM_FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer',
  }
}
function ghostBtn(palette: Palette): React.CSSProperties {
  return {
    padding: '8px 18px', borderRadius: 999,
    border: `2px solid ${palette.fgMuted}`,
    background: 'transparent', color: palette.fg,
    fontFamily: CHEM_FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  }
}
