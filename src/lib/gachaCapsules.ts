import type { GachaRarity } from '@/types'

export type CapsulePattern = 'paw' | 'stripes' | 'spots' | 'spiral' | 'moon' | 'stars' | 'gem' | 'orbit' | 'crown'

export interface CreatureCapsule {
  id: string
  pattern: CapsulePattern
  shell: string
  light: string
  ink: string
  print: string
  rim: string
}

// Cosmetic only: these never participate in the item or rarity roll.
export const CREATURE_CAPSULES: Record<Exclude<GachaRarity, 'common'>, readonly CreatureCapsule[]> = {
  rare: [
    { id: 'garden-paw', pattern: 'paw', shell: '#83B98B', light: '#C0E3B6', ink: '#517453', print: '#FFF2CF', rim: '#FFF7E1' },
    { id: 'sky-stripe', pattern: 'stripes', shell: '#75ACD4', light: '#BCDEF0', ink: '#527B9C', print: '#F2F8F8', rim: '#EDF6FA' },
    { id: 'mint-spots', pattern: 'spots', shell: '#6BB9AD', light: '#BCE6CF', ink: '#477D72', print: '#FFF2D7', rim: '#EDF8DF' },
    { id: 'sea-spiral', pattern: 'spiral', shell: '#79BDBB', light: '#C3E3DB', ink: '#4F8580', print: '#FFF4D6', rim: '#F6F5D8' },
  ],
  epic: [
    { id: 'violet-moon', pattern: 'moon', shell: '#AE8BD2', light: '#E2CBF3', ink: '#765697', print: '#FFF2D1', rim: '#F8E8FF' },
    { id: 'rose-stars', pattern: 'stars', shell: '#C483B1', light: '#F0C4DC', ink: '#8F577F', print: '#FFF0CD', rim: '#FFE9F1' },
    { id: 'iris-gem', pattern: 'gem', shell: '#9181C5', light: '#CFCBF3', ink: '#65558D', print: '#F7E9FF', rim: '#F7E7FF' },
    { id: 'lilac-orbit', pattern: 'orbit', shell: '#AA7FC0', light: '#E2BFE6', ink: '#79568C', print: '#FFEDC7', rim: '#FCE6F6' },
  ],
  legendary: [
    { id: 'honey-crown', pattern: 'crown', shell: '#E8B343', light: '#FFE69D', ink: '#A97524', print: '#FFF5D9', rim: '#FFE49B' },
    { id: 'rose-gold-star', pattern: 'stars', shell: '#D99A72', light: '#F8D6AE', ink: '#9B643F', print: '#FFF4D0', rim: '#FFE3A0' },
    { id: 'pearl-orbit', pattern: 'orbit', shell: '#E7D6B0', light: '#FFF8E8', ink: '#A68039', print: '#B98628', rim: '#E4BD65' },
    { id: 'golden-paw', pattern: 'paw', shell: '#D8AC58', light: '#FFE7B4', ink: '#96702D', print: '#FFF6DF', rim: '#F5D28A' },
  ],
}

export function pickCreatureCapsule(rarity: GachaRarity, sample: number, previousId?: string): CreatureCapsule {
  // Creature Costumes has no commons; keep a safe cosmetic fallback if reused.
  const pool = CREATURE_CAPSULES[rarity === 'common' ? 'rare' : rarity]
  const choices = pool.filter(capsule => capsule.id !== previousId)
  return choices[Math.min(choices.length - 1, Math.floor(sample * choices.length))]
}
