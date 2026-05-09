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

      // ── Eren is a Ragdoll: pointy ears, big chubby cheek tufts that
      //    flare wider than the head, narrower chin/forehead. We draw the
      //    ruff/cheek puffs as two side ellipses overlapping a flatter
      //    main head, then ears, then carve eye + nose cutouts. ──

      // Cheek puffs / ruff — give the lower face the classic Ragdoll flare.
      ctx.beginPath()
      ctx.ellipse(18, 60, 12, 16, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(78, 60, 12, 16, 0, 0, Math.PI * 2)
      ctx.fill()

      // Main head — narrower at the top, slightly wider through the
      // cheekbones, tapered chin. Drawn as a closed Bezier path.
      ctx.beginPath()
      ctx.moveTo(28, 36)                                  // upper-left
      ctx.bezierCurveTo(28, 30, 36, 28, 48, 28)           // top arc
      ctx.bezierCurveTo(60, 28, 68, 30, 68, 36)           // top-right
      ctx.bezierCurveTo(74, 44, 76, 56, 72, 66)           // right cheek
      ctx.bezierCurveTo(66, 80, 56, 84, 48, 84)           // chin right
      ctx.bezierCurveTo(40, 84, 30, 80, 24, 66)           // chin left
      ctx.bezierCurveTo(20, 56, 22, 44, 28, 36)           // back to start
      ctx.closePath()
      ctx.fill()

      // Ears — chunky triangles, leaning slightly outward (Ragdoll style).
      // A small inner notch makes the ears feel tufted instead of flat.
      ctx.beginPath()
      ctx.moveTo(18, 38)
      ctx.lineTo(24, 8)
      ctx.lineTo(40, 32)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(78, 38)
      ctx.lineTo(72, 8)
      ctx.lineTo(56, 32)
      ctx.closePath()
      ctx.fill()

      // ── Carve cutouts to give the silhouette face features. ──
      ctx.globalCompositeOperation = 'destination-out'

      // Big almond eyes — Eren's most recognizable feature.
      ctx.beginPath()
      ctx.ellipse(36, 52, 6, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(60, 52, 6, 8, 0, 0, Math.PI * 2)
      ctx.fill()

      // Triangular nose.
      ctx.beginPath()
      ctx.moveTo(44, 64)
      ctx.lineTo(52, 64)
      ctx.lineTo(48, 70)
      ctx.closePath()
      ctx.fill()

      // Mouth — inverted Y under the nose.
      ctx.fillRect(47, 71, 2, 4)
      ctx.fillRect(42, 74, 6, 2)
      ctx.fillRect(48, 74, 6, 2)

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
