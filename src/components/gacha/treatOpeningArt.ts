import type { GachaRarity } from '@/types'
import { clampOpening as clamp, easeOpening as ease, type TreatOpeningFrame, type TreatOpeningKind } from '@/lib/gachaTreatOpening'
import { RARITY_FILL } from './rarity'

const TAU = Math.PI * 2
const INK = '#4A5048'

function polygon(ctx: CanvasRenderingContext2D, points: number[][], fill: string, stroke = true) {
  ctx.fillStyle = fill
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath(); ctx.fill()
  if (stroke) ctx.stroke()
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = false) {
  ctx.fillStyle = fill
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill()
  if (stroke) ctx.stroke()
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string) {
  polygon(ctx, [[x, y - size], [x + size * .28, y - size * .28], [x + size, y],
    [x + size * .28, y + size * .28], [x, y + size], [x - size * .28, y + size * .28],
    [x - size, y], [x - size * .28, y - size * .28]], fill, false)
}

function pawSeal(ctx: CanvasRenderingContext2D, accent: string) {
  oval(ctx, 0, 0, 23, 23, accent, true)
  oval(ctx, 0, 6, 9, 7, '#FFFFFF')
  for (const [x, y, r] of [[-12, -3, 3.5], [-5, -10, 4], [5, -10, 4], [12, -3, 3.5]]) {
    oval(ctx, x, y, r, r + 1, '#FFFFFF')
  }
}

function reward(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, bottom: number, height: number, progress: number) {
  if (!image || !image.complete || !image.naturalWidth || progress <= 0) return
  const h = height * (.8 + .2 * ease(progress))
  const w = Math.min(176, h * image.naturalWidth / image.naturalHeight)
  const fittedH = Math.min(h, w * image.naturalHeight / image.naturalWidth)
  ctx.save()
  ctx.globalAlpha *= clamp(progress * 5)
  ctx.drawImage(image, -w / 2, bottom - fittedH, w, fittedH)
  ctx.restore()
}

function paperBag(ctx: CanvasRenderingContext2D, frame: TreatOpeningFrame, image: HTMLImageElement | null, accent: string, reduced: boolean) {
  const opening = ease(frame.open)
  const land = frame.arrival
  let y = 0
  if (!reduced) {
    if (land < .58) y = -310 * (1 - Math.pow(land / .58, 2))
    else if (land < .85) y = -38 * Math.sin((land - .58) / .27 * Math.PI)
    else y = -8 * Math.sin((land - .85) / .15 * Math.PI)
  }
  const squash = reduced ? 1 : 1 - .12 * Math.exp(-Math.pow((land - .59) / .055, 2))
  ctx.save()
  ctx.globalAlpha *= reduced ? 1 : clamp(land * 7)
  ctx.translate(0, y)
  ctx.rotate(reduced ? 0 : Math.sin(frame.wind * Math.PI * 6) * .035 * (1 - opening))
  ctx.scale(1 / squash, squash)

  // Back gusset and two folded ears open before the parcel's front drops down.
  polygon(ctx, [[-75, -51], [-70, 102], [74, 102], [78, -51]], '#D7BDA2')
  oval(ctx, 0, -46, 73, 13 + opening * 5, '#7B6656')
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * 66, -46)
    ctx.rotate(side * opening * 1.02)
    polygon(ctx, [[0, 0], [side * 12, -56], [-side * 28, -36]], '#FFF3DA')
    ctx.restore()
  }
  ctx.save()
  ctx.translate(-opening * 10, -47 - opening * 38)
  ctx.rotate(-opening * .16)
  polygon(ctx, [[-76, 0], [-69, -52], [-58, -60], [58, -60], [70, -52], [76, 0]], '#F2D9B7')
  ctx.strokeStyle = '#C5A582'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-61, -41); ctx.lineTo(61, -41); ctx.stroke()
  ctx.restore()

  // Only the exposed mouth can show the prize; no image can leak through paper.
  ctx.save()
  ctx.beginPath(); ctx.rect(-130, -300, 260, 254); ctx.clip()
  reward(ctx, image, 70 - 126 * opening, 155, frame.open)
  ctx.restore()

  ctx.save()
  const frontTop = -48 + opening * 14
  polygon(ctx, [[-78, frontTop], [78, frontTop], [69, 110], [-67, 110]], '#FFF4DC')
  ctx.clip()
  ctx.fillStyle = '#ED9C9D'
  for (let x = -61; x < 80; x += 36) ctx.fillRect(x, frontTop, 16, 165)
  polygon(ctx, [[49, frontTop], [79, frontTop], [69, 110], [50, 110]], '#D4AE8B', false)
  ctx.strokeStyle = '#C9AB88'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-64, 95); ctx.lineTo(51, 95); ctx.lineTo(49, frontTop + 5); ctx.stroke()
  ctx.restore()

  // The sealed front fold flips away instead of stretching like rubber.
  ctx.save()
  ctx.translate(0, -48 + opening * 15)
  const foldScale = 1 - opening * 1.8
  ctx.scale(1, foldScale)
  polygon(ctx, [[-78, 0], [-70, 46], [0, 60], [70, 46], [78, 0]], '#FCE8C9')
  ctx.fillStyle = '#E5C7A3'; ctx.fillRect(-70, 0, 140, 7)
  ctx.translate(0, 25)
  if (foldScale > 0) pawSeal(ctx, accent)
  ctx.restore()
  ctx.restore()
}

function servingDish(ctx: CanvasRenderingContext2D, frame: TreatOpeningFrame, image: HTMLImageElement | null, accent: string, reduced: boolean) {
  const opening = ease(frame.open)
  const arrival = ease(frame.arrival)
  ctx.save()
  ctx.translate(reduced ? 0 : -330 * (1 - arrival), 14 * (1 - arrival))

  // The folded napkin and low oval tray make this a serving, not another capsule.
  polygon(ctx, [[-121, 44], [-27, 30], [56, 57], [-35, 103]], '#EB9A98')
  polygon(ctx, [[-109, 48], [-31, 43], [30, 61], [-37, 86]], '#F5C3AC', false)
  ctx.strokeStyle = '#FBE4C9'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(-94, 55); ctx.lineTo(-36, 76); ctx.lineTo(12, 62); ctx.stroke()
  ctx.strokeStyle = INK; ctx.lineWidth = 3
  oval(ctx, 0, 50, 128, 24, '#A3BEB0', true)
  oval(ctx, 0, 43, 128, 21, '#E9F3E8', true)
  oval(ctx, 0, 41, 110, 14, '#FFFFFF')
  ctx.strokeStyle = accent; ctx.lineWidth = 3
  ctx.beginPath(); ctx.ellipse(0, 41, 110, 14, 0, 0, Math.PI); ctx.stroke()
  reward(ctx, image, 46 - opening * 15, 190, frame.open)

  if (frame.open > 0) {
    for (let i = 0; i < 4; i++) {
      const p = clamp((frame.open - i * .06) / .9)
      ctx.save()
      ctx.globalAlpha *= Math.sin(p * Math.PI) * .8
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5 - i % 2; ctx.lineCap = 'round'
      const x = (i - 1.5) * 31, y = 22 - p * 135
      ctx.beginPath(); ctx.moveTo(x, y)
      ctx.bezierCurveTo(x - 23, y - 25, x + 24, y - 40, x + 2, y - 72)
      ctx.stroke(); ctx.restore()
    }
  }

  ctx.save()
  const rattle = reduced ? 0 : Math.sin(frame.wind * Math.PI * 8) * 3 * (1 - opening)
  ctx.translate(reduced ? 0 : opening * 49, -opening * (reduced ? 36 : 188) + rattle)
  ctx.rotate(reduced ? 0 : -.22 * opening)
  if (reduced) ctx.globalAlpha *= 1 - opening
  ctx.lineWidth = 3; ctx.strokeStyle = INK
  const metal = ctx.createLinearGradient(-112, 0, 112, 0)
  metal.addColorStop(0, '#7C9C90'); metal.addColorStop(.28, '#E3F1E5')
  metal.addColorStop(.6, '#C7DDD0'); metal.addColorStop(1, '#8FAA9D')
  ctx.fillStyle = metal
  ctx.beginPath(); ctx.moveTo(-114, 29)
  ctx.bezierCurveTo(-112, -126, 112, -126, 114, 29)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = '#F8FFF4'; ctx.lineWidth = 9; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-82, 5); ctx.bezierCurveTo(-80, -39, -55, -65, -27, -73); ctx.stroke()
  ctx.strokeStyle = INK; ctx.lineWidth = 3
  oval(ctx, 0, 29, 119, 13, '#8FAA9D', true)
  ctx.strokeStyle = '#ECF6E9'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.ellipse(0, 25, 113, 9, 0, 0, Math.PI); ctx.stroke()
  ctx.strokeStyle = INK; ctx.lineWidth = 3
  ctx.fillStyle = '#E6B95D'
  ctx.beginPath(); ctx.roundRect(-6, -103, 12, 17, 3); ctx.fill(); ctx.stroke()
  oval(ctx, 0, -106, 16, 9, '#F7D893', true)
  sparkle(ctx, 14, -27, 12, accent)
  ctx.restore()
  ctx.restore()
}

export function drawTreatOpening(
  ctx: CanvasRenderingContext2D, kind: TreatOpeningKind, frame: TreatOpeningFrame,
  width: number, height: number, rarity: GachaRarity | null, reduced: boolean,
  image: HTMLImageElement | null,
) {
  const unit = Math.min(width / 390, height / 740, 1.35)
  const accent = RARITY_FILL[rarity ?? 'rare']
  const cy = height * .56
  ctx.save()
  ctx.translate(width / 2, cy); ctx.scale(unit, unit)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = INK
  ctx.globalAlpha = 1 - frame.fade
  oval(ctx, 0, kind === 'parcel' ? 124 : 87, kind === 'parcel' ? 82 : 122, 9, 'rgba(20,36,26,.24)')
  if (kind === 'parcel') paperBag(ctx, frame, image, accent, reduced)
  else servingDish(ctx, frame, image, accent, reduced)

  if (frame.open > 0 && !reduced) {
    const count = rarity === 'legendary' ? 16 : rarity === 'epic' ? 10 : 6
    for (let i = 0; i < count; i++) {
      const p = clamp((frame.open - i % 3 * .04) / .85)
      const angle = i * 2.39996, distance = (92 + i % 4 * 14) * ease(p)
      const x = Math.cos(angle) * distance, y = -65 + Math.sin(angle) * distance * .8 - p * 24
      ctx.save()
      ctx.globalAlpha *= Math.sin(p * Math.PI)
      if (kind === 'parcel' && i % 3 === 0) {
        ctx.translate(x, y); ctx.rotate(p * 2 + angle)
        ctx.fillStyle = '#E7BC76'; ctx.fillRect(-3, -3, 6, 6)
      } else sparkle(ctx, x, y, 5 + i % 3 * 2, i % 2 ? '#FFF8DA' : accent)
      ctx.restore()
    }
  }
  // A small, local gold finish is reserved for a legendary, never a screen flash.
  if (rarity === 'legendary' && frame.open > .68) {
    const p = clamp((frame.open - .68) / .32)
    ctx.globalAlpha *= p
    for (const [x, y, size] of [[-91, -166, 10], [88, -143, 13], [13, -214, 8]]) sparkle(ctx, x, y, size, '#F4C35F')
  }
  ctx.restore()
}
