'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { GachaRarity } from '@/types'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { treatOpeningFrame, type TreatOpeningKind } from '@/lib/gachaTreatOpening'
import { playSound } from '@/lib/sounds'
import { drawTreatOpening } from './treatOpeningArt'
import TapToSkip from './TapToSkip'

interface Props {
  kind: TreatOpeningKind
  rarity: GachaRarity | null
  rewardSrc?: string
  onDone: () => void
}

const BACKDROPS = { parcel: '/gacha_food.webp?v=2', chef: '/gacha_foodsuits.webp?v=1' }

/** Two physical openings share one clock and one canvas, not the reward RNG. */
export default function GachaTreatOpening({ kind, rarity, rewardSrc, onDone }: Props) {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const startRef = useRef<number | null>(null)
  const readyAtRef = useRef<number | null>(null)
  const rarityRef = useRef(rarity)
  const doneRef = useRef(onDone)
  const finishedRef = useRef(false)
  const skipRef = useRef(false)
  const landedRef = useRef(false)
  const openedRef = useRef(false)
  doneRef.current = onDone
  rarityRef.current = rarity

  const finish = useCallback(() => {
    if (finishedRef.current || rarityRef.current === null) return
    finishedRef.current = true
    doneRef.current()
  }, [])

  const skip = useCallback(() => {
    skipRef.current = true
    finish()
  }, [finish])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    rootRef.current?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])

  useEffect(() => {
    if (rarity === null) return
    if (readyAtRef.current === null) readyAtRef.current = performance.now()
    if (skipRef.current) finish()
  }, [rarity, finish])

  useEffect(() => {
    imageRef.current = null
    if (!rewardSrc) return
    const image = new Image()
    image.onload = () => { imageRef.current = image }
    image.src = rewardSrc
    return () => { image.onload = null }
  }, [rewardSrc])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      const timer = window.setInterval(finish, 150)
      return () => clearInterval(timer)
    }
    if (startRef.current === null) startRef.current = performance.now()
    let raf = 0, width = 0, height = 0, dpr = 1, previousPhase = ''
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
      const start = startRef.current!
      const ready = readyAtRef.current === null ? null : Math.max(0, readyAtRef.current - start)
      const frame = treatOpeningFrame(kind, now - start, ready, rarityRef.current, reduced)
      if (frame.done) { finish(); return }
      if (frame.phase !== previousPhase) {
        rootRef.current?.setAttribute('data-phase', frame.phase)
        previousPhase = frame.phase
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      drawTreatOpening(ctx, kind, frame, width, height, rarityRef.current, reduced, imageRef.current)
      if (frame.arrival >= 1 && !landedRef.current) {
        landedRef.current = true
        if (!skipRef.current) playSound('ui_select')
      }
      if (frame.open > 0 && !openedRef.current) {
        openedRef.current = true
        if (!skipRef.current) playSound('gift_open')
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); observer.disconnect() }
  }, [kind, finish, reduced])

  return (
    <div ref={rootRef} role="button" tabIndex={0} aria-busy={rarity === null}
      aria-label={kind === 'parcel' ? 'Skip snack parcel opening' : "Skip chef's surprise opening"}
      data-opening={kind} data-rarity={rarity ?? 'pending'}
      className="meadow-root fixed inset-0 z-[80] overflow-hidden m-focus"
      style={{ background: '#3F5047', cursor: 'pointer' }}
      onClick={skip} onKeyDown={event => {
        if (event.key === 'Tab') event.preventDefault()
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') { event.preventDefault(); skip() }
      }}>
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${BACKDROPS[kind]})`, backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
      <div className="absolute inset-0" style={{ background: 'rgba(31,45,37,.68)' }} />
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <TapToSkip />
    </div>
  )
}
