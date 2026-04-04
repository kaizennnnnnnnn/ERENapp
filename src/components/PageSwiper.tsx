'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'

export default function PageSwiper({ children }: { children: React.ReactNode }) {
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
    if (pathname !== '/home') return

    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return

    if (dx > 0) openScene('feed') // swipe left → care rooms
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  )
}
