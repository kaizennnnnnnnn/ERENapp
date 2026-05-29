'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserMood, ErenMood } from '@/types'
import { MOOD_CONFIGS } from '@/types'
import { cn } from '@/lib/utils'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'
import SketchEren, { type SketchErenState } from '@/components/SketchEren'
import { MOOD_SKETCH as MOOD_SKETCH_PILL, MOOD_THEME, PUSH_MOODS } from '@/lib/moods'

// Each user mood maps to a pool of picked animations + speech lines. One is
// chosen at random each time so the reaction feels fresh. The mood→pill pose
// (MOOD_SKETCH_PILL) and the per-mood palette (MOOD_THEME) come from
// @/lib/moods so the couple-page partner card stays in sync.
const MOOD_REACTIONS: Record<UserMood, { picked: SketchErenState; line: string }[]> = {
  good: [
    { picked: 'party',  line: 'Purrrfect!' },
    { picked: 'cheer',  line: 'Yay! Let\'s go!' },
    { picked: 'dance',  line: 'Happy dance time!' },
    { picked: 'love',   line: 'Eren loves you!' },
    { picked: 'proud',  line: 'That\'s the spirit!' },
    { picked: 'kiss',   line: 'Mwah! Great day!' },
    { picked: 'trophy', line: 'You\'re a champion!' },
    { picked: 'flex',   line: 'Feeling strong!' },
  ],
  mid: [
    { picked: 'wave',     line: 'Eren is here for you!' },
    { picked: 'chill',    line: 'Just vibin\' today' },
    { picked: 'shrug',    line: 'Meh, we got this' },
    { picked: 'wink',     line: 'Could be worse!' },
    { picked: 'nom',      line: 'Snack break?' },
    { picked: 'listen',   line: 'Eren\'s listening...' },
    { picked: 'meditate', line: 'Stay calm, stay cool' },
  ],
  sad: [
    { picked: 'cry',  line: 'Come cuddle with Eren' },
    { picked: 'sad',  line: 'Eren feels it too...' },
    { picked: 'pet',  line: 'Soft pats for you' },
    { picked: 'love', line: 'Eren loves you always' },
    { picked: 'bow',  line: 'It\'s okay to be sad' },
    { picked: 'shy',  line: 'Eren\'s here, promise' },
  ],
  angry: [
    { picked: 'angry', line: 'Eren is grumpy too!' },
    { picked: 'flex',  line: 'RAWR! Let it out!' },
    { picked: 'gasp',  line: 'Who made you mad?!' },
    { picked: 'wow',   line: 'Oh no... deep breaths!' },
    { picked: 'proud', line: 'Anger is power, rawr!' },
    { picked: 'silly', line: 'Hiss! Then laugh it off' },
  ],
  tired: [
    { picked: 'yawn',     line: 'Nap time together' },
    { picked: 'sleeping', line: 'Zzz... five more mins' },
    { picked: 'tired',    line: 'Eren is sleepy too...' },
    { picked: 'meditate', line: 'Rest your eyes...' },
    { picked: 'chill',    line: 'Take it easy today' },
    { picked: 'nom',      line: 'Coffee? Tea? Milk?' },
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Maps user mood → Eren's reaction mood
const MOOD_TO_EREN: Record<UserMood, ErenMood> = {
  good:  'happy',
  mid:   'idle',
  sad:   'hungry',
  angry: 'angry',
  tired: 'sleepy',
}

interface Props {
  userId: string
  userName: string
  householdId: string | null
  onDone: (mood: UserMood) => void
}

export default function MoodGate({ userId, userName, householdId, onDone }: Props) {
  const supabase = createClient()
  const { completeTask } = useTasks()
  const [selected, setSelected]   = useState<UserMood | null>(null)
  const [reaction, setReaction]   = useState<{ picked: SketchErenState; line: string } | null>(null)
  const [animating, setAnimating] = useState(false)
  const [, setErenMood]   = useState<ErenMood>('happy')

  async function handleSelect(mood: UserMood) {
    if (animating) return
    const r = pickRandom(MOOD_REACTIONS[mood])
    setSelected(mood)
    setReaction(r)
    setErenMood(MOOD_TO_EREN[mood])
    setAnimating(true)

    const today = new Date().toISOString().split('T')[0]

    // Save to DB and animate concurrently — wait for BOTH before closing
    await Promise.all([
      supabase
        .from('daily_moods')
        .upsert({ user_id: userId, mood, date: today }, { onConflict: 'user_id,date' }),
      new Promise(r => setTimeout(r, 2000)),
    ])

    // Cache locally so navigating back never re-shows the gate
    localStorage.setItem(`pocket_eren_mood_${userId}_${today}`, mood)
    completeTask('daily_mood')

    // Low-mood alert: let the partner know they might want to send some love.
    // Fire-and-forget; the endpoint respects the partner's opt-in.
    if (householdId && PUSH_MOODS.includes(mood)) {
      fetch('/api/notify-mood', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ household_id: householdId, sender_id: userId, sender_name: userName, mood }),
      }).catch(() => { /* best-effort */ })
    }

    onDone(mood)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden"
      style={{
        // Richer warm gradient — was a flat pale pink wash; now a deeper
        // lavender → pink → warm cream that gives the screen real depth.
        background: 'radial-gradient(ellipse at top, #FCE7F3 0%, #F3E8FF 35%, #EDE9FE 70%, #FAE8FF 100%)',
      }}>

      {/* ── Drifting sparkle field — two-layer pattern animated 32-s loop. */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(167,139,250,0.55) 1px, transparent 1.5px), radial-gradient(circle, rgba(244,114,182,0.45) 1px, transparent 1.5px)',
        backgroundSize: '38px 38px, 56px 56px',
        backgroundPosition: '0 0, 22px 28px',
        animation: 'mgStarDrift 32s linear infinite',
        opacity: 0.65,
      }} />

      {/* ── Soft vignette so the corners darken into focus. */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(91,33,182,0.18) 100%)',
      }} />

      {/* ── Corner sparkles (gold) ── */}
      <span className="absolute top-6 left-6 text-2xl pointer-events-none" style={{ color: '#FBBF24', filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.6))', animation: 'twinkle 2s ease-in-out infinite' }}>✦</span>
      <span className="absolute top-10 right-8 text-base pointer-events-none" style={{ color: '#A78BFA', filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.6))', animation: 'twinkle 2.4s ease-in-out infinite 0.8s' }}>✦</span>
      <span className="absolute bottom-16 left-8 text-base pointer-events-none" style={{ color: '#F472B6', filter: 'drop-shadow(0 0 4px rgba(244,114,182,0.6))', animation: 'twinkle 2.1s ease-in-out infinite 0.4s' }}>✦</span>
      <span className="absolute bottom-12 right-6 text-xl pointer-events-none" style={{ color: '#FBBF24', filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.6))', animation: 'twinkle 1.9s ease-in-out infinite 1.2s' }}>✦</span>
      <span className="absolute top-1/3 left-4 text-lg text-pink-400 pointer-events-none" style={{ fontFamily: 'monospace', filter: 'drop-shadow(0 0 4px rgba(244,114,182,0.5))' }}>♥</span>
      <span className="absolute top-2/3 right-4 text-lg text-purple-400 pointer-events-none" style={{ fontFamily: 'monospace', filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.5))' }}>♥</span>

      {/* ── Eren — wrapped in a glowing halo + portrait frame ── */}
      <div className="flex flex-col items-center mb-6 relative z-10">
        {/* Soft halo behind Eren (animates with mgHaloPulse) */}
        <div className="absolute" style={{
          top: -8,
          width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(244,114,182,0.18) 40%, transparent 70%)',
          filter: 'blur(2px)',
          animation: 'mgHaloPulse 3s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        <div className={cn('mb-3 transition-all duration-300 relative', animating ? 'scale-110' : 'animate-float')}
          style={{
            width: 150, height: 165,
            filter: 'drop-shadow(0 6px 8px rgba(91,33,182,0.35)) drop-shadow(0 0 12px rgba(251,191,36,0.3))',
          }}>
          <SketchEren
            state={reaction ? reaction.picked : 'wave'}
            size={150}
            transparent
            noSpeech
          />
        </div>

        {/* Speech bubble — premium with gold rivets + thick pink shadow */}
        <div className="relative">
          <div className="px-5 py-2.5 min-w-[200px] text-center relative"
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7FB 100%)',
              borderRadius: 6,
              border: '2px solid #EC4899',
              boxShadow: '4px 4px 0 #DB2777, 0 0 14px rgba(244,114,182,0.5)',
            }}>
            {/* Gold rivets at corners */}
            <div style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, background: '#FBBF24', boxShadow: '0 0 3px #FBBF24' }} />
            <div style={{ position: 'absolute', top: 3, right: 3, width: 3, height: 3, background: '#FBBF24', boxShadow: '0 0 3px #FBBF24' }} />
            <div style={{ position: 'absolute', bottom: 3, left: 3, width: 3, height: 3, background: '#FBBF24', boxShadow: '0 0 3px #FBBF24' }} />
            <div style={{ position: 'absolute', bottom: 3, right: 3, width: 3, height: 3, background: '#FBBF24', boxShadow: '0 0 3px #FBBF24' }} />
            {animating && reaction ? (
              <p className="text-sm font-semibold text-[#DB2777]" style={{ animation: 'cursorBlink 0.8s steps(1) infinite' }}>
                {reaction.line}
              </p>
            ) : (
              <p className="text-sm font-medium text-gray-700">
                Good {getTimeOfDay()},{' '}
                <span className="text-[#DB2777] font-bold">{userName.split(' ')[0]}</span>!
              </p>
            )}
          </div>
          {/* Bubble tail pointing up */}
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '9px solid #EC4899' }} />
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid white' }} />
        </div>
      </div>

      {/* ── Question + mood buttons ── */}
      <div className={cn('flex flex-col items-center w-full relative z-10 transition-all duration-400',
        animating ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'
      )}>
        {/* Heading with gold-twinkle ornaments either side + layered shadow */}
        <div className="mb-5 text-center relative">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-base pointer-events-none" style={{ color: '#FBBF24', filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.7))', animation: 'twinkle 1.7s ease-in-out infinite' }}>✦</span>
            <h1 className="font-pixel" style={{
              fontSize: 11,
              lineHeight: 1.7,
              color: '#3B0764',
              textShadow: '0 1px 0 rgba(255,255,255,0.7), 0 2px 0 rgba(91,33,182,0.25), 0 0 12px rgba(167,139,250,0.4)',
              letterSpacing: 1.5,
            }}>HOW ARE<br/>YOU FEELING?</h1>
            <span className="text-base pointer-events-none" style={{ color: '#FBBF24', filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.7))', animation: 'twinkle 1.7s ease-in-out infinite 0.85s' }}>✦</span>
          </div>
          <p className="text-xs font-medium" style={{ color: '#7C3AED', letterSpacing: 0.5 }}>
            Pick your mood to enter
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {(Object.entries(MOOD_CONFIGS) as [UserMood, typeof MOOD_CONFIGS[UserMood]][]).map(([key, cfg]) => {
            const t = MOOD_THEME[key]
            const isSelected = selected === key
            return (
              <button
                key={key}
                onClick={() => { playSound('ui_tap'); handleSelect(key) }}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-3 transition-all duration-150 active:translate-y-[2px] overflow-hidden',
                )}
                style={{
                  background: isSelected
                    ? `linear-gradient(135deg, ${t.light} 0%, ${t.main}22 100%)`
                    : `linear-gradient(135deg, ${t.light} 0%, ${t.main}15 60%, ${t.light}80 100%)`,
                  borderRadius: 6,
                  border: `2.5px solid ${isSelected ? t.main : t.main}`,
                  boxShadow: isSelected
                    ? `4px 4px 0 ${t.dark}, 0 0 18px ${t.glow}`
                    : `3px 3px 0 ${t.dark}, 0 0 6px ${t.glow}`,
                }}
              >
                {/* Pixel dither overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: `radial-gradient(circle, ${t.main}18 1px, transparent 1px)`,
                  backgroundSize: '6px 6px',
                  opacity: isSelected ? 0.8 : 0.5,
                }} />

                {/* Theme-coloured strip down the left edge */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, width: 5,
                  background: `linear-gradient(180deg, ${t.main}, ${t.dark})`,
                  boxShadow: `0 0 10px ${t.glow}`,
                }} />

                {/* Gold corner rivets */}
                <div style={{ position: 'absolute', top: 3, left: 8, width: 3, height: 3, background: '#FBBF24', boxShadow: '0 0 3px #FBBF24' }} />
                <div style={{ position: 'absolute', top: 3, right: 3, width: 3, height: 3, background: '#FBBF24', boxShadow: '0 0 3px #FBBF24' }} />
                <div style={{ position: 'absolute', bottom: 3, left: 8, width: 3, height: 3, background: '#FBBF24', boxShadow: '0 0 3px #FBBF24' }} />
                <div style={{ position: 'absolute', bottom: 3, right: 3, width: 3, height: 3, background: '#FBBF24', boxShadow: '0 0 3px #FBBF24' }} />

                {/* Inner top highlight — retro screen shine */}
                <div className="absolute pointer-events-none" style={{
                  top: 0, left: 6, right: 0, height: 2,
                  background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.6) 30%, rgba(255,255,255,0.6) 70%, transparent)`,
                }} />

                {/* Sketch-Pen Eren state for this mood */}
                <div className="flex-shrink-0 flex items-center justify-center relative ml-1.5"
                  style={{ width: 42, height: 42 }}>
                  <SketchEren state={MOOD_SKETCH_PILL[key]} size={42} transparent noSpeech />
                </div>

                <div className="flex-1 text-left">
                  <span className="font-pixel block" style={{
                    fontSize: 9,
                    color: t.text,
                    letterSpacing: 1.5,
                    textShadow: `0 1px 0 rgba(255,255,255,0.7), 0 0 8px ${t.glow}`,
                  }}>
                    {cfg.label.toUpperCase()}
                  </span>
                </div>
                {/* Selected indicator */}
                {isSelected && (
                  <span className="font-pixel mr-1" style={{ fontSize: 11, color: t.main, textShadow: `0 0 6px ${t.glow}` }}>▶</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Footer ornament — gold gradient line + label */}
        <div className="mt-7 flex items-center gap-3">
          <div className="h-[2px] w-10" style={{
            background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)',
          }} />
          <p className="font-pixel" style={{
            fontSize: 6,
            color: '#7C3AED',
            letterSpacing: 2,
            opacity: 0.7,
          }}>EREN · ONCE A DAY</p>
          <div className="h-[2px] w-10" style={{
            background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)',
          }} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes mgStarDrift {
          from { background-position: 0 0, 22px 28px; }
          to   { background-position: 200px 0, 222px 28px; }
        }
        @keyframes mgHaloPulse {
          0%, 100% { transform: scale(1);    opacity: 0.85; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

