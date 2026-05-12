// Decide whether it's "dark outside" right now, used to swap room
// backgrounds between day and night variants. Uses a per-month dusk/dawn
// table approximating mid-latitude Europe so the swap roughly tracks the
// real sun across seasons instead of a fixed hour year-round.
//
// Hours are local-time decimals (e.g. 19.5 == 7:30 PM). It's dark when
// the local hour is at or after dusk, or before dawn.

const DUSK_HOUR_BY_MONTH = [17, 17.5, 18.5, 20, 20.5, 21, 21, 20.5, 19.5, 18.5, 17, 16.5]
const DAWN_HOUR_BY_MONTH = [8,  7.5,  6.5,  6,  5.5,  5,  5.5,6,    6.5,  7,    7.5, 8]

export function isDarkOutside(date: Date = new Date()): boolean {
  const month = date.getMonth() // 0–11
  const hour  = date.getHours() + date.getMinutes() / 60
  const dusk  = DUSK_HOUR_BY_MONTH[month]
  const dawn  = DAWN_HOUR_BY_MONTH[month]
  return hour >= dusk || hour < dawn
}
