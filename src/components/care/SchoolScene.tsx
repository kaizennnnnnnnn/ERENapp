'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, X, Heart } from 'lucide-react'
import {
  SERBIAN_COURSE, SERBIAN_UNITS, ORDERED_LESSON_IDS,
  buildExercises, getLessonById,
  type Lesson, type Exercise, type Unit,
} from '@/lib/serbianCourse'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'
import { IconCrown, IconStar, IconBook } from '@/components/PixelIcons'

interface Props { onClose: () => void }

const HEARTS_MAX = 5
const XP_PER_LESSON = 10  // base XP awarded on lesson complete

const PROGRESS_KEY = (uid: string) => `eren_serbian_progress_${uid}`

interface SerbianProgress {
  completed: number[]      // lesson ids completed at least once
  perfect: number[]        // lesson ids completed with no hearts lost (used for crown UI)
  totalXp: number
}
const EMPTY_PROGRESS: SerbianProgress = { completed: [], perfect: [], totalXp: 0 }

// ═══════════════════════════════════════════════════════════════════════════
// Lightweight Web Audio tone helper (correct/wrong/level-up)
// ═══════════════════════════════════════════════════════════════════════════
let _ac: AudioContext | null = null
function getAC(): AudioContext | null {
  if (typeof window === 'undefined') return null
  type WebkitAW = Window & { webkitAudioContext?: typeof AudioContext }
  if (!_ac) _ac = new (window.AudioContext || (window as unknown as WebkitAW).webkitAudioContext!)()
  if (_ac.state === 'suspended') void _ac.resume()
  return _ac
}
function tone(freq: number, dur = 0.18, type: OscillatorType = 'triangle', vol = 0.16) {
  const ac = getAC(); if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(gain).connect(ac.destination)
  gain.gain.setValueAtTime(0.0001, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur)
  osc.start()
  osc.stop(ac.currentTime + dur + 0.05)
}
function playCorrect() { tone(880, 0.10); setTimeout(() => tone(1320, 0.16), 80) }
function playWrong()   { tone(220, 0.30, 'sawtooth', 0.12) }
function playFanfare() {
  ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.18), i * 90))
}

// ═══════════════════════════════════════════════════════════════════════════
export default function SchoolScene({ onClose }: Props) {
  const { user } = useAuth()
  const { addCoins, completeTask } = useTasks()

  const [phase, setPhase]               = useState<'map' | 'lesson' | 'complete'>('map')
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [progress, setProgress]         = useState<SerbianProgress>(EMPTY_PROGRESS)
  const [lastXp, setLastXp]             = useState(0)

  // Load progress (per user, localStorage)
  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(PROGRESS_KEY(user.id))
      if (raw) setProgress(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [user?.id])

  function saveProgress(next: SerbianProgress) {
    setProgress(next)
    if (user?.id) {
      try { localStorage.setItem(PROGRESS_KEY(user.id), JSON.stringify(next)) } catch { /* ignore */ }
    }
  }

  function startLesson(l: Lesson) {
    setActiveLesson(l)
    setPhase('lesson')
  }

  function exitLesson() {
    setActiveLesson(null)
    setPhase('map')
  }

  function finishLesson(perfect: boolean) {
    if (!activeLesson) return
    const id = activeLesson.id
    const earnedXp = perfect ? XP_PER_LESSON + 5 : XP_PER_LESSON
    setLastXp(earnedXp)
    const next: SerbianProgress = {
      completed: progress.completed.includes(id) ? progress.completed : [...progress.completed, id],
      perfect: perfect && !progress.perfect.includes(id) ? [...progress.perfect, id] : progress.perfect,
      totalXp: progress.totalXp + earnedXp,
    }
    saveProgress(next)
    addCoins(perfect ? 12 : 6)
    // Serbian lessons count as the daily play task — they're enriching activity.
    completeTask('daily_play')
    setPhase('complete')
    playFanfare()
  }

  function backToMap() {
    setActiveLesson(null)
    setPhase('map')
  }

  if (phase === 'lesson' && activeLesson) {
    return <LessonPlayer lesson={activeLesson} onExit={exitLesson} onFinish={finishLesson} />
  }

  if (phase === 'complete' && activeLesson) {
    return (
      <CompleteScreen
        lesson={activeLesson}
        xp={lastXp}
        onContinue={backToMap}
      />
    )
  }

  return (
    <CourseMap
      progress={progress}
      onLessonTap={startLesson}
      onClose={onClose}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSE MAP — vertical scroll of units, each with a zigzag of lesson nodes
// ═══════════════════════════════════════════════════════════════════════════
function CourseMap({ progress, onLessonTap, onClose }: {
  progress: SerbianProgress
  onLessonTap: (l: Lesson) => void
  onClose: () => void
}) {
  // A lesson is unlocked if it's the first one OR the previous (in order) is completed.
  function isUnlocked(lessonId: number): boolean {
    const idx = ORDERED_LESSON_IDS.indexOf(lessonId)
    if (idx <= 0) return true
    const prev = ORDERED_LESSON_IDS[idx - 1]
    return progress.completed.includes(prev)
  }

  const totalCompleted = progress.completed.length
  const totalLessons = ORDERED_LESSON_IDS.length

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{
      background: 'linear-gradient(180deg, #FFE9D6 0%, #FFC9A8 60%, #FFB088 100%)',
    }}>
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0" style={{
        background: 'rgba(120,53,15,0.18)',
        borderBottom: '2px solid rgba(154,52,18,0.35)',
      }}>
        <button onClick={() => { playSound('ui_back'); onClose() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.85)', borderRadius: 6, border: '2px solid #B45309', boxShadow: '0 2px 0 #92400E' }}>
          <ChevronLeft size={16} className="text-amber-800" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <IconBook size={14} />
          <span className="font-pixel text-amber-900 px-2.5 py-1.5"
            style={{ background: 'rgba(255,255,255,0.92)', border: '2px solid #B45309', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 #92400E' }}>
            SRPSKI
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.45)', border: '2px solid #FBBF24', borderRadius: 4, fontSize: 7, color: '#FDE68A', boxShadow: '0 2px 0 #78350F' }}>
          <IconStar size={10} />
          {progress.totalXp} XP
        </div>
      </div>

      {/* ─── Sub-stats bar ─── */}
      <div className="px-3 py-2 flex items-center gap-3 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(154,52,18,0.25)' }}>
        <span className="font-pixel text-amber-900" style={{ fontSize: 6, letterSpacing: 1.5 }}>
          {totalCompleted}/{totalLessons} LESSONS
        </span>
        <div className="flex-1 relative" style={{
          height: 6, background: 'rgba(154,52,18,0.3)',
          borderRadius: 3, border: '1px solid rgba(154,52,18,0.35)',
        }}>
          <div style={{
            width: `${(totalCompleted / totalLessons) * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #F59E0B, #B45309)',
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div className="flex items-center gap-1 font-pixel" style={{ fontSize: 6, color: '#FDE68A', background: '#7C2D12', padding: '2px 6px', borderRadius: 3, border: '1px solid #451A03' }}>
          <IconCrown size={8} />
          {progress.perfect.length}
        </div>
      </div>

      {/* ─── Scrollable units ─── */}
      <div className="flex-1 overflow-y-auto pb-12 pt-3">
        {SERBIAN_UNITS.map((unit, ui) => (
          <UnitSection key={unit.id}
            unit={unit}
            unitIndex={ui}
            progress={progress}
            isUnlocked={isUnlocked}
            onLessonTap={onLessonTap}
          />
        ))}
      </div>
    </div>
  )
}

function UnitSection({ unit, unitIndex, progress, isUnlocked, onLessonTap }: {
  unit: Unit
  unitIndex: number
  progress: SerbianProgress
  isUnlocked: (id: number) => boolean
  onLessonTap: (l: Lesson) => void
}) {
  const lessons = unit.lessonIds.map(id => getLessonById(id)!).filter(Boolean)

  return (
    <div className="mb-8 px-4">
      {/* Unit banner */}
      <div className="mb-4 px-4 py-3 flex items-center justify-between" style={{
        background: `linear-gradient(135deg, ${unit.color}, ${unit.edgeColor})`,
        borderRadius: 5,
        border: `3px solid ${unit.edgeColor}`,
        boxShadow: `0 4px 0 ${unit.edgeColor}, inset 0 1px 0 rgba(255,255,255,0.3)`,
      }}>
        <div>
          <div className="font-pixel text-white" style={{ fontSize: 6, letterSpacing: 2, opacity: 0.85 }}>
            UNIT {unitIndex + 1}
          </div>
          <div className="font-pixel text-white" style={{ fontSize: 11, letterSpacing: 1.5, textShadow: `1px 1px 0 ${unit.edgeColor}` }}>
            {unit.title.toUpperCase()}
          </div>
          <div className="font-pixel" style={{ fontSize: 6, color: 'rgba(255,255,255,0.85)', letterSpacing: 1, marginTop: 2 }}>
            {unit.titleSr}
          </div>
        </div>
        <div className="text-right">
          <div className="font-pixel text-white" style={{ fontSize: 8, opacity: 0.85 }}>
            {lessons.filter(l => progress.completed.includes(l.id)).length}/{lessons.length}
          </div>
        </div>
      </div>

      {/* Zigzag of lesson nodes */}
      <div className="flex flex-col items-center gap-1">
        {lessons.map((l, li) => {
          const completed = progress.completed.includes(l.id)
          const perfect = progress.perfect.includes(l.id)
          const unlocked = isUnlocked(l.id)
          const offset = li % 2 === 0 ? -36 : 36   // zigzag
          return (
            <div key={l.id} className="flex flex-col items-center" style={{ marginLeft: offset }}>
              {li > 0 && (
                <div style={{
                  width: 3, height: 22,
                  background: completed
                    ? `linear-gradient(180deg, ${unit.color}, ${unit.edgeColor})`
                    : 'repeating-linear-gradient(180deg, rgba(154,52,18,0.4) 0 4px, transparent 4px 8px)',
                  marginBottom: 4,
                }} />
              )}
              <button
                onClick={() => { if (unlocked) { playSound('ui_tap'); onLessonTap(l) } }}
                disabled={!unlocked}
                className="relative active:scale-95 transition-transform"
                style={{
                  width: 78, height: 78,
                  background: unlocked
                    ? `linear-gradient(135deg, ${unit.color}, ${unit.edgeColor})`
                    : 'rgba(120,53,15,0.25)',
                  border: `4px solid ${unlocked ? unit.edgeColor : 'rgba(120,53,15,0.5)'}`,
                  borderRadius: '50%',
                  boxShadow: unlocked
                    ? `0 5px 0 ${unit.edgeColor}, 0 0 14px ${unit.color}88`
                    : '0 3px 0 rgba(120,53,15,0.3)',
                  opacity: unlocked ? 1 : 0.55,
                  cursor: unlocked ? 'pointer' : 'default',
                  animation: unlocked && !completed ? 'srNodePulse 1.6s ease-in-out infinite' : 'none',
                }}>
                {/* Inner content */}
                <div className="absolute inset-2 rounded-full flex flex-col items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.18)' }}>
                  {unlocked
                    ? completed
                      ? <IconCrown size={28} />
                      : <span className="font-pixel text-white" style={{ fontSize: 10, textShadow: '1px 1px 0 rgba(0,0,0,0.6)' }}>{l.id}</span>
                    : <span style={{ fontSize: 18, opacity: 0.7 }}>🔒</span>
                  }
                </div>
                {/* Perfect star */}
                {perfect && (
                  <div className="absolute" style={{
                    top: -6, right: -6,
                    width: 22, height: 22,
                    background: 'radial-gradient(circle, #FDE68A, #F59E0B)',
                    borderRadius: '50%',
                    border: '2px solid #92400E',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 8px rgba(253,224,71,0.8)',
                  }}>
                    <IconStar size={12} />
                  </div>
                )}
              </button>
              <div className="font-pixel mt-1.5 text-center" style={{
                fontSize: 6, color: unlocked ? '#7C2D12' : 'rgba(120,53,15,0.5)',
                letterSpacing: 1, maxWidth: 110, lineHeight: 1.5,
              }}>
                {l.title.toUpperCase()}
              </div>
            </div>
          )
        })}
      </div>

      <style jsx global>{`
        @keyframes srNodePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LESSON PLAYER — Duolingo-style: hearts, progress, exercise rotation
// ═══════════════════════════════════════════════════════════════════════════
function LessonPlayer({ lesson, onExit, onFinish }: {
  lesson: Lesson
  onExit: () => void
  onFinish: (perfect: boolean) => void
}) {
  // Build exercises once per mount.
  const exercises = useMemo(() => buildExercises(lesson), [lesson])
  const [idx, setIdx] = useState(0)
  const [hearts, setHearts] = useState(HEARTS_MAX)
  const [feedback, setFeedback] = useState<null | { ok: boolean; correctText?: string }>(null)
  const [exitConfirm, setExitConfirm] = useState(false)
  const heartsLostRef = useRef(0)
  const [requeuedCount, setRequeuedCount] = useState(0)

  const ex = exercises[idx]
  const total = exercises.length + requeuedCount  // wrong answers requeue; total grows
  const progressPct = Math.min(100, Math.round((idx / total) * 100))

  function handleAnswer(ok: boolean, correctText?: string) {
    if (ok) {
      playCorrect()
      setFeedback({ ok: true })
    } else {
      playWrong()
      heartsLostRef.current++
      setHearts(h => Math.max(0, h - 1))
      setFeedback({ ok: false, correctText })
    }
  }

  function continueNext() {
    const wasOk = feedback?.ok
    setFeedback(null)
    if (!wasOk) {
      // Requeue the failed exercise toward the end so the player sees it again.
      setRequeuedCount(c => c + 1)
    }
    if (idx + 1 >= exercises.length) {
      // Done — no more exercises to show.
      const perfect = heartsLostRef.current === 0
      // Out-of-hearts case: hearts is zero, treat as fail-restart.
      if (hearts <= 0 && !wasOk) {
        // Hearts ran out on the just-handled wrong answer; show no-hearts screen
        return
      }
      onFinish(perfect)
      return
    }
    setIdx(i => i + 1)
  }

  // If hearts hit 0 mid-lesson, show the "no hearts" screen instead.
  const outOfHearts = hearts <= 0

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: '#FFFAF0' }}>
      {/* ─── Top bar ─── */}
      <div className="flex items-center gap-3 px-3 py-3 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.95)', borderBottom: '2px solid #FED7AA' }}>
        <button onClick={() => setExitConfirm(true)}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 30, height: 30, background: 'transparent', border: 'none' }}>
          <X size={20} className="text-amber-700" />
        </button>
        {/* Progress bar */}
        <div className="flex-1 relative" style={{
          height: 14, background: '#FFEDD5',
          borderRadius: 7, border: '2px solid #FDBA74', overflow: 'hidden',
        }}>
          <div style={{
            width: `${progressPct}%`,
            height: '100%',
            background: 'linear-gradient(180deg, #FDE68A 0%, #F59E0B 100%)',
            borderRadius: 4,
            transition: 'width 0.4s ease',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
          }} />
        </div>
        {/* Hearts */}
        <div className="flex items-center gap-1 px-2 py-1" style={{
          background: '#FEE2E2',
          border: '2px solid #FCA5A5',
          borderRadius: 4,
        }}>
          <Heart size={14} className="text-rose-500 fill-rose-500" />
          <span className="font-pixel" style={{ fontSize: 9, color: '#9F1239' }}>{hearts}</span>
        </div>
      </div>

      {/* ─── Exercise area ─── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!outOfHearts && ex && (
          <ExerciseSurface
            key={`${idx}`}
            exercise={ex}
            disabled={feedback !== null}
            onAnswer={handleAnswer}
          />
        )}

        {outOfHearts && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="font-pixel" style={{ fontSize: 28 }}>💔</div>
            <p className="font-pixel" style={{ fontSize: 12, color: '#9F1239', letterSpacing: 2 }}>OUT OF HEARTS</p>
            <p className="text-amber-900 text-sm leading-relaxed max-w-[280px]">
              Don&apos;t worry — try this lesson again. Mistakes are part of learning!
            </p>
            <div className="flex gap-2">
              <button onClick={onExit}
                className="px-5 py-2 active:translate-y-[2px] transition-transform"
                style={{ background: 'white', border: '2px solid #FDBA74', borderRadius: 4, boxShadow: '0 3px 0 #C2410C', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5, color: '#9A3412' }}>
                BACK
              </button>
              <button onClick={() => {
                  // Reset lesson
                  setIdx(0); setHearts(HEARTS_MAX); heartsLostRef.current = 0; setRequeuedCount(0); setFeedback(null)
                }}
                className="px-5 py-2 text-white active:translate-y-[2px] transition-transform"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)', border: '2px solid #92400E', borderRadius: 4, boxShadow: '0 3px 0 #78350F', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5 }}>
                RETRY
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Feedback drawer ─── */}
      {feedback && !outOfHearts && (
        <div className="flex-shrink-0 px-4 py-4" style={{
          background: feedback.ok ? '#D1FAE5' : '#FEE2E2',
          borderTop: `4px solid ${feedback.ok ? '#10B981' : '#DC2626'}`,
          animation: 'srFbSlide 0.25s ease-out',
        }}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div style={{
                width: 28, height: 28,
                background: feedback.ok ? '#10B981' : '#DC2626',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 'bold', fontSize: 16,
              }}>
                {feedback.ok ? '✓' : '✗'}
              </div>
              <div>
                <div className="font-pixel" style={{ fontSize: 10, color: feedback.ok ? '#065F46' : '#991B1B', letterSpacing: 1 }}>
                  {feedback.ok ? 'GREAT!' : 'NOT QUITE'}
                </div>
                {!feedback.ok && feedback.correctText && (
                  <div className="text-xs mt-0.5" style={{ color: '#9F1239' }}>
                    Answer: <strong>{feedback.correctText}</strong>
                  </div>
                )}
              </div>
            </div>
            <button onClick={continueNext}
              className="px-5 py-2 text-white active:translate-y-[2px] transition-transform"
              style={{
                background: feedback.ok ? 'linear-gradient(135deg, #34D399, #10B981)' : 'linear-gradient(135deg, #F87171, #DC2626)',
                border: `2px solid ${feedback.ok ? '#065F46' : '#7F1D1D'}`,
                borderRadius: 4,
                boxShadow: `0 3px 0 ${feedback.ok ? '#065F46' : '#7F1D1D'}`,
                fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5,
              }}>
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* ─── Exit confirm modal ─── */}
      {exitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="flex flex-col items-center gap-3 px-5 py-5 max-w-[320px] text-center"
            style={{ background: 'white', border: '3px solid #B45309', borderRadius: 6, boxShadow: '0 5px 0 #92400E' }}>
            <p className="font-pixel" style={{ fontSize: 10, color: '#7C2D12', letterSpacing: 1.5 }}>QUIT LESSON?</p>
            <p className="text-sm text-amber-900">You&apos;ll lose your progress on this lesson.</p>
            <div className="flex gap-2 mt-1">
              <button onClick={() => setExitConfirm(false)}
                className="px-4 py-2 active:translate-y-[2px]"
                style={{ background: '#F59E0B', color: 'white', border: '2px solid #92400E', borderRadius: 4, boxShadow: '0 3px 0 #78350F', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5 }}>
                KEEP GOING
              </button>
              <button onClick={() => { setExitConfirm(false); onExit() }}
                className="px-4 py-2 active:translate-y-[2px]"
                style={{ background: 'white', color: '#7C2D12', border: '2px solid #B45309', borderRadius: 4, boxShadow: '0 3px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5 }}>
                QUIT
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes srFbSlide {
          0%   { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Exercise renderer dispatch ────────────────────────────────────────────
function ExerciseSurface({ exercise, disabled, onAnswer }: {
  exercise: Exercise
  disabled: boolean
  onAnswer: (ok: boolean, correctText?: string) => void
}) {
  if (exercise.kind === 'mc')    return <MCExercise    ex={exercise} disabled={disabled} onAnswer={onAnswer} />
  if (exercise.kind === 'pairs') return <PairsExercise ex={exercise} disabled={disabled} onAnswer={onAnswer} />
  return <OrderExercise ex={exercise} disabled={disabled} onAnswer={onAnswer} />
}

// ─── Multiple choice translate ─────────────────────────────────────────────
function MCExercise({ ex, disabled, onAnswer }: {
  ex: Extract<Exercise, { kind: 'mc' }>
  disabled: boolean
  onAnswer: (ok: boolean, correctText?: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit() {
    if (selected === null || submitted) return
    setSubmitted(true)
    const ok = selected === ex.answer
    onAnswer(ok, ex.answer)
  }

  return (
    <div className="flex-1 flex flex-col px-5 py-6 overflow-y-auto">
      <p className="font-pixel" style={{ fontSize: 7, color: '#9A3412', letterSpacing: 2 }}>
        {ex.promptLang === 'sr' ? 'TRANSLATE TO ENGLISH' : 'PICK THE TRANSLATION'}
      </p>
      <div className="my-6 px-5 py-5 text-center"
        style={{ background: 'white', border: '2px solid #FED7AA', borderRadius: 6, boxShadow: '0 3px 0 #FDBA74' }}>
        <p className={ex.promptLang === 'sr' ? 'font-pixel' : ''}
          style={{
            fontSize: ex.promptLang === 'sr' ? 16 : 14,
            color: '#7C2D12', letterSpacing: ex.promptLang === 'sr' ? 1.5 : 0,
            lineHeight: 1.4,
          }}>
          {ex.prompt}
        </p>
        {ex.pronunciation && (
          <p className="text-xs italic mt-2" style={{ color: '#A16207' }}>
            /{ex.pronunciation}/
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        {ex.options.map(opt => {
          const isSel = selected === opt
          const isCorrect = submitted && opt === ex.answer
          const isWrongPick = submitted && isSel && opt !== ex.answer
          return (
            <button key={opt}
              disabled={disabled || submitted}
              onClick={() => setSelected(opt)}
              className="px-3 py-3 active:scale-95 transition-transform text-left"
              style={{
                background: isCorrect ? '#D1FAE5' : isWrongPick ? '#FEE2E2' : isSel ? '#FFEDD5' : 'white',
                border: `2px solid ${isCorrect ? '#10B981' : isWrongPick ? '#DC2626' : isSel ? '#F59E0B' : '#FED7AA'}`,
                borderRadius: 5,
                boxShadow: `0 3px 0 ${isCorrect ? '#065F46' : isWrongPick ? '#7F1D1D' : isSel ? '#B45309' : '#FDBA74'}`,
                color: '#7C2D12',
                fontFamily: ex.promptLang === 'sr' ? undefined : '"Press Start 2P"',
                fontSize: ex.promptLang === 'sr' ? 13 : 8,
                lineHeight: 1.4,
                minHeight: 56,
                cursor: disabled || submitted ? 'default' : 'pointer',
              }}>
              {opt}
            </button>
          )
        })}
      </div>

      <div className="mt-auto pt-5">
        <button onClick={handleSubmit}
          disabled={disabled || submitted || selected === null}
          className="w-full py-3 text-white active:translate-y-[2px] transition-transform disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
            border: '2px solid #052e16',
            borderRadius: 4,
            boxShadow: '0 4px 0 #052e16',
            fontFamily: '"Press Start 2P"', fontSize: 10, letterSpacing: 1.5,
          }}>
          CHECK
        </button>
      </div>
    </div>
  )
}

// ─── Match pairs ──────────────────────────────────────────────────────────
function PairsExercise({ ex, disabled, onAnswer }: {
  ex: Extract<Exercise, { kind: 'pairs' }>
  disabled: boolean
  onAnswer: (ok: boolean, correctText?: string) => void
}) {
  // Stable randomised orderings for each column
  const [srOrder] = useState(() => ex.pairs.map((_, i) => i).sort(() => Math.random() - 0.5))
  const [enOrder] = useState(() => ex.pairs.map((_, i) => i).sort(() => Math.random() - 0.5))

  const [pickedSr, setPickedSr] = useState<number | null>(null)
  const [pickedEn, setPickedEn] = useState<number | null>(null)
  const [matched, setMatched] = useState<number[]>([])  // pair indices that are matched
  const [wrongFlash, setWrongFlash] = useState<{ sr: number; en: number } | null>(null)
  const finishedRef = useRef(false)

  // When a sr and en are both picked, evaluate.
  useEffect(() => {
    if (pickedSr !== null && pickedEn !== null) {
      if (pickedSr === pickedEn) {
        // Match!
        playCorrect()
        const matchedIdx = pickedSr
        setMatched(m => [...m, matchedIdx])
        setPickedSr(null); setPickedEn(null)
        if (matched.length + 1 === ex.pairs.length && !finishedRef.current) {
          finishedRef.current = true
          setTimeout(() => onAnswer(true), 380)
        }
      } else {
        // Wrong pair — brief red flash, then deselect.
        playWrong()
        setWrongFlash({ sr: pickedSr, en: pickedEn })
        setTimeout(() => {
          setWrongFlash(null)
          setPickedSr(null); setPickedEn(null)
        }, 380)
      }
    }
  }, [pickedSr, pickedEn]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex flex-col px-5 py-6 overflow-y-auto">
      <p className="font-pixel" style={{ fontSize: 7, color: '#9A3412', letterSpacing: 2 }}>
        TAP MATCHING PAIRS
      </p>
      <p className="text-xs mt-1 text-amber-700">
        {matched.length}/{ex.pairs.length} matched
      </p>
      <div className="grid grid-cols-2 gap-3 mt-5">
        {/* Serbian column */}
        <div className="flex flex-col gap-2">
          {srOrder.map(i => {
            const isMatched = matched.includes(i)
            const isPicked  = pickedSr === i
            const isWrong   = wrongFlash?.sr === i
            return (
              <button key={`sr-${i}`}
                disabled={disabled || isMatched}
                onClick={() => { if (!isMatched && pickedSr === null) setPickedSr(i); else if (pickedSr === i) setPickedSr(null) }}
                className="px-2 py-3 active:scale-95 transition-all"
                style={{
                  background: isMatched ? '#D1FAE5' : isWrong ? '#FEE2E2' : isPicked ? '#FFEDD5' : 'white',
                  border: `2px solid ${isMatched ? '#10B981' : isWrong ? '#DC2626' : isPicked ? '#F59E0B' : '#FED7AA'}`,
                  borderRadius: 5,
                  boxShadow: `0 3px 0 ${isMatched ? '#065F46' : isWrong ? '#7F1D1D' : isPicked ? '#B45309' : '#FDBA74'}`,
                  color: '#7C2D12',
                  fontFamily: '"Press Start 2P"', fontSize: 9,
                  letterSpacing: 1, lineHeight: 1.4,
                  opacity: isMatched ? 0.55 : 1,
                  cursor: isMatched ? 'default' : 'pointer',
                  minHeight: 50,
                }}>
                {ex.pairs[i].sr}
              </button>
            )
          })}
        </div>
        {/* English column */}
        <div className="flex flex-col gap-2">
          {enOrder.map(i => {
            const isMatched = matched.includes(i)
            const isPicked  = pickedEn === i
            const isWrong   = wrongFlash?.en === i
            return (
              <button key={`en-${i}`}
                disabled={disabled || isMatched}
                onClick={() => { if (!isMatched && pickedEn === null) setPickedEn(i); else if (pickedEn === i) setPickedEn(null) }}
                className="px-2 py-3 active:scale-95 transition-all"
                style={{
                  background: isMatched ? '#D1FAE5' : isWrong ? '#FEE2E2' : isPicked ? '#FFEDD5' : 'white',
                  border: `2px solid ${isMatched ? '#10B981' : isWrong ? '#DC2626' : isPicked ? '#F59E0B' : '#FED7AA'}`,
                  borderRadius: 5,
                  boxShadow: `0 3px 0 ${isMatched ? '#065F46' : isWrong ? '#7F1D1D' : isPicked ? '#B45309' : '#FDBA74'}`,
                  color: '#7C2D12',
                  fontSize: 13, fontWeight: 600,
                  lineHeight: 1.4,
                  opacity: isMatched ? 0.55 : 1,
                  cursor: isMatched ? 'default' : 'pointer',
                  minHeight: 50,
                }}>
                {ex.pairs[i].en}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Word order ────────────────────────────────────────────────────────────
function OrderExercise({ ex, disabled, onAnswer }: {
  ex: Extract<Exercise, { kind: 'order' }>
  disabled: boolean
  onAnswer: (ok: boolean, correctText?: string) => void
}) {
  // Each tile gets a stable id (index in ex.tiles).
  const [bank, setBank]       = useState<number[]>(() => ex.tiles.map((_, i) => i))
  const [answer, setAnswer]   = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)

  function pickFromBank(i: number) {
    if (submitted || disabled) return
    setBank(b => b.filter(x => x !== i))
    setAnswer(a => [...a, i])
  }
  function pickFromAnswer(i: number) {
    if (submitted || disabled) return
    setAnswer(a => a.filter(x => x !== i))
    setBank(b => [...b, i])
  }

  function handleSubmit() {
    if (submitted) return
    setSubmitted(true)
    const built = answer.map(i => ex.tiles[i]).join(' ')
    const ok = built.trim().toLowerCase() === ex.sr.trim().toLowerCase()
    onAnswer(ok, ex.sr)
  }

  return (
    <div className="flex-1 flex flex-col px-5 py-6 overflow-y-auto">
      <p className="font-pixel" style={{ fontSize: 7, color: '#9A3412', letterSpacing: 2 }}>
        TRANSLATE TO SERBIAN
      </p>
      <div className="my-5 px-5 py-4 text-center"
        style={{ background: 'white', border: '2px solid #FED7AA', borderRadius: 6, boxShadow: '0 3px 0 #FDBA74' }}>
        <p style={{ fontSize: 14, color: '#7C2D12', lineHeight: 1.4, fontWeight: 600 }}>{ex.english}</p>
      </div>

      {/* Answer area */}
      <div className="min-h-[64px] py-2 px-2 mb-3 flex flex-wrap gap-2"
        style={{
          background: '#FFFBEB',
          border: '2px dashed #F59E0B',
          borderRadius: 5,
        }}>
        {answer.length === 0 && (
          <span className="font-pixel text-amber-400" style={{ fontSize: 7, alignSelf: 'center', letterSpacing: 1.5 }}>
            TAP WORDS BELOW
          </span>
        )}
        {answer.map(i => (
          <button key={`ans-${i}`}
            onClick={() => pickFromAnswer(i)}
            disabled={submitted}
            className="px-3 py-1.5 active:scale-95 transition-transform"
            style={{
              background: 'white', color: '#7C2D12',
              border: '2px solid #F59E0B', borderRadius: 4,
              boxShadow: '0 2px 0 #B45309',
              fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 0.5,
            }}>
            {ex.tiles[i]}
          </button>
        ))}
      </div>

      {/* Tile bank */}
      <div className="flex flex-wrap gap-2">
        {bank.map(i => (
          <button key={`bank-${i}`}
            onClick={() => pickFromBank(i)}
            disabled={submitted || disabled}
            className="px-3 py-1.5 active:scale-95 transition-transform"
            style={{
              background: 'white', color: '#7C2D12',
              border: '2px solid #FED7AA', borderRadius: 4,
              boxShadow: '0 3px 0 #FDBA74',
              fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 0.5,
            }}>
            {ex.tiles[i]}
          </button>
        ))}
      </div>

      <div className="mt-auto pt-5">
        <button onClick={handleSubmit}
          disabled={disabled || submitted || answer.length === 0}
          className="w-full py-3 text-white active:translate-y-[2px] transition-transform disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
            border: '2px solid #052e16',
            borderRadius: 4,
            boxShadow: '0 4px 0 #052e16',
            fontFamily: '"Press Start 2P"', fontSize: 10, letterSpacing: 1.5,
          }}>
          CHECK
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE SCREEN — confetti + XP award
// ═══════════════════════════════════════════════════════════════════════════
function CompleteScreen({ lesson, xp, onContinue }: { lesson: Lesson; xp: number; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 100%)' }}>
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i * 13) % 100}%`,
            top: -20,
            width: 6, height: 10,
            background: ['#EC4899', '#A78BFA', '#34D399', '#FBBF24', '#60A5FA'][i % 5],
            animation: `srConfetti ${1.5 + (i % 5) * 0.4}s linear ${(i * 0.05)}s infinite`,
          }} />
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-3 px-6 py-6 max-w-[340px] text-center"
        style={{
          background: 'white',
          border: '4px solid #B45309',
          borderRadius: 8,
          boxShadow: '0 6px 0 #92400E, 0 0 30px rgba(253,224,71,0.6)',
          animation: 'srFinishPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
        <IconCrown size={48} />
        <p className="font-pixel" style={{ fontSize: 12, letterSpacing: 2, color: '#7C2D12' }}>LESSON COMPLETE</p>
        <p className="font-pixel" style={{ fontSize: 8, color: '#A16207', letterSpacing: 1 }}>
          {lesson.title.toUpperCase()}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <div className="px-4 py-2 flex flex-col items-center"
            style={{ background: 'rgba(245,158,11,0.15)', border: '2px solid #F59E0B', borderRadius: 4 }}>
            <span className="font-pixel" style={{ fontSize: 6, color: '#7C2D12', letterSpacing: 1.5 }}>XP</span>
            <span className="font-pixel" style={{ fontSize: 18, color: '#9A3412' }}>+{xp}</span>
          </div>
          <div className="px-4 py-2 flex flex-col items-center"
            style={{ background: 'rgba(167,139,250,0.15)', border: '2px solid #A78BFA', borderRadius: 4 }}>
            <span className="font-pixel" style={{ fontSize: 6, color: '#4C1D95', letterSpacing: 1.5 }}>COINS</span>
            <span className="font-pixel" style={{ fontSize: 18, color: '#4C1D95' }}>+6</span>
          </div>
        </div>
        <button onClick={() => { playSound('ui_tap'); onContinue() }}
          className="mt-3 px-6 py-3 text-white active:translate-y-[2px] transition-transform"
          style={{
            background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
            border: '2px solid #052e16',
            borderRadius: 4,
            boxShadow: '0 4px 0 #052e16',
            fontFamily: '"Press Start 2P"', fontSize: 10, letterSpacing: 1.5,
          }}>
          CONTINUE
        </button>
      </div>

      <style jsx global>{`
        @keyframes srFinishPop {
          0%   { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes srConfetti {
          0%   { transform: translateY(-30px) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(720deg); }
        }
      `}</style>
    </div>
  )
}
