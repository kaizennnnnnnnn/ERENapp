import type { GachaRarity } from '@/types'
import { getTreatAtlas, RARITY_PRESENTATION, type AtlasRect } from '@/lib/gachaPresentation'
import { chefLidPose, clampOpening as clamp, easeOpening as ease, type ChefOpeningVariant, type TreatOpeningFrame, type TreatOpeningKind } from '@/lib/gachaTreatOpening'
import { drawRarityEffects } from './gachaRarityArt'

const TAU = Math.PI * 2

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill()
}

function piece(ctx: CanvasRenderingContext2D, atlas: HTMLImageElement, rect: AtlasRect, x: number, y: number, w: number, h: number) {
  ctx.drawImage(atlas, rect[0], rect[1], rect[2], rect[3], x, y, w, h)
}

function servingAccents(ctx: CanvasRenderingContext2D, frame: TreatOpeningFrame, variant: ChefOpeningVariant, reduced: boolean) {
  if (reduced || variant === 'original') return
  const p = frame.open, reveal = frame.release
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (variant === 'double-peek' && p < .4) {
    for (const at of [0,.2]) {
      const puff = clamp((p - at) / .18)
      if (puff <= 0 || puff >= 1) continue
      ctx.save(); ctx.globalAlpha *= Math.sin(puff * Math.PI) * .8
      ctx.strokeStyle = '#FFF4E7'; ctx.lineWidth = 3
      for (const side of [-1,1]) {
        const x = side * (112 + puff * 14), y = 33 - puff * 32
        ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + side * 15, y - 9, x - side * 8, y - 25, x + side * 9, y - 35); ctx.stroke()
      }
      ctx.restore()
    }
  }
  if (variant === 'ribbon-fan' && reveal > 0) {
    const travel = ease(reveal)
    ctx.save(); ctx.globalAlpha *= Math.sin(clamp(reveal / 1.15) * Math.PI) * .85
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1, layer = i % 3
      const x = side * (75 + layer * 33) * travel, y = -(135 + (2 - layer) * 25) * travel
      ctx.strokeStyle = i % 2 ? '#E5A1AC' : '#EEDAB8'; ctx.lineWidth = layer === 1 ? 5 : 3
      ctx.beginPath(); ctx.moveTo(side * 8, 15)
      ctx.bezierCurveTo(side * 35 * travel, -40 * travel, x * .85, y * .4, x, y); ctx.stroke()
      ctx.fillStyle = i % 2 ? '#D99AAA' : '#F7E8CF'
      ctx.save(); ctx.translate(x,y); ctx.rotate(side * (.4 + reveal)); ctx.fillRect(-3,-6,6,12); ctx.restore()
    }
    ctx.restore()
  }
  if (variant === 'golden-fountain' && reveal > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(reveal * 6)
    for (let i = -3; i <= 3; i++) {
      const t = (frame.releaseMs / 760 + (i + 3) * .14) % 1
      const point = (v: number) => ({
        x: 2 * (1 - v) * v * i * 28 + v * v * i * 44,
        y: (1 - v) ** 2 * 12 - 2 * (1 - v) * v * (250 + Math.abs(i) * 12) + v * v * 20,
      })
      ctx.save(); ctx.globalAlpha *= Math.sin(t * Math.PI)
      ctx.strokeStyle = i % 2 ? '#FFF1C5' : '#EAC571'; ctx.lineWidth = i === 0 ? 5 : 4
      const tail = point(Math.max(0,t - .32)); ctx.beginPath(); ctx.moveTo(tail.x,tail.y)
      for (let step = 1; step <= 8; step++) { const dot = point(Math.max(0,t - .32) + Math.min(t,.32) * step / 8); ctx.lineTo(dot.x,dot.y) }
      ctx.stroke()
      const head = point(t); ctx.fillStyle = '#F7DB8B'
      ctx.save(); ctx.translate(head.x,head.y); ctx.rotate(t * 2); ctx.fillRect(-4,-4,8,8); ctx.restore()
      ctx.restore()
    }
    ctx.restore()
  }
  if (variant === 'royal-procession' && reveal > 0) {
    const travel = ease(reveal)
    ctx.save(); ctx.globalAlpha *= clamp(reveal * 5) * .9
    for (const side of [-1,1]) {
      ctx.strokeStyle = side === -1 ? '#EBC879' : '#FFF0C9'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(side * 108, 40)
      ctx.bezierCurveTo(side * 165 * travel, -25 * travel, side * 150 * travel, -165 * travel, side * 15, -158 * travel); ctx.stroke()
      const drift = frame.releaseMs / 450
      for (let i = 0; i < 3; i++) {
        const y = -28 - i * 38 - Math.sin(drift + i) * 6
        ctx.fillStyle = i % 2 ? '#FFF0C9' : '#DDB663'
        ctx.save(); ctx.translate(side * (126 - i * 20) * travel, y * travel); ctx.rotate(Math.PI / 4 + drift * side * .2); ctx.fillRect(-3,-3,6,6); ctx.restore()
      }
    }
    ctx.restore()
  }
  ctx.restore()
}

function snackCase(
  ctx: CanvasRenderingContext2D, frame: TreatOpeningFrame, rarity: GachaRarity | null,
  atlas: HTMLImageElement, reduced: boolean,
) {
  const spec = getTreatAtlas('parcel', rarity)
  const tier = RARITY_PRESENTATION[rarity ?? 'common']
  const width = 256, bodyH = width * spec.body[3] / spec.body[2]
  const opening = ease(clamp((frame.open - .08) / .86))
  const angle = reduced ? 0 : opening * Math.PI * .56
  const lidDepth = width * spec.lid[3] / spec.lid[2]
  const projection = lidDepth * Math.cos(angle) - 140 * Math.sin(angle)
  const hingeWidth = 223
  const drawLid = () => {
    ctx.save()
    if (reduced) ctx.globalAlpha *= 1 - frame.open
    if (projection > 2) {
      piece(ctx, atlas, spec.lid, -width / 2, 0, width, projection)
    } else {
      // The rear hinge stays at y=0. Beyond edge-on we see the lined underside,
      // not the upside-down printed face or a stretched cardboard flap.
      ctx.save()
      ctx.beginPath(); ctx.moveTo(-hingeWidth / 2, 0); ctx.lineTo(hingeWidth / 2, 0)
      ctx.lineTo(width / 2, projection); ctx.lineTo(-width / 2, projection); ctx.closePath()
      ctx.clip()
      const sourceH = spec.body[3] * .24
      const sourceW = Math.min(spec.body[2] * .64, sourceH * width / Math.max(1, -projection))
      ctx.drawImage(atlas, spec.body[0] + (spec.body[2] - sourceW) / 2, spec.body[1] + spec.body[3] * .14,
        sourceW, sourceH, -width / 2, projection, width, Math.max(1, -projection))
      ctx.restore()
      ctx.strokeStyle = tier.trim; ctx.lineWidth = rarity === 'legendary' ? 7 : 5
      ctx.beginPath(); ctx.moveTo(-hingeWidth / 2, 0); ctx.lineTo(-width / 2, projection)
      ctx.lineTo(width / 2, projection); ctx.lineTo(hingeWidth / 2, 0); ctx.stroke()
      ctx.strokeStyle = '#F8E8CE'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(-width / 2 + 7, projection + 7); ctx.lineTo(width / 2 - 7, projection + 7); ctx.stroke()
    }
    ctx.restore()
  }

  ctx.save()
  ctx.translate(0, reduced ? 0 : 26 * (1 - ease(frame.arrival)))
  ctx.globalAlpha *= reduced ? 1 : clamp(frame.arrival * 5)
  oval(ctx, 0, bodyH + 8, 119, 9, 'rgba(25,34,29,.25)')
  if (projection <= 2) drawLid()
  piece(ctx, atlas, spec.body, -width / 2, 0, width, bodyH)

  if (frame.open > .12) {
    // The burst is inside the container; the front wall still occludes its origin.
    ctx.save()
    ctx.translate(0, 14)
    drawRarityEffects(ctx, 'food', rarity ?? 'common', (frame.burstMs - 80) * 1.8, reduced, true)
    ctx.restore()
    const frontY = spec.body[3] * .56
    ctx.drawImage(atlas, spec.body[0], spec.body[1] + frontY, spec.body[2], spec.body[3] - frontY,
      -width / 2, bodyH * .56, width, bodyH * .44)
  }
  if (!reduced && rarity === 'legendary' && frame.open === 0 && frame.wind > 0) {
    ctx.save(); ctx.translate(0, 12)
    drawRarityEffects(ctx, 'food', 'legendary', frame.wind * 480, false, true); ctx.restore()
  }
  if (projection > 2) drawLid()
  if (opening > .15) {
    for (const x of [-86, 86]) {
      ctx.fillStyle = rarity === 'common' ? '#C6A886' : '#D6B46C'
      ctx.fillRect(x - 6, -2, 12, 6); ctx.fillStyle = tier.trim; ctx.fillRect(x - 4, 0, 8, 2)
    }
  }
  ctx.restore()
}
function servingSet(ctx: CanvasRenderingContext2D, frame: TreatOpeningFrame, rarity: GachaRarity | null, atlas: HTMLImageElement, reduced: boolean, variant: ChefOpeningVariant) {
  const spec = getTreatAtlas('chef', rarity)
  const tier = RARITY_PRESENTATION[rarity ?? 'rare']
  const tierLevel = tier.level
  ctx.save()
  ctx.translate(reduced ? 0 : -35 * (1 - ease(frame.arrival)), 0)
  ctx.globalAlpha *= reduced ? 1 : clamp(frame.arrival * 4)
  oval(ctx, 0, 76, 126, 9, 'rgba(25,34,29,.25)')
  piece(ctx, atlas, spec.body, -137, -45, 274, 274 * spec.body[3] / spec.body[2])

  if (tier.level >= 2) {
    ctx.strokeStyle = tier.trim; ctx.lineWidth = tier.level === 3 ? 3 : 2
    ctx.beginPath(); ctx.ellipse(0, 44, 125, 23, 0, 0, Math.PI); ctx.stroke()
    for (const x of [-110, 110]) { ctx.fillStyle = tier.trim; ctx.fillRect(x - 3, 41, 6, 3) }
  }
  if (!reduced && frame.release > 0 && frame.release < .85) {
    const count = tierLevel === 0 ? 1 : tierLevel === 1 ? 3 : tierLevel === 2 ? 4 : 5
    for (let i = 0; i < count; i++) {
      const p = clamp((frame.release - i * .035) / .75)
      ctx.save(); ctx.globalAlpha *= Math.sin(p * Math.PI) * .5
      ctx.lineCap = 'round'; ctx.lineWidth = tierLevel > 1 ? 4 : 3; ctx.strokeStyle = tierLevel === 3 ? '#F1D48E' : '#FFF6E8'
      const x = (i - (count - 1) / 2) * 29, y = 5 - p * 64
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 15, y - 20, x + 18, y - 34, x, y - 52); ctx.stroke(); ctx.restore()
    }
  }
  const classicBurst = variant === 'original' || variant === 'double-peek' || reduced
  if ((classicBurst && frame.release > .15) || (!reduced && tierLevel === 3 && frame.open === 0 && frame.wind > 0)) {
    ctx.save(); ctx.translate(0, -10)
    const elapsed = frame.release > .15 ? (frame.releaseMs - 80) * 1.8 : frame.wind * 480
    drawRarityEffects(ctx, 'foodsuits', rarity ?? 'common', elapsed, reduced, true); ctx.restore()
  }
  servingAccents(ctx, frame, variant, reduced)

  ctx.save()
  // The lid exits to the side; no cat image is ever rendered under it.
  const pose = chefLidPose(rarity, frame.open, frame.wind, reduced, variant)
  ctx.translate(pose.x, pose.y); ctx.rotate(pose.angle); ctx.globalAlpha *= pose.alpha
  const lidW = 250, lidH = lidW * spec.lid[3] / spec.lid[2]
  piece(ctx, atlas, spec.lid, -lidW / 2, 48 - lidH, lidW, lidH)
  if (tier.level >= 2) {
    ctx.strokeStyle = tier.trim; ctx.lineWidth = tier.level === 3 ? 4 : 2
    ctx.beginPath(); ctx.ellipse(0, 34, 114, 18, 0, 0, Math.PI); ctx.stroke()
    ctx.fillStyle = rarity === 'legendary' ? '#DBB55C' : '#B77B89'
    for (const x of [-57, 0, 57]) {
      ctx.fillRect(x - 3, -19, 6, 12); ctx.fillRect(x - 6, -16, 12, 6)
    }
  }
  ctx.restore()
  ctx.restore()
}

export function drawTreatOpening(
  ctx: CanvasRenderingContext2D, kind: TreatOpeningKind, frame: TreatOpeningFrame,
  width: number, height: number, rarity: GachaRarity | null, reduced: boolean,
  atlas?: HTMLImageElement | null,
  chefVariant: ChefOpeningVariant = 'original',
) {
  if (!atlas?.complete || !atlas.naturalWidth) return
  const unit = Math.min(width / 390, height / 740, 1.35)
  ctx.save()
  ctx.translate(width / 2, height * .54); ctx.scale(unit, unit)
  ctx.lineJoin = 'round'; ctx.globalAlpha = 1 - frame.fade
  if (kind === 'parcel') snackCase(ctx, frame, rarity, atlas, reduced)
  else servingSet(ctx, frame, rarity, atlas, reduced, chefVariant)
  ctx.restore()
}
