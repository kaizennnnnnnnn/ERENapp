'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { GachaRarity } from '@/types'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playSound } from '@/lib/sounds'
import { CREATURE_CAPSULES, pickCreatureCapsule, type CreatureCapsule } from '@/lib/gachaCapsules'
import TapToSkip from './TapToSkip'

const TAU = Math.PI * 2
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

function lidPath(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath()
  ctx.arc(0, 0, radius, Math.PI, TAU)
  ctx.ellipse(0, 0, radius, radius * 0.16, 0, 0, Math.PI)
  ctx.closePath()
}

function lidPrint(ctx: CanvasRenderingContext2D, radius: number, capsule: CreatureCapsule) {
  ctx.save()
  ctx.clip()
  ctx.scale(radius, radius)
  ctx.fillStyle = capsule.print
  ctx.strokeStyle = capsule.print
  ctx.lineWidth = 0.075
  switch (capsule.pattern) {
    case 'paw':
      ctx.translate(0, -0.46); paw(ctx, 0.35)
      break
    case 'stripes':
      ctx.lineWidth = 0.16
      for (const x of [-0.66, -0.12, 0.42]) {
        ctx.beginPath(); ctx.moveTo(x, 0.18); ctx.lineTo(x + 0.65, -1.1); ctx.stroke()
      }
      break
    case 'spots':
      for (const [x, y, size] of [[-0.42, -0.65, 0.12], [0.16, -0.76, 0.1], [0.56, -0.4, 0.13], [-0.04, -0.31, 0.14], [-0.61, -0.13, 0.09]]) {
        ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill()
      }
      break
    case 'spiral':
      ctx.beginPath()
      for (let i = 0; i <= 80; i++) {
        const t = i / 80, a = t * Math.PI * 4.8, r = 0.02 + t * 0.33
        const x = Math.cos(a) * r, y = -0.47 + Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    case 'moon':
      ctx.beginPath()
      ctx.moveTo(0.15, -0.84)
      ctx.bezierCurveTo(-0.6, -0.89, -0.6, -0.12, 0.15, -0.17)
      ctx.bezierCurveTo(-0.15, -0.31, -0.15, -0.7, 0.15, -0.84)
      ctx.fill()
      ctx.save(); ctx.translate(0.43, -0.57); star(ctx, 0.09); ctx.restore()
      break
    case 'stars':
      ctx.save(); ctx.translate(0, -0.47)
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.16 : 0.35
        const x = Math.cos(a) * r, y = Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.fill(); ctx.restore()
      for (const [x, y] of [[-0.52, -0.32], [0.47, -0.62]]) {
        ctx.save(); ctx.translate(x, y); star(ctx, 0.09); ctx.restore()
      }
      break
    case 'gem':
      ctx.beginPath(); ctx.moveTo(0, -0.83); ctx.lineTo(0.3, -0.48); ctx.lineTo(0, -0.13); ctx.lineTo(-0.3, -0.48); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = capsule.ink; ctx.lineWidth = 0.025
      ctx.beginPath(); ctx.moveTo(0, -0.77); ctx.lineTo(0, -0.19); ctx.moveTo(-0.25, -0.48); ctx.lineTo(0.25, -0.48); ctx.stroke()
      for (const x of [-0.53, 0.53]) { ctx.save(); ctx.translate(x, -0.43); star(ctx, 0.075); ctx.restore() }
      break
    case 'orbit':
      ctx.beginPath(); ctx.ellipse(0, -0.48, 0.49, 0.21, -0.45, 0, TAU); ctx.stroke()
      ctx.save(); ctx.translate(0, -0.48); star(ctx, 0.24); ctx.restore()
      ctx.beginPath(); ctx.arc(0.39, -0.71, 0.075, 0, TAU); ctx.fill()
      break
    case 'crown':
      ctx.beginPath(); ctx.moveTo(-0.36, -0.23); ctx.lineTo(-0.44, -0.71); ctx.lineTo(-0.2, -0.53)
      ctx.lineTo(0, -0.86); ctx.lineTo(0.2, -0.53); ctx.lineTo(0.44, -0.71); ctx.lineTo(0.36, -0.23)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = capsule.ink; ctx.lineWidth = 0.035
      ctx.beginPath(); ctx.moveTo(-0.29, -0.34); ctx.lineTo(0.29, -0.34); ctx.stroke()
      break
  }
  ctx.restore()
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
  const capsuleRef = useRef<CreatureCapsule>(CREATURE_CAPSULES.rare[0])
  const doneRef = useRef(onDone)
  const startRef = useRef(0)
  const resolvedRef = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const openedRef = useRef(false)
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
    if (rarity === null || resolvedRef.current !== null) return
    resolvedRef.current = performance.now()
    const key = `gacha:creature-capsule:${rarity}`
    let previous: string | undefined
    try { previous = sessionStorage.getItem(key) ?? undefined } catch { /* storage is optional */ }
    // Separate randomness keeps capsule cosmetics out of the reward's RNG stream.
    const sample = crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
    capsuleRef.current = pickCreatureCapsule(rarity, sample, previous)
    try { sessionStorage.setItem(key, capsuleRef.current.id) } catch { /* storage is optional */ }
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
      const pal = capsuleRef.current
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

      // Keep the selected print on the same lid through the wobble and split.
      ctx.save()
      ctx.translate(reduced ? 0 : -radius * 0.4 * split, -radius * (reduced ? 0.16 : 1.85) * split)
      ctx.rotate(reduced ? 0 : -0.34 * split)
      const shell = ctx.createLinearGradient(-radius, -radius, radius, 0)
      shell.addColorStop(0, pal.light); shell.addColorStop(1, pal.shell)
      ctx.fillStyle = shell
      lidPath(ctx, radius); ctx.fill()
      lidPrint(ctx, radius, pal)
      lidPath(ctx, radius); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.56)'
      ctx.beginPath(); ctx.ellipse(-radius * 0.54, -radius * 0.52, radius * 0.11, radius * 0.23, 0.65, 0, TAU); ctx.fill()
      ctx.strokeStyle = pal.rim; ctx.lineWidth = 7 * unit
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
