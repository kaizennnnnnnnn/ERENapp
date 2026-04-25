'use client'

import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'
import { playSound } from '@/lib/sounds'

export default function PageSwiper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { activeScene, openScene } = useCare()

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (activeScene) return
    if (pathname !== '/home') return

    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    const elapsed = Date.now() - touchStartTime.current
    const velocity = Math.abs(dx) / elapsed

    // Trigger on 20% screen width or fast flick
    const threshold = window.innerWidth * 0.2
    if ((Math.abs(dx) > threshold || velocity > 0.4) && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx > 0) { playSound('ui_swipe_room'); openScene('feed') }
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  )
}
