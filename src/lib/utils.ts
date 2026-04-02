import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDate(date: string | Date, pattern = 'MMM d, yyyy') {
  return format(new Date(date), pattern)
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export function getStatColor(value: number): string {
  if (value >= 70) return 'text-green-600'
  if (value >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

export function getStatEmoji(value: number): string {
  if (value >= 80) return '😸'
  if (value >= 60) return '😺'
  if (value >= 40) return '😾'
  if (value >= 20) return '😿'
  return '🙀'
}

/** Returns the dominant mood for Eren based on current stats */
export function computeErenMood(stats: {
  happiness: number
  hunger: number
  energy: number
  sleep_quality: number
  cleanliness?: number
}): 'idle' | 'happy' | 'hungry' | 'sleepy' | 'playful' | 'angry' {
  const { happiness, hunger, energy, sleep_quality, cleanliness = 100 } = stats
  if (hunger < 30) return 'hungry'
  if (sleep_quality < 30) return 'sleepy'
  if (cleanliness < 25) return 'angry'
  if (happiness < 30) return 'angry'
  if (energy > 70 && happiness > 70) return 'playful'
  if (happiness > 80) return 'happy'
  return 'idle'
}

/** Determines if Eren should become sick based on stats */
export function shouldBecomeSick(stats: {
  cleanliness: number
  sleep_quality: number
  weight: number
}): boolean {
  return (
    stats.cleanliness < 15 ||
    stats.sleep_quality < 10 ||
    stats.weight > 7.5
  )
}

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}
