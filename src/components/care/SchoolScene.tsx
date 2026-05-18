'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Volume2, Flame } from 'lucide-react'
import {
  SERBIAN_SECTIONS, ORDERED_LESSON_IDS,
  buildExercises, buildReviewExercises, getLessonById, getUnitById, getStrugglingWords,
  type Lesson, type Exercise, type Section, type WordStats, type WordStat,
} from '@/lib/serbianCourse'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'
import { IconStar } from '@/components/PixelIcons'
import AnimatedEren from '@/components/AnimatedEren'
import SketchEren, { type SketchErenState } from '@/components/SketchEren'

interface Props { onClose: () => void }

const HEARTS_MAX = 5
const XP_PER_LESSON = 10

// ═══════════════════════════════════════════════════════════════════════════
// PAPER & KRAFT DESIGN TOKENS — the Serbian section uses a stationery
// aesthetic. Each section is a kraft pocket notebook; lessons are pages of
// lined paper; exercises are handwritten translations on a working sheet.
// ═══════════════════════════════════════════════════════════════════════════
const PAPER       = '#f6efdc'
const PAPER_DK    = '#e8dcb0'
const PAPER_LINES = 'rgba(127,163,197,0.30)'
const INK         = '#1f160a'
const INK_SOFT    = '#6a5a44'
const PEN_RED     = '#b22222'
const PEN_RED_DK  = '#7a1014'
const PENCIL      = '#9a8a72'
const KRAFT_HI    = '#d4b483'
const KRAFT_MD    = '#b8945c'
const KRAFT_LO    = '#8a6a3d'

const HAND_FONT  = '"Caveat", "Comic Sans MS", cursive'
const TYPE_FONT  = '"Special Elite", "Courier New", monospace'
const STAMP_FONT = '"Oswald", "Arial Narrow", sans-serif'
const SERIF_FONT = '"Cormorant Garamond", "Georgia", serif'

// Worn edge — physical paper feel for kraft covers / pages.
function PhysicalEdges({ pageColor = '#f4ead2' }: { pageColor?: string }) {
  return (
    <>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 22,
        background: 'linear-gradient(90deg, rgba(60,30,10,0.55) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: 4, right: 0, bottom: 0, height: 3,
        background: pageColor, opacity: 0.85,
        boxShadow: `0 1px 0 rgba(0,0,0,0.25), 0 -1px 0 ${pageColor}`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 3,
        background: pageColor, opacity: 0.6,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 2,
        background: pageColor, opacity: 0.6,
        pointerEvents: 'none',
      }} />
    </>
  )
}

const PROGRESS_KEY = (uid: string) => `eren_serbian_progress_${uid}`
const STATS_KEY    = (uid: string) => `eren_serbian_stats_${uid}`

interface SerbianProgress {
  completed: number[]
  perfect: number[]
  totalXp: number
  // Streak fields — added v2; old saves missing these fall back to 0/'' below.
  streak?: number
  longestStreak?: number
  lastDate?: string         // YYYY-MM-DD of most recent completion
}
const EMPTY_PROGRESS: SerbianProgress = {
  completed: [], perfect: [], totalXp: 0,
  streak: 0, longestStreak: 0, lastDate: '',
}

// ─── Date helpers (local-time keys) ─────────────────────────────────────────
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayKey(): string { return dateKey(new Date()) }
function yesterdayKey(): string {
  const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d)
}

// ─── Web Speech TTS — best effort, gracefully no-ops when unsupported ──────
let _voicesLoaded = false
let _bestVoice: SpeechSynthesisVoice | null | undefined = undefined  // cache; null means searched & nothing found
function ensureVoicesLoaded() {
  if (_voicesLoaded || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener('voiceschanged', () => { _voicesLoaded = true; _bestVoice = undefined }, { once: true })
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase()
  const lang = v.lang.toLowerCase()
  let s = 0
  if (!v.localService) s += 100
  if (name.includes('natural')) s += 80
  if (name.includes('neural'))  s += 80
  if (name.includes('wavenet')) s += 80
  if (name.includes('premium')) s += 60
  if (name.includes('online'))  s += 50
  if (name.includes('enhanced'))s += 40
  if (name.includes('siri'))    s += 35
  if (name.includes('multilingual')) s += 30
  if (name.includes('google'))     s += 20
  if (name.includes('microsoft'))  s += 20
  if (name.includes('compact')) s -= 60
  if (name.includes('lite'))    s -= 50
  if (/\blow\b/.test(name))     s -= 30
  if (name.includes('eloquence')) s -= 40
  if (/(lana|sara|sonia|branka|marina|nataša|jelena|milena)/i.test(name)) s += 15
  if (lang.startsWith('hr')) s += 30
  else if (lang.startsWith('sr')) s += 20
  else if (lang.startsWith('bs')) s += 15
  else if (lang.startsWith('sl')) s += 5
  return s
}

function pickBestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  if (_bestVoice !== undefined) return _bestVoice
  const all = window.speechSynthesis.getVoices()
  if (all.length === 0) return null
  const candidates = all.filter(v => {
    const lang = v.lang.toLowerCase()
    return lang.startsWith('sr') || lang.startsWith('hr') || lang.startsWith('bs') || lang.startsWith('sl')
  })
  if (candidates.length === 0) { _bestVoice = null; return null }
  candidates.sort((a, b) => scoreVoice(b) - scoreVoice(a))
  _bestVoice = candidates[0]
  return _bestVoice
}

export function speakSerbian(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  ensureVoicesLoaded()
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickBestVoice()
    if (v) { u.voice = v; u.lang = v.lang } else { u.lang = 'hr-HR' }
    u.rate = 0.88
    u.pitch = 1.05
    u.volume = 1.0
    window.speechSynthesis.speak(u)
  } catch { /* ignore */ }
}

// Paper-friendly speaker pip — a small inked circle.
function SpeakerButton({ text, size = 30 }: { text: string; size?: number }) {
  return (
    <button onClick={e => { e.stopPropagation(); speakSerbian(text) }}
      className="active:scale-90 transition-transform inline-flex items-center justify-center"
      style={{
        width: size, height: size,
        background: PAPER,
        border: `2px solid ${INK}`,
        borderRadius: '50%',
        boxShadow: `0 3px 0 ${INK}`,
        flexShrink: 0,
      }}>
      <Volume2 size={Math.round(size * 0.46)} style={{ color: INK }} />
    </button>
  )
}

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
interface Session {
  title: string
  exercises: Exercise[]
  lessonId: number | null   // null for review sessions (no progress to save)
}

export default function SchoolScene({ onClose }: Props) {
  const { user } = useAuth()
  const { addCoins, completeTask } = useTasks()

  const [phase, setPhase]       = useState<'map' | 'play' | 'complete'>('map')
  const [session, setSession]   = useState<Session | null>(null)
  const [progress, setProgress] = useState<SerbianProgress>(EMPTY_PROGRESS)
  const [stats, setStats]       = useState<WordStats>({})
  const [lastXp, setLastXp]     = useState(0)
  const [streakIncreased, setStreakIncreased] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(PROGRESS_KEY(user.id))
      if (raw) setProgress({ ...EMPTY_PROGRESS, ...JSON.parse(raw) })
    } catch { /* ignore */ }
    try {
      const rawS = localStorage.getItem(STATS_KEY(user.id))
      if (rawS) setStats(JSON.parse(rawS))
    } catch { /* ignore */ }
    ensureVoicesLoaded()
  }, [user?.id])

  function saveProgress(next: SerbianProgress) {
    setProgress(next)
    if (user?.id) {
      try { localStorage.setItem(PROGRESS_KEY(user.id), JSON.stringify(next)) } catch { /* ignore */ }
    }
  }

  function trackWord(srKey: string, en: string, lessonId: number, correct: boolean) {
    setStats(prev => {
      const cur = prev[srKey] ?? { sr: srKey, en, lessonId, attempts: 0, correct: 0 }
      const next: WordStat = {
        ...cur,
        attempts: cur.attempts + 1,
        correct: cur.correct + (correct ? 1 : 0),
        lastWrongAt: correct ? cur.lastWrongAt : Date.now(),
      }
      const merged = { ...prev, [srKey]: next }
      if (user?.id) {
        try { localStorage.setItem(STATS_KEY(user.id), JSON.stringify(merged)) } catch { /* ignore */ }
      }
      return merged
    })
  }

  function startLesson(l: Lesson) {
    setSession({ title: l.title, exercises: buildExercises(l), lessonId: l.id })
    setPhase('play')
  }

  function startReview() {
    const exs = buildReviewExercises(stats)
    if (exs.length === 0) return
    setSession({ title: 'Practice', exercises: exs, lessonId: null })
    setPhase('play')
  }

  function exitSession() {
    setSession(null)
    setPhase('map')
  }

  function bumpStreak(prev: SerbianProgress): { next: SerbianProgress; increased: boolean } {
    const today = todayKey()
    const yest = yesterdayKey()
    const prevStreak = prev.streak ?? 0
    const prevLongest = prev.longestStreak ?? 0
    const last = prev.lastDate ?? ''
    let streak = prevStreak
    let increased = false
    if (last === today) { /* already counted */ }
    else if (last === yest) { streak = prevStreak + 1; increased = true }
    else { streak = 1; increased = true }
    const longestStreak = Math.max(prevLongest, streak)
    return { next: { ...prev, streak, longestStreak, lastDate: today }, increased }
  }

  function finishSession(perfect: boolean) {
    if (!session) return

    if (session.lessonId !== null) {
      const id = session.lessonId
      const earnedXp = perfect ? XP_PER_LESSON + 5 : XP_PER_LESSON
      setLastXp(earnedXp)
      const base: SerbianProgress = {
        ...progress,
        completed: progress.completed.includes(id) ? progress.completed : [...progress.completed, id],
        perfect: perfect && !progress.perfect.includes(id) ? [...progress.perfect, id] : progress.perfect,
        totalXp: progress.totalXp + earnedXp,
      }
      const { next, increased } = bumpStreak(base)
      saveProgress(next)
      setStreakIncreased(increased)
      addCoins(perfect ? 12 : 6)
      completeTask('daily_play')
    } else {
      setLastXp(5)
      const { next, increased } = bumpStreak({ ...progress, totalXp: progress.totalXp + 5 })
      saveProgress(next)
      setStreakIncreased(increased)
      addCoins(3)
    }

    setPhase('complete')
    playFanfare()
  }

  if (phase === 'play' && session) {
    return (
      <LessonPlayer
        title={session.title}
        exercises={session.exercises}
        onExit={exitSession}
        onFinish={finishSession}
        onWordResult={(srKey, en, correct) => {
          if (session.lessonId !== null) trackWord(srKey, en, session.lessonId, correct)
          else {
            const cur = stats[srKey]
            if (cur) trackWord(srKey, en, cur.lessonId, correct)
          }
        }}
      />
    )
  }

  if (phase === 'complete' && session) {
    return (
      <CompleteScreen
        title={session.title}
        xp={lastXp}
        streak={progress.streak ?? 0}
        streakIncreased={streakIncreased}
        onContinue={() => { setSession(null); setPhase('map'); setStreakIncreased(false) }}
      />
    )
  }

  return (
    <CourseMap
      progress={progress}
      strugglingCount={getStrugglingWords(stats).length}
      onLessonTap={startLesson}
      onPracticeTap={startReview}
      onClose={onClose}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSE MAP — kraft notebook shelf. Each section is a closed pocket
// notebook; tap one to fly into a fullscreen view that flips the cover
// open and reveals its V4 lesson path on lined paper.
// ═══════════════════════════════════════════════════════════════════════════
function CourseMap({ progress, strugglingCount, onLessonTap, onPracticeTap, onClose }: {
  progress: SerbianProgress
  strugglingCount: number
  onLessonTap: (l: Lesson) => void
  onPracticeTap: () => void
  onClose: () => void
}) {
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)

  function isUnlocked(lessonId: number): boolean {
    const idx = ORDERED_LESSON_IDS.indexOf(lessonId)
    if (idx <= 0) return true
    const prev = ORDERED_LESSON_IDS[idx - 1]
    return progress.completed.includes(prev)
  }

  const nextUpId = ORDERED_LESSON_IDS.find(id => !progress.completed.includes(id))
  const totalCompleted = progress.completed.length
  const totalLessons = ORDERED_LESSON_IDS.length

  const openSection = openSectionId
    ? SERBIAN_SECTIONS.find(s => s.id === openSectionId) ?? null
    : null

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden" style={{
      background: `radial-gradient(ellipse at center, ${PAPER_DK} 0%, #aea692 100%)`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          radial-gradient(circle at 22% 18%, rgba(0,0,0,0.06), transparent 40%),
          radial-gradient(circle at 78% 82%, rgba(0,0,0,0.08), transparent 50%),
          repeating-linear-gradient(92deg, rgba(0,0,0,0.025) 0 1px, transparent 1px 3px)`,
      }} />

      {/* ─── Header ─── */}
      <div className="relative z-20 flex items-center gap-2 px-3 pt-3 pb-2.5 flex-shrink-0" style={{
        background: `linear-gradient(180deg, ${KRAFT_MD} 0%, ${KRAFT_LO} 100%)`,
        borderBottom: `2px solid ${INK}`,
        boxShadow: '0 3px 0 rgba(0,0,0,0.18)',
      }}>
        <button onClick={() => { playSound('ui_back'); onClose() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 34, height: 34, background: PAPER,
            borderRadius: 4, border: `2px solid ${INK}`,
            boxShadow: '0 2px 0 rgba(0,0,0,0.4)',
          }}>
          <ChevronLeft size={18} style={{ color: INK }} />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span style={{
            fontFamily: STAMP_FONT, fontWeight: 700,
            fontSize: 14, letterSpacing: 4, textTransform: 'uppercase',
            color: PAPER, padding: '6px 14px',
            border: `2.5px solid ${PAPER}`, borderRadius: 2,
            background: 'rgba(0,0,0,0.18)',
            textShadow: '0 1px 0 rgba(0,0,0,0.35)',
            transform: 'rotate(-1deg)', display: 'inline-block',
          }}>Srpski · Notes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1.5" style={{
            background: PAPER, borderRadius: 4,
            border: `2px solid ${INK}`,
            boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
            fontFamily: TYPE_FONT, fontSize: 11, color: INK,
          }}>
            <Flame size={12} style={{ color: PEN_RED }} fill="currentColor" />
            {progress.streak ?? 0}
          </div>
          <div className="flex items-center gap-1 px-2 py-1.5" style={{
            background: PAPER, borderRadius: 4,
            border: `2px solid ${INK}`,
            boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
            fontFamily: TYPE_FONT, fontSize: 11, color: INK,
          }}>
            <IconStar size={10} />
            {progress.totalXp}
          </div>
        </div>
      </div>

      {/* ─── Progress strip ─── */}
      <div className="relative z-20 px-4 py-2.5 flex items-center gap-3 flex-shrink-0" style={{
        background: PAPER,
        borderBottom: `1px dashed ${INK_SOFT}`,
      }}>
        <span style={{ fontFamily: TYPE_FONT, fontSize: 9, letterSpacing: 2, color: INK_SOFT }}>
          LEKCIJE · {totalCompleted}/{totalLessons}
        </span>
        <div className="flex-1 relative" style={{
          height: 8, background: PAPER_DK,
          borderRadius: 4, border: `1px solid ${INK_SOFT}55`,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(totalCompleted / totalLessons) * 100}%`,
            height: '100%', background: PEN_RED,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 9, letterSpacing: 2, color: INK_SOFT }}>
          ★ {progress.perfect.length}
        </div>
      </div>

      {/* ─── Notebook shelf ─── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-5 pb-12 flex flex-col gap-5">
        {strugglingCount > 0 && (
          <button onClick={() => { playSound('ui_tap'); onPracticeTap() }}
            className="relative active:translate-y-[1px] transition-transform text-left mx-auto"
            style={{
              width: '100%', maxWidth: 380,
              background: '#fff7c2',
              padding: '14px 16px 14px',
              border: `1px dashed ${INK_SOFT}`,
              boxShadow: '0 4px 0 rgba(0,0,0,0.18), 0 8px 18px rgba(0,0,0,0.12)',
              transform: 'rotate(-1deg)',
            }}>
            <div style={{
              position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%) rotate(-3deg)',
              width: 70, height: 16,
              background: 'rgba(252, 240, 140, 0.85)',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
            }} />
            <div className="flex items-center gap-3">
              <span style={{
                fontFamily: HAND_FONT, fontWeight: 700, fontSize: 22,
                color: PEN_RED, transform: 'rotate(-2deg)', display: 'inline-block',
              }}>~ vežbaj!</span>
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: 18, color: INK }}>
                  {strugglingCount} {strugglingCount === 1 ? 'word' : 'words'} to review
                </div>
                <div style={{ fontFamily: TYPE_FONT, fontSize: 9, letterSpacing: 2, color: INK_SOFT }}>
                  PRACTICE · MIX
                </div>
              </div>
              <span style={{ fontFamily: HAND_FONT, fontSize: 28, color: PEN_RED }}>→</span>
            </div>
          </button>
        )}

        <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
          {SERBIAN_SECTIONS.map((section, si) => {
            const units = section.unitIds.map(uid => getUnitById(uid)!).filter(Boolean)
            const sectionLessons = units.flatMap(u => u.lessonIds)
            const sectionDone = sectionLessons.filter(id => progress.completed.includes(id)).length
            return (
              <KraftSectionCover
                key={section.id}
                section={section}
                sectionIndex={si + 1}
                done={sectionDone}
                total={sectionLessons.length}
                onOpen={() => { playSound('ui_tap'); setOpenSectionId(section.id) }}
              />
            )
          })}
        </div>
      </div>

      {/* ─── Opened notebook overlay ─── */}
      {openSection && (() => {
        const units = openSection.unitIds.map(uid => getUnitById(uid)!).filter(Boolean)
        const sectionLessons = units.flatMap(u => u.lessonIds)
        const sectionDone = sectionLessons.filter(id => progress.completed.includes(id)).length
        const idx = SERBIAN_SECTIONS.findIndex(s => s.id === openSection.id) + 1
        return (
          <OpenNotebookView
            section={openSection}
            sectionIndex={idx}
            done={sectionDone}
            total={sectionLessons.length}
            progress={progress}
            isUnlocked={isUnlocked}
            nextUpId={nextUpId}
            onLessonTap={(l) => { setOpenSectionId(null); onLessonTap(l) }}
            onClose={() => setOpenSectionId(null)}
          />
        )
      })()}

      <style jsx global>{`
        @keyframes srNotebookFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes srNextUpBob {
          0%, 100% { transform: translateY(0)    rotate(-2deg); }
          50%      { transform: translateY(-3px) rotate(2deg); }
        }
        @keyframes srHandWiggle {
          0%, 100% { transform: rotate(-2deg); }
          50%      { transform: rotate(2deg); }
        }
        @keyframes srSheetIn {
          0%   { transform: translateY(8px) rotate(0.5deg); opacity: 0; }
          100% { transform: translateY(0) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Closed kraft notebook — compact portrait card in the 2-col shelf ─────
function KraftSectionCover({ section, sectionIndex, done, total, onOpen }: {
  section: Section
  sectionIndex: number
  done: number
  total: number
  onOpen: () => void
}) {
  // Tiny inline rotation jitter so the grid feels like real notebooks on a desk.
  const rot = [-1.2, 0.8, -0.6, 1.4, -1.0][(sectionIndex - 1) % 5]
  return (
    <button onClick={onOpen}
      className="block w-full text-left active:translate-y-[2px] transition-transform"
      style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        background: `radial-gradient(ellipse at 30% 18%, ${KRAFT_HI} 0%, ${KRAFT_MD} 50%, ${KRAFT_LO} 100%)`,
        color: '#2a1d10',
        fontFamily: TYPE_FONT,
        overflow: 'hidden',
        boxShadow: '0 6px 0 rgba(0,0,0,0.22), 0 12px 18px rgba(0,0,0,0.22)',
        borderRadius: 2,
        transform: `rotate(${rot}deg)`,
      }}>
      {/* kraft speckle */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.55, pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(circle at 18% 28%, rgba(60,40,20,0.35) 0px, transparent 1.2px),
          radial-gradient(circle at 72% 60%, rgba(60,40,20,0.4) 0px, transparent 1.5px),
          radial-gradient(circle at 40% 80%, rgba(255,255,255,0.15) 0px, transparent 1px),
          radial-gradient(circle at 90% 22%, rgba(60,40,20,0.3) 0px, transparent 1.4px)`,
        backgroundSize: '6px 6px, 9px 9px, 5px 5px, 11px 11px',
      }} />
      <PhysicalEdges />
      {/* mini spine staples */}
      {['18%', '52%', '84%'].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', left: 5, top: y, width: 7, height: 2,
          background: 'linear-gradient(180deg, #d6d4cf, #8a8884)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
          borderRadius: 1,
        }} />
      ))}

      {/* Top brand strip */}
      <div style={{
        position: 'absolute', top: 8, left: 16, right: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: 6.5, letterSpacing: 1.5, fontWeight: 700,
      }}>
        <span>EREN · POCKET</span>
        <span style={{ opacity: 0.75 }}>NO. {String(sectionIndex).padStart(3, '0')}</span>
      </div>

      {/* Stamp title block — flex column so spec list never collides */}
      <div style={{
        position: 'absolute', inset: '20px 8px 8px 16px',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: STAMP_FONT, fontWeight: 700,
          fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase',
          color: '#2a1d10',
          padding: '5px 7px',
          border: '2px solid #2a1d10',
          borderRadius: 2,
          display: 'inline-block',
          transform: 'rotate(-2deg)',
          background: 'rgba(255,255,255,0.04)',
          textShadow: '0.5px 0 0 rgba(0,0,0,0.4)',
          lineHeight: 1.05,
          maxWidth: '100%',
        }}>{section.title}</div>
        <div style={{
          fontFamily: HAND_FONT, fontSize: 16,
          marginTop: 3, color: PEN_RED,
          transform: 'rotate(-1deg)', display: 'inline-block',
          lineHeight: 1,
        }}>~ {section.titleSr} ~</div>
      </div>

      {/* Spec list — bottom strip */}
      <div style={{
        position: 'absolute', left: 16, right: 8, bottom: 8,
        fontSize: 6.5, letterSpacing: 1, color: '#2a1d10',
        borderTop: '1px solid #2a1d10', paddingTop: 4,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>I.</span><span>SEC {sectionIndex}/{SERBIAN_SECTIONS.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
          <span>II.</span><span>{done}/{total} DONE</span>
        </div>
      </div>

      {/* OPEN stamp top-right corner */}
      <div style={{
        position: 'absolute', right: 6, top: 22,
        transform: 'rotate(-8deg)',
        border: `1.5px solid ${PEN_RED}`,
        color: PEN_RED,
        padding: '2px 4px 3px',
        fontFamily: STAMP_FONT, fontSize: 6.5, letterSpacing: 1,
        fontWeight: 700,
        opacity: 0.9,
        background: 'rgba(138,58,16,0.05)',
      }}>OPEN ▸</div>
    </button>
  )
}

// ─── Open notebook overlay — fullscreen 3D book that flips open ────────────
function OpenNotebookView({ section, sectionIndex, done, total, progress,
  isUnlocked, nextUpId, onLessonTap, onClose }: {
  section: Section
  sectionIndex: number
  done: number
  total: number
  progress: SerbianProgress
  isUnlocked: (id: number) => boolean
  nextUpId: number | undefined
  onLessonTap: (l: Lesson) => void
  onClose: () => void
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{
      animation: 'srNotebookFadeIn 0.25s ease-out',
      background: 'radial-gradient(ellipse at center, #d8d2c2 0%, #aea692 100%)',
      perspective: '2200px', perspectiveOrigin: '50% 50%',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          radial-gradient(circle at 22% 18%, rgba(0,0,0,0.06), transparent 40%),
          radial-gradient(circle at 78% 82%, rgba(0,0,0,0.08), transparent 50%),
          repeating-linear-gradient(92deg, rgba(0,0,0,0.025) 0 1px, transparent 1px 3px)`,
      }} />

      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: '24px 12px 36px' }}>
        <div style={{
          position: 'relative',
          width: '100%', maxWidth: 460,
          height: '100%',
          transformStyle: 'preserve-3d',
        }}>
          <div style={{
            position: 'absolute', left: '6%', right: '6%', bottom: -12, height: 22,
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45), transparent 70%)',
            filter: 'blur(4px)',
          }} />

          {/* INSIDE PAGE — V4Path */}
          <div style={{
            position: 'absolute', inset: 0,
            background: PAPER,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }}>
            <V4Path
              section={section}
              progress={progress}
              isUnlocked={isUnlocked}
              nextUpId={nextUpId}
              onLessonTap={onLessonTap}
              onClose={onClose}
            />
          </div>

          {/* COVER — flips on mount */}
          <div
            onClick={() => setOpen(o => !o)}
            style={{
              position: 'absolute', inset: 0, cursor: 'pointer',
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
              transform: open ? 'rotateY(-168deg)' : 'rotateY(0deg)',
              transition: 'transform 1.05s cubic-bezier(0.55, 0.05, 0.25, 1)',
              willChange: 'transform',
              zIndex: open ? 1 : 3,
              pointerEvents: open ? 'none' : 'auto',
            }}>
            {/* FRONT (kraft cover) */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translateZ(0.1px)',
              overflow: 'hidden',
              boxShadow: open
                ? '0 12px 28px rgba(0,0,0,0.35)'
                : '0 6px 16px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.06) inset',
              background: `radial-gradient(ellipse at 30% 18%, ${KRAFT_HI} 0%, ${KRAFT_MD} 50%, ${KRAFT_LO} 100%)`,
              fontFamily: TYPE_FONT, color: '#2a1d10',
            }}>
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.55, pointerEvents: 'none',
                backgroundImage: `
                  radial-gradient(circle at 18% 28%, rgba(60,40,20,0.35) 0px, transparent 1.2px),
                  radial-gradient(circle at 72% 60%, rgba(60,40,20,0.4) 0px, transparent 1.5px),
                  radial-gradient(circle at 40% 80%, rgba(255,255,255,0.15) 0px, transparent 1px),
                  radial-gradient(circle at 90% 22%, rgba(60,40,20,0.3) 0px, transparent 1.4px)`,
                backgroundSize: '8px 8px, 11px 11px, 6px 6px, 14px 14px',
              }} />
              <PhysicalEdges />
              {['12%', '46%', '80%'].map((y, i) => (
                <div key={i} style={{
                  position: 'absolute', left: 10, top: y, width: 12, height: 3,
                  background: 'linear-gradient(180deg, #d6d4cf, #8a8884)',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                  borderRadius: 1,
                }} />
              ))}
              <div style={{
                position: 'absolute', top: 32, left: 36, right: 24,
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 3 }}>EREN · POCKET</div>
                <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.75 }}>
                  NO. {String(sectionIndex).padStart(3, '0')}
                </div>
              </div>
              <div style={{
                position: 'absolute', left: 30, right: 16, top: '30%',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: STAMP_FONT, fontWeight: 700,
                  fontSize: 28, letterSpacing: 2, textTransform: 'uppercase',
                  color: '#2a1d10',
                  padding: '12px 6px',
                  border: '2.5px solid #2a1d10',
                  borderRadius: 2,
                  display: 'inline-block',
                  transform: 'rotate(-2deg)',
                  background: 'rgba(255,255,255,0.04)',
                  textShadow: '0.5px 0 0 rgba(0,0,0,0.4)',
                }}>{section.title}</div>
                <div style={{
                  fontFamily: HAND_FONT, fontSize: 26,
                  marginTop: 10, color: PEN_RED,
                  transform: 'rotate(-1deg)', display: 'inline-block',
                }}>~ {section.titleSr} ~</div>
              </div>
              <div style={{
                position: 'absolute', left: 36, right: 24, bottom: 80,
                fontSize: 9, letterSpacing: 1.5, color: '#2a1d10',
                borderTop: '1.5px solid #2a1d10', paddingTop: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>I.</span><span>SECTION {sectionIndex} of {SERBIAN_SECTIONS.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>II.</span><span>{done} / {total} LESSONS DONE</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>III.</span><span>STUDENT · EREN</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>IV.</span><span>BEOGRAD · MMXXV</span>
                </div>
              </div>
              <div style={{
                position: 'absolute', right: 18, bottom: 24,
                transform: 'rotate(-8deg)',
                border: `2px solid ${PEN_RED}`,
                color: PEN_RED,
                padding: '4px 8px 5px',
                fontFamily: STAMP_FONT, fontSize: 9, letterSpacing: 2,
                fontWeight: 700,
                opacity: 0.85,
                background: 'rgba(138,58,16,0.05)',
              }}>SRPSKI · A1</div>
              <div style={{
                position: 'absolute', left: 36, bottom: 30,
                display: 'flex', alignItems: 'center', gap: 6,
                filter: 'sepia(0.9) saturate(0.6) brightness(0.7)',
                pointerEvents: 'none',
              }}>
                <AnimatedEren px={3} />
                <span style={{ fontSize: 8, letterSpacing: 2, opacity: 0.75, color: '#2a1d10' }}>MASCOT</span>
              </div>
            </div>
            {/* BACK (ex libris) */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(0.1px)',
              background: `
                repeating-linear-gradient(180deg, transparent 0 31px, ${PAPER_LINES} 31px 32px),
                linear-gradient(180deg, #efe5c5, #e0d3a8)`,
              boxShadow: 'inset 0 0 60px rgba(80,60,20,0.15)',
            }}>
              <div style={{
                position: 'absolute', top: 80, left: 24, right: 24,
                fontFamily: SERIF_FONT,
                textAlign: 'center', color: '#3a2a18',
              }}>
                <div style={{ fontFamily: TYPE_FONT, fontSize: 10, letterSpacing: 4, opacity: 0.7 }}>EX LIBRIS</div>
                <div style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: 36, marginTop: 8 }}>Eren</div>
                <div style={{ height: 1, background: '#3a2a18', opacity: 0.4, margin: '14px auto 0', width: 80 }} />
                <div style={{ fontFamily: HAND_FONT, fontSize: 22, marginTop: 14, opacity: 0.85 }}>
                  Sveska br. {sectionIndex}
                </div>
                <div style={{ fontFamily: TYPE_FONT, fontSize: 9, letterSpacing: 2, marginTop: 20, opacity: 0.55 }}>
                  IF FOUND, RETURN TO OWNER
                </div>
              </div>
            </div>
          </div>

          {/* close-the-book button */}
          <button
            onClick={(e) => { e.stopPropagation(); playSound('ui_back'); onClose() }}
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 5,
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              border: 'none', borderRadius: 999, padding: '6px 10px',
              fontFamily: TYPE_FONT, fontSize: 10, letterSpacing: 1.5,
              cursor: 'pointer', backdropFilter: 'blur(6px)',
            }}>× shelf</button>
        </div>
      </div>
    </div>
  )
}

// ─── V4 Path — lesson list on lined paper inside the open notebook ─────────
function V4Path({ section, progress, isUnlocked, nextUpId, onLessonTap, onClose }: {
  section: Section
  progress: SerbianProgress
  isUnlocked: (id: number) => boolean
  nextUpId: number | undefined
  onLessonTap: (l: Lesson) => void
  onClose: () => void
}) {
  const units = section.unitIds.map(uid => getUnitById(uid)!).filter(Boolean)
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        repeating-linear-gradient(180deg, transparent 0 27px, ${PAPER_LINES} 27px 28px),
        ${PAPER}`,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 44, top: 0, bottom: 0, width: 1.5,
        background: 'rgba(178,34,34,0.55)',
      }} />
      {['8%', '42%', '78%'].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', left: 14, top: y,
          width: 14, height: 14, borderRadius: '50%',
          background: 'rgba(0,0,0,0.18)',
          boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.35)',
        }} />
      ))}

      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 10, right: 14, zIndex: 5,
          background: 'transparent', border: 'none', padding: '4px 6px',
          fontFamily: HAND_FONT, fontSize: 22, color: INK_SOFT,
          cursor: 'pointer',
        }}>× zatvori</button>

      <div style={{ position: 'absolute', top: 18, left: 60, right: 90 }}>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 9, letterSpacing: 3, color: INK_SOFT, opacity: 0.8 }}>
          SVESKA · LEKCIJE
        </div>
        <div style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: 28, color: INK, lineHeight: 1.05 }}>
          {section.title}
        </div>
        <div style={{
          fontFamily: HAND_FONT, fontSize: 20, color: PEN_RED,
          transform: 'rotate(-1deg)', display: 'inline-block', marginTop: 2,
        }}>
          ~ {section.titleSr} ~
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 56, right: 16,
        top: 112, bottom: 18,
        overflowY: 'auto',
        paddingRight: 8,
      }}>
        {units.map((unit, ui) => {
          const lessons = unit.lessonIds.map(id => getLessonById(id)!).filter(Boolean)
          const unitDone = lessons.filter(l => progress.completed.includes(l.id)).length
          return (
            <div key={unit.id} style={{ marginBottom: 24 }}>
              {/* Unit headline — typewriter caption + handwritten X/Y */}
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{
                  fontFamily: TYPE_FONT, fontSize: 11, letterSpacing: 2, color: INK_SOFT,
                }}>
                  UNIT {ui + 1} — {unit.title.toUpperCase()}
                </div>
                <div style={{
                  fontFamily: HAND_FONT, fontSize: 18, color: PEN_RED,
                  transform: 'rotate(-2deg)', display: 'inline-block',
                }}>
                  {unitDone}/{lessons.length}
                </div>
              </div>
              <div style={{
                height: 2, background: INK,
                marginTop: 4, marginBottom: 10,
                width: '60%',
              }} />

              {/* Numbered checkbox list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lessons.map((l, li) => {
                  const completed = progress.completed.includes(l.id)
                  const perfect = progress.perfect.includes(l.id)
                  const unlocked = isUnlocked(l.id)
                  const isNextUp = l.id === nextUpId

                  const numberColor = unlocked ? INK : PENCIL
                  const titleColor = unlocked ? INK : PENCIL
                  const subtitleColor = unlocked ? PEN_RED : PENCIL
                  const boxStroke = unlocked ? INK : PENCIL

                  return (
                    <button
                      key={l.id}
                      onClick={() => { if (unlocked) { playSound('ui_tap'); onLessonTap(l) } }}
                      disabled={!unlocked}
                      className="relative active:translate-x-[1px] transition-transform text-left"
                      style={{
                        background: 'transparent',
                        border: 'none', padding: '6px 0 6px',
                        cursor: unlocked ? 'pointer' : 'default',
                        opacity: unlocked ? 1 : 0.7,
                      }}>
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        position: 'relative',
                      }}>
                        {/* Number */}
                        <span style={{
                          fontFamily: HAND_FONT, fontWeight: 700, fontSize: 22,
                          color: numberColor,
                          minWidth: 22, lineHeight: 1.1,
                        }}>
                          {li + 1}.
                        </span>

                        {/* Hand-drawn checkbox (SVG so we can sketch it) */}
                        <span style={{
                          position: 'relative', width: 26, height: 26,
                          flexShrink: 0, marginTop: 2,
                        }}>
                          <svg width="26" height="26" viewBox="0 0 26 26" style={{ overflow: 'visible' }}>
                            <path
                              d="M 2.5 3 L 23.5 2.5 L 24 23 L 2 23.5 Z"
                              fill="none"
                              stroke={boxStroke}
                              strokeWidth={unlocked ? 2 : 1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={unlocked ? '0' : '3 3'}
                            />
                            {completed && (
                              <path
                                d="M 5 13 L 11 19 L 22 5"
                                fill="none"
                                stroke={PEN_RED}
                                strokeWidth="2.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}
                          </svg>
                        </span>

                        {/* Titles stack */}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontFamily: HAND_FONT, fontWeight: 700, fontSize: 24,
                            color: titleColor,
                            lineHeight: 1.05,
                            display: 'inline-block',
                            position: 'relative',
                          }}>
                            {l.title.toLowerCase()}
                            {completed && (
                              <span style={{
                                position: 'absolute',
                                left: -2, right: -2,
                                top: '52%',
                                height: 2,
                                background: PEN_RED,
                                transform: 'rotate(-1deg)',
                                pointerEvents: 'none',
                              }} />
                            )}
                          </span>
                          {perfect && (
                            <span style={{
                              fontFamily: HAND_FONT, fontSize: 20, color: PEN_RED,
                              marginLeft: 6, transform: 'rotate(-8deg)',
                              display: 'inline-block', lineHeight: 1,
                            }}>★</span>
                          )}
                          <span style={{
                            display: 'block',
                            fontFamily: HAND_FONT, fontSize: 16,
                            color: subtitleColor,
                            marginTop: -2,
                            lineHeight: 1.1,
                            opacity: unlocked ? 1 : 0.75,
                          }}>
                            = {l.titleSr.toLowerCase()}
                          </span>
                        </span>

                        {/* Next-up: hand-drawn red oval encircling row + Eren peeking */}
                        {isNextUp && (
                          <>
                            <svg
                              width="100%" height="100%"
                              viewBox="0 0 320 70"
                              preserveAspectRatio="none"
                              style={{
                                position: 'absolute',
                                left: -10, top: -8, right: -10, bottom: -8,
                                width: 'calc(100% + 20px)', height: 'calc(100% + 16px)',
                                pointerEvents: 'none',
                                animation: 'srNextUpBob 1.8s ease-in-out infinite',
                              }}>
                              <path
                                d="M 30 12 C 60 4, 240 2, 295 14 C 312 26, 308 56, 270 60 C 200 70, 90 68, 30 58 C 8 52, 6 22, 30 12 Z"
                                fill="none"
                                stroke={PEN_RED}
                                strokeWidth="2.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span style={{
                              position: 'absolute',
                              right: -52, top: -4,
                              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
                              pointerEvents: 'none',
                            }}>
                              <AnimatedEren px={2} />
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Eren mascot at the bottom of the page */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginTop: 8, marginBottom: 4,
        }}>
          <AnimatedEren px={3} />
          <div style={{
            fontFamily: HAND_FONT, fontSize: 18, color: PEN_RED,
            transform: 'rotate(-2deg)', marginTop: -4,
          }}>idemo!</div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAPER PRIMITIVE — every exercise renders on this.
// ═══════════════════════════════════════════════════════════════════════════
function Paper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex-1 overflow-hidden" style={{
      background: `
        repeating-linear-gradient(180deg, transparent 0 27px, ${PAPER_LINES} 27px 28px),
        ${PAPER}`,
      animation: 'srSheetIn 0.28s ease-out',
    }}>
      {/* red margin */}
      <div style={{
        position: 'absolute', left: 44, top: 0, bottom: 0, width: 1.5,
        background: 'rgba(178,34,34,0.55)',
      }} />
      {/* hole punches */}
      {['12%', '50%', '88%'].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', left: 14, top: y,
          width: 14, height: 14, borderRadius: '50%',
          background: 'rgba(0,0,0,0.18)',
          boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.35)',
        }} />
      ))}
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LESSON PLAYER — paper-themed top bar, hearts as hand-drawn ♥, red-pen
// progress bar, feedback drawer styled like a note pinned to the page.
// ═══════════════════════════════════════════════════════════════════════════
function LessonPlayer({ exercises, onExit, onFinish, onWordResult }: {
  title: string
  exercises: Exercise[]
  onExit: () => void
  onFinish: (perfect: boolean) => void
  onWordResult?: (srKey: string, en: string, correct: boolean) => void
}) {
  const [idx, setIdx] = useState(0)
  const [hearts, setHearts] = useState(HEARTS_MAX)
  const [feedback, setFeedback] = useState<null | { ok: boolean; correctText?: string }>(null)
  const [exitConfirm, setExitConfirm] = useState(false)
  const heartsLostRef = useRef(0)
  const [requeuedCount, setRequeuedCount] = useState(0)

  // ─── Reactive Sketch-Pen Eren state machine ──────────────────────────
  // Tracks running tallies of right/wrong answers so each submission can
  // roll a context-appropriate reaction from the 26-state set. The state
  // is *decided* in `handleAnswer` (one random pick per submission), not
  // recomputed every render — otherwise re-renders would re-roll the
  // animation while the feedback drawer is open.
  const correctRunRef = useRef(0)
  const wrongRunRef = useRef(0)
  const totalCorrectRef = useRef(0)
  const totalWrongRef = useRef(0)
  const [lessonErenState, setLessonErenState] = useState<SketchErenState>('wave')

  function pickFrom<T>(pool: T[]): T {
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function pickReaction(ok: boolean, heartsAfter: number): SketchErenState {
    if (ok) {
      totalCorrectRef.current += 1
      const newRun = correctRunRef.current + 1

      // First-ever correct in the lesson → the simple, expected "happy".
      if (totalCorrectRef.current === 1) return 'happy'

      // The answer that just *enters* a streak (third in a row) — big
      // "we did it!" moment. Distinct from the on-going streak look.
      if (newRun === 3) return pickFrom<SketchErenState>(['eureka', 'cheer', 'wow'])

      // Already mid-streak: lean heavily on the fire-crown 'streak' state
      // but occasionally surprise with flex / magic / rocket so it isn't
      // visually frozen.
      if (newRun >= 4) {
        return pickFrom<SketchErenState>([
          'streak', 'streak', 'streak',
          'flex', 'magic', 'rocket',
        ])
      }

      // 2nd correct (post-1st or recovering after wrong): playful variety.
      return pickFrom<SketchErenState>([
        'happy', 'wink', 'love', 'cheer',
        'dance', 'wow', 'magic', 'eureka',
      ])
    } else {
      totalWrongRef.current += 1
      const wasOnStreak = correctRunRef.current >= 3
      const newWrongRun = wrongRunRef.current + 1

      // First-ever wrong → simple, expected "sad".
      if (totalWrongRef.current === 1) return 'sad'

      // Out of hearts after this mistake — the dedicated out-of-hearts
      // screen already renders a big cry Eren, but the floating one
      // should also read as devastated for the brief moment before that
      // screen takes over.
      if (heartsAfter <= 0) return 'cry'

      // Just lost a 3+ correct streak — exaggerated reaction.
      if (wasOnStreak) {
        return pickFrom<SketchErenState>(['cry', 'gasp', 'cry', 'shy'])
      }

      // Two or more wrong in a row — frustration variety.
      if (newWrongRun >= 2) {
        return pickFrom<SketchErenState>(['confused', 'shrug', 'sad', 'gasp', 'tired'])
      }

      // Otherwise — mild disappointment variety.
      return pickFrom<SketchErenState>(['sad', 'confused', 'gasp', 'shrug'])
    }
  }

  const ex = exercises[idx]
  const total = exercises.length + requeuedCount
  const progressPct = Math.min(100, Math.round((idx / total) * 100))

  function handleAnswer(ok: boolean, correctText?: string) {
    if (ex && onWordResult) {
      if (ex.kind === 'mc' && ex.srKey) {
        const en = ex.promptLang === 'sr' ? ex.answer : ex.prompt
        onWordResult(ex.srKey, en, ok)
      } else if (ex.kind === 'listen') {
        onWordResult(ex.sr, ex.en, ok)
      }
    }
    if (ok) {
      playCorrect()
      const reaction = pickReaction(true, hearts)
      setLessonErenState(reaction)
      correctRunRef.current += 1
      wrongRunRef.current = 0
      setFeedback({ ok: true })
      if (ex && ex.kind === 'mc') {
        const sr = ex.promptLang === 'sr' ? ex.prompt : ex.answer
        if (sr) setTimeout(() => speakSerbian(sr), 120)
      } else if (ex && ex.kind === 'order') {
        setTimeout(() => speakSerbian(ex.sr), 120)
      }
    } else {
      playWrong()
      heartsLostRef.current++
      const heartsAfter = Math.max(0, hearts - 1)
      setHearts(heartsAfter)
      const reaction = pickReaction(false, heartsAfter)
      setLessonErenState(reaction)
      wrongRunRef.current += 1
      correctRunRef.current = 0
      setFeedback({ ok: false, correctText })
    }
  }

  function continueNext() {
    const wasOk = feedback?.ok
    setFeedback(null)
    if (!wasOk) {
      setRequeuedCount(c => c + 1)
    }
    if (idx + 1 >= exercises.length) {
      const perfect = heartsLostRef.current === 0
      if (hearts <= 0 && !wasOk) return
      onFinish(perfect)
      return
    }
    setIdx(i => i + 1)
    // Between questions — quiet, attentive look. Listening if still on a
    // streak (so the fire crown gives way to a calm "tuned-in" pose);
    // pondering otherwise. The variety here keeps long lessons from
    // feeling like the same idle pose every time.
    const idlePool: SketchErenState[] = correctRunRef.current >= 3
      ? ['listen', 'thinking', 'idle']
      : ['thinking', 'idle', 'listen', 'peek']
    setLessonErenState(pickFrom(idlePool))
  }

  const outOfHearts = hearts <= 0

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden" style={{
      background: `radial-gradient(ellipse at center, ${PAPER_DK} 0%, #aea692 100%)`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          radial-gradient(circle at 22% 18%, rgba(0,0,0,0.06), transparent 40%),
          radial-gradient(circle at 78% 82%, rgba(0,0,0,0.08), transparent 50%),
          repeating-linear-gradient(92deg, rgba(0,0,0,0.025) 0 1px, transparent 1px 3px)`,
      }} />

      {/* ─── Top bar — typewriter tab on kraft strip ─── */}
      <div className="relative z-20 flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: `linear-gradient(180deg, ${KRAFT_MD} 0%, ${KRAFT_LO} 100%)`,
        borderBottom: `2px solid ${INK}`,
        boxShadow: '0 3px 0 rgba(0,0,0,0.18)',
      }}>
        <button onClick={() => setExitConfirm(true)}
          className="active:scale-90 transition-transform"
          style={{
            background: PAPER, border: `2px solid ${INK}`,
            borderRadius: 4, padding: '4px 10px 5px',
            fontFamily: HAND_FONT, fontSize: 20, color: INK_SOFT,
            boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
            lineHeight: 1,
          }}>× zatvori</button>

        <div className="flex-1 relative" style={{
          height: 10, background: PAPER_DK,
          border: `1.5px solid ${INK}`,
          borderRadius: 4, overflow: 'hidden',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)',
        }}>
          <div style={{
            width: `${progressPct}%`,
            height: '100%', background: PEN_RED,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
            transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1,2,3,4,5].map(i => (
            <span key={i} style={{
              fontFamily: HAND_FONT, fontSize: 22,
              color: i <= hearts ? PEN_RED : PENCIL,
              transform: `rotate(${(i-3)*5}deg)`, display: 'inline-block',
              lineHeight: 1,
            }}>♥</span>
          ))}
        </div>
      </div>

      {/* ─── Exercise area ─── */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {!outOfHearts && ex && (
          <ExerciseSurface
            key={`${idx}`}
            exercise={ex}
            disabled={feedback !== null}
            onAnswer={handleAnswer}
          />
        )}

        {/* ─── Persistent Sketch-Pen Eren — reacts live to every answer.
            z-index sits above Paper (which is z-10) so he's visible on the
            lined sheet; he ducks behind the feedback drawer (z-30) so the
            answer text takes the stage. He moves UP and shrinks when the
            current exercise has a CheckButton at the bottom (mc/order/listen
            — Pairs auto-completes and has no button), so he never sits on
            top of the submit button. */}
        {!outOfHearts && ex && (() => {
          const hasButton = ex.kind === 'mc' || ex.kind === 'order' || ex.kind === 'listen'
          return (
            <div style={{
              position: 'absolute',
              bottom: hasButton ? 96 : 6,
              left: '50%', transform: 'translateX(-50%)',
              zIndex: 15, pointerEvents: 'none',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.18))',
            }}>
              <SketchEren state={lessonErenState} size={hasButton ? 92 : 130} transparent noSpeech />
            </div>
          )
        })()}

        {outOfHearts && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center" style={{
            background: PAPER,
          }}>
            <div style={{ width: 140, height: 154 }}>
              <SketchEren state="cry" size={140} transparent noSpeech />
            </div>
            <div style={{
              fontFamily: HAND_FONT, fontWeight: 700, fontSize: 56,
              color: PEN_RED, transform: 'rotate(-3deg)',
            }}>♥ × 0</div>
            <p style={{
              fontFamily: TYPE_FONT, fontSize: 11, letterSpacing: 2,
              color: INK_SOFT,
            }}>OUT OF HEARTS</p>
            <p style={{
              fontFamily: HAND_FONT, fontSize: 22, color: INK,
              maxWidth: 280, lineHeight: 1.15,
            }}>
              Don&apos;t worry — try again. Mistakes are part of learning!
            </p>
            <div className="flex gap-3">
              <button onClick={onExit}
                style={{
                  background: PAPER, border: `2px solid ${INK}`,
                  borderRadius: 4, padding: '8px 14px 10px',
                  fontFamily: HAND_FONT, fontWeight: 700, fontSize: 22, color: INK,
                  boxShadow: `0 4px 0 ${INK}`,
                }}>back</button>
              <button onClick={() => {
                  setIdx(0); setHearts(HEARTS_MAX); heartsLostRef.current = 0; setRequeuedCount(0); setFeedback(null)
                  correctRunRef.current = 0; wrongRunRef.current = 0
                  totalCorrectRef.current = 0; totalWrongRef.current = 0
                  setLessonErenState('wave')
                }}
                style={{
                  background: PEN_RED, border: `2px solid ${PEN_RED_DK}`,
                  borderRadius: 4, padding: '8px 14px 10px',
                  fontFamily: HAND_FONT, fontWeight: 700, fontSize: 22, color: PAPER,
                  boxShadow: `0 4px 0 ${PEN_RED_DK}`,
                }}>try again</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Feedback drawer — looks like a note pinned to the page ─── */}
      {feedback && !outOfHearts && (
        <div className="relative z-30 flex-shrink-0 px-4 py-4" style={{
          background: feedback.ok ? '#e8f5dd' : '#fde7e1',
          borderTop: `2px solid ${feedback.ok ? '#2e6b1d' : PEN_RED_DK}`,
          boxShadow: '0 -6px 18px rgba(0,0,0,0.15)',
          animation: 'srFbSlide 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* paperclip tape */}
          <div style={{
            position: 'absolute', top: -10, left: '40%',
            width: 70, height: 16,
            background: 'rgba(252,240,140,0.85)',
            border: '1px solid rgba(0,0,0,0.1)',
            transform: 'rotate(-2deg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
          }} />
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div style={{
                fontFamily: HAND_FONT, fontWeight: 700, fontSize: 24,
                color: feedback.ok ? '#2e6b1d' : PEN_RED,
                transform: 'rotate(-1deg)', display: 'inline-block',
                lineHeight: 1.05,
              }}>
                {feedback.ok ? 'odlično!' : 'pokušaj opet'}
              </div>
              {!feedback.ok && feedback.correctText && (
                <div style={{
                  fontFamily: HAND_FONT, fontSize: 18, color: INK,
                }}>
                  answer: <strong style={{ color: PEN_RED }}>{feedback.correctText}</strong>
                </div>
              )}
            </div>
            <button onClick={continueNext}
              className="active:translate-y-[1px]"
              style={{
                background: feedback.ok ? '#3a8228' : PEN_RED,
                color: PAPER,
                border: `2px solid ${feedback.ok ? '#1f4a14' : PEN_RED_DK}`,
                borderRadius: 4,
                padding: '8px 16px 10px',
                fontFamily: HAND_FONT, fontWeight: 700, fontSize: 22, letterSpacing: 1,
                boxShadow: `0 4px 0 ${feedback.ok ? '#1f4a14' : PEN_RED_DK}`,
                transform: 'rotate(-0.5deg)',
              }}>
              dalje →
            </button>
          </div>
        </div>
      )}

      {/* ─── Exit confirm modal ─── */}
      {exitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="flex flex-col items-center gap-3 px-5 py-5 max-w-[320px] text-center"
            style={{
              background: PAPER, border: `2px solid ${INK}`,
              boxShadow: `0 6px 0 ${INK}, 0 14px 24px rgba(0,0,0,0.25)`,
              borderRadius: 4,
              transform: 'rotate(-1deg)',
            }}>
            <p style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: 30, color: INK }}>
              quit lesson?
            </p>
            <p style={{ fontFamily: HAND_FONT, fontSize: 20, color: INK_SOFT, lineHeight: 1.15 }}>
              You&apos;ll lose your progress on this page.
            </p>
            <div className="flex gap-2 mt-1">
              <button onClick={() => setExitConfirm(false)}
                style={{
                  background: PEN_RED, color: PAPER,
                  border: `2px solid ${PEN_RED_DK}`, borderRadius: 4,
                  padding: '8px 14px 10px',
                  fontFamily: HAND_FONT, fontWeight: 700, fontSize: 20,
                  boxShadow: `0 4px 0 ${PEN_RED_DK}`,
                }}>keep going</button>
              <button onClick={() => { setExitConfirm(false); onExit() }}
                style={{
                  background: PAPER, color: INK,
                  border: `2px solid ${INK}`, borderRadius: 4,
                  padding: '8px 14px 10px',
                  fontFamily: HAND_FONT, fontWeight: 700, fontSize: 20,
                  boxShadow: `0 4px 0 ${INK}`,
                }}>quit</button>
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
  if (exercise.kind === 'mc')     return <MCExercise     ex={exercise} disabled={disabled} onAnswer={onAnswer} />
  if (exercise.kind === 'pairs')  return <PairsExercise  ex={exercise} disabled={disabled} onAnswer={onAnswer} />
  if (exercise.kind === 'listen') return <ListenExercise ex={exercise} disabled={disabled} onAnswer={onAnswer} />
  return <OrderExercise ex={exercise} disabled={disabled} onAnswer={onAnswer} />
}

// ─── Shared "provjeri ✓" red-pen submit button ─────────────────────────────
function CheckButton({ disabled, onClick, label = 'provjeri ✓' }: {
  disabled?: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="active:translate-y-[2px] transition-all disabled:opacity-40"
      style={{
        width: '100%', padding: '12px 0 14px',
        background: PEN_RED, color: '#fff8e8',
        border: `2px solid ${PEN_RED_DK}`,
        fontFamily: HAND_FONT, fontWeight: 700, fontSize: 26, letterSpacing: 1.5,
        boxShadow: `0 4px 0 ${PEN_RED_DK}, 0 8px 18px rgba(0,0,0,0.15)`,
        borderRadius: 4,
        transform: 'rotate(-0.6deg)',
      }}>{label}</button>
  )
}

// ─── Multiple choice translate — paper aesthetic ───────────────────────────
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
    onAnswer(selected === ex.answer, ex.answer)
  }

  return (
    <Paper>
      <div style={{ position: 'absolute', top: 18, left: 60, right: 18 }}>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 10, letterSpacing: 3, color: INK_SOFT, opacity: 0.8 }}>
          PREVEDI · TRANSLATE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          {ex.promptLang === 'sr' && <SpeakerButton text={ex.prompt} size={34} />}
          <div style={{
            fontFamily: HAND_FONT, fontWeight: 700,
            fontSize: ex.prompt.length > 18 ? 28 : 34,
            color: INK, lineHeight: 1.05,
          }}>&quot;{ex.prompt}&quot;</div>
        </div>
        {ex.pronunciation && (
          <div style={{
            fontFamily: TYPE_FONT, fontSize: 11, color: INK_SOFT,
            marginTop: 4, fontStyle: 'italic',
          }}>/{ex.pronunciation}/</div>
        )}
      </div>

      <div style={{
        position: 'absolute', top: 170, left: 56, right: 18, bottom: 200,
        overflowY: 'auto', paddingRight: 4,
      }}>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 9, letterSpacing: 3, color: INK_SOFT, opacity: 0.6, marginBottom: 10 }}>
          {ex.promptLang === 'sr' ? 'PICK THE TRANSLATION' : 'PICK THE SERBIAN'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ex.options.map((opt, i) => {
            const isSel = selected === opt
            const isCorrect = submitted && opt === ex.answer
            const isWrongPick = submitted && isSel && opt !== ex.answer
            const rot = [-2, 1.5, -1, 2.5][i % 4]
            return (
              <button key={opt}
                disabled={disabled || submitted}
                onClick={() => setSelected(opt)}
                className="active:translate-y-[1px] transition-all"
                style={{
                  padding: '10px 12px 12px',
                  background: isCorrect
                    ? '#e8f5dd'
                    : isWrongPick
                      ? '#fde7e1'
                      : isSel
                        ? '#fff7c2'
                        : '#fffbe6',
                  transform: `rotate(${rot}deg)`,
                  border: `${isSel || isCorrect || isWrongPick ? 2 : 1}px ${isSel || isCorrect || isWrongPick ? 'solid' : 'dashed'} ${
                    isCorrect ? '#2e6b1d' : isWrongPick ? PEN_RED : isSel ? PEN_RED : 'rgba(0,0,0,0.25)'
                  }`,
                  boxShadow: isCorrect
                    ? '0 4px 0 rgba(46,107,29,0.55), 0 6px 12px rgba(0,0,0,0.1)'
                    : isWrongPick
                      ? `0 4px 0 ${PEN_RED_DK}, 0 6px 12px rgba(0,0,0,0.1)`
                      : isSel
                        ? `0 4px 0 ${PEN_RED}, 0 6px 12px rgba(0,0,0,0.1)`
                        : '0 3px 0 rgba(0,0,0,0.18), 0 6px 10px rgba(0,0,0,0.08)',
                  fontFamily: HAND_FONT, fontWeight: 700,
                  fontSize: ex.promptLang === 'sr' ? 22 : 22,
                  color: INK,
                  textAlign: 'center',
                  minHeight: 60,
                  cursor: disabled || submitted ? 'default' : 'pointer',
                }}>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 56, right: 18, bottom: 24 }}>
        <CheckButton
          disabled={disabled || submitted || selected === null}
          onClick={handleSubmit}
        />
      </div>
    </Paper>
  )
}

// ─── Match pairs — paper aesthetic ─────────────────────────────────────────
function PairsExercise({ ex, disabled, onAnswer }: {
  ex: Extract<Exercise, { kind: 'pairs' }>
  disabled: boolean
  onAnswer: (ok: boolean, correctText?: string) => void
}) {
  const [srOrder] = useState(() => ex.pairs.map((_, i) => i).sort(() => Math.random() - 0.5))
  const [enOrder] = useState(() => ex.pairs.map((_, i) => i).sort(() => Math.random() - 0.5))

  const [pickedSr, setPickedSr] = useState<number | null>(null)
  const [pickedEn, setPickedEn] = useState<number | null>(null)
  const [matched, setMatched] = useState<number[]>([])
  const [wrongFlash, setWrongFlash] = useState<{ sr: number; en: number } | null>(null)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (pickedSr !== null && pickedEn !== null) {
      if (pickedSr === pickedEn) {
        playCorrect()
        const matchedIdx = pickedSr
        setMatched(m => [...m, matchedIdx])
        setPickedSr(null); setPickedEn(null)
        if (matched.length + 1 === ex.pairs.length && !finishedRef.current) {
          finishedRef.current = true
          setTimeout(() => onAnswer(true), 380)
        }
      } else {
        playWrong()
        setWrongFlash({ sr: pickedSr, en: pickedEn })
        setTimeout(() => {
          setWrongFlash(null)
          setPickedSr(null); setPickedEn(null)
        }, 380)
      }
    }
  }, [pickedSr, pickedEn]) // eslint-disable-line react-hooks/exhaustive-deps

  function tileStyle(state: { isMatched: boolean; isPicked: boolean; isWrong: boolean }, rot: number) {
    const { isMatched, isPicked, isWrong } = state
    return {
      padding: '8px 10px 10px',
      background: isMatched
        ? '#e8f5dd'
        : isWrong
          ? '#fde7e1'
          : isPicked
            ? '#fff7c2'
            : '#fffbe6',
      border: `${isMatched || isWrong || isPicked ? 2 : 1}px ${isMatched || isWrong || isPicked ? 'solid' : 'dashed'} ${
        isMatched ? '#2e6b1d' : isWrong ? PEN_RED : isPicked ? PEN_RED : 'rgba(0,0,0,0.25)'
      }`,
      boxShadow: isMatched
        ? '0 3px 0 rgba(46,107,29,0.55)'
        : isWrong
          ? `0 3px 0 ${PEN_RED_DK}`
          : isPicked
            ? `0 4px 0 ${PEN_RED}`
            : '0 3px 0 rgba(0,0,0,0.18), 0 6px 10px rgba(0,0,0,0.08)',
      fontFamily: HAND_FONT, fontWeight: 700, fontSize: 22,
      color: INK, textAlign: 'center' as const,
      transform: `rotate(${rot}deg)`,
      opacity: isMatched ? 0.55 : 1,
      cursor: isMatched ? 'default' : 'pointer',
      minHeight: 50,
      lineHeight: 1.1,
    }
  }

  return (
    <Paper>
      <div style={{ position: 'absolute', top: 18, left: 60, right: 18 }}>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 10, letterSpacing: 3, color: INK_SOFT, opacity: 0.8 }}>
          POVEŽI · MATCH PAIRS
        </div>
        <div style={{
          fontFamily: HAND_FONT, fontWeight: 700, fontSize: 28,
          color: INK, marginTop: 4,
        }}>
          {matched.length}<span style={{ color: INK_SOFT }}>/{ex.pairs.length}</span>
          <span style={{ fontSize: 18, color: PEN_RED, marginLeft: 8, transform: 'rotate(-2deg)', display: 'inline-block' }}>matched</span>
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 110, left: 56, right: 18, bottom: 24,
        overflowY: 'auto', paddingRight: 4,
      }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-3">
            {srOrder.map((i, pos) => {
              const isMatched = matched.includes(i)
              const isPicked  = pickedSr === i
              const isWrong   = wrongFlash?.sr === i
              const rot = [-2.5, 1.5, -1, 2][pos % 4]
              return (
                <button key={`sr-${i}`}
                  disabled={disabled || isMatched}
                  onClick={() => {
                    if (isMatched) return
                    speakSerbian(ex.pairs[i].sr)
                    if (pickedSr === null) setPickedSr(i)
                    else if (pickedSr === i) setPickedSr(null)
                  }}
                  className="active:translate-y-[1px]"
                  style={tileStyle({ isMatched, isPicked, isWrong }, rot)}>
                  {ex.pairs[i].sr}
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-3">
            {enOrder.map((i, pos) => {
              const isMatched = matched.includes(i)
              const isPicked  = pickedEn === i
              const isWrong   = wrongFlash?.en === i
              const rot = [2, -1.5, 2.5, -2][pos % 4]
              return (
                <button key={`en-${i}`}
                  disabled={disabled || isMatched}
                  onClick={() => { if (!isMatched && pickedEn === null) setPickedEn(i); else if (pickedEn === i) setPickedEn(null) }}
                  className="active:translate-y-[1px]"
                  style={tileStyle({ isMatched, isPicked, isWrong }, rot)}>
                  {ex.pairs[i].en}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Paper>
  )
}

// ─── Word order — torn-paper tile bank + handwritten answer line ───────────
function OrderExercise({ ex, disabled, onAnswer }: {
  ex: Extract<Exercise, { kind: 'order' }>
  disabled: boolean
  onAnswer: (ok: boolean, correctText?: string) => void
}) {
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
    onAnswer(built.trim().toLowerCase() === ex.sr.trim().toLowerCase(), ex.sr)
  }

  return (
    <Paper>
      <div style={{ position: 'absolute', top: 18, left: 60, right: 18 }}>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 10, letterSpacing: 3, color: INK_SOFT, opacity: 0.8 }}>
          PREVEDI · TRANSLATE
        </div>
        <div style={{
          fontFamily: HAND_FONT, fontWeight: 700, fontSize: 32,
          color: INK, lineHeight: 1.05, marginTop: 6,
        }}>&quot;{ex.english}&quot;</div>
      </div>

      {/* Answer line — handwritten on the rule */}
      <div style={{
        position: 'absolute', top: 130, left: 56, right: 18,
        minHeight: 80,
        borderBottom: `2px solid ${INK}`,
        paddingBottom: 8,
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end',
      }}>
        {answer.length === 0 && (
          <span style={{
            fontFamily: HAND_FONT, fontSize: 22, color: PENCIL,
            transform: 'rotate(-2deg)', display: 'inline-block',
          }}>tap words below…</span>
        )}
        {answer.map((i, pos) => (
          <button key={`ans-${i}`}
            onClick={() => pickFromAnswer(i)}
            disabled={submitted}
            style={{
              padding: '4px 12px 6px',
              background: '#fff7c2',
              border: `1px dashed rgba(0,0,0,0.25)`,
              fontFamily: HAND_FONT, fontWeight: 700, fontSize: 26,
              color: INK,
              transform: `rotate(${[-2, 1, -1, 2, -1.5, 1.5][pos % 6]}deg)`,
              boxShadow: '0 2px 0 rgba(0,0,0,0.15), 0 4px 8px rgba(0,0,0,0.08)',
              cursor: submitted ? 'default' : 'pointer',
            }}>
            {ex.tiles[i]}
          </button>
        ))}
      </div>

      {/* Bank */}
      <div style={{
        position: 'absolute', top: 250, left: 56, right: 18, bottom: 200,
        overflowY: 'auto', paddingRight: 4,
      }}>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 9, letterSpacing: 3, color: INK_SOFT, opacity: 0.6, marginBottom: 8 }}>
          WORD BANK
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {bank.map((i, pos) => (
            <button key={`bank-${i}`}
              onClick={() => pickFromBank(i)}
              disabled={submitted || disabled}
              style={{
                padding: '6px 14px 8px',
                background: pos === 0 ? '#fff7c2' : '#fffbe6',
                transform: `rotate(${[-3, 2, -1, 4, -2, 1, 3, -1.5][pos % 8]}deg)`,
                boxShadow: '0 2px 0 rgba(0,0,0,0.15), 0 6px 10px rgba(0,0,0,0.08)',
                border: '1px dashed rgba(0,0,0,0.25)',
                fontFamily: HAND_FONT, fontSize: 26, color: INK,
                fontWeight: 700,
                cursor: submitted || disabled ? 'default' : 'pointer',
              }}>
              {ex.tiles[i]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 56, right: 18, bottom: 24 }}>
        <CheckButton
          disabled={disabled || submitted || answer.length === 0}
          onClick={handleSubmit}
        />
      </div>
    </Paper>
  )
}

// ─── Listen — paper aesthetic, big paper-stamp speaker hero ────────────────
function ListenExercise({ ex, disabled, onAnswer }: {
  ex: Extract<Exercise, { kind: 'listen' }>
  disabled: boolean
  onAnswer: (ok: boolean, correctText?: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    speakSerbian(ex.sr)
  }, [ex])

  function handleSubmit() {
    if (selected === null || submitted) return
    setSubmitted(true)
    onAnswer(selected === ex.sr, ex.sr)
  }

  return (
    <Paper>
      <div style={{ position: 'absolute', top: 18, left: 60, right: 18 }}>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 10, letterSpacing: 3, color: INK_SOFT, opacity: 0.8 }}>
          SLUŠAJ · LISTEN
        </div>
        <div style={{
          fontFamily: HAND_FONT, fontWeight: 700, fontSize: 28,
          color: INK, marginTop: 4,
        }}>What do you hear?</div>
      </div>

      <div style={{
        position: 'absolute', top: 110, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <button onClick={() => speakSerbian(ex.sr)}
          className="active:translate-y-[2px] transition-all"
          style={{
            width: 110, height: 110,
            background: PAPER,
            border: `3px solid ${INK}`,
            borderRadius: '50%',
            boxShadow: `0 6px 0 ${INK}, 0 12px 24px rgba(0,0,0,0.18)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Volume2 size={56} style={{ color: INK }} />
        </button>
      </div>
      <div style={{
        position: 'absolute', top: 230, left: 0, right: 0,
        textAlign: 'center',
        fontFamily: HAND_FONT, fontSize: 18, color: PEN_RED,
        transform: 'rotate(-2deg)',
      }}>tap to replay</div>

      <div style={{
        position: 'absolute', top: 270, left: 56, right: 18, bottom: 200,
        overflowY: 'auto', paddingRight: 4,
      }}>
        <div className="grid grid-cols-2 gap-3">
          {ex.options.map((opt, i) => {
            const isSel = selected === opt
            const isCorrect = submitted && opt === ex.sr
            const isWrongPick = submitted && isSel && opt !== ex.sr
            const rot = [-2, 1.5, -1, 2.5][i % 4]
            return (
              <button key={opt}
                disabled={disabled || submitted}
                onClick={() => { setSelected(opt); speakSerbian(opt) }}
                className="active:translate-y-[1px]"
                style={{
                  padding: '10px 12px 12px',
                  background: isCorrect
                    ? '#e8f5dd'
                    : isWrongPick
                      ? '#fde7e1'
                      : isSel
                        ? '#fff7c2'
                        : '#fffbe6',
                  transform: `rotate(${rot}deg)`,
                  border: `${isSel || isCorrect || isWrongPick ? 2 : 1}px ${isSel || isCorrect || isWrongPick ? 'solid' : 'dashed'} ${
                    isCorrect ? '#2e6b1d' : isWrongPick ? PEN_RED : isSel ? PEN_RED : 'rgba(0,0,0,0.25)'
                  }`,
                  boxShadow: isCorrect
                    ? '0 4px 0 rgba(46,107,29,0.55)'
                    : isWrongPick
                      ? `0 4px 0 ${PEN_RED_DK}`
                      : isSel
                        ? `0 4px 0 ${PEN_RED}`
                        : '0 3px 0 rgba(0,0,0,0.18), 0 6px 10px rgba(0,0,0,0.08)',
                  fontFamily: HAND_FONT, fontWeight: 700, fontSize: 22,
                  color: INK,
                  textAlign: 'center',
                  minHeight: 60,
                  cursor: disabled || submitted ? 'default' : 'pointer',
                }}>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 56, right: 18, bottom: 24 }}>
        <CheckButton
          disabled={disabled || submitted || selected === null}
          onClick={handleSubmit}
        />
      </div>
    </Paper>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE SCREEN — paper page with a red "savršeno!" stamp and gold confetti
// ═══════════════════════════════════════════════════════════════════════════
function CompleteScreen({ title, xp, streak, streakIncreased, onContinue }: {
  title: string
  xp: number
  streak: number
  streakIncreased: boolean
  onContinue: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6"
      style={{
        background: `radial-gradient(ellipse at center, ${PAPER_DK} 0%, #aea692 100%)`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i * 13) % 100}%`,
            top: -20,
            width: 6, height: 10,
            background: [PEN_RED, '#FBBF24', '#3a8228', INK, KRAFT_MD][i % 5],
            animation: `srConfetti ${1.5 + (i % 5) * 0.4}s linear ${(i * 0.05)}s infinite`,
          }} />
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-3 px-6 py-6 max-w-[340px] text-center"
        style={{
          background: PAPER,
          border: `2px solid ${INK}`,
          boxShadow: `0 6px 0 ${INK}, 0 14px 24px rgba(0,0,0,0.25)`,
          borderRadius: 4,
          transform: 'rotate(-1deg)',
          animation: 'srFinishPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
        {/* paperclip tape */}
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%) rotate(-3deg)',
          width: 80, height: 16,
          background: 'rgba(252,240,140,0.85)',
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
        }} />

        <div style={{ width: 130, height: 144, marginTop: -8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SketchEren state="grad" size={130} transparent noSpeech />
        </div>

        <div style={{
          fontFamily: STAMP_FONT, fontWeight: 700,
          fontSize: 18, letterSpacing: 2, textTransform: 'uppercase',
          color: PEN_RED,
          padding: '6px 14px',
          border: `2.5px solid ${PEN_RED}`,
          borderRadius: 2,
          display: 'inline-block',
          transform: 'rotate(-2deg)',
          background: 'rgba(178,34,34,0.05)',
        }}>SAVRŠENO</div>

        <div style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: 28, color: INK, lineHeight: 1.05 }}>
          {title}
        </div>
        <div style={{ fontFamily: TYPE_FONT, fontSize: 9, letterSpacing: 2, color: INK_SOFT }}>
          LESSON · COMPLETE
        </div>

        {streakIncreased && (
          <div className="mt-1 px-3 py-1.5 inline-flex items-center gap-1.5"
            style={{
              background: PEN_RED,
              border: `2px solid ${PEN_RED_DK}`,
              borderRadius: 4,
              boxShadow: `0 3px 0 ${PEN_RED_DK}`,
              animation: 'srStreakPop 0.6s 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
              transform: 'rotate(-2deg)',
            }}>
            <Flame size={14} style={{ color: '#FFE4B0' }} fill="currentColor" />
            <span style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: 20, color: '#FFE4B0', letterSpacing: 0.5 }}>
              {streak} day streak!
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-2">
          <div className="px-4 py-2 flex flex-col items-center"
            style={{
              background: '#fff7c2', border: `1px dashed ${INK_SOFT}`,
              transform: 'rotate(-2deg)',
              boxShadow: '0 3px 0 rgba(0,0,0,0.15)',
            }}>
            <span style={{ fontFamily: TYPE_FONT, fontSize: 8, letterSpacing: 2, color: INK_SOFT }}>XP</span>
            <span style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: 28, color: PEN_RED }}>+{xp}</span>
          </div>
          <div className="px-4 py-2 flex flex-col items-center"
            style={{
              background: '#fffbe6', border: `1px dashed ${INK_SOFT}`,
              transform: 'rotate(2deg)',
              boxShadow: '0 3px 0 rgba(0,0,0,0.15)',
            }}>
            <span style={{ fontFamily: TYPE_FONT, fontSize: 8, letterSpacing: 2, color: INK_SOFT }}>COINS</span>
            <span style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: 28, color: INK }}>+6</span>
          </div>
        </div>
        <button onClick={() => { playSound('ui_tap'); onContinue() }}
          className="mt-3 active:translate-y-[2px] transition-transform"
          style={{
            background: PEN_RED, color: PAPER,
            border: `2px solid ${PEN_RED_DK}`,
            borderRadius: 4,
            padding: '12px 26px 14px',
            fontFamily: HAND_FONT, fontWeight: 700, fontSize: 24, letterSpacing: 1,
            boxShadow: `0 4px 0 ${PEN_RED_DK}`,
            transform: 'rotate(-0.6deg)',
          }}>
          dalje →
        </button>
      </div>

      <style jsx global>{`
        @keyframes srFinishPop {
          0%   { transform: scale(0.6) rotate(-1deg); opacity: 0; }
          100% { transform: scale(1)   rotate(-1deg); opacity: 1; }
        }
        @keyframes srConfetti {
          0%   { transform: translateY(-30px) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(720deg); }
        }
        @keyframes srStreakPop {
          0%   { transform: scale(0.4) rotate(-2deg); opacity: 0; }
          100% { transform: scale(1)   rotate(-2deg); opacity: 1; }
        }
        @keyframes srErenCelebrate {
          0%, 100% { transform: translateY(0)    scale(1); }
          25%      { transform: translateY(-6px) scale(1.06) rotate(-3deg); }
          50%      { transform: translateY(0)    scale(1)    rotate(0deg); }
          75%      { transform: translateY(-4px) scale(1.04) rotate(3deg); }
        }
      `}</style>
    </div>
  )
}
