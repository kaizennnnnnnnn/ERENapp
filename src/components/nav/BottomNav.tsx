'use client'

// ─── Bottom nav ──────────────────────────────────────────────────────────────
// The Meadow tab bar: Home, Rooms, Us, Play, Me. Mounted once in the (app)
// layout, outside PageSwiper (a sideways drag on the bar must not open the
// Kitchen). It shows on the four tab pages only, never on sub-pages like
// /settings or a game, never while a care scene is up, and steps aside when a
// page asks (useHideBottomNav).
//
// Rooms is not a page: it opens the Rooms sheet. Picking a care room goes home
// first (so closing the room lands you in the living room, not on Us) and opens
// the room there; the bakery is its own route behind the cloud transition,
// exactly as the old home door menu did it.
//
// Sits at z 45: over page content and home's HUD, under every overlay a page
// opens (TaskPanel / ReminderSheet at 50, sheets at 60+), and under AppFrame's
// thin console frame (50), which stays the outermost edge of the screen.

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type MouseEvent } from 'react'
import { useCare } from '@/contexts/CareContext'
import { requestCloudNav } from '@/components/CloudTransition'
import type { RoomDef } from '@/components/home/RoomsMenu'
import { MeadowIcon, type MeadowIconName } from '@/components/PixelIcons'
import { FONT_ROUNDED, M, NAV_HEIGHT } from '@/components/meadow/tokens'
import { playSound } from '@/lib/sounds'
import { useBottomNavHiddenByPage } from './NavVisibility'
import { RoomsSheet } from './RoomsSheet'
import { useUsBadge } from './useUsBadge'

/** The routes that carry the nav. Exact matches: /games/yarn-pop has no nav. */
export const NAV_ROUTES: readonly string[] = ['/home', '/couple', '/games', '/profile']

export type NavTab = 'home' | 'rooms' | 'us' | 'play' | 'me'

const TABS: ReadonlyArray<{ key: NavTab; label: string; icon: MeadowIconName; href?: string }> = [
  { key: 'home', label: 'Home', icon: 'home', href: '/home' },
  { key: 'rooms', label: 'Rooms', icon: 'door' },
  { key: 'us', label: 'Us', icon: 'hearts', href: '/couple' },
  { key: 'play', label: 'Play', icon: 'pad', href: '/games' },
  { key: 'me', label: 'Me', icon: 'person', href: '/profile' },
]

const TAB_FOR_ROUTE: Record<string, NavTab> = {
  '/home': 'home', '/couple': 'us', '/games': 'play', '/profile': 'me',
}

// ─── The bar (presentational) ────────────────────────────────────────────────

export interface BottomNavBarProps {
  active: NavTab | null
  /** Unread partner messages (0 = none). */
  usUnread: number
  /** Show the Us dot (unread or a reward waiting). */
  usDot: boolean
  roomsOpen: boolean
  onRooms: () => void
  /** A tab link was tapped (sound, scroll-to-top on the active tab). */
  onTab?: (tab: NavTab, e: MouseEvent<HTMLAnchorElement>) => void
}

function TabFace({ icon, label, on, dot }: { icon: MeadowIconName; label: string; on: boolean; dot?: boolean }) {
  return (
    <span style={{
      position: 'relative', width: 62, height: 50, borderRadius: 16, background: on ? M.leafTint : 'transparent',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
    }}>
      <MeadowIcon name={icon} color={on ? M.leaf : M.iconOff} />
      <span style={{ fontSize: 11, lineHeight: 1.1, fontWeight: on ? 800 : 700, color: on ? M.leafInk : M.text2 }}>
        {label}
      </span>
      {dot && (
        <span aria-hidden style={{
          // 8px dot inside a 2px white ring: 12px in all (border-box here).
          position: 'absolute', left: 38, top: 4, width: 12, height: 12, boxSizing: 'border-box',
          borderRadius: 999, background: M.love, border: '2px solid #FFFFFF',
        }} />
      )}
    </span>
  )
}

export function BottomNavBar({ active, usUnread, usDot, roomsOpen, onRooms, onTab }: BottomNavBarProps) {
  const itemCss = {
    flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', padding: 0, border: 0, background: 'transparent', cursor: 'pointer',
    fontFamily: FONT_ROUNDED, WebkitTapHighlightColor: 'transparent',
  } as const
  return (
    <nav aria-label="Main" className="meadow-root" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45, height: NAV_HEIGHT, boxSizing: 'border-box',
      padding: '6px 8px max(24px, env(safe-area-inset-bottom, 0px))', background: '#FFFFFF',
      borderTop: `1px solid ${M.hairline}`, display: 'flex', fontFamily: FONT_ROUNDED,
    }}>
      {TABS.map(tab => {
        if (!tab.href) {
          return (
            <button key={tab.key} type="button" onClick={onRooms} aria-haspopup="dialog" aria-expanded={roomsOpen}
              className="m-press m-focus" style={itemCss}>
              <TabFace icon={tab.icon} label={tab.label} on={roomsOpen} />
            </button>
          )
        }
        const on = active === tab.key && !roomsOpen
        const isUs = tab.key === 'us'
        const label = isUs && usDot
          ? usUnread > 0 ? `Us, ${usUnread} unread` : 'Us, a reward is waiting'
          : undefined
        return (
          <Link key={tab.key} href={tab.href} aria-current={active === tab.key ? 'page' : undefined} aria-label={label}
            onClick={e => onTab?.(tab.key, e)} className="m-press m-focus" style={itemCss}>
            <TabFace icon={tab.icon} label={tab.label} on={on} dot={isUs && usDot} />
          </Link>
        )
      })}
    </nav>
  )
}

// ─── The nav (container) ─────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { activeScene, openScene } = useCare()
  const hiddenByPage = useBottomNavHiddenByPage()
  const us = useUsBadge()
  const [roomsOpen, setRoomsOpen] = useState(false)

  const active = TAB_FOR_ROUTE[pathname] ?? null
  const visible = active !== null && !activeScene && !hiddenByPage

  // The picker never outlives the bar, and never survives a page change.
  useEffect(() => { if (!visible) setRoomsOpen(false) }, [visible])
  useEffect(() => { setRoomsOpen(false) }, [pathname])

  const openRooms = () => {
    playSound(roomsOpen ? 'ui_modal_close' : 'ui_modal_open')
    setRoomsOpen(o => !o)
  }
  const closeRooms = () => {
    playSound('ui_modal_close')
    setRoomsOpen(false)
  }
  const pickRoom = (room: RoomDef) => {
    playSound('ui_tap')
    setRoomsOpen(false)
    if (room.href) {
      requestCloudNav(room.href)
      return
    }
    // Rooms are opened over home, so leaving one returns to the living room.
    if (pathname !== '/home') router.push('/home')
    openScene(room.id as Exclude<RoomDef['id'], 'bakery'>)
  }
  const onTab = (tab: NavTab) => {
    playSound('ui_tap')
    // Tapping the tab you're on scrolls its page back to the top, like iOS.
    if (tab === active) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      document.querySelector('.meadow-page')?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!visible) return null
  return (
    <>
      <BottomNavBar active={active} usUnread={us.unread} usDot={us.show}
        roomsOpen={roomsOpen} onRooms={openRooms} onTab={onTab} />
      <RoomsSheet open={roomsOpen} onClose={closeRooms} onPick={pickRoom} />
    </>
  )
}
