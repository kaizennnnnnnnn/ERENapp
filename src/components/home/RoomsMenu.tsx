// ─── Home rooms ──────────────────────────────────────────────────────────────
// Every room you can go to from the living room, in order. The bottom nav's
// Rooms tab lists them in its sheet (nav/RoomsSheet) and opens the one you
// pick; home's swipe dots name theirs from here.
//
// This file used to also hold the door button's dropdown menu. The door moved
// into the nav as the Rooms tab, so only the list is left; the path is kept so
// the nav's imports hold.

import type { ComponentType } from 'react'
import {
  IconDrumstick, IconYarn, IconMoonZ, IconBath,
  IconFlask, IconPill, IconSpeech, IconCake,
} from '@/components/PixelIcons'

export interface RoomDef {
  id: 'feed' | 'play' | 'sleep' | 'wash' | 'chemistry' | 'vet' | 'talk' | 'bakery'
  /** Shown through cat.t (lib/catWords) by the Rooms sheet and the swipe dots,
   *  so a label may name the cat. The bakery tile doesn't: at a quarter of the
   *  sheet's width a long name broke mid-word, and the bakery says it inside. */
  label: string
  Icon: ComponentType<{ size?: number }>
  color: string
  rgb: string
  /** Top-level route (bakery) — navigated via the cloud transition rather
   *  than opened as a swipe-room care scene. */
  href?: string
}

export const ROOMS: RoomDef[] = [
  { id: 'feed',      label: 'Kitchen',       Icon: IconDrumstick, color: '#F5C842', rgb: '245,200,66'  },
  { id: 'play',      label: 'Playroom',      Icon: IconYarn,      color: '#FF6B9D', rgb: '255,107,157' },
  { id: 'sleep',     label: 'Bedroom',       Icon: IconMoonZ,     color: '#818CF8', rgb: '129,140,248' },
  { id: 'wash',      label: 'Bathroom',      Icon: IconBath,      color: '#38BDF8', rgb: '56,189,248'  },
  { id: 'chemistry', label: 'Chem Lab',      Icon: IconFlask,     color: '#84CC16', rgb: '132,204,22'  },
  { id: 'vet',       label: 'Vet Office',    Icon: IconPill,      color: '#34D399', rgb: '52,211,153'  },
  { id: 'talk',      label: 'The Attic',     Icon: IconSpeech,    color: '#D8B4FE', rgb: '216,180,254' },
  { id: 'bakery',    label: 'Bakery',        Icon: IconCake,      color: '#FBBF24', rgb: '251,191,36', href: '/bakery' },
]
