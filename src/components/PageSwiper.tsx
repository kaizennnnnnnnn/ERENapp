'use client'

import { useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'

// Pages reachable by left/right swipe from /home
// swipe left  → /games
// swipe right → opens feed care scene (then swipe within CareSceneHost)
const LEFT_OF_HOME  = '/games'

export default function PageSwiper({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { activeScene, openScene } = useCare()

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (activeScene) return
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return

    const onHome = pathname === '/home'

    if (onHome) {
      if (dx > 0) openScene('feed')           // swipe left  → care rooms
      else        router.push(LEFT_OF_HOME)   // swipe right → games
      return
    }

    // Other pages: /games ↔ /memories ↔ /profile
    const PAGE_ORDER = ['/games', '/memories', '/profile']
    const idx = PAGE_ORDER.findIndex(p => pathname === p || pathname.startsWith(p + '/'))
    if (idx === -1) return
    if (dx > 0 && idx < PAGE_ORDER.length - 1) router.push(PAGE_ORDER[idx + 1])
    else if (dx < 0 && idx > 0)                router.push(PAGE_ORDER[idx - 1])
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  )
}
