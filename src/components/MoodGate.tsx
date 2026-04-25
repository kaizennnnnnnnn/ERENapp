'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserMood, ErenMood } from '@/types'
import { MOOD_CONFIGS } from '@/types'
import { cn } from '@/lib/utils'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'

// Maps user mood → Eren's reaction mood
const MOOD_TO_EREN: Record<UserMood, ErenMood> = {
  good:  'happy',
  mid:   'idle',
  sad:   'hungry',
  angry: 'angry',
  tired: 'sleepy',
}

// Eren's speech bubble reaction after selection
const MOOD_REACTION: Record<UserMood, string> = {
  good:  'Purrrfect! 😸',
  mid:   'Eren is here for you!',
  sad:   'Come cuddle with Eren 🥺',
  angry: 'Eren is grumpy too!',
  tired: 'Nap time together 💤',
}

interface Props {
  userId: string
  userName: string
  onDone: (mood: UserMood) => void
}

export default function MoodGate({ userId, userName, onDone }: Props) {
  const supabase = createClient()
  const { completeTask } = useTasks()
  const [selected, setSelected]   = useState<UserMood | null>(null)
  const [animating, setAnimating] = useState(false)
  const [erenMood, setErenMood]   = useState<ErenMood>('happy')

  async function handleSelect(mood: UserMood) {
    if (animating) return
    setSelected(mood)
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
    onDone(mood)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-pink-50 via-purple-50 to-[#FDF6FF] relative overflow-hidden">

      {/* Pixel dot background */}
      <div className="absolute inset-0 pointer-events-none opacity-25" style={{
        backgroundImage: 'radial-gradient(circle, #C084FC 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }} />

      {/* Corner decorations */}
      <span className="absolute top-6 left-6 text-2xl pointer-events-none" style={{ animation: 'twinkle 2s ease-in-out infinite' }}>✦</span>
      <span className="absolute top-10 right-8 text-base pointer-events-none" style={{ animation: 'twinkle 2.4s ease-in-out infinite 0.8s' }}>✦</span>
      <span className="absolute bottom-16 left-8 text-base pointer-events-none" style={{ animation: 'twinkle 2.1s ease-in-out infinite 0.4s' }}>✦</span>
      <span className="absolute bottom-12 right-6 text-xl pointer-events-none" style={{ animation: 'twinkle 1.9s ease-in-out infinite 1.2s' }}>✦</span>
      <span className="absolute top-1/3 left-4 text-sm text-pink-200 pointer-events-none" style={{ fontFamily: 'monospace' }}>♥</span>
      <span className="absolute top-2/3 right-4 text-sm text-purple-200 pointer-events-none" style={{ fontFamily: 'monospace' }}>♥</span>

      {/* Eren — reacts to the selected mood */}
      <div className="flex flex-col items-center mb-6 relative z-10">
        <div className={cn('mb-3 transition-all duration-300', animating ? 'scale-110' : 'animate-float')}>
          <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 150, height: 150, objectFit: 'contain', imageRendering: 'pixelated' }} />
        </div>
        {/* Pixel speech bubble */}
        <div className="relative">
          <div className="px-5 py-2.5 min-w-[180px] text-center"
            style={{ background: 'white', borderRadius: 4, border: '2px solid #F0D8FF', boxShadow: '3px 3px 0 #E0CCFF' }}>
            {animating ? (
              <p className="text-sm font-medium text-[#FF6B9D]" style={{ animation: 'cursorBlink 0.8s steps(1) infinite' }}>
                {MOOD_REACTION[selected!]}
              </p>
            ) : (
              <p className="text-sm font-medium text-gray-600">
                Good {getTimeOfDay()},{' '}
                <span className="text-[#FF6B9D] font-bold">{userName.split(' ')[0]}</span>! 🐾
              </p>
            )}
          </div>
          {/* Bubble tail pointing up */}
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid #F0D8FF' }} />
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid white' }} />
        </div>
      </div>

      {/* Question + mood buttons — hidden while Eren animates */}
      <div className={cn('flex flex-col items-center w-full relative z-10 transition-all duration-400',
        animating ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'
      )}>
        <div className="mb-5 text-center">
          <h1 className="font-pixel text-[#1F1F2E] mb-2" style={{ fontSize: 11, lineHeight: 1.8 }}>HOW ARE<br/>YOU FEELING?</h1>
          <p className="text-xs text-gray-400">Pick your mood to enter</p>
        </div>

        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          {(Object.entries(MOOD_CONFIGS) as [UserMood, typeof MOOD_CONFIGS[UserMood]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { playSound('ui_tap'); handleSelect(key) }}
              className={cn(
                'flex items-center gap-4 px-4 py-2.5 transition-all duration-150 active:translate-y-[2px]',
              )}
              style={selected === key
                ? { background: 'linear-gradient(135deg, #FFF0F7, #FFE8F8)', borderRadius: 4, border: '2px solid #FF6B9D', boxShadow: '3px 3px 0 #FF4080' }
                : { background: 'rgba(255,255,255,0.85)', borderRadius: 4, border: '2px solid #EED8FF', boxShadow: '2px 2px 0 #D8C0F0' }
              }
            >
              {/* Pixel Eren face */}
              <div className="flex-shrink-0" style={{ width: 32, height: 32 }}>
                <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 32, height: 32, objectFit: 'contain', imageRendering: 'pixelated' }} />
              </div>
              <span className="text-sm font-semibold text-gray-700 flex-1 text-left">{cfg.label}</span>
              {selected === key && <span className="text-[#FF6B9D]">▶</span>}
            </button>
          ))}
        </div>

        <div className="mt-7 flex items-center gap-2">
          <div className="h-px w-8" style={{ background: 'repeating-linear-gradient(90deg, #DDD0F8 0px, #DDD0F8 3px, transparent 3px, transparent 6px)' }} />
          <p className="font-pixel text-gray-300" style={{ fontSize: 6 }}>EREN · ONCE A DAY</p>
          <div className="h-px w-8" style={{ background: 'repeating-linear-gradient(90deg, #DDD0F8 0px, #DDD0F8 3px, transparent 3px, transparent 6px)' }} />
        </div>
      </div>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
