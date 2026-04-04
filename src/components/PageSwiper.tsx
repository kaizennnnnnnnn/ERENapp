'use client'

import { useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'

// Swipe order: games ← home → care rooms
//              memories ↔ profile navigated the same way
// Full left-right order for non-home pages:
const PAGE_ORDER = ['/games', '/home', '/memories', '/profile']

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

    const idx = PAGE_ORDER.findIndex(p => pathname === p || pathname.startsWith(p + '/'))
    if (idx === -1) return

    if (dx > 0) {
      // swipe left → go right in order
      if (pathname === '/home') openScene('feed')               // home → care rooms
      else if (idx < PAGE_ORDER.length - 1) router.push(PAGE_ORDER[idx + 1])
    } else {
      // swipe right → go left in order
      if (idx > 0) router.push(PAGE_ORDER[idx - 1])
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  )
}
