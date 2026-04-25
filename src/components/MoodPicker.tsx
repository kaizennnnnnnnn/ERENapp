'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserMood } from '@/types'
import { MOOD_CONFIGS } from '@/types'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/sounds'

interface Props {
  userId: string
  existing?: UserMood | null
  onSave?: (mood: UserMood) => void
}

export default function MoodPicker({ userId, existing, onSave }: Props) {
  const supabase = createClient()
  const [selected, setSelected] = useState<UserMood | null>(existing ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!existing)

  async function handleSelect(mood: UserMood) {
    if (saving) return
    setSelected(mood)
    setSaving(true)

    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('daily_moods')
      .upsert({ user_id: userId, mood, date: today }, { onConflict: 'user_id,date' })

    setSaving(false)
    setSaved(true)
    onSave?.(mood)
  }

  return (
    <div className="card-pink">
      <p className="text-sm font-semibold text-gray-700 mb-3">
        {saved ? '✅ Mood saved for today!' : 'How are you feeling today?'}
      </p>
      <div className="flex gap-2 flex-wrap">
        {(Object.entries(MOOD_CONFIGS) as [UserMood, typeof MOOD_CONFIGS[UserMood]][]).map(
          ([key, cfg]) => (
            <button
              key={key}
              onClick={() => { playSound('ui_tap'); handleSelect(key) }}
              disabled={saving}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 transition-all duration-150 active:scale-95',
                selected === key
                  ? 'border-[#FF6B9D] bg-pink-50 scale-105'
                  : 'border-transparent bg-white hover:border-pink-200'
              )}
            >
              <span className="text-2xl">{cfg.emoji}</span>
              <span className="text-[10px] font-medium text-gray-600">{cfg.label}</span>
            </button>
          )
        )}
      </div>
    </div>
  )
}
