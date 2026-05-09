/**
 * One-off generator for /public/ErenBadge.png — the monochrome silhouette
 * used as the Android notification small-icon (`badge` field). Android
 * masks the badge to a single tint color, so this image has to define
 * the cat shape via TRANSPARENCY: opaque pixels become the silhouette,
 * transparent pixels stay clear. Eye cutouts (transparent) make it read
 * as a cat face in the status bar instead of a featureless blob.
 *
 * Run once:  node scripts/generate-eren-badge.cjs
 */
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const SIZE = 96 // export resolution; Android will downsample to 24dp

;(async () => {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()

  await page.setContent(`<!doctype html><html><body style="margin:0">
    <canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
    <script>
      const c = document.getElementById('c')
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#FFFFFF'

      // ── Plain cartoon cat head: round face, two triangle ears, eye/
      //    nose/mouth carved out so they show through as background. ──

      // Round head.
      ctx.beginPath()
      ctx.arc(48, 56, 30, 0, Math.PI * 2)
      ctx.fill()

      // ── Ears — pointed but rounded, like a real cat (not razor-sharp).
      //    Outer + inner edges go straight up, then a quadratic curve
      //    rounds over the apex so the tip reads as a soft point. ──
      // Left ear
      ctx.beginPath()
      ctx.moveTo(22, 38)
      ctx.lineTo(24, 18)
      ctx.quadraticCurveTo(28, 8, 32, 18)
      ctx.lineTo(42, 32)
      ctx.closePath()
      ctx.fill()

      // Right ear
      ctx.beginPath()
      ctx.moveTo(74, 38)
      ctx.lineTo(72, 18)
      ctx.quadraticCurveTo(68, 8, 64, 18)
      ctx.lineTo(54, 32)
      ctx.closePath()
      ctx.fill()

      // ── Carve face cutouts — eyes, nose, mouth show through. ──
      ctx.globalCompositeOperation = 'destination-out'

      // ── Cat-eye almonds: pointed at both corners, fatter through the
      //    middle, with a small upward tilt at the OUTER corner for the
      //    classic feline lean. Two quadratic curves (top + bottom)
      //    meet at the sharp corner points. ──
      // Left eye — outer corner (44,49), inner corner (32,53).
      ctx.beginPath()
      ctx.moveTo(44, 49)                     // outer corner, lifted
      ctx.quadraticCurveTo(38, 44, 32, 53)   // top arc → inner corner
      ctx.quadraticCurveTo(38, 58, 44, 49)   // bottom arc back to outer
      ctx.closePath()
      ctx.fill()

      // Right eye — mirror.
      ctx.beginPath()
      ctx.moveTo(52, 53)                     // inner corner
      ctx.quadraticCurveTo(58, 44, 64, 49)   // top arc → outer corner (lifted)
      ctx.quadraticCurveTo(58, 58, 52, 53)   // bottom arc back to inner
      ctx.closePath()
      ctx.fill()

      // Tiny triangle nose.
      ctx.beginPath()
      ctx.moveTo(45, 64)
      ctx.lineTo(51, 64)
      ctx.lineTo(48, 68)
      ctx.closePath()
      ctx.fill()

      // Mouth — small "w" curve made from two arcs.
      ctx.lineWidth = 2
      ctx.strokeStyle = '#000'
      ctx.beginPath()
      ctx.arc(44, 70, 4, 0, Math.PI)         // left curve
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(52, 70, 4, 0, Math.PI)         // right curve
      ctx.stroke()

      ctx.globalCompositeOperation = 'source-over'
    </script>
  </body></html>`)

  const dataUrl = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'))
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const out = path.join(__dirname, '..', 'public', 'ErenBadge.png')
  fs.writeFileSync(out, Buffer.from(base64, 'base64'))
  console.log('Wrote', out, fs.statSync(out).size, 'bytes')

  await browser.close()
})()
