import type { ShiftRow } from '@/components/kiosk/useKioskRecord'

export interface KioskStampDay {
  date: string
  label: string
  today: boolean
  future: boolean
  mine: boolean
  theirs: boolean
}
export interface KioskWeek {
  days: KioskStampDay[]
  mine: number
  theirs: number
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** The server's night date already includes the household's 4 AM boundary. */
export function kioskWeek(rows: ShiftRow[], actor: string, nightDate: string): KioskWeek {
  const monday = new Date(`${nightDate}T12:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  const eligible = rows.filter(row => row.version === 2 && row.served > 0 && row.shift_date <= nightDate)
  const mine = new Set(eligible.filter(row => row.user_id === actor).map(row => row.shift_date))
  const theirs = new Set(eligible.filter(row => row.user_id !== actor).map(row => row.shift_date))
  const days = DAYS.map((label, index) => {
    const day = new Date(monday)
    day.setUTCDate(day.getUTCDate() + index)
    const date = day.toISOString().slice(0, 10)
    return { date, label, today: date === nightDate, future: date > nightDate, mine: mine.has(date), theirs: theirs.has(date) }
  })
  return { days, mine: days.filter(day => day.mine).length, theirs: days.filter(day => day.theirs).length }
}
