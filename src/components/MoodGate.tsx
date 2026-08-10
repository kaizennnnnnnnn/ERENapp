'use client'

// ═══════════════════════════════════════════════════════════════════════════
// MOOD GATE — the once-a-day check-in that stands between you and /home.
// This file owns the data: the reaction pick, the Supabase upsert, the local
// cache, the partner ping. All the pixels live in mood/MoodGateView.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserMood, ErenMood } from '@/types'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'
import { type SketchErenState } from '@/components/SketchEren'
import { PUSH_MOODS } from '@/lib/moods'
import MoodGateView from '@/components/mood/MoodGateView'

// Each user mood maps to a pool of picked animations + speech lines. One is
// chosen at random each time so the reaction feels fresh. The mood→pill pose
// (MOOD_SKETCH) and the per-mood palette (MOOD_THEME) come from @/lib/moods
// so the couple-page partner card stays in sync.
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
    { picked: 'laugh',    line: 'Hahaha, love that!' },
    { picked: 'balloon',  line: 'Let\'s celebrate!' },
    { picked: 'highfive', line: 'Up top! Good day!' },
    { picked: 'sing',     line: 'Eren wrote you a song' },
  ],
  mid: [
    { picked: 'wave',     line: 'Eren is here for you!' },
    { picked: 'chill',    line: 'Just vibin\' today' },
    { picked: 'shrug',    line: 'Meh, we got this' },
    { picked: 'wink',     line: 'Could be worse!' },
    { picked: 'nom',      line: 'Snack break?' },
    { picked: 'listen',   line: 'Eren\'s listening...' },
    { picked: 'meditate', line: 'Stay calm, stay cool' },
    { picked: 'sip',      line: 'Let\'s have a slow one' },
    { picked: 'search',   line: 'Looking for the good bits' },
  ],
  sad: [
    { picked: 'cry',  line: 'Come cuddle with Eren' },
    { picked: 'sad',  line: 'Eren feels it too...' },
    { picked: 'pet',  line: 'Soft pats for you' },
    { picked: 'love', line: 'Eren loves you always' },
    { picked: 'bow',  line: 'It\'s okay to be sad' },
    { picked: 'shy',  line: 'Eren\'s here, promise' },
    { picked: 'cold', line: 'Cold day? Come closer' },
    { picked: 'gift', line: 'Eren saved this for you' },
  ],
  angry: [
    { picked: 'angry', line: 'Eren is grumpy too!' },
    { picked: 'flex',  line: 'RAWR! Let it out!' },
    { picked: 'gasp',  line: 'Who made you mad?!' },
    { picked: 'wow',   line: 'Oh no... deep breaths!' },
    { picked: 'proud', line: 'Anger is power, rawr!' },
    { picked: 'silly', line: 'Hiss! Then laugh it off' },
    { picked: 'facepalm', line: 'Ugh. What a day, huh' },
    { picked: 'scared',   line: 'Eek! Okay okay, breathe' },
  ],
  tired: [
    { picked: 'yawn',     line: 'Nap time together' },
    { picked: 'sleeping', line: 'Zzz... five more mins' },
    { picked: 'tired',    line: 'Eren is sleepy too...' },
    { picked: 'meditate', line: 'Rest your eyes...' },
    { picked: 'chill',    line: 'Take it easy today' },
    { picked: 'nom',      line: 'Coffee? Tea? Milk?' },
    { picked: 'sip',      line: 'Eren made you a warm one' },
    { picked: 'dizzy',    line: 'Whoa, running on fumes' },
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
    playSound('ui_select')
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
    localStorage.setItem(`eren_mood_${userId}_${today}`, mood)
    completeTask('daily_mood')
    // Memory Wall: signal first:mood. Plain Event — the watcher only needs
    // the trigger, not the payload (MoodGate already owns the value).
    try { window.dispatchEvent(new Event('eren:mood-logged')) } catch { /* ignore */ }

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
    <MoodGateView
      userName={userName}
      greeting={getTimeOfDay()}
      selected={selected}
      reaction={reaction}
      animating={animating}
      onSelect={handleSelect}
    />
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
