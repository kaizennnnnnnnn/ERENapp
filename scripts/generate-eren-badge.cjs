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

      // ── Head: a fat rounded body (chubby cheeks) ──
      ctx.beginPath()
      ctx.ellipse(48, 56, 34, 30, 0, 0, Math.PI * 2)
      ctx.fill()

      // ── Two pointy ears (triangles) ──
      ctx.beginPath()
      ctx.moveTo(18, 38)   // outer left base
      ctx.lineTo(28, 12)   // tip
      ctx.lineTo(40, 32)   // inner base
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(78, 38)   // outer right base
      ctx.lineTo(68, 12)   // tip
      ctx.lineTo(56, 32)   // inner base
      ctx.closePath()
      ctx.fill()

      // ── Eye cutouts (carve transparent holes) ──
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(36, 54, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(60, 54, 5, 0, Math.PI * 2)
      ctx.fill()

      // ── Mouth: tiny inverted T ──
      ctx.fillRect(46, 70, 4, 2)   // dot
      ctx.fillRect(40, 72, 4, 2)   // left whisker line
      ctx.fillRect(52, 72, 4, 2)   // right whisker line
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
