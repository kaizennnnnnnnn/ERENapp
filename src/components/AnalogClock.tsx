'use client'

import { useEffect, useId, useRef } from 'react'

interface Props {
  /** Pixel size of the rendered clock (square). */
  size?: number | string
  /** 'real' = wall-clock time. 'loop30' = sped-up so the second hand cycles every 30s. */
  mode?: 'real' | 'loop30'
  /** Crisp-edge rendering — jagged silhouettes on circles so the clock reads
   *  as pixel art instead of a smooth photoreal piece. */
  pixelated?: boolean
}

export default function AnalogClock({ size = 80, mode = 'real', pixelated = false }: Props) {
  const hourRef   = useRef<SVGGElement>(null)
  const minuteRef = useRef<SVGGElement>(null)
  const secondRef = useRef<SVGGElement>(null)
  const uid = useId().replace(/:/g, '')

  useEffect(() => {
    let raf = 0
    const startMs = performance.now()

    function frame() {
      let s: number, m: number, h: number
      if (mode === 'real') {
        const now = new Date()
        s = now.getSeconds() + now.getMilliseconds() / 1000
        m = now.getMinutes() + s / 60
        h = (now.getHours() % 12) + m / 60
      } else {
        const elapsed = (performance.now() - startMs) / 1000 * 2 // 2x → 30s loop
        s = elapsed % 60
        m = (elapsed / 60) % 60
        h = (elapsed / 3600) % 12
      }
      const sa = (s / 60) * 360
      const ma = (m / 60) * 360
      const ha = (h / 12) * 360
      secondRef.current?.setAttribute('transform', `rotate(${sa} 100 100)`)
      minuteRef.current?.setAttribute('transform', `rotate(${ma} 100 100)`)
      hourRef.current?.setAttribute('transform',   `rotate(${ha} 100 100)`)
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [mode])

  const ticks = []
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0
    ticks.push(
      <rect key={i}
        x={isHour ? 99 : 99.6} y={isHour ? 12 : 14}
        width={isHour ? 2 : 0.8} height={isHour ? 8 : 4}
        fill={isHour ? '#3A2A1A' : '#7A6A50'}
        transform={`rotate(${(i / 60) * 360} 100 100)`} />
    )
  }
  const numerals = []
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    const x = 100 + Math.cos(a) * 70
    const y = 100 + Math.sin(a) * 70 + 4.5
    numerals.push(<text key={i} x={x} y={y}>{i}</text>)
  }

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
      shapeRendering={pixelated ? 'crispEdges' : undefined}
      style={{
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))',
        display: 'block',
        imageRendering: pixelated ? 'pixelated' : undefined,
      }}>
      <defs>
        <radialGradient id={`face-${uid}`} cx="50%" cy="40%" r="62%">
          <stop offset="0%"   stopColor="#FFFAF0" />
          <stop offset="65%"  stopColor="#F0E6CC" />
          <stop offset="100%" stopColor="#C9B58E" />
        </radialGradient>
        <linearGradient id={`bezel-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#B69365" />
          <stop offset="50%"  stopColor="#7E5C36" />
          <stop offset="100%" stopColor="#3F2A18" />
        </linearGradient>
        <linearGradient id={`bezelInner-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#3F2A18" />
          <stop offset="100%" stopColor="#7E5C36" />
        </linearGradient>
        <radialGradient id={`inner-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="78%"  stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(60,40,20,0.35)" />
        </radialGradient>
        <linearGradient id={`hand-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#1A1A1A" />
          <stop offset="100%" stopColor="#444" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="98" fill={`url(#bezel-${uid})`} />
      <circle cx="100" cy="100" r="93" fill={`url(#bezelInner-${uid})`} />
      <circle cx="100" cy="100" r="89" fill="#2C1F12" />
      <circle cx="100" cy="100" r="86" fill={`url(#face-${uid})`} />
      <circle cx="100" cy="100" r="86" fill={`url(#inner-${uid})`} />

      <g>{ticks}</g>
      <g fontFamily="Georgia, 'Times New Roman', serif" fontSize="14" fontWeight={600} fill="#3A2A1A" textAnchor="middle">
        {numerals}
      </g>

      <g ref={hourRef}>
        <rect x="97" y="50" width="6" height="58" rx="2" fill={`url(#hand-${uid})`} />
      </g>
      <g ref={minuteRef}>
        <rect x="98" y="28" width="4" height="80" rx="1.5" fill={`url(#hand-${uid})`} />
      </g>
      <g ref={secondRef}>
        <rect x="99.4" y="22" width="1.2" height="92" fill="#C0392B" />
        <circle cx="100" cy="42" r="3.5" fill="#C0392B" />
      </g>
      <circle cx="100" cy="100" r="5.5" fill="#1A1A1A" />
      <circle cx="100" cy="100" r="2.4" fill="#C0392B" />
    </svg>
  )
}
