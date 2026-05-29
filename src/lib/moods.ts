import type { UserMood } from '@/types'
import type { SketchErenState } from '@/components/SketchEren'

// Single source of truth for mapping a user's daily mood to an Eren pose
// and a colour palette. Used by the MoodGate picker and the partner-mood
// card on the couple page.

export const MOOD_SKETCH: Record<UserMood, SketchErenState> = {
  good:  'happy',
  mid:   'chill',
  sad:   'sad',
  angry: 'angry',
  tired: 'sleeping',
}

export const MOOD_THEME: Record<UserMood, {
  main: string; dark: string; light: string; text: string; glow: string;
}> = {
  good:  { main: '#10B981', dark: '#047857', light: '#D1FAE5', text: '#064E3B', glow: 'rgba(16,185,129,0.45)' },
  mid:   { main: '#F59E0B', dark: '#B45309', light: '#FEF3C7', text: '#78350F', glow: 'rgba(245,158,11,0.45)' },
  sad:   { main: '#3B82F6', dark: '#1E40AF', light: '#DBEAFE', text: '#1E3A8A', glow: 'rgba(59,130,246,0.45)' },
  angry: { main: '#EF4444', dark: '#991B1B', light: '#FEE2E2', text: '#7F1D1D', glow: 'rgba(239,68,68,0.45)' },
  tired: { main: '#A78BFA', dark: '#5B21B6', light: '#EDE9FE', text: '#3B0764', glow: 'rgba(167,139,250,0.45)' },
}

// Moods that surface the "send some love" prompt on the partner card.
export const LOW_MOODS: UserMood[] = ['sad', 'angry', 'tired']

// Moods that trigger a low-mood push to the partner. Tired is intentionally
// excluded — too common to notify on.
export const PUSH_MOODS: UserMood[] = ['sad', 'angry']
