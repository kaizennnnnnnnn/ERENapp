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

      // Head — ellipse, wider than tall, so the face reads as a flatter
      // cat head instead of a perfect circle.
      ctx.beginPath()
      ctx.ellipse(48, 54, 32, 26, 0, 0, Math.PI * 2)
      ctx.fill()

      // ── Ears — pointed but rounded. Outer + inner edges climb up,
      //    then a quadratic curve softens the apex. Anchored to the
      //    new flatter head curve. ──
      // Left ear
      ctx.beginPath()
      ctx.moveTo(24, 38)
      ctx.lineTo(26, 18)
      ctx.quadraticCurveTo(30, 8, 34, 18)
      ctx.lineTo(42, 32)
      ctx.closePath()
      ctx.fill()

      // Right ear
      ctx.beginPath()
      ctx.moveTo(72, 38)
      ctx.lineTo(70, 18)
      ctx.quadraticCurveTo(66, 8, 62, 18)
      ctx.lineTo(54, 32)
      ctx.closePath()
      ctx.fill()

      // ── Carve face cutouts — eyes, nose, mouth show through. ──
      ctx.globalCompositeOperation = 'destination-out'

      // ── Eyes: vertical ovals tilted slightly outward — taller than
      //    they are wide, so they read as alert open cat eyes (the
      //    vertical bias is what makes them feline at a glance). ──
      // Left eye
      ctx.beginPath()
      ctx.ellipse(38, 54, 4.5, 6.5, -0.25, 0, Math.PI * 2)
      ctx.fill()

      // Right eye — mirror tilt
      ctx.beginPath()
      ctx.ellipse(58, 54, 4.5, 6.5, 0.25, 0, Math.PI * 2)
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
      ctx.lineWidth = 1

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
