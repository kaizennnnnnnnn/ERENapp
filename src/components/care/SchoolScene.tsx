'use client'

import { useState, useEffect } from 'react'
import { SERBIAN_COURSE, getTodaysLesson, type Lesson, type Word } from '@/lib/serbianCourse'
import { playSound } from '@/lib/sounds'

interface Props { onClose: () => void }

type Phase = 'menu' | 'flashcards' | 'sentences' | 'quiz' | 'results'

export default function SchoolScene({ onClose }: Props) {
  const [lesson, setLesson]       = useState<Lesson>(getTodaysLesson)
  const [phase, setPhase]         = useState<Phase>('menu')
  const [cardIdx, setCardIdx]     = useState(0)
  const [flipped, setFlipped]     = useState(false)
  const [quizIdx, setQuizIdx]     = useState(0)
  const [selected, setSelected]   = useState<number | null>(null)
  const [score, setScore]         = useState(0)
  const [showAll, setShowAll]     = useState(false)

  // Progress stored in localStorage
  const [completed, setCompleted] = useState<Set<number>>(new Set())

  useEffect(() => {
    const raw = localStorage.getItem('eren_serbian_completed')
    if (raw) setCompleted(new Set(JSON.parse(raw)))
  }, [])

  function markComplete(id: number) {
    setCompleted(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('eren_serbian_completed', JSON.stringify(Array.from(next)))
      return next
    })
  }

  function startLesson(l: Lesson) {
    setLesson(l)
    setPhase('flashcards')
    setCardIdx(0)
    setFlipped(false)
    setQuizIdx(0)
    setSelected(null)
    setScore(0)
  }

  // ── Flashcard nav ──
  function nextCard() {
    if (cardIdx < lesson.words.length - 1) {
      setCardIdx(i => i + 1)
      setFlipped(false)
    } else {
      setPhase('sentences')
    }
  }
  function prevCard() {
    if (cardIdx > 0) { setCardIdx(i => i - 1); setFlipped(false) }
  }

  // ── Quiz ──
  function pickAnswer(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    if (idx === lesson.quiz[quizIdx].answer) setScore(s => s + 1)
    setTimeout(() => {
      if (quizIdx < lesson.quiz.length - 1) {
        setQuizIdx(i => i + 1)
        setSelected(null)
      } else {
        markComplete(lesson.id)
        setPhase('results')
      }
    }, 900)
  }

  const todaysLesson = getTodaysLesson()
  const progress = `${completed.size}/${SERBIAN_COURSE.length}`

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ BACKGROUND ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: 'url(/schoolBACK.png)', backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* ══ DARK OVERLAY for readability ══ */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} />

      {/* ══ EREN (teacher) ══ */}
      <div className="absolute z-[2]" style={{ bottom: '8%', left: '50%', transform: 'translateX(-50%)' }}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 180, height: 180, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ CONTENT ══ */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">

        {/* ── MENU ──────────────────────────────────────────────────────── */}
        {phase === 'menu' && (
          <div className="flex-1 overflow-y-auto px-4 pt-14 pb-24">
            {/* Today's lesson highlight */}
            <div className="mb-4 p-3"
              style={{ background: 'rgba(245,158,11,0.15)', borderRadius: 4, border: '2px solid rgba(245,158,11,0.5)', backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 16 }}>📖</span>
                <span className="font-pixel text-amber-300" style={{ fontSize: 7 }}>TODAY&apos;S LESSON</span>
              </div>
              <p className="font-pixel text-white mb-1" style={{ fontSize: 9 }}>{todaysLesson.title}</p>
              <p className="text-xs text-amber-200/80 mb-3">{todaysLesson.description}</p>
              <button onClick={() => { playSound('ui_tap'); startLesson(todaysLesson) }}
                className="w-full py-2.5 text-white active:translate-y-[1px] transition-transform"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 3, border: '2px solid #B45309', boxShadow: '0 3px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                {completed.has(todaysLesson.id) ? 'REVIEW' : 'START LESSON'}
              </button>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="font-pixel text-white/70" style={{ fontSize: 6 }}>PROGRESS: {progress}</span>
              <button onClick={() => { playSound('ui_tap'); setShowAll(!showAll) }} className="font-pixel text-amber-400" style={{ fontSize: 6 }}>
                {showAll ? 'HIDE ALL' : 'ALL LESSONS'}
              </button>
            </div>

            {/* Progress bar */}
            <div className="mb-4 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(completed.size / SERBIAN_COURSE.length) * 100}%`, background: 'linear-gradient(90deg, #F59E0B, #EAB308)' }} />
            </div>

            {/* All lessons grid */}
            {showAll && (
              <div className="flex flex-col gap-2">
                {SERBIAN_COURSE.map(l => {
                  const done = completed.has(l.id)
                  return (
                    <button key={l.id} onClick={() => startLesson(l)}
                      className="flex items-center gap-3 p-2.5 active:scale-[0.98] transition-transform"
                      style={{ background: done ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)', borderRadius: 4, border: `1px solid ${done ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.15)'}`, backdropFilter: 'blur(4px)' }}>
                      <div className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 28, height: 28, borderRadius: 4, background: done ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)', border: `1px solid ${done ? '#22C55E' : 'rgba(255,255,255,0.2)'}` }}>
                        <span className="font-pixel" style={{ fontSize: 8, color: done ? '#22C55E' : '#fff' }}>
                          {done ? '✓' : l.id}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-pixel text-white" style={{ fontSize: 7 }}>{l.title}</p>
                        <p className="text-xs text-white/50">{l.category} — {l.words.length} words</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── FLASHCARDS ────────────────────────────────────────────────── */}
        {phase === 'flashcards' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-24">
            <p className="font-pixel text-amber-300 mb-1" style={{ fontSize: 6 }}>
              LESSON {lesson.id}: {lesson.title.toUpperCase()} — WORD {cardIdx + 1}/{lesson.words.length}
            </p>

            {/* Card */}
            <button onClick={() => { playSound('ui_tap'); setFlipped(!flipped) }}
              className="w-full max-w-xs transition-transform active:scale-95"
              style={{ perspective: 800 }}>
              <div className="relative w-full" style={{ minHeight: 180 }}>
                <div className="w-full flex flex-col items-center justify-center gap-3 py-8 px-4"
                  style={{ background: flipped ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)', borderRadius: 8, border: `2px solid ${flipped ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.25)'}`, backdropFilter: 'blur(12px)', minHeight: 180 }}>
                  {!flipped ? (
                    <>
                      <span className="font-pixel text-white" style={{ fontSize: 18 }}>{lesson.words[cardIdx].serbian}</span>
                      <span className="font-pixel text-white/50" style={{ fontSize: 11 }}>{lesson.words[cardIdx].cyrillic}</span>
                      <span className="text-xs text-white/40 italic">{lesson.words[cardIdx].pronunciation}</span>
                      <span className="font-pixel text-amber-400 mt-2" style={{ fontSize: 6 }}>TAP TO REVEAL</span>
                    </>
                  ) : (
                    <>
                      <span className="font-pixel text-green-300" style={{ fontSize: 16 }}>{lesson.words[cardIdx].english}</span>
                      <span className="font-pixel text-white/70" style={{ fontSize: 10 }}>{lesson.words[cardIdx].serbian}</span>
                      <span className="text-xs text-white/40">{lesson.words[cardIdx].cyrillic}</span>
                    </>
                  )}
                </div>
              </div>
            </button>

            {/* Nav */}
            <div className="flex gap-4 mt-5">
              <button onClick={() => { playSound('ui_tap'); prevCard() }} disabled={cardIdx === 0}
                className="px-5 py-2 font-pixel text-white disabled:opacity-30 active:translate-y-[1px]"
                style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.2)', fontSize: 7 }}>
                PREV
              </button>
              <button onClick={() => { playSound('ui_tap'); nextCard() }}
                className="px-5 py-2 font-pixel text-white active:translate-y-[1px]"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 3, border: '2px solid #B45309', boxShadow: '0 2px 0 #92400E', fontSize: 7 }}>
                {cardIdx === lesson.words.length - 1 ? 'SENTENCES' : 'NEXT'}
              </button>
            </div>
          </div>
        )}

        {/* ── SENTENCES ─────────────────────────────────────────────────── */}
        {phase === 'sentences' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-24 gap-4">
            <p className="font-pixel text-amber-300 mb-2" style={{ fontSize: 7 }}>EXAMPLE SENTENCES</p>
            <div className="w-full max-w-xs flex flex-col gap-3">
              {lesson.sentences.map((s, i) => (
                <div key={i} className="p-3" style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <p className="font-pixel text-white mb-1" style={{ fontSize: 8 }}>{s.serbian}</p>
                  <p className="text-xs text-amber-200/70">{s.english}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { playSound('ui_tap'); setPhase('quiz'); setQuizIdx(0); setSelected(null); setScore(0) }}
              className="mt-3 px-8 py-2.5 text-white active:translate-y-[1px] transition-transform"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 3, border: '2px solid #B45309', boxShadow: '0 3px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
              START QUIZ
            </button>
          </div>
        )}

        {/* ── QUIZ ──────────────────────────────────────────────────────── */}
        {phase === 'quiz' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-24">
            <p className="font-pixel text-amber-300 mb-1" style={{ fontSize: 6 }}>
              QUIZ — QUESTION {quizIdx + 1}/{lesson.quiz.length}
            </p>

            <div className="w-full max-w-xs mb-5 p-4"
              style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)' }}>
              <p className="font-pixel text-white text-center" style={{ fontSize: 8, lineHeight: 2 }}>
                {lesson.quiz[quizIdx].question}
              </p>
            </div>

            <div className="w-full max-w-xs flex flex-col gap-2.5">
              {lesson.quiz[quizIdx].options.map((opt, i) => {
                const correct = i === lesson.quiz[quizIdx].answer
                const picked  = selected === i
                let bg    = 'rgba(255,255,255,0.08)'
                let bdr   = 'rgba(255,255,255,0.2)'
                if (selected !== null) {
                  if (correct) { bg = 'rgba(34,197,94,0.3)'; bdr = '#22C55E' }
                  else if (picked) { bg = 'rgba(239,68,68,0.3)'; bdr = '#EF4444' }
                }
                return (
                  <button key={i} onClick={() => pickAnswer(i)}
                    className="w-full py-3 px-4 text-left active:scale-[0.98] transition-all"
                    style={{ background: bg, borderRadius: 4, border: `2px solid ${bdr}`, backdropFilter: 'blur(4px)' }}>
                    <span className="font-pixel text-white" style={{ fontSize: 8 }}>{opt}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-1.5 mt-4">
              {lesson.quiz.map((_, i) => (
                <div key={i} style={{ width: i === quizIdx ? 16 : 6, height: 6, borderRadius: 3,
                  background: i === quizIdx ? '#F59E0B' : i < quizIdx ? '#22C55E' : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.25s' }} />
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS ───────────────────────────────────────────────────── */}
        {phase === 'results' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-24 gap-4">
            <div className="text-4xl mb-2">{score === lesson.quiz.length ? '🌟' : score >= 3 ? '👏' : '📚'}</div>
            <p className="font-pixel text-white" style={{ fontSize: 12 }}>
              {score}/{lesson.quiz.length}
            </p>
            <p className="font-pixel text-amber-300" style={{ fontSize: 7 }}>
              {score === lesson.quiz.length ? 'PERFECT SCORE!' : score >= 3 ? 'GREAT JOB!' : 'KEEP PRACTICING!'}
            </p>
            <p className="font-pixel text-white/50" style={{ fontSize: 6 }}>LESSON COMPLETE!</p>

            <div className="flex gap-3 mt-4">
              <button onClick={() => { playSound('ui_tap'); startLesson(lesson) }}
                className="px-5 py-2.5 text-white active:translate-y-[1px]"
                style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.25)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                RETRY
              </button>
              <button onClick={() => { playSound('ui_back'); setPhase('menu') }}
                className="px-5 py-2.5 text-white active:translate-y-[1px]"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 3, border: '2px solid #B45309', boxShadow: '0 2px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                ALL LESSONS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
