import type { GachaRarity } from '@/types'
import { GACHA_REVEAL_THEMES, type GachaMachine } from '@/lib/gachaPresentation'
import { clampOpening as clamp, easeOpening as ease } from '@/lib/gachaTreatOpening'

const TAU = Math.PI * 2
const GOLD = '#C39337'

function ring(ctx: CanvasRenderingContext2D, radius: number, squash: number, ink: string, alpha: number, width = 2) {
  if (radius <= 0 || alpha <= 0) return
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = ink; ctx.lineWidth = width
  ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * squash, 0, 0, TAU); ctx.stroke(); ctx.restore()
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, ink: string) {
  ctx.fillStyle = ink
  ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .55, y)
  ctx.lineTo(x, y + size); ctx.lineTo(x - size * .55, y); ctx.closePath(); ctx.fill()
}

function motif(ctx: CanvasRenderingContext2D, machine: GachaMachine, x: number, y: number, size: number, spin: number, ink: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2
  const shape = GACHA_REVEAL_THEMES[machine].motif
  if (shape === 'fizz') {
    ctx.beginPath(); ctx.arc(0, 0, size, 0, TAU); ctx.stroke()
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-size * .35, -size * .55, 2, 2)
  } else if (shape === 'stitch') {
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-size, size); ctx.lineTo(0, -size); ctx.lineTo(size, size); ctx.stroke()
    ctx.fillRect(-1, size + 3, 2, 3)
  } else if (shape === 'steam') {
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-size * .5, size)
    ctx.bezierCurveTo(size, size * .2, -size, -size * .2, size * .5, -size); ctx.stroke()
  } else {
    ctx.beginPath(); ctx.moveTo(-size, size); ctx.quadraticCurveTo(-size * 1.2, -size * 1.2, size, -size)
    ctx.quadraticCurveTo(size * 1.2, size * 1.2, -size, size); ctx.fill()
  }
  ctx.restore()
}

function particles(ctx: CanvasRenderingContext2D, machine: GachaMachine, progress: number, count: number, ink: string, spread: number, upward: boolean) {
  if (progress <= 0 || progress >= 1) return
  const travel = ease(progress)
  ctx.save(); ctx.globalAlpha *= Math.pow(1 - progress, .7)
  for (let i = 0; i < count; i++) {
    const angle = upward ? -Math.PI + .15 + (Math.PI - .3) * (i + .5) / count : TAU * i / count - Math.PI / 2
    const radius = 28 + travel * (spread + (i % 3) * 13)
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius * (upward ? 1 : .8) + (upward ? progress * progress * 38 : 0)
    motif(ctx, machine, x, y, 3 + i % 3, (i % 2 ? 1 : -1) * progress, ink)
  }
  ctx.restore()
}

function ribbons(ctx: CanvasRenderingContext2D, progress: number, ink: string, secondary: string, spread: number) {
  if (progress <= 0 || progress >= 1) return
  const phase = ease(progress), reach = spread * Math.sin(phase * Math.PI * .85)
  ctx.save(); ctx.globalAlpha *= Math.sin(progress * Math.PI) * .85; ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    ctx.strokeStyle = side === -1 ? ink : secondary; ctx.lineWidth = 5 * (1 - progress) + 1
    ctx.beginPath(); ctx.moveTo(side * 9, 34)
    ctx.bezierCurveTo(side * reach, 22, side * (reach + 40), -85, side * (reach * .45), -125 * phase)
    ctx.stroke()
    diamond(ctx, side * reach * .45, -125 * phase, 5, ctx.strokeStyle as string)
  }
  ctx.restore()
}

/** Deterministic local effects. No reward images, backdrop bitmaps, random draws, or full-screen flashes. */
export function drawRarityEffects(
  ctx: CanvasRenderingContext2D, machine: GachaMachine, rarity: GachaRarity,
  elapsed: number, reduced: boolean, opening = false,
) {
  const theme = GACHA_REVEAL_THEMES[machine]
  if (elapsed < 0) return
  const ink = rarity === 'legendary' ? GOLD : theme.ink
  ctx.save()
  if (reduced) {
    // One small static accent replaces travel, pulses and looping ornaments.
    ctx.globalAlpha *= .55
    for (let i = 0; i < (rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : 1); i++) {
      diamond(ctx, (i % 2 ? 1 : -1) * (opening ? 45 : 116), -32 - i * 23, 3 + i, ink)
    }
    ctx.restore(); return
  }
  const spread = opening ? 90 : 112
  if (opening) {
    const start = rarity === 'legendary' ? 420 : 0
    const pop = clamp((elapsed - start) / 520)
    if (pop > 0 && pop < 1) {
      ctx.save(); ctx.globalAlpha *= Math.sin(pop * Math.PI) * .8
      const size = ease(pop) * (rarity === 'legendary' ? 70 : rarity === 'epic' ? 52 : 35)
      ctx.fillStyle = rarity === 'legendary' ? '#F9E6AE' : '#FFFFFF'
      ctx.strokeStyle = ink; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(-size, 6)
      ctx.bezierCurveTo(-size * 1.35, -size * .5, -size * .55, -size * 1.1, -size * .25, -size * .65)
      ctx.bezierCurveTo(-size * .4, -size * 1.5, size * .4, -size * 1.5, size * .4, -size * .7)
      ctx.bezierCurveTo(size * 1.2, -size, size * 1.5, -size * .1, size, 6)
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
    }
  }
  if (rarity === 'common') {
    particles(ctx, machine, elapsed / 850, 5, ink, spread * .7, opening)
  } else if (rarity === 'rare') {
    for (const delay of [0, 260]) {
      const p = clamp((elapsed - delay) / 850)
      ring(ctx, 24 + ease(p) * spread, opening ? .45 : .83, ink, Math.sin(p * Math.PI) * .4)
    }
    particles(ctx, machine, (elapsed - 100) / 1200, 9, ink, spread, opening)
  } else if (rarity === 'epic') {
    ribbons(ctx, elapsed / 1500, ink, theme.secondary, spread)
    particles(ctx, machine, (elapsed - 180) / 1600, 12, theme.secondary, spread + 8, opening)
    for (let i = 0; i < 4; i++) {
      const p = clamp((elapsed - 300 - i * 100) / 1400)
      ctx.save(); ctx.globalAlpha *= Math.sin(p * Math.PI)
      diamond(ctx, (i % 2 ? 1 : -1) * (92 + (i % 3) * 16), -72 + i * 38, 6 * Math.sin(p * Math.PI), ink)
      ctx.restore()
    }
  } else {
    // Gather first, then unwind two gold arcs. This has a different rhythm from the epic sweep.
    const gather = clamp(elapsed / 520)
    if (gather < 1) {
      ctx.save(); ctx.globalAlpha *= Math.sin(gather * Math.PI)
      for (let i = 0; i < 8; i++) {
        const a = TAU * i / 8 + gather * .4, r = 145 - gather * 102
        diamond(ctx, Math.cos(a) * r, Math.sin(a) * r * .7, 4, GOLD)
      }
      ctx.restore()
    }
    const bloom = clamp((elapsed - 420) / 1500)
    if (bloom > 0 && bloom < 1) {
      ctx.save(); ctx.globalAlpha *= Math.sin(bloom * Math.PI); ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5
      for (const side of [-1, 1]) {
        const a = -Math.PI / 2 + side * bloom * TAU * .85, r = 64 + ease(bloom) * (spread - 25)
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * .8, 0, a - side * .9, a, side < 0); ctx.stroke()
        diamond(ctx, Math.cos(a) * r, Math.sin(a) * r * .8, 7, GOLD)
      }
      ctx.restore()
    }
    ribbons(ctx, (elapsed - 440) / 1800, GOLD, theme.secondary, spread + 12)
    particles(ctx, machine, (elapsed - 460) / 2100, 18, GOLD, spread + 12, opening)
  }
  // Slow, sparse motifs remain after the entrance; not another continuous explosion.
  if (!opening && rarity !== 'common' && elapsed > 1500) {
    const cycle = ((elapsed - 1500) % 4400) / 4400
    ctx.save(); ctx.globalAlpha *= .25 + Math.sin(cycle * Math.PI) * .35
    const count = rarity === 'rare' ? 2 : rarity === 'epic' ? 4 : 6
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1
      motif(ctx, machine, side * (108 + i % 3 * 9), 80 - cycle * 140 - i * 12, 3 + i % 3, cycle * .3, ink)
    }
    ctx.restore()
    if (rarity === 'epic' || rarity === 'legendary') {
      const turn = (elapsed - 1500) / (rarity === 'legendary' ? 3400 : 4400)
      ctx.save(); ctx.globalAlpha *= rarity === 'legendary' ? .65 : .45
      ctx.strokeStyle = ink; ctx.lineWidth = 1.7
      for (const side of [-1,1]) {
        const a = turn * TAU * side, x = Math.cos(a) * 123, y = Math.sin(a) * 92
        if (rarity === 'legendary') {
          ctx.beginPath(); ctx.ellipse(0, 0, 123, 92, 0, a - .55, a); ctx.stroke()
          diamond(ctx,x,y,5,GOLD)
        } else {
          const sway = Math.sin(a) * 13
          ctx.beginPath(); ctx.moveTo(side * 107, 88)
          ctx.bezierCurveTo(side * (150 + sway), 30, side * (100 + sway), -32, side * 117, -82)
          ctx.stroke(); diamond(ctx,side * 117,-82 + Math.sin(a) * 8,5,theme.secondary)
        }
      }
      ctx.restore()
    }
  }
  ctx.restore()
}
