'use client'

import { memo } from 'react'
import { SUPER_JELLY_ART } from '@/lib/jellies'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Props {
  size?: number | string
  glow?: boolean
  wobble?: boolean
  className?: string
}

const SuperJelly = memo(function SuperJelly({ size = 96, glow = true, wobble = true, className = '' }: Props) {
  const reduced = useReducedMotion()
  return (
    <span aria-hidden className={className} style={{
      display: 'block', width: size, aspectRatio: '1',
      filter: glow ? 'drop-shadow(0 3px 3px rgba(179,111,47,0.25))' : undefined,
      animation: wobble && !reduced ? 'superJellyWobble 3.6s ease-in-out infinite' : undefined,
      transformOrigin: 'bottom center',
    }}>
      <img src={SUPER_JELLY_ART} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  )
})

export default SuperJelly
