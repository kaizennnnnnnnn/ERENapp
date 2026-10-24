'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { GachaRarity } from '@/types'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playSound } from '@/lib/sounds'
import TapToSkip from './TapToSkip'

const TAU = Math.PI * 2
const PALETTE: Record<GachaRarity, { shell: string; light: string; ink: string }> = {
  common: { shell: '#83B98B', light: '#C0E3B6', ink: '#517453' },
  rare: { shell: '#83B98B', light: '#C0E3B6', ink: '#517453' },
  epic: { shell: '#AE8BD2', light: '#E2CBF3', ink: '#765697' },
  legendary: { shell: '#E8B343', light: '#FFE69D', ink: '#A97524' },
}
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const easeOut = (n: number) => 1 - Math.pow(1 - n, 3)

function paw(ctx: CanvasRenderingContext2D, size: number) {
  ctx.save()
  ctx.scale(size, size)
  ctx.beginPath()
  ctx.moveTo(-0.44, 0.25)
  ctx.bezierCurveTo(-0.7, 0.58, -0.48, 0.86, -0.17, 0.73)
  ctx.bezierCurveTo(0, 0.65, 0.13, 0.65, 0.3, 0.73)
  ctx.bezierCurveTo(0.63, 0.86, 0.79, 0.53, 0.51, 0.25)
  ctx.bezierCurveTo(0.14, -0.19, -0.09, -0.19, -0.44, 0.25)
  ctx.fill()
  for (const [x, y, turn] of [[-0.7, -0.18, -0.4], [-0.27, -0.53, -0.12], [0.25, -0.53, 0.12], [0.7, -0.18, 0.4]]) {
    ctx.beginPath(); ctx.ellipse(x, y, 0.2, 0.27, turn, 0, TAU); ctx.fill()
  }
  ctx.restore()
}

function star(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = size * (i % 2 ? 0.29 : 1)
    const x = Math.cos(a) * r, y = Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath(); ctx.fill()
}

interface Props {
  /** null keeps the capsule closed until the paid pull has resolved. */
  rarity: GachaRarity | null
  onDone: () => void
}

// One canvas, like the other drawn openings: no per-frame React updates or filters.
export default function GachaCreatureOpening({ rarity, onDone }: Props) {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rarityRef = useRef(rarity)
  const doneRef = useRef(onDone)
  const startRef = useRef(0)
  const resolvedRef = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const openedRef = useRef(false)
  rarityRef.current = rarity
  doneRef.current = onDone

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    doneRef.current()
  }, [])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    rootRef.current?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])

  useEffect(() => {
    if (rarity !== null && resolvedRef.current === null) resolvedRef.current = performance.now()
  }, [rarity])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      const timer = window.setTimeout(finish, 500)
      return () => clearTimeout(timer)
    }
    if (!startRef.current) startRef.current = performance.now()
    let frame = 0, width = 0, height = 0, dpr = 1
    const resize = () => {
      const box = canvas.getBoundingClientRect()
      width = box.width; height = box.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const draw = (now: number) => {
      if (finishedRef.current) return
      const elapsed = now - startRef.current
      const intro = reduced ? 220 : 980, shake = reduced ? 100 : 640
      const opening = reduced ? 150 : 820, fade = reduced ? 160 : 320
      const shakeAt = resolvedRef.current === null ? Infinity : Math.max(intro, resolvedRef.current - startRef.current)
      const openAt = shakeAt + shake
      if (elapsed >= openAt + opening + fade) { finish(); return }
      const pop = clamp((elapsed - openAt) / opening)
      const split = easeOut(pop)
      const leaving = clamp((elapsed - openAt - opening) / fade)
      const winding = clamp((elapsed - shakeAt) / shake)
      const pal = PALETTE[rarityRef.current ?? 'rare']
      const unit = Math.min(width / 390, height / 740, 1.3)
      const radius = 82 * unit, cx = width / 2, cy = height * 0.53
      let drop = 0, squash = 1, turn = 0
      if (!reduced) {
        if (elapsed < 460) drop = -height * 0.66 * (1 - Math.pow(elapsed / 460, 2))
        else if (elapsed < 760) drop = -52 * unit * Math.sin((elapsed - 460) / 300 * Math.PI)
        else if (elapsed < 980) drop = -14 * unit * Math.sin((elapsed - 760) / 220 * Math.PI)
        squash = 1 - 0.13 * Math.exp(-Math.pow((elapsed - 475) / 65, 2))
        turn = Math.sin(elapsed * 0.028) * 0.11 * winding * (1 - split)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'

      // A small floor shadow stays planted while the capsule bounces above it.
      ctx.fillStyle = 'rgba(31,46,32,0.22)'
      ctx.globalAlpha = (1 - split) * clamp(1 + drop / height)
      ctx.beginPath(); ctx.ellipse(cx, cy + radius + 13 * unit, radius * 0.76, 10 * unit, 0, 0, TAU); ctx.fill()
      ctx.globalAlpha = 1

      if (pop > 0 && !reduced) {
        // Rarity-coloured paper stars and paw stamps, not a screen-wide flash.
        for (let i = 0; i < 22; i++) {
          const p = clamp((pop - (i % 4) * 0.035) / 0.85)
          const angle = i * 2.39996
          const distance = (70 + (i % 5) * 29) * unit * easeOut(p)
          ctx.save()
          ctx.translate(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance + 52 * unit * p * p)
          ctx.rotate(angle + p * 1.6)
          ctx.globalAlpha = Math.sin(Math.PI * p) * (1 - leaving)
          ctx.fillStyle = [pal.light, '#FFF4D5', '#F3B4AA', '#ACD8AD'][i % 4]
          if (i % 6 === 0) paw(ctx, 9 * unit); else star(ctx, (5 + i % 4 * 2) * unit)
          ctx.restore()
        }
      }

      ctx.save()
      ctx.translate(cx, cy + drop)
      ctx.rotate(turn)
      ctx.scale(1 / squash, squash)
      ctx.globalAlpha = 1 - leaving
      ctx.lineWidth = 3 * unit
      ctx.strokeStyle = pal.ink

      // The opaque lower cup; the prize stays hidden until the normal reveal.
      ctx.save()
      ctx.translate(reduced ? 0 : split * radius * 0.28, split * radius * (reduced ? 0.12 : 0.8))
      ctx.rotate(reduced ? 0 : split * 0.15)
      const cream = ctx.createLinearGradient(0, 0, 0, radius)
      cream.addColorStop(0, '#FFF4DB'); cream.addColorStop(1, '#DECAA3')
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI)
      ctx.ellipse(0, 0, radius, radius * 0.16, 0, Math.PI, TAU)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#F9EBC9'
      ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * 0.16, 0, 0, TAU); ctx.fill(); ctx.stroke()
      ctx.restore()

      // The paw-patterned lid tips back, exposing a warm, lit seam.
      ctx.save()
      ctx.translate(reduced ? 0 : -radius * 0.4 * split, -radius * (reduced ? 0.16 : 1.85) * split)
      ctx.rotate(reduced ? 0 : -0.34 * split)
      const shell = ctx.createLinearGradient(-radius, -radius, radius, 0)
      shell.addColorStop(0, pal.light); shell.addColorStop(1, pal.shell)
      ctx.fillStyle = shell
      ctx.beginPath()
      ctx.arc(0, 0, radius, Math.PI, TAU)
      ctx.ellipse(0, 0, radius, radius * 0.16, 0, 0, Math.PI)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#FFF2CF'
      ctx.save(); ctx.translate(0, -radius * 0.46); paw(ctx, radius * 0.35); ctx.restore()
      ctx.fillStyle = 'rgba(255,255,255,0.56)'
      ctx.beginPath(); ctx.ellipse(-radius * 0.54, -radius * 0.52, radius * 0.11, radius * 0.23, 0.65, 0, TAU); ctx.fill()
      ctx.strokeStyle = '#FFF7E1'; ctx.lineWidth = 7 * unit
      ctx.beginPath(); ctx.ellipse(0, 0, radius - 3 * unit, radius * 0.16, 0, 0, Math.PI); ctx.stroke()
      ctx.fillStyle = pal.shell; ctx.strokeStyle = pal.ink; ctx.lineWidth = 2 * unit
      ctx.beginPath(); ctx.roundRect(-10 * unit, 8 * unit, 20 * unit, 12 * unit, 3 * unit); ctx.fill(); ctx.stroke()
      ctx.restore()
      ctx.restore()

      if (leaving > 0) {
        ctx.globalAlpha = leaving
        ctx.fillStyle = '#EAF4EC'; ctx.fillRect(0, 0, width, height)
      }
      ctx.globalAlpha = 1
      if (elapsed >= openAt && !openedRef.current) {
        openedRef.current = true
        playSound('gift_open')
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [finish, reduced])

  return (
    <div ref={rootRef} role="button" tabIndex={0} aria-label="Skip capsule opening"
      className="meadow-root fixed inset-0 z-[80] overflow-hidden m-focus"
      style={{ background: '#3E5142', cursor: 'pointer' }}
      onClick={finish} onKeyDown={event => {
        if (event.key === 'Tab') event.preventDefault()
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') { event.preventDefault(); finish() }
      }}>
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(/gacha_creatures.webp?v=1)', backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
      <div className="absolute inset-0" style={{ background: 'rgba(28,45,32,0.62)' }} />
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <TapToSkip />
    </div>
  )
}
