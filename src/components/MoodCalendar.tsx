'use client'

import { useMemo } from 'react'
import { format, startOfMonth, eachDayOfInterval, endOfMonth, getDay } from 'date-fns'
import type { DailyMood, UserMood } from '@/types'
import { MOOD_CONFIGS } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  moods: DailyMood[]
  userId: string
  partnerName?: string
}

export default function MoodCalendar({ moods, userId, partnerName }: Props) {
  const today = new Date()
  const days = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) })
  const startPad = getDay(days[0]) // 0=Sun

  // Build lookup: date string → mood
  const moodMap = useMemo(() => {
    const map: Record<string, { mine?: UserMood; partner?: UserMood }> = {}
    moods.forEach(m => {
      if (!map[m.date]) map[m.date] = {}
      if (m.user_id === userId) map[m.date].mine = m.mood as UserMood
      else map[m.date].partner = m.mood as UserMood
    })
    return map
  }, [moods, userId])

  return (
    <div className="p-4" style={{ background: 'white', borderRadius: 4, border: '2px solid #F0D8FF', boxShadow: '3px 3px 0 #E0C8F0' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)' }}>
          📅 {format(today, 'MMM').toUpperCase()}
        </span>
        <span className="font-pixel text-gray-400" style={{ fontSize: 7 }}>{format(today, 'yyyy')}</span>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 8, height: 8, borderRadius: 2, background: '#FF6B9D', border: '1px solid #CC3366', boxShadow: '1px 1px 0 #AA2050' }} />
          <span className="font-pixel text-gray-500" style={{ fontSize: 6 }}>ME</span>
        </span>
        {partnerName && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block" style={{ width: 8, height: 8, borderRadius: 2, background: '#A78BFA', border: '1px solid #7C3AED', boxShadow: '1px 1px 0 #6020CC' }} />
            <span className="font-pixel text-gray-500" style={{ fontSize: 6 }}>{partnerName.toUpperCase().slice(0, 8)}</span>
          </span>
        )}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1.5">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
          <div key={i} className="text-center pb-1">
            <span className="font-pixel text-gray-400" style={{ fontSize: 6 }}>{d}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1.5">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const entry = moodMap[dateStr]
          const isToday = dateStr === format(today, 'yyyy-MM-dd')

          return (
            <div
              key={dateStr}
              className="flex flex-col items-center justify-start gap-0.5 py-1"
              style={isToday ? {
                background: 'linear-gradient(135deg, #FFF0F7, #F8EEFF)',
                borderRadius: 3,
                border: '2px solid #FF6B9D',
                boxShadow: '1px 1px 0 #CC3366',
              } : {}}
            >
              <span className="font-pixel text-gray-400" style={{ fontSize: 6 }}>{format(day, 'd')}</span>
              <div className="flex flex-col items-center gap-px">
                {entry?.mine && (
                  <span className="leading-none" style={{ fontSize: 11 }} title="My mood">
                    {MOOD_CONFIGS[entry.mine].emoji}
                  </span>
                )}
                {entry?.partner && (
                  <span className="leading-none opacity-80" style={{ fontSize: 9 }} title={`${partnerName}'s mood`}>
                    {MOOD_CONFIGS[entry.partner].emoji}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
