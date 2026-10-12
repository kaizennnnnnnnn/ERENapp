import type { CareScene } from '@/contexts/CareContext'

// ─── Room paintings ──────────────────────────────────────────────────────────
// Each room's background, by time of day. One table for the living room, the
// care rooms and the closet's preview, so a repainted room lands everywhere.

/** The living-room painting for the time of day. */
export function homeRoomArt(dark: boolean): string {
  return dark ? '/HomeNight.png' : '/HomeDay.png'
}

export const ROOM_ART_DAY: Partial<Record<CareScene, string>> = {
  feed:      '/kitchen.png',
  play:      '/playroom.png',
  sleep:     '/bedroom.png',
  wash:      '/bathroom.png',
  chemistry: '/ChemistryDay.png',
  vet:       '/vetBACK.png',
  garden:    '/garden/day.png',
  talk:      '/AtticDay.png',
}

export const ROOM_ART_DARK: Partial<Record<CareScene, string>> = {
  feed:      '/KitchenDark.png',
  play:      '/play.png',
  sleep:     '/bedroom.png',
  wash:      '/BathroomDark.png',
  chemistry: '/ChemistryNight.png',
  vet:       '/wetDark.png',
  garden:    '/garden/night.png',
  talk:      '/AtticNight.png',
}

/** Any room's painting, the living room included ('home'). */
export function roomArt(roomId: string, dark: boolean): string | undefined {
  if (roomId === 'home') return homeRoomArt(dark)
  return (dark ? ROOM_ART_DARK : ROOM_ART_DAY)[roomId as CareScene]
}
